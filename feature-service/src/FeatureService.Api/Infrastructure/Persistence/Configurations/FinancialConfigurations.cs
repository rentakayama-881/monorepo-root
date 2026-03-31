using FeatureService.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FeatureService.Api.Infrastructure.Persistence.Configurations;

public class UserWalletConfiguration : IEntityTypeConfiguration<UserWallet>
{
    public void Configure(EntityTypeBuilder<UserWallet> builder)
    {
        builder.ToTable("wallets");

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).HasMaxLength(30); // wlt_xxx ULID

        builder.Property(w => w.UserId).IsRequired();
        builder.Property(w => w.Balance).IsRequired().HasDefaultValue(0L);
        builder.Property(w => w.PinHash).HasMaxLength(512);
        builder.Property(w => w.PinSet).IsRequired().HasDefaultValue(false);
        builder.Property(w => w.FailedPinAttempts).IsRequired().HasDefaultValue(0);

        builder.HasIndex(w => w.UserId).IsUnique();
    }
}

public class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("transactions");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasMaxLength(30); // txn_xxx ULID

        builder.Property(t => t.UserId).IsRequired();
        builder.Property(t => t.Type).IsRequired();
        builder.Property(t => t.Amount).IsRequired();
        builder.Property(t => t.BalanceBefore).IsRequired();
        builder.Property(t => t.BalanceAfter).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(500);
        builder.Property(t => t.ReferenceId).HasMaxLength(50);
        builder.Property(t => t.ReferenceType).HasMaxLength(30);
        builder.Property(t => t.Metadata).HasColumnType("jsonb");

        builder.HasIndex(t => new { t.UserId, t.CreatedAt })
            .IsDescending(false, true);
    }
}

public class TransactionLedgerConfiguration : IEntityTypeConfiguration<TransactionLedger>
{
    public void Configure(EntityTypeBuilder<TransactionLedger> builder)
    {
        builder.ToTable("transaction_ledger");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).HasMaxLength(30); // led_xxx ULID

        builder.Property(l => l.UserId).IsRequired();
        builder.Property(l => l.TransactionType).HasMaxLength(30).IsRequired();
        builder.Property(l => l.EntryType).IsRequired();
        builder.Property(l => l.Amount).IsRequired();
        builder.Property(l => l.BalanceAfter).IsRequired();
        builder.Property(l => l.Status).IsRequired();
        builder.Property(l => l.ReferenceId).HasMaxLength(50);
        builder.Property(l => l.ExternalReference).HasMaxLength(200);
        builder.Property(l => l.CounterpartyUserId);
        builder.Property(l => l.Description).HasMaxLength(500);
        builder.Property(l => l.Metadata).HasColumnType("jsonb");

        builder.HasIndex(l => new { l.UserId, l.CreatedAt })
            .IsDescending(false, true);
    }
}
