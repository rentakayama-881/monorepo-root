namespace FeatureService.Api.DTOs;

// ================== Admin Moderation DTOs ==================

/// <summary>
/// Admin dashboard statistics
/// </summary>
public record AdminDashboardStatsDto(
    int PendingReports,
    int TotalReportsToday,
    int ActiveDeviceBans,
    int WarningsIssuedToday,
    int HiddenContentCount
);

/// <summary>
/// Request to transfer thread ownership (admin)
/// </summary>
public record TransferThreadOwnershipRequest(
    uint ThreadId,
    uint NewOwnerUserId,
    string? Reason
);

/// <summary>
/// Response after transferring thread ownership
/// </summary>
public record TransferThreadOwnershipResponse(
    uint ThreadId,
    uint PreviousOwnerUserId,
    uint NewOwnerUserId,
    string Message
);

/// <summary>
/// Request to delete a thread (admin)
/// </summary>
public record AdminDeleteThreadRequest(
    uint ThreadId,
    string Reason,
    bool HardDelete  // true = permanent, false = soft delete
);

/// <summary>
/// Hidden content summary for admin
/// </summary>
public record HiddenContentDto(
    string Id,
    string ContentType,
    string ContentId,
    uint ThreadId,
    uint UserId,
    string? Username,
    string Reason,
    uint HiddenByAdminId,
    bool IsActive,
    DateTime CreatedAt,
    object? ContentPreview
);

/// <summary>
/// Paginated hidden content response
/// </summary>
public record PaginatedHiddenContentResponse(
    List<HiddenContentDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

/// <summary>
/// Request to unhide content
/// </summary>
public record UnhideContentRequest(string ContentId);

/// <summary>
/// Thread ownership transfer history item
/// </summary>
public record ThreadOwnershipTransferDto(
    string Id,
    uint ThreadId,
    string? ThreadTitle,
    uint PreviousOwnerUserId,
    string? PreviousOwnerUsername,
    uint NewOwnerUserId,
    string? NewOwnerUsername,
    uint TransferredByAdminId,
    string? Reason,
    DateTime TransferredAt
);

/// <summary>
/// Admin action log entry
/// </summary>
public record AdminActionLogDto(
    string Id,
    uint AdminId,
    string? AdminEmail,
    string ActionType,  // report_action, thread_transfer, thread_delete, ban_device, unban_device, hide_content, unhide_content
    string TargetType,  // report, thread, device, content
    string TargetId,
    object? ActionDetails,
    DateTime CreatedAt
);

/// <summary>
/// Paginated admin action log response
/// </summary>
public record PaginatedAdminActionLogResponse(
    List<AdminActionLogDto> Logs,
    int TotalCount,
    int Page,
    int PageSize
);
