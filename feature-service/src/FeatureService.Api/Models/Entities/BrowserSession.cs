namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents an active or completed browser session.
/// Tracks lifecycle, billing, and process information for cleanup.
/// </summary>
public class BrowserSession
{
    public string Id { get; set; } = string.Empty; // bsn_xxx format using Ulid

    /// <summary>
    /// UserID from the Go backend (PostgreSQL User table)
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Reference to BrowserProfile.Id
    /// </summary>
    public string ProfileId { get; set; } = string.Empty;

    /// <summary>
    /// Snapshot of the profile name at session start
    /// </summary>
    public string ProfileName { get; set; } = string.Empty;

    public BrowserSessionStatus Status { get; set; }

    /// <summary>
    /// Assigned VNC port (6200-6299)
    /// </summary>
    public int VncPort { get; set; }

    /// <summary>
    /// Websockify port for browser-based VNC access
    /// </summary>
    public int WsPort { get; set; }

    /// <summary>
    /// Xvfb display number (:N)
    /// </summary>
    public int DisplayNum { get; set; }

    /// <summary>
    /// Embedded process PIDs for cleanup on shutdown
    /// </summary>
    public SessionProcessPids ProcessPids { get; set; } = new();

    public DateTime StartedAt { get; set; }

    public DateTime? StoppedAt { get; set; }

    /// <summary>
    /// Total minutes that have been charged so far
    /// </summary>
    public int BilledMinutes { get; set; } = 0;

    public DateTime? LastBilledAt { get; set; }

    /// <summary>
    /// Total IDR cost deducted for this session
    /// </summary>
    public long TotalCost { get; set; } = 0;

    /// <summary>
    /// Reason the session was stopped: "user", "insufficient_balance", "max_duration", "error"
    /// </summary>
    public string? StopReason { get; set; }

    public string? ErrorMessage { get; set; }

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
public class SessionProcessPids
{
    public int? Xvfb { get; set; }

    public int? Browser { get; set; }

    public int? Vnc { get; set; }

    public int? Websockify { get; set; }
}
