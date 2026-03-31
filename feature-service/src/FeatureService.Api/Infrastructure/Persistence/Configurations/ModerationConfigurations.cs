using FeatureService.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FeatureService.Api.Infrastructure.Persistence.Configurations;

public class ReportConfiguration : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> builder)
    {
        builder.ToTable("reports");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasMaxLength(30); // rpt_xxx ULID

        builder.Property(r => r.TargetType).HasMaxLength(30).IsRequired();
        builder.Property(r => r.TargetId).HasMaxLength(50).IsRequired();
        builder.Property(r => r.ValidationCaseId).IsRequired();
        builder.Property(r => r.ReportedUserId).IsRequired();
        builder.Property(r => r.ReporterUserId).IsRequired();
        builder.Property(r => r.Reason).HasMaxLength(30).IsRequired();
        builder.Property(r => r.Description).HasMaxLength(2000);
        builder.Property(r => r.Status).HasMaxLength(20).IsRequired();
        builder.Property(r => r.ActionTaken).HasMaxLength(20);
        builder.Property(r => r.AdminNotes).HasMaxLength(2000);

        builder.HasIndex(r => r.Status);
        builder.HasIndex(r => r.ReporterUserId);
        builder.HasIndex(r => new { r.TargetType, r.TargetId });
        builder.HasIndex(r => r.CreatedAt).IsDescending();
    }
}

public class DeviceBanConfiguration : IEntityTypeConfiguration<DeviceBan>
{
    public void Configure(EntityTypeBuilder<DeviceBan> builder)
    {
        builder.ToTable("device_bans");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasMaxLength(30); // dbn_xxx ULID

        builder.Property(d => d.DeviceFingerprint).HasMaxLength(200).IsRequired();
        builder.Property(d => d.UserId).IsRequired();
        builder.Property(d => d.Reason).HasMaxLength(1000).IsRequired();
        builder.Property(d => d.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(d => d.IsPermanent).IsRequired().HasDefaultValue(true);
        builder.Property(d => d.BannedByAdminId).IsRequired();
        builder.Property(d => d.UnbannedByAdminId);

        builder.HasIndex(d => d.DeviceFingerprint);
        builder.HasIndex(d => d.IsActive);
        builder.HasIndex(d => d.UserId);
    }
}

public class UserWarningConfiguration : IEntityTypeConfiguration<UserWarning>
{
    public void Configure(EntityTypeBuilder<UserWarning> builder)
    {
        builder.ToTable("user_warnings");

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).HasMaxLength(30); // wrn_xxx ULID

        builder.Property(w => w.UserId).IsRequired();
        builder.Property(w => w.ReportId).HasMaxLength(30);
        builder.Property(w => w.Reason).HasMaxLength(1000).IsRequired();
        builder.Property(w => w.Message).HasMaxLength(2000).IsRequired();
        builder.Property(w => w.Severity).HasMaxLength(20).IsRequired();
        builder.Property(w => w.IssuedByAdminId).IsRequired();
        builder.Property(w => w.Acknowledged).IsRequired().HasDefaultValue(false);

        builder.HasIndex(w => w.UserId);
        builder.HasIndex(w => w.CreatedAt).IsDescending();
    }
}

public class HiddenContentConfiguration : IEntityTypeConfiguration<HiddenContent>
{
    public void Configure(EntityTypeBuilder<HiddenContent> builder)
    {
        builder.ToTable("hidden_contents");

        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).HasMaxLength(30); // hdn_xxx ULID

        builder.Property(h => h.ContentType).HasMaxLength(30).IsRequired();
        builder.Property(h => h.ContentId).HasMaxLength(50).IsRequired();
        builder.Property(h => h.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(h => h.HiddenByAdminId).IsRequired();
        builder.Property(h => h.Reason).HasMaxLength(1000);
        builder.Property(h => h.UnhiddenByAdminId);
        builder.Property(h => h.UnhidReason).HasMaxLength(1000);

        builder.HasIndex(h => new { h.ContentType, h.ContentId });
        builder.HasIndex(h => h.IsActive);
    }
}

public class AdminActionLogConfiguration : IEntityTypeConfiguration<AdminActionLog>
{
    public void Configure(EntityTypeBuilder<AdminActionLog> builder)
    {
        builder.ToTable("admin_action_logs");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasMaxLength(30); // aal_xxx ULID

        builder.Property(a => a.AdminId).IsRequired();
        builder.Property(a => a.AdminEmail).HasMaxLength(200);
        builder.Property(a => a.ActionType).HasMaxLength(30).IsRequired();
        builder.Property(a => a.TargetType).HasMaxLength(30).IsRequired();
        builder.Property(a => a.TargetId).HasMaxLength(50).IsRequired();
        builder.Property(a => a.ActionDetails).HasColumnType("jsonb");
        builder.Property(a => a.IpAddress).HasMaxLength(50);
        builder.Property(a => a.UserAgent).HasMaxLength(500);

        builder.HasIndex(a => a.AdminId);
        builder.HasIndex(a => a.ActionType);
        builder.HasIndex(a => a.CreatedAt).IsDescending();
    }
}

public class ValidationCaseOwnershipTransferConfiguration : IEntityTypeConfiguration<ValidationCaseOwnershipTransfer>
{
    public void Configure(EntityTypeBuilder<ValidationCaseOwnershipTransfer> builder)
    {
        builder.ToTable("validation_case_ownership_transfers");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).HasMaxLength(30);

        builder.Property(v => v.ValidationCaseId).IsRequired();
        builder.Property(v => v.ValidationCaseTitle).HasMaxLength(500);
        builder.Property(v => v.PreviousOwnerUsername).HasMaxLength(100);
        builder.Property(v => v.NewOwnerUsername).HasMaxLength(100);
        builder.Property(v => v.Reason).HasMaxLength(1000);
    }
}
