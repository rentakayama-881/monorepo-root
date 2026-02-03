using MongoDB.Driver;
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

    Task<(bool success, string? error)> ProcessWithdrawalAsync(
        string withdrawalId,
        uint adminId,
        string adminUsername,
        ProcessWithdrawalRequest request,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);
}

public class SecureWithdrawalService : ISecureWithdrawalService
{
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
    {
        _innerService = innerService;
        _idempotencyService = idempotencyService;
        _auditService = auditService;
        _withdrawals = dbContext.GetCollection<Withdrawal>("withdrawals");
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

        if (lockResult.AlreadyProcessed && lockResult.StoredResultJson != null)
        {
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

            return System.Text.Json.JsonSerializer.Deserialize<CreateWithdrawalResponse>(
                lockResult.StoredResultJson)!;
        }

        if (!lockResult.Acquired)
        {
            return new CreateWithdrawalResponse(
                false, null, null, "Request sudah sedang diproses. Silakan tunggu.");
        }

        try
        {
            // Mask account number for audit
            var maskedAccount = request.AccountNumber.Length > 4
                ? new string('*', request.AccountNumber.Length - 4) + request.AccountNumber[^4..]
                : request.AccountNumber;

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
                    ["bankCode"] = request.BankCode,
                    ["accountNumber"] = maskedAccount,
                    ["accountName"] = request.AccountName,
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
                        ["bankCode"] = request.BankCode,
                        ["accountNumber"] = maskedAccount,
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
                        ["bankCode"] = request.BankCode,
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

        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();
        var username = withdrawal?.Username ?? $"user_{userId}";

        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed && lockResult.StoredResultJson != null)
        {
            var cached = System.Text.Json.JsonSerializer.Deserialize<OperationResult>(
                lockResult.StoredResultJson);
            return (cached?.Success ?? false, cached?.Error);
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

    public async Task<(bool success, string? error)> ProcessWithdrawalAsync(
        string withdrawalId,
        uint adminId,
        string adminUsername,
        ProcessWithdrawalRequest request,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = BuildUserScopedIdempotencyKey("wd_process", adminId, idempotencyKey);

        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();

        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed && lockResult.StoredResultJson != null)
        {
            var cached = System.Text.Json.JsonSerializer.Deserialize<OperationResult>(
                lockResult.StoredResultJson);
            return (cached?.Success ?? false, cached?.Error);
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
                ActorUserId = adminId,
                ActorUsername = adminUsername,
                Details = new Dictionary<string, string>
                {
                    ["action"] = request.Approve ? "APPROVE_INITIATED" : "REJECT_INITIATED",
                    ["userId"] = withdrawal?.UserId.ToString() ?? "0",
                    ["reference"] = withdrawal?.Reference ?? "",
                    ["rejectionReason"] = request.RejectionReason ?? "",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            var (success, error) = await _innerService.ProcessWithdrawalAsync(
                withdrawalId, adminId, adminUsername, request);

            await _idempotencyService.StoreResultAsync(key, new OperationResult(success, error), ResultTtl);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = withdrawalId,
                TransactionType = "WITHDRAWAL",
                EventType = success
                    ? (request.Approve ? AuditEventType.TransactionCompleted : AuditEventType.TransactionCancelled)
                    : AuditEventType.TransactionFailed,
                ActorUserId = adminId,
                ActorUsername = adminUsername,
                Details = new Dictionary<string, string>
                {
                    ["action"] = success
                        ? (request.Approve ? "APPROVED" : "REJECTED")
                        : "PROCESS_FAILED",
                    ["error"] = error ?? "",
                    ["userId"] = withdrawal?.UserId.ToString() ?? "0",
                    ["amount"] = withdrawal?.Amount.ToString() ?? "0",
                    ["reference"] = withdrawal?.Reference ?? "",
                    ["rejectionReason"] = request.RejectionReason ?? "",
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

    private string BuildUserScopedIdempotencyKey(string operation, uint userId, string? providedKey)
    {
        var rawKey = (providedKey ?? _idempotencyService.GenerateKey(operation)).Trim();
        return $"{operation}:{userId}:{rawKey}";
    }
}
