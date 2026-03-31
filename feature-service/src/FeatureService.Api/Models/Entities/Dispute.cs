namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Dispute for transfer conflicts - when sender or receiver disagrees
/// </summary>
public class Dispute
{
    public string Id { get; set; } = null!;

    public string TransferId { get; set; } = null!;

    public uint InitiatorId { get; set; }

    public string InitiatorUsername { get; set; } = null!;

    public uint RespondentId { get; set; }

    public string RespondentUsername { get; set; } = null!;

    // Transfer party info - always track original sender/receiver
    public uint SenderId { get; set; }

    public string SenderUsername { get; set; } = null!;

    public uint ReceiverId { get; set; }

    public string ReceiverUsername { get; set; } = null!;

    public string Reason { get; set; } = null!;

    public DisputeCategory Category { get; set; }

    public DisputeStatus Status { get; set; }

    public long Amount { get; set; }

    public ICollection<DisputeEvidence> Evidence { get; set; } = new List<DisputeEvidence>();

    public ICollection<DisputeMessage> Messages { get; set; } = new List<DisputeMessage>();

    public DisputeResolution? Resolution { get; set; }

    public uint? ResolvedById { get; set; }

    public string? ResolvedByUsername { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }
}

public class DisputeEvidence
{
    public string Id { get; set; } = string.Empty;

    public string DisputeId { get; set; } = string.Empty;

    public string Type { get; set; } = null!; // "image", "document", "screenshot"

    public string Url { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime UploadedAt { get; set; }

    public uint UploadedById { get; set; }
}

public class DisputeMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string DisputeId { get; set; } = string.Empty;

    public uint SenderId { get; set; }

    public string SenderUsername { get; set; } = null!;

    public bool IsAdmin { get; set; }

    public string Content { get; set; } = null!;

    public DateTime SentAt { get; set; }
}

public class DisputeResolution
{
    public ResolutionType Type { get; set; }

    public long RefundToSender { get; set; }

    public long ReleaseToReceiver { get; set; }

    public string? Note { get; set; }
}

public enum DisputeCategory
{
    ItemNotReceived,      // Buyer didn't receive item/service
    ItemNotAsDescribed,   // Item different from description
    Fraud,                // Suspected fraud
    SellerNotResponding,  // Seller not responding
    Other                 // Other reason
}

public enum DisputeStatus
{
    Open,                 // Dispute created, waiting for response
    UnderReview,          // Admin is reviewing
    WaitingForEvidence,   // Need more evidence from parties
    Resolved,             // Dispute resolved
    Cancelled             // Dispute cancelled by initiator
}

public enum ResolutionType
{
    FullRefundToSender,   // 100% back to sender
    FullReleaseToReceiver,// 100% to receiver
    Split,                // Split between parties
    NoAction              // No funds moved (e.g., cancelled dispute)
}
