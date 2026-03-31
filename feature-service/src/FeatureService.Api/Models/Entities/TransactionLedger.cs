namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Immutable transaction ledger for double-entry bookkeeping.
/// Every transaction creates TWO ledger entries (debit and credit).
/// This ensures full auditability and balance verification.
/// </summary>
public class TransactionLedger
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// UserID this ledger entry belongs to
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Type of transaction entry (debit or credit)
    /// </summary>
    public LedgerEntryType EntryType { get; set; }

    /// <summary>
    /// Amount in IDR (always positive)
    /// </summary>
    public long Amount { get; set; }

    /// <summary>
    /// Running balance after this transaction (for quick validation)
    /// </summary>
    public long BalanceAfter { get; set; }

    /// <summary>
    /// Transaction type (deposit, transfer_in, transfer_out, withdrawal, fee, etc.)
    /// </summary>
    public string TransactionType { get; set; } = string.Empty;

    /// <summary>
    /// Reference ID to link related ledger entries (e.g., both sides of a transfer)
    /// </summary>
    public string? ReferenceId { get; set; }

    /// <summary>
    /// External reference (e.g., payment gateway transaction ID)
    /// </summary>
    public string? ExternalReference { get; set; }

    /// <summary>
    /// Counterparty UserID (for transfers)
    /// </summary>
    public uint? CounterpartyUserId { get; set; }

    /// <summary>
    /// Description/notes for this transaction
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Additional metadata (JSON)
    /// </summary>
    public Dictionary<string, string>? Metadata { get; set; }

    /// <summary>
    /// Timestamp when this entry was created (immutable)
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Status for tracking settlement/confirmation
    /// </summary>
    public TransactionStatus Status { get; set; } = TransactionStatus.Completed;
}

public enum LedgerEntryType
{
    Debit,   // Money out (decrease balance)
    Credit   // Money in (increase balance)
}

public enum TransactionStatus
{
    Pending,
    Completed,
    Failed,
    Reversed
}
