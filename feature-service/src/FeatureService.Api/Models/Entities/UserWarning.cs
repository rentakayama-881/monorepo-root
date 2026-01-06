using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a warning issued to a user by admin.
/// Warnings accumulate and can lead to bans.
/// </summary>
public class UserWarning
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // wrn_xxx format using Ulid

    /// <summary>
    /// User ID receiving the warning
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Report ID that led to this warning (if applicable)
    /// </summary>
    [BsonElement("reportId")]
    public string? ReportId { get; set; }

    /// <summary>
    /// Warning reason
    /// </summary>
    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Detailed message shown to the user
    /// </summary>
    [BsonElement("message")]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Warning severity: minor, moderate, severe
    /// </summary>
    [BsonElement("severity")]
    public string Severity { get; set; } = WarningSeverity.Minor;

    /// <summary>
    /// Admin who issued the warning
    /// </summary>
    [BsonElement("issuedByAdminId")]
    public uint IssuedByAdminId { get; set; }

    /// <summary>
    /// Whether the user has acknowledged this warning
    /// </summary>
    [BsonElement("acknowledged")]
    public bool Acknowledged { get; set; } = false;

    /// <summary>
    /// Timestamp when user acknowledged the warning
    /// </summary>
    [BsonElement("acknowledgedAt")]
    public DateTime? AcknowledgedAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Warning severity levels
/// </summary>
public static class WarningSeverity
{
    public const string Minor = "minor";
    public const string Moderate = "moderate";
    public const string Severe = "severe";

    public static readonly string[] All = { Minor, Moderate, Severe };
}
