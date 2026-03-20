using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IWalletService
{
    Task<UserWallet> GetOrCreateWalletAsync(uint userId);
    Task<bool> SetPinAsync(uint userId, string pin);
    Task<VerifyPinResponse> VerifyPinAsync(uint userId, string pin);
    Task<PinStatusResponse> GetPinStatusAsync(uint userId);
    Task<(bool success, string? error, string? transactionId)> DeductBalanceAsync(uint userId, long amount, string description, TransactionType type, string? referenceId = null, string? referenceType = null);
    Task<string> AddBalanceAsync(uint userId, long amount, string description, TransactionType type, string? referenceId = null, string? referenceType = null);
    Task<List<Transaction>> GetTransactionsAsync(uint userId, int page = 1, int pageSize = 20);
    Task<int> GetTransactionCountAsync(uint userId);
    Task<long> RecalculateBalanceFromLedgerAsync(uint userId);
}

public partial class WalletService : IWalletService
{
    private readonly IMongoCollection<UserWallet> _wallets;
    private readonly IMongoCollection<Transaction> _transactions;
    private readonly IMongoCollection<TransactionLedger> _ledger;
    private readonly ILogger<WalletService> _logger;
    private readonly IHostEnvironment _environment;
    // 0 = unknown, 1 = supported, -1 = unsupported (standalone/non-replica MongoDB)
    private int _transactionSupportState = 0;

    // Security constants - PBKDF2 with high iteration count
    private const int PbkdfIterations = 310000;
    private const int PinLockHours = 4;
    private const int MaxPinAttempts = 4;
    private const int SaltSize = 32;
    private const int HashSize = 32;

    public WalletService(MongoDbContext dbContext, ILogger<WalletService> logger, IHostEnvironment environment)
    {
        _wallets = dbContext.GetCollection<UserWallet>("wallets");
        _transactions = dbContext.GetCollection<Transaction>("transactions");
        _ledger = dbContext.GetCollection<TransactionLedger>("transaction_ledger");
        _logger = logger;
        _environment = environment;
    }

