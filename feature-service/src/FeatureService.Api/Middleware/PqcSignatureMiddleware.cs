using System.Security.Claims;
using System.Globalization;
using System.Text;
using FeatureService.Api.Attributes;
using FeatureService.Api.Domain.Entities;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.PQC;
using FeatureService.Api.Models.Entities;
using Microsoft.AspNetCore.Mvc.Controllers;
using MongoDB.Driver;

namespace FeatureService.Api.Middleware;

/// <summary>
/// Middleware untuk validasi PQC digital signature pada request.
/// Memeriksa header X-PQC-Signature dan X-PQC-Key-Id untuk endpoint yang ditandai dengan [RequiresPqcSignature].
/// </summary>
public class PqcSignatureMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<PqcSignatureMiddleware> _logger;

    private const string SignatureHeader = "X-PQC-Signature";
    private const string KeyIdHeader = "X-PQC-Key-Id";
    private const string TimestampHeader = "X-PQC-Timestamp";
    private const string IdempotencyKeyHeader = "X-Idempotency-Key";

    public PqcSignatureMiddleware(
        RequestDelegate next,
        ILogger<PqcSignatureMiddleware> logger)
    {
        _next = next;
        _logger = logger;
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

        // Validate PQC signature
        var validationResult = await ValidateSignatureAsync(
            context, pqcService, dbContext, attribute);

        if (!validationResult.IsValid)
        {
            // Record failed signature attempt
            await RecordSignatureFailureAsync(context, auditService, validationResult.ErrorMessage ?? "Unknown error");

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";

            var errorResponse = new
            {
                success = false,
                error = new
                {
                    code = "PQC_SIGNATURE_INVALID",
                    message = validationResult.ErrorMessage ?? "Signature validation failed"
                },
                meta = new
                {
                    requestId = context.Items["RequestId"]?.ToString() ?? Guid.NewGuid().ToString(),
                    timestamp = DateTime.UtcNow
                }
            };

            await context.Response.WriteAsJsonAsync(errorResponse);
            return;
        }

        // Store validated key info in context for use by controllers
        context.Items["PqcKeyId"] = validationResult.KeyId;
        context.Items["PqcKeyUserId"] = validationResult.UserId;

        // Update key usage stats
        await UpdateKeyUsageAsync(dbContext, validationResult.KeyId!);

        await _next(context);
    }

    private async Task<SignatureValidationResult> ValidateSignatureAsync(
        HttpContext context,
        IPostQuantumCryptoService pqcService,
        MongoDbContext dbContext,
        RequiresPqcSignatureAttribute attribute)
    {
        // Get required headers
        if (!context.Request.Headers.TryGetValue(SignatureHeader, out var signatureHeader) ||
            string.IsNullOrEmpty(signatureHeader))
        {
            return SignatureValidationResult.Failure("Missing X-PQC-Signature header");
        }

        if (!context.Request.Headers.TryGetValue(KeyIdHeader, out var keyIdHeader) ||
            string.IsNullOrEmpty(keyIdHeader))
        {
            return SignatureValidationResult.Failure("Missing X-PQC-Key-Id header");
        }

        // Validate timestamp if required
        if (attribute.ValidateTimestamp)
        {
            if (!context.Request.Headers.TryGetValue(TimestampHeader, out var timestampHeader) ||
                string.IsNullOrEmpty(timestampHeader))
            {
                return SignatureValidationResult.Failure("Missing X-PQC-Timestamp header");
            }

            var timestampRaw = timestampHeader.ToString();
            if (!IsUtcIso8601Timestamp(timestampRaw))
            {
                return SignatureValidationResult.Failure(
                    "Invalid X-PQC-Timestamp format. Must be ISO 8601 UTC using suffix 'Z' or '+00:00'.");
            }

            if (!DateTimeOffset.TryParse(
                    timestampRaw,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var timestamp))
            {
                return SignatureValidationResult.Failure("Invalid X-PQC-Timestamp value");
            }

            var age = DateTimeOffset.UtcNow - timestamp;
            if (age.TotalSeconds > attribute.MaxTimestampAgeSeconds || age.TotalSeconds < -60)
            {
                return SignatureValidationResult.Failure(
                    $"Request timestamp is too old or in the future. Max age: {attribute.MaxTimestampAgeSeconds}s");
            }
        }

        // Validate idempotency key if required (important for replay resistance)
        if (attribute.RequireIdempotencyKey)
        {
            var idempotencyKey = context.Request.Headers[IdempotencyKeyHeader].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                return SignatureValidationResult.Failure("Missing X-Idempotency-Key header");
            }

            if (!IsValidIdempotencyKey(idempotencyKey))
            {
                return SignatureValidationResult.Failure(
                    "Invalid X-Idempotency-Key format. Use 8-128 chars of A-Z a-z 0-9 - _ :");
            }
        }

        // Get user ID from JWT
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User.FindFirst("user_id")?.Value;

        if (!uint.TryParse(userIdClaim, out var userId))
        {
            return SignatureValidationResult.Failure("User not authenticated");
        }

        // Get user's PQC key
        var keyId = keyIdHeader.ToString();
        var pqcKey = await dbContext.UserPqcKeys
            .Find(k => k.KeyId == keyId && k.UserId == userId && k.IsActive)
            .FirstOrDefaultAsync();

        if (pqcKey == null)
        {
            return SignatureValidationResult.Failure(
                "PQC key not found or inactive. Please register a valid key.");
        }

        // Parse signature
        byte[] signatureBytes;
        try
        {
            signatureBytes = Convert.FromBase64String(signatureHeader.ToString());
        }
        catch (FormatException)
        {
            return SignatureValidationResult.Failure("Invalid signature format. Must be Base64.");
        }

        // Build data to verify
        var dataToVerify = await BuildSignedDataAsync(context, attribute);

        // Get public key
        byte[] publicKey;
        try
        {
            publicKey = Convert.FromBase64String(pqcKey.PublicKeyBase64);
        }
        catch (FormatException)
        {
            return SignatureValidationResult.Failure("Invalid public key stored for user");
        }

        // Verify signature
        var isValid = pqcService.Verify(dataToVerify, signatureBytes, publicKey);

        if (!isValid)
        {
            _logger.LogWarning(
                "PQC signature verification failed. UserId: {UserId}, KeyId: {KeyId}",
                userId, keyId);

            return SignatureValidationResult.Failure("Signature verification failed");
        }

        _logger.LogDebug(
            "PQC signature verified successfully. UserId: {UserId}, KeyId: {KeyId}",
            userId, keyId);

        return SignatureValidationResult.Success(keyId, userId);
    }

    private async Task<byte[]> BuildSignedDataAsync(
        HttpContext context,
        RequiresPqcSignatureAttribute attribute)
    {
        var builder = new StringBuilder();

        // Include method and path
        builder.Append(context.Request.Method);
        builder.Append(context.Request.Path);

        // Include query string if present
        if (context.Request.QueryString.HasValue)
        {
            builder.Append(context.Request.QueryString.Value);
        }

        // Include timestamp header
        if (context.Request.Headers.TryGetValue(TimestampHeader, out var timestamp))
        {
            builder.Append(timestamp.FirstOrDefault());
        }

        // Include idempotency key if present
        if (context.Request.Headers.TryGetValue(IdempotencyKeyHeader, out var idempotencyKey))
        {
            builder.Append(idempotencyKey.FirstOrDefault());
        }

        // Include body if required
        if (attribute.IncludeBody && context.Request.ContentLength > 0)
        {
            context.Request.EnableBuffering();
            context.Request.Body.Position = 0;

            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            builder.Append(body);

            context.Request.Body.Position = 0;
        }

        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private static bool IsUtcIso8601Timestamp(string timestamp)
    {
        if (string.IsNullOrWhiteSpace(timestamp))
        {
            return false;
        }

        // Enforce canonical UTC suffix to avoid ambiguous timestamps across clients.
        return timestamp.EndsWith("Z", StringComparison.OrdinalIgnoreCase)
            || timestamp.EndsWith("+00:00", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsValidIdempotencyKey(string idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            return false;
        }

        // Keep Redis and logs safe; also enforces minimum entropy for replay protection.
        if (idempotencyKey.Length is < 8 or > 128)
        {
            return false;
        }

        foreach (var c in idempotencyKey)
        {
            if (char.IsLetterOrDigit(c) || c is '-' or '_' or ':')
            {
                continue;
            }

            return false;
        }

        return true;
    }

    private async Task UpdateKeyUsageAsync(MongoDbContext dbContext, string keyId)
    {
        var update = Builders<UserPqcKey>.Update
            .Inc(k => k.UsageCount, 1)
            .Set(k => k.LastUsedAt, DateTime.UtcNow);

        await dbContext.UserPqcKeys.UpdateOneAsync(k => k.KeyId == keyId, update);
    }

    private async Task RecordSignatureFailureAsync(
        HttpContext context,
        IAuditTrailService auditService,
        string errorMessage)
    {
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User.FindFirst("user_id")?.Value;
        var userId = uint.TryParse(userIdClaim, out var id) ? id : 0u;
        var username = context.User.FindFirst(ClaimTypes.Name)?.Value ?? "unknown";

        try
        {
            await auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = $"sig_fail_{NUlid.Ulid.NewUlid()}",
                TransactionType = "SECURITY",
                EventType = AuditEventType.SignatureFailed,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["error"] = errorMessage,
                    ["path"] = context.Request.Path,
                    ["method"] = context.Request.Method
                },
                IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                UserAgent = context.Request.Headers.UserAgent.ToString()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record signature failure audit event");
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
