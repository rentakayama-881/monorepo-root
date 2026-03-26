using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;

namespace FeatureService.Api.Middleware;

[BsonIgnoreExtraElements]
internal class RateLimitRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("count")]
    public int Count { get; set; }

    [BsonElement("windowStart")]
    public DateTime WindowStart { get; set; }

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }
}

/// <summary>
/// MongoDB-backed rate limiter with per-route policy support.
/// Uses fixed window counters with atomic increments.
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly RateLimitOptions _options;
    private readonly IMongoCollection<RateLimitRecord> _collection;

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
        RateLimitOptions options, MongoDbContext db)
    {
        _next = next;
        _logger = logger;
        _options = options;
        _collection = db.GetCollection<RateLimitRecord>("rate_limit_counters");

        try
        {
            _collection.Indexes.CreateOne(new CreateIndexModel<RateLimitRecord>(
                Builders<RateLimitRecord>.IndexKeys.Ascending(r => r.ExpiresAt),
                new CreateIndexOptions { ExpireAfter = TimeSpan.Zero, Name = "ttl_expiresAt" }));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to create rate limit TTL index (may already exist)");
        }
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

        var filter = Builders<RateLimitRecord>.Filter.Eq(r => r.Id, bucketKey);
        var update = Builders<RateLimitRecord>.Update
            .Inc(r => r.Count, 1)
            .SetOnInsert(r => r.WindowStart, windowStart)
            .SetOnInsert(r => r.ExpiresAt, windowStart.AddSeconds(windowSeconds * 2));

        var result = await _collection.FindOneAndUpdateAsync(
            filter, update,
            new FindOneAndUpdateOptions<RateLimitRecord>
            {
                IsUpsert = true,
                ReturnDocument = ReturnDocument.After
            });

        var currentCount = result?.Count ?? 1;

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
