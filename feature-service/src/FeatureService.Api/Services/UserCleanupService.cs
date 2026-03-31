using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Domain.Entities;

namespace FeatureService.Api.Services;

public interface IUserCleanupService
{
    /// <summary>
    /// Validate if user can delete their account.
    /// Returns (canDelete, blockingReasons, warnings)
    /// </summary>
    Task<UserDeleteValidationResult> ValidateAccountDeletionAsync(uint userId);

    /// <summary>
    /// Hard delete all user data from PostgreSQL.
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
    private readonly AppDbContext _db;
    private readonly IAuditTrailService _auditService;
    private readonly ILogger<UserCleanupService> _logger;

    public UserCleanupService(
        AppDbContext db,
        IAuditTrailService auditService,
        ILogger<UserCleanupService> logger)
    {
        _db = db;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<UserDeleteValidationResult> ValidateAccountDeletionAsync(uint userId)
    {
        var blockingReasons = new List<string>();
        var warnings = new List<string>();

        // 0. Check active profile guarantee (money is frozen, must be released first)
        var activeGuarantee = await _db.GuaranteeLocks
            .FirstOrDefaultAsync(g => g.UserId == userId && g.Status == GuaranteeStatus.Active);
        if (activeGuarantee != null)
        {
            blockingReasons.Add($"Anda masih memiliki jaminan aktif Rp {activeGuarantee.Amount:N0}. Lepaskan jaminan terlebih dahulu.");
        }

        // 1. Check wallet balance
        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == userId);

        long walletBalance = wallet?.Balance ?? 0;
        if (walletBalance > 0)
        {
            blockingReasons.Add($"Saldo wallet masih Rp {walletBalance:N0}. Harap tarik saldo terlebih dahulu.");
        }

        // 2. Check pending transfers (as sender - money is held)
        var pendingAsSender = await _db.Transfers.CountAsync(t =>
            t.SenderId == userId &&
            (t.Status == TransferStatus.Pending || t.Status == TransferStatus.Disputed));

        if (pendingAsSender > 0)
        {
            blockingReasons.Add($"Ada {pendingAsSender} transfer tertunda sebagai pengirim. Tunggu hingga selesai atau selesaikan dispute.");
        }

        // 3. Check pending transfers (as receiver - waiting to receive)
        var pendingAsReceiver = await _db.Transfers.CountAsync(t =>
            t.ReceiverId == userId &&
            (t.Status == TransferStatus.Pending || t.Status == TransferStatus.Disputed));

        if (pendingAsReceiver > 0)
        {
            blockingReasons.Add($"Ada {pendingAsReceiver} transfer tertunda sebagai penerima. Terima atau selesaikan dispute terlebih dahulu.");
        }

        // 4. Check disputed transfers specifically
        var disputedCount = await _db.Transfers.CountAsync(t =>
            (t.SenderId == userId || t.ReceiverId == userId) &&
            t.Status == TransferStatus.Disputed);

        // 5. Check pending transactions in ledger
        var pendingLedger = await _db.TransactionLedger.CountAsync(l =>
            l.UserId == (int)userId &&
            l.Status == TransactionStatus.Pending);

        if (pendingLedger > 0)
        {
            blockingReasons.Add($"Ada {pendingLedger} transaksi pending yang harus diselesaikan.");
        }

        // 6. Check pending withdrawals (critical - money is being processed)
        var pendingWithdrawals = await _db.Withdrawals.CountAsync(w =>
            w.UserId == userId &&
            w.Status == WithdrawalStatus.Processing);

        if (pendingWithdrawals > 0)
        {
            blockingReasons.Add($"Ada {pendingWithdrawals} penarikan dana yang sedang diproses. Tunggu hingga selesai.");
        }

        return new UserDeleteValidationResult(
            CanDelete: blockingReasons.Count == 0,
            BlockingReasons: blockingReasons,
            Warnings: warnings,
            WalletBalance: walletBalance,
            PendingTransfersAsSender: pendingAsSender,
            PendingTransfersAsReceiver: pendingAsReceiver,
            DisputedTransfers: disputedCount,
            PendingTransactions: pendingLedger,
            PendingWithdrawals: pendingWithdrawals
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

            var auditTransactionId = $"cleanup_{userId}_{DateTime.UtcNow:yyyyMMddHHmmss}";

            // Record data deletion initiated
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = auditTransactionId,
                TransactionType = AuditTransactionTypes.AccountLifecycle,
                EventType = AuditEventType.DataDeletionInitiated,
                ActorUserId = userId,
                ActorUsername = $"user_{userId}",
                Details = new Dictionary<string, string>
                {
                    ["action"] = AuditActions.DeletionValidated,
                    ["walletBalance"] = validation.WalletBalance.ToString()
                }
            });

