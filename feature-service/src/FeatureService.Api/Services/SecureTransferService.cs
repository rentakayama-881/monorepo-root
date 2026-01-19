using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.Idempotency;
using FeatureService.Api.Domain.Entities;

namespace FeatureService.Api.Services;

/// <summary>
/// Enhanced secure transfer service dengan idempotency dan audit trail.
/// Menggunakan Redis Sentinel untuk idempotency dan MongoDB untuk immutable audit log.
/// </summary>
public interface ISecureTransferService
{
    Task<CreateTransferResponse> CreateTransferAsync(
        uint senderId,
        CreateTransferRequest request,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);

    Task<(bool success, string? error)> ReleaseTransferAsync(
        string transferId,
        uint userId,
        string pin,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);

    Task<(bool success, string? error)> CancelTransferAsync(
        string transferId,
        uint userId,
        string pin,
        string reason,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);

    Task<(bool success, string? error)> RejectTransferAsync(
        string transferId,
        uint receiverId,
        string pin,
        string reason,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null);
}

public class SecureTransferService : ISecureTransferService
{
    private readonly ITransferService _innerService;
    private readonly IIdempotencyService _idempotencyService;
    private readonly IAuditTrailService _auditService;
    private readonly IMongoCollection<Transfer> _transfers;
    private readonly ILogger<SecureTransferService> _logger;
    private readonly IConfiguration _configuration;

    private TimeSpan LockDuration => TimeSpan.FromSeconds(
        _configuration.GetValue<int>("Security:IdempotencyLockDurationSeconds", 30));

    private TimeSpan ResultTtl => TimeSpan.FromHours(
        _configuration.GetValue<int>("Security:IdempotencyResultTtlHours", 24));

    public SecureTransferService(
        ITransferService innerService,
        IIdempotencyService idempotencyService,
        IAuditTrailService auditService,
        MongoDbContext dbContext,
        IConfiguration configuration,
        ILogger<SecureTransferService> logger)
    {
        _innerService = innerService;
        _idempotencyService = idempotencyService;
        _auditService = auditService;
        _transfers = dbContext.GetCollection<Transfer>("transfers");
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<CreateTransferResponse> CreateTransferAsync(
        uint senderId,
        CreateTransferRequest request,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = idempotencyKey ?? _idempotencyService.GenerateKey("transfer");
        var senderUsername = $"user_{senderId}";

        // Try to acquire idempotency lock
        var lockResult = await _idempotencyService.TryAcquireAsync(key, LockDuration);

        if (lockResult.AlreadyProcessed && lockResult.StoredResultJson != null)
        {
            _logger.LogInformation("Returning cached transfer result for key {Key}", key);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = key,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.SecurityCheck,
                ActorUserId = senderId,
                ActorUsername = senderUsername,
                Details = new Dictionary<string, string>
                {
                    ["action"] = "DUPLICATE_REQUEST_BLOCKED",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            return System.Text.Json.JsonSerializer.Deserialize<CreateTransferResponse>(
                lockResult.StoredResultJson)!;
        }

        if (!lockResult.Acquired)
        {
            throw new InvalidOperationException(
                "Request sudah sedang diproses. Silakan tunggu beberapa saat.");
        }

        try
        {
            // Record transfer initiated
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = key,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.TransactionInitiated,
                ActorUserId = senderId,
                ActorUsername = senderUsername,
                Details = new Dictionary<string, string>
                {
                    ["receiverUsername"] = request.ReceiverUsername,
                    ["amount"] = request.Amount.ToString(),
                    ["holdHours"] = request.HoldHours.ToString(),
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            // Execute actual transfer
            var result = await _innerService.CreateTransferAsync(senderId, request);

            // Store result for idempotency
            await _idempotencyService.StoreResultAsync(key, result, ResultTtl);

            // Record transfer created
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = result.TransferId,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.TransactionCreated,
                ActorUserId = senderId,
                ActorUsername = senderUsername,
                Details = new Dictionary<string, string>
                {
                    ["code"] = result.Code,
                    ["receiverUsername"] = result.ReceiverUsername,
                    ["amount"] = result.Amount.ToString(),
                    ["holdUntil"] = result.HoldUntil.ToString("O"),
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            return result;
        }
        catch (Exception ex)
        {
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = key,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.TransactionFailed,
                ActorUserId = senderId,
                ActorUsername = senderUsername,
                Details = new Dictionary<string, string>
                {
                    ["error"] = ex.Message,
                    ["errorType"] = ex.GetType().Name,
                    ["receiverUsername"] = request.ReceiverUsername,
                    ["amount"] = request.Amount.ToString(),
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            // Release lock on failure
            await _idempotencyService.ReleaseAsync(key);
            throw;
        }
    }

    public async Task<(bool success, string? error)> ReleaseTransferAsync(
        string transferId,
        uint userId,
        string pin,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = idempotencyKey ?? _idempotencyService.GenerateKey("release");

        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        var username = transfer?.ReceiverUsername ?? $"user_{userId}";

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
                TransactionId = transferId,
                TransactionType = "TRANSFER",
                EventType = AuditEventType.StatusChange,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = "RELEASE_INITIATED",
                    ["idempotencyKey"] = key
                },
                IpAddress = ipAddress,
                UserAgent = userAgent
            });

            var (success, error) = await _innerService.ReleaseTransferAsync(transferId, userId, pin);

            await _idempotencyService.StoreResultAsync(key, new OperationResult(success, error), ResultTtl);

            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = transferId,
                TransactionType = "TRANSFER",
                EventType = success ? AuditEventType.TransactionCompleted : AuditEventType.TransactionFailed,
                ActorUserId = userId,
                ActorUsername = username,
                Details = new Dictionary<string, string>
                {
                    ["action"] = success ? "RELEASED" : "RELEASE_FAILED",
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

    public async Task<(bool success, string? error)> CancelTransferAsync(
        string transferId,
        uint userId,
        string pin,
        string reason,
        string? idempotencyKey = null,
        string? ipAddress = null,
        string? userAgent = null)
    {
        var key = idempotencyKey ?? _idempotencyService.GenerateKey("cancel");

        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        var username = transfer?.SenderUsername ?? $"user_{userId}";

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
        var key = idempotencyKey ?? _idempotencyService.GenerateKey("reject");

        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        var username = transfer?.ReceiverUsername ?? $"user_{receiverId}";

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
}
