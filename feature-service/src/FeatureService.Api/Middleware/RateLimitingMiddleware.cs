using System.Collections.Concurrent;

namespace FeatureService.Api.Middleware;

/// <summary>
/// Simple in-memory rate limiter for API endpoints
/// Uses sliding window algorithm
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly RateLimitOptions _options;
    private static readonly ConcurrentDictionary<string, RateLimitEntry> _clients = new();

    public RateLimitingMiddleware(RequestDelegate next, ILogger<RateLimitingMiddleware> logger, RateLimitOptions options)
    {
        _next = next;
        _logger = logger;
        _options = options;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip rate limiting for health checks
        if (context.Request.Path.StartsWithSegments("/health"))
        {
            await _next(context);
            return;
        }

        var clientId = GetClientIdentifier(context);
        var now = DateTime.UtcNow;

        // Get or create rate limit entry for this client
        var entry = _clients.GetOrAdd(clientId, _ => new RateLimitEntry());

        lock (entry)
        {
            // Remove expired timestamps
            var windowStart = now.AddSeconds(-_options.WindowSeconds);
            while (entry.RequestTimestamps.Count > 0 && entry.RequestTimestamps.Peek() < windowStart)
            {
                entry.RequestTimestamps.Dequeue();
            }

            // Check if limit exceeded
            if (entry.RequestTimestamps.Count >= _options.MaxRequests)
            {
                _logger.LogWarning("Rate limit exceeded for client {ClientId}", clientId);
                
                context.Response.StatusCode = 429;
                context.Response.Headers.Append("Retry-After", _options.WindowSeconds.ToString());
                context.Response.Headers.Append("X-RateLimit-Limit", _options.MaxRequests.ToString());
                context.Response.Headers.Append("X-RateLimit-Remaining", "0");
                context.Response.Headers.Append("X-RateLimit-Reset", windowStart.AddSeconds(_options.WindowSeconds).ToString("O"));

                context.Response.ContentType = "application/json";
                var response = new
                {
                    success = false,
                    error = new
                    {
                        code = "TOO_MANY_REQUESTS",
                        message = $"Rate limit exceeded. Maximum {_options.MaxRequests} requests per {_options.WindowSeconds} seconds."
                    },
                    meta = new
                    {
                        requestId = context.Items["RequestId"]?.ToString() ?? Guid.NewGuid().ToString(),
                        timestamp = now
                    }
                };

                return;
            }

            // Add current request timestamp
            entry.RequestTimestamps.Enqueue(now);
        }

        // Add rate limit headers
        context.Response.Headers.Append("X-RateLimit-Limit", _options.MaxRequests.ToString());
        context.Response.Headers.Append("X-RateLimit-Remaining", Math.Max(0, _options.MaxRequests - entry.RequestTimestamps.Count).ToString());

        await _next(context);

        // Cleanup old entries periodically (every 100 requests)
        if (Random.Shared.Next(100) == 0)
        {
            CleanupOldEntries();
        }
    }

    private static string GetClientIdentifier(HttpContext context)
    {
        // Use user ID if authenticated, otherwise use IP
        var userId = context.User?.FindFirst("user_id")?.Value 
            ?? context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        
        if (!string.IsNullOrEmpty(userId))
        {
            return $"user:{userId}";
        }

        // Fallback to IP address
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
}

/// <summary>
/// Rate limit configuration options
/// </summary>
public class RateLimitOptions
{
    /// <summary>
    /// Maximum number of requests allowed in the time window
    /// </summary>
    public int MaxRequests { get; set; } = 100;

    /// <summary>
    /// Time window in seconds
    /// </summary>
    public int WindowSeconds { get; set; } = 60;
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
