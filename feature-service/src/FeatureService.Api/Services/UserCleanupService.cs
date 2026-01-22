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
    long TokenBalance,
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
    int RepliesDeleted,
    int ReactionsDeleted,
    int ReportsClosed,
    int ChatSessionsDeleted,
    int ChatMessagesDeleted,
    int DocumentsDeleted,
    int TokenBalancesDeleted,
    int TokenPurchasesDeleted,
    int TokenUsagesDeleted,
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

        // 1. Check wallet balance
        var wallet = await _context.Wallets
            .Find(w => w.UserId == userId)
            .FirstOrDefaultAsync();

        long walletBalance = wallet?.Balance ?? 0;
        if (walletBalance > 0)
        {
            blockingReasons.Add($"Saldo wallet masih Rp {walletBalance:N0}. Harap tarik saldo terlebih dahulu.");
        }

        // 2. Check token balance (warning only)
        var tokenBalance = await _context.TokenBalances
            .Find(t => t.UserId == userId)
            .FirstOrDefaultAsync();

        long tokenBal = tokenBalance?.Balance ?? 0;
        if (tokenBal > 0)
        {
            warnings.Add($"Anda memiliki {tokenBal:N0} token AI yang akan hilang.");
        }

        // 3. Check pending transfers (as sender - money is held)
        var pendingAsSender = await _transfers.CountDocumentsAsync(t =>
            t.SenderId == userId &&
            (t.Status == TransferStatus.Pending || t.Status == TransferStatus.Disputed));

        if (pendingAsSender > 0)
        {
            blockingReasons.Add($"Ada {pendingAsSender} transfer tertunda sebagai pengirim. Tunggu hingga selesai atau selesaikan dispute.");
        }

        // 4. Check pending transfers (as receiver - waiting to receive)
        var pendingAsReceiver = await _transfers.CountDocumentsAsync(t =>
            t.ReceiverId == userId &&
            (t.Status == TransferStatus.Pending || t.Status == TransferStatus.Disputed));

        if (pendingAsReceiver > 0)
        {
            blockingReasons.Add($"Ada {pendingAsReceiver} transfer tertunda sebagai penerima. Terima atau selesaikan dispute terlebih dahulu.");
        }

        // 5. Check disputed transfers specifically
        var disputedCount = await _transfers.CountDocumentsAsync(t =>
            (t.SenderId == userId || t.ReceiverId == userId) &&
            t.Status == TransferStatus.Disputed);

        // 6. Check pending transactions in ledger
        var pendingLedger = await _ledger.CountDocumentsAsync(l =>
            l.UserId == (int)userId &&
            l.Status == TransactionStatus.Pending);

        if (pendingLedger > 0)
        {
            blockingReasons.Add($"Ada {pendingLedger} transaksi pending yang harus diselesaikan.");
        }

        // 7. Check pending withdrawals (critical - money is being processed)
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
            TokenBalance: tokenBal,
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
                    Stats: new UserCleanupStats(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
                );
            }

            // Hard delete all user data
            var stats = new UserCleanupStatsBuilder();

            // 1. Delete replies
            var repliesResult = await _context.Replies.DeleteManyAsync(r => r.UserId == userId);
            stats.RepliesDeleted = (int)repliesResult.DeletedCount;

            // 2. Delete reactions
            var reactionsResult = await _context.Reactions.DeleteManyAsync(r => r.UserId == userId);
            stats.ReactionsDeleted = (int)reactionsResult.DeletedCount;

            // 3. Close/delete reports (where user is reporter)
            var reportsResult = await _context.Reports.DeleteManyAsync(r => r.ReporterUserId == userId);
            stats.ReportsClosed = (int)reportsResult.DeletedCount;

            // 4. Get all chat sessions for this user first, then delete messages
            var chatSessions = await _context.ChatSessions
                .Find(s => s.UserId == userId)
                .Project(s => s.Id)
                .ToListAsync();

            if (chatSessions.Count > 0)
            {
                var messagesResult = await _context.ChatMessages.DeleteManyAsync(m =>
                    chatSessions.Contains(m.SessionId));
                stats.ChatMessagesDeleted = (int)messagesResult.DeletedCount;
            }

            // 5. Delete chat sessions
            var sessionsResult = await _context.ChatSessions.DeleteManyAsync(s => s.UserId == userId);
            stats.ChatSessionsDeleted = (int)sessionsResult.DeletedCount;

            // 6. Delete documents
            var docsResult = await _context.Documents.DeleteManyAsync(d => d.UserId == userId);
            stats.DocumentsDeleted = (int)docsResult.DeletedCount;

            // 7. Delete token balances
            var tokenBalResult = await _context.TokenBalances.DeleteManyAsync(t => t.UserId == userId);
            stats.TokenBalancesDeleted = (int)tokenBalResult.DeletedCount;

            // 8. Delete token purchases
            var tokenPurchResult = await _context.TokenPurchases.DeleteManyAsync(t => t.UserId == userId);
            stats.TokenPurchasesDeleted = (int)tokenPurchResult.DeletedCount;

            // 9. Delete token usages
            var tokenUsageResult = await _context.TokenUsages.DeleteManyAsync(t => t.UserId == userId);
            stats.TokenUsagesDeleted = (int)tokenUsageResult.DeletedCount;

            // 10. Delete wallets
            var walletResult = await _context.Wallets.DeleteManyAsync(w => w.UserId == userId);
            stats.WalletsDeleted = (int)walletResult.DeletedCount;

            // 11. Delete transactions
            var transactionsColl = _context.GetCollection<Transaction>("transactions");
            var txResult = await transactionsColl.DeleteManyAsync(t => t.UserId == userId);
            stats.TransactionsDeleted = (int)txResult.DeletedCount;

            // 12. Delete transaction ledger entries
            await _ledger.DeleteManyAsync(l => l.UserId == (int)userId);

            // 13. Delete user warnings (where user is the target)
            await _context.UserWarnings.DeleteManyAsync(w => w.UserId == userId);

            // 14. Delete device bans for this user
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
                Stats: new UserCleanupStats(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
            );
        }
    }
}

// Helper class to build stats
internal class UserCleanupStatsBuilder
{
    public int RepliesDeleted { get; set; }
    public int ReactionsDeleted { get; set; }
    public int ReportsClosed { get; set; }
    public int ChatSessionsDeleted { get; set; }
    public int ChatMessagesDeleted { get; set; }
    public int DocumentsDeleted { get; set; }
    public int TokenBalancesDeleted { get; set; }
    public int TokenPurchasesDeleted { get; set; }
    public int TokenUsagesDeleted { get; set; }
    public int WalletsDeleted { get; set; }
    public int TransactionsDeleted { get; set; }

    public UserCleanupStats Build() => new(
        RepliesDeleted,
        ReactionsDeleted,
        ReportsClosed,
        ChatSessionsDeleted,
        ChatMessagesDeleted,
        DocumentsDeleted,
        TokenBalancesDeleted,
        TokenPurchasesDeleted,
        TokenUsagesDeleted,
        WalletsDeleted,
        TransactionsDeleted
    );
}
