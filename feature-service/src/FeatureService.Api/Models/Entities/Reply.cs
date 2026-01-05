using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

public class Reply
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // rpl_xxx format using Ulid

    [BsonElement("threadId")]
    public uint ThreadId { get; set; }

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("username")]
    public string Username { get; set; } = string.Empty;

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("parentReplyId")]
    [BsonIgnoreIfNull]
    public string? ParentReplyId { get; set; }

    [BsonElement("depth")]
    public int Depth { get; set; } = 0; // 0 = top-level, max 3

    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; } = false;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
