using FeatureService.Api.Models.Entities;
using FeatureService.Api.Domain.Entities;
using FeatureService.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FeatureService.Api.Infrastructure.Persistence.Configurations;

public class DocumentConfiguration : IEntityTypeConfiguration<Document>
{
    public void Configure(EntityTypeBuilder<Document> builder)
    {
        builder.ToTable("documents");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasMaxLength(30); // doc_xxx ULID

        builder.Property(d => d.UserId).IsRequired();
        builder.Property(d => d.Title).HasMaxLength(500).IsRequired();
        builder.Property(d => d.Description).HasMaxLength(2000);
        builder.Property(d => d.Category).HasMaxLength(30).IsRequired();
        builder.Property(d => d.Visibility).HasMaxLength(20).IsRequired();
        builder.Property(d => d.FileName).HasMaxLength(500).IsRequired();
        builder.Property(d => d.FileType).HasMaxLength(10).IsRequired();
        builder.Property(d => d.MimeType).HasMaxLength(100).IsRequired();
        builder.Property(d => d.FileSize).IsRequired();
        builder.Property(d => d.StoragePath).HasMaxLength(1000).IsRequired();
        builder.Property(d => d.PublicUrl).HasMaxLength(1000);
        builder.Property(d => d.DownloadCount).IsRequired().HasDefaultValue(0);
        builder.Property(d => d.SharedWithUserIds).HasColumnType("jsonb");
        builder.Property(d => d.Tags).HasColumnType("jsonb");

        builder.HasIndex(d => d.UserId);
        builder.HasIndex(d => d.Visibility);
        builder.HasIndex(d => d.Category);
        builder.HasIndex(d => d.CreatedAt).IsDescending();

        // Full-text search index on title and description
        builder.HasIndex(d => new { d.Title, d.Description })
            .HasDatabaseName("ix_documents_fulltext");
    }
}

