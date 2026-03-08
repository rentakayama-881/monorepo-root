using System.Collections.Concurrent;

namespace FeatureService.Api.Middleware;

/// <summary>
/// In-memory rate limiter with per-route policy support.
/// Uses sliding window algorithm with separate limits for financial, callback, and general endpoints.
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly RateLimitOptions _options;
    private static readonly ConcurrentDictionary<string, RateLimitEntry> _clients = new();

    private static readonly string[] FinancialPrefixes =
    [
        "/api/v1/wallets/deposits",
        "/api/v1/wallets/withdrawals",
        "/api/v1/wallets/transfers",
        "/api/v1/wallets/set-pin",
        "/api/v1/wallets/verify-pin",
        "/api/v1/market-purchases"
    ];

    private static readonly string[] CallbackPrefixes =
    [
        "/api/v1/callbacks"
    ];

    public RateLimitingMiddleware(RequestDelegate next, ILogger<RateLimitingMiddleware> logger, RateLimitOptions options)
    {
        _next = next;
        _logger = logger;
        _options = options;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/health"))
        {
            await _next(context);
            return;
        }

        // Skip rate limiting for CORS preflight
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";
        var policy = ClassifyRequest(path, context.Request.Method);
        var (maxRequests, windowSeconds) = GetPolicyLimits(policy);

        var clientId = GetClientIdentifier(context, policy);
        var bucketKey = $"{policy}:{clientId}";
        var now = DateTime.UtcNow;

        var entry = _clients.GetOrAdd(bucketKey, _ => new RateLimitEntry());

        lock (entry)
        {
            var windowStart = now.AddSeconds(-windowSeconds);
            while (entry.RequestTimestamps.Count > 0 && entry.RequestTimestamps.Peek() < windowStart)
            {
                entry.RequestTimestamps.Dequeue();
            }

            if (entry.RequestTimestamps.Count >= maxRequests)
            {
                _logger.LogWarning("Rate limit exceeded for {BucketKey} (policy={Policy}, limit={Limit}/{Window}s)",
                    bucketKey, policy, maxRequests, windowSeconds);

                context.Response.StatusCode = 429;
                context.Response.Headers.Append("Retry-After", windowSeconds.ToString());
                context.Response.Headers.Append("X-RateLimit-Limit", maxRequests.ToString());
                context.Response.Headers.Append("X-RateLimit-Remaining", "0");
                context.Response.ContentType = "application/json";
                return;
            }

            entry.RequestTimestamps.Enqueue(now);
        }

        context.Response.Headers.Append("X-RateLimit-Limit", maxRequests.ToString());
        context.Response.Headers.Append("X-RateLimit-Remaining",
            Math.Max(0, maxRequests - entry.RequestTimestamps.Count).ToString());

        await _next(context);

        if (Random.Shared.Next(100) == 0)
        {
            CleanupOldEntries();
        }
    }

    private static RateLimitPolicy ClassifyRequest(string path, string method)
    {
        foreach (var prefix in CallbackPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return RateLimitPolicy.Callback;
        }

        foreach (var prefix in FinancialPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                // Only apply strict Financial limit to write operations
                // GET/HEAD are safe reads — use Global limit
                if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method))
                    return RateLimitPolicy.Global;
                return RateLimitPolicy.Financial;
            }
        }

        return RateLimitPolicy.Global;
    }

    private (int maxRequests, int windowSeconds) GetPolicyLimits(RateLimitPolicy policy) => policy switch
    {
        RateLimitPolicy.Financial => (_options.FinancialMaxRequests, _options.FinancialWindowSeconds),
        RateLimitPolicy.Callback => (_options.CallbackMaxRequests, _options.CallbackWindowSeconds),
        _ => (_options.MaxRequests, _options.WindowSeconds)
    };

    private static string GetClientIdentifier(HttpContext context, RateLimitPolicy policy)
    {
        // Financial endpoints: always use user_id for stricter per-user limiting
        if (policy == RateLimitPolicy.Financial)
        {
            var userId = context.User?.FindFirst("user_id")?.Value
                ?? context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))
                return $"user:{userId}";
        }

        // Callbacks and general: use IP
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            ip = forwardedFor.Split(',')[0].Trim();
        }

        return $"ip:{ip}";
    }

    private void CleanupOldEntries()
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-5);
        var keysToRemove = new List<string>();

        foreach (var kvp in _clients)
        {
            lock (kvp.Value)
            {
                if (kvp.Value.RequestTimestamps.Count == 0 ||
                    (kvp.Value.RequestTimestamps.Count > 0 && kvp.Value.RequestTimestamps.Peek() < cutoff))
                {
                    keysToRemove.Add(kvp.Key);
                }
            }
        }

        foreach (var key in keysToRemove)
        {
            _clients.TryRemove(key, out _);
        }
    }

    private class RateLimitEntry
    {
        public Queue<DateTime> RequestTimestamps { get; } = new();
    }

    private enum RateLimitPolicy { Global, Financial, Callback }
}

/// <summary>
/// Rate limit configuration with per-policy limits.
/// </summary>
public class RateLimitOptions
{
    // Global: 100 req / 60s per IP
    public int MaxRequests { get; set; } = 100;
    public int WindowSeconds { get; set; } = 60;

    // Financial (deposit, withdraw, transfer): 10 req / 60s per user
    public int FinancialMaxRequests { get; set; } = 10;
    public int FinancialWindowSeconds { get; set; } = 60;

    // Callback: 30 req / 60s per IP
    public int CallbackMaxRequests { get; set; } = 30;
    public int CallbackWindowSeconds { get; set; } = 60;
}

/// <summary>
/// Extension methods for rate limiting middleware
/// </summary>
public static class RateLimitingMiddlewareExtensions
{
    public static IApplicationBuilder UseRateLimiting(this IApplicationBuilder builder, Action<RateLimitOptions>? configure = null)
    {
        var options = new RateLimitOptions();
        configure?.Invoke(options);

        return builder.UseMiddleware<RateLimitingMiddleware>(options);
    }
}
