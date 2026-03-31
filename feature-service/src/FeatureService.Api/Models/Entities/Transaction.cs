namespace FeatureService.Api.Models.Entities;

public class Transaction
{
    public string Id { get; set; } = string.Empty; // txn_xxx format using Ulid

    public uint UserId { get; set; }

    public TransactionType Type { get; set; }

    public long Amount { get; set; } // Amount in IDR (can be negative for debit)

    public long BalanceBefore { get; set; }

    public long BalanceAfter { get; set; }

    public string Description { get; set; } = string.Empty;

    public string? ReferenceId { get; set; } // Reference to Transfer/Deposit/Withdrawal ID

    public string? ReferenceType { get; set; } // "transfer", "deposit", "withdrawal"

    public Dictionary<string, string>? Metadata { get; set; }

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
