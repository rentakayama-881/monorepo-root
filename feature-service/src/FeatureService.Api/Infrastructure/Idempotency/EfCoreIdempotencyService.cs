using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;

namespace FeatureService.Api.Infrastructure.Idempotency;

public class EfCoreIdempotencyService : IIdempotencyService
{
    private const string StatusLocked = "locked";
    private const string StatusCompleted = "completed";

    private readonly AppDbContext _db;
    private readonly ILogger<EfCoreIdempotencyService> _logger;

    public EfCoreIdempotencyService(AppDbContext db, ILogger<EfCoreIdempotencyService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IdempotencyResult> TryAcquireAsync(
        string idempotencyKey, TimeSpan lockDuration, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        var now = DateTime.UtcNow;

        // Check if already completed
        var existing = await _db.IdempotencyRecords
            .FirstOrDefaultAsync(r => r.Key == idempotencyKey, cancellationToken);

        if (existing != null)
        {
            if (existing.Status == StatusCompleted && existing.ExpiresAt > now)
            {
                _logger.LogInformation("Idempotency key {Key} already processed. Returning stored result.", idempotencyKey);
                return new IdempotencyResult(Acquired: false, AlreadyProcessed: true, StoredResultJson: existing.ResultJson);
            }

            if (existing.Status == StatusLocked && existing.ExpiresAt > now)
            {
                _logger.LogWarning("Idempotency key {Key} is currently being processed by another request.", idempotencyKey);
                return new IdempotencyResult(Acquired: false, AlreadyProcessed: false, StoredResultJson: null);
            }
        }

        // Attempt upsert: insert or replace expired record
        var record = new IdempotencyRecord
        {
            Key = idempotencyKey,
            Status = StatusLocked,
            ResultJson = null,
            LockedAt = now,
            ExpiresAt = now.Add(lockDuration)
        };

        try
        {
            if (existing != null)
            {
                // Replace expired record
                existing.Status = StatusLocked;
                existing.ResultJson = null;
                existing.LockedAt = now;
                existing.ExpiresAt = now.Add(lockDuration);
            }
            else
            {
                _db.IdempotencyRecords.Add(record);
            }

            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Acquired idempotency lock for key {Key}. Duration: {Duration}", idempotencyKey, lockDuration);
            return new IdempotencyResult(Acquired: true, AlreadyProcessed: false, StoredResultJson: null);
        }
        catch (DbUpdateException)
        {
            // Another request won the race (unique constraint violation)
            _db.ChangeTracker.Clear();

            var latest = await _db.IdempotencyRecords
                .FirstOrDefaultAsync(r => r.Key == idempotencyKey, cancellationToken);

            if (latest?.Status == StatusCompleted)
            {
                return new IdempotencyResult(Acquired: false, AlreadyProcessed: true, StoredResultJson: latest.ResultJson);
            }

            _logger.LogWarning("Idempotency key {Key} is currently being processed by another request.", idempotencyKey);
            return new IdempotencyResult(Acquired: false, AlreadyProcessed: false, StoredResultJson: null);
        }
    }

    public async Task StoreResultAsync<T>(string idempotencyKey, T result, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        ArgumentNullException.ThrowIfNull(result);

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var now = DateTime.UtcNow;

        await _db.IdempotencyRecords
            .Where(r => r.Key == idempotencyKey)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, StatusCompleted)
                .SetProperty(r => r.ResultJson, json)
                .SetProperty(r => r.ExpiresAt, now.Add(ttl)),
                cancellationToken);

        _logger.LogInformation("Stored idempotency result for key {Key}. TTL: {TTL}", idempotencyKey, ttl);
    }

    public async Task<T?> GetStoredResultAsync<T>(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        var record = await _db.IdempotencyRecords
            .FirstOrDefaultAsync(r => r.Key == idempotencyKey && r.Status == StatusCompleted && r.ExpiresAt > DateTime.UtcNow,
                cancellationToken);

        if (record?.ResultJson == null) return default;

        return JsonSerializer.Deserialize<T>(record.ResultJson, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
    }

    public async Task ReleaseAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        await _db.IdempotencyRecords
            .Where(r => r.Key == idempotencyKey)
            .ExecuteDeleteAsync(cancellationToken);

        _logger.LogInformation("Released idempotency lock for key {Key}", idempotencyKey);
    }

    public string GenerateKey(string prefix)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prefix);
        return $"{prefix}_{Ulid.NewUlid()}";
    }
}
