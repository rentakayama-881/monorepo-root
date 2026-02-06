using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;

namespace FeatureService.Api.Controllers;

[ApiController]
[Route("api/v1/admin/deposits")]
[Authorize(Roles = "admin")]
[Produces("application/json")]
public class AdminDepositsController : ApiControllerBase
{
    private readonly IDepositService _depositService;
    private readonly ILogger<AdminDepositsController> _logger;

    public AdminDepositsController(IDepositService depositService, ILogger<AdminDepositsController> logger)
    {
        _depositService = depositService;
        _logger = logger;
    }

    /// <summary>
    /// Get pending deposit requests
    /// </summary>
    [HttpGet("pending")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminDepositResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPending([FromQuery] int limit = 50)
    {
        try
        {
            var result = await _depositService.GetPendingDepositsAsync(limit);
            return ApiOk(result, "Pending deposits");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching pending deposits");
            return ApiError(500, "INTERNAL_ERROR", "Gagal memuat deposit pending");
        }
    }

    /// <summary>
    /// Approve a deposit request
    /// </summary>
    [HttpPost("{id}/approve")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(string id, [FromBody] ApproveDepositRequest? request = null)
    {
        var depositId = id?.Trim();
        if (string.IsNullOrWhiteSpace(depositId))
            return ApiBadRequest("VALIDATION_ERROR", "ID deposit tidak valid");

        var adminId = GetUserId();
        var adminUsername = GetUsername();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        try
        {
            var (success, error) = await _depositService.ApproveAsync(depositId, adminId, adminUsername, request?.AmountOverride);
            if (!success)
                return ApiBadRequest("DEPOSIT_APPROVE_FAILED", error ?? "Gagal approve deposit");

            return ApiOk(new { id = depositId }, "Deposit approved");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving deposit {DepositId}", depositId);
            return ApiError(500, "INTERNAL_ERROR", "Gagal approve deposit");
        }
    }

    /// <summary>
    /// Reject a deposit request
    /// </summary>
    [HttpPost("{id}/reject")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reject(string id, [FromBody] RejectDepositRequest request)
    {
        var depositId = id?.Trim();
        if (string.IsNullOrWhiteSpace(depositId))
            return ApiBadRequest("VALIDATION_ERROR", "ID deposit tidak valid");

        if (request == null)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length < 3 || reason.Length > 200)
            return ApiBadRequest("VALIDATION_ERROR", "Alasan penolakan harus 3-200 karakter");

        var adminId = GetUserId();
        var adminUsername = GetUsername();
        if (adminId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "Admin tidak terautentikasi");

        try
        {
            var (success, error) = await _depositService.RejectAsync(depositId, adminId, adminUsername, reason);
            if (!success)
                return ApiBadRequest("DEPOSIT_REJECT_FAILED", error ?? "Gagal reject deposit");

            return ApiOk(new { id = depositId }, "Deposit rejected");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting deposit {DepositId}", depositId);
            return ApiError(500, "INTERNAL_ERROR", "Gagal reject deposit");
        }
    }
}