public class UserPqcKeyConfiguration : IEntityTypeConfiguration<UserPqcKey>
{
    public void Configure(EntityTypeBuilder<UserPqcKey> builder)
    {
        builder.ToTable("user_pqc_keys");

        builder.HasKey(k => k.Id);
        builder.Property(k => k.Id).HasMaxLength(30);

        builder.Property(k => k.UserId).IsRequired();
        builder.Property(k => k.Username).HasMaxLength(100).IsRequired();
        builder.Property(k => k.KeyId).HasMaxLength(100).IsRequired();
        builder.Property(k => k.PublicKeyBase64).IsRequired();
        builder.Property(k => k.Algorithm).HasMaxLength(50).IsRequired();
        builder.Property(k => k.PublicKeyHash).HasMaxLength(128).IsRequired();
        builder.Property(k => k.DeviceFingerprint).HasMaxLength(200);
        builder.Property(k => k.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(k => k.RevokeReason).HasMaxLength(500);

        builder.HasIndex(k => k.UserId);
        builder.HasIndex(k => k.KeyId).IsUnique();
        builder.HasIndex(k => k.PublicKeyHash);
        builder.HasIndex(k => new { k.UserId, k.IsActive });
    }
}

public class BrowserProfileConfiguration : IEntityTypeConfiguration<BrowserProfile>
{
    public void Configure(EntityTypeBuilder<BrowserProfile> builder)
    {
        builder.ToTable("browser_profiles");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasMaxLength(30); // bpf_xxx ULID

        builder.Property(p => p.UserId).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(100).IsRequired();
        builder.Property(p => p.ProxyServer).HasMaxLength(500);
        builder.Property(p => p.ProxyUsername).HasMaxLength(200);
        builder.Property(p => p.ProxyPassword).HasMaxLength(500);
        builder.Property(p => p.UserAgentPreset).HasMaxLength(500);
        builder.Property(p => p.Notes).HasMaxLength(500);

        // Fingerprint as owned entity (columns in the same table)
        builder.OwnsOne(p => p.Fingerprint, fp =>
        {
            fp.Property(f => f.GpuVendor).HasColumnName("fp_gpu_vendor").HasMaxLength(200);
            fp.Property(f => f.GpuRenderer).HasColumnName("fp_gpu_renderer").HasMaxLength(200);
            fp.Property(f => f.ScreenWidth).HasColumnName("fp_screen_width");
            fp.Property(f => f.ScreenHeight).HasColumnName("fp_screen_height");
            fp.Property(f => f.ColorDepth).HasColumnName("fp_color_depth").HasDefaultValue(24);
            fp.Property(f => f.Platform).HasColumnName("fp_platform").HasMaxLength(50);
            fp.Property(f => f.Timezone).HasColumnName("fp_timezone").HasMaxLength(100);
            fp.Property(f => f.Language).HasColumnName("fp_language").HasMaxLength(20);
        });

        builder.HasIndex(p => p.UserId);
        builder.HasIndex(p => new { p.UserId, p.CreatedAt }).IsDescending(false, true);
    }
}

public class BrowserSessionConfiguration : IEntityTypeConfiguration<BrowserSession>
{
    public void Configure(EntityTypeBuilder<BrowserSession> builder)
    {
        builder.ToTable("browser_sessions");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasMaxLength(30); // bsn_xxx ULID

        builder.Property(s => s.UserId).IsRequired();
        builder.Property(s => s.ProfileId).HasMaxLength(30).IsRequired();
        builder.Property(s => s.ProfileName).HasMaxLength(100);
        builder.Property(s => s.Status).IsRequired();
        builder.Property(s => s.BilledMinutes).IsRequired().HasDefaultValue(0);
        builder.Property(s => s.TotalCost).IsRequired().HasDefaultValue(0L);
        builder.Property(s => s.StopReason).HasMaxLength(30);
        builder.Property(s => s.ErrorMessage).HasMaxLength(2000);

        // ProcessPids as owned entity (columns in same table)
        builder.OwnsOne(s => s.ProcessPids, pp =>
        {
            pp.Property(p => p.Xvfb).HasColumnName("pid_xvfb");
            pp.Property(p => p.Browser).HasColumnName("pid_browser");
            pp.Property(p => p.Vnc).HasColumnName("pid_vnc");
            pp.Property(p => p.Websockify).HasColumnName("pid_websockify");
        });

        builder.HasIndex(s => new { s.UserId, s.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(s => new { s.UserId, s.Status });
        builder.HasIndex(s => new { s.ProfileId, s.Status });
        builder.HasIndex(s => s.Status);
    }
}

public class BrowserPricingConfiguration : IEntityTypeConfiguration<BrowserPricing>
{
    public void Configure(EntityTypeBuilder<BrowserPricing> builder)
    {
        builder.ToTable("browser_pricing");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasMaxLength(30);

        builder.Property(p => p.PricePerHourIdr).IsRequired();
        builder.Property(p => p.BillingIntervalMinutes).IsRequired().HasDefaultValue(1);
        builder.Property(p => p.MinBalanceToStartIdr).IsRequired();
        builder.Property(p => p.MaxConcurrentSessions).IsRequired().HasDefaultValue(2);
        builder.Property(p => p.MaxSessionDurationMinutes).IsRequired().HasDefaultValue(720);
        builder.Property(p => p.IsActive).IsRequired().HasDefaultValue(true);
    }
}

public class ImmutableAuditTrailConfiguration : IEntityTypeConfiguration<ImmutableAuditTrail>
{
    public void Configure(EntityTypeBuilder<ImmutableAuditTrail> builder)
    {
        builder.ToTable("audit_trails");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasMaxLength(40);

        builder.Property(a => a.TransactionId).HasMaxLength(50).IsRequired();
        builder.Property(a => a.TransactionType).HasMaxLength(30).IsRequired();
        builder.Property(a => a.EventType).IsRequired();
        builder.Property(a => a.ActorUserId).IsRequired();
        builder.Property(a => a.ActorUsername).HasMaxLength(100).IsRequired();
        builder.Property(a => a.Details).HasColumnType("jsonb");
        builder.Property(a => a.PreviousEntryHash).HasMaxLength(256);
        builder.Property(a => a.EntryHash).HasMaxLength(256).IsRequired();
        builder.Property(a => a.PqcKeyId).HasMaxLength(100);
        builder.Property(a => a.IpAddress).HasMaxLength(50);
        builder.Property(a => a.UserAgent).HasMaxLength(500);
        builder.Property(a => a.IdempotencyKey).HasMaxLength(100);
        builder.Property(a => a.SequenceNumber).IsRequired();

        builder.HasIndex(a => new { a.TransactionId, a.CreatedAt });
        builder.HasIndex(a => a.SequenceNumber).IsUnique();
    }
}

public class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("idempotency_records");

        builder.HasKey(i => i.Key);
        builder.Property(i => i.Key).HasMaxLength(200);

        builder.Property(i => i.Status).HasMaxLength(20).IsRequired();
        builder.Property(i => i.ResultJson).HasColumnType("jsonb");

        builder.HasIndex(i => i.ExpiresAt);
        builder.HasIndex(i => i.Status);
    }
}
