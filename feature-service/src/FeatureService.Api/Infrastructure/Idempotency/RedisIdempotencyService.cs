using System.Text.Json;
using StackExchange.Redis;

namespace FeatureService.Api.Infrastructure.Idempotency;

/// <summary>
/// Implementasi Idempotency Service menggunakan Redis Sentinel.
/// Menyediakan distributed locking untuk mencegah duplicate transactions.
/// </summary>
public class RedisIdempotencyService : IIdempotencyService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisIdempotencyService> _logger;
    
    private const string LockPrefix = "idempotency:lock:";
    private const string ResultPrefix = "idempotency:result:";

    public RedisIdempotencyService(
        IConnectionMultiplexer redis,
        ILogger<RedisIdempotencyService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<IdempotencyResult> TryAcquireAsync(
        string idempotencyKey,
        TimeSpan lockDuration,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        
        var db = _redis.GetDatabase();
        var lockKey = $"{LockPrefix}{idempotencyKey}";
        var resultKey = $"{ResultPrefix}{idempotencyKey}";

        try
        {
            // Check if already processed (result exists)
            var existingResult = await db.StringGetAsync(resultKey);
            if (existingResult.HasValue)
            {
                _logger.LogInformation(
                    "Idempotency key {Key} already processed. Returning stored result.",
                    idempotencyKey);
                
                return new IdempotencyResult(
                    Acquired: false,
                    AlreadyProcessed: true,
                    StoredResultJson: existingResult.ToString()
                );
            }

            // Try to acquire lock using SET NX (set if not exists)
            var lockValue = $"{Environment.MachineName}:{DateTime.UtcNow:O}";
            var acquired = await db.StringSetAsync(
                lockKey,
                lockValue,
                lockDuration,
                When.NotExists
            );

            if (!acquired)
            {
                _logger.LogWarning(
                    "Idempotency key {Key} is currently being processed by another request.",
                    idempotencyKey);
                
                return new IdempotencyResult(
                    Acquired: false,
                    AlreadyProcessed: false,
                    StoredResultJson: null
                );
            }

            _logger.LogInformation(
                "Acquired idempotency lock for key {Key}. Duration: {Duration}",
                idempotencyKey, lockDuration);
            
            return new IdempotencyResult(
                Acquired: true,
                AlreadyProcessed: false,
                StoredResultJson: null
            );
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogError(ex, "Redis connection error while acquiring idempotency lock for {Key}", idempotencyKey);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task StoreResultAsync<T>(
        string idempotencyKey,
        T result,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        ArgumentNullException.ThrowIfNull(result);
        
        var db = _redis.GetDatabase();
        var resultKey = $"{ResultPrefix}{idempotencyKey}";
        var lockKey = $"{LockPrefix}{idempotencyKey}";

        try
        {
            var json = JsonSerializer.Serialize(result, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            // Use transaction to ensure atomic operation
            var transaction = db.CreateTransaction();
            _ = transaction.StringSetAsync(resultKey, json, ttl);
            _ = transaction.KeyDeleteAsync(lockKey);
            
            var committed = await transaction.ExecuteAsync();
            
            if (committed)
            {
                _logger.LogInformation(
                    "Stored idempotency result for key {Key}. TTL: {TTL}",
                    idempotencyKey, ttl);
            }
            else
            {
                _logger.LogWarning(
                    "Failed to commit idempotency result transaction for key {Key}",
                    idempotencyKey);
            }
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogError(ex, "Redis connection error while storing result for {Key}", idempotencyKey);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<T?> GetStoredResultAsync<T>(
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        
        var db = _redis.GetDatabase();
        var resultKey = $"{ResultPrefix}{idempotencyKey}";

        try
        {
            var json = await db.StringGetAsync(resultKey);
            if (!json.HasValue)
                return default;

            return JsonSerializer.Deserialize<T>(json.ToString(), new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogError(ex, "Redis connection error while getting stored result for {Key}", idempotencyKey);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task ReleaseAsync(
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        
        var db = _redis.GetDatabase();
        var lockKey = $"{LockPrefix}{idempotencyKey}";

        try
        {
            await db.KeyDeleteAsync(lockKey);
            _logger.LogInformation("Released idempotency lock for key {Key}", idempotencyKey);
        }
        catch (RedisConnectionException ex)
        {
            _logger.LogError(ex, "Redis connection error while releasing lock for {Key}", idempotencyKey);
            // Don't throw - lock will expire naturally
        }
    }

    /// <inheritdoc/>
    public string GenerateKey(string prefix)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prefix);
        var ulid = NUlid.Ulid.NewUlid();
        return $"{prefix}_{ulid}";
    }
}
