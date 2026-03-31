namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Crypto withdrawal request via OxaPay payout.
/// Flow: user requests → wallet deducted → OxaPay payout → callback confirms.
/// </summary>
public class Withdrawal
{
    public string Id { get; set; } = null!;

    public uint UserId { get; set; }

    public string Username { get; set; } = null!;

    /// <summary>
    /// Withdrawal amount in IDR (what user withdraws from wallet, before fee).
    /// </summary>
    public long Amount { get; set; }

    /// <summary>
    /// Platform fee in IDR (2% of amount).
    /// </summary>
    public long Fee { get; set; }

    /// <summary>
    /// Net amount in IDR after fee deduction (amount - fee). This is converted to crypto.
    /// </summary>
    public long NetAmount { get; set; }

    /// <summary>
    /// Recipient's crypto wallet address.
    /// </summary>
    public string CryptoAddress { get; set; } = null!;

    /// <summary>
    /// Cryptocurrency symbol (e.g., "USDT", "TON").
    /// </summary>
    public string CryptoCurrency { get; set; } = null!;

    /// <summary>
    /// Blockchain network (e.g., "TRC20", "TON Network").
    /// </summary>
    public string? CryptoNetwork { get; set; }

    /// <summary>
    /// Amount in crypto sent via payout (as string for decimal precision).
    /// </summary>
    public string? CryptoAmount { get; set; }

    /// <summary>
    /// Optional memo/tag for networks that require it (e.g., TON).
    /// </summary>
    public string? Memo { get; set; }

    /// <summary>
    /// OxaPay track_id for this payout.
    /// </summary>
    public string? TrackId { get; set; }

    /// <summary>
    /// OxaPay payout status from callbacks.
    /// </summary>
    public string? OxaPayStatus { get; set; }

    /// <summary>
    /// Blockchain transaction hash (set on completion).
    /// </summary>
    public string? TxHash { get; set; }

    public WithdrawalStatus Status { get; set; }

    public string Reference { get; set; } = null!;

    public string? FailureReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? CompletedAt { get; set; }
}

public enum WithdrawalStatus
{
    Processing,  // Payout submitted to OxaPay
    Completed,   // Successfully sent to crypto address
    Failed,      // Payout failed, wallet refunded
    Cancelled    // Cancelled by user (before payout)
}
