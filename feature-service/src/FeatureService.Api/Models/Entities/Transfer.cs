namespace FeatureService.Api.Models.Entities;

public class Transfer
{
    public string Id { get; set; } = string.Empty; // trf_xxx format using Ulid

    public string Code { get; set; } = string.Empty; // 8-digit unique code

    public uint SenderId { get; set; }

    public string SenderUsername { get; set; } = string.Empty;

    public uint ReceiverId { get; set; }

    public string ReceiverUsername { get; set; } = string.Empty;

    public long Amount { get; set; }

    public string? Message { get; set; }

    public string? CaseLockKey { get; set; }

    public TransferStatus Status { get; set; }

    public DateTime? HoldUntil { get; set; } // Auto-release time

    public DateTime? ReleasedAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? CancelReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public enum TransferStatus
{
    Pending,    // Waiting for receiver to release
    Released,   // Completed successfully
    Cancelled,  // Cancelled by sender
    Rejected,   // Rejected by receiver (refund to sender)
    Disputed,   // Under dispute
    Expired     // Auto-released after hold period
}
