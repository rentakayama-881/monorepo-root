using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets/transfers")]
[Authorize]
public class TransfersController : ControllerBase
{
    // Phase 2 - To be implemented
    [HttpPost]
    public IActionResult CreateTransfer()
    {
        return StatusCode(501, new { message = "Transfers - Coming in Phase 2" });
    }
}
