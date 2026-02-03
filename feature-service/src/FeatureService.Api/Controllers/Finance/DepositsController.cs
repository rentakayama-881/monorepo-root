using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Attributes;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets/deposits")]
[Authorize]
[Produces("application/json")]
public class DepositsController : ApiControllerBase
{
    private readonly IDepositService _depositService;
    private readonly IUserContextAccessor _userContext;
    private readonly ILogger<DepositsController> _logger;

    public DepositsController(
        IDepositService depositService,
        IUserContextAccessor userContext,
        ILogger<DepositsController> logger)
    {
        _depositService = depositService;
        _userContext = userContext;
        _logger = logger;
    }

    /// <summary>
    /// Create a manual deposit request (QRIS only)
    /// </summary>
    [HttpPost]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(ApiResponse<DepositRequestResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateDepositRequest([FromBody] CreateDepositRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var user = _userContext.GetCurrentUser();
        if (user == null)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _depositService.CreateRequestAsync(user.UserId, user.Username ?? "", request);
            return ApiCreated(result, "Deposit request created");
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest("VALIDATION_ERROR", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest("DEPOSIT_UNAVAILABLE", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating deposit request for user {UserId}", user.UserId);
            return ApiError(500, "INTERNAL_ERROR", "Gagal membuat request deposit");
        }
    }

    /// <summary>
    /// Get user's deposit history
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<DepositHistoryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyDeposits([FromQuery] int limit = 50)
    {
        var user = _userContext.GetCurrentUser();
        if (user == null)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _depositService.GetUserDepositsAsync(user.UserId, limit);
            return ApiOk(result, "Deposit history");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting deposit history for user {UserId}", user.UserId);
            return ApiError(500, "INTERNAL_ERROR", "Gagal memuat riwayat deposit");
        }
    }
}
