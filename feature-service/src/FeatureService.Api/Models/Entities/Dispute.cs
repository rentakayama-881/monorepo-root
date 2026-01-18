using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Dispute for transfer conflicts - when sender or receiver disagrees
/// </summary>
public class Dispute
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("transferId")]
    public string TransferId { get; set; } = null!;

    [BsonElement("initiatorId")]
    public uint InitiatorId { get; set; }

    [BsonElement("initiatorUsername")]
    public string InitiatorUsername { get; set; } = null!;

    [BsonElement("respondentId")]
    public uint RespondentId { get; set; }

    [BsonElement("respondentUsername")]
    public string RespondentUsername { get; set; } = null!;

    // Transfer party info - always track original sender/receiver
    [BsonElement("senderId")]
    public uint SenderId { get; set; }

    [BsonElement("senderUsername")]
    public string SenderUsername { get; set; } = null!;

    [BsonElement("receiverId")]
    public uint ReceiverId { get; set; }

    [BsonElement("receiverUsername")]
    public string ReceiverUsername { get; set; } = null!;

    [BsonElement("reason")]
    public string Reason { get; set; } = null!;

    [BsonElement("category")]
    public DisputeCategory Category { get; set; }

    [BsonElement("status")]
    public DisputeStatus Status { get; set; }

    [BsonElement("amount")]
    public long Amount { get; set; }

    [BsonElement("evidence")]
    public List<DisputeEvidence> Evidence { get; set; } = new();

    [BsonElement("messages")]
    public List<DisputeMessage> Messages { get; set; } = new();

    [BsonElement("resolution")]
    public DisputeResolution? Resolution { get; set; }

    [BsonElement("resolvedById")]
    public uint? ResolvedById { get; set; }

    [BsonElement("resolvedByUsername")]
    public string? ResolvedByUsername { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("resolvedAt")]
    public DateTime? ResolvedAt { get; set; }
}

public class DisputeEvidence
{
    [BsonElement("type")]
    public string Type { get; set; } = null!; // "image", "document", "screenshot"

    [BsonElement("url")]
    public string Url { get; set; } = null!;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("uploadedAt")]
    public DateTime UploadedAt { get; set; }

    [BsonElement("uploadedById")]
    public uint UploadedById { get; set; }
}

public class DisputeMessage
{
    [BsonElement("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [BsonElement("senderId")]
    public uint SenderId { get; set; }

    [BsonElement("senderUsername")]
    public string SenderUsername { get; set; } = null!;

    [BsonElement("isAdmin")]
    public bool IsAdmin { get; set; }

    [BsonElement("content")]
    public string Content { get; set; } = null!;

    [BsonElement("sentAt")]
    public DateTime SentAt { get; set; }
}

public class DisputeResolution
{
    [BsonElement("type")]
    public ResolutionType Type { get; set; }

    [BsonElement("refundToSender")]
    public long RefundToSender { get; set; }

    [BsonElement("releaseToReceiver")]
    public long ReleaseToReceiver { get; set; }

    [BsonElement("note")]
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
