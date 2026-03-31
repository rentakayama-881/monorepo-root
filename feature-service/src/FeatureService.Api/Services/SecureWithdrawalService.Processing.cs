using System.Text.Json;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace FeatureService.Api.Services;

public partial class SecureWithdrawalService
{
    private record OperationResult(bool Success, string? Error);

    private bool TryParseCachedCreateWithdrawalResult(
        string? cachedResultJson,
        string key,
        out CreateWithdrawalResponse cachedResult)
    {
        const string operation = "withdrawal";

        try
        {
            ValidateCreateWithdrawalPayloadOrThrow(cachedResultJson, operation, key);
            cachedResult = DeserializeCachedResultOrThrow<CreateWithdrawalResponse>(
                cachedResultJson,
                operation,
                key);

            if (cachedResult.Success &&
                (string.IsNullOrWhiteSpace(cachedResult.WithdrawalId) ||
                 string.IsNullOrWhiteSpace(cachedResult.Reference)))
            {
                throw BuildInvalidCachedResultException(operation, key);
            }

            return true;
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(
                ex,
                "Blocked duplicate withdrawal request due to invalid cached idempotency result. Key={Key}",
                key);
            cachedResult = new CreateWithdrawalResponse(false, null, null, null);
            return false;
        }
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

    private static void ValidateCreateWithdrawalPayloadOrThrow(
        string? cachedResultJson,
        string operation,
        string key)
    {
        var root = ParseJsonObjectOrThrow(cachedResultJson, operation, key);

        if (!root.TryGetProperty("Success", out var successProperty) ||
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

        if (root.TryGetProperty("WithdrawalId", out var withdrawalIdProperty) &&
            withdrawalIdProperty.ValueKind != JsonValueKind.String &&
            withdrawalIdProperty.ValueKind != JsonValueKind.Null)
        {
            throw BuildInvalidCachedResultException(operation, key);
        }

        if (root.TryGetProperty("Reference", out var referenceProperty) &&
            referenceProperty.ValueKind != JsonValueKind.String &&
            referenceProperty.ValueKind != JsonValueKind.Null)
        {
            throw BuildInvalidCachedResultException(operation, key);
        }
    }

    private static void ValidateOperationResultPayloadOrThrow(
        string? cachedResultJson,
        string operation,
        string key)
    {
        var root = ParseJsonObjectOrThrow(cachedResultJson, operation, key);

        if (!root.TryGetProperty("Success", out var successProperty) ||
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

    private static JsonElement ParseJsonObjectOrThrow(
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
            using var document = JsonDocument.Parse(cachedResultJson);
            var root = document.RootElement.Clone();

            if (root.ValueKind != JsonValueKind.Object)
            {
                throw BuildInvalidCachedResultException(operation, key);
            }

            return root;
        }
        catch (JsonException ex)
        {
            throw BuildInvalidCachedResultException(operation, key, ex);
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

    private async Task<Withdrawal?> FindWithdrawalByIdAsync(string withdrawalId)
    {
        return await _db.Withdrawals.FirstOrDefaultAsync(w => w.Id == withdrawalId);
    }

    private string BuildUserScopedIdempotencyKey(string operation, uint userId, string? providedKey)
    {
        var rawKey = (providedKey ?? _idempotencyService.GenerateKey(operation)).Trim();
        return $"{operation}:{userId}:{rawKey}";
    }
}
