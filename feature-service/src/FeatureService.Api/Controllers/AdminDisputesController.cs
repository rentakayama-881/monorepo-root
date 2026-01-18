using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Admin endpoints for dispute management
/// </summary>
[ApiController]
[Route("api/v1/admin/disputes")]
[Authorize(Roles = "admin")]
[Produces("application/json")]
public class AdminDisputesController : ApiControllerBase
{
    private readonly IDisputeService _disputeService;
    private readonly ILogger<AdminDisputesController> _logger;

    public AdminDisputesController(IDisputeService disputeService, ILogger<AdminDisputesController> logger)
    {
        _disputeService = disputeService;
        _logger = logger;
    }

    /// <summary>
    /// Get all disputes (admin only)
    /// </summary>
    /// <param name="status">Filter by status: Open, UnderReview, WaitingForEvidence, Resolved, Cancelled</param>
    /// <param name="limit">Max results (default 50)</param>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<DisputeSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllDisputes(
        [FromQuery] string? status = null,
        [FromQuery] int limit = 50)
    {
        try
        {
            DisputeStatus? statusEnum = null;
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<DisputeStatus>(status, true, out var parsed))
                statusEnum = parsed;

            var disputes = await _disputeService.GetAllDisputesAsync(statusEnum, limit);
            return ApiOk(disputes, "Disputes berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all disputes");
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil disputes");
        }
    }

    /// <summary>
    /// Get dispute details (admin can view any dispute)
    /// </summary>
    [HttpGet("{disputeId}")]
    [ProducesResponseType(typeof(ApiResponse<DisputeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDispute(string disputeId)
    {
        try
        {
            // Admin can view any dispute - pass admin user ID 0 will fail normal check
            // Need to add admin method to service
            var dispute = await _disputeService.GetDisputeForAdminAsync(disputeId);
            if (dispute == null)
                return ApiNotFound("DISPUTE_NOT_FOUND", "Dispute tidak ditemukan");

            return ApiOk(dispute, "Dispute berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengambil dispute");
        }
    }

    /// <summary>
    /// Add admin message to dispute
    /// </summary>
    [HttpPost("{disputeId}/messages")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddAdminMessage(string disputeId, [FromBody] AddDisputeMessageRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var adminId = GetUserId();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        var adminUsername = GetUsername();

        try
        {
            var (success, error) = await _disputeService.AddMessageAsync(
                disputeId, adminId, adminUsername, request.Content, isAdmin: true);
            
            if (!success)
                return ApiBadRequest("MESSAGE_FAILED", error ?? "Gagal menambahkan pesan");

            return ApiOk(new { sent = true }, "Pesan admin berhasil ditambahkan");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding admin message to dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat menambahkan pesan");
        }
    }

    /// <summary>
    /// Update dispute status (admin only)
    /// </summary>
    [HttpPatch("{disputeId}/status")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStatus(string disputeId, [FromBody] UpdateDisputeStatusRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var adminId = GetUserId();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        try
        {
            if (!Enum.TryParse<DisputeStatus>(request.Status, true, out var status))
                return ApiBadRequest("INVALID_STATUS", "Status tidak valid");

            var (success, error) = await _disputeService.UpdateStatusAsync(disputeId, adminId, status);
            if (!success)
                return ApiBadRequest("STATUS_UPDATE_FAILED", error ?? "Gagal mengubah status");

            return ApiOk(new { updated = true }, "Status dispute berhasil diubah");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating dispute {DisputeId} status", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat mengubah status");
        }
    }

    /// <summary>
    /// Resolve dispute - Full refund to sender (buyer)
    /// </summary>
    [HttpPost("{disputeId}/refund")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RefundToSender(string disputeId, [FromBody] AdminResolveRequest? request = null)
    {
        var adminId = GetUserId();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        var adminUsername = GetUsername();

        try
        {
            var resolveRequest = new ResolveDisputeRequest(
                ResolutionType.FullRefundToSender,
                null,
                request?.Note ?? "Admin memutuskan pengembalian dana penuh ke pengirim"
            );

            var (success, error) = await _disputeService.ResolveDisputeAsync(
                disputeId, adminId, adminUsername, resolveRequest);

            if (!success)
                return ApiBadRequest("REFUND_FAILED", error ?? "Gagal melakukan refund");

            _logger.LogInformation("Admin {AdminId} refunded dispute {DisputeId} to sender", adminId, disputeId);
            return ApiOk(new { resolved = true, type = "refund" }, "Dana berhasil dikembalikan ke pengirim");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refunding dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat refund");
        }
    }

    /// <summary>
    /// Resolve dispute - Force release to receiver (seller)
    /// </summary>
    [HttpPost("{disputeId}/force-release")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ForceReleaseToReceiver(string disputeId, [FromBody] AdminResolveRequest? request = null)
    {
        var adminId = GetUserId();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        var adminUsername = GetUsername();

        try
        {
            var resolveRequest = new ResolveDisputeRequest(
                ResolutionType.FullReleaseToReceiver,
                null,
                request?.Note ?? "Admin memutuskan pelepasan dana penuh ke penerima"
            );

            var (success, error) = await _disputeService.ResolveDisputeAsync(
                disputeId, adminId, adminUsername, resolveRequest);

            if (!success)
                return ApiBadRequest("RELEASE_FAILED", error ?? "Gagal melakukan pelepasan");

            _logger.LogInformation("Admin {AdminId} force-released dispute {DisputeId} to receiver", adminId, disputeId);
            return ApiOk(new { resolved = true, type = "force-release" }, "Dana berhasil dilepaskan ke penerima");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error force-releasing dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat pelepasan");
        }
    }

    /// <summary>
    /// Resolve dispute - Continue transaction (restore to pending, follow hold time)
    /// </summary>
    [HttpPost("{disputeId}/continue")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ContinueTransaction(string disputeId, [FromBody] AdminResolveRequest? request = null)
    {
        var adminId = GetUserId();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        var adminUsername = GetUsername();

        try
        {
            var (success, error) = await _disputeService.ContinueTransactionAsync(
                disputeId, adminId, adminUsername, request?.Note);

            if (!success)
                return ApiBadRequest("CONTINUE_FAILED", error ?? "Gagal melanjutkan transaksi");

            _logger.LogInformation("Admin {AdminId} continued transaction for dispute {DisputeId}", adminId, disputeId);
            return ApiOk(new { resolved = true, type = "continue" }, "Transaksi dilanjutkan sesuai hold time");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error continuing transaction for dispute {DisputeId}", disputeId);
            return ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan saat melanjutkan transaksi");
        }
    }
}

// Additional DTOs for admin requests
public record UpdateDisputeStatusRequest(string Status);
public record AdminResolveRequest(string? Note);
