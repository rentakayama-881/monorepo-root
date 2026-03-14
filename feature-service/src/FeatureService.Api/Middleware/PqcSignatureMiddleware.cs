using System.Security.Claims;
using System.Globalization;
using System.Text;
using FeatureService.Api.Attributes;
using FeatureService.Api.Domain.Entities;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.PQC;
using FeatureService.Api.Infrastructure.Security;
using FeatureService.Api.Models.Entities;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Caching.Memory;
using MongoDB.Driver;

namespace FeatureService.Api.Middleware;

/// <summary>
/// Middleware untuk validasi PQC digital signature pada request.
/// Memeriksa header X-PQC-Signature dan X-PQC-Key-Id untuk endpoint yang ditandai dengan [RequiresPqcSignature].
/// </summary>
public partial class PqcSignatureMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<PqcSignatureMiddleware> _logger;
    private readonly IMemoryCache _pqcKeyCache;

    private const string SignatureHeader = "X-PQC-Signature";
    private const string KeyIdHeader = "X-PQC-Key-Id";
    private const string TimestampHeader = "X-PQC-Timestamp";
    private const string IdempotencyKeyHeader = "X-Idempotency-Key";
    private static readonly TimeSpan PqcKeyCacheTTL = TimeSpan.FromMinutes(5);

    public PqcSignatureMiddleware(
        RequestDelegate next,
        ILogger<PqcSignatureMiddleware> logger,
        IMemoryCache memoryCache)
    {
        _next = next;
        _logger = logger;
        _pqcKeyCache = memoryCache;
    }

    public async Task InvokeAsync(
        HttpContext context,
        IPostQuantumCryptoService pqcService,
        MongoDbContext dbContext,
        IAuditTrailService auditService)
    {
        // Check if endpoint requires PQC signature
        var endpoint = context.GetEndpoint();
        var attribute = endpoint?.Metadata.GetMetadata<RequiresPqcSignatureAttribute>();

        if (attribute == null)
        {
            // No PQC requirement, continue
            await _next(context);
            return;
        }

        // Determine if the current user has an active PQC key.
        // If the user has no PQC key registered yet, we allow a backward-compatible path:
        // - Still enforce X-Idempotency-Key when required by the endpoint
        // - Skip PQC signature verification (since the client cannot produce it)
        var userId = TryGetUserId(context);
        if (userId == 0)
        {
            await RejectAsync(context, auditService, "User not authenticated");
            return;
        }

        var hasActivePqcKey = await HasActivePqcKeyAsync(dbContext, userId);
        if (!hasActivePqcKey)
        {
            if (attribute.RequireIdempotencyKey)
            {
                var idempotencyKey = context.Request.Headers[IdempotencyKeyHeader].FirstOrDefault();
                if (string.IsNullOrWhiteSpace(idempotencyKey))
                {
                    await RejectAsync(context, auditService, "Missing X-Idempotency-Key header");
                    return;
                }

                if (!IsValidIdempotencyKey(idempotencyKey))
                {
                    await RejectAsync(
                        context,
                        auditService,
                        "Invalid X-Idempotency-Key format. Use 8-128 chars of A-Z a-z 0-9 - _ :");
                    return;
                }
            }

            await _next(context);
            return;
        }

        // Validate PQC signature (enforced only when the user has an active PQC key)
        var validationResult = await ValidateSignatureAsync(context, pqcService, dbContext, attribute);

        if (!validationResult.IsValid)
        {
            await RejectAsync(context, auditService, validationResult.ErrorMessage ?? "Unknown error");
            return;
        }

        // Store validated key info in context for use by controllers
        context.Items["PqcKeyId"] = validationResult.KeyId;
        context.Items["PqcKeyUserId"] = validationResult.UserId;

        // Update key usage stats
        await UpdateKeyUsageAsync(dbContext, validationResult.KeyId!);

        await _next(context);
    }

    private async Task RejectAsync(HttpContext context, IAuditTrailService auditService, string message)
    {
        // Record failed signature attempt
        await RecordSignatureFailureAsync(context, auditService, message);

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";

        var errorResponse = new
        {
            success = false,
            error = new
            {
                code = "PQC_SIGNATURE_INVALID",
                message
            },
            meta = new
            {
                requestId = context.Items["RequestId"]?.ToString() ?? Guid.NewGuid().ToString(),
                timestamp = DateTime.UtcNow
            }
        };

        await context.Response.WriteAsJsonAsync(errorResponse);
    }

    private static uint TryGetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var userId) ? userId : 0u;
    }

    private async Task<bool> HasActivePqcKeyAsync(MongoDbContext dbContext, uint userId)
    {
        var cacheKey = PqcCacheKeys.UserHasActivePqcKey(userId);

        if (_pqcKeyCache.TryGetValue(cacheKey, out bool cachedResult))
        {
            return cachedResult;
        }

        try
        {
            var keyId = await dbContext.UserPqcKeys
                .Find(k => k.UserId == userId && k.IsActive)
                .Project(k => k.KeyId)
                .FirstOrDefaultAsync();

            var hasKey = !string.IsNullOrWhiteSpace(keyId);
            if (hasKey)
            {
                _pqcKeyCache.Set(cacheKey, true, PqcKeyCacheTTL);
            }
            return hasKey;
        }
        catch (Exception ex)
        {
            // Fail closed: if we cannot determine key existence, require PQC enforcement.
            _logger.LogError(ex, "Failed to check active PQC key existence for user {UserId}", userId);
            return true;
        }
    }

    private record SignatureValidationResult(
        bool IsValid,
        string? KeyId,
        uint UserId,
        string? ErrorMessage)
    {
        public static SignatureValidationResult Success(string keyId, uint userId) =>
            new(true, keyId, userId, null);

        public static SignatureValidationResult Failure(string errorMessage) =>
            new(false, null, 0, errorMessage);
    }
}
