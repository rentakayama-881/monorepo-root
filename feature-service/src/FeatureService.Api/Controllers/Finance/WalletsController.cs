using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets")]
[Authorize]
public class WalletsController : ControllerBase
{
    // Phase 2 - To be implemented
    [HttpGet("me")]
    public IActionResult GetMyWallet()
    {
        return StatusCode(501, new { message = "Wallet management - Coming in Phase 2" });
    }

    [HttpGet("transactions")]
    public IActionResult GetTransactions()
    {
        return StatusCode(501, new { message = "Transaction history - Coming in Phase 2" });
    }
}
