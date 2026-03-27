using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents an active or completed browser session.
/// Tracks lifecycle, billing, and process information for cleanup.
/// </summary>
[BsonIgnoreExtraElements]
public class BrowserSession
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // bsn_xxx format using Ulid

    /// <summary>
    /// UserID from the Go backend (PostgreSQL User table)
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Reference to BrowserProfile.Id
    /// </summary>
    [BsonElement("profileId")]
    public string ProfileId { get; set; } = string.Empty;

    /// <summary>
    /// Snapshot of the profile name at session start
    /// </summary>
    [BsonElement("profileName")]
    public string ProfileName { get; set; } = string.Empty;

    [BsonElement("status")]
    public BrowserSessionStatus Status { get; set; }

    /// <summary>
    /// Assigned VNC port (6200-6299)
    /// </summary>
    [BsonElement("vncPort")]
    public int VncPort { get; set; }

    /// <summary>
    /// Websockify port for browser-based VNC access
    /// </summary>
    [BsonElement("wsPort")]
    public int WsPort { get; set; }

    /// <summary>
    /// Xvfb display number (:N)
    /// </summary>
    [BsonElement("displayNum")]
    public int DisplayNum { get; set; }

    /// <summary>
    /// Embedded process PIDs for cleanup on shutdown
    /// </summary>
    [BsonElement("processPids")]
    public SessionProcessPids ProcessPids { get; set; } = new();

    [BsonElement("startedAt")]
    public DateTime StartedAt { get; set; }

    [BsonElement("stoppedAt")]
    [BsonIgnoreIfNull]
    public DateTime? StoppedAt { get; set; }

    /// <summary>
    /// Total minutes that have been charged so far
    /// </summary>
    [BsonElement("billedMinutes")]
    public int BilledMinutes { get; set; } = 0;

    [BsonElement("lastBilledAt")]
    [BsonIgnoreIfNull]
    public DateTime? LastBilledAt { get; set; }

    /// <summary>
    /// Total IDR cost deducted for this session
    /// </summary>
    [BsonElement("totalCost")]
    public long TotalCost { get; set; } = 0;

    /// <summary>
    /// Reason the session was stopped: "user", "insufficient_balance", "max_duration", "error"
    /// </summary>
    [BsonElement("stopReason")]
    [BsonIgnoreIfNull]
    public string? StopReason { get; set; }

    [BsonElement("errorMessage")]
    [BsonIgnoreIfNull]
    public string? ErrorMessage { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum BrowserSessionStatus
{
    Starting,     // proses sedang di-spawn
    Active,       // browser aktif dan bisa diakses
    Stopping,     // sedang di-shutdown
    Stopped,      // sudah berhenti normal
    Error         // gagal start atau crash
}

/// <summary>
/// Embedded sub-document tracking process IDs for session cleanup.
/// </summary>
[BsonIgnoreExtraElements]
public class SessionProcessPids
{
    [BsonElement("xvfb")]
    [BsonIgnoreIfNull]
    public int? Xvfb { get; set; }

    [BsonElement("browser")]
    [BsonIgnoreIfNull]
    public int? Browser { get; set; }

    [BsonElement("vnc")]
    [BsonIgnoreIfNull]
    public int? Vnc { get; set; }

    [BsonElement("websockify")]
    [BsonIgnoreIfNull]
    public int? Websockify { get; set; }
}
