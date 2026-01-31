using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using StackExchange.Redis;
using FeatureService.Api.Infrastructure.MongoDB;

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
            Version: "1.0.0",
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
}

public record HealthResponse(string Status, string Service, string Version, DateTime Timestamp);
