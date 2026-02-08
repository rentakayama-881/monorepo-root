using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

public class GuaranteeLock
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // grt_xxx format using Ulid

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("amount")]
    public long Amount { get; set; } // Amount in IDR (same unit as wallet Balance)

    [BsonElement("status")]
    public GuaranteeStatus Status { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("releasedAt")]
    [BsonIgnoreIfNull]
    public DateTime? ReleasedAt { get; set; }
}

public enum GuaranteeStatus
{
    Active,
    Released
}

