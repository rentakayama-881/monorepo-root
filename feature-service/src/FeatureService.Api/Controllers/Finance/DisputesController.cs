using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Dispute management endpoints (Phase 2 - Coming Soon)
/// </summary>
[ApiController]
[Route("api/v1/disputes")]
[Authorize]
[Produces("application/json")]
public class DisputesController : ApiControllerBase
{
    /// <summary>
    /// Create a new dispute (Phase 2)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult CreateDispute()
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur dispute akan tersedia di Phase 2");
    }

    /// <summary>
    /// Get dispute details (Phase 2)
    /// </summary>
    [HttpGet("{disputeId}")]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult GetDispute(string disputeId)
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur dispute akan tersedia di Phase 2");
    }

    /// <summary>
    /// List user disputes (Phase 2)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult GetDisputes()
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur dispute akan tersedia di Phase 2");
    }
}
