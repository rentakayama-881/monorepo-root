using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;

namespace FeatureService.Api.Infrastructure.Idempotency;

[BsonIgnoreExtraElements]
public class IdempotencyRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Key { get; set; } = string.Empty;

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public string Status { get; set; } = "locked";

    [BsonElement("resultJson")]
    [BsonIgnoreIfNull]
    public string? ResultJson { get; set; }

    [BsonElement("lockedAt")]
    public DateTime LockedAt { get; set; }

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }
}

public class MongoIdempotencyService : IIdempotencyService
{
    private const string StatusLocked = "locked";
    private const string StatusCompleted = "completed";

    private readonly IMongoCollection<IdempotencyRecord> _collection;
    private readonly ILogger<MongoIdempotencyService> _logger;

    public MongoIdempotencyService(MongoDbContext db, ILogger<MongoIdempotencyService> logger)
    {
        _collection = db.GetCollection<IdempotencyRecord>("idempotency_records");
        _logger = logger;

        _collection.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<IdempotencyRecord>(
                Builders<IdempotencyRecord>.IndexKeys.Ascending(r => r.ExpiresAt),
                new CreateIndexOptions { ExpireAfter = TimeSpan.Zero, Name = "ttl_expiresAt" }),
            new CreateIndexModel<IdempotencyRecord>(
                Builders<IdempotencyRecord>.IndexKeys.Ascending(r => r.Status),
                new CreateIndexOptions { Name = "idx_status" })
        });
    }

    public async Task<IdempotencyResult> TryAcquireAsync(
        string idempotencyKey, TimeSpan lockDuration, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        var now = DateTime.UtcNow;

        // Check if already completed
        var existing = await _collection.Find(r => r.Key == idempotencyKey).FirstOrDefaultAsync(cancellationToken);
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

        // Atomic upsert: only succeed if no active lock/result exists
        var filter = Builders<IdempotencyRecord>.Filter.And(
            Builders<IdempotencyRecord>.Filter.Eq(r => r.Key, idempotencyKey),
            Builders<IdempotencyRecord>.Filter.Or(
                Builders<IdempotencyRecord>.Filter.Lt(r => r.ExpiresAt, now),
                Builders<IdempotencyRecord>.Filter.Exists(r => r.Key, false)
            )
        );

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
            var result = await _collection.ReplaceOneAsync(
                filter, record,
                new ReplaceOptions { IsUpsert = true },
                cancellationToken);

            _logger.LogInformation("Acquired idempotency lock for key {Key}. Duration: {Duration}", idempotencyKey, lockDuration);
            return new IdempotencyResult(Acquired: true, AlreadyProcessed: false, StoredResultJson: null);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            // Another request won the race
            var latest = await _collection.Find(r => r.Key == idempotencyKey).FirstOrDefaultAsync(cancellationToken);
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

        var filter = Builders<IdempotencyRecord>.Filter.Eq(r => r.Key, idempotencyKey);
        var update = Builders<IdempotencyRecord>.Update
            .Set(r => r.Status, StatusCompleted)
            .Set(r => r.ResultJson, json)
            .Set(r => r.ExpiresAt, now.Add(ttl));

        await _collection.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        _logger.LogInformation("Stored idempotency result for key {Key}. TTL: {TTL}", idempotencyKey, ttl);
    }

    public async Task<T?> GetStoredResultAsync<T>(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        var record = await _collection.Find(r => r.Key == idempotencyKey && r.Status == StatusCompleted && r.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(cancellationToken);

        if (record?.ResultJson == null) return default;

        return JsonSerializer.Deserialize<T>(record.ResultJson, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
    }

    public async Task ReleaseAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        await _collection.DeleteOneAsync(r => r.Key == idempotencyKey, cancellationToken);
        _logger.LogInformation("Released idempotency lock for key {Key}", idempotencyKey);
    }

    public string GenerateKey(string prefix)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prefix);
        return $"{prefix}_{Ulid.NewUlid()}";
    }
}
