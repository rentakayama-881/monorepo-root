using System.Net;
using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using System.Text.Json;

namespace FeatureService.Api.Services;

public interface IReportService
{
    Task<string> CreateReportAsync(uint reporterUserId, string targetType, string targetId, uint validationCaseId, string reason, string? description);
    Task<Report?> GetReportByIdAsync(string reportId);
    Task<PaginatedReportsResponse> GetPendingReportsAsync(int page, int pageSize, string? status = null);
    Task<PaginatedReportsResponse> GetUserReportsAsync(uint userId, int page, int pageSize);
    Task TakeActionAsync(string reportId, uint adminId, string action, string? adminNotes, string? ipAddress, string? userAgent);
    Task<bool> HasUserReportedContentAsync(uint userId, string targetType, string targetId);
}

public class ReportService : IReportService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ReportService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public ReportService(
        AppDbContext db,
        ILogger<ReportService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _db = db;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<string> CreateReportAsync(uint reporterUserId, string targetType, string targetId, uint validationCaseId, string reason, string? description)
    {
        if (string.IsNullOrWhiteSpace(targetId))
        {
            throw new ArgumentException("TargetId is required", nameof(targetId));
        }

        targetType = NormalizeTargetType(targetType?.Trim() ?? string.Empty);
        targetId = targetId.Trim();
        reason = reason?.Trim() ?? string.Empty;
        description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();

        if (targetType != ReportTargetType.ValidationCase)
        {
            throw new ArgumentException($"Invalid target type. Must be '{ReportTargetType.ValidationCase}'", nameof(targetType));
        }

        // Validate reason
        if (!ReportReason.All.Contains(reason))
        {
            throw new ArgumentException($"Invalid reason. Must be one of: {string.Join(", ", ReportReason.All)}");
        }

        var resolvedValidationCaseId = validationCaseId;
        uint resolvedReportedUserId = 0;

        if (resolvedValidationCaseId == 0)
        {
            if (!uint.TryParse(targetId, out resolvedValidationCaseId) || resolvedValidationCaseId == 0)
            {
                throw new ArgumentException("ValidationCaseId is required for validation case reports", nameof(validationCaseId));
            }
        }

        var ownerId = await TryResolveValidationCaseOwnerUserIdAsync(resolvedValidationCaseId);
        if (ownerId.HasValue)
        {
            resolvedReportedUserId = ownerId.Value;
        }
        if (resolvedValidationCaseId == 0)
        {
            throw new ArgumentException("ValidationCaseId is required", nameof(validationCaseId));
        }

        // Check if user already reported this content
        if (await HasUserReportedContentAsync(reporterUserId, targetType, targetId))
        {
            throw new InvalidOperationException("You have already reported this content");
        }

        var report = new Report
        {
            Id = $"rpt_{Ulid.NewUlid()}",
            TargetType = targetType,
            TargetId = targetId,
            ValidationCaseId = resolvedValidationCaseId,
            ReportedUserId = resolvedReportedUserId,
            ReporterUserId = reporterUserId,
            Reason = reason,
            Description = description,
            Status = ReportStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Reports.Add(report);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Report created: {ReportId} by user {UserId} for {TargetType} {TargetId}", 
            report.Id, reporterUserId, targetType, targetId);

        return report.Id;
    }

    private async Task<uint?> TryResolveValidationCaseOwnerUserIdAsync(uint validationCaseId)
    {
        var goBackendUrl = (_configuration["GoBackend:BaseUrl"] ?? "http://127.0.0.1:8080").TrimEnd('/');
        var url = $"{goBackendUrl}/api/validation-cases/{validationCaseId}/public";

        try
        {
            var httpClient = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            using var response = await httpClient.SendAsync(request);

            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var validationCase = JsonSerializer.Deserialize<GoValidationCaseDetailResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (validationCase?.Owner?.Id is > 0)
            {
                return validationCase.Owner.Id;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve validation case owner via Go backend for validation case {ValidationCaseId}", validationCaseId);
            return null;
        }
    }

    public async Task<Report?> GetReportByIdAsync(string reportId)
    {
        return await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId);
    }

    public async Task<PaginatedReportsResponse> GetPendingReportsAsync(int page, int pageSize, string? status = null)
    {
        var filterStatus = status ?? ReportStatus.Pending;

        var totalCount = await _db.Reports.CountAsync(r => r.Status == filterStatus);
        
        var reports = await _db.Reports
            .Where(r => r.Status == filterStatus)
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var summaries = reports.Select(r => new ReportSummaryDto(
            r.Id,
            NormalizeTargetType(r.TargetType),
            r.TargetId,
            r.ValidationCaseId != 0 ? r.ValidationCaseId : r.LegacyThreadId,
            r.ReportedUserId,
            null, // Username fetched from Go backend
            r.ReporterUserId,
            null,
            r.Reason,
            r.Description,
            r.Status,
            r.ActionTaken,
            r.CreatedAt
        )).ToList();

        return new PaginatedReportsResponse(summaries, totalCount, page, pageSize);
    }

    public async Task<PaginatedReportsResponse> GetUserReportsAsync(uint userId, int page, int pageSize)
    {
        var totalCount = await _db.Reports.CountAsync(r => r.ReporterUserId == userId);
        
        var reports = await _db.Reports
            .Where(r => r.ReporterUserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var summaries = reports.Select(r => new ReportSummaryDto(
            r.Id,
            NormalizeTargetType(r.TargetType),
            r.TargetId,
            r.ValidationCaseId != 0 ? r.ValidationCaseId : r.LegacyThreadId,
            r.ReportedUserId,
            null,
            r.ReporterUserId,
            null,
            r.Reason,
            r.Description,
            r.Status,
            r.ActionTaken,
            r.CreatedAt
        )).ToList();

        return new PaginatedReportsResponse(summaries, totalCount, page, pageSize);
    }

    public async Task TakeActionAsync(string reportId, uint adminId, string action, string? adminNotes, string? ipAddress, string? userAgent)
    {
        var report = await GetReportByIdAsync(reportId);
        if (report == null)
        {
            throw new KeyNotFoundException("Report not found");
        }

        if (report.Status == ReportStatus.Resolved || report.Status == ReportStatus.Dismissed)
        {
            throw new InvalidOperationException("Report has already been processed");
        }

        await _db.Reports
            .Where(r => r.Id == reportId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.ActionTaken, action)
                .SetProperty(r => r.AdminNotes, adminNotes)
                .SetProperty(r => r.ReviewedByAdminId, adminId)
                .SetProperty(r => r.ReviewedAt, DateTime.UtcNow)
                .SetProperty(r => r.Status, action == ReportAction.None ? ReportStatus.Dismissed : ReportStatus.Resolved)
                .SetProperty(r => r.UpdatedAt, DateTime.UtcNow));

        _logger.LogInformation("Report {ReportId} processed by admin {AdminId} with action {Action}", 
            reportId, adminId, action);
    }

    public async Task<bool> HasUserReportedContentAsync(uint userId, string targetType, string targetId)
    {
        targetType = NormalizeTargetType(targetType?.Trim() ?? string.Empty);

        // Domain migration: legacy "thread" reports are treated as validation_case.
        // For duplicate detection we match both "validation_case" and "thread".
        var targetTypes = targetType == ReportTargetType.ValidationCase
            ? new[] { ReportTargetType.ValidationCase, ReportTargetType.Thread }
            : new[] { targetType };

        var count = await _db.Reports.CountAsync(r =>
            r.ReporterUserId == userId &&
            targetTypes.Contains(r.TargetType) &&
            r.TargetId == targetId);

        return count > 0;
    }

    private static string NormalizeTargetType(string targetType)
    {
        if (string.IsNullOrWhiteSpace(targetType))
        {
            return string.Empty;
        }

        targetType = targetType.Trim().ToLowerInvariant();

        // Canonical domain term is "validation_case".
        if (targetType == ReportTargetType.Thread)
        {
            return ReportTargetType.ValidationCase;
        }

        return targetType;
    }
}

internal sealed class GoValidationCaseDetailResponse
{
    public GoValidationCaseOwner? Owner { get; set; }
}

internal sealed class GoValidationCaseOwner
{
    public uint Id { get; set; }
    public string? Username { get; set; }
}
