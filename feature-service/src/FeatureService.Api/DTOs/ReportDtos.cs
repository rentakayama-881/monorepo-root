namespace FeatureService.Api.DTOs;

// ================== Report DTOs ==================

/// <summary>
/// Request to create a new report
/// </summary>
public record CreateReportRequest(
    string TargetType,  // "thread" or "reply"
    string TargetId,    // Thread ID or Reply ID
    uint ThreadId,      // Parent thread ID (for context)
    string Reason,      // harassment, spam, inappropriate, hate_speech, misinformation, other
    string? Description // Optional additional details
);

/// <summary>
/// Response after creating a report
/// </summary>
public record CreateReportResponse(string ReportId, string Message);

/// <summary>
/// Report summary for listing
/// </summary>
public record ReportSummaryDto(
    string Id,
    string TargetType,
    string TargetId,
    uint ThreadId,
    uint ReportedUserId,
    string? ReportedUsername,
    uint ReporterUserId,
    string? ReporterUsername,
    string Reason,
    string? Description,
    string Status,
    string? ActionTaken,
    DateTime CreatedAt
);

/// <summary>
/// Full report details for admin
/// </summary>
public record ReportDetailDto(
    string Id,
    string TargetType,
    string TargetId,
    uint ThreadId,
    uint ReportedUserId,
    string? ReportedUsername,
    uint ReporterUserId,
    string? ReporterUsername,
    string Reason,
    string? Description,
    string Status,
    string? ActionTaken,
    string? AdminNotes,
    uint? ReviewedByAdminId,
    DateTime? ReviewedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    // Additional context
    object? ContentPreview // Thread title or reply content
);

/// <summary>
/// Request to take action on a report (admin)
/// </summary>
public record TakeReportActionRequest(
    string Action,      // none, warning, hide, delete, ban_user, ban_device
    string? AdminNotes,
    // For warning action
    string? WarningMessage,
    string? WarningSeverity, // minor, moderate, severe
    // For ban_device action
    string? DeviceFingerprint,
    string? BanReason
);

/// <summary>
/// Paginated reports response
/// </summary>
public record PaginatedReportsResponse(
    List<ReportSummaryDto> Reports,
    int TotalCount,
    int Page,
    int PageSize
);

// ================== Device Ban DTOs ==================

/// <summary>
/// Device ban summary
/// </summary>
public record DeviceBanDto(
    string Id,
    string DeviceFingerprint,
    uint UserId,
    string? Username,
    string Reason,
    bool IsActive,
    uint BannedByAdminId,
    DateTime CreatedAt,
    DateTime? UnbannedAt
);

/// <summary>
/// Request to check if device is banned
/// </summary>
public record CheckDeviceBanRequest(string DeviceFingerprint);

/// <summary>
/// Response for device ban check
/// </summary>
public record CheckDeviceBanResponse(bool IsBanned, string? Reason, DateTime? BannedAt);

/// <summary>
/// Request to unban a device
/// </summary>
public record UnbanDeviceRequest(string UnbanReason);

/// <summary>
/// Paginated device bans response
/// </summary>
public record PaginatedDeviceBansResponse(
    List<DeviceBanDto> Bans,
    int TotalCount,
    int Page,
    int PageSize
);

// ================== User Warning DTOs ==================

/// <summary>
/// User warning summary
/// </summary>
public record UserWarningDto(
    string Id,
    string Reason,
    string Message,
    string Severity,
    bool Acknowledged,
    DateTime CreatedAt,
    DateTime? AcknowledgedAt,
    uint? UserId = null,
    uint? IssuedByAdminId = null
);

/// <summary>
/// User warnings response
/// </summary>
public record UserWarningsResponse(
    List<UserWarningDto> Warnings,
    int TotalCount,
    int UnacknowledgedCount
);

/// <summary>
/// Request to acknowledge a warning
/// </summary>
public record AcknowledgeWarningRequest(string WarningId);
