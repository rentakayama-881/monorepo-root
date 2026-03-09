using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Crypto deposit request via OxaPay white-label payment.
/// Fully automated: user requests → OxaPay generates address → callback credits wallet.
/// </summary>
[BsonIgnoreExtraElements]
public class DepositRequest
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("username")]
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Requested deposit amount in IDR (what user wants credited to wallet).
    /// </summary>
    [BsonElement("amount")]
    public long Amount { get; set; }

    /// <summary>
    /// Platform fee in IDR (amount ÷ 0.95 - amount).
    /// </summary>
    [BsonElement("platformFee")]
    public long PlatformFee { get; set; }

    /// <summary>
    /// OxaPay track_id for this payment.
    /// </summary>
    [BsonElement("trackId")]
    public string TrackId { get; set; } = string.Empty;

    /// <summary>
    /// Cryptocurrency the user pays with (e.g., "USDT", "TON").
    /// </summary>
    [BsonElement("payCurrency")]
    public string PayCurrency { get; set; } = string.Empty;

    /// <summary>
    /// Amount to pay in crypto (as string to preserve decimal precision).
    /// </summary>
    [BsonElement("payAmount")]
    public string PayAmount { get; set; } = string.Empty;

    /// <summary>
    /// Blockchain network (e.g., "TRC20", "TON Network").
    /// </summary>
    [BsonElement("network")]
    public string Network { get; set; } = string.Empty;

    /// <summary>
    /// Crypto wallet address for payment.
    /// </summary>
    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// URL to QR code image for the payment address.
    /// </summary>
    [BsonElement("qrCode")]
    public string? QrCode { get; set; }

    /// <summary>
    /// Exchange rate at time of payment creation (crypto per USD/IDR).
    /// </summary>
    [BsonElement("rate")]
    public string? Rate { get; set; }

    /// <summary>
    /// Unix timestamp when the payment expires.
    /// </summary>
    [BsonElement("expiredAt")]
    public long ExpiredAt { get; set; }

    [BsonElement("status")]
    public DepositStatus Status { get; set; } = DepositStatus.WaitingPayment;

    /// <summary>
    /// OxaPay payment status string from callbacks (e.g., "Waiting", "Confirming", "Paid", "Expired").
    /// </summary>
    [BsonElement("oxaPayStatus")]
    public string? OxaPayStatus { get; set; }

    /// <summary>
    /// Wallet transaction ID after successful credit.
    /// </summary>
    [BsonElement("walletTransactionId")]
    public string? WalletTransactionId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// When wallet was credited (null if not yet credited).
    /// </summary>
    [BsonElement("creditedAt")]
    public DateTime? CreditedAt { get; set; }
}

public enum DepositStatus
{
    WaitingPayment,
    Confirming,
    Paid,
    Approved,
    Expired,
    Failed,
    Cancelled
}
