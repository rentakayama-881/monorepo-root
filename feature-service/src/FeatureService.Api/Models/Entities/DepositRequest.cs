using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Manual deposit request (QRIS/manual verification).
/// User submits a transaction reference, admin approves/rejects.
/// </summary>
public class DepositRequest
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("username")]
    public string Username { get; set; } = string.Empty;

    [BsonElement("amount")]
    public long Amount { get; set; }

    [BsonElement("method")]
    public string Method { get; set; } = "QRIS";

    [BsonElement("externalTransactionId")]
    public string ExternalTransactionId { get; set; } = string.Empty;

    [BsonElement("status")]
    public DepositStatus Status { get; set; } = DepositStatus.Pending;

    [BsonElement("walletTransactionId")]
    public string? WalletTransactionId { get; set; }

    [BsonElement("rejectionReason")]
    public string? RejectionReason { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("approvedById")]
    public uint? ApprovedById { get; set; }

    [BsonElement("approvedByUsername")]
    public string? ApprovedByUsername { get; set; }

    [BsonElement("approvedAt")]
    public DateTime? ApprovedAt { get; set; }
}

public enum DepositStatus
{
    Pending,
    Approved,
    Rejected
}
