using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class WalletService
{
    private async Task<string> AddBalanceInternalAsync(
        uint userId,
        long amount,
        string description,
        TransactionType type,
        string? referenceId,
        string? referenceType)
    {
        var now = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Atomic balance addition
            var updated = await _db.Wallets
                .Where(w => w.UserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.Balance, w => w.Balance + amount)
                    .SetProperty(w => w.UpdatedAt, now));

            if (updated == 0)
            {
                throw new InvalidOperationException("Wallet tidak ditemukan");
            }

            // Read updated wallet to determine balance before/after
            var wallet = await _db.Wallets.AsNoTracking().FirstAsync(w => w.UserId == userId);
            var balanceAfter = wallet.Balance;
            var balanceBefore = balanceAfter - amount;

            checked
            {
                _ = balanceBefore + amount;
            }

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

            _db.Transactions.Add(transaction);

            InsertLedgerEntry(
                userId,
                LedgerEntryType.Credit,
                amount,
                balanceAfter,
                type,
                referenceId ?? transaction.Id,
                referenceType,
                transaction.Id,
                description);

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            _logger.LogInformation(
                "Added {Amount} to user {UserId}. Balance: {Before} -> {After}",
                amount,
                userId,
                balanceBefore,
                balanceAfter);

            return transaction.Id;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private void InsertLedgerEntry(
        uint userId,
        LedgerEntryType entryType,
        long amount,
        long balanceAfter,
        TransactionType type,
        string referenceId,
        string? referenceType,
        string transactionId,
        string description)
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

        _db.TransactionLedger.Add(ledgerEntry);
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
