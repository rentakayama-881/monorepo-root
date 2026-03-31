using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.Idempotency;
using FeatureService.Api.Domain.Entities;

namespace FeatureService.Api.Services;

public partial class SecureTransferService
{
    public async Task<(bool success, string? error)> CancelTransferAsync(
        string transferId,
        uint userId,
        string pin,
        string reason,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = BuildUserScopedIdempotencyKey("cancel", userId, idempotencyKey);

        var transfer = await FindTransferByIdAsync(transferId);
        var username = transfer?.SenderUsername ?? $"user_{userId}";

        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed)
        {
            if (TryParseCachedOperationResult(lockResult.StoredResultJson, key, "cancel", out var cached))
            {
                return (cached.Success, cached.Error);
            }

            return (false, InvalidCachedIdempotencyResultMessage);
        }

        if (!lockResult.Acquired)
        {
            return (false, "Request sudah sedang diproses");
        }

        try
        {
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = transferId,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.StatusChange,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = "CANCEL_INITIATED",
                    ["reason"] = reason,
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            var (success, error) = await _innerService.CancelTransferAsync(transferId, userId, pin, reason);

            await _idempotencyService.StoreResultAsync(key, new OperationResult(success, error), ResultTtl);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = transferId,
                TransactionType = "TRANSFER",
                EventType = success ? AuditEventType.TransactionCancelled : AuditEventType.TransactionFailed,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = success ? "CANCELLED" : "CANCEL_FAILED",
                    ["reason"] = reason,
                    ["error"] = error ?? "",
                    ["amount"] = transfer?.Amount.ToString() ?? "0",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            return (success, error);
        }
        catch
        {
            await _idempotencyService.ReleaseAsync(key);
            throw;
        }
    }

    public async Task<(bool success, string? error)> RejectTransferAsync(
        string transferId,
        uint receiverId,
        string pin,
        string reason,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = BuildUserScopedIdempotencyKey("reject", receiverId, idempotencyKey);

        var transfer = await FindTransferByIdAsync(transferId);
        var username = transfer?.ReceiverUsername ?? $"user_{receiverId}";

        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed)
        {
            if (TryParseCachedOperationResult(lockResult.StoredResultJson, key, "reject", out var cached))
            {
                return (cached.Success, cached.Error);
            }

            return (false, InvalidCachedIdempotencyResultMessage);
        }

        if (!lockResult.Acquired)
        {
            return (false, "Request sudah sedang diproses");
        }

        try
        {
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = transferId,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.StatusChange,
                ActorUserId = receiverId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = "REJECT_INITIATED",
                    ["reason"] = reason,
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            var (success, error) = await _innerService.RejectTransferAsync(transferId, receiverId, pin, reason);

            await _idempotencyService.StoreResultAsync(key, new OperationResult(success, error), ResultTtl);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = transferId,
                TransactionType = "TRANSFER",
                EventType = success ? AuditEventType.TransactionCancelled : AuditEventType.TransactionFailed,
                ActorUserId = receiverId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = success ? "REJECTED" : "REJECT_FAILED",
                    ["reason"] = reason,
                    ["error"] = error ?? "",
                    ["amount"] = transfer?.Amount.ToString() ?? "0",
                    ["senderId"] = transfer?.SenderId.ToString() ?? "0",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            return (success, error);
        }
        catch
        {
            await _idempotencyService.ReleaseAsync(key);
            throw;
        }
    }

    private record OperationResult(bool Success, string? Error);

    private CreateTransferResponse ParseCachedCreateTransferResult(string? cachedResultJson, string key)
    {
        const string operation = "transfer";
        var result = DeserializeCachedResultOrThrow<CreateTransferResponse>(cachedResultJson, operation, key);

        if (string.IsNullOrWhiteSpace(result.TransferId) ||
            string.IsNullOrWhiteSpace(result.Code) ||
            string.IsNullOrWhiteSpace(result.ReceiverUsername) ||
            result.Amount <= 0)
        {
            throw BuildInvalidCachedResultException(operation, key);
        }

        return result;
    }

    private bool TryParseCachedOperationResult(
        string? cachedResultJson,
        string key,
        string operation,
        out OperationResult cachedResult)
    {
        try
        {
            ValidateOperationResultPayloadOrThrow(cachedResultJson, operation, key);
            cachedResult = DeserializeCachedResultOrThrow<OperationResult>(cachedResultJson, operation, key);
            return true;
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(
                ex,
                "Blocked duplicate {Operation} request due to invalid cached idempotency result. Key={Key}",
                operation,
                key);
            cachedResult = new OperationResult(false, null);
            return false;
        }
    }

    private static void ValidateOperationResultPayloadOrThrow(
        string? cachedResultJson,
        string operation,
        string key)
    {
        if (string.IsNullOrWhiteSpace(cachedResultJson))
        {
            throw BuildInvalidCachedResultException(operation, key);
        }

        JsonElement root;
        try
        {
            using var document = JsonDocument.Parse(cachedResultJson);
            root = document.RootElement.Clone();
        }
        catch (JsonException ex)
        {
            throw BuildInvalidCachedResultException(operation, key, ex);
        }

        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("Success", out var successProperty) ||
            (successProperty.ValueKind != JsonValueKind.True &&
             successProperty.ValueKind != JsonValueKind.False))
        {
            throw BuildInvalidCachedResultException(operation, key);
        }

        if (root.TryGetProperty("Error", out var errorProperty) &&
            errorProperty.ValueKind != JsonValueKind.String &&
            errorProperty.ValueKind != JsonValueKind.Null)
        {
            throw BuildInvalidCachedResultException(operation, key);
        }
    }

    private static T DeserializeCachedResultOrThrow<T>(
        string? cachedResultJson,
        string operation,
        string key)
    {
        if (string.IsNullOrWhiteSpace(cachedResultJson))
        {
            throw BuildInvalidCachedResultException(operation, key);
        }

        try
        {
            var result = JsonSerializer.Deserialize<T>(cachedResultJson);
            return result ?? throw BuildInvalidCachedResultException(operation, key);
        }
        catch (JsonException ex)
        {
            throw BuildInvalidCachedResultException(operation, key, ex);
        }
    }

    private static InvalidOperationException BuildInvalidCachedResultException(
        string operation,
        string key,
        Exception? innerException = null)
    {
        var message = InvalidCachedIdempotencyResultMessage;
        var exception = innerException is null
            ? new InvalidOperationException(message)
            : new InvalidOperationException(message, innerException);

        exception.Data["operation"] = operation;
        exception.Data["idempotencyKey"] = key;
        return exception;
    }

    private async Task<Transfer?> FindTransferByIdAsync(string transferId)
    {
        return await _db.Transfers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == transferId);
    }

    private string BuildUserScopedIdempotencyKey(string operation, uint userId, string? providedKey)
    {
        var rawKey = (providedKey ?? _idempotencyService.GenerateKey(operation)).Trim();
        return $"{operation}:{userId}:{rawKey}";
    }
}
