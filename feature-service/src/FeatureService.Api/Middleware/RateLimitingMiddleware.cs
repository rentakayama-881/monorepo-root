using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;

namespace FeatureService.Api.Middleware;

/// <summary>
/// PostgreSQL-backed rate limiter with per-route policy support.
/// Uses in-memory fixed window counters (rate limit records are ephemeral).
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly RateLimitOptions _options;

    // In-memory concurrent dictionary for rate limiting (no need to persist in DB)
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, RateLimitEntry> _counters = new();

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

    public RateLimitingMiddleware(RequestDelegate next, ILogger<RateLimitingMiddleware> logger,
        RateLimitOptions options)
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

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";
        var policy = ClassifyRequest(path, context.Request.Method);
        var (maxRequests, windowSeconds) = GetPolicyLimits(policy);

        var clientId = GetClientIdentifier(context, policy);
        var now = DateTime.UtcNow;
        var windowStart = new DateTime(now.Ticks - (now.Ticks % (TimeSpan.TicksPerSecond * windowSeconds)), DateTimeKind.Utc);
        var bucketKey = $"{policy}:{clientId}:{windowStart:yyyyMMddHHmmss}";

        var entry = _counters.AddOrUpdate(
            bucketKey,
            _ => new RateLimitEntry { Count = 1, WindowStart = windowStart },
            (_, existing) =>
            {
                if (existing.WindowStart < windowStart)
                {
                    // Window has rolled over, reset
                    return new RateLimitEntry { Count = 1, WindowStart = windowStart };
                }
                existing.Count++;
                return existing;
            });

        var currentCount = entry.Count;

        // Periodically clean up old entries
        if (_counters.Count > 10000)
        {
            CleanupExpiredEntries(windowStart);
        }

        if (currentCount > maxRequests)
        {
            _logger.LogWarning("Rate limit exceeded for {ClientId} (policy={Policy}, limit={Limit}/{Window}s)",
                clientId, policy, maxRequests, windowSeconds);

            context.Response.StatusCode = 429;
            context.Response.Headers.Append("Retry-After", windowSeconds.ToString());
            context.Response.Headers.Append("X-RateLimit-Limit", maxRequests.ToString());
            context.Response.Headers.Append("X-RateLimit-Remaining", "0");
            context.Response.ContentType = "application/json";
            return;
        }

        context.Response.Headers.Append("X-RateLimit-Limit", maxRequests.ToString());
        context.Response.Headers.Append("X-RateLimit-Remaining",
            Math.Max(0, maxRequests - currentCount).ToString());

        await _next(context);
    }

    private static void CleanupExpiredEntries(DateTime currentWindowStart)
    {
        foreach (var kvp in _counters)
        {
            if (kvp.Value.WindowStart < currentWindowStart.AddMinutes(-5))
            {
                _counters.TryRemove(kvp.Key, out _);
            }
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
        if (policy == RateLimitPolicy.Financial)
        {
            var userId = context.User?.FindFirst("user_id")?.Value
                ?? context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))
                return $"user:{userId}";
        }

        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            ip = forwardedFor.Split(',')[0].Trim();
        }

        return $"ip:{ip}";
    }

    private enum RateLimitPolicy { Global, Financial, Callback }

    private class RateLimitEntry
    {
        public int Count { get; set; }
        public DateTime WindowStart { get; set; }
    }
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
