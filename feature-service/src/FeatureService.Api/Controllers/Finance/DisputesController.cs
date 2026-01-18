using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Controllers.Finance;

/// <summary>
/// Dispute management for transfer conflicts
/// </summary>
[ApiController]
[Route("api/v1/disputes")]
[Authorize]
[Produces("application/json")]
public class DisputesController : ApiControllerBase
{
    private readonly IDisputeService _disputeService;
    private readonly ILogger<DisputesController> _logger;

    public DisputesController(IDisputeService disputeService, ILogger<DisputesController> logger)
    {
        _disputeService = disputeService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new dispute for a transfer
    /// </summary>
    /// <remarks>
    /// Dispute dapat dibuat oleh pengirim atau penerima transfer.
    /// Transfer akan ditandai sebagai "Disputed" dan dana akan ditahan
    /// sampai dispute diselesaikan oleh admin.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<CreateDisputeResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateDispute([FromBody] CreateDisputeRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _disputeService.CreateDisputeAsync(userId, request);
            if (!result.Success)
                return ApiBadRequest("DISPUTE_FAILED", result.Error ?? "Gagal membuat dispute");

            return ApiCreated(result, "Dispute berhasil dibuat");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating dispute for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat membuat dispute");
        }
    }

    /// <summary>
    /// Get dispute details by ID
    /// </summary>
    [HttpGet("{disputeId}")]
    [ProducesResponseType(typeof(ApiResponse<DisputeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDispute(string disputeId)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var dispute = await _disputeService.GetDisputeAsync(disputeId, userId);
            if (dispute == null)
                return ApiNotFound("DISPUTE_NOT_FOUND", "Dispute tidak ditemukan");

            return ApiOk(dispute, "Dispute berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dispute {DisputeId} for user {UserId}", disputeId, userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil dispute");
        }
    }

    /// <summary>
    /// List user's disputes
    /// </summary>
    /// <param name="status">Filter by status: Open, UnderReview, WaitingForEvidence, Resolved, Cancelled</param>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<DisputeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDisputes([FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            DisputeStatus? statusEnum = null;
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<DisputeStatus>(status, true, out var parsed))
                statusEnum = parsed;

            var disputes = await _disputeService.GetUserDisputesAsync(userId, statusEnum);
            return ApiOk(disputes, "Disputes berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting disputes for user {UserId}", userId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil disputes");
        }
    }

    /// <summary>
    /// Add a message to dispute conversation
    /// </summary>
    [HttpPost("{disputeId}/messages")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddMessage(string disputeId, [FromBody] AddDisputeMessageRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        var username = GetUsername();

        try
        {
            var (success, error) = await _disputeService.AddMessageAsync(disputeId, userId, username, request.Content);
            if (!success)
                return ApiBadRequest("MESSAGE_FAILED", error ?? "Gagal menambahkan pesan");

            return ApiOk(new { sent = true }, "Pesan berhasil ditambahkan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding message to dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat menambahkan pesan");
        }
    }

    /// <summary>
    /// Add evidence to dispute
    /// </summary>
    [HttpPost("{disputeId}/evidence")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddEvidence(string disputeId, [FromBody] AddDisputeEvidenceRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var (success, error) = await _disputeService.AddEvidenceAsync(disputeId, userId, request);
            if (!success)
                return ApiBadRequest("EVIDENCE_FAILED", error ?? "Gagal menambahkan bukti");

            return ApiOk(new { uploaded = true }, "Bukti berhasil ditambahkan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding evidence to dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat menambahkan bukti");
        }
    }

    /// <summary>
    /// Cancel a dispute (only initiator can cancel)
    /// </summary>
    [HttpPost("{disputeId}/cancel")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CancelDispute(string disputeId)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var (success, error) = await _disputeService.CancelDisputeAsync(disputeId, userId);
            if (!success)
                return ApiBadRequest("CANCEL_FAILED", error ?? "Gagal membatalkan dispute");

            return ApiOk(new { cancelled = true }, "Dispute berhasil dibatalkan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat membatalkan dispute");
        }
    }

    /// <summary>
    /// Mutual agreement to refund to sender (both parties can initiate)
    /// </summary>
    /// <remarks>
    /// Kedua pihak (pengirim atau penerima) dapat menyetujui refund ke pengirim.
    /// Dana akan dikembalikan ke pengirim tanpa potongan fee.
    /// Dispute akan ditandai sebagai Resolved.
    /// </remarks>
    [HttpPost("{disputeId}/mutual-refund")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> MutualRefund(string disputeId)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var (success, error) = await _disputeService.MutualRefundAsync(disputeId, userId);
            if (!success)
                return ApiBadRequest("REFUND_FAILED", error ?? "Gagal melakukan refund");

            return ApiOk(new { refunded = true }, "Dana berhasil dikembalikan ke pengirim");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mutual refund for dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan");
        }
    }
}
