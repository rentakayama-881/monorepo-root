using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using NUlid;

namespace FeatureService.Api.Services;

public interface IReportService
{
    Task<string> CreateReportAsync(uint reporterUserId, CreateReportRequest request);
    Task<Report?> GetReportByIdAsync(string reportId);
    Task<PaginatedReportsResponse> GetPendingReportsAsync(int page, int pageSize);
    Task<PaginatedReportsResponse> GetReportsByStatusAsync(string status, int page, int pageSize);
    Task<PaginatedReportsResponse> GetReportsByUserAsync(uint userId, int page, int pageSize);
    Task TakeActionAsync(string reportId, uint adminId, TakeReportActionRequest request);
    Task<bool> HasUserReportedContentAsync(uint userId, string targetType, string targetId);
}

public class ReportService : IReportService
{
    private readonly MongoDbContext _context;
    private readonly ILogger<ReportService> _logger;

    public ReportService(MongoDbContext context, ILogger<ReportService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<string> CreateReportAsync(uint reporterUserId, CreateReportRequest request)
    {
        // Validate reason
        if (!ReportReason.All.Contains(request.Reason))
        {
            throw new ArgumentException($"Invalid reason. Must be one of: {string.Join(", ", ReportReason.All)}");
        }

        // Check if user already reported this content
        if (await HasUserReportedContentAsync(reporterUserId, request.TargetType, request.TargetId))
        {
            throw new InvalidOperationException("You have already reported this content");
        }

        var report = new Report
        {
            Id = $"rpt_{Ulid.NewUlid()}",
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            ThreadId = request.ThreadId,
            ReportedUserId = 0, // Will be set by caller or fetched from Go backend
            ReporterUserId = reporterUserId,
            Reason = request.Reason,
            Description = request.Description,
            Status = ReportStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.Reports.InsertOneAsync(report);
        _logger.LogInformation("Report created: {ReportId} by user {UserId} for {TargetType} {TargetId}", 
            report.Id, reporterUserId, request.TargetType, request.TargetId);

        return report.Id;
    }

    public async Task<Report?> GetReportByIdAsync(string reportId)
    {
        return await _context.Reports
            .Find(r => r.Id == reportId)
            .FirstOrDefaultAsync();
    }

    public async Task<PaginatedReportsResponse> GetPendingReportsAsync(int page, int pageSize)
    {
        return await GetReportsByStatusAsync(ReportStatus.Pending, page, pageSize);
    }

    public async Task<PaginatedReportsResponse> GetReportsByStatusAsync(string status, int page, int pageSize)
    {
        var filter = Builders<Report>.Filter.Eq(r => r.Status, status);
        
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

    public async Task<PaginatedReportsResponse> GetReportsByUserAsync(uint userId, int page, int pageSize)
    {
        var filter = Builders<Report>.Filter.Eq(r => r.ReportedUserId, userId);
        
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

    public async Task TakeActionAsync(string reportId, uint adminId, TakeReportActionRequest request)
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
            .Set(r => r.ActionTaken, request.Action)
            .Set(r => r.AdminNotes, request.AdminNotes)
            .Set(r => r.ReviewedByAdminId, adminId)
            .Set(r => r.ReviewedAt, DateTime.UtcNow)
            .Set(r => r.Status, request.Action == ReportAction.None ? ReportStatus.Dismissed : ReportStatus.Resolved)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _context.Reports.UpdateOneAsync(r => r.Id == reportId, update);

        _logger.LogInformation("Report {ReportId} processed by admin {AdminId} with action {Action}", 
            reportId, adminId, request.Action);
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
