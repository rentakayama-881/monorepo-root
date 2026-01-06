using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Reply to a thread (GitHub-style comment system)
/// </summary>
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

    [BsonElement("avatarUrl")]
    [BsonIgnoreIfNull]
    public string? AvatarUrl { get; set; }

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("contentHtml")]
    [BsonIgnoreIfNull]
    public string? ContentHtml { get; set; }

    [BsonElement("parentReplyId")]
    [BsonIgnoreIfNull]
    public string? ParentReplyId { get; set; }

    // Alias for compatibility
    [BsonIgnore]
    public string? ParentId
    {
        get => ParentReplyId;
        set => ParentReplyId = value;
    }

    [BsonElement("depth")]
    public int Depth { get; set; } = 0; // 0 = top-level, max 3

    [BsonElement("isEdited")]
    public bool IsEdited { get; set; } = false;

    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; } = false;

    [BsonElement("reactionCounts")]
    public Dictionary<string, int> ReactionCounts { get; set; } = new();

    [BsonElement("replyCount")]
    public int ReplyCount { get; set; } = 0;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// Maximum nesting depth for replies
    /// </summary>
    public const int MaxNestingDepth = 3;

    /// <summary>
    /// Maximum content length
    /// </summary>
    public const int MaxContentLength = 10000;
}
