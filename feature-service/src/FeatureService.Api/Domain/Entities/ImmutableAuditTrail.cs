using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace FeatureService.Api.Domain.Entities;

/// <summary>
/// Immutable Audit Trail untuk pencatatan transaksi yang tidak dapat diubah.
/// Menggunakan chain-linked hashing untuk integritas data.
/// </summary>
public class ImmutableAuditTrail
{
    public string Id { get; init; } = string.Empty;

    /// <summary>
    /// ID transaksi terkait (transfer, withdrawal, dll)
    /// </summary>
    public string TransactionId { get; init; } = string.Empty;

    /// <summary>
    /// Tipe transaksi
    /// </summary>
    public string TransactionType { get; init; } = string.Empty;

    /// <summary>
    /// Tipe event dalam lifecycle transaksi
    /// </summary>
    public AuditEventType EventType { get; init; }

    /// <summary>
    /// User ID yang melakukan aksi
    /// </summary>
    public uint ActorUserId { get; init; }

    /// <summary>
    /// Username untuk reference
    /// </summary>
    public string ActorUsername { get; init; } = string.Empty;

    /// <summary>
    /// Amount terkait (dalam satuan terkecil - rupiah)
    /// </summary>
    public long? Amount { get; init; }

    /// <summary>
    /// Detail tambahan dalam format key-value
    /// </summary>
    public Dictionary<string, string> Details { get; init; } = new();

    /// <summary>
    /// Hash dari entry audit sebelumnya (blockchain-style chaining)
    /// </summary>
    public string PreviousEntryHash { get; init; } = string.Empty;

    /// <summary>
    /// Hash dari entry ini untuk chaining ke entry berikutnya
    /// </summary>
    public string EntryHash { get; init; } = string.Empty;

    /// <summary>
    /// PQC Key ID yang digunakan untuk signing (jika ada)
    /// </summary>
    public string? PqcKeyId { get; init; }

    /// <summary>
    /// IP Address dari request
    /// </summary>
    public string? IpAddress { get; init; }

    /// <summary>
    /// User Agent dari request
    /// </summary>
    public string? UserAgent { get; init; }

    /// <summary>
    /// Idempotency key terkait
    /// </summary>
    public string? IdempotencyKey { get; init; }

    /// <summary>
    /// Timestamp UTC
    /// </summary>
    public DateTime CreatedAt { get; init; }

    /// <summary>
    /// Sequence number untuk ordering
    /// </summary>
    public long SequenceNumber { get; init; }

    /// <summary>
    /// Menghitung hash dari entry ini untuk chaining
    /// </summary>
    public static string ComputeEntryHash(ImmutableAuditTrail entry)
    {
        var hashInput = new
        {
            entry.Id,
            entry.TransactionId,
            entry.TransactionType,
            entry.EventType,
            entry.ActorUserId,
            entry.Amount,
            entry.PreviousEntryHash,
            entry.CreatedAt,
            entry.SequenceNumber
        };

        var json = JsonSerializer.Serialize(hashInput);
        var hash = SHA512.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash);
    }

    /// <summary>
    /// Verifikasi apakah hash entry ini valid
    /// </summary>
    public bool VerifyHash()
    {
        var computedHash = ComputeEntryHash(this);
        return EntryHash == computedHash;
    }
}

/// <summary>
/// Tipe event dalam audit trail
/// </summary>
public enum AuditEventType
{
    // General transaction lifecycle events
    TransactionInitiated,
    TransactionCreated,
    TransactionCompleted,
    TransactionFailed,
    TransactionCancelled,
    StatusChange,
    SecurityCheck,

    // Transfer events
    TransferCreated,
    TransferAccepted,
    TransferReleased,
    TransferCancelled,
    TransferExpired,
    TransferDisputed,

    // Withdrawal events
    WithdrawalRequested,
    WithdrawalProcessing,
    WithdrawalCompleted,
    WithdrawalFailed,
    WithdrawalCancelled,

    // Wallet events
    WalletCreated,
    WalletPinSet,
    WalletPinChanged,
    WalletLocked,
    WalletUnlocked,
    BalanceUpdated,

    // Security events
    PqcKeyRegistered,
    PqcKeyRevoked,
    SignatureVerified,
    SignatureFailed,

    // Dispute events
    DisputeOpened,
    DisputeMessageAdded,
    DisputeEvidenceAdded,
    DisputeResolved,
    DisputeEscalated,

    // Deposit events
    DepositCreated,
    DepositCompleted,
    DepositFailed,
    DepositCancelled,

    // Data lifecycle events
    DataDeletionInitiated,
    AccountDeleted,
    DataExported,

    // System events
    IdempotencyKeyCreated,
    IdempotencyKeyUsed
}
