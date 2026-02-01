using System.Net;
using StackExchange.Redis;

namespace FeatureService.Api.Infrastructure.Redis;

/// <summary>
/// Factory untuk membuat Redis connection dengan Sentinel support.
/// </summary>
public static class RedisConnectionFactory
{
    private static ConfigurationOptions CreateBaseOptions(RedisSettings settings)
    {
        return new ConfigurationOptions
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
    }

    private static bool IsLoopbackHost(string host)
    {
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return IPAddress.TryParse(host, out var ip) && IPAddress.IsLoopback(ip);
    }

    private static bool HasNonLoopbackEndpoint(ConfigurationOptions options)
    {
        foreach (var ep in options.EndPoints)
        {
            if (ep is DnsEndPoint dns)
            {
                if (!IsLoopbackHost(dns.Host))
                {
                    return true;
                }
            }
            else if (ep is IPEndPoint ip)
            {
                if (!IPAddress.IsLoopback(ip.Address))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static string? GetFirstDnsHost(ConfigurationOptions options)
    {
        foreach (var ep in options.EndPoints)
        {
            if (ep is DnsEndPoint dns && !string.IsNullOrWhiteSpace(dns.Host))
            {
                return dns.Host;
            }
        }

        return null;
    }

    private static ConfigurationOptions BuildOptionsFromUri(string uriString, RedisSettings settings, ILogger logger)
    {
        var uri = new Uri(uriString);
        if (!string.Equals(uri.Scheme, "redis", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, "rediss", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Unsupported Redis URI scheme. Use redis:// or rediss://", nameof(uriString));
        }

        var options = CreateBaseOptions(settings);

        var host = uri.Host;
        if (string.IsNullOrWhiteSpace(host))
        {
            throw new ArgumentException("Redis URI host is required", nameof(uriString));
        }

        var port = uri.Port != -1 ? uri.Port : 6379;
        options.EndPoints.Add(host, port);

        // Allow /<db> in URI
        var path = uri.AbsolutePath?.Trim('/');
        if (!string.IsNullOrEmpty(path) && int.TryParse(path, out var db))
        {
            options.DefaultDatabase = db;
        }

        // Parse ACL user/pass from userinfo
        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var parts = uri.UserInfo.Split(':', 2);
            if (parts.Length == 2)
            {
                var user = Uri.UnescapeDataString(parts[0]);
                var pass = Uri.UnescapeDataString(parts[1]);
                if (!string.IsNullOrEmpty(user))
                {
                    options.User = user;
                }
                options.Password = pass;
            }
            else
            {
                options.Password = Uri.UnescapeDataString(parts[0]);
            }
        }

        // Allow env-provided user/pass to fill gaps
        if (!string.IsNullOrEmpty(settings.User) && string.IsNullOrEmpty(options.User))
        {
            options.User = settings.User;
        }
        if (!string.IsNullOrEmpty(settings.Password) && string.IsNullOrEmpty(options.Password))
        {
            options.Password = settings.Password;
        }

        options.Ssl = string.Equals(uri.Scheme, "rediss", StringComparison.OrdinalIgnoreCase);

        if (options.Ssl)
        {
            // Use a stable SNI host for certificate validation.
            options.SslHost = !string.IsNullOrWhiteSpace(settings.SslHost) ? settings.SslHost : host;
        }

        logger.LogInformation(
            "Using Redis URI connection to {Host}:{Port} (TLS: {Tls})",
            host, port, options.Ssl);

        return options;
    }

    private static ConfigurationOptions BuildOptionsFromConnectionString(string connectionString, RedisSettings settings, ILogger logger)
    {
        var cs = connectionString.Trim();
        if (cs.Contains("://", StringComparison.Ordinal))
        {
            return BuildOptionsFromUri(cs, settings, logger);
        }

        // StackExchange.Redis style connection string
        var options = ConfigurationOptions.Parse(cs, ignoreUnknown: true);

        // Enforce safe defaults / consistent timeouts regardless of connection string
        options.ConnectTimeout = settings.ConnectTimeout;
        options.SyncTimeout = settings.SyncTimeout;
        options.AbortOnConnectFail = settings.AbortOnConnectFail;
        options.AllowAdmin = false;
        options.ConnectRetry = 3;
        options.KeepAlive = 60;
        options.ReconnectRetryPolicy = new ExponentialRetry(5000);

        if (!string.IsNullOrEmpty(settings.User) && string.IsNullOrEmpty(options.User))
        {
            options.User = settings.User;
        }
        if (!string.IsNullOrEmpty(settings.Password) && string.IsNullOrEmpty(options.Password))
        {
            options.Password = settings.Password;
        }

        if (options.Ssl)
        {
            if (!string.IsNullOrWhiteSpace(settings.SslHost))
            {
                options.SslHost = settings.SslHost;
            }
            else if (string.IsNullOrWhiteSpace(options.SslHost))
            {
                options.SslHost = GetFirstDnsHost(options);
            }
        }

        logger.LogInformation(
            "Using Redis connection string (TLS: {Tls}, Endpoints: {EndpointCount})",
            options.Ssl, options.EndPoints.Count);

        return options;
    }

    private static void EnforceTlsIfRequired(RedisSettings settings, ConfigurationOptions options)
    {
        if (!settings.RequireTls)
        {
            return;
        }

        if (!HasNonLoopbackEndpoint(options))
        {
            return; // Local-only connections are allowed without TLS
        }

        if (!options.Ssl)
        {
            throw new InvalidOperationException(
                "Redis TLS is required for non-local endpoints. Provide a rediss:// URL or add ssl=true to the connection string.");
        }
    }

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

        ConfigurationOptions options;
        if (!string.IsNullOrWhiteSpace(settings.ConnectionString))
        {
            options = BuildOptionsFromConnectionString(settings.ConnectionString, settings, logger);
        }
        else
        {
            options = CreateBaseOptions(settings);

            // Check if direct connection is configured (production single-node)
            if (!string.IsNullOrEmpty(settings.DirectEndpoint))
            {
                options.EndPoints.Add(settings.DirectEndpoint);
                logger.LogInformation(
                    "Using direct Redis connection to {Endpoint}",
                    settings.DirectEndpoint);
            }
            // Add Sentinel endpoints if configured (multi-node HA setup)
            else if (settings.SentinelEndpoints.Length > 0 && !string.IsNullOrEmpty(settings.ServiceName))
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
                logger.LogWarning("No Redis endpoints configured. Using direct connection to localhost:6379");
            }

            // Add ACL user/pass if configured
            if (!string.IsNullOrEmpty(settings.User))
            {
                options.User = settings.User;
            }
            if (!string.IsNullOrEmpty(settings.Password))
            {
                options.Password = settings.Password;
            }

            if (!string.IsNullOrWhiteSpace(settings.SslHost))
            {
                options.SslHost = settings.SslHost;
            }
        }

        EnforceTlsIfRequired(settings, options);

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

            // Avoid logging secrets (password/connection string).
            var endpoints = multiplexer.GetEndPoints();
            var endpointStrings = new string[endpoints.Length];
            for (var i = 0; i < endpoints.Length; i++)
            {
                endpointStrings[i] = endpoints[i].ToString() ?? string.Empty;
            }

            logger.LogInformation(
                "Redis connection established. Endpoints: {Endpoints}, TLS: {Tls}, Db: {Db}",
                string.Join(", ", endpointStrings), options.Ssl, options.DefaultDatabase);

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

            // Avoid logging secrets (password/connection string).
            var endpoints = multiplexer.GetEndPoints();
            var endpointStrings = new string[endpoints.Length];
            for (var i = 0; i < endpoints.Length; i++)
            {
                endpointStrings[i] = endpoints[i].ToString() ?? string.Empty;
            }
            logger.LogInformation(
                "Direct Redis connection established. Endpoints: {Endpoints}",
                string.Join(", ", endpointStrings));

            return multiplexer;
        }
        catch (RedisConnectionException ex)
        {
            logger.LogError(ex, "Failed to connect to Redis");
            throw;
        }
    }
}
