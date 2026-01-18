using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

public class Transfer
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // trf_xxx format using Ulid

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty; // 8-digit unique code

    [BsonElement("senderId")]
    public uint SenderId { get; set; }

    [BsonElement("senderUsername")]
    public string SenderUsername { get; set; } = string.Empty;

    [BsonElement("receiverId")]
    public uint ReceiverId { get; set; }

    [BsonElement("receiverUsername")]
    public string ReceiverUsername { get; set; } = string.Empty;

    [BsonElement("amount")]
    public long Amount { get; set; }

    [BsonElement("message")]
    [BsonIgnoreIfNull]
    public string? Message { get; set; }

    [BsonElement("status")]
    public TransferStatus Status { get; set; }

    [BsonElement("holdUntil")]
    [BsonIgnoreIfNull]
    public DateTime? HoldUntil { get; set; } // Auto-release time

    [BsonElement("releasedAt")]
    [BsonIgnoreIfNull]
    public DateTime? ReleasedAt { get; set; }

    [BsonElement("cancelledAt")]
    [BsonIgnoreIfNull]
    public DateTime? CancelledAt { get; set; }

    [BsonElement("cancelReason")]
    [BsonIgnoreIfNull]
    public string? CancelReason { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
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
