namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a browser profile for the Smart Browser anti-detect platform.
/// Each profile stores proxy, fingerprint, and user-agent configuration.
/// </summary>
public class BrowserProfile
{
    public string Id { get; set; } = string.Empty; // bpf_xxx format using Ulid

    /// <summary>
    /// UserID from the Go backend (PostgreSQL User table)
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Profile display name (max 100 chars)
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Proxy server address, e.g. "socks5://proxy.example.com:1080"
    /// </summary>
    public string? ProxyServer { get; set; }

    public string? ProxyUsername { get; set; }

    /// <summary>
    /// Proxy password — will be encrypted in a future iteration
    /// </summary>
    public string? ProxyPassword { get; set; }

    /// <summary>
    /// Auto-assigned user-agent string from preset list
    /// </summary>
    public string UserAgentPreset { get; set; } = string.Empty;

    /// <summary>
    /// Embedded browser fingerprint configuration
    /// </summary>
    public BrowserFingerprint Fingerprint { get; set; } = new();

    /// <summary>
    /// User notes (max 500 chars)
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Last time this profile was used in a session
    /// </summary>
    public DateTime? LastSessionAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Embedded sub-document containing browser fingerprint parameters.
/// Used to make each browser profile appear unique to websites.
/// </summary>
public class BrowserFingerprint
{
    public string GpuVendor { get; set; } = string.Empty;

    public string GpuRenderer { get; set; } = string.Empty;

    public int ScreenWidth { get; set; }

    public int ScreenHeight { get; set; }

    public int ColorDepth { get; set; } = 24;

    public string Platform { get; set; } = string.Empty;

    public string Timezone { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;
}
