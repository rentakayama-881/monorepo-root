using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Immutable transaction ledger for double-entry bookkeeping.
/// Every transaction creates TWO ledger entries (debit and credit).
/// This ensures full auditability and balance verification.
/// </summary>
public class TransactionLedger
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// UserID this ledger entry belongs to
    /// </summary>
    [BsonElement("user_id")]
    public uint UserId { get; set; }

    /// <summary>
    /// Type of transaction entry (debit or credit)
    /// </summary>
    [BsonElement("entry_type")]
    public LedgerEntryType EntryType { get; set; }

    /// <summary>
    /// Amount in IDR (always positive)
    /// </summary>
    [BsonElement("amount")]
    public long Amount { get; set; }

    /// <summary>
    /// Running balance after this transaction (for quick validation)
    /// </summary>
    [BsonElement("balance_after")]
    public long BalanceAfter { get; set; }

    /// <summary>
    /// Transaction type (deposit, transfer_in, transfer_out, withdrawal, fee, etc.)
    /// </summary>
    [BsonElement("transaction_type")]
    public string TransactionType { get; set; } = string.Empty;

    /// <summary>
    /// Reference ID to link related ledger entries (e.g., both sides of a transfer)
    /// </summary>
    [BsonElement("reference_id")]
    public string? ReferenceId { get; set; }

    /// <summary>
    /// External reference (e.g., payment gateway transaction ID)
    /// </summary>
    [BsonElement("external_reference")]
    public string? ExternalReference { get; set; }

    /// <summary>
    /// Counterparty UserID (for transfers)
    /// </summary>
    [BsonElement("counterparty_user_id")]
    public uint? CounterpartyUserId { get; set; }

    /// <summary>
    /// Description/notes for this transaction
    /// </summary>
    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Additional metadata (JSON)
    /// </summary>
    [BsonElement("metadata")]
    public Dictionary<string, string>? Metadata { get; set; }

    /// <summary>
    /// Timestamp when this entry was created (immutable)
    /// </summary>
    [BsonElement("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Status for tracking settlement/confirmation
    /// </summary>
    [BsonElement("status")]
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
