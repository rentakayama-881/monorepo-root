using System.Collections.Concurrent;
using System.Text.Json;

namespace FeatureService.Api.Infrastructure.Idempotency;

public class InMemoryIdempotencyService : IIdempotencyService
{
    private readonly ConcurrentDictionary<string, LockEntry> _locks = new();
    private readonly ConcurrentDictionary<string, ResultEntry> _results = new();
    private readonly ILogger<InMemoryIdempotencyService> _logger;
    private readonly Timer _cleanupTimer;

    private record LockEntry(DateTime ExpiresAt);
    private record ResultEntry(string Json, DateTime ExpiresAt);

    public InMemoryIdempotencyService(ILogger<InMemoryIdempotencyService> logger)
    {
        _logger = logger;
        // Cleanup expired entries every 5 minutes
        _cleanupTimer = new Timer(CleanupExpired, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
    }

    public Task<IdempotencyResult> TryAcquireAsync(
        string idempotencyKey, TimeSpan lockDuration, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        // Check if already processed (result exists and not expired)
        if (_results.TryGetValue(idempotencyKey, out var existingResult) && existingResult.ExpiresAt > DateTime.UtcNow)
        {
            _logger.LogInformation("Idempotency key {Key} already processed. Returning stored result.", idempotencyKey);
            return Task.FromResult(new IdempotencyResult(Acquired: false, AlreadyProcessed: true, StoredResultJson: existingResult.Json));
        }

        // Try to acquire lock
        var lockEntry = new LockEntry(DateTime.UtcNow.Add(lockDuration));
        if (!_locks.TryAdd(idempotencyKey, lockEntry))
        {
            // Check if existing lock is expired
            if (_locks.TryGetValue(idempotencyKey, out var existing) && existing.ExpiresAt <= DateTime.UtcNow)
            {
                // Replace expired lock
                _locks[idempotencyKey] = lockEntry;
            }
            else
            {
                _logger.LogWarning("Idempotency key {Key} is currently being processed by another request.", idempotencyKey);
                return Task.FromResult(new IdempotencyResult(Acquired: false, AlreadyProcessed: false, StoredResultJson: null));
            }
        }

        _logger.LogInformation("Acquired idempotency lock for key {Key}. Duration: {Duration}", idempotencyKey, lockDuration);
        return Task.FromResult(new IdempotencyResult(Acquired: true, AlreadyProcessed: false, StoredResultJson: null));
    }

    public Task StoreResultAsync<T>(string idempotencyKey, T result, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        ArgumentNullException.ThrowIfNull(result);

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        _results[idempotencyKey] = new ResultEntry(json, DateTime.UtcNow.Add(ttl));
        _locks.TryRemove(idempotencyKey, out _);

        _logger.LogInformation("Stored idempotency result for key {Key}. TTL: {TTL}", idempotencyKey, ttl);
        return Task.CompletedTask;
    }

    public Task<T?> GetStoredResultAsync<T>(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        if (_results.TryGetValue(idempotencyKey, out var entry) && entry.ExpiresAt > DateTime.UtcNow)
        {
            return Task.FromResult(JsonSerializer.Deserialize<T>(entry.Json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
        }

        return Task.FromResult(default(T));
    }

    public Task ReleaseAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        _locks.TryRemove(idempotencyKey, out _);
        _logger.LogInformation("Released idempotency lock for key {Key}", idempotencyKey);
        return Task.CompletedTask;
    }

    public string GenerateKey(string prefix)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prefix);
        var ulid = NUlid.Ulid.NewUlid();
        return $"{prefix}_{ulid}";
    }

    private void CleanupExpired(object? state)
    {
        var now = DateTime.UtcNow;
        var expiredLocks = _locks.Where(x => x.Value.ExpiresAt <= now).Select(x => x.Key).ToList();
        foreach (var key in expiredLocks)
            _locks.TryRemove(key, out _);

        var expiredResults = _results.Where(x => x.Value.ExpiresAt <= now).Select(x => x.Key).ToList();
        foreach (var key in expiredResults)
            _results.TryRemove(key, out _);

        if (expiredLocks.Count + expiredResults.Count > 0)
            _logger.LogDebug("Cleaned up {LockCount} expired locks and {ResultCount} expired results", expiredLocks.Count, expiredResults.Count);
    }
}
