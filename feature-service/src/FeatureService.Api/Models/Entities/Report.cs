using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a user report for threads or replies.
/// Reports are reviewed by admins who can take moderation actions.
/// </summary>
public class Report
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // rpt_xxx format using Ulid

    /// <summary>
    /// Type of content being reported: "thread" or "reply"
    /// </summary>
    [BsonElement("targetType")]
    public string TargetType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the reported content (ThreadId as uint or ReplyId as string)
    /// </summary>
    [BsonElement("targetId")]
    public string TargetId { get; set; } = string.Empty;

    /// <summary>
    /// Thread ID for context (for replies, this is the parent thread)
    /// </summary>
    [BsonElement("threadId")]
    public uint ThreadId { get; set; }

    /// <summary>
    /// User ID of the person being reported (content owner)
    /// </summary>
    [BsonElement("reportedUserId")]
    public uint ReportedUserId { get; set; }

    /// <summary>
    /// User ID of the reporter
    /// </summary>
    [BsonElement("reporterUserId")]
    public uint ReporterUserId { get; set; }

    /// <summary>
    /// Report reason: harassment, spam, inappropriate, hate_speech, misinformation, other
    /// </summary>
    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Additional description provided by the reporter
    /// </summary>
    [BsonElement("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Report status: pending, reviewing, resolved, dismissed
    /// </summary>
    [BsonElement("status")]
    public string Status { get; set; } = ReportStatus.Pending;

    /// <summary>
    /// Action taken by admin: none, warning, hide, delete, ban_user, ban_device
    /// </summary>
    [BsonElement("actionTaken")]
    public string? ActionTaken { get; set; }

    /// <summary>
    /// Admin notes for internal reference
    /// </summary>
    [BsonElement("adminNotes")]
    public string? AdminNotes { get; set; }

    /// <summary>
    /// Admin user ID who reviewed this report
    /// </summary>
    [BsonElement("reviewedByAdminId")]
    public uint? ReviewedByAdminId { get; set; }

    /// <summary>
    /// Timestamp when the report was reviewed
    /// </summary>
    [BsonElement("reviewedAt")]
    public DateTime? ReviewedAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Report target types
/// </summary>
public static class ReportTargetType
{
    public const string Thread = "thread";
    public const string Reply = "reply";
}

/// <summary>
/// Report reasons
/// </summary>
public static class ReportReason
{
    public const string Harassment = "harassment";
    public const string Spam = "spam";
    public const string Inappropriate = "inappropriate";
    public const string HateSpeech = "hate_speech";
    public const string Misinformation = "misinformation";
    public const string Other = "other";

    public static readonly string[] All = { Harassment, Spam, Inappropriate, HateSpeech, Misinformation, Other };
}

/// <summary>
/// Report statuses
/// </summary>
public static class ReportStatus
{
    public const string Pending = "pending";
    public const string Reviewing = "reviewing";
    public const string Resolved = "resolved";
    public const string Dismissed = "dismissed";
}

/// <summary>
/// Admin actions on reports
/// </summary>
public static class ReportAction
{
    public const string None = "none";
    public const string Warning = "warning";
    public const string Hide = "hide";
    public const string Delete = "delete";
    public const string BanUser = "ban_user";
    public const string BanDevice = "ban_device";
}
