using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a permanently banned device.
/// Banned devices cannot create accounts or access the platform.
/// </summary>
public class DeviceBan
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // ban_xxx format using Ulid

    /// <summary>
    /// Device fingerprint hash for identification
    /// </summary>
    [BsonElement("deviceFingerprint")]
    public string DeviceFingerprint { get; set; } = string.Empty;

    /// <summary>
    /// User agent string at time of ban
    /// </summary>
    [BsonElement("userAgent")]
    public string? UserAgent { get; set; }

    /// <summary>
    /// IP address at time of ban (for reference, not for banning)
    /// </summary>
    [BsonElement("ipAddress")]
    public string? IpAddress { get; set; }

    /// <summary>
    /// User ID that was banned (last associated user)
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Username at time of ban
    /// </summary>
    [BsonElement("username")]
    public string? Username { get; set; }

    /// <summary>
    /// Reason for the device ban
    /// </summary>
    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Report ID that led to this ban (if applicable)
    /// </summary>
    [BsonElement("reportId")]
    public string? ReportId { get; set; }

    /// <summary>
    /// Whether the ban is currently active
    /// </summary>
    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Admin who issued the ban
    /// </summary>
    [BsonElement("bannedByAdminId")]
    public uint BannedByAdminId { get; set; }

    /// <summary>
    /// Admin who lifted the ban (if unbanned)
    /// </summary>
    [BsonElement("unbannedByAdminId")]
    public uint? UnbannedByAdminId { get; set; }

    /// <summary>
    /// Timestamp when the ban was lifted
    /// </summary>
    [BsonElement("unbannedAt")]
    public DateTime? UnbannedAt { get; set; }

    /// <summary>
    /// Reason for unban
    /// </summary>
    [BsonElement("unbanReason")]
    public string? UnbanReason { get; set; }

    /// <summary>
    /// Whether the ban is permanent (true) or temporary (false)
    /// </summary>
    [BsonElement("isPermanent")]
    public bool IsPermanent { get; set; } = true;

    /// <summary>
    /// Expiration date for temporary bans (null if permanent)
    /// </summary>
    [BsonElement("expiresAt")]
    public DateTime? ExpiresAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
