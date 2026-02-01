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

        var walletTransactionId = await _walletService.AddBalanceAsync(
            deposit.UserId,
            amount,
            $"Deposit {deposit.Method} ({deposit.ExternalTransactionId})",
            TransactionType.Deposit,
            deposit.Id,
            "deposit"
        );

        var update = Builders<DepositRequest>.Update
            .Set(d => d.Status, DepositStatus.Approved)
            .Set(d => d.WalletTransactionId, walletTransactionId)
            .Set(d => d.ApprovedById, adminId)
            .Set(d => d.ApprovedByUsername, adminUsername)
            .Set(d => d.ApprovedAt, DateTime.UtcNow)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _deposits.UpdateOneAsync(d => d.Id == deposit.Id, update);

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

        var update = Builders<DepositRequest>.Update
            .Set(d => d.Status, DepositStatus.Rejected)
            .Set(d => d.RejectionReason, reason)
            .Set(d => d.ApprovedById, adminId)
            .Set(d => d.ApprovedByUsername, adminUsername)
            .Set(d => d.ApprovedAt, DateTime.UtcNow)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _deposits.UpdateOneAsync(d => d.Id == deposit.Id, update);

        _logger.LogInformation("Deposit rejected: {DepositId} by admin {AdminId}", depositId, adminId);
        return (true, null);
    }
}
