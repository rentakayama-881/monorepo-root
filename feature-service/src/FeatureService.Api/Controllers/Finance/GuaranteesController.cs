using FeatureService.Api.Attributes;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/guarantees")]
[Produces("application/json")]
public class GuaranteesController : ApiControllerBase
{
    private readonly IGuaranteeService _guaranteeService;
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly ILogger<GuaranteesController> _logger;

    public GuaranteesController(
        IGuaranteeService guaranteeService,
        IUserContextAccessor userContextAccessor,
        ILogger<GuaranteesController> logger)
    {
        _guaranteeService = guaranteeService;
        _userContextAccessor = userContextAccessor;
        _logger = logger;
    }

    /// <summary>
    /// Get current authenticated user's active guarantee (if any)
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(GetGuaranteeResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> GetMyGuarantee()
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            var guarantee = await _guaranteeService.GetActiveGuaranteeAsync(user.UserId);

            if (guarantee == null)
            {
                return Ok(new GetGuaranteeResponse(
                    user.UserId,
                    0,
                    null,
                    null,
                    null,
                    null
                ));
            }

            return Ok(new GetGuaranteeResponse(
                guarantee.UserId,
                guarantee.Amount,
                guarantee.Status,
                guarantee.CreatedAt,
                guarantee.UpdatedAt,
                guarantee.ReleasedAt
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guarantee for user {UserId}", user.UserId);
            return ApiInternalError("Gagal memuat data jaminan");
        }
    }

    /// <summary>
    /// Set (lock) profile guarantee - REQUIRES 2FA + PIN + PQC Signature/Idempotency
    /// </summary>
    [HttpPost]
    [Authorize]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(GetGuaranteeResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    [ProducesResponseType(typeof(ApiErrorResponse), 403)]
    public async Task<IActionResult> SetGuarantee([FromBody] SetGuaranteeRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");
        }

        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        // Require 2FA for financial guarantee operations
        var twoFactorCheck = RequiresTwoFactorAuth();
        if (twoFactorCheck != null) return twoFactorCheck;

        try
        {
            var guarantee = await _guaranteeService.SetGuaranteeAsync(user.UserId, request.Amount, request.Pin);
            return Ok(new GetGuaranteeResponse(
                guarantee.UserId,
                guarantee.Amount,
                guarantee.Status,
                guarantee.CreatedAt,
                guarantee.UpdatedAt,
                guarantee.ReleasedAt
            ));
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ApiError(401, ApiErrorCodes.InvalidPin, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting guarantee for user {UserId}", user.UserId);
            return ApiInternalError("Gagal mengunci jaminan");
        }
    }

    /// <summary>
    /// Release profile guarantee back to wallet - REQUIRES 2FA + PIN + PQC Signature/Idempotency
    /// </summary>
    [HttpPost("release")]
    [Authorize]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(GetGuaranteeResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    [ProducesResponseType(typeof(ApiErrorResponse), 403)]
    public async Task<IActionResult> ReleaseGuarantee([FromBody] ReleaseGuaranteeRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");
        }

        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        var twoFactorCheck = RequiresTwoFactorAuth();
        if (twoFactorCheck != null) return twoFactorCheck;

        try
        {
            var guarantee = await _guaranteeService.ReleaseGuaranteeAsync(user.UserId, request.Pin);
            return Ok(new GetGuaranteeResponse(
                guarantee.UserId,
                0,
                guarantee.Status,
                guarantee.CreatedAt,
                guarantee.UpdatedAt,
                guarantee.ReleasedAt
            ));
        }
        catch (UnauthorizedAccessException ex)
        {
            return ApiError(401, ApiErrorCodes.InvalidPin, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error releasing guarantee for user {UserId}", user.UserId);
            return ApiInternalError("Gagal melepaskan jaminan");
        }
    }

    /// <summary>
    /// Public: get guarantee amount by userId
    /// </summary>
    [HttpGet("user/{userId}")]
    [AllowAnonymous]
    [ProducesResponseType(200)]
    public async Task<IActionResult> GetGuaranteeAmount(uint userId)
    {
        try
        {
            var amount = await _guaranteeService.GetGuaranteeAmountAsync(userId);
            return Ok(new { userId, amount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guarantee amount for user {UserId}", userId);
            return ApiInternalError("Gagal memuat data jaminan");
        }
    }
}

