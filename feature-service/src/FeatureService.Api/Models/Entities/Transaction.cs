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
    Deposit = 0,       // Top-up from external payment
    Withdrawal = 1,    // Cash out to bank
    TransferIn = 2,    // Received from another user
    TransferOut = 3,   // Sent to another user
    Refund = 4,        // Refund from cancelled/disputed transfer
    Fee = 5,           // Platform fee deduction
    Escrow = 6,        // Money held in escrow
    EscrowRelease = 7, // Escrow released
    Reserved8 = 8,     // Reserved (legacy data)
    Reserved9 = 9,     // Reserved (legacy data)
    GuaranteeLock = 10,    // Money frozen for profile guarantee
    GuaranteeRelease = 11, // Guarantee released back to wallet
    MarketPurchaseReserve = 12, // Reserve wallet balance for market purchase
    MarketPurchaseRelease = 13  // Release reserved balance back to wallet
}
