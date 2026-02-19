using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

public class MarketPurchaseReservation
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("orderId")]
    public string OrderId { get; set; } = string.Empty;

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("amountIdr")]
    public long AmountIdr { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = ReservationStatus.Reserved;

    [BsonElement("reserveTransactionId")]
    [BsonIgnoreIfNull]
    public string? ReserveTransactionId { get; set; }

    [BsonElement("releaseTransactionId")]
    [BsonIgnoreIfNull]
    public string? ReleaseTransactionId { get; set; }

    [BsonElement("reason")]
    [BsonIgnoreIfNull]
    public string? Reason { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("capturedAt")]
    [BsonIgnoreIfNull]
    public DateTime? CapturedAt { get; set; }

    [BsonElement("releasedAt")]
    [BsonIgnoreIfNull]
    public DateTime? ReleasedAt { get; set; }
}

public static class ReservationStatus
{
    public const string Reserved = "reserved";
    public const string Captured = "captured";
    public const string Released = "released";
}
