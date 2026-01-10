using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Transfer endpoints (Phase 2 - Coming Soon)
/// </summary>
[ApiController]
[Route("api/v1/wallets/transfers")]
[Authorize]
[Produces("application/json")]
public class TransfersController : ApiControllerBase
{
    /// <summary>
    /// Create a new transfer (Phase 2)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult CreateTransfer()
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur transfer akan tersedia di Phase 2");
    }

    /// <summary>
    /// Get transfer history (Phase 2)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult GetTransfers()
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur transfer akan tersedia di Phase 2");
    }
}
