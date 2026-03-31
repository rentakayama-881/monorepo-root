using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
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
    private readonly AppDbContext _db;
    private readonly ILogger<WalletService> _logger;

    // Security constants - PBKDF2 with high iteration count
    private const int PbkdfIterations = 310000;
    private const int PinLockHours = 4;
    private const int MaxPinAttempts = 4;
    private const int SaltSize = 32;
    private const int HashSize = 32;

    public WalletService(AppDbContext db, ILogger<WalletService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<UserWallet> GetOrCreateWalletAsync(uint userId)
    {
        var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
        
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
                _db.Wallets.Add(wallet);
                await _db.SaveChangesAsync();
                _logger.LogInformation("Created new wallet {WalletId} for user {UserId}", wallet.Id, userId);
            }
            catch (DbUpdateException)
            {
                // Race condition - wallet was created by another request
                _db.ChangeTracker.Clear();
                wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            }
        }

        return wallet!;
    }

    public async Task<bool> SetPinAsync(uint userId, string pin)
    {
        await GetOrCreateWalletAsync(userId);
        ValidatePin(pin);
        var pinHash = HashPin(pin);

        var updated = await _db.Wallets
            .Where(w => w.UserId == userId && w.PinSet == false)
            .ExecuteUpdateAsync(s => s
                .SetProperty(w => w.PinHash, pinHash)
                .SetProperty(w => w.PinSet, true)
                .SetProperty(w => w.FailedPinAttempts, 0)
                .SetProperty(w => w.PinLockedUntil, (DateTime?)null)
                .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));

        if (updated == 0)
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
            // Atomic increment to prevent race condition where concurrent requests
            // read the same FailedPinAttempts and both compute the same +1.
            // Filter ensures we only increment if not already locked.
            var updated = await _db.Wallets
                .Where(w => w.UserId == userId &&
                    (w.PinLockedUntil == null || w.PinLockedUntil < DateTime.UtcNow))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.FailedPinAttempts, w => w.FailedPinAttempts + 1)
                    .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));

            if (updated == 0)
            {
                // Already locked by a concurrent request
                return new VerifyPinResponse(false, $"PIN salah. Akun terkunci selama {PinLockHours} jam.", 0);
            }

            // Re-fetch to get the updated FailedPinAttempts value
            var updatedWallet = await _db.Wallets.AsNoTracking().FirstAsync(w => w.UserId == userId);

            // Check if this increment crossed the threshold → lock
            if (updatedWallet.FailedPinAttempts >= MaxPinAttempts)
            {
                var lockUntil = DateTime.UtcNow.AddHours(PinLockHours);
                await _db.Wallets
                    .Where(w => w.UserId == userId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(w => w.PinLockedUntil, lockUntil)
                        .SetProperty(w => w.FailedPinAttempts, 0)
                        .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));

                _logger.LogWarning("PIN locked for user {UserId} after {Attempts} failed attempts",
                    userId, updatedWallet.FailedPinAttempts);

                return new VerifyPinResponse(false, $"PIN salah. Akun terkunci selama {PinLockHours} jam.", 0);
            }

            var remainingAttempts = MaxPinAttempts - updatedWallet.FailedPinAttempts;
            return new VerifyPinResponse(false, $"PIN salah. Sisa percobaan: {remainingAttempts}", remainingAttempts);
        }

        // Reset failed attempts on successful verification
        if (wallet.FailedPinAttempts > 0 || wallet.PinLockedUntil.HasValue)
        {
            await _db.Wallets
                .Where(w => w.UserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.FailedPinAttempts, 0)
                    .SetProperty(w => w.PinLockedUntil, (DateTime?)null)
                    .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));
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

        return await DeductBalanceInternalAsync(userId, amount, description, type, referenceId, referenceType);
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

        return await AddBalanceInternalAsync(userId, amount, description, type, referenceId, referenceType);
    }

    public async Task<List<Transaction>> GetTransactionsAsync(uint userId, int page = 1, int pageSize = 20)
    {
        var skip = (page - 1) * pageSize;

        return await _db.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> GetTransactionCountAsync(uint userId)
    {
        return await _db.Transactions.CountAsync(t => t.UserId == userId);
    }

    /// <summary>
    /// Recalculates balance from ledger entries for audit purposes.
    /// This should match the stored balance if system is working correctly.
    /// </summary>
    public async Task<long> RecalculateBalanceFromLedgerAsync(uint userId)
    {
        var entries = await _db.TransactionLedger
            .Where(l => l.UserId == userId && l.Status == TransactionStatus.Completed)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync();

        long balance = 0;
        foreach (var entry in entries)
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

            await _db.Wallets
                .Where(w => w.UserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.Balance, balance)
                    .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));
        }

        return balance;
    }
}
