using FeatureService.Api.Domain.Entities;

namespace FeatureService.Api.Infrastructure.Audit;

/// <summary>
/// Interface untuk Audit Trail Service.
/// Menyediakan pencatatan audit yang immutable dengan chain-linked hashing.
/// </summary>
public interface IAuditTrailService
{
    /// <summary>
    /// Mencatat event audit baru dengan automatic chaining.
    /// </summary>
    /// <param name="request">Data event yang akan dicatat</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Audit trail entry yang dibuat</returns>
    Task<ImmutableAuditTrail> RecordEventAsync(
        AuditEventRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Mengambil audit trail berdasarkan transaction ID.
    /// </summary>
    /// <param name="transactionId">Transaction ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of audit entries ordered by sequence</returns>
    Task<IReadOnlyList<ImmutableAuditTrail>> GetByTransactionIdAsync(
        string transactionId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Mengambil audit trail berdasarkan user ID.
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="limit">Maximum entries to return</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of audit entries ordered by sequence descending</returns>
    Task<IReadOnlyList<ImmutableAuditTrail>> GetByUserIdAsync(
        uint userId,
        int limit = 100,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Memverifikasi integritas chain audit trail untuk transaksi tertentu.
    /// </summary>
    /// <param name="transactionId">Transaction ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Verification result</returns>
    Task<AuditChainVerificationResult> VerifyChainIntegrityAsync(
        string transactionId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Mengambil hash entry terakhir untuk chaining global.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Hash of last entry or genesis hash</returns>
    Task<string> GetLastEntryHashAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Request untuk mencatat audit event
/// </summary>
public record AuditEventRequest
{
    public required string TransactionId { get; init; }
    public required string TransactionType { get; init; }
    public required AuditEventType EventType { get; init; }
    public required uint ActorUserId { get; init; }
    public required string ActorUsername { get; init; }
    public long? Amount { get; init; }
    public Dictionary<string, string>? Details { get; init; }
    public string? PqcKeyId { get; init; }
    public string? IpAddress { get; init; }
    public string? UserAgent { get; init; }
    public string? IdempotencyKey { get; init; }
}

/// <summary>
/// Result dari verifikasi chain integrity
/// </summary>
public record AuditChainVerificationResult(
    bool IsValid,
    int TotalEntries,
    int ValidEntries,
    List<string> BrokenLinks
);
