using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Health check endpoints for monitoring and load balancers
/// </summary>
[ApiController]
[Route("api/v1/health")]
[Produces("application/json")]
public class HealthController : ControllerBase
{
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
    public IActionResult GetReadiness()
    {
        // TODO: Add actual readiness checks (MongoDB connection, etc.)
        return Ok(new { status = "ready" });
    }
}

public record HealthResponse(string Status, string Service, string Version, DateTime Timestamp);
