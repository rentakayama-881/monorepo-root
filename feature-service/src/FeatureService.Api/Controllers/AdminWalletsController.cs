using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;

namespace FeatureService.Api.Controllers;

[ApiController]
[Route("api/v1/admin/wallets")]
[Authorize(Roles = "admin")]
[Produces("application/json")]
public class AdminWalletsController : ApiControllerBase
{
    private readonly ILedgerBackfillService _backfillService;
    private readonly ILogger<AdminWalletsController> _logger;

    public AdminWalletsController(ILedgerBackfillService backfillService, ILogger<AdminWalletsController> logger)
    {
        _backfillService = backfillService;
        _logger = logger;
    }

    /// <summary>
    /// Backfill ledger entries from existing transactions
    /// </summary>
    [HttpPost("ledger/backfill")]
    [ProducesResponseType(typeof(ApiResponse<LedgerBackfillResult>), StatusCodes.Status200OK)]
    public async Task<IActionResult> BackfillLedger(
        [FromQuery] uint? userId = null,
        [FromQuery] int? limit = null,
        [FromQuery] bool dryRun = false)
    {
        try
        {
            var result = await _backfillService.BackfillAsync(userId, limit, dryRun);
            return ApiOk(result, "Ledger backfill completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during ledger backfill");
            return ApiError(500, "INTERNAL_ERROR", "Gagal melakukan backfill ledger");
        }
    }
}
