using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Controllers;

[ApiController]
[Route("api/v1/admin/moderation")]
[Authorize(Roles = "admin")]
public partial class AdminModerationController : ApiControllerBase
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
}
