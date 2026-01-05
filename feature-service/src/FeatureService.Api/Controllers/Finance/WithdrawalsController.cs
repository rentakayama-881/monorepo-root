using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets/withdrawals")]
[Authorize]
public class WithdrawalsController : ControllerBase
{
    // Phase 2 - To be implemented
    [HttpPost]
    public IActionResult CreateWithdrawal()
    {
        return StatusCode(501, new { message = "Withdrawals - Coming in Phase 2" });
    }
}
