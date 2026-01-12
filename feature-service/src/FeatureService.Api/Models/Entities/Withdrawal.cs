using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Withdrawal request for cashing out wallet balance to bank account
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

    [BsonElement("amount")]
    public long Amount { get; set; }

    [BsonElement("fee")]
    public long Fee { get; set; }

    [BsonElement("netAmount")]
    public long NetAmount { get; set; }

    [BsonElement("bankCode")]
    public string BankCode { get; set; } = null!;

    [BsonElement("bankName")]
    public string BankName { get; set; } = null!;

    [BsonElement("accountNumber")]
    public string AccountNumber { get; set; } = null!;

    [BsonElement("accountName")]
    public string AccountName { get; set; } = null!;

    [BsonElement("status")]
    public WithdrawalStatus Status { get; set; }

    [BsonElement("reference")]
    public string Reference { get; set; } = null!;

    [BsonElement("rejectionReason")]
    public string? RejectionReason { get; set; }

    [BsonElement("processedById")]
    public uint? ProcessedById { get; set; }

    [BsonElement("processedByUsername")]
    public string? ProcessedByUsername { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("processedAt")]
    public DateTime? ProcessedAt { get; set; }
}

public enum WithdrawalStatus
{
    Pending,    // Waiting for admin review
    Processing, // Admin is processing
    Completed,  // Successfully transferred to bank
    Rejected,   // Rejected by admin
    Cancelled   // Cancelled by user
}
