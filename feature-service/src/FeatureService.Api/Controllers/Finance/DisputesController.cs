using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/disputes")]
[Authorize]
public class DisputesController : ControllerBase
{
    // Phase 2 - To be implemented
    [HttpPost]
    public IActionResult CreateDispute()
    {
        return StatusCode(501, new { message = "Disputes - Coming in Phase 2" });
    }

    [HttpGet("{disputeId}")]
    public IActionResult GetDispute(string disputeId)
    {
        return StatusCode(501, new { message = "Disputes - Coming in Phase 2" });
    }
}
