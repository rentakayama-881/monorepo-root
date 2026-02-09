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
    Task<string> HideContentAsync(string contentType, string contentId, uint threadId, uint userId, string reason, string? reportId, uint adminId);
    Task UnhideContentAsync(string hiddenContentId, uint adminId);
    Task<PaginatedHiddenContentResponse> GetHiddenContentAsync(int page, int pageSize);
    Task<string> LogAdminActionAsync(uint adminId, string? adminEmail, string actionType, string targetType, string targetId, object? actionDetails, string? ipAddress, string? userAgent);
    Task<PaginatedAdminActionLogResponse> GetAdminActionLogsAsync(int page, int pageSize, string? actionType);
    // Thread management (these call Go backend via HTTP)
    Task<TransferThreadOwnershipResponse> TransferThreadOwnershipAsync(uint adminId, TransferThreadOwnershipRequest request, string? authorizationHeader, string? requestId);
    Task DeleteThreadAsync(uint adminId, AdminDeleteThreadRequest request);
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

    public async Task<string> HideContentAsync(string contentType, string contentId, uint threadId, uint userId, string reason, string? reportId, uint adminId)
    {
        // Check if already hidden
        var existing = await _context.HiddenContents
            .Find(h => h.ContentType == contentType && h.ContentId == contentId && h.IsActive)
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            throw new InvalidOperationException("Content is already hidden");
        }

        var hidden = new HiddenContent
        {
            Id = $"hid_{Ulid.NewUlid()}",
            ContentType = contentType,
            ContentId = contentId,
            ThreadId = threadId,
            UserId = userId,
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
            new { contentType, contentId, threadId, reason }, null, null);

        _logger.LogInformation("Content hidden: {Type} {Id} by admin {AdminId}", contentType, contentId, adminId);

        return hidden.Id;
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
            h.ThreadId,
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

    public async Task<TransferThreadOwnershipResponse> TransferThreadOwnershipAsync(uint adminId, TransferThreadOwnershipRequest request, string? authorizationHeader, string? requestId)
    {
        // Call Go backend to transfer/move thread (single-writer lives in Go backend)
        var goBackendUrl = (_configuration["GoBackend:BaseUrl"] ?? "http://127.0.0.1:8080").TrimEnd('/');

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{goBackendUrl}/admin/threads/{request.ThreadId}/move");
        httpRequest.Content = new StringContent(
            JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["new_owner_user_id"] = request.NewOwnerUserId,
                ["new_category_id"] = null, // feature-service endpoint doesn't expose category move (yet)
                ["reason"] = request.Reason ?? string.Empty,
                ["dry_run"] = false
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

        var goResult = await response.Content.ReadFromJsonAsync<GoAdminMoveThreadEnvelope>();
        if (goResult?.Data == null)
        {
            throw new UpstreamApiException(500, "{\"code\":\"SRV001\",\"message\":\"Invalid response from Go backend\"}", "application/json");
        }

        var previousOwnerUserId = goResult.Data.OldOwner?.Id ?? 0;

        // Record transfer in MongoDB for audit
        var transfer = new ThreadOwnershipTransfer
        {
            Id = $"trf_{Ulid.NewUlid()}",
            ThreadId = request.ThreadId,
            ThreadTitle = null,
            PreviousOwnerUserId = previousOwnerUserId,
            PreviousOwnerUsername = goResult.Data.OldOwner?.Username,
            NewOwnerUserId = request.NewOwnerUserId,
            NewOwnerUsername = goResult.Data.NewOwner?.Username,
            TransferredByAdminId = adminId,
            Reason = request.Reason,
            CreatedAt = DateTime.UtcNow
        };

        await _context.ThreadOwnershipTransfers.InsertOneAsync(transfer);

        // Log admin action
        await LogAdminActionAsync(adminId, null, AdminActionType.ThreadTransfer, AdminActionTargetType.Thread, request.ThreadId.ToString(),
            new { previousOwner = transfer.PreviousOwnerUserId, newOwner = request.NewOwnerUserId, reason = request.Reason }, null, null);

        _logger.LogInformation("Thread {ThreadId} ownership transferred from {From} to {To} by admin {AdminId}",
            request.ThreadId, transfer.PreviousOwnerUserId, request.NewOwnerUserId, adminId);

        return new TransferThreadOwnershipResponse(
            request.ThreadId,
            transfer.PreviousOwnerUserId,
            request.NewOwnerUserId,
            goResult.Message ?? "Thread ownership transferred successfully"
        );
    }

    public async Task DeleteThreadAsync(uint adminId, AdminDeleteThreadRequest request)
    {
        // Call Go backend to delete thread
        var goBackendUrl = _configuration["GoBackend:BaseUrl"] ?? "http://localhost:8080";
        
        var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"{goBackendUrl}/admin/internal/threads/{request.ThreadId}");
        httpRequest.Content = new StringContent(
            System.Text.Json.JsonSerializer.Serialize(new { hardDelete = request.HardDelete, reason = request.Reason }),
            System.Text.Encoding.UTF8,
            "application/json"
        );
        httpRequest.Headers.Add("X-Internal-Api-Key", _configuration["GoBackend:InternalApiKey"]);

        var response = await _httpClient.SendAsync(httpRequest);
        
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Failed to delete thread: {error}");
        }

        // Log admin action
        await LogAdminActionAsync(adminId, null, AdminActionType.ThreadDelete, AdminActionTargetType.Thread, request.ThreadId.ToString(),
            new { hardDelete = request.HardDelete, reason = request.Reason }, null, null);

        _logger.LogWarning("Thread {ThreadId} deleted by admin {AdminId}. HardDelete: {HardDelete}",
            request.ThreadId, adminId, request.HardDelete);
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

internal sealed class GoAdminMoveThreadEnvelope
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("data")]
    public GoAdminMoveThreadData? Data { get; set; }
}

internal sealed class GoAdminMoveThreadData
{
    [JsonPropertyName("thread_id")]
    public uint ThreadId { get; set; }

    [JsonPropertyName("old_owner")]
    public GoAdminMoveThreadUserSnapshot? OldOwner { get; set; }

    [JsonPropertyName("new_owner")]
    public GoAdminMoveThreadUserSnapshot? NewOwner { get; set; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; set; }
}

internal sealed class GoAdminMoveThreadUserSnapshot
{
    [JsonPropertyName("id")]
    public uint Id { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }
}
