using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Withdrawal endpoints (Phase 2 - Coming Soon)
/// </summary>
[ApiController]
[Route("api/v1/wallets/withdrawals")]
[Authorize]
[Produces("application/json")]
public class WithdrawalsController : ApiControllerBase
{
    /// <summary>
    /// Request a new withdrawal (Phase 2)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult CreateWithdrawal()
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur penarikan akan tersedia di Phase 2");
    }

    /// <summary>
    /// Get withdrawal history (Phase 2)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult GetWithdrawals()
    {
        return ApiError(501, "NOT_IMPLEMENTED", "Fitur penarikan akan tersedia di Phase 2");
    }
}
