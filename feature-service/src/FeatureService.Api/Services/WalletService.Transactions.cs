using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class WalletService
{
    // === Transaction Processing Internals ===

    private async Task<(bool success, string? error, string? transactionId)> DeductBalanceInternalAsync(
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
            // Atomic balance deduction - WHERE clause ensures sufficient balance
            var updated = await _db.Wallets
                .Where(w => w.UserId == userId && w.Balance >= amount)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.Balance, w => w.Balance - amount)
                    .SetProperty(w => w.UpdatedAt, now));

            if (updated == 0)
            {
                await tx.RollbackAsync();
                return (false, "Saldo tidak mencukupi", null);
            }

            // Read updated wallet to determine balance before/after
            var wallet = await _db.Wallets.AsNoTracking().FirstAsync(w => w.UserId == userId);
            var balanceAfter = wallet.Balance;
            var balanceBefore = balanceAfter + amount;

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

            _db.Transactions.Add(transaction);

            InsertLedgerEntry(
                userId,
                LedgerEntryType.Debit,
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
                "Deducted {Amount} from user {UserId}. Balance: {Before} -> {After}",
                amount,
                userId,
                balanceBefore,
                balanceAfter);

            return (true, null, transaction.Id);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
