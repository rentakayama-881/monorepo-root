using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MongoDB.Driver;
using MongoDB.Bson;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using Ulid = NUlid.Ulid;

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

public class AdminModerationService : IAdminModerationService
{
    private readonly MongoDbContext _context;
    private readonly IReportService _reportService;
    private readonly IDeviceBanService _deviceBanService;
    private readonly IUserWarningService _warningService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminModerationService> _logger;

    public AdminModerationService(
        MongoDbContext context,
        IReportService reportService,
        IDeviceBanService deviceBanService,
        IUserWarningService warningService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<AdminModerationService> logger)
    {
        _context = context;
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

        var pendingReports = await _context.Reports
            .CountDocumentsAsync(r => r.Status == ReportStatus.Pending);

        var reportsToday = await _context.Reports
            .CountDocumentsAsync(r => r.CreatedAt >= today && r.CreatedAt < tomorrow);

        var activeBans = await _context.DeviceBans
            .CountDocumentsAsync(b => b.IsActive);

        var warningsToday = await _context.UserWarnings
            .CountDocumentsAsync(w => w.CreatedAt >= today && w.CreatedAt < tomorrow);

        var hiddenContent = await _context.HiddenContents
            .CountDocumentsAsync(h => h.IsActive);

        return new AdminDashboardStatsDto(
            (int)pendingReports,
            (int)reportsToday,
            (int)activeBans,
            (int)warningsToday,
            (int)hiddenContent
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
        var existing = await _context.HiddenContents
            .Find(h => h.ContentType == normalizedType && h.ContentId == contentId && h.IsActive)
            .FirstOrDefaultAsync();

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

        await _context.HiddenContents.InsertOneAsync(hidden);

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
            using var doc = JsonDocument.Parse(json);
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
        var hidden = await _context.HiddenContents
            .Find(h => h.Id == hiddenContentId)
            .FirstOrDefaultAsync();

        if (hidden == null)
        {
            throw new KeyNotFoundException("Hidden content record not found");
        }

        if (!hidden.IsActive)
        {
            throw new InvalidOperationException("Content is not currently hidden");
        }

        var update = Builders<HiddenContent>.Update
            .Set(h => h.IsActive, false)
            .Set(h => h.UnhiddenByAdminId, adminId)
            .Set(h => h.UnhiddenAt, DateTime.UtcNow)
            .Set(h => h.UpdatedAt, DateTime.UtcNow);

        await _context.HiddenContents.UpdateOneAsync(h => h.Id == hiddenContentId, update);

        // Log admin action
        await LogAdminActionAsync(adminId, null, AdminActionType.UnhideContent, AdminActionTargetType.Content, hiddenContentId,
            new { contentType = hidden.ContentType, contentId = hidden.ContentId }, null, null);

        _logger.LogInformation("Content unhidden: {Id} by admin {AdminId}", hiddenContentId, adminId);
    }

    public async Task<PaginatedHiddenContentResponse> GetHiddenContentAsync(int page, int pageSize)
    {
        var filter = Builders<HiddenContent>.Filter.Eq(h => h.IsActive, true);

        var totalCount = await _context.HiddenContents.CountDocumentsAsync(filter);

        var items = await _context.HiddenContents
            .Find(filter)
            .SortByDescending(h => h.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
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

        return new PaginatedHiddenContentResponse(dtos, (int)totalCount, page, pageSize);
    }

    public async Task<string> LogAdminActionAsync(uint adminId, string? adminEmail, string actionType, string targetType, string targetId, object? actionDetails, string? ipAddress, string? userAgent)
    {
        var log = new AdminActionLog
        {
            Id = $"aal_{Ulid.NewUlid()}",
            AdminId = adminId,
            AdminEmail = adminEmail,
            ActionType = actionType,
            TargetType = targetType,
            TargetId = targetId,
            ActionDetails = actionDetails != null ? BsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(actionDetails)) : null,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        };

        await _context.AdminActionLogs.InsertOneAsync(log);
        return log.Id;
    }

    public async Task<PaginatedAdminActionLogResponse> GetAdminActionLogsAsync(int page, int pageSize, string? actionType)
    {
        var filterBuilder = Builders<AdminActionLog>.Filter;
        var filter = filterBuilder.Empty;

        if (!string.IsNullOrEmpty(actionType))
        {
            filter = filterBuilder.Eq(l => l.ActionType, actionType);
        }

        var totalCount = await _context.AdminActionLogs.CountDocumentsAsync(filter);

        var logs = await _context.AdminActionLogs
            .Find(filter)
            .SortByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var dtos = logs.Select(l => new AdminActionLogDto(
            l.Id,
            l.AdminId,
            l.AdminEmail,
            l.ActionType,
            l.TargetType,
            l.TargetId,
            l.ActionDetails?.ToDictionary(),
            l.CreatedAt
        )).ToList();

        return new PaginatedAdminActionLogResponse(dtos, (int)totalCount, page, pageSize);
    }

    public async Task<MoveValidationCaseResponse> MoveValidationCaseAsync(uint adminId, MoveValidationCaseRequest request, string? authorizationHeader, string? requestId)
    {
        // Call Go backend to move Validation Case (single-writer lives in Go backend)
        var goBackendUrl = (_configuration["GoBackend:BaseUrl"] ?? "http://127.0.0.1:8080").TrimEnd('/');

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{goBackendUrl}/admin/validation-cases/{request.ValidationCaseId}/move");
        httpRequest.Content = new StringContent(
            JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["new_owner_user_id"] = request.NewOwnerUserId,
                ["new_category_id"] = request.NewCategoryId,
                ["reason"] = request.Reason ?? string.Empty,
                ["dry_run"] = request.DryRun
            }),
            Encoding.UTF8,
            "application/json");

