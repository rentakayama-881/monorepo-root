using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

public class Reaction
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // rxn_xxx format using Ulid

    [BsonElement("userId")]
    public uint UserId { get; set; }

    [BsonElement("targetType")]
    public string TargetType { get; set; } = string.Empty; // "thread" or "reply"

    [BsonElement("targetId")]
    public string TargetId { get; set; } = string.Empty; // threadId or replyId

    /// <summary>
    /// Thread ID for easier querying (copied from target if target is thread, or from reply's threadId)
    /// </summary>
    [BsonElement("threadId")]
    public uint ThreadId { get; set; }

    [BsonElement("reactionType")]
    public string ReactionType { get; set; } = string.Empty; // like, love, fire, sad, laugh

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}

public class ReactionCount
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // targetType:targetId

    [BsonElement("targetType")]
    public string TargetType { get; set; } = string.Empty;

    [BsonElement("targetId")]
    public string TargetId { get; set; } = string.Empty;

    [BsonElement("counts")]
    public Dictionary<string, int> Counts { get; set; } = new();

    [BsonElement("totalCount")]
    public int TotalCount { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
