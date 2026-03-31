namespace FeatureService.Api.Models.Entities;

public class GuaranteeLock
{
    public string Id { get; set; } = string.Empty; // grt_xxx format using Ulid

    public uint UserId { get; set; }

    public long Amount { get; set; } // Amount in IDR (same unit as wallet Balance)

    public GuaranteeStatus Status { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReleasedAt { get; set; }
}

public enum GuaranteeStatus
{
    Active,
    Released
}

