using StackExchange.Redis;

namespace FeatureService.Api.Infrastructure.Redis;

/// <summary>
/// Factory untuk membuat Redis connection dengan Sentinel support.
/// </summary>
public static class RedisConnectionFactory
{
    /// <summary>
    /// Create Redis connection dengan Sentinel configuration.
    /// </summary>
    /// <param name="settings">Redis settings</param>
    /// <param name="logger">Logger untuk diagnostics</param>
    /// <returns>IConnectionMultiplexer instance</returns>
    public static IConnectionMultiplexer CreateConnection(
        RedisSettings settings,
        ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(settings);
        
        var options = new ConfigurationOptions
        {
            DefaultDatabase = settings.DefaultDatabase,
            ConnectTimeout = settings.ConnectTimeout,
            SyncTimeout = settings.SyncTimeout,
            AbortOnConnectFail = settings.AbortOnConnectFail,
            AllowAdmin = false,
            ConnectRetry = 3,
            KeepAlive = 60,
            ReconnectRetryPolicy = new ExponentialRetry(5000)
        };

        // Add Sentinel endpoints
        if (settings.SentinelEndpoints.Length > 0)
        {
            options.ServiceName = settings.ServiceName;
            options.CommandMap = CommandMap.Sentinel;
            
            foreach (var endpoint in settings.SentinelEndpoints)
            {
                options.EndPoints.Add(endpoint);
            }
            
            logger.LogInformation(
                "Configuring Redis Sentinel connection. ServiceName: {ServiceName}, Endpoints: {Endpoints}",
                settings.ServiceName, string.Join(", ", settings.SentinelEndpoints));
        }
        else
        {
            // Fallback to direct connection for development
            options.EndPoints.Add("127.0.0.1:6379");
            logger.LogWarning("No Sentinel endpoints configured. Using direct Redis connection to localhost:6379");
        }

        // Add password if configured
        if (!string.IsNullOrEmpty(settings.Password))
        {
            options.Password = settings.Password;
        }

        try
        {
            var multiplexer = ConnectionMultiplexer.Connect(options);
            
            // Subscribe to connection events for logging
            multiplexer.ConnectionFailed += (sender, e) =>
            {
                logger.LogError(e.Exception, 
                    "Redis connection failed. Endpoint: {Endpoint}, FailureType: {FailureType}",
                    e.EndPoint, e.FailureType);
            };

            multiplexer.ConnectionRestored += (sender, e) =>
            {
                logger.LogInformation(
                    "Redis connection restored. Endpoint: {Endpoint}",
                    e.EndPoint);
            };

            multiplexer.ErrorMessage += (sender, e) =>
            {
                logger.LogWarning("Redis error message: {Message}", e.Message);
            };

            logger.LogInformation(
                "Redis connection established. Status: {Status}, Configuration: {Config}",
                multiplexer.GetStatus(), multiplexer.Configuration);

            return multiplexer;
        }
        catch (RedisConnectionException ex)
        {
            logger.LogError(ex, "Failed to connect to Redis");
            throw;
        }
    }
    
    /// <summary>
    /// Create Redis connection untuk development (no Sentinel).
    /// </summary>
    /// <param name="connectionString">Direct connection string</param>
    /// <param name="logger">Logger</param>
    /// <returns>IConnectionMultiplexer instance</returns>
    public static IConnectionMultiplexer CreateDirectConnection(
        string connectionString,
        ILogger logger)
    {
        try
        {
            var multiplexer = ConnectionMultiplexer.Connect(connectionString);
            
            logger.LogInformation(
                "Direct Redis connection established. Configuration: {Config}",
                multiplexer.Configuration);
            
            return multiplexer;
        }
        catch (RedisConnectionException ex)
        {
            logger.LogError(ex, "Failed to connect to Redis");
            throw;
        }
    }
}
