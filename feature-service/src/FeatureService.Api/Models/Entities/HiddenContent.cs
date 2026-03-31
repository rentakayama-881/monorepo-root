namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Tracks hidden records (Validation Cases) that are hidden by admin but not deleted.
/// </summary>
public class HiddenContent
{
    public string Id { get; set; } = string.Empty; // hid_xxx format using Ulid

    /// <summary>
    /// Type of content: "validation_case"
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the hidden content
    /// </summary>
    public string ContentId { get; set; } = string.Empty;

    /// <summary>
    /// Validation Case ID for context.
    /// </summary>
    public uint ValidationCaseId { get; set; }

    /// <summary>
    /// Legacy field: "threadId" from the old forum/thread domain.
    /// Kept to preserve existing records during migration.
    /// </summary>
    public uint LegacyThreadId { get; set; }

    /// <summary>
    /// Original author user ID
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Reason for hiding
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Report ID that led to this (if applicable)
    /// </summary>
    public string? ReportId { get; set; }

    /// <summary>
    /// Admin who hid the content
    /// </summary>
    public uint HiddenByAdminId { get; set; }

    /// <summary>
    /// Whether content is currently hidden (can be unhidden)
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Admin who unhid the content (if applicable)
    /// </summary>
    public uint? UnhiddenByAdminId { get; set; }

    /// <summary>
    /// Timestamp when unhidden
    /// </summary>
    public DateTime? UnhiddenAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
