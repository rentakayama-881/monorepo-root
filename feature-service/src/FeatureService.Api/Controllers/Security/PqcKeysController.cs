using System.Security.Cryptography;
using FeatureService.Api.Domain.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.PQC;
using FeatureService.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace FeatureService.Api.Controllers.Security;

/// <summary>
/// Controller untuk manajemen PQC (Post-Quantum Cryptography) keys
/// </summary>
[ApiController]
[Route("api/v1/users/{userId}/pqc-keys")]
[Authorize]
public class PqcKeysController : ApiControllerBase
{
    private readonly MongoDbContext _dbContext;
    private readonly IPostQuantumCryptoService _pqcService;
    private readonly IAuditTrailService _auditService;
    private readonly ILogger<PqcKeysController> _logger;

    public PqcKeysController(
        MongoDbContext dbContext,
        IPostQuantumCryptoService pqcService,
        IAuditTrailService auditService,
        ILogger<PqcKeysController> logger)
    {
        _dbContext = dbContext;
        _pqcService = pqcService;
        _auditService = auditService;
        _logger = logger;
    }

    /// <summary>
    /// Register PQC public key untuk user
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="request">Public key data</param>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<PqcKeyResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RegisterKey(uint userId, [FromBody] RegisterPqcKeyRequest request)
    {
        // Verify user can only register their own key
        if (userId != GetUserId())
        {
            return ApiError(403, "FORBIDDEN", "You can only register keys for your own account");
        }

        // Require 2FA for key registration
        var twoFaCheck = RequiresTwoFactorAuth();
        if (twoFaCheck != null) return twoFaCheck;

        // Validate public key format
        byte[] publicKeyBytes;
        try
        {
            publicKeyBytes = Convert.FromBase64String(request.PublicKeyBase64);
        }
        catch (FormatException)
        {
            return ApiBadRequest("INVALID_KEY_FORMAT", "Public key must be valid Base64");
        }

        // Check minimum size for Dilithium3 public key (~1952 bytes)
        if (publicKeyBytes.Length < 1900)
        {
            return ApiBadRequest("INVALID_KEY_SIZE", "Public key size is too small for Dilithium3");
        }

        // Check if user already has an active key
        var existingKey = await _dbContext.UserPqcKeys
            .Find(k => k.UserId == userId && k.IsActive)
            .FirstOrDefaultAsync();

        if (existingKey != null)
        {
            return ApiBadRequest("KEY_EXISTS",
                "You already have an active PQC key. Revoke it first before registering a new one.");
        }

        // Generate key ID from public key hash
        var keyId = GenerateKeyId(publicKeyBytes);
        var publicKeyHash = Convert.ToHexString(SHA256.HashData(publicKeyBytes));

        var pqcKey = new UserPqcKey
        {
            Id = $"pqckey_{NUlid.Ulid.NewUlid()}",
            UserId = userId,
            Username = GetUsername(),
            KeyId = keyId,
            PublicKeyBase64 = request.PublicKeyBase64,
            Algorithm = "Dilithium3",
            PublicKeyHash = publicKeyHash,
            DeviceFingerprint = request.DeviceFingerprint,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UsageCount = 0
        };

        await _dbContext.UserPqcKeys.InsertOneAsync(pqcKey);

        // Record audit event
        await _auditService.RecordEventAsync(new AuditEventRequest
        {
            TransactionId = pqcKey.Id,
            TransactionType = "PQC_KEY",
            EventType = AuditEventType.PqcKeyRegistered,
            ActorUserId = userId,
            ActorUsername = GetUsername(),
            Details = new Dictionary<string, string>
            {
                ["keyId"] = keyId,
                ["algorithm"] = "Dilithium3",
                ["publicKeyHash"] = publicKeyHash[..32]
            },
            IpAddress = GetClientIpAddress(),
            UserAgent = Request.Headers.UserAgent.ToString()
        });

        _logger.LogInformation(
            "PQC key registered. UserId: {UserId}, KeyId: {KeyId}",
            userId, keyId);

        var response = MapToResponse(pqcKey);
        return ApiCreated(response, "PQC key registered successfully");
    }