    public async Task<UserWallet> GetOrCreateWalletAsync(uint userId)
    {
        var wallet = await _wallets.Find(w => w.UserId == userId).FirstOrDefaultAsync();
        
        if (wallet == null)
        {
            wallet = new UserWallet
            {
                Id = $"wlt_{Ulid.NewUlid()}",
                UserId = userId,
                Balance = 0,
                PinSet = false,
                FailedPinAttempts = 0,
                PinLockedUntil = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            try
            {
                await _wallets.InsertOneAsync(wallet);
                _logger.LogInformation("Created new wallet {WalletId} for user {UserId}", wallet.Id, userId);
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                // Race condition - wallet was created by another request
                wallet = await _wallets.Find(w => w.UserId == userId).FirstOrDefaultAsync();
            }
        }

        return wallet!;
    }

    public async Task<bool> SetPinAsync(uint userId, string pin)
    {
        await GetOrCreateWalletAsync(userId);
        ValidatePin(pin);
        var pinHash = HashPin(pin);

        var filter = Builders<UserWallet>.Filter.And(
            Builders<UserWallet>.Filter.Eq(w => w.UserId, userId),
            Builders<UserWallet>.Filter.Eq(w => w.PinSet, false)
        );

        var update = Builders<UserWallet>.Update
            .Set(w => w.PinHash, pinHash)
            .Set(w => w.PinSet, true)
            .Set(w => w.FailedPinAttempts, 0)
            .Set(w => w.PinLockedUntil, null)
            .Set(w => w.UpdatedAt, DateTime.UtcNow);

        var result = await _wallets.UpdateOneAsync(filter, update);

        if (result.MatchedCount == 0)
            throw new InvalidOperationException("PIN sudah diset sebelumnya. PIN tidak dapat diubah.");

        _logger.LogInformation("PIN set for user {UserId}", userId);
        return true;
    }

    public async Task<VerifyPinResponse> VerifyPinAsync(uint userId, string pin)
    {
        var wallet = await GetOrCreateWalletAsync(userId);
        
        if (!wallet.PinSet || string.IsNullOrEmpty(wallet.PinHash))
        {
            return new VerifyPinResponse(false, "PIN belum diset", null);
        }

        // Check if PIN is locked
        if (wallet.PinLockedUntil.HasValue && wallet.PinLockedUntil.Value > DateTime.UtcNow)
        {
            var remainingTime = wallet.PinLockedUntil.Value - DateTime.UtcNow;
            var message = $"PIN terkunci. Coba lagi dalam {Math.Ceiling(remainingTime.TotalMinutes)} menit";
            return new VerifyPinResponse(false, message, 0);
        }

        bool isValid = VerifyPinHash(pin, wallet.PinHash);

        if (!isValid)
        {
            // Atomic $inc to prevent race condition where concurrent requests
            // read the same FailedPinAttempts and both compute the same +1.
            // Filter ensures we only increment if not already locked.
            var incFilter = Builders<UserWallet>.Filter.And(
                Builders<UserWallet>.Filter.Eq(w => w.UserId, userId),
                Builders<UserWallet>.Filter.Or(
                    Builders<UserWallet>.Filter.Eq(w => w.PinLockedUntil, null),
                    Builders<UserWallet>.Filter.Lt(w => w.PinLockedUntil, DateTime.UtcNow)));

            var incUpdate = Builders<UserWallet>.Update
                .Inc(w => w.FailedPinAttempts, 1)
                .Set(w => w.UpdatedAt, DateTime.UtcNow);

            var updated = await _wallets.FindOneAndUpdateAsync(
                incFilter, incUpdate,
                new FindOneAndUpdateOptions<UserWallet> { ReturnDocument = ReturnDocument.After });

            if (updated == null)
            {
                // Already locked by a concurrent request
                return new VerifyPinResponse(false, $"PIN salah. Akun terkunci selama {PinLockHours} jam.", 0);
            }

            // Check if this increment crossed the threshold → lock
            if (updated.FailedPinAttempts >= MaxPinAttempts)
            {
                var lockUntil = DateTime.UtcNow.AddHours(PinLockHours);
                var lockUpdate = Builders<UserWallet>.Update
                    .Set(w => w.PinLockedUntil, lockUntil)
                    .Set(w => w.FailedPinAttempts, 0)
                    .Set(w => w.UpdatedAt, DateTime.UtcNow);

                await _wallets.UpdateOneAsync(w => w.UserId == userId, lockUpdate);
                _logger.LogWarning("PIN locked for user {UserId} after {Attempts} failed attempts",
                    userId, updated.FailedPinAttempts);

                return new VerifyPinResponse(false, $"PIN salah. Akun terkunci selama {PinLockHours} jam.", 0);
            }

            var remainingAttempts = MaxPinAttempts - updated.FailedPinAttempts;
            return new VerifyPinResponse(false, $"PIN salah. Sisa percobaan: {remainingAttempts}", remainingAttempts);
        }

        // Reset failed attempts on successful verification
        if (wallet.FailedPinAttempts > 0 || wallet.PinLockedUntil.HasValue)
        {
            var update = Builders<UserWallet>.Update
                .Set(w => w.FailedPinAttempts, 0)
                .Set(w => w.PinLockedUntil, null)
                .Set(w => w.UpdatedAt, DateTime.UtcNow);
                
            await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
        }

        _logger.LogDebug("PIN verified for user {UserId}", userId);
        return new VerifyPinResponse(true, "PIN valid", MaxPinAttempts);
    }

    public async Task<PinStatusResponse> GetPinStatusAsync(uint userId)
    {
        var wallet = await GetOrCreateWalletAsync(userId);
        
        var isLocked = wallet.PinLockedUntil.HasValue && wallet.PinLockedUntil.Value > DateTime.UtcNow;
        
        return new PinStatusResponse(
            wallet.PinSet,
            isLocked,
            isLocked ? wallet.PinLockedUntil : null,
            wallet.FailedPinAttempts,
            MaxPinAttempts
        );
    }

    public async Task<(bool success, string? error, string? transactionId)> DeductBalanceAsync(
        uint userId, 
        long amount, 
        string description,
        TransactionType type,
        string? referenceId = null,
        string? referenceType = null)
    {
        if (amount <= 0)
        {
            return (false, "Jumlah tidak valid", null);
        }

        // Ensure wallet exists before attempting atomic operations
        await GetOrCreateWalletAsync(userId);

        return await TryWithMongoTransactionAsync(
            session => DeductBalanceInternalAsync(
                session, userId, amount, description, type, referenceId, referenceType, bestEffortAudit: false),
            () => DeductBalanceInternalAsync(
                session: null, userId, amount, description, type, referenceId, referenceType, bestEffortAudit: true));
    }

    public async Task<string> AddBalanceAsync(
        uint userId, 
        long amount, 
        string description,
        TransactionType type,
        string? referenceId = null,
        string? referenceType = null)
    {
        if (amount <= 0)
        {
            throw new ArgumentException("Jumlah tidak valid", nameof(amount));
        }

        // Ensure wallet exists before attempting atomic operations
        await GetOrCreateWalletAsync(userId);

        return await TryWithMongoTransactionAsync(
            session => AddBalanceInternalAsync(
                session, userId, amount, description, type, referenceId, referenceType, bestEffortAudit: false),
            () => AddBalanceInternalAsync(
                session: null, userId, amount, description, type, referenceId, referenceType, bestEffortAudit: true));
    }

    public async Task<List<Transaction>> GetTransactionsAsync(uint userId, int page = 1, int pageSize = 20)
    {
        var skip = (page - 1) * pageSize;

        return await _transactions
            .Find(t => t.UserId == userId)
            .SortByDescending(t => t.CreatedAt)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync();
    }

    public async Task<int> GetTransactionCountAsync(uint userId)
    {
        return (int)await _transactions.CountDocumentsAsync(t => t.UserId == userId);
    }

    /// <summary>
    /// Recalculates balance from ledger entries for audit purposes.
    /// This should match the stored balance if system is working correctly.
    /// </summary>
    public async Task<long> RecalculateBalanceFromLedgerAsync(uint userId)
    {
        var filter = Builders<TransactionLedger>.Filter.And(
            Builders<TransactionLedger>.Filter.Eq(l => l.UserId, userId),
            Builders<TransactionLedger>.Filter.Eq(l => l.Status, TransactionStatus.Completed)
        );

        var entries = await _ledger.Find(filter).ToListAsync();

        long balance = 0;
        foreach (var entry in entries.OrderBy(e => e.CreatedAt))
        {
            if (entry.EntryType == LedgerEntryType.Credit)
            {
                balance += entry.Amount;
            }
            else
            {
                balance -= entry.Amount;
            }
        }

        // Update wallet balance if different (fix discrepancy)
        var wallet = await GetOrCreateWalletAsync(userId);
        if (wallet.Balance != balance)
        {
            _logger.LogWarning(
                "Balance discrepancy for user {UserId}: stored={StoredBalance}, calculated={CalculatedBalance}",
                userId, wallet.Balance, balance
            );

            var update = Builders<UserWallet>.Update
                .Set(w => w.Balance, balance)
                .Set(w => w.UpdatedAt, DateTime.UtcNow);
                
            await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
        }

        return balance;
    }
}
