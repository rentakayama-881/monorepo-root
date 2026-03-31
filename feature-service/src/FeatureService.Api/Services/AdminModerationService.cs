using System.Net;
using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IAdminModerationService
{
    Task<AdminDashboardStatsDto> GetDashboardStatsAsync();
    Task<string> HideContentAsync(string contentType, string contentId, string reason, string? reportId, uint adminId);
    Task UnhideContentAsync(string hiddenContentId, uint adminId);
    Task<PaginatedHiddenContentResponse> GetHiddenContentAsync(int page, int pageSize);
    Task<string> LogAdminActionAsync(uint adminId, string? adminEmail, string actionType, string targetType, string targetId, object? actionDetails, string? ipAddress, string? userAgent);
    Task<PaginatedAdminActionLogResponse> GetAdminActionLogsAsync(int page, int pageSize, string? actionType);
    // Validation Case management (calls Go backend via HTTP)
    Task<MoveValidationCaseResponse> MoveValidationCaseAsync(uint adminId, MoveValidationCaseRequest request, string? authorizationHeader, string? requestId);
}

public partial class AdminModerationService : IAdminModerationService
{
    private readonly AppDbContext _db;
    private readonly IReportService _reportService;
    private readonly IDeviceBanService _deviceBanService;
    private readonly IUserWarningService _warningService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminModerationService> _logger;

    public AdminModerationService(
        AppDbContext db,
        IReportService reportService,
        IDeviceBanService deviceBanService,
        IUserWarningService warningService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<AdminModerationService> logger)
    {
        _db = db;
        _reportService = reportService;
        _deviceBanService = deviceBanService;
        _warningService = warningService;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AdminDashboardStatsDto> GetDashboardStatsAsync()
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var pendingReports = await _db.Reports
            .CountAsync(r => r.Status == ReportStatus.Pending);

        var reportsToday = await _db.Reports
            .CountAsync(r => r.CreatedAt >= today && r.CreatedAt < tomorrow);

        var activeBans = await _db.DeviceBans
            .CountAsync(b => b.IsActive);

        var warningsToday = await _db.UserWarnings
            .CountAsync(w => w.CreatedAt >= today && w.CreatedAt < tomorrow);

        var hiddenContent = await _db.HiddenContents
            .CountAsync(h => h.IsActive);

        return new AdminDashboardStatsDto(
            pendingReports,
            reportsToday,
            activeBans,
            warningsToday,
            hiddenContent
        );
    }

    public async Task<string> HideContentAsync(string contentType, string contentId, string reason, string? reportId, uint adminId)
    {
        contentType = (contentType ?? string.Empty).Trim();
        contentId = (contentId ?? string.Empty).Trim();
        reason = (reason ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(contentId))
        {
            throw new ArgumentException("ContentId is required", nameof(contentId));
        }
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Reason is required", nameof(reason));
        }

        // Domain migration: "thread" is a legacy alias for validation_case.
        var normalizedType = contentType.ToLowerInvariant();
        if (normalizedType == "thread")
        {
            normalizedType = "validation_case";
        }
        if (normalizedType != "validation_case")
        {
            throw new ArgumentException("Unsupported content type. Must be 'validation_case'", nameof(contentType));
        }

        if (!uint.TryParse(contentId, out var validationCaseId) || validationCaseId == 0)
        {
            throw new ArgumentException("ContentId must be a numeric ValidationCaseId", nameof(contentId));
        }

        var ownerUserId = await TryResolveValidationCaseOwnerUserIdAsync(validationCaseId);
        if (!ownerUserId.HasValue || ownerUserId.Value == 0)
        {
            throw new KeyNotFoundException("Validation Case not found");
        }

        // Check if already hidden
        var existing = await _db.HiddenContents
            .FirstOrDefaultAsync(h => h.ContentType == normalizedType && h.ContentId == contentId && h.IsActive);

        if (existing != null)
        {
            throw new InvalidOperationException("Content is already hidden");
        }

        var hidden = new HiddenContent
        {
            Id = $"hid_{Ulid.NewUlid()}",
            ContentType = normalizedType,
            ContentId = contentId,
            ValidationCaseId = validationCaseId,
            UserId = ownerUserId.Value,
            Reason = reason,
            ReportId = reportId,
            HiddenByAdminId = adminId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.HiddenContents.Add(hidden);
        await _db.SaveChangesAsync();

        // Log admin action
        await LogAdminActionAsync(adminId, null, AdminActionType.HideContent, AdminActionTargetType.Content, hidden.Id,
            new { contentType = normalizedType, contentId, validationCaseId, reason }, null, null);

        _logger.LogInformation("Content hidden: {Type} {Id} by admin {AdminId}", contentType, contentId, adminId);

        return hidden.Id;
    }

    private async Task<uint?> TryResolveValidationCaseOwnerUserIdAsync(uint validationCaseId)
    {
        var goBackendUrl = (_configuration["GoBackend:BaseUrl"] ?? "http://127.0.0.1:8080").TrimEnd('/');
        var url = $"{goBackendUrl}/api/validation-cases/{validationCaseId}/public";

        try
        {
            using var response = await _httpClient.GetAsync(url);
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("owner", out var owner)
                && owner.TryGetProperty("id", out var ownerIdEl)
                && ownerIdEl.TryGetUInt32(out var ownerId)
                && ownerId > 0)
            {
                return ownerId;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve validation case owner via Go backend. ValidationCaseId: {ValidationCaseId}", validationCaseId);
            return null;
        }
    }

    public async Task UnhideContentAsync(string hiddenContentId, uint adminId)
    {
        var hidden = await _db.HiddenContents
            .FirstOrDefaultAsync(h => h.Id == hiddenContentId);

        if (hidden == null)
        {
            throw new KeyNotFoundException("Hidden content record not found");
        }

        if (!hidden.IsActive)
        {
            throw new InvalidOperationException("Content is not currently hidden");
        }

        await _db.HiddenContents
            .Where(h => h.Id == hiddenContentId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(h => h.IsActive, false)
                .SetProperty(h => h.UnhiddenByAdminId, adminId)
                .SetProperty(h => h.UnhiddenAt, DateTime.UtcNow)
                .SetProperty(h => h.UpdatedAt, DateTime.UtcNow));

        // Log admin action
        await LogAdminActionAsync(adminId, null, AdminActionType.UnhideContent, AdminActionTargetType.Content, hiddenContentId,
            new { contentType = hidden.ContentType, contentId = hidden.ContentId }, null, null);

        _logger.LogInformation("Content unhidden: {Id} by admin {AdminId}", hiddenContentId, adminId);
    }

    public async Task<PaginatedHiddenContentResponse> GetHiddenContentAsync(int page, int pageSize)
    {
        var totalCount = await _db.HiddenContents.CountAsync(h => h.IsActive);

        var items = await _db.HiddenContents
            .Where(h => h.IsActive)
            .OrderByDescending(h => h.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = items.Select(h => new HiddenContentDto(
            h.Id,
            h.ContentType,
            h.ContentId,
            h.ValidationCaseId != 0 ? h.ValidationCaseId : h.LegacyThreadId,
            h.UserId,
            null, // Username fetched from Go backend
            h.Reason,
            h.HiddenByAdminId,
            h.IsActive,
            h.CreatedAt,
            null // Content preview fetched from Go backend
        )).ToList();

        return new PaginatedHiddenContentResponse(dtos, totalCount, page, pageSize);
    }
}