        if (!string.IsNullOrWhiteSpace(authorizationHeader))
        {
            httpRequest.Headers.TryAddWithoutValidation("Authorization", authorizationHeader);
        }

        if (!string.IsNullOrWhiteSpace(requestId))
        {
            httpRequest.Headers.TryAddWithoutValidation("X-Request-Id", requestId);
        }

        var response = await _httpClient.SendAsync(httpRequest);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new UpstreamApiException((int)response.StatusCode, error, response.Content.Headers.ContentType?.ToString());
        }

        var goResult = await response.Content.ReadFromJsonAsync<GoAdminMoveValidationCaseEnvelope>();
        if (goResult?.Data == null)
        {
            throw new UpstreamApiException(500, "{\"code\":\"SRV001\",\"message\":\"Invalid response from Go backend\"}", "application/json");
        }

        var previousOwnerUserId = goResult.Data.OldOwner?.Id ?? 0;

        // Record move in MongoDB for audit (best-effort; do not block the upstream success).
        try
        {
            var transfer = new ValidationCaseOwnershipTransfer
            {
                Id = $"trf_{Ulid.NewUlid()}",
                ValidationCaseId = request.ValidationCaseId,
                ValidationCaseTitle = null,
                PreviousOwnerUserId = previousOwnerUserId,
                PreviousOwnerUsername = goResult.Data.OldOwner?.Username,
                NewOwnerUserId = request.NewOwnerUserId,
                NewOwnerUsername = goResult.Data.NewOwner?.Username,
                TransferredByAdminId = adminId,
                Reason = request.Reason,
                CreatedAt = DateTime.UtcNow
            };

            await _context.ValidationCaseOwnershipTransfers.InsertOneAsync(transfer);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record validation case move history (best effort). ValidationCaseId: {ValidationCaseId}", request.ValidationCaseId);
        }

        await LogAdminActionAsync(adminId, null, AdminActionType.ValidationCaseMove, AdminActionTargetType.ValidationCase, request.ValidationCaseId.ToString(),
            new { previousOwner = previousOwnerUserId, newOwner = request.NewOwnerUserId, newCategoryId = request.NewCategoryId, reason = request.Reason }, null, null);

        _logger.LogInformation("Validation case {ValidationCaseId} moved from {From} to {To} by admin {AdminId}",
            request.ValidationCaseId, previousOwnerUserId, request.NewOwnerUserId, adminId);

        return new MoveValidationCaseResponse(
            request.ValidationCaseId,
            previousOwnerUserId,
            request.NewOwnerUserId,
            goResult.Message ?? "Validation case moved successfully"
        );
    }
}

public sealed class UpstreamApiException : Exception
{
    public int StatusCode { get; }
    public string Body { get; }
    public string? ContentType { get; }

    public UpstreamApiException(int statusCode, string body, string? contentType = null, Exception? inner = null)
        : base($"Upstream API error ({statusCode})", inner)
    {
        StatusCode = statusCode;
        Body = body ?? string.Empty;
        ContentType = contentType;
    }
}

internal sealed class GoAdminMoveValidationCaseEnvelope
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("data")]
    public GoAdminMoveValidationCaseData? Data { get; set; }
}

internal sealed class GoAdminMoveValidationCaseData
{
    [JsonPropertyName("validation_case_id")]
    public uint ValidationCaseId { get; set; }

    [JsonPropertyName("old_owner")]
    public GoAdminMoveValidationCaseUserSnapshot? OldOwner { get; set; }

    [JsonPropertyName("new_owner")]
    public GoAdminMoveValidationCaseUserSnapshot? NewOwner { get; set; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; set; }
}

internal sealed class GoAdminMoveValidationCaseUserSnapshot
{
    [JsonPropertyName("id")]
    public uint Id { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }
}
