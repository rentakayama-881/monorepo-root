using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.Security.Claims;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Admin moderation endpoints for managing reports, bans, warnings, and content
/// </summary>
[ApiController]
[Route("api/v1/admin/moderation")]
[Authorize(Roles = "admin")]
public class AdminModerationController : ControllerBase
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

    #region Dashboard

    /// <summary>
    /// Get admin dashboard statistics
    /// </summary>
    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(AdminDashboardStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboardStats()
    {
        var stats = await _moderationService.GetDashboardStatsAsync();
        return Ok(stats);
    }

    #endregion

    #region Reports Management

    /// <summary>
    /// Get pending reports for admin review
    /// </summary>
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

    /// <summary>
    /// Get report details
    /// </summary>
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
        return Ok(report);
    }

    /// <summary>
    /// Take action on a report (dismiss, warn, hide, ban)
    /// </summary>
    [HttpPost("reports/{id}/action")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TakeReportAction(string id, [FromBody] TakeReportActionRequest request)
    {
        var adminId = GetCurrentAdminId();
        var ipAddress = GetClientIpAddress();
        var userAgent = Request.Headers.UserAgent.ToString();

        // Validate action
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

    #endregion

    #region Device Bans

    /// <summary>
    /// Get all device bans
    /// </summary>
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

    /// <summary>
    /// Ban a device (permanent ban)
    /// </summary>
    [HttpPost("device-bans")]
    [ProducesResponseType(typeof(DeviceBanCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> BanDevice([FromBody] BanDeviceRequest request)
    {
        var adminId = GetCurrentAdminId();

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
                request.ReportId
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

    /// <summary>
    /// Get device ban details
    /// </summary>
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

    /// <summary>
    /// Unban a device
    /// </summary>
    [HttpDelete("device-bans/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnbanDevice(string id)
    {
        var adminId = GetCurrentAdminId();

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
    /// Check if a device is banned (for registration/login flow)
    /// </summary>
    [HttpPost("device-bans/check")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(DeviceBanCheckResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckDeviceBan([FromBody] CheckDeviceBanRequest request)
    {
        var (isBanned, message) = await _deviceBanService.CheckDeviceBanAsync(request.DeviceFingerprint);
        return Ok(new DeviceBanCheckResponse(isBanned, message));
    }

    #endregion

    #region User Warnings

    /// <summary>
    /// Get all warnings for a user
    /// </summary>
    [HttpGet("warnings/user/{userId}")]
    [ProducesResponseType(typeof(List<UserWarningDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUserWarnings(uint userId)
    {
        var warnings = await _warningService.GetUserWarningsAsync(userId);
        return Ok(warnings);
    }

    /// <summary>
    /// Issue a warning to a user
    /// </summary>
    [HttpPost("warnings")]
    [ProducesResponseType(typeof(WarningCreatedResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateWarning([FromBody] CreateWarningRequest request)
    {
        var adminId = GetCurrentAdminId();

        // Validate severity
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

    /// <summary>
    /// Get warning details
    /// </summary>
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

    #endregion

    #region Content Hiding

    /// <summary>
    /// Hide content (thread or reply)
    /// </summary>
    [HttpPost("content/hide")]
    [ProducesResponseType(typeof(ContentHiddenResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> HideContent([FromBody] HideContentRequest request)
    {
        var adminId = GetCurrentAdminId();

        try
        {
            var hiddenId = await _moderationService.HideContentAsync(
                request.ContentType,
                request.ContentId,
                request.ThreadId,
                request.UserId,
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

    /// <summary>
    /// Unhide content
    /// </summary>
    [HttpPost("content/unhide/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnhideContent(string id)
    {
        var adminId = GetCurrentAdminId();

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

    /// <summary>
    /// Get all hidden content
    /// </summary>
    [HttpGet("content/hidden")]
    [ProducesResponseType(typeof(PaginatedHiddenContentResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHiddenContent([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);
        var result = await _moderationService.GetHiddenContentAsync(page, pageSize);
        return Ok(result);
    }

    #endregion

    #region Thread Management

    /// <summary>
    /// Transfer thread ownership to another user
    /// </summary>
    [HttpPost("threads/transfer")]
    [ProducesResponseType(typeof(TransferThreadOwnershipResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> TransferThreadOwnership([FromBody] TransferThreadOwnershipRequest request)
    {
        var adminId = GetCurrentAdminId();

        try
        {
            var result = await _moderationService.TransferThreadOwnershipAsync(adminId, request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to transfer thread ownership for thread {ThreadId}", request.ThreadId);
            return StatusCode(500, new { error = "Failed to transfer thread ownership" });
        }
    }

    /// <summary>
    /// Delete a thread (soft or hard delete)
    /// </summary>
    [HttpDelete("threads/{threadId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteThread(uint threadId, [FromQuery] bool hardDelete = false, [FromQuery] string? reason = null)
    {
        var adminId = GetCurrentAdminId();

        try
        {
            await _moderationService.DeleteThreadAsync(adminId, new AdminDeleteThreadRequest(threadId, hardDelete, reason));
            return Ok(new { message = "Thread deleted successfully", hardDelete });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete thread {ThreadId}", threadId);
            return StatusCode(500, new { error = "Failed to delete thread" });
        }
    }

    #endregion

    #region Admin Action Logs

    /// <summary>
    /// Get admin action audit logs
    /// </summary>
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

    #endregion

    private uint GetCurrentAdminId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var id) ? id : 0;
    }

    private string? GetClientIpAddress()
    {
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}

// Request/Response DTOs
public record BanDeviceRequest(string DeviceFingerprint, uint? UserId, string Reason, string? ReportId);
public record CheckDeviceBanRequest(string DeviceFingerprint);
public record DeviceBanCheckResponse(bool IsBanned, string? Message);
public record DeviceBanCreatedResponse(string BanId, string Message);
public record CreateWarningRequest(uint UserId, string Reason, string Message, string Severity, string? ReportId);
public record WarningCreatedResponse(string WarningId, string Message);
public record HideContentRequest(string ContentType, string ContentId, uint ThreadId, uint UserId, string Reason, string? ReportId);
public record ContentHiddenResponse(string HiddenId, string Message);
public record AdminDeleteThreadRequest(uint ThreadId, bool HardDelete, string? Reason);
public record PaginatedDeviceBansResponse(List<DeviceBanDto> Bans, int TotalCount, int Page, int PageSize);
