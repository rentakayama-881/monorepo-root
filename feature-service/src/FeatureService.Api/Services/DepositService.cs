using MongoDB.Bson;
using MongoDB.Driver;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface IDepositService
{
    Task<DepositRequestResponse> CreateRequestAsync(uint userId, string username, CreateDepositRequest request);
    Task<DepositHistoryResponse> GetUserDepositsAsync(uint userId, int limit = 50);
    Task<List<AdminDepositResponse>> GetPendingDepositsAsync(int limit = 50);
    Task<(bool success, string? error)> ApproveAsync(string depositId, uint adminId, string adminUsername, long? amountOverride);
    Task<(bool success, string? error)> RejectAsync(string depositId, uint adminId, string adminUsername, string reason);
}

public class DepositService : IDepositService
{
    private readonly IMongoCollection<DepositRequest> _deposits;
    private readonly IWalletService _walletService;
    private readonly ILogger<DepositService> _logger;

    private const long MinDeposit = 10000;
    private const string AllowedMethod = "QRIS";

    public DepositService(MongoDbContext dbContext, IWalletService walletService, ILogger<DepositService> logger)
    {
        _deposits = dbContext.GetCollection<DepositRequest>("deposit_requests");
        _walletService = walletService;
        _logger = logger;

        CreateIndexes();
    }

    private void CreateIndexes()
    {
        _deposits.Indexes.CreateOne(new CreateIndexModel<DepositRequest>(
            Builders<DepositRequest>.IndexKeys
                .Ascending(d => d.UserId)
                .Descending(d => d.CreatedAt)
        ));

        _deposits.Indexes.CreateOne(new CreateIndexModel<DepositRequest>(
            Builders<DepositRequest>.IndexKeys.Ascending(d => d.Status)
        ));

        _deposits.Indexes.CreateOne(new CreateIndexModel<DepositRequest>(
            Builders<DepositRequest>.IndexKeys.Ascending(d => d.ExternalTransactionId)
        ));
    }

