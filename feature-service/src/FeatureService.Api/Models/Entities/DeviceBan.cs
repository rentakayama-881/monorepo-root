namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a permanently banned device.
/// Banned devices cannot create accounts or access the platform.
/// </summary>
public class DeviceBan
{
    public string Id { get; set; } = string.Empty; // ban_xxx format using Ulid

    /// <summary>
    /// Device fingerprint hash for identification
    /// </summary>
    public string DeviceFingerprint { get; set; } = string.Empty;

    /// <summary>
    /// User agent string at time of ban
    /// </summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// IP address at time of ban (for reference, not for banning)
    /// </summary>
    public string? IpAddress { get; set; }

    /// <summary>
    /// User ID that was banned (last associated user)
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Username at time of ban
    /// </summary>
    public string? Username { get; set; }

    /// <summary>
    /// Reason for the device ban
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Report ID that led to this ban (if applicable)
    /// </summary>
    public string? ReportId { get; set; }

    /// <summary>
    /// Whether the ban is currently active
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Admin who issued the ban
    /// </summary>
    public uint BannedByAdminId { get; set; }

    /// <summary>
    /// Admin who lifted the ban (if unbanned)
    /// </summary>
    public uint? UnbannedByAdminId { get; set; }

    /// <summary>
    /// Timestamp when the ban was lifted
    /// </summary>
    public DateTime? UnbannedAt { get; set; }

    /// <summary>
    /// Reason for unban
    /// </summary>
    public string? UnbanReason { get; set; }

    /// <summary>
    /// Whether the ban is permanent (true) or temporary (false)
    /// </summary>
    public bool IsPermanent { get; set; } = true;

    /// <summary>
    /// Expiration date for temporary bans (null if permanent)
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
