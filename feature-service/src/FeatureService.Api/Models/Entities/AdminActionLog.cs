namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Tracks Validation Case ownership moves performed by admin.
/// The actual Validation Case data remains in PostgreSQL (Go backend).
/// This stores the move history for audit purposes.
/// </summary>
public class ValidationCaseOwnershipTransfer
{
    public string Id { get; set; } = string.Empty; // trf_xxx format using Ulid

    /// <summary>
    /// Validation Case ID from PostgreSQL
    /// </summary>
    public uint ValidationCaseId { get; set; }

    /// <summary>
    /// Legacy field: "threadId" from the old forum/thread domain.
    /// Kept to preserve existing records during migration.
    /// </summary>
    public uint LegacyThreadId { get; set; }

    /// <summary>
    /// Validation Case title at time of move (snapshot)
    /// </summary>
    public string? ValidationCaseTitle { get; set; }

    /// <summary>
    /// Legacy field: "threadTitle" from the old forum/thread domain.
    /// Kept to preserve existing records during migration.
    /// </summary>
    public string? LegacyThreadTitle { get; set; }

    /// <summary>
    /// Previous owner user ID
    /// </summary>
    public uint PreviousOwnerUserId { get; set; }

    /// <summary>
    /// Previous owner username (snapshot)
    /// </summary>
    public string? PreviousOwnerUsername { get; set; }

    /// <summary>
    /// New owner user ID
    /// </summary>
    public uint NewOwnerUserId { get; set; }

    /// <summary>
    /// New owner username (snapshot)
    /// </summary>
    public string? NewOwnerUsername { get; set; }

    /// <summary>
    /// Admin who performed the transfer
    /// </summary>
    public uint TransferredByAdminId { get; set; }

    /// <summary>
    /// Reason for the transfer
    /// </summary>
    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Admin action log for audit trail.
/// Tracks all moderation actions taken by admins.
/// </summary>
public class AdminActionLog
{
    public string Id { get; set; } = string.Empty; // aal_xxx format using Ulid

    /// <summary>
    /// Admin user ID who performed the action
    /// </summary>
    public uint AdminId { get; set; }

    /// <summary>
    /// Admin email (snapshot)
    /// </summary>
    public string? AdminEmail { get; set; }

    /// <summary>
    /// Type of action: report_action, thread_transfer, thread_delete, ban_device, unban_device, hide_content, unhide_content, warning
    /// </summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>
    /// Type of target: report, validation_case, device, content, user
    /// </summary>
    public string TargetType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the target
    /// </summary>
    public string TargetId { get; set; } = string.Empty;

    /// <summary>
    /// Additional action details (JSON object)
    /// </summary>
    public string? ActionDetails { get; set; }

    /// <summary>
    /// IP address of the admin
    /// </summary>
    public string? IpAddress { get; set; }

    /// <summary>
    /// User agent of the admin
    /// </summary>
    public string? UserAgent { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Admin action types
/// </summary>
public static class AdminActionType
{
    public const string ReportAction = "report_action";
    public const string ValidationCaseMove = "validation_case_move";
    public const string BanDevice = "ban_device";
    public const string UnbanDevice = "unban_device";
    public const string HideContent = "hide_content";
    public const string UnhideContent = "unhide_content";
    public const string Warning = "warning";

    // Legacy (deprecated): old thread-based domain.
    public const string ThreadTransfer = "thread_transfer";
    public const string ThreadDelete = "thread_delete";
}

/// <summary>
/// Admin action target types
/// </summary>
public static class AdminActionTargetType
{
    public const string Report = "report";
    public const string ValidationCase = "validation_case";
    public const string Device = "device";
    public const string Content = "content";
    public const string User = "user";

    // Legacy (deprecated): old thread-based domain.
    public const string Thread = "thread";
}
