using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Attributes;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Withdrawal endpoints for cashing out wallet balance to crypto.
/// All financial operations require PQC digital signature verification.
/// </summary>
[ApiController]
[Route("api/v1/wallets/withdrawals")]
[Authorize]
[Produces("application/json")]
public class WithdrawalsController : ApiControllerBase
{
    private readonly IWithdrawalService _withdrawalService;
    private readonly ISecureWithdrawalService _secureWithdrawalService;
    private readonly ILogger<WithdrawalsController> _logger;

    public WithdrawalsController(
        IWithdrawalService withdrawalService,
        ISecureWithdrawalService secureWithdrawalService,
        ILogger<WithdrawalsController> logger)
    {
        _withdrawalService = withdrawalService;
        _secureWithdrawalService = secureWithdrawalService;
        _logger = logger;
    }

    /// <summary>
    /// Request a new crypto withdrawal - REQUIRES 2FA + PIN + PQC Signature
    /// </summary>
    /// <remarks>
    /// Fee penarikan: 2% dari jumlah penarikan.
    /// Minimal: Rp10,000, Maksimal: Rp100,000,000
    /// </remarks>
    [HttpPost]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(ApiResponse<CreateWithdrawalResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateWithdrawal([FromBody] CreateWithdrawalRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        var twoFactorCheck = RequiresTwoFactorAuth();
        if (twoFactorCheck != null) return twoFactorCheck;

        var username = GetUsername();

        try
        {
            var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var result = await _secureWithdrawalService.CreateWithdrawalAsync(
                userId, username, request, idempotencyKey, ipAddress, userAgent);
            if (!result.Success)
            {
                if (IsInvalidCachedIdempotencyResult(result.Error))
                    return ApiIdempotencyStateInvalid(result.Error);

                return ApiBadRequest("WITHDRAWAL_FAILED", result.Error ?? "Gagal membuat penarikan");
            }

            return ApiCreated(result, "Penarikan crypto berhasil dibuat");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating withdrawal for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat membuat penarikan");
        }
    }

    /// <summary>
    /// Get withdrawal history
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<WithdrawalSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWithdrawals(
        [FromQuery] string? status = null,
        [FromQuery] int limit = 50)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            WithdrawalStatus? statusEnum = null;
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<WithdrawalStatus>(status, true, out var parsed))
                statusEnum = parsed;

            var withdrawals = await _withdrawalService.GetUserWithdrawalsAsync(userId, statusEnum, Math.Min(limit, 100));
            return ApiOk(withdrawals, "Riwayat penarikan berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting withdrawals for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil riwayat");
        }
    }

    /// <summary>
    /// Get withdrawal detail by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<WithdrawalDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWithdrawal(string id)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var withdrawal = await _withdrawalService.GetWithdrawalAsync(id, userId);
            if (withdrawal == null)
                return ApiNotFound("WITHDRAWAL_NOT_FOUND", "Penarikan tidak ditemukan");

            return ApiOk(withdrawal, "Detail penarikan berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting withdrawal {WithdrawalId} for user {UserId}", id, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil detail");
        }
    }

    /// <summary>
    /// Cancel a processing withdrawal - REQUIRES PQC Signature
    /// </summary>
    [HttpPost("{id}/cancel")]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CancelWithdrawal(string id, [FromBody] CancelWithdrawalRequest request)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var (success, error) = await _secureWithdrawalService.CancelWithdrawalAsync(
                id, userId, request.Pin, idempotencyKey, ipAddress, userAgent);
            if (!success)
            {
                if (IsInvalidCachedIdempotencyResult(error))
                    return ApiIdempotencyStateInvalid(error);

                return ApiBadRequest("CANCEL_FAILED", error ?? "Gagal membatalkan penarikan");
            }

            return ApiOk(new { cancelled = true }, "Penarikan berhasil dibatalkan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling withdrawal {WithdrawalId} for user {UserId}", id, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat membatalkan penarikan");
        }
    }

    /// <summary>
    /// Get list of supported cryptocurrencies for withdrawal
    /// </summary>
    [HttpGet("currencies")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<List<CryptoCurrencyInfoDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSupportedCurrencies()
    {
        var currencies = await _withdrawalService.GetSupportedCurrenciesAsync();
        return ApiOk(currencies, "Mata uang crypto yang didukung");
    }
}
