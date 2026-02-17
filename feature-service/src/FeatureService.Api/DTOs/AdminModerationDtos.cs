namespace FeatureService.Api.DTOs;

public record AdminDashboardStatsDto(
    int PendingReports,
    int TotalReportsToday,
    int ActiveDeviceBans,
    int WarningsIssuedToday,
    int HiddenContentCount
);

public record MoveValidationCaseRequest(
    uint ValidationCaseId,
    uint NewOwnerUserId,
    uint? NewCategoryId,
    string? Reason,
    bool DryRun = false
);

public record MoveValidationCaseResponse(
    uint ValidationCaseId,
    uint PreviousOwnerUserId,
    uint NewOwnerUserId,
    string Message
);

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

public record PaginatedHiddenContentResponse(
    List<HiddenContentDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record UnhideContentRequest(string ContentId);

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

public record AdminActionLogDto(
    string Id,
    uint AdminId,
    string? AdminEmail,
    string ActionType,
    string TargetType,
    string TargetId,
    object? ActionDetails,
    DateTime CreatedAt
);

public record PaginatedAdminActionLogResponse(
    List<AdminActionLogDto> Logs,
    int TotalCount,
    int Page,
    int PageSize
);

public record PaginatedWarningsResponse(
    List<UserWarningDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

// Moved from AdminModerationController.cs
public record BanDeviceRequest(
    string DeviceFingerprint,
    uint? UserId,
    string Reason,
    string? ReportId,
    bool IsPermanent = true,
    DateTime? ExpiresAt = null);
public record DeviceBanCreatedResponse(string BanId, string Message);
public record CreateWarningRequest(uint UserId, string Reason, string Message, string Severity, string? ReportId);
public record WarningCreatedResponse(string WarningId, string Message);
public record HideContentRequest(string ContentType, string ContentId, string Reason, string? ReportId);
public record ContentHiddenResponse(string HiddenId, string Message);
