using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Attributes;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Escrow transfer endpoints - send money safely with hold period.
/// All financial operations require PQC digital signature verification.
/// </summary>
[ApiController]
[Route("api/v1/wallets/transfers")]
[Authorize]
[Produces("application/json")]
public class TransfersController : ApiControllerBase
{
    private readonly ITransferService _transferService;
    private readonly ISecureTransferService _secureTransferService;
    private readonly ILogger<TransfersController> _logger;

    public TransfersController(
        ITransferService transferService,
        ISecureTransferService secureTransferService,
        ILogger<TransfersController> logger)
    {
        _transferService = transferService;
        _secureTransferService = secureTransferService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new escrow transfer to another user - REQUIRES 2FA + PIN + PQC Signature
    /// </summary>
    /// <remarks>
    /// Transfer menggunakan sistem escrow dengan keamanan tingkat militer:
    /// - Two-Factor Authentication (2FA) MUST be enabled
    /// - PIN verification required for each transfer
    /// - Post-Quantum Cryptography (PQC) digital signature required
    /// - Idempotency via Redis Sentinel to prevent duplicate transactions
    /// - Immutable audit trail for compliance
    /// - Dana ditahan selama hold period (default 24 jam, maksimal 72 jam)
    /// - Penerima bisa meng-klaim dana setelah hold period selesai
    /// - Pengirim bisa membatalkan sebelum dana diklaim
    /// - Fee 2% dipotong saat dana dilepaskan
    ///
    /// Required Headers:
    /// - X-PQC-Signature: Base64-encoded Dilithium3 signature
    /// - X-PQC-Key-Id: User's registered PQC key ID
    /// - X-PQC-Timestamp: ISO 8601 timestamp (max 5 minutes old)
    /// - X-Idempotency-Key: Optional unique key for request deduplication
    /// </remarks>
    [HttpPost]
    [RequiresPqcSignature]
    [ProducesResponseType(typeof(ApiResponse<CreateTransferResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateTransfer([FromBody] CreateTransferRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        // CRITICAL: Require 2FA for all transfers
        var twoFactorCheck = RequiresTwoFactorAuth();
        if (twoFactorCheck != null) return twoFactorCheck;

        try
        {
            var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var result = await _secureTransferService.CreateTransferAsync(
                userId, request, idempotencyKey, ipAddress, userAgent);
            return ApiCreated(result, "Transfer created successfully");
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest("VALIDATION_ERROR", ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ApiError(401, "INVALID_PIN", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest("TRANSFER_FAILED", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating transfer for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "An error occurred while creating transfer");
        }
    }

    /// <summary>
    /// Get transfer history with optional filters
    /// </summary>
    /// <param name="status">Filter by status: pending, completed, cancelled, expired, disputed</param>
    /// <param name="role">Filter by role: sender, receiver, or null for both</param>
    /// <param name="limit">Maximum number of results (default 50)</param>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<TransferDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransfers(
        [FromQuery] string? status = null,
        [FromQuery] string? role = null,
        [FromQuery] int limit = 50)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            TransferStatus? statusEnum = null;
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<TransferStatus>(status, true, out var parsed))
                statusEnum = parsed;

            var filter = new TransferFilter
            {
                Status = statusEnum,
                Role = role,
                Limit = Math.Min(limit, 100)
            };

            var transfers = await _transferService.GetTransfersAsync(userId, filter);
            return ApiOk(transfers, "Transfer history berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transfers for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil transfer");
        }
    }

    /// <summary>
    /// Get transfer detail by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<TransferDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTransferById(string id)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var transfer = await _transferService.GetTransferByIdAsync(id, userId);
            if (transfer == null)
                return ApiNotFound("TRANSFER_NOT_FOUND", "Transfer tidak ditemukan");

            return ApiOk(transfer, "Transfer berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transfer {TransferId} for user {UserId}", id, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil transfer");
        }
    }

    /// <summary>
    /// Get transfer by unique code (8-digit)
    /// </summary>
    [HttpGet("code/{code}")]
    [ProducesResponseType(typeof(ApiResponse<TransferDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTransferByCode(string code)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var transfer = await _transferService.GetTransferByCodeAsync(code, userId);
            if (transfer == null)
                return ApiNotFound("TRANSFER_NOT_FOUND", "Transfer tidak ditemukan");

            return ApiOk(transfer, "Transfer berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transfer by code {Code} for user {UserId}", code, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil transfer");
        }
    }

    /// <summary>
    /// Release transfer - receiver claims the funds after hold period - REQUIRES PQC Signature
    /// </summary>
    /// <remarks>
    /// Hanya penerima yang bisa melepaskan dana setelah hold period selesai.
    /// Fee 2% akan dipotong saat pelepasan.
    /// PQC digital signature diperlukan untuk verifikasi.
    /// </remarks>
    [HttpPost("{id}/release")]
    [RequiresPqcSignature]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ReleaseTransfer(string id, [FromBody] ReleaseTransferRequest request)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var (success, error) = await _secureTransferService.ReleaseTransferAsync(
                id, userId, request.Pin, idempotencyKey, ipAddress, userAgent);
            if (!success)
                return ApiBadRequest("RELEASE_FAILED", error ?? "Gagal melepaskan dana");

            return ApiOk(new { released = true }, "Dana berhasil dilepaskan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error releasing transfer {TransferId} for user {UserId}", id, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat melepaskan dana");
        }
    }

    /// <summary>
    /// Cancel transfer - sender cancels before completion - REQUIRES PQC Signature
    /// </summary>
    /// <remarks>
    /// Pengirim dapat membatalkan transfer yang masih pending atau dalam hold period.
    /// Dana akan dikembalikan ke pengirim tanpa potongan fee.
    /// PQC digital signature diperlukan untuk verifikasi.
    /// </remarks>
    [HttpPost("{id}/cancel")]
    [RequiresPqcSignature]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CancelTransfer(string id, [FromBody] CancelTransferRequest request)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var (success, error) = await _secureTransferService.CancelTransferAsync(
                id, userId, request.Pin, request.Reason ?? "Dibatalkan oleh pengirim",
                idempotencyKey, ipAddress, userAgent);
            if (!success)
                return ApiBadRequest("CANCEL_FAILED", error ?? "Gagal membatalkan transfer");

            return ApiOk(new { cancelled = true }, "Transfer berhasil dibatalkan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling transfer {TransferId} for user {UserId}", id, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat membatalkan transfer");
        }
    }

    /// <summary>
    /// Reject transfer - receiver rejects and refunds to sender - REQUIRES PQC Signature
    /// </summary>
    /// <remarks>
    /// Penerima dapat menolak transfer yang masih pending atau dalam dispute.
    /// Dana akan dikembalikan ke pengirim tanpa potongan fee.
    /// Ini memungkinkan kedua pihak setuju untuk membatalkan transaksi dengan cepat.
    /// PQC digital signature diperlukan untuk verifikasi.
    /// </remarks>
    [HttpPost("{id}/reject")]
    [RequiresPqcSignature]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RejectTransfer(string id, [FromBody] CancelTransferRequest request)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();

            var (success, error) = await _secureTransferService.RejectTransferAsync(
                id, userId, request.Pin, request.Reason ?? "Ditolak oleh penerima",
                idempotencyKey, ipAddress, userAgent);
            if (!success)
                return ApiBadRequest("REJECT_FAILED", error ?? "Gagal menolak transfer");

            return ApiOk(new { rejected = true }, "Transfer berhasil ditolak, dana dikembalikan ke pengirim");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting transfer {TransferId} for user {UserId}", id, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat menolak transfer");
        }
    }

    /// <summary>
    /// Search for a user to send transfer to
    /// </summary>
    [HttpGet("search-user")]
    [ProducesResponseType(typeof(ApiResponse<SearchUserResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SearchUser([FromQuery] string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return ApiBadRequest("VALIDATION_ERROR", "Username harus diisi");

        try
        {
            var result = await _transferService.SearchUserAsync(username);
            if (!result.Exists)
                return ApiNotFound("USER_NOT_FOUND", "User tidak ditemukan");

            return ApiOk(result, "User ditemukan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching user {Username}", username);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mencari user");
        }
    }
}
