using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface ILedgerBackfillService
{
    Task<LedgerBackfillResult> BackfillAsync(uint? userId, int? limit, bool dryRun);
}

public record LedgerBackfillResult(
    int Scanned,
    int Inserted,
    int SkippedExisting,
    int SkippedInvalid
);

public class LedgerBackfillService : ILedgerBackfillService
{
    private readonly AppDbContext _db;
    private readonly ILogger<LedgerBackfillService> _logger;

    public LedgerBackfillService(AppDbContext db, ILogger<LedgerBackfillService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<LedgerBackfillResult> BackfillAsync(uint? userId, int? limit, bool dryRun)
    {
        var query = _db.Transactions.AsQueryable();
        if (userId.HasValue && userId.Value > 0)
        {
            query = query.Where(t => t.UserId == userId.Value);
        }

        query = query.OrderBy(t => t.CreatedAt);
        if (limit.HasValue && limit.Value > 0)
        {
            query = query.Take(limit.Value);
        }

        var transactions = await query.ToListAsync();

        var scanned = 0;
        var inserted = 0;
        var skippedExisting = 0;
        var skippedInvalid = 0;

        foreach (var txn in transactions)
        {
            scanned++;

            if (txn.Amount == 0)
            {
                skippedInvalid++;
                continue;
            }

            var exists = await _db.TransactionLedger
                .AnyAsync(l => l.ReferenceId == txn.Id);

            if (exists)
            {
                skippedExisting++;
                continue;
            }

            var entryType = txn.Amount < 0 ? LedgerEntryType.Debit : LedgerEntryType.Credit;
            var amount = Math.Abs(txn.Amount);

            var metadata = new Dictionary<string, string>
            {
                ["transaction_id"] = txn.Id
            };

            if (!string.IsNullOrEmpty(txn.ReferenceType))
            {
                metadata["reference_type"] = txn.ReferenceType!;
            }

            var ledgerEntry = new TransactionLedger
            {
                UserId = txn.UserId,
                EntryType = entryType,
                Amount = amount,
                BalanceAfter = txn.BalanceAfter,
                TransactionType = MapLedgerTransactionType(txn.Type),
                ReferenceId = txn.ReferenceId ?? txn.Id,
                ExternalReference = txn.ReferenceType,
                Description = txn.Description,
                Metadata = metadata,
                CreatedAt = txn.CreatedAt,
                Status = TransactionStatus.Completed
            };

            if (!dryRun)
            {
                _db.TransactionLedger.Add(ledgerEntry);
                await _db.SaveChangesAsync();
            }

            inserted++;
        }

        _logger.LogInformation(
            "Ledger backfill completed. Scanned: {Scanned}, Inserted: {Inserted}, SkippedExisting: {SkippedExisting}, SkippedInvalid: {SkippedInvalid}, DryRun: {DryRun}",
            scanned, inserted, skippedExisting, skippedInvalid, dryRun);

        return new LedgerBackfillResult(scanned, inserted, skippedExisting, skippedInvalid);
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
            _ => type.ToString().ToLowerInvariant()
        };
    }
}
