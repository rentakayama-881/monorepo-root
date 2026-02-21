using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Attributes;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Withdrawal endpoints for cashing out wallet balance to bank.
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
    /// Request a new withdrawal to bank account - REQUIRES 2FA + PIN + PQC Signature
    /// </summary>
    /// <remarks>
    /// SECURITY: Keamanan tingkat militer dengan:
    /// - Two-Factor Authentication (2FA) MUST be enabled
    /// - PIN verification required
    /// - Post-Quantum Cryptography (PQC) digital signature required
    /// - Idempotency via Redis Sentinel to prevent duplicate transactions
    /// - Immutable audit trail for compliance
    ///
    /// Penarikan akan diproses oleh tim dalam 1-3 hari kerja.
    /// Fee penarikan: Rp2,500 per transaksi.
    /// Minimal: Rp10,000, Maksimal: Rp100,000,000
    ///
    /// Required Headers:
    /// - X-PQC-Signature: Base64-encoded Dilithium3 signature
    /// - X-PQC-Key-Id: User's registered PQC key ID
    /// - X-PQC-Timestamp: ISO 8601 timestamp (max 5 minutes old)
    /// - X-Idempotency-Key: Optional unique key for request deduplication
    /// </remarks>
    [HttpPost]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(ApiResponse<CreateWithdrawalResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateWithdrawal([FromBody] CreateWithdrawalRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        // CRITICAL: Require 2FA for all withdrawals
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

                return ApiBadRequest("WITHDRAWAL_FAILED", result.Error ?? "Failed to create withdrawal");
            }

            return ApiCreated(result, "Withdrawal request created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating withdrawal for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "An error occurred while creating withdrawal");
        }
    }

    /// <summary>
    /// Get withdrawal history
    /// </summary>
    /// <param name="status">Filter by status: Pending, Processing, Completed, Rejected, Cancelled</param>
    /// <param name="limit">Maximum results (default 50)</param>
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
    /// Cancel a pending withdrawal - REQUIRES PQC Signature
    /// </summary>
    /// <remarks>
    /// PQC digital signature diperlukan untuk verifikasi pembatalan.
    /// Dana akan dikembalikan ke wallet (termasuk fee).
    /// </remarks>
    [HttpPost("{id}/cancel")]
    [RequiresPqcSignature(RequireIdempotencyKey = true)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
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
    /// Get list of supported banks
    /// </summary>
    [HttpGet("banks")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<List<BankInfoDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSupportedBanks()
    {
        var banks = await _withdrawalService.GetSupportedBanksAsync();
        return ApiOk(banks, "Daftar bank tersedia");
    }
}
