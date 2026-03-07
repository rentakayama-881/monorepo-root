using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Services;

namespace FeatureService.Api.Controllers.Callbacks;

/// <summary>
/// Public callback endpoints for OxaPay payment and payout notifications.
/// No authentication required — OxaPay sends status updates here.
/// </summary>
[ApiController]
[Route("api/v1/callbacks/oxapay")]
[Produces("application/json")]
public class OxaPayCallbackController : ControllerBase
{
    private readonly IDepositService _depositService;
    private readonly IWithdrawalService _withdrawalService;
    private readonly ILogger<OxaPayCallbackController> _logger;

    public OxaPayCallbackController(
        IDepositService depositService,
        IWithdrawalService withdrawalService,
        ILogger<OxaPayCallbackController> logger)
    {
        _depositService = depositService;
        _withdrawalService = withdrawalService;
        _logger = logger;
    }

    /// <summary>
    /// Callback for deposit (white-label payment) status updates.
    /// OxaPay sends: Waiting → Confirming → Paid/Complete or Expired/Failed
    /// </summary>
    [HttpPost("payment")]
    public async Task<IActionResult> PaymentCallback([FromBody] OxaPayCallbackPayload payload)
    {
        _logger.LogInformation(
            "OxaPay payment callback received: trackId={TrackId}, status={Status}, orderId={OrderId}",
            payload.TrackId, payload.Status, payload.OrderId);

        try
        {
            var (success, error) = await _depositService.HandleCallbackAsync(payload);
            if (!success)
            {
                _logger.LogWarning("OxaPay payment callback failed: {Error}", error);
            }

            // Always return 200 to OxaPay to prevent retries for known deposits
            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing OxaPay payment callback for trackId={TrackId}", payload.TrackId);
            // Return 200 anyway — OxaPay will retry on non-200, but we logged the error
            return Ok(new { received = true, error = "internal_error" });
        }
    }

    /// <summary>
    /// Callback for payout (withdrawal) status updates.
    /// OxaPay sends: Processing → Complete or Failed
    /// </summary>
    [HttpPost("payout")]
    public async Task<IActionResult> PayoutCallback([FromBody] OxaPayCallbackPayload payload)
    {
        _logger.LogInformation(
            "OxaPay payout callback received: trackId={TrackId}, status={Status}, txId={TxId}",
            payload.TrackId, payload.Status, payload.TxId);

        try
        {
            var (success, error) = await _withdrawalService.HandlePayoutCallbackAsync(payload);
            if (!success)
            {
                _logger.LogWarning("OxaPay payout callback failed: {Error}", error);
            }

            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing OxaPay payout callback for trackId={TrackId}", payload.TrackId);
            return Ok(new { received = true, error = "internal_error" });
        }
    }
}
