using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface IUserCleanupService
{
    /// <summary>
    /// Validate if user can delete their account.
    /// Returns (canDelete, blockingReasons, warnings)
    /// </summary>
    Task<UserDeleteValidationResult> ValidateAccountDeletionAsync(uint userId);

    /// <summary>
    /// Hard delete all user data from MongoDB.
    /// Should only be called after Go backend has validated and is ready to delete.
    /// </summary>
    Task<UserCleanupResult> CleanupUserDataAsync(uint userId);
}

public record UserDeleteValidationResult(
    bool CanDelete,
    List<string> BlockingReasons,
    List<string> Warnings,
    long WalletBalance,
    int PendingTransfersAsSender,
    int PendingTransfersAsReceiver,
    int DisputedTransfers,
    int PendingTransactions,
    int PendingWithdrawals
);

public record UserCleanupResult(
    bool Success,
    string? Error,
    UserCleanupStats Stats
);

public record UserCleanupStats(
    int ReportsClosed,
    int DocumentsDeleted,
    int WalletsDeleted,
    int TransactionsDeleted
);

public class UserCleanupService : IUserCleanupService
{
    private readonly MongoDbContext _context;
    private readonly IMongoCollection<Transfer> _transfers;
    private readonly IMongoCollection<TransactionLedger> _ledger;
    private readonly IMongoCollection<Withdrawal> _withdrawals;
    private readonly ILogger<UserCleanupService> _logger;

    public UserCleanupService(MongoDbContext context, ILogger<UserCleanupService> logger)
    {
        _context = context;
        _transfers = context.GetCollection<Transfer>("transfers");
        _ledger = context.GetCollection<TransactionLedger>("transaction_ledger");
        _withdrawals = context.Withdrawals;
        _logger = logger;
    }

    public async Task<UserDeleteValidationResult> ValidateAccountDeletionAsync(uint userId)
    {
        var blockingReasons = new List<string>();
        var warnings = new List<string>();

        // 0. Check active profile guarantee (money is frozen, must be released first)
        var activeGuarantee = await _context.GuaranteeLocks
            .Find(g => g.UserId == userId && g.Status == GuaranteeStatus.Active)
            .FirstOrDefaultAsync();
        if (activeGuarantee != null)
        {
            blockingReasons.Add($"Anda masih memiliki jaminan aktif Rp {activeGuarantee.Amount:N0}. Lepaskan jaminan terlebih dahulu.");
        }

        // 1. Check wallet balance
        var wallet = await _context.Wallets
            .Find(w => w.UserId == userId)
            .FirstOrDefaultAsync();

        long walletBalance = wallet?.Balance ?? 0;
        if (walletBalance > 0)
        {
            blockingReasons.Add($"Saldo wallet masih Rp {walletBalance:N0}. Harap tarik saldo terlebih dahulu.");
        }

        // 2. Check pending transfers (as sender - money is held)
        var pendingAsSender = await _transfers.CountDocumentsAsync(t =>
            t.SenderId == userId &&
            (t.Status == TransferStatus.Pending || t.Status == TransferStatus.Disputed));

        if (pendingAsSender > 0)
        {
            blockingReasons.Add($"Ada {pendingAsSender} transfer tertunda sebagai pengirim. Tunggu hingga selesai atau selesaikan dispute.");
        }

        // 3. Check pending transfers (as receiver - waiting to receive)
        var pendingAsReceiver = await _transfers.CountDocumentsAsync(t =>
            t.ReceiverId == userId &&
            (t.Status == TransferStatus.Pending || t.Status == TransferStatus.Disputed));

        if (pendingAsReceiver > 0)
        {
            blockingReasons.Add($"Ada {pendingAsReceiver} transfer tertunda sebagai penerima. Terima atau selesaikan dispute terlebih dahulu.");
        }

        // 4. Check disputed transfers specifically
        var disputedCount = await _transfers.CountDocumentsAsync(t =>
            (t.SenderId == userId || t.ReceiverId == userId) &&
            t.Status == TransferStatus.Disputed);

        // 5. Check pending transactions in ledger
        var pendingLedger = await _ledger.CountDocumentsAsync(l =>
            l.UserId == (int)userId &&
            l.Status == TransactionStatus.Pending);

        if (pendingLedger > 0)
        {
            blockingReasons.Add($"Ada {pendingLedger} transaksi pending yang harus diselesaikan.");
        }

        // 6. Check pending withdrawals (critical - money is being processed)
        var pendingWithdrawals = await _withdrawals.CountDocumentsAsync(w =>
            w.UserId == userId &&
            (w.Status == WithdrawalStatus.Pending || w.Status == WithdrawalStatus.Processing));

        if (pendingWithdrawals > 0)
        {
            blockingReasons.Add($"Ada {pendingWithdrawals} penarikan dana yang sedang diproses. Tunggu hingga selesai.");
        }

        return new UserDeleteValidationResult(
            CanDelete: blockingReasons.Count == 0,
            BlockingReasons: blockingReasons,
            Warnings: warnings,
            WalletBalance: walletBalance,
            PendingTransfersAsSender: (int)pendingAsSender,
            PendingTransfersAsReceiver: (int)pendingAsReceiver,
            DisputedTransfers: (int)disputedCount,
            PendingTransactions: (int)pendingLedger,
            PendingWithdrawals: (int)pendingWithdrawals
        );
    }

