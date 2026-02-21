using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using StackExchange.Redis;
using FeatureService.Api.Infrastructure.MongoDB;
using System.Reflection;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Health check endpoints for monitoring and load balancers
/// </summary>
[ApiController]
[Route("api/v1/health")]
[Produces("application/json")]
public class HealthController : ControllerBase
{
    private readonly MongoDbContext _mongoDbContext;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        MongoDbContext mongoDbContext,
        IConnectionMultiplexer redis,
        ILogger<HealthController> logger)
    {
        _mongoDbContext = mongoDbContext;
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// Basic health check
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public IActionResult GetHealth()
    {
        return Ok(new HealthResponse(
            Status: "healthy",
            Service: "feature-service",
            Version: ResolveVersion(),
            Timestamp: DateTime.UtcNow
        ));
    }

    /// <summary>
    /// Deployment metadata for runtime SHA verification.
    /// </summary>
    [HttpGet("version")]
    [ProducesResponseType(typeof(HealthVersionResponse), StatusCodes.Status200OK)]
    public IActionResult GetVersion()
    {
        return Ok(new HealthVersionResponse(
            Status: "ok",
            Service: "feature-service",
            Version: ResolveVersion(),
            GitSha: ResolveGitSha(),
            BuildTimeUtc: ResolveBuildTimeUtc(),
            Timestamp: DateTime.UtcNow
        ));
    }

    /// <summary>
    /// Liveness probe for Kubernetes
    /// </summary>
    [HttpGet("live")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetLiveness()
    {
        return Ok(new { status = "alive" });
    }

    /// <summary>
    /// Readiness probe for Kubernetes
    /// </summary>
    [HttpGet("ready")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetReadiness()
    {
        var mongoHealthy = await CheckMongoAsync();
        var redisHealthy = await CheckRedisAsync();

        var status = mongoHealthy && redisHealthy ? "ready" : "not_ready";
        var response = new
        {
            status,
            checks = new
            {
                mongodb = mongoHealthy ? "healthy" : "unhealthy",
                redis = redisHealthy ? "healthy" : "unhealthy"
            }
        };

        if (mongoHealthy && redisHealthy)
        {
            return Ok(response);
        }

        return StatusCode(StatusCodes.Status503ServiceUnavailable, response);
    }

    private async Task<bool> CheckMongoAsync()
    {
        try
        {
            var command = new BsonDocument("ping", 1);
            await _mongoDbContext.Database.RunCommandAsync<BsonDocument>(command);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MongoDB readiness check failed");
            return false;
        }
    }

    private Task<bool> CheckRedisAsync()
    {
        try
        {
            _redis.GetDatabase().Ping();
            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis readiness check failed");
            return Task.FromResult(false);
        }
    }

    private static string ResolveVersion()
    {
        return Assembly.GetExecutingAssembly()
                   .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
                   ?.InformationalVersion
               ?? Environment.GetEnvironmentVariable("VERSION")
               ?? "1.0.0";
    }

    private static string ResolveGitSha()
    {
        var explicitSha =
            Environment.GetEnvironmentVariable("GIT_SHA")
            ?? Environment.GetEnvironmentVariable("SOURCE_VERSION");

        if (!string.IsNullOrWhiteSpace(explicitSha))
        {
            return explicitSha.Trim();
        }

        var informationalVersion = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion;

        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            var chunks = informationalVersion
                .Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (chunks.Length > 0)
            {
                return chunks[^1];
            }
        }

        return "unknown";
    }

    private static string ResolveBuildTimeUtc()
    {
        var explicitBuildTime = Environment.GetEnvironmentVariable("BUILD_TIME_UTC");
        if (!string.IsNullOrWhiteSpace(explicitBuildTime))
        {
            return explicitBuildTime.Trim();
        }

        try
        {
            var assemblyPath = Assembly.GetExecutingAssembly().Location;
            if (!string.IsNullOrWhiteSpace(assemblyPath) && System.IO.File.Exists(assemblyPath))
            {
                return System.IO.File.GetLastWriteTimeUtc(assemblyPath).ToString("O");
            }
        }
        catch
        {
            // ignore and fall back to unknown for deterministic response payload
        }

        return "unknown";
    }
}

public record HealthResponse(string Status, string Service, string Version, DateTime Timestamp);
public record HealthVersionResponse(
    string Status,
    string Service,
    string Version,
    string GitSha,
    string BuildTimeUtc,
    DateTime Timestamp);
