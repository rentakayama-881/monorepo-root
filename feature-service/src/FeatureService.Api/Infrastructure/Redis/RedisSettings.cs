namespace FeatureService.Api.Infrastructure.Redis;

/// <summary>
/// Settings untuk Redis connection (direct atau Sentinel).
/// </summary>
public class RedisSettings
{
    /// <summary>
    /// Full Redis connection string.
    /// Supports:
    /// - StackExchange.Redis style: "host:port,password=...,ssl=true,abortConnect=false"
    /// - URI style: "rediss://user:pass@host:port/0"
    /// If set, this takes precedence over DirectEndpoint/SentinelEndpoints.
    /// </summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>
    /// Direct Redis endpoint (host:port) untuk single-node setup.
    /// Jika diset, akan bypass Sentinel configuration.
    /// </summary>
    public string DirectEndpoint { get; set; } = string.Empty;

    /// <summary>
    /// List of Sentinel endpoints (host:port) untuk HA setup
    /// </summary>
    public string[] SentinelEndpoints { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Service name yang dimonitor oleh Sentinel
    /// </summary>
    public string ServiceName { get; set; } = "mymaster";

    /// <summary>
    /// Redis ACL username (optional).
    /// </summary>
    public string User { get; set; } = string.Empty;

    /// <summary>
    /// Password untuk Redis authentication
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Require TLS when connecting to non-local endpoints.
    /// Recommended for production managed Redis.
    /// </summary>
    public bool RequireTls { get; set; } = true;

    /// <summary>
    /// Optional override for TLS SNI/hostname validation.
    /// If empty and TLS is enabled, the first DNS endpoint host will be used.
    /// </summary>
    public string SslHost { get; set; } = string.Empty;

    /// <summary>
    /// Database index (0-15)
    /// </summary>
    public int DefaultDatabase { get; set; } = 0;

    /// <summary>
    /// Connection timeout dalam milliseconds
    /// </summary>
    public int ConnectTimeout { get; set; } = 5000;

    /// <summary>
    /// Sync operation timeout dalam milliseconds
    /// </summary>
    public int SyncTimeout { get; set; } = 3000;

    /// <summary>
    /// Abort jika initial connection gagal
    /// </summary>
    public bool AbortOnConnectFail { get; set; } = false;
}
