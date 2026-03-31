using FeatureService.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FeatureService.Api.Infrastructure.Persistence.Configurations;

public class TransferConfiguration : IEntityTypeConfiguration<Transfer>
{
    public void Configure(EntityTypeBuilder<Transfer> builder)
    {
        builder.ToTable("transfers");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasMaxLength(30); // trf_xxx ULID

        builder.Property(t => t.Code).HasMaxLength(8).IsRequired();
        builder.Property(t => t.SenderId).IsRequired();
        builder.Property(t => t.SenderUsername).HasMaxLength(100).IsRequired();
        builder.Property(t => t.ReceiverId).IsRequired();
        builder.Property(t => t.ReceiverUsername).HasMaxLength(100).IsRequired();
        builder.Property(t => t.Amount).IsRequired();
        builder.Property(t => t.Message).HasMaxLength(500);
        builder.Property(t => t.CaseLockKey).HasMaxLength(100);
        builder.Property(t => t.Status).IsRequired();
        builder.Property(t => t.CancelReason).HasMaxLength(500);

        builder.HasIndex(t => t.Code).IsUnique();
        builder.HasIndex(t => new { t.SenderId, t.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(t => new { t.ReceiverId, t.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(t => new { t.Status, t.HoldUntil });

        // Partial unique index: only one pending transfer per CaseLockKey
        builder.HasIndex(t => t.CaseLockKey)
            .IsUnique()
            .HasFilter("\"CaseLockKey\" IS NOT NULL AND \"Status\" = 'Pending'");
    }
}

public class DisputeConfiguration : IEntityTypeConfiguration<Dispute>
{
    public void Configure(EntityTypeBuilder<Dispute> builder)
    {
        builder.ToTable("disputes");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasMaxLength(30);

        builder.Property(d => d.TransferId).HasMaxLength(30).IsRequired();
        builder.Property(d => d.InitiatorId).IsRequired();
        builder.Property(d => d.InitiatorUsername).HasMaxLength(100).IsRequired();
        builder.Property(d => d.RespondentId).IsRequired();
        builder.Property(d => d.RespondentUsername).HasMaxLength(100).IsRequired();
        builder.Property(d => d.SenderId).IsRequired();
        builder.Property(d => d.SenderUsername).HasMaxLength(100).IsRequired();
        builder.Property(d => d.ReceiverId).IsRequired();
        builder.Property(d => d.ReceiverUsername).HasMaxLength(100).IsRequired();
        builder.Property(d => d.Reason).HasMaxLength(1000).IsRequired();
        builder.Property(d => d.Category).IsRequired();
        builder.Property(d => d.Status).IsRequired();
        builder.Property(d => d.Amount).IsRequired();
        builder.Property(d => d.ResolvedByUsername).HasMaxLength(100);

        // Resolution as owned entity (stored in same table as JSON or columns)
        builder.OwnsOne(d => d.Resolution, res =>
        {
            res.Property(r => r.Type).HasColumnName("resolution_type");
            res.Property(r => r.RefundToSender).HasColumnName("resolution_refund_to_sender");
            res.Property(r => r.ReleaseToReceiver).HasColumnName("resolution_release_to_receiver");
            res.Property(r => r.Note).HasColumnName("resolution_note").HasMaxLength(1000);
        });

        // Navigation properties for evidence and messages
        builder.HasMany(d => d.Evidence)
            .WithOne()
            .HasForeignKey(e => e.DisputeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(d => d.Messages)
            .WithOne()
            .HasForeignKey(m => m.DisputeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.TransferId).IsUnique();
        builder.HasIndex(d => new { d.InitiatorId, d.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(d => new { d.Status, d.CreatedAt }).IsDescending(false, true);
    }
}

public class DisputeEvidenceConfiguration : IEntityTypeConfiguration<DisputeEvidence>
{
    public void Configure(EntityTypeBuilder<DisputeEvidence> builder)
    {
        builder.ToTable("dispute_evidence");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasMaxLength(40);

        builder.Property(e => e.DisputeId).HasMaxLength(30).IsRequired();
        builder.Property(e => e.Type).HasMaxLength(30).IsRequired();
        builder.Property(e => e.Url).HasMaxLength(1000).IsRequired();
        builder.Property(e => e.Description).HasMaxLength(500);
        builder.Property(e => e.UploadedById).IsRequired();
    }
}

public class DisputeMessageConfiguration : IEntityTypeConfiguration<DisputeMessage>
{
    public void Configure(EntityTypeBuilder<DisputeMessage> builder)
    {
        builder.ToTable("dispute_messages");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasMaxLength(40);

        builder.Property(m => m.DisputeId).HasMaxLength(30).IsRequired();
        builder.Property(m => m.SenderId).IsRequired();
        builder.Property(m => m.SenderUsername).HasMaxLength(100).IsRequired();
        builder.Property(m => m.IsAdmin).IsRequired().HasDefaultValue(false);
        builder.Property(m => m.Content).HasMaxLength(5000).IsRequired();
    }
}

public class DepositRequestConfiguration : IEntityTypeConfiguration<DepositRequest>
{
    public void Configure(EntityTypeBuilder<DepositRequest> builder)
    {
        builder.ToTable("deposit_requests");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasMaxLength(30);

        builder.Property(d => d.UserId).IsRequired();
        builder.Property(d => d.Username).HasMaxLength(100).IsRequired();
        builder.Property(d => d.Amount).IsRequired();
        builder.Property(d => d.PlatformFee).IsRequired();
        builder.Property(d => d.TrackId).HasMaxLength(100);
        builder.Property(d => d.PayCurrency).HasMaxLength(20).IsRequired();
        builder.Property(d => d.PayAmount).HasMaxLength(50).IsRequired();
        builder.Property(d => d.Network).HasMaxLength(50).IsRequired();
        builder.Property(d => d.Address).HasMaxLength(200).IsRequired();
        builder.Property(d => d.QrCode).HasMaxLength(1000);
        builder.Property(d => d.Rate).HasMaxLength(50);
        builder.Property(d => d.Status).IsRequired();
        builder.Property(d => d.OxaPayStatus).HasMaxLength(50);
        builder.Property(d => d.WalletTransactionId).HasMaxLength(30);

        builder.HasIndex(d => new { d.UserId, d.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(d => d.Status);
        builder.HasIndex(d => d.TrackId);
    }
}

public class WithdrawalConfiguration : IEntityTypeConfiguration<Withdrawal>
{
    public void Configure(EntityTypeBuilder<Withdrawal> builder)
    {
        builder.ToTable("withdrawals");

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).HasMaxLength(30);

        builder.Property(w => w.UserId).IsRequired();
        builder.Property(w => w.Username).HasMaxLength(100).IsRequired();
        builder.Property(w => w.Amount).IsRequired();
        builder.Property(w => w.Fee).IsRequired();
        builder.Property(w => w.NetAmount).IsRequired();
        builder.Property(w => w.CryptoAddress).HasMaxLength(200).IsRequired();
        builder.Property(w => w.CryptoCurrency).HasMaxLength(20).IsRequired();
        builder.Property(w => w.CryptoNetwork).HasMaxLength(50);
        builder.Property(w => w.CryptoAmount).HasMaxLength(50);
        builder.Property(w => w.Memo).HasMaxLength(200);
        builder.Property(w => w.TrackId).HasMaxLength(100);
        builder.Property(w => w.OxaPayStatus).HasMaxLength(50);
        builder.Property(w => w.TxHash).HasMaxLength(200);
        builder.Property(w => w.Status).IsRequired();
        builder.Property(w => w.Reference).HasMaxLength(100).IsRequired();
        builder.Property(w => w.FailureReason).HasMaxLength(500);

        builder.HasIndex(w => new { w.UserId, w.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(w => new { w.Status, w.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(w => w.TrackId);
        builder.HasIndex(w => w.Reference).IsUnique();

        // Partial unique: only one active withdrawal per user
        builder.HasIndex(w => w.UserId)
            .IsUnique()
            .HasDatabaseName("ix_withdrawals_user_active")
            .HasFilter("\"Status\" = 'Processing'");
    }
}

public class GuaranteeLockConfiguration : IEntityTypeConfiguration<GuaranteeLock>
{
    public void Configure(EntityTypeBuilder<GuaranteeLock> builder)
    {
        builder.ToTable("guarantee_locks");

        builder.HasKey(g => g.Id);
        builder.Property(g => g.Id).HasMaxLength(30); // grt_xxx ULID

        builder.Property(g => g.UserId).IsRequired();
        builder.Property(g => g.Amount).IsRequired();
        builder.Property(g => g.Status).IsRequired();

        builder.HasIndex(g => g.UserId);

        // Partial unique: only one active guarantee per user
        builder.HasIndex(g => new { g.UserId, g.Status })
            .IsUnique()
            .HasDatabaseName("ix_guarantee_locks_user_active")
            .HasFilter("\"Status\" = 'Active'");
    }
}

public class MarketPurchaseReservationConfiguration : IEntityTypeConfiguration<MarketPurchaseReservation>
{
    public void Configure(EntityTypeBuilder<MarketPurchaseReservation> builder)
    {
        builder.ToTable("market_purchase_reservations");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasMaxLength(30);

        builder.Property(m => m.OrderId).HasMaxLength(50).IsRequired();
        builder.Property(m => m.UserId).IsRequired();
        builder.Property(m => m.AmountIdr).IsRequired();
        builder.Property(m => m.Status).HasMaxLength(20).IsRequired();
        builder.Property(m => m.ReserveTransactionId).HasMaxLength(30);
        builder.Property(m => m.ReleaseTransactionId).HasMaxLength(30);
        builder.Property(m => m.Reason).HasMaxLength(500);

        builder.HasIndex(m => new { m.UserId, m.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(m => new { m.Status, m.UpdatedAt }).IsDescending(false, true);
        builder.HasIndex(m => new { m.OrderId, m.UserId }).IsUnique();
    }
}
