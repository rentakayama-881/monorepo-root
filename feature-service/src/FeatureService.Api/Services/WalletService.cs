using System.Security.Cryptography;
using System.Text;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IWalletService
{
    Task<UserWallet> GetOrCreateWalletAsync(uint userId);
    Task<bool> SetPinAsync(uint userId, string pin);
    Task<bool> ChangePinAsync(uint userId, string currentPin, string newPin);
    Task<VerifyPinResponse> VerifyPinAsync(uint userId, string pin);
    Task<PinStatusResponse> GetPinStatusAsync(uint userId);
    Task<(bool success, string? error, string? transactionId)> DeductBalanceAsync(uint userId, long amount, string description, TransactionType type, string? referenceId = null, string? referenceType = null);
    Task<string> AddBalanceAsync(uint userId, long amount, string description, TransactionType type, string? referenceId = null, string? referenceType = null);
    Task<List<Transaction>> GetTransactionsAsync(uint userId, int page = 1, int pageSize = 20);
    Task<int> GetTransactionCountAsync(uint userId);
    Task<long> RecalculateBalanceFromLedgerAsync(uint userId);
}

public class WalletService : IWalletService
{
    private readonly IMongoCollection<UserWallet> _wallets;
    private readonly IMongoCollection<Transaction> _transactions;
    private readonly IMongoCollection<TransactionLedger> _ledger;
    private readonly ILogger<WalletService> _logger;

    // Security constants - PBKDF2 with high iteration count
    private const int PbkdfIterations = 310000;
    private const int PinLockHours = 4;
    private const int MaxPinAttempts = 4;
    private const int SaltSize = 32;
    private const int HashSize = 32;

    public WalletService(MongoDbContext dbContext, ILogger<WalletService> logger)
    {
        _wallets = dbContext.GetCollection<UserWallet>("wallets");
        _transactions = dbContext.GetCollection<Transaction>("transactions");
        _ledger = dbContext.GetCollection<TransactionLedger>("transaction_ledger");
        _logger = logger;

        // Create indexes
        CreateIndexes();
    }

