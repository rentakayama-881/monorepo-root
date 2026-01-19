namespace FeatureService.Api.Infrastructure.Redis;

/// <summary>
/// Settings untuk Redis Sentinel connection.
/// </summary>
public class RedisSettings
{
    /// <summary>
    /// List of Sentinel endpoints (host:port)
    /// </summary>
    public string[] SentinelEndpoints { get; set; } = Array.Empty<string>();
    
    /// <summary>
    /// Service name yang dimonitor oleh Sentinel
    /// </summary>
    public string ServiceName { get; set; } = "mymaster";
    
    /// <summary>
    /// Password untuk Redis authentication
    /// </summary>
    public string Password { get; set; } = string.Empty;
    
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
