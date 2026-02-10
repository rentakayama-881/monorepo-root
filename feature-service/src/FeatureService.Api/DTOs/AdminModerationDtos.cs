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
/// Request to move a Validation Case (admin)
/// </summary>
public record MoveValidationCaseRequest(
    uint ValidationCaseId,
    uint NewOwnerUserId,
    uint? NewCategoryId,
    string? Reason,
    bool DryRun = false
);

/// <summary>
/// Response after moving a Validation Case
/// </summary>
public record MoveValidationCaseResponse(
    uint ValidationCaseId,
    uint PreviousOwnerUserId,
    uint NewOwnerUserId,
    string Message
);

/// <summary>
/// Hidden content summary for admin
/// </summary>
public record HiddenContentDto(
    string Id,
    string ContentType,
    string ContentId,
    uint ValidationCaseId,
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
/// Validation Case ownership move history item
/// </summary>
public record ValidationCaseOwnershipTransferDto(
    string Id,
    uint ValidationCaseId,
    string? ValidationCaseTitle,
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
    string ActionType,  // report_action, validation_case_move, ban_device, unban_device, hide_content, unhide_content
    string TargetType,  // report, validation_case, device, content, user
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

/// <summary>
/// Paginated warnings response for admin list all
/// </summary>
public record PaginatedWarningsResponse(
    List<UserWarningDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);
