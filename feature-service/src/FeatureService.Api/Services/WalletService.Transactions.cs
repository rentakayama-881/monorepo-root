using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class WalletService
{
    // === Transaction Processing Internals ===

    private async Task<T> TryWithMongoTransactionAsync<T>(
        Func<IClientSessionHandle, Task<T>> transactional,
        Func<Task<T>> fallback)
    {
        if (Volatile.Read(ref _transactionSupportState) == -1)
        {
            if (_environment.IsProduction() || _environment.IsStaging())
            {
                _logger.LogCritical(
                    "FATAL: MongoDB transactions not supported in {Environment}. Financial operations require a replica set.",
                    _environment.EnvironmentName);
                throw new InvalidOperationException(
                    "MongoDB transactions are required for financial operations in production. Please configure a replica set.");
            }

            return await fallback();
        }

        try
        {
            using var session = await _wallets.Database.Client.StartSessionAsync();
            session.StartTransaction();

            try
            {
                var result = await transactional(session);
                await session.CommitTransactionAsync();
                Volatile.Write(ref _transactionSupportState, 1);
                return result;
            }
            catch
            {
                await session.AbortTransactionAsync();
                throw;
            }
        }
        catch (NotSupportedException ex) when (IsTransactionsNotSupported(ex))
        {
            var previousState = Interlocked.Exchange(ref _transactionSupportState, -1);
            if (_environment.IsProduction() || _environment.IsStaging())
            {
                _logger.LogCritical(
                    ex,
                    "FATAL: MongoDB transactions not supported in {Environment}. Financial operations require a replica set.",
                    _environment.EnvironmentName);
                throw new InvalidOperationException(
                    "MongoDB transactions are required for financial operations in production. Please configure a replica set.",
                    ex);
            }

            if (previousState != -1)
            {
                _logger.LogWarning(ex, "MongoDB transactions not supported; falling back to non-transactional wallet updates (development only)");
            }
            return await fallback();
        }
        catch (MongoCommandException ex) when (IsTransactionsNotSupported(ex))
        {
            var previousState = Interlocked.Exchange(ref _transactionSupportState, -1);
            if (_environment.IsProduction() || _environment.IsStaging())
            {
                _logger.LogCritical(
                    ex,
                    "FATAL: MongoDB transactions not supported in {Environment}. Financial operations require a replica set.",
                    _environment.EnvironmentName);
                throw new InvalidOperationException(
                    "MongoDB transactions are required for financial operations in production. Please configure a replica set.",
                    ex);
            }

            if (previousState != -1)
            {
                _logger.LogWarning(ex, "MongoDB transactions not supported; falling back to non-transactional wallet updates (development only)");
            }
            return await fallback();
        }
    }

    private static bool IsTransactionsNotSupported(NotSupportedException ex)
    {
        // Driver may throw NotSupportedException for standalone servers:
        // "Standalone servers do not support transactions."
        return ex.Message.Contains("do not support transactions", StringComparison.OrdinalIgnoreCase)
               || ex.Message.Contains("transactions", StringComparison.OrdinalIgnoreCase);
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
                UserId = userId,
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
	            TransactionType.GuaranteeLock => "guarantee_lock",
	            TransactionType.GuaranteeRelease => "guarantee_release",
	            TransactionType.MarketPurchaseReserve => "market_purchase_reserve",
	            TransactionType.MarketPurchaseRelease => "market_purchase_release",
	            _ => type.ToString().ToLowerInvariant()
	        };
	    }
}
