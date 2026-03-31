using FeatureService.Api.Models.Entities;
using FeatureService.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FeatureService.Api.Infrastructure.Persistence;

/// <summary>
/// Central EF Core DbContext — single source of truth for all Feature Service data.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // ── Financial ────────────────────────────────────────────────────
    public DbSet<UserWallet> Wallets => Set<UserWallet>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<TransactionLedger> TransactionLedger => Set<TransactionLedger>();
    public DbSet<Transfer> Transfers => Set<Transfer>();
    public DbSet<Dispute> Disputes => Set<Dispute>();
    public DbSet<DisputeEvidence> DisputeEvidence => Set<DisputeEvidence>();
    public DbSet<DisputeMessage> DisputeMessages => Set<DisputeMessage>();
    public DbSet<DepositRequest> DepositRequests => Set<DepositRequest>();
    public DbSet<Withdrawal> Withdrawals => Set<Withdrawal>();
    public DbSet<GuaranteeLock> GuaranteeLocks => Set<GuaranteeLock>();
    public DbSet<MarketPurchaseReservation> MarketPurchaseReservations => Set<MarketPurchaseReservation>();

    // ── Moderation ───────────────────────────────────────────────────
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<DeviceBan> DeviceBans => Set<DeviceBan>();
    public DbSet<UserWarning> UserWarnings => Set<UserWarning>();
    public DbSet<HiddenContent> HiddenContents => Set<HiddenContent>();
    public DbSet<AdminActionLog> AdminActionLogs => Set<AdminActionLog>();
    public DbSet<ValidationCaseOwnershipTransfer> ValidationCaseOwnershipTransfers => Set<ValidationCaseOwnershipTransfer>();

    // ── Documents ────────────────────────────────────────────────────
    public DbSet<Document> Documents => Set<Document>();

    // ── Security / PQC ───────────────────────────────────────────────
    public DbSet<UserPqcKey> UserPqcKeys => Set<UserPqcKey>();

    // ── Smart Browser ────────────────────────────────────────────────
    public DbSet<BrowserProfile> BrowserProfiles => Set<BrowserProfile>();
    public DbSet<BrowserSession> BrowserSessions => Set<BrowserSession>();
    public DbSet<BrowserPricing> BrowserPricings => Set<BrowserPricing>();

    // ── Audit ────────────────────────────────────────────────────────
    public DbSet<ImmutableAuditTrail> AuditTrails => Set<ImmutableAuditTrail>();

    // ── Idempotency ──────────────────────────────────────────────────
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations from this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // ── Enum conversions (store as text for readability) ─────────
        modelBuilder.HasPostgresEnum<WithdrawalStatus>();
        modelBuilder.HasPostgresEnum<DepositStatus>();
        modelBuilder.HasPostgresEnum<TransferStatus>();
        modelBuilder.HasPostgresEnum<TransactionType>();
        modelBuilder.HasPostgresEnum<GuaranteeStatus>();
        modelBuilder.HasPostgresEnum<DisputeCategory>();
        modelBuilder.HasPostgresEnum<DisputeStatus>();
        modelBuilder.HasPostgresEnum<ResolutionType>();
        modelBuilder.HasPostgresEnum<BrowserSessionStatus>();
        modelBuilder.HasPostgresEnum<TransactionStatus>();
        modelBuilder.HasPostgresEnum<AuditEventType>();
    }
}
