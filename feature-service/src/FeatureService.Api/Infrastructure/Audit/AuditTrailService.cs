using FeatureService.Api.Domain.Entities;
using FeatureService.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FeatureService.Api.Infrastructure.Audit;

/// <summary>
/// Implementasi Audit Trail Service dengan chain-linked hashing.
/// Menyimpan audit entries di PostgreSQL dengan integritas terjamin.
/// </summary>
public class AuditTrailService : IAuditTrailService
{
    private readonly AppDbContext _db;
    private readonly ILogger<AuditTrailService> _logger;
    private static readonly SemaphoreSlim _sequenceLock = new(1, 1);
    private const string GenesisHash = "GENESIS_BLOCK_AIVALID_2026";

    public AuditTrailService(
        AppDbContext db,
        ILogger<AuditTrailService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<ImmutableAuditTrail> RecordEventAsync(
        AuditEventRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        
        // Use lock to ensure sequence ordering
        await _sequenceLock.WaitAsync(cancellationToken);
        try
        {
            // Get previous entry hash and next sequence number
            var (previousHash, nextSequence) = await GetChainStateAsync(cancellationToken);
            
            var auditId = $"aud_{Ulid.NewUlid()}";
            var now = DateTime.UtcNow;
            
            // Pre-compute entry hash by creating a temporary entry
            var tempEntry = new ImmutableAuditTrail
            {
                Id = auditId,
                TransactionId = request.TransactionId,
                TransactionType = request.TransactionType,
                EventType = request.EventType,
                ActorUserId = request.ActorUserId,
                ActorUsername = request.ActorUsername,
                Amount = request.Amount,
                Details = request.Details ?? new Dictionary<string, string>(),
                PreviousEntryHash = previousHash,
                PqcKeyId = request.PqcKeyId,
                IpAddress = request.IpAddress,
                UserAgent = request.UserAgent,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = now,
                SequenceNumber = nextSequence,
                EntryHash = string.Empty // Will be computed
            };
            
            // Compute entry hash
            var entryHash = ImmutableAuditTrail.ComputeEntryHash(tempEntry);
            
            // Create final entry with computed hash
            var entry = new ImmutableAuditTrail
            {
                Id = auditId,
                TransactionId = request.TransactionId,
                TransactionType = request.TransactionType,
                EventType = request.EventType,
                ActorUserId = request.ActorUserId,
                ActorUsername = request.ActorUsername,
                Amount = request.Amount,
                Details = request.Details ?? new Dictionary<string, string>(),
                PreviousEntryHash = previousHash,
                PqcKeyId = request.PqcKeyId,
                IpAddress = request.IpAddress,
                UserAgent = request.UserAgent,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = now,
                SequenceNumber = nextSequence,
                EntryHash = entryHash
            };
            
            _db.AuditTrails.Add(entry);
            await _db.SaveChangesAsync(cancellationToken);
            
            _logger.LogInformation(
                "Recorded audit event. Id: {AuditId}, Type: {EventType}, Transaction: {TransactionId}, Seq: {Seq}",
                auditId, request.EventType, request.TransactionId, nextSequence);
            
            return entry;
        }
        finally
        {
            _sequenceLock.Release();
        }
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<ImmutableAuditTrail>> GetByTransactionIdAsync(
        string transactionId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(transactionId);
        
        return await _db.AuditTrails
            .Where(a => a.TransactionId == transactionId)
            .OrderBy(a => a.SequenceNumber)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<ImmutableAuditTrail>> GetByUserIdAsync(
        uint userId,
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        return await _db.AuditTrails
            .Where(a => a.ActorUserId == userId)
            .OrderByDescending(a => a.SequenceNumber)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<AuditChainVerificationResult> VerifyChainIntegrityAsync(
        string transactionId,
        CancellationToken cancellationToken = default)
    {
        var entries = await GetByTransactionIdAsync(transactionId, cancellationToken);
        var brokenLinks = new List<string>();
        var validCount = 0;

        for (int i = 0; i < entries.Count; i++)
        {
            var entry = entries[i];
            
            // Verify entry hash
            if (!entry.VerifyHash())
            {
                brokenLinks.Add($"Entry {entry.Id}: Hash mismatch (tampered data)");
                continue;
            }

            // Verify chain link (except for first entry which links to genesis or previous transaction)
            if (i > 0)
            {
                var previousEntry = entries[i - 1];
                if (entry.PreviousEntryHash != previousEntry.EntryHash)
                {
                    brokenLinks.Add($"Entry {entry.Id}: Chain link broken (expected {previousEntry.EntryHash[..16]}...)");
                    continue;
                }
            }

            validCount++;
        }

        var result = new AuditChainVerificationResult(
            IsValid: brokenLinks.Count == 0,
            TotalEntries: entries.Count,
            ValidEntries: validCount,
            BrokenLinks: brokenLinks
        );

        if (!result.IsValid)
        {
            _logger.LogWarning(
                "Audit chain verification failed for transaction {TransactionId}. BrokenLinks: {Count}",
                transactionId, brokenLinks.Count);
        }

        return result;
    }

    /// <inheritdoc/>
    public async Task<string> GetLastEntryHashAsync(CancellationToken cancellationToken = default)
    {
        var lastEntry = await _db.AuditTrails
            .OrderByDescending(a => a.SequenceNumber)
            .FirstOrDefaultAsync(cancellationToken);

        return lastEntry?.EntryHash ?? GenesisHash;
    }

    /// <summary>
    /// Get current chain state (last hash and next sequence number)
    /// </summary>
    private async Task<(string previousHash, long nextSequence)> GetChainStateAsync(
        CancellationToken cancellationToken)
    {
        var lastEntry = await _db.AuditTrails
            .OrderByDescending(a => a.SequenceNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastEntry == null)
        {
            return (GenesisHash, 1);
        }

        return (lastEntry.EntryHash, lastEntry.SequenceNumber + 1);
    }

    /// <inheritdoc/>
    public async Task<ImmutableAuditTrail> RecordChangeAsync(
        AuditEventRequest request,
        string fieldName,
        string beforeValue,
        string afterValue,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(fieldName);

        var details = new Dictionary<string, string>(request.Details ?? new Dictionary<string, string>())
        {
            ["field"] = fieldName,
            ["before"] = beforeValue ?? "",
            ["after"] = afterValue ?? ""
        };

        // Compute numeric delta if both values are numeric
        if (long.TryParse(beforeValue, out var beforeNum) && long.TryParse(afterValue, out var afterNum))
        {
            var delta = afterNum - beforeNum;
            details["change"] = delta.ToString();
        }

        var changeRequest = new AuditEventRequest
        {
            TransactionId = request.TransactionId,
            TransactionType = request.TransactionType,
            EventType = request.EventType,
            ActorUserId = request.ActorUserId,
            ActorUsername = request.ActorUsername,
            Amount = request.Amount,
            Details = details,
            PqcKeyId = request.PqcKeyId,
            IpAddress = request.IpAddress,
            UserAgent = request.UserAgent,
            IdempotencyKey = request.IdempotencyKey
        };

        return await RecordEventAsync(changeRequest, cancellationToken);
    }
}