    public async Task<DepositRequestResponse> CreateRequestAsync(uint userId, string username, CreateDepositRequest request)
    {
        if (request.Amount < MinDeposit)
        {
            throw new ArgumentException($"Minimum deposit Rp{MinDeposit:N0}");
        }

        var method = request.Method?.Trim().ToUpperInvariant() ?? AllowedMethod;
        if (!string.Equals(method, AllowedMethod, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Saat ini hanya deposit via QRIS yang tersedia");
        }

        var externalId = request.ExternalTransactionId.Trim();
        if (externalId.Length < 6)
        {
            throw new ArgumentException("ID transaksi tidak valid");
        }

        var existing = await _deposits.Find(d =>
            d.UserId == userId &&
            d.ExternalTransactionId == externalId &&
            d.Status == DepositStatus.Pending).FirstOrDefaultAsync();

        if (existing != null)
        {
            return new DepositRequestResponse(
                existing.Id,
                existing.Amount,
                existing.Method,
                existing.ExternalTransactionId,
                existing.Status.ToString(),
                existing.CreatedAt
            );
        }

        var deposit = new DepositRequest
        {
            Id = ObjectId.GenerateNewId().ToString(),
            UserId = userId,
            Username = username,
            Amount = request.Amount,
            Method = method,
            ExternalTransactionId = externalId,
            Status = DepositStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _deposits.InsertOneAsync(deposit);

        _logger.LogInformation("Deposit request created: {DepositId} user {UserId} amount {Amount}",
            deposit.Id, userId, deposit.Amount);

        return new DepositRequestResponse(
            deposit.Id,
            deposit.Amount,
            deposit.Method,
            deposit.ExternalTransactionId,
            deposit.Status.ToString(),
            deposit.CreatedAt
        );
    }

    public async Task<DepositHistoryResponse> GetUserDepositsAsync(uint userId, int limit = 50)
    {
        var deposits = await _deposits
            .Find(d => d.UserId == userId)
            .SortByDescending(d => d.CreatedAt)
            .Limit(Math.Clamp(limit, 1, 100))
            .ToListAsync();

        var items = deposits.Select(d => new DepositRequestResponse(
            d.Id,
            d.Amount,
            d.Method,
            d.ExternalTransactionId,
            d.Status.ToString(),
            d.CreatedAt
        )).ToList();

        return new DepositHistoryResponse(items, deposits.Count);
    }

    public async Task<List<AdminDepositResponse>> GetPendingDepositsAsync(int limit = 50)
    {
        var deposits = await _deposits
            .Find(d => d.Status == DepositStatus.Pending)
            .SortBy(d => d.CreatedAt)
            .Limit(Math.Clamp(limit, 1, 200))
            .ToListAsync();

        return deposits.Select(d => new AdminDepositResponse(
            d.Id,
            d.UserId,
            d.Username,
            d.Amount,
            d.Method,
            d.ExternalTransactionId,
            d.Status.ToString(),
            d.CreatedAt
        )).ToList();
    }

    public async Task<(bool success, string? error)> ApproveAsync(
        string depositId, uint adminId, string adminUsername, long? amountOverride)
    {
        var deposit = await _deposits.Find(d => d.Id == depositId).FirstOrDefaultAsync();
        if (deposit == null)
            return (false, "Deposit tidak ditemukan");

        if (deposit.Status != DepositStatus.Pending)
            return (false, "Deposit sudah diproses");

        var amount = amountOverride ?? deposit.Amount;
        if (amount < MinDeposit)
            return (false, $"Jumlah deposit minimum Rp{MinDeposit:N0}");

        // Mark as approved first to prevent double-credit (exactly-once semantics)
        var now = DateTime.UtcNow;
        var approveFilter = Builders<DepositRequest>.Filter.And(
            Builders<DepositRequest>.Filter.Eq(d => d.Id, deposit.Id),
            Builders<DepositRequest>.Filter.Eq(d => d.Status, DepositStatus.Pending));

        var approveUpdate = Builders<DepositRequest>.Update
            .Set(d => d.Status, DepositStatus.Approved)
            .Set(d => d.ApprovedById, adminId)
            .Set(d => d.ApprovedByUsername, adminUsername)
            .Set(d => d.ApprovedAt, now)
            .Set(d => d.UpdatedAt, now);

        var approveResult = await _deposits.UpdateOneAsync(approveFilter, approveUpdate);
        if (approveResult.ModifiedCount == 0)
        {
            return (false, "Deposit sudah diproses oleh request lain");
        }

        string walletTransactionId;
        try
        {
            walletTransactionId = await _walletService.AddBalanceAsync(
                deposit.UserId,
                amount,
                $"Deposit {deposit.Method} ({deposit.ExternalTransactionId})",
                TransactionType.Deposit,
                deposit.Id,
                "deposit"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to credit wallet for approved deposit {DepositId}. Attempting status rollback.", depositId);

            try
            {
                var rollback = Builders<DepositRequest>.Update
                    .Set(d => d.Status, DepositStatus.Pending)
                    .Set(d => d.UpdatedAt, DateTime.UtcNow)
                    .Unset(d => d.ApprovedById)
                    .Unset(d => d.ApprovedByUsername)
                    .Unset(d => d.ApprovedAt);

                await _deposits.UpdateOneAsync(
                    Builders<DepositRequest>.Filter.And(
                        Builders<DepositRequest>.Filter.Eq(d => d.Id, deposit.Id),
                        Builders<DepositRequest>.Filter.Eq(d => d.Status, DepositStatus.Approved),
                        Builders<DepositRequest>.Filter.Eq(d => d.WalletTransactionId, null)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback deposit approval after wallet credit failure. DepositId: {DepositId}",
                    depositId);
            }

            return (false, "Gagal memproses deposit. Silakan coba lagi atau hubungi support.");
        }

        try
        {
            var update = Builders<DepositRequest>.Update
                .Set(d => d.WalletTransactionId, walletTransactionId)
                .Set(d => d.UpdatedAt, DateTime.UtcNow);

            await _deposits.UpdateOneAsync(d => d.Id == deposit.Id, update);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to finalize deposit approval {DepositId}. WalletTransactionId: {WalletTransactionId}", depositId, walletTransactionId);
        }

        _logger.LogInformation("Deposit approved: {DepositId} by admin {AdminId}", depositId, adminId);
        return (true, null);
    }

    public async Task<(bool success, string? error)> RejectAsync(
        string depositId, uint adminId, string adminUsername, string reason)
    {
        var deposit = await _deposits.Find(d => d.Id == depositId).FirstOrDefaultAsync();
        if (deposit == null)
            return (false, "Deposit tidak ditemukan");

        if (deposit.Status != DepositStatus.Pending)
            return (false, "Deposit sudah diproses");

        var now = DateTime.UtcNow;
        var rejectFilter = Builders<DepositRequest>.Filter.And(
            Builders<DepositRequest>.Filter.Eq(d => d.Id, deposit.Id),
            Builders<DepositRequest>.Filter.Eq(d => d.Status, DepositStatus.Pending));

        var update = Builders<DepositRequest>.Update
            .Set(d => d.Status, DepositStatus.Rejected)
            .Set(d => d.RejectionReason, reason)
            .Set(d => d.ApprovedById, adminId)
            .Set(d => d.ApprovedByUsername, adminUsername)
            .Set(d => d.ApprovedAt, now)
            .Set(d => d.UpdatedAt, now);

        var rejectResult = await _deposits.UpdateOneAsync(rejectFilter, update);
        if (rejectResult.ModifiedCount == 0)
        {
            return (false, "Deposit sudah diproses oleh request lain");
        }

        _logger.LogInformation("Deposit rejected: {DepositId} by admin {AdminId}", depositId, adminId);
        return (true, null);
    }
}