    /// <summary>
    /// Get active PQC key untuk user
    /// </summary>
    /// <param name="userId">User ID</param>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PqcKeyResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetKey(uint userId)
    {
        // Users can only see their own key, admins can see any
        if (userId != GetUserId() && !IsAdmin())
        {
            return ApiError(403, "FORBIDDEN", "You can only view your own PQC key");
        }

        var key = await _dbContext.UserPqcKeys
            .Find(k => k.UserId == userId && k.IsActive)
            .FirstOrDefaultAsync();

        if (key == null)
        {
            return ApiNotFound("KEY_NOT_FOUND", "No active PQC key found for this user");
        }

        return ApiOk(MapToResponse(key));
    }

    /// <summary>
    /// Revoke PQC key untuk user
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="request">Revoke request dengan alasan</param>
    [HttpDelete]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeKey(uint userId, [FromBody] RevokePqcKeyRequest request)
    {
        // Verify user can only revoke their own key
        if (userId != GetUserId() && !IsAdmin())
        {
            return ApiError(403, "FORBIDDEN", "You can only revoke your own PQC key");
        }

        // Require 2FA for key revocation
        var twoFaCheck = RequiresTwoFactorAuth();
        if (twoFaCheck != null) return twoFaCheck;

        var key = await _dbContext.UserPqcKeys
            .Find(k => k.UserId == userId && k.IsActive)
            .FirstOrDefaultAsync();

        if (key == null)
        {
            return ApiNotFound("KEY_NOT_FOUND", "No active PQC key found for this user");
        }

        // Update key status
        var update = Builders<UserPqcKey>.Update
            .Set(k => k.IsActive, false)
            .Set(k => k.RevokedAt, DateTime.UtcNow)
            .Set(k => k.RevokeReason, request.Reason);

        await _dbContext.UserPqcKeys.UpdateOneAsync(k => k.Id == key.Id, update);

        // Record audit event
        await _auditService.RecordEventAsync(new AuditEventRequest
        {
            TransactionId = key.Id,
            TransactionType = "PQC_KEY",
            EventType = AuditEventType.PqcKeyRevoked,
            ActorUserId = GetUserId(),
            ActorUsername = GetUsername(),
            Details = new Dictionary<string, string>
            {
                ["keyId"] = key.KeyId,
                ["reason"] = request.Reason,
                ["revokedBy"] = IsAdmin() ? "admin" : "owner"
            },
            IpAddress = GetClientIpAddress(),
            UserAgent = Request.Headers.UserAgent.ToString()
        });

        _logger.LogInformation(
            "PQC key revoked. UserId: {UserId}, KeyId: {KeyId}, Reason: {Reason}",
            userId, key.KeyId, request.Reason);

        return ApiOk(new { revoked = true, keyId = key.KeyId }, "PQC key revoked successfully");
    }

    /// <summary>
    /// Generate key pair untuk development/testing
    /// HANYA UNTUK DEVELOPMENT - Private key tidak boleh di-generate di server untuk production!
    /// </summary>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ApiResponse<GenerateKeyPairResponse>), StatusCodes.Status200OK)]
    public IActionResult GenerateKeyPair()
    {
        #if DEBUG
        var keyPair = _pqcService.GenerateKeyPair();

        var response = new GenerateKeyPairResponse
        {
            PublicKeyBase64 = Convert.ToBase64String(keyPair.PublicKey),
            PrivateKeyBase64 = Convert.ToBase64String(keyPair.PrivateKey),
            Algorithm = keyPair.Algorithm,
            KeyId = keyPair.KeyId,
            GeneratedAt = keyPair.GeneratedAt
        };

        _logger.LogWarning(
            "PQC key pair generated via API. KeyId: {KeyId}. This should only be used for development!",
            keyPair.KeyId);

        return ApiOk(response, "Key pair generated. Store the private key securely on your device!");
        #else
        return ApiError(403, "NOT_AVAILABLE",
            "Key generation is not available in production. Generate keys on your device.");
        #endif
    }

    private static string GenerateKeyId(byte[] publicKey)
    {
        var hash = SHA256.HashData(publicKey);
        return $"pqc_{Convert.ToHexString(hash[..8]).ToLowerInvariant()}";
    }

    private static PqcKeyResponse MapToResponse(UserPqcKey key)
    {
        return new PqcKeyResponse
        {
            KeyId = key.KeyId,
            UserId = key.UserId,
            Username = key.Username,
            Algorithm = key.Algorithm,
            PublicKeyBase64 = key.PublicKeyBase64,
            IsActive = key.IsActive,
            CreatedAt = key.CreatedAt,
            RevokedAt = key.RevokedAt,
            UsageCount = key.UsageCount,
            LastUsedAt = key.LastUsedAt
        };
    }

    private string? GetClientIpAddress()
    {
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