            // Hard delete all user data
            var stats = new UserCleanupStatsBuilder();

            // 1. Close/delete reports (where user is reporter)
            var reportsDeleted = await _db.Reports.Where(r => r.ReporterUserId == userId).ExecuteDeleteAsync();
            stats.ReportsClosed = reportsDeleted;

            // 4. Delete documents
            var docsDeleted = await _db.Documents.Where(d => d.UserId == userId).ExecuteDeleteAsync();
            stats.DocumentsDeleted = docsDeleted;

            // 5. Delete wallets
            var walletDeleted = await _db.Wallets.Where(w => w.UserId == userId).ExecuteDeleteAsync();
            stats.WalletsDeleted = walletDeleted;

            // 6. Delete transactions
            var txDeleted = await _db.Transactions.Where(t => t.UserId == userId).ExecuteDeleteAsync();
            stats.TransactionsDeleted = txDeleted;

            // 7. Delete transaction ledger entries
            var ledgerDeleted = await _db.TransactionLedger.Where(l => l.UserId == (int)userId).ExecuteDeleteAsync();

            // 8. Delete guarantee locks (historical)
            var guaranteeDeleted = await _db.GuaranteeLocks.Where(g => g.UserId == userId).ExecuteDeleteAsync();

            // 9. Delete user warnings (where user is the target)
            var warningsDeleted = await _db.UserWarnings.Where(w => w.UserId == userId).ExecuteDeleteAsync();

            // 10. Delete device bans for this user
            var deviceBansDeleted = await _db.DeviceBans.Where(d => d.UserId == userId).ExecuteDeleteAsync();

            // Record account deleted with full deletion stats
            await _auditService.RecordEventAsync(new AuditEventRequest
            {
                TransactionId = auditTransactionId,
                TransactionType = AuditTransactionTypes.AccountLifecycle,
                EventType = AuditEventType.AccountDeleted,
                ActorUserId = userId,
                ActorUsername = $"user_{userId}",
                Details = new Dictionary<string, string>
                {
                    ["action"] = AuditActions.DeletionCompleted,
                    ["reportsDeleted"] = stats.ReportsClosed.ToString(),
                    ["documentsDeleted"] = stats.DocumentsDeleted.ToString(),
                    ["walletsDeleted"] = stats.WalletsDeleted.ToString(),
                    ["transactionsDeleted"] = stats.TransactionsDeleted.ToString(),
                    ["ledgerEntriesDeleted"] = ledgerDeleted.ToString(),
                    ["guaranteeLocksDeleted"] = guaranteeDeleted.ToString(),
                    ["userWarningsDeleted"] = warningsDeleted.ToString(),
                    ["deviceBansDeleted"] = deviceBansDeleted.ToString()
                }
            });

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

            // Record deletion failure in audit trail (best effort)
            try
            {
                await _auditService.RecordEventAsync(new AuditEventRequest
                {
                    TransactionId = $"cleanup_{userId}_{DateTime.UtcNow:yyyyMMddHHmmss}",
                    TransactionType = AuditTransactionTypes.AccountLifecycle,
                    EventType = AuditEventType.DataDeletionInitiated,
                    ActorUserId = userId,
                    ActorUsername = $"user_{userId}",
                    Details = new Dictionary<string, string>
                    {
                        ["action"] = AuditActions.DeletionFailed,
                        ["error"] = ex.Message
                    }
                });
            }
            catch (Exception auditEx)
            {
                _logger.LogWarning(auditEx, "Failed to record deletion failure audit for user {UserId}", userId);
            }

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
