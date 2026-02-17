using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Controllers;

[ApiController]
[Route("api/v1/admin/moderation")]
[Authorize(Roles = "admin")]
public class AdminModerationController : ApiControllerBase
{
    private readonly IReportService _reportService;
    private readonly IDeviceBanService _deviceBanService;
    private readonly IUserWarningService _warningService;
    private readonly IAdminModerationService _moderationService;
    private readonly ILogger<AdminModerationController> _logger;

    public AdminModerationController(
        IReportService reportService,
        IDeviceBanService deviceBanService,
        IUserWarningService warningService,
        IAdminModerationService moderationService,
        ILogger<AdminModerationController> logger)
    {
        _reportService = reportService;
        _deviceBanService = deviceBanService;
        _warningService = warningService;
        _moderationService = moderationService;
        _logger = logger;
    }

    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(AdminDashboardStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboardStats()
    {
        var stats = await _moderationService.GetDashboardStatsAsync();
        return Ok(stats);
    }

    [HttpGet("reports")]
    [ProducesResponseType(typeof(PaginatedReportsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingReports(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null)
    {
        pageSize = Math.Min(pageSize, 100);
        var reports = await _reportService.GetPendingReportsAsync(page, pageSize, status);
        return Ok(reports);
    }

    [HttpGet("reports/{id}")]
    [ProducesResponseType(typeof(ReportDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReportDetail(string id)
    {
        var report = await _reportService.GetReportByIdAsync(id);
        if (report == null)
        {
            return NotFound(new { error = "Report not found" });
        }

        var targetType = (report.TargetType ?? string.Empty).Trim().ToLowerInvariant();
        if (targetType == ReportTargetType.Thread)
        {
            targetType = ReportTargetType.ValidationCase;
        }

        var dto = new ReportDetailDto(
            report.Id,
            targetType,
            report.TargetId,
            report.ValidationCaseId != 0 ? report.ValidationCaseId : report.LegacyThreadId,
            report.ReportedUserId,
            null,
            report.ReporterUserId,
            null,
            report.Reason,
            report.Description,
            report.Status,
            report.ActionTaken,
            report.AdminNotes,
            report.ReviewedByAdminId,
            report.ReviewedAt,
            report.CreatedAt,
            report.UpdatedAt,
            null
        );

        return Ok(dto);
    }

    [HttpPost("reports/{id}/action")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TakeReportAction(string id, [FromBody] TakeReportActionRequest request)
    {
        var adminId = GetUserId();
        var ipAddress = GetClientIpAddress();
        var userAgent = Request.Headers.UserAgent.ToString();

        if (!ReportAction.All.Contains(request.Action))
        {
            return BadRequest(new { error = "Invalid action. Must be one of: " + string.Join(", ", ReportAction.All) });
        }

        try
        {
            await _reportService.TakeActionAsync(id, adminId, request.Action, request.AdminNotes, ipAddress, userAgent);

            _logger.LogInformation("Admin {AdminId} took action {Action} on report {ReportId}",
                adminId, request.Action, id);

            return Ok(new { message = "Action taken successfully", action = request.Action });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Report not found" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("device-bans")]
    [ProducesResponseType(typeof(PaginatedDeviceBansResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDeviceBans(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? activeOnly = null)
    {
        pageSize = Math.Min(pageSize, 100);
        var bans = await _deviceBanService.GetDeviceBansAsync(page, pageSize, activeOnly ?? true);
        return Ok(bans);
    }

    [HttpPost("device-bans")]
    [ProducesResponseType(typeof(DeviceBanCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> BanDevice([FromBody] BanDeviceRequest request)
    {
        var adminId = GetUserId();

        if (string.IsNullOrWhiteSpace(request.DeviceFingerprint))
        {
            return BadRequest(new { error = "Device fingerprint is required" });
        }

        try
        {
            var banId = await _deviceBanService.BanDeviceAsync(
                request.DeviceFingerprint,
                request.UserId,
                request.Reason,
                adminId,
                request.ReportId,
                request.IsPermanent,
                request.ExpiresAt
            );

            _logger.LogWarning("Device banned: {Fingerprint} for user {UserId} by admin {AdminId}",
                request.DeviceFingerprint, request.UserId, adminId);

            return CreatedAtAction(nameof(GetDeviceBanDetail), new { id = banId },
                new DeviceBanCreatedResponse(banId, "Device banned successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpGet("device-bans/{id}")]
    [ProducesResponseType(typeof(DeviceBanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDeviceBanDetail(string id)
    {
        var ban = await _deviceBanService.GetBanByIdAsync(id);
        if (ban == null)
        {
            return NotFound(new { error = "Device ban not found" });
        }
        return Ok(ban);
    }

    [HttpDelete("device-bans/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnbanDevice(string id)
    {
        var adminId = GetUserId();

        try
        {
            await _deviceBanService.UnbanDeviceAsync(id, adminId);
            _logger.LogInformation("Device unbanned: {BanId} by admin {AdminId}", id, adminId);
            return Ok(new { message = "Device unbanned successfully" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Device ban not found" });
        }
    }

    /// <summary>
    /// Accepts service token OR admin JWT for cross-service ban checks.
    /// </summary>
    [HttpPost("device-bans/check")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CheckDeviceBanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CheckDeviceBan([FromBody] CheckDeviceBanRequest request,
        [FromHeader(Name = "X-Service-Token")] string? serviceToken)
    {
        var configServiceToken = Environment.GetEnvironmentVariable("SERVICE_TOKEN") ?? "";
        if (string.IsNullOrEmpty(configServiceToken))
        {
            _logger.LogWarning("SERVICE_TOKEN not configured");
            return Unauthorized(new { error = "Service token not configured" });
        }

        var hasValidServiceToken = !string.IsNullOrEmpty(serviceToken) && serviceToken == configServiceToken;
        var isAuthenticatedAdmin = User.Identity?.IsAuthenticated == true && User.IsInRole("admin");

        if (!hasValidServiceToken && !isAuthenticatedAdmin)
        {
            _logger.LogWarning("Unauthorized device ban check: no valid service token and no admin JWT");
            return Unauthorized(new { error = "Valid service token or admin authentication required" });
        }

        var (isBanned, message) = await _deviceBanService.CheckDeviceBanAsync(request.DeviceFingerprint);
        return Ok(new CheckDeviceBanResponse(isBanned, message, null));
    }

    [HttpGet("warnings")]
    [ProducesResponseType(typeof(PaginatedWarningsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllWarnings(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] uint? userId = null)
    {
        pageSize = Math.Min(pageSize, 100);
        var result = await _warningService.GetAllWarningsAsync(page, pageSize, userId);
        return Ok(result);
    }

    [HttpGet("warnings/user/{userId}")]
    [ProducesResponseType(typeof(List<UserWarningDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUserWarnings(uint userId)
    {
        var warnings = await _warningService.GetUserWarningsAsync(userId);
        return Ok(warnings);
    }

    [HttpPost("warnings")]
    [ProducesResponseType(typeof(WarningCreatedResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateWarning([FromBody] CreateWarningRequest request)
    {
        var adminId = GetUserId();

        if (!WarningSeverity.All.Contains(request.Severity))
        {
            return BadRequest(new { error = "Invalid severity. Must be one of: " + string.Join(", ", WarningSeverity.All) });
        }

        var warningId = await _warningService.CreateWarningAsync(
            request.UserId,
            request.Reason,
            request.Message,
            request.Severity,
            adminId,
            request.ReportId
        );

        _logger.LogInformation("Warning issued to user {UserId} by admin {AdminId}: {Severity}",
            request.UserId, adminId, request.Severity);

        return CreatedAtAction(nameof(GetWarningDetail), new { id = warningId },
            new WarningCreatedResponse(warningId, "Warning issued successfully"));
    }

    [HttpGet("warnings/{id}")]
    [ProducesResponseType(typeof(UserWarningDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWarningDetail(string id)
    {
        var warning = await _warningService.GetWarningByIdAsync(id);
        if (warning == null)
        {
            return NotFound(new { error = "Warning not found" });
        }
        return Ok(warning);
    }

    [HttpPost("content/hide")]
    [ProducesResponseType(typeof(ContentHiddenResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> HideContent([FromBody] HideContentRequest request)
    {
        var adminId = GetUserId();

        try
        {
            var hiddenId = await _moderationService.HideContentAsync(
                request.ContentType,
                request.ContentId,
                request.Reason,
                request.ReportId,
                adminId
            );

            return Ok(new ContentHiddenResponse(hiddenId, "Content hidden successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("content/unhide/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnhideContent(string id)
    {
        var adminId = GetUserId();

        try
        {
            await _moderationService.UnhideContentAsync(id, adminId);
            return Ok(new { message = "Content unhidden successfully" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Hidden content record not found" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("content/hidden")]
    [ProducesResponseType(typeof(PaginatedHiddenContentResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHiddenContent([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);
        var result = await _moderationService.GetHiddenContentAsync(page, pageSize);
        return Ok(result);
    }

    [HttpPost("validation-cases/move")]
    [ProducesResponseType(typeof(MoveValidationCaseResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> MoveValidationCase([FromBody] MoveValidationCaseRequest request)
    {
        var adminId = GetUserId();

        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            var requestId = Request.Headers["X-Request-Id"].ToString();

            var result = await _moderationService.MoveValidationCaseAsync(adminId, request, authHeader, requestId);
            return Ok(result);
        }
        catch (UpstreamApiException ex)
        {
            _logger.LogWarning(ex, "Upstream error moving validation case {ValidationCaseId}", request.ValidationCaseId);

            var contentType = ex.ContentType;
            if (string.IsNullOrWhiteSpace(contentType))
            {
                contentType = ex.Body.TrimStart().StartsWith("{", StringComparison.Ordinal) ? "application/json" : "text/plain";
            }

            return new ContentResult
            {
                StatusCode = ex.StatusCode,
                Content = ex.Body,
                ContentType = contentType
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to move validation case {ValidationCaseId}", request.ValidationCaseId);
            return StatusCode(500, new { error = "Failed to move validation case" });
        }
    }

    [HttpGet("logs")]
    [ProducesResponseType(typeof(PaginatedAdminActionLogResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdminActionLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? actionType = null)
    {
        pageSize = Math.Min(pageSize, 200);
        var logs = await _moderationService.GetAdminActionLogsAsync(page, pageSize, actionType);
        return Ok(logs);
    }

    private string? GetClientIpAddress()
    {
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
