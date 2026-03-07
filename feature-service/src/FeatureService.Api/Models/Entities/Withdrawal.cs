using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Crypto withdrawal request via OxaPay payout.
/// Flow: user requests → wallet deducted → OxaPay payout → callback confirms.
/// </summary>
public class Withdrawal
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("username")]
    public string Username { get; set; } = null!;

    /// <summary>
    /// Withdrawal amount in IDR (what user withdraws from wallet, before fee).
    /// </summary>
    [BsonElement("amount")]
    public long Amount { get; set; }

    /// <summary>
    /// Platform fee in IDR (2% of amount).
    /// </summary>
    [BsonElement("fee")]
    public long Fee { get; set; }

    /// <summary>
    /// Net amount in IDR after fee deduction (amount - fee). This is converted to crypto.
    /// </summary>
    [BsonElement("netAmount")]
    public long NetAmount { get; set; }

    /// <summary>
    /// Recipient's crypto wallet address.
    /// </summary>
    [BsonElement("cryptoAddress")]
    public string CryptoAddress { get; set; } = null!;

    /// <summary>
    /// Cryptocurrency symbol (e.g., "USDT", "TON").
    /// </summary>
    [BsonElement("cryptoCurrency")]
    public string CryptoCurrency { get; set; } = null!;

    /// <summary>
    /// Blockchain network (e.g., "TRC20", "TON Network").
    /// </summary>
    [BsonElement("cryptoNetwork")]
    public string? CryptoNetwork { get; set; }

    /// <summary>
    /// Amount in crypto sent via payout (as string for decimal precision).
    /// </summary>
    [BsonElement("cryptoAmount")]
    public string? CryptoAmount { get; set; }

    /// <summary>
    /// Optional memo/tag for networks that require it (e.g., TON).
    /// </summary>
    [BsonElement("memo")]
    public string? Memo { get; set; }

    /// <summary>
    /// OxaPay track_id for this payout.
    /// </summary>
    [BsonElement("trackId")]
    public string? TrackId { get; set; }

    /// <summary>
    /// OxaPay payout status from callbacks.
    /// </summary>
    [BsonElement("oxaPayStatus")]
    public string? OxaPayStatus { get; set; }

    /// <summary>
    /// Blockchain transaction hash (set on completion).
    /// </summary>
    [BsonElement("txHash")]
    public string? TxHash { get; set; }

    [BsonElement("status")]
    public WithdrawalStatus Status { get; set; }

    [BsonElement("reference")]
    public string Reference { get; set; } = null!;

    [BsonElement("failureReason")]
    public string? FailureReason { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("completedAt")]
    public DateTime? CompletedAt { get; set; }
}

public enum WithdrawalStatus
{
    Processing,  // Payout submitted to OxaPay
    Completed,   // Successfully sent to crypto address
    Failed,      // Payout failed, wallet refunded
    Cancelled    // Cancelled by user (before payout)
}