    public async Task<UserCleanupResult> CleanupUserDataAsync(uint userId)
    {
        try
        {
            _logger.LogInformation("Starting cleanup for user {UserId}", userId);

            // Re-validate before cleanup
            var validation = await ValidateAccountDeletionAsync(userId);
            if (!validation.CanDelete)
            {
                return new UserCleanupResult(
                    Success: false,
                    Error: string.Join("; ", validation.BlockingReasons),
                    Stats: new UserCleanupStats(0, 0, 0, 0)
                );
            }

            // Hard delete all user data
            var stats = new UserCleanupStatsBuilder();

            // 1. Close/delete reports (where user is reporter)
            var reportsResult = await _context.Reports.DeleteManyAsync(r => r.ReporterUserId == userId);
            stats.ReportsClosed = (int)reportsResult.DeletedCount;

            // 4. Delete documents
            var docsResult = await _context.Documents.DeleteManyAsync(d => d.UserId == userId);
            stats.DocumentsDeleted = (int)docsResult.DeletedCount;

            // 5. Delete wallets
            var walletResult = await _context.Wallets.DeleteManyAsync(w => w.UserId == userId);
            stats.WalletsDeleted = (int)walletResult.DeletedCount;

            // 6. Delete transactions
            var transactionsColl = _context.GetCollection<Transaction>("transactions");
            var txResult = await transactionsColl.DeleteManyAsync(t => t.UserId == userId);
            stats.TransactionsDeleted = (int)txResult.DeletedCount;

            // 7. Delete transaction ledger entries
            await _ledger.DeleteManyAsync(l => l.UserId == (int)userId);

            // 8. Delete guarantee locks (historical)
            await _context.GuaranteeLocks.DeleteManyAsync(g => g.UserId == userId);

            // 9. Delete user warnings (where user is the target)
            await _context.UserWarnings.DeleteManyAsync(w => w.UserId == userId);

            // 10. Delete device bans for this user
            await _context.DeviceBans.DeleteManyAsync(d => d.UserId == userId);

            _logger.LogInformation("Cleanup completed for user {UserId}: {@Stats}", userId, stats.Build());

            return new UserCleanupResult(
                Success: true,
                Error: null,
                Stats: stats.Build()
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during cleanup for user {UserId}", userId);
            return new UserCleanupResult(
                Success: false,
                Error: "Internal error during cleanup. Please contact support.",
                Stats: new UserCleanupStats(0, 0, 0, 0)
            );
        }
    }
}

// Helper class to build stats
internal class UserCleanupStatsBuilder
{
    public int ReportsClosed { get; set; }
    public int DocumentsDeleted { get; set; }
    public int WalletsDeleted { get; set; }
    public int TransactionsDeleted { get; set; }

    public UserCleanupStats Build() => new(
        ReportsClosed,
        DocumentsDeleted,
        WalletsDeleted,
        TransactionsDeleted
    );
}
