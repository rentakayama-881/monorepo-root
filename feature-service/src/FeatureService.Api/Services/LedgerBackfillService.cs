using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
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
    private readonly IMongoCollection<Transaction> _transactions;
    private readonly IMongoCollection<TransactionLedger> _ledger;
    private readonly ILogger<LedgerBackfillService> _logger;

    public LedgerBackfillService(MongoDbContext dbContext, ILogger<LedgerBackfillService> logger)
    {
        _transactions = dbContext.GetCollection<Transaction>("transactions");
        _ledger = dbContext.GetCollection<TransactionLedger>("transaction_ledger");
        _logger = logger;
    }

    public async Task<LedgerBackfillResult> BackfillAsync(uint? userId, int? limit, bool dryRun)
    {
        var filter = Builders<Transaction>.Filter.Empty;
        if (userId.HasValue && userId.Value > 0)
        {
            filter = Builders<Transaction>.Filter.Eq(t => t.UserId, userId.Value);
        }

        IFindFluent<Transaction, Transaction> find = _transactions.Find(filter);
        find = find.SortBy(t => t.CreatedAt);
        if (limit.HasValue && limit.Value > 0)
        {
            find = find.Limit(limit.Value);
        }

        var scanned = 0;
        var inserted = 0;
        var skippedExisting = 0;
        var skippedInvalid = 0;

        using var cursor = await find.ToCursorAsync();
        while (await cursor.MoveNextAsync())
        {
            foreach (var txn in cursor.Current)
            {
                scanned++;

                if (txn.Amount == 0)
                {
                    skippedInvalid++;
                    continue;
                }

                var exists = await _ledger.Find(l => l.Metadata != null &&
                                                    l.Metadata.ContainsKey("transaction_id") &&
                                                    l.Metadata["transaction_id"] == txn.Id)
                                           .AnyAsync();
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
                    UserId = (int)txn.UserId,
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
                    await _ledger.InsertOneAsync(ledgerEntry);
                }

                inserted++;
            }
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
