using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a browser profile for the Smart Browser anti-detect platform.
/// Each profile stores proxy, fingerprint, and user-agent configuration.
/// </summary>
[BsonIgnoreExtraElements]
public class BrowserProfile
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // bpf_xxx format using Ulid

    /// <summary>
    /// UserID from the Go backend (PostgreSQL User table)
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Profile display name (max 100 chars)
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Proxy server address, e.g. "socks5://proxy.example.com:1080"
    /// </summary>
    [BsonElement("proxyServer")]
    [BsonIgnoreIfNull]
    public string? ProxyServer { get; set; }

    [BsonElement("proxyUsername")]
    [BsonIgnoreIfNull]
    public string? ProxyUsername { get; set; }

    /// <summary>
    /// Proxy password — will be encrypted in a future iteration
    /// </summary>
    [BsonElement("proxyPassword")]
    [BsonIgnoreIfNull]
    public string? ProxyPassword { get; set; }

    /// <summary>
    /// Auto-assigned user-agent string from preset list
    /// </summary>
    [BsonElement("userAgentPreset")]
    public string UserAgentPreset { get; set; } = string.Empty;

    /// <summary>
    /// Embedded browser fingerprint configuration
    /// </summary>
    [BsonElement("fingerprint")]
    public BrowserFingerprint Fingerprint { get; set; } = new();

    /// <summary>
    /// User notes (max 500 chars)
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Last time this profile was used in a session
    /// </summary>
    [BsonElement("lastSessionAt")]
    [BsonIgnoreIfNull]
    public DateTime? LastSessionAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Embedded sub-document containing browser fingerprint parameters.
/// Used to make each browser profile appear unique to websites.
/// </summary>
[BsonIgnoreExtraElements]
public class BrowserFingerprint
{
    [BsonElement("gpuVendor")]
    public string GpuVendor { get; set; } = string.Empty;

    [BsonElement("gpuRenderer")]
    public string GpuRenderer { get; set; } = string.Empty;

    [BsonElement("screenWidth")]
    public int ScreenWidth { get; set; }

    [BsonElement("screenHeight")]
    public int ScreenHeight { get; set; }

    [BsonElement("colorDepth")]
    public int ColorDepth { get; set; } = 24;

    [BsonElement("platform")]
    public string Platform { get; set; } = string.Empty;

    [BsonElement("timezone")]
    public string Timezone { get; set; } = string.Empty;

    [BsonElement("language")]
    public string Language { get; set; } = string.Empty;
}
