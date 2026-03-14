using MongoDB.Driver;
using System.Text.Json;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.Idempotency;
using FeatureService.Api.Domain.Entities;

namespace FeatureService.Api.Services;

/// <summary>
/// Enhanced secure withdrawal service dengan idempotency dan audit trail.
/// Menggunakan Redis Sentinel untuk idempotency dan MongoDB untuk immutable audit log.
/// </summary>
public interface ISecureWithdrawalService
{
    Task<CreateWithdrawalResponse> CreateWithdrawalAsync(
        uint userId,
        string username,
        CreateWithdrawalRequest request,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);

    Task<(bool success, string? error)> CancelWithdrawalAsync(
        string withdrawalId,
        uint userId,
        string pin,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);
}

public partial class SecureWithdrawalService : ISecureWithdrawalService
{
    private const string InvalidCachedIdempotencyResultMessage =
        "Data idempotency tidak valid. Permintaan diblokir untuk mencegah duplikasi transaksi.";

    private readonly IWithdrawalService _innerService;
    private readonly IIdempotencyService _idempotencyService;
    private readonly IAuditTrailService _auditService;
    private readonly IMongoCollection<Withdrawal> _withdrawals;
    private readonly ILogger<SecureWithdrawalService> _logger;
    private readonly IConfiguration _configuration;

    private TimeSpan LockDuration => TimeSpan.FromSeconds(
        _configuration.GetValue<int>("Security:IdempotencyLockDurationSeconds", 30));

    private TimeSpan ResultTtl => TimeSpan.FromHours(
        _configuration.GetValue<int>("Security:IdempotencyResultTtlHours", 24));

    public SecureWithdrawalService(
        IWithdrawalService innerService,
        IIdempotencyService idempotencyService,
        IAuditTrailService auditService,
        MongoDbContext dbContext,
        IConfiguration configuration,
        ILogger<SecureWithdrawalService> logger)
        : this(
            innerService,
            idempotencyService,
            auditService,
            dbContext.GetCollection<Withdrawal>("withdrawals"),
            configuration,
            logger)
    {
    }

    internal SecureWithdrawalService(
        IWithdrawalService innerService,
        IIdempotencyService idempotencyService,
        IAuditTrailService auditService,
        IMongoCollection<Withdrawal> withdrawals,
        IConfiguration configuration,
        ILogger<SecureWithdrawalService> logger)
    {
        _innerService = innerService;
        _idempotencyService = idempotencyService;
        _auditService = auditService;
        _withdrawals = withdrawals;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<CreateWithdrawalResponse> CreateWithdrawalAsync(
        uint userId,
        string username,
        CreateWithdrawalRequest request,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = BuildUserScopedIdempotencyKey("withdrawal", userId, idempotencyKey);

        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed)
        {
            if (!TryParseCachedCreateWithdrawalResult(lockResult.StoredResultJson, key, out var cachedResult))
            {
                return new CreateWithdrawalResponse(
                    false,
                    null,
                    null,
                    InvalidCachedIdempotencyResultMessage);
            }

            _logger.LogInformation("Returning cached withdrawal result for key {Key}", key);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = key,
                TransactionType = "WITHDRAWAL",
                EventType = AuditEventType.SecurityCheck,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = "DUPLICATE_REQUEST_BLOCKED",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            return cachedResult;
        }

        if (!lockResult.Acquired)
        {
            return new CreateWithdrawalResponse(
                false, null, null, "Request sudah sedang diproses. Silakan tunggu.");
        }

        try
        {
            // Mask crypto address for audit
            var maskedAddress = request.CryptoAddress.Length > 8
                ? request.CryptoAddress[..4] + "***" + request.CryptoAddress[^4..]
                : request.CryptoAddress;

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = key,
                TransactionType = "WITHDRAWAL",
                EventType = AuditEventType.TransactionInitiated,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["amount"] = request.Amount.ToString(),
                    ["cryptoCurrency"] = request.CryptoCurrency,
                    ["cryptoAddress"] = maskedAddress,
                    ["network"] = request.Network ?? "",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            var result = await _innerService.CreateWithdrawalAsync(userId, username, request);

            await _idempotencyService.StoreResultAsync(key, result, ResultTtl);

            if (result.Success)
            {
                await _auditService.RecordEventAsync(new AuditEventRequest
                {
                    TransactionId = result.WithdrawalId ?? key,
                    TransactionType = "WITHDRAWAL",
                    EventType = AuditEventType.TransactionCreated,
                    ActorUserId = userId,
                    ActorUsername = username,
                    Details = new Dictionary<string, string>
                    {
                        ["reference"] = result.Reference ?? "",
                        ["amount"] = request.Amount.ToString(),
                        ["cryptoCurrency"] = request.CryptoCurrency,
                        ["cryptoAddress"] = maskedAddress,
                        ["idempotencyKey"] = key
                    },
                    IpAddress = ipAddress,
                    UserAgent = userAgent
                });
            }
            else
            {
                await _auditService.RecordEventAsync(new AuditEventRequest
                {
                    TransactionId = key,
                    TransactionType = "WITHDRAWAL",
                    EventType = AuditEventType.TransactionFailed,
                    ActorUserId = userId,
                    ActorUsername = username,
                    Details = new Dictionary<string, string>
                    {
                        ["error"] = result.Error ?? "Unknown error",
                        ["amount"] = request.Amount.ToString(),
                        ["cryptoCurrency"] = request.CryptoCurrency,
                        ["idempotencyKey"] = key
                    },
                    IpAddress = ipAddress,
                    UserAgent = userAgent
                });
            }

            return result;
        }
        catch
        {
            await _idempotencyService.ReleaseAsync(key);
            throw;
        }
    }

    public async Task<(bool success, string? error)> CancelWithdrawalAsync(
        string withdrawalId,
        uint userId,
        string pin,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = BuildUserScopedIdempotencyKey("wd_cancel", userId, idempotencyKey);

        var withdrawal = await FindWithdrawalByIdAsync(withdrawalId);
        var username = withdrawal?.Username ?? $"user_{userId}";

        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed)
        {
            if (TryParseCachedOperationResult(lockResult.StoredResultJson, key, "wd_cancel", out var cached))
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
                TransactionId = withdrawalId,
                TransactionType = "WITHDRAWAL",
                EventType = AuditEventType.StatusChange,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = "CANCEL_INITIATED",
                    ["reference"] = withdrawal?.Reference ?? "",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            var (success, error) = await _innerService.CancelWithdrawalAsync(withdrawalId, userId, pin);

            await _idempotencyService.StoreResultAsync(key, new OperationResult(success, error), ResultTtl);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = withdrawalId,
                TransactionType = "WITHDRAWAL",
                EventType = success ? AuditEventType.TransactionCancelled : AuditEventType.TransactionFailed,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = success ? "CANCELLED" : "CANCEL_FAILED",
                    ["error"] = error ?? "",
                    ["amount"] = withdrawal?.Amount.ToString() ?? "0",
                    ["reference"] = withdrawal?.Reference ?? "",
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

}
