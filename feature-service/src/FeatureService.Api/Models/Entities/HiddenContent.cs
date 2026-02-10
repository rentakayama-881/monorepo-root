using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Tracks hidden records (Validation Cases) that are hidden by admin but not deleted.
/// </summary>
public class HiddenContent
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // hid_xxx format using Ulid

    /// <summary>
    /// Type of content: "validation_case"
    /// </summary>
    [BsonElement("contentType")]
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the hidden content
    /// </summary>
    [BsonElement("contentId")]
    public string ContentId { get; set; } = string.Empty;

    /// <summary>
    /// Validation Case ID for context.
    /// </summary>
    [BsonElement("validationCaseId")]
    public uint ValidationCaseId { get; set; }

    /// <summary>
    /// Legacy field: "threadId" from the old forum/thread domain.
    /// Kept to preserve existing MongoDB documents during migration.
    /// </summary>
    [BsonElement("threadId")]
    [BsonIgnoreIfDefault]
    public uint LegacyThreadId { get; set; }

    /// <summary>
    /// Original author user ID
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Reason for hiding
    /// </summary>
    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Report ID that led to this (if applicable)
    /// </summary>
    [BsonElement("reportId")]
    public string? ReportId { get; set; }

    /// <summary>
    /// Admin who hid the content
    /// </summary>
    [BsonElement("hiddenByAdminId")]
    public uint HiddenByAdminId { get; set; }

    /// <summary>
    /// Whether content is currently hidden (can be unhidden)
    /// </summary>
    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Admin who unhid the content (if applicable)
    /// </summary>
    [BsonElement("unhiddenByAdminId")]
    public uint? UnhiddenByAdminId { get; set; }

    /// <summary>
    /// Timestamp when unhidden
    /// </summary>
    [BsonElement("unhiddenAt")]
    public DateTime? UnhiddenAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