    private void CreateIndexes()
    {
        // Index for userId lookup (unique)
        var userIdIndexModel = new CreateIndexModel<UserWallet>(
            Builders<UserWallet>.IndexKeys.Ascending(w => w.UserId),
            new CreateIndexOptions { Unique = true }
        );
        _wallets.Indexes.CreateOne(userIdIndexModel);

        // Index for transaction userId + createdAt (for history queries)
        var txnUserIdIndexModel = new CreateIndexModel<Transaction>(
            Builders<Transaction>.IndexKeys
                .Ascending(t => t.UserId)
                .Descending(t => t.CreatedAt)
        );
        _transactions.Indexes.CreateOne(txnUserIdIndexModel);

        // Index for ledger
        var ledgerIndexModel = new CreateIndexModel<TransactionLedger>(
            Builders<TransactionLedger>.IndexKeys
                .Ascending(l => l.UserId)
                .Descending(l => l.CreatedAt)
        );
        _ledger.Indexes.CreateOne(ledgerIndexModel);
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
        var wallet = await GetOrCreateWalletAsync(userId);
        
        if (wallet.PinSet)
        {
            throw new InvalidOperationException("PIN sudah diset. Gunakan change PIN untuk mengubah.");
        }

        ValidatePin(pin);
        var pinHash = HashPin(pin);

        var update = Builders<UserWallet>.Update
            .Set(w => w.PinHash, pinHash)
            .Set(w => w.PinSet, true)
            .Set(w => w.FailedPinAttempts, 0)
            .Set(w => w.PinLockedUntil, null)
            .Set(w => w.UpdatedAt, DateTime.UtcNow);

        var result = await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
        _logger.LogInformation("PIN set for user {UserId}", userId);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> ChangePinAsync(uint userId, string currentPin, string newPin)
    {
        var wallet = await GetOrCreateWalletAsync(userId);
        
        if (!wallet.PinSet || string.IsNullOrEmpty(wallet.PinHash))
        {
            throw new InvalidOperationException("PIN belum diset. Gunakan set PIN terlebih dahulu.");
        }

        // Check if PIN is locked
        CheckPinLock(wallet);

        // Verify current PIN
        if (!VerifyPinHash(currentPin, wallet.PinHash))
        {
            await IncrementFailedAttemptsAsync(userId, wallet);
            throw new UnauthorizedAccessException("PIN lama salah");
        }

        ValidatePin(newPin);
        
        if (currentPin == newPin)
        {
            throw new InvalidOperationException("PIN baru tidak boleh sama dengan PIN lama");
        }

        var newPinHash = HashPin(newPin);

        var update = Builders<UserWallet>.Update
            .Set(w => w.PinHash, newPinHash)
            .Set(w => w.FailedPinAttempts, 0)
            .Set(w => w.PinLockedUntil, null)
            .Set(w => w.UpdatedAt, DateTime.UtcNow);

        var result = await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
        _logger.LogInformation("PIN changed for user {UserId}", userId);
        return result.ModifiedCount > 0;
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
            var newFailedAttempts = wallet.FailedPinAttempts + 1;
            var remainingAttempts = MaxPinAttempts - newFailedAttempts;
            
            var update = Builders<UserWallet>.Update
                .Set(w => w.FailedPinAttempts, newFailedAttempts)
                .Set(w => w.UpdatedAt, DateTime.UtcNow);

            // Lock PIN if max attempts reached
            if (newFailedAttempts >= MaxPinAttempts)
            {
                var lockUntil = DateTime.UtcNow.AddHours(PinLockHours);
                update = update
                    .Set(w => w.PinLockedUntil, lockUntil)
                    .Set(w => w.FailedPinAttempts, 0);
                    
                await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
                _logger.LogWarning("PIN locked for user {UserId} after {Attempts} failed attempts", userId, newFailedAttempts);
                
                return new VerifyPinResponse(false, $"PIN salah. Akun terkunci selama {PinLockHours} jam.", 0);
            }

            await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
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
            Builders<TransactionLedger>.Filter.Eq(l => l.UserId, (int)userId),
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

    // === Private Helper Methods ===

    private async Task<T> TryWithMongoTransactionAsync<T>(
        Func<IClientSessionHandle, Task<T>> transactional,
        Func<Task<T>> fallback)
    {
        try
        {
            using var session = await _wallets.Database.Client.StartSessionAsync();
            session.StartTransaction();

            try
            {
                var result = await transactional(session);
                await session.CommitTransactionAsync();
                return result;
            }
            catch
            {
                await session.AbortTransactionAsync();
                throw;
            }
        }
        catch (MongoCommandException ex) when (IsTransactionsNotSupported(ex))
        {
            _logger.LogWarning(ex, "MongoDB transactions not supported; falling back to non-transactional wallet updates");
            return await fallback();
        }
    }

    private static bool IsTransactionsNotSupported(MongoCommandException ex)
    {
        // Standalone MongoDB: "Transaction numbers are only allowed on a replica set member or mongos"
        return ex.Message.Contains("Transaction numbers are only allowed", StringComparison.OrdinalIgnoreCase)
            || ex.Message.Contains("replica set member", StringComparison.OrdinalIgnoreCase)
            || ex.Message.Contains("not supported", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<(bool success, string? error, string? transactionId)> DeductBalanceInternalAsync(
        IClientSessionHandle? session,
        uint userId,
        long amount,
        string description,
        TransactionType type,
        string? referenceId,
        string? referenceType,
        bool bestEffortAudit)
    {
        var now = DateTime.UtcNow;

        var filter = Builders<UserWallet>.Filter.And(
            Builders<UserWallet>.Filter.Eq(w => w.UserId, userId),
            Builders<UserWallet>.Filter.Gte(w => w.Balance, amount));

        var update = Builders<UserWallet>.Update
            .Inc(w => w.Balance, -amount)
            .Set(w => w.UpdatedAt, now);

        var options = new FindOneAndUpdateOptions<UserWallet, UserWallet>
        {
            ReturnDocument = ReturnDocument.Before
        };

        var walletBefore = session == null
            ? await _wallets.FindOneAndUpdateAsync(filter, update, options)
            : await _wallets.FindOneAndUpdateAsync(session, filter, update, options);

        if (walletBefore == null)
        {
            return (false, "Saldo tidak mencukupi", null);
        }

        var balanceBefore = walletBefore.Balance;
        var balanceAfter = balanceBefore - amount;

        var transaction = new Transaction
        {
            Id = $"txn_{Ulid.NewUlid()}",
            UserId = userId,
            Type = type,
            Amount = -amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            Description = description,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
            CreatedAt = now
        };

        try
        {
            if (session == null)
            {
                await _transactions.InsertOneAsync(transaction);
            }
            else
            {
                await _transactions.InsertOneAsync(session, transaction);
            }

            await InsertLedgerEntryAsync(
                session,
                userId,
                LedgerEntryType.Debit,
                amount,
                balanceAfter,
                type,
                referenceId ?? transaction.Id,
                referenceType,
                transaction.Id,
                description,
                bestEffortAudit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write transaction records for user {UserId}", userId);

            // If we are not inside a Mongo transaction, try to compensate the balance update.
            if (session == null)
            {
                try
                {
                    var compensationUpdate = Builders<UserWallet>.Update
                        .Inc(w => w.Balance, amount)
                        .Set(w => w.UpdatedAt, DateTime.UtcNow);

                    await _wallets.UpdateOneAsync(
                        Builders<UserWallet>.Filter.Eq(w => w.UserId, userId),
                        compensationUpdate);
                }
                catch (Exception compensationEx)
                {
                    _logger.LogCritical(
                        compensationEx,
                        "CRITICAL: Failed to compensate wallet balance after audit write failure. UserId: {UserId}, Amount: {Amount}",
                        userId,
                        amount);
                }
            }

            throw;
        }

        _logger.LogInformation(
            "Deducted {Amount} from user {UserId}. Balance: {Before} -> {After}",
            amount,
            userId,
            balanceBefore,
            balanceAfter);

        return (true, null, transaction.Id);
    }

    private async Task<string> AddBalanceInternalAsync(
        IClientSessionHandle? session,
        uint userId,
        long amount,
        string description,
        TransactionType type,
        string? referenceId,
        string? referenceType,
        bool bestEffortAudit)
    {
        var now = DateTime.UtcNow;

        var filter = Builders<UserWallet>.Filter.Eq(w => w.UserId, userId);
        var update = Builders<UserWallet>.Update
            .Inc(w => w.Balance, amount)
            .Set(w => w.UpdatedAt, now);

        var options = new FindOneAndUpdateOptions<UserWallet, UserWallet>
        {
            ReturnDocument = ReturnDocument.Before
        };

        var walletBefore = session == null
            ? await _wallets.FindOneAndUpdateAsync(filter, update, options)
            : await _wallets.FindOneAndUpdateAsync(session, filter, update, options);

        if (walletBefore == null)
        {
            throw new InvalidOperationException("Wallet tidak ditemukan");
        }

        var balanceBefore = walletBefore.Balance;
        checked
        {
            _ = balanceBefore + amount;
        }

        var balanceAfter = balanceBefore + amount;

        var transaction = new Transaction
        {
            Id = $"txn_{Ulid.NewUlid()}",
            UserId = userId,
            Type = type,
            Amount = amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            Description = description,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
            CreatedAt = now
        };

        try
        {
            if (session == null)
            {
                await _transactions.InsertOneAsync(transaction);
            }
            else
            {
                await _transactions.InsertOneAsync(session, transaction);
            }

            await InsertLedgerEntryAsync(
                session,
                userId,
                LedgerEntryType.Credit,
                amount,
                balanceAfter,
                type,
                referenceId ?? transaction.Id,
                referenceType,
                transaction.Id,
                description,
                bestEffortAudit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write transaction records for user {UserId}", userId);

            if (session == null)
            {
                try
                {
                    var compensationUpdate = Builders<UserWallet>.Update
                        .Inc(w => w.Balance, -amount)
                        .Set(w => w.UpdatedAt, DateTime.UtcNow);

                    await _wallets.UpdateOneAsync(
                        Builders<UserWallet>.Filter.Eq(w => w.UserId, userId),
                        compensationUpdate);
                }
                catch (Exception compensationEx)
                {
                    _logger.LogCritical(
                        compensationEx,
                        "CRITICAL: Failed to compensate wallet balance after audit write failure. UserId: {UserId}, Amount: {Amount}",
                        userId,
                        amount);
                }
            }

            throw;
        }

        _logger.LogInformation(
            "Added {Amount} to user {UserId}. Balance: {Before} -> {After}",
            amount,
            userId,
            balanceBefore,
            balanceAfter);

        return transaction.Id;
    }

    private void ValidatePin(string pin)
    {
        if (string.IsNullOrEmpty(pin) || pin.Length != 6)
        {
            throw new ArgumentException("PIN harus 6 digit");
        }

        if (!pin.All(char.IsDigit))
        {
            throw new ArgumentException("PIN harus berisi angka saja");
        }

        // Check for weak PINs
        if (IsWeakPin(pin))
        {
            throw new ArgumentException("PIN terlalu lemah. Hindari urutan berulang atau berurutan.");
        }
    }

    private static bool IsWeakPin(string pin)
    {
        // Check for repeated digits (e.g., 111111, 222222)
        if (pin.Distinct().Count() == 1)
            return true;

        // Check for sequential digits (e.g., 123456, 654321)
        var sequential = "0123456789";
        var reverseSequential = "9876543210";
        if (sequential.Contains(pin) || reverseSequential.Contains(pin))
            return true;

        // Check for common weak PINs
        var weakPins = new[] { "000000", "123123", "111222", "121212", "123321" };
        if (weakPins.Contains(pin))
            return true;

        return false;
    }

    private static void CheckPinLock(UserWallet wallet)
    {
        if (wallet.PinLockedUntil.HasValue && wallet.PinLockedUntil.Value > DateTime.UtcNow)
        {
            var remainingTime = wallet.PinLockedUntil.Value - DateTime.UtcNow;
            throw new InvalidOperationException($"PIN terkunci. Coba lagi dalam {Math.Ceiling(remainingTime.TotalMinutes)} menit");
        }
    }

    private async Task IncrementFailedAttemptsAsync(uint userId, UserWallet wallet)
    {
        var newFailedAttempts = wallet.FailedPinAttempts + 1;
        
        var update = Builders<UserWallet>.Update
            .Set(w => w.FailedPinAttempts, newFailedAttempts)
            .Set(w => w.UpdatedAt, DateTime.UtcNow);

        if (newFailedAttempts >= MaxPinAttempts)
        {
            update = update
                .Set(w => w.PinLockedUntil, DateTime.UtcNow.AddHours(PinLockHours))
                .Set(w => w.FailedPinAttempts, 0);
                
            _logger.LogWarning("PIN locked for user {UserId} after {Attempts} failed attempts", userId, newFailedAttempts);
        }

        await _wallets.UpdateOneAsync(w => w.UserId == userId, update);
    }

    private async Task InsertLedgerEntryAsync(
        IClientSessionHandle? session,
        uint userId,
        LedgerEntryType entryType,
        long amount,
        long balanceAfter,
        TransactionType type,
        string referenceId,
        string? referenceType,
        string transactionId,
        string description,
        bool bestEffort)
    {
        try
        {
            var metadata = new Dictionary<string, string>
            {
                ["transaction_id"] = transactionId
            };

            if (!string.IsNullOrEmpty(referenceType))
            {
                metadata["reference_type"] = referenceType;
            }

            var ledgerEntry = new TransactionLedger
            {
                UserId = (int)userId,
                EntryType = entryType,
                Amount = amount,
                BalanceAfter = balanceAfter,
                TransactionType = MapLedgerTransactionType(type),
                ReferenceId = referenceId,
                ExternalReference = referenceType,
                Description = description,
                Metadata = metadata,
                CreatedAt = DateTime.UtcNow,
                Status = TransactionStatus.Completed
            };

            if (session == null)
            {
                await _ledger.InsertOneAsync(ledgerEntry);
            }
            else
            {
                await _ledger.InsertOneAsync(session, ledgerEntry);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write transaction ledger for user {UserId}", userId);
            if (!bestEffort)
            {
                throw;
            }
        }
    }

	    private static string MapLedgerTransactionType(TransactionType type)
	    {
	        return type switch
	        {
	            TransactionType.TransferIn => "transfer_in",
	            TransactionType.TransferOut => "transfer_out",
	            TransactionType.EscrowRelease => "escrow_release",
	            _ => type.ToString().ToLowerInvariant()
	        };
	    }

    /// <summary>
    /// Hashes PIN using PBKDF2 with 310,000 iterations and SHA256
    /// </summary>
    private static string HashPin(string pin)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        
        using var pbkdf2 = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes(pin),
            salt,
            PbkdfIterations,
            HashAlgorithmName.SHA256
        );
        
        var hash = pbkdf2.GetBytes(HashSize);
        
        // Combine salt + hash for storage
        var hashBytes = new byte[SaltSize + HashSize];
        Array.Copy(salt, 0, hashBytes, 0, SaltSize);
        Array.Copy(hash, 0, hashBytes, SaltSize, HashSize);
        
        return Convert.ToBase64String(hashBytes);
    }

    /// <summary>
    /// Verifies PIN against stored hash using constant-time comparison
    /// </summary>
    private static bool VerifyPinHash(string pin, string storedHash)
    {
        try
        {
            var hashBytes = Convert.FromBase64String(storedHash);
            
            if (hashBytes.Length != SaltSize + HashSize)
            {
                return false;
            }

            var salt = new byte[SaltSize];
            Array.Copy(hashBytes, 0, salt, 0, SaltSize);
            
            using var pbkdf2 = new Rfc2898DeriveBytes(
                Encoding.UTF8.GetBytes(pin),
                salt,
                PbkdfIterations,
                HashAlgorithmName.SHA256
            );
            
            var hash = pbkdf2.GetBytes(HashSize);
            
            // Constant-time comparison to prevent timing attacks
            return CryptographicOperations.FixedTimeEquals(
                new ReadOnlySpan<byte>(hashBytes, SaltSize, HashSize),
                hash
            );
        }
        catch
        {
            return false;
        }
    }
}
