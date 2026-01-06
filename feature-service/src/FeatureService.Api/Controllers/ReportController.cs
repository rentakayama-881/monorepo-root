using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.Security.Claims;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Handles user report submission for threads and replies
/// </summary>
[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<ReportController> _logger;

    public ReportController(IReportService reportService, ILogger<ReportController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    /// <summary>
    /// Submit a report for a thread or reply
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ReportCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        // Validate target type
        if (request.TargetType != ReportTargetType.Thread && request.TargetType != ReportTargetType.Reply)
        {
            return BadRequest(new { error = "Invalid target type. Must be 'thread' or 'reply'" });
        }

        // Validate reason
        if (!ReportReason.All.Contains(request.Reason))
        {
            return BadRequest(new { error = "Invalid reason. Must be one of: " + string.Join(", ", ReportReason.All) });
        }

        // Check if user already reported this content
        var alreadyReported = await _reportService.HasUserReportedContentAsync(userId, request.TargetType, request.TargetId);
        if (alreadyReported)
        {
            return Conflict(new { error = "You have already reported this content" });
        }

        try
        {
            var reportId = await _reportService.CreateReportAsync(
                reporterUserId: userId,
                targetType: request.TargetType,
                targetId: request.TargetId,
                threadId: request.ThreadId,
                reason: request.Reason,
                description: request.Description
            );

            _logger.LogInformation("Report created: {ReportId} by user {UserId} for {TargetType} {TargetId}",
                reportId, userId, request.TargetType, request.TargetId);

            return CreatedAtAction(nameof(GetReportStatus), new { id = reportId },
                new ReportCreatedResponse(reportId, "Report submitted successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create report for {TargetType} {TargetId}", request.TargetType, request.TargetId);
            return StatusCode(500, new { error = "Failed to submit report" });
        }
    }

    /// <summary>
    /// Get status of a user's report
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ReportStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReportStatus(string id)
    {
        var userId = GetCurrentUserId();
        var report = await _reportService.GetReportByIdAsync(id);

        if (report == null)
        {
            return NotFound(new { error = "Report not found" });
        }

        // Only the reporter or admin can view the report
        if (report.ReporterUserId != userId && !IsCurrentUserAdmin())
        {
            return Forbid();
        }

        return Ok(new ReportStatusResponse(
            report.Id,
            report.Status,
            report.ActionTaken,
            report.CreatedAt,
            report.ReviewedAt
        ));
    }

    /// <summary>
    /// Get user's submitted reports
    /// </summary>
    [HttpGet("my-reports")]
    [ProducesResponseType(typeof(PaginatedReportsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyReports([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        pageSize = Math.Min(pageSize, 50); // Cap at 50

        var reports = await _reportService.GetUserReportsAsync(userId, page, pageSize);
        return Ok(reports);
    }

    /// <summary>
    /// Get available report reasons
    /// </summary>
    [HttpGet("reasons")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ReportReasonsResponse), StatusCodes.Status200OK)]
    public IActionResult GetReportReasons()
    {
        return Ok(new ReportReasonsResponse(ReportReason.All.ToList()));
    }

    private uint GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var id) ? id : 0;
    }

    private bool IsCurrentUserAdmin()
    {
        return User.IsInRole("admin") || User.HasClaim("role", "admin");
    }
}

// Additional response DTOs
public record ReportCreatedResponse(string ReportId, string Message);
public record ReportStatusResponse(string ReportId, string Status, string? ActionTaken, DateTime CreatedAt, DateTime? ReviewedAt);
public record ReportReasonsResponse(List<string> Reasons);
public record PaginatedReportsResponse(List<ReportSummaryDto> Reports, int TotalCount, int Page, int PageSize);
