using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MongoDB.Driver;
using MongoDB.Bson;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class AdminModerationService
{
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
