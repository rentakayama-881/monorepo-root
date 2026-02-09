using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Controllers;
using System.Net;
using System.Text.Json;
using Ulid = NUlid.Ulid;

namespace FeatureService.Api.Services;

public interface IReportService
{
    Task<string> CreateReportAsync(uint reporterUserId, string targetType, string targetId, uint threadId, string reason, string? description);
    Task<Report?> GetReportByIdAsync(string reportId);
    Task<PaginatedReportsResponse> GetPendingReportsAsync(int page, int pageSize, string? status = null);
    Task<PaginatedReportsResponse> GetUserReportsAsync(uint userId, int page, int pageSize);
    Task TakeActionAsync(string reportId, uint adminId, string action, string? adminNotes, string? ipAddress, string? userAgent);
    Task<bool> HasUserReportedContentAsync(uint userId, string targetType, string targetId);
}

public class ReportService : IReportService
{
    private readonly MongoDbContext _context;
    private readonly ILogger<ReportService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public ReportService(
        MongoDbContext context,
        ILogger<ReportService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<string> CreateReportAsync(uint reporterUserId, string targetType, string targetId, uint threadId, string reason, string? description)
    {
        if (string.IsNullOrWhiteSpace(targetId))
        {
            throw new ArgumentException("TargetId is required", nameof(targetId));
        }

        targetType = targetType?.Trim() ?? string.Empty;
        targetId = targetId.Trim();
        reason = reason?.Trim() ?? string.Empty;
        description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();

        // Validate reason
        if (!ReportReason.All.Contains(reason))
        {
            throw new ArgumentException($"Invalid reason. Must be one of: {string.Join(", ", ReportReason.All)}");
        }

        var resolvedThreadId = threadId;
        uint resolvedReportedUserId = 0;

        if (string.Equals(targetType, ReportTargetType.Thread, StringComparison.OrdinalIgnoreCase))
        {
            if (resolvedThreadId == 0)
            {
                if (!uint.TryParse(targetId, out resolvedThreadId) || resolvedThreadId == 0)
                {
                    throw new ArgumentException("ThreadId is required for thread reports", nameof(threadId));
                }
            }

            var ownerId = await TryResolveThreadOwnerUserIdAsync(resolvedThreadId);
            if (ownerId.HasValue)
            {
                resolvedReportedUserId = ownerId.Value;
            }
        }
        if (resolvedThreadId == 0)
        {
            throw new ArgumentException("ThreadId is required", nameof(threadId));
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
            ThreadId = resolvedThreadId,
            ReportedUserId = resolvedReportedUserId,
            ReporterUserId = reporterUserId,
            Reason = reason,
            Description = description,
            Status = ReportStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.Reports.InsertOneAsync(report);
        _logger.LogInformation("Report created: {ReportId} by user {UserId} for {TargetType} {TargetId}", 
            report.Id, reporterUserId, targetType, targetId);

        return report.Id;
    }

    private async Task<uint?> TryResolveThreadOwnerUserIdAsync(uint threadId)
    {
        var goBackendUrl = (_configuration["GoBackend:BaseUrl"] ?? "http://127.0.0.1:8080").TrimEnd('/');
        var url = $"{goBackendUrl}/api/threads/{threadId}/public";

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
            var thread = JsonSerializer.Deserialize<GoThreadDetailResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (thread?.User?.Id is > 0)
            {
                return thread.User.Id;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve thread owner via Go backend for thread {ThreadId}", threadId);
            return null;
        }
    }

    public async Task<Report?> GetReportByIdAsync(string reportId)
    {
        return await _context.Reports
            .Find(r => r.Id == reportId)
            .FirstOrDefaultAsync();
    }

    public async Task<PaginatedReportsResponse> GetPendingReportsAsync(int page, int pageSize, string? status = null)
    {
        var filterBuilder = Builders<Report>.Filter;
        var filter = status != null 
            ? filterBuilder.Eq(r => r.Status, status)
            : filterBuilder.Eq(r => r.Status, ReportStatus.Pending);
        
        var totalCount = await _context.Reports.CountDocumentsAsync(filter);
        
        var reports = await _context.Reports
            .Find(filter)
            .SortByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var summaries = reports.Select(r => new ReportSummaryDto(
            r.Id,
            r.TargetType,
            r.TargetId,
            r.ThreadId,
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

        return new PaginatedReportsResponse(summaries, (int)totalCount, page, pageSize);
    }

    public async Task<PaginatedReportsResponse> GetUserReportsAsync(uint userId, int page, int pageSize)
    {
        var filter = Builders<Report>.Filter.Eq(r => r.ReporterUserId, userId);
        
        var totalCount = await _context.Reports.CountDocumentsAsync(filter);
        
        var reports = await _context.Reports
            .Find(filter)
            .SortByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var summaries = reports.Select(r => new ReportSummaryDto(
            r.Id,
            r.TargetType,
            r.TargetId,
            r.ThreadId,
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

        return new PaginatedReportsResponse(summaries, (int)totalCount, page, pageSize);
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

        var update = Builders<Report>.Update
            .Set(r => r.ActionTaken, action)
            .Set(r => r.AdminNotes, adminNotes)
            .Set(r => r.ReviewedByAdminId, adminId)
            .Set(r => r.ReviewedAt, DateTime.UtcNow)
            .Set(r => r.Status, action == ReportAction.None ? ReportStatus.Dismissed : ReportStatus.Resolved)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _context.Reports.UpdateOneAsync(r => r.Id == reportId, update);

        _logger.LogInformation("Report {ReportId} processed by admin {AdminId} with action {Action}", 
            reportId, adminId, action);
    }

    public async Task<bool> HasUserReportedContentAsync(uint userId, string targetType, string targetId)
    {
        var filter = Builders<Report>.Filter.And(
            Builders<Report>.Filter.Eq(r => r.ReporterUserId, userId),
            Builders<Report>.Filter.Eq(r => r.TargetType, targetType),
            Builders<Report>.Filter.Eq(r => r.TargetId, targetId)
        );

        var count = await _context.Reports.CountDocumentsAsync(filter);
        return count > 0;
    }
}

internal sealed class GoThreadDetailResponse
{
    public GoThreadUser? User { get; set; }
}

internal sealed class GoThreadUser
{
    public uint Id { get; set; }
    public string? Username { get; set; }
}
