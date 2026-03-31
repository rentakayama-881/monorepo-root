namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Crypto deposit request via OxaPay white-label payment.
/// Fully automated: user requests → OxaPay generates address → callback credits wallet.
/// </summary>
public class DepositRequest
{
    public string Id { get; set; } = null!;

    public uint UserId { get; set; }

    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Requested deposit amount in IDR (what user wants credited to wallet).
    /// </summary>
    public long Amount { get; set; }

    /// <summary>
    /// Platform fee in IDR (amount ÷ 0.95 - amount).
    /// </summary>
    public long PlatformFee { get; set; }

    /// <summary>
    /// OxaPay track_id for this payment.
    /// </summary>
    public string TrackId { get; set; } = string.Empty;

    /// <summary>
    /// Cryptocurrency the user pays with (e.g., "USDT", "TON").
    /// </summary>
    public string PayCurrency { get; set; } = string.Empty;

    /// <summary>
    /// Amount to pay in crypto (as string to preserve decimal precision).
    /// </summary>
    public string PayAmount { get; set; } = string.Empty;

    /// <summary>
    /// Blockchain network (e.g., "TRC20", "TON Network").
    /// </summary>
    public string Network { get; set; } = string.Empty;

    /// <summary>
    /// Crypto wallet address for payment.
    /// </summary>
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// URL to QR code image for the payment address.
    /// </summary>
    public string? QrCode { get; set; }

    /// <summary>
    /// Exchange rate at time of payment creation (crypto per USD/IDR).
    /// </summary>
    public string? Rate { get; set; }

    /// <summary>
    /// Unix timestamp when the payment expires.
    /// </summary>
    public long ExpiredAt { get; set; }

    public DepositStatus Status { get; set; } = DepositStatus.WaitingPayment;

    /// <summary>
    /// OxaPay payment status string from callbacks (e.g., "Waiting", "Confirming", "Paid", "Expired").
    /// </summary>
    public string? OxaPayStatus { get; set; }

    /// <summary>
    /// Wallet transaction ID after successful credit.
    /// </summary>
    public string? WalletTransactionId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// When wallet was credited (null if not yet credited).
    /// </summary>
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
