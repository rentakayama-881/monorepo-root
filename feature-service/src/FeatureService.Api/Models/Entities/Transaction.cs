using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

public class Transaction
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // txn_xxx format using Ulid

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("type")]
    public TransactionType Type { get; set; }

    [BsonElement("amount")]
    public long Amount { get; set; } // Amount in IDR (can be negative for debit)

    [BsonElement("balanceBefore")]
    public long BalanceBefore { get; set; }

    [BsonElement("balanceAfter")]
    public long BalanceAfter { get; set; }

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("referenceId")]
    [BsonIgnoreIfNull]
    public string? ReferenceId { get; set; } // Reference to Transfer/Deposit/Withdrawal ID

    [BsonElement("referenceType")]
    [BsonIgnoreIfNull]
    public string? ReferenceType { get; set; } // "transfer", "deposit", "withdrawal"

    [BsonElement("metadata")]
    [BsonIgnoreIfNull]
    public Dictionary<string, string>? Metadata { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }
}

public enum TransactionType
{
    Deposit,        // Top-up from external payment
    Withdrawal,     // Cash out to bank
    TransferIn,     // Received from another user
    TransferOut,    // Sent to another user
    Refund,         // Refund from cancelled/disputed transfer
    Fee,            // Platform fee deduction
    Escrow,         // Money held in escrow
    EscrowRelease,  // Escrow released
    AiChat          // AI chat usage deduction
}
