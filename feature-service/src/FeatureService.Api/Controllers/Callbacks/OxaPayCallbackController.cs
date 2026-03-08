using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Services;

namespace FeatureService.Api.Controllers.Callbacks;

/// <summary>
/// Public callback endpoints for OxaPay payment and payout notifications.
/// Security: dual-layer verification (HMAC signature + server-side API verify).
/// </summary>
[ApiController]
[Route("api/v1/callbacks/oxapay")]
[Produces("application/json")]
public class OxaPayCallbackController : ControllerBase
{
    private readonly IDepositService _depositService;
    private readonly IWithdrawalService _withdrawalService;
    private readonly IOxaPayService _oxaPayService;
    private readonly ILogger<OxaPayCallbackController> _logger;

    public OxaPayCallbackController(
        IDepositService depositService,
        IWithdrawalService withdrawalService,
        IOxaPayService oxaPayService,
        ILogger<OxaPayCallbackController> logger)
    {
        _depositService = depositService;
        _withdrawalService = withdrawalService;
        _oxaPayService = oxaPayService;
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
            "Payment callback received: trackId={TrackId}, status={Status}, orderId={OrderId}",
            payload.TrackId, payload.Status, payload.OrderId);

        // Layer 1: HMAC signature verification
        if (!string.IsNullOrEmpty(payload.Hmac))
        {
            if (!_oxaPayService.ValidateCallbackHmac(payload))
            {
                _logger.LogWarning(
                    "SECURITY: Payment callback HMAC validation failed. trackId={TrackId}, IP={IP}",
                    payload.TrackId, HttpContext.Connection.RemoteIpAddress);
                return Ok(new { received = true });
            }
        }

        // Layer 2: Server-side verification for credit-worthy statuses
        var status = payload.Status?.ToLowerInvariant() ?? "";
        if (status is "paid" or "complete" or "sending")
        {
            if (string.IsNullOrEmpty(payload.TrackId))
            {
                _logger.LogWarning("SECURITY: Credit callback missing trackId");
                return Ok(new { received = true });
            }

            var verified = await _oxaPayService.VerifyPaymentAsync(payload.TrackId);
            if (verified == null)
            {
                _logger.LogWarning(
                    "SECURITY: Payment verification failed for trackId={TrackId}. Rejecting credit.",
                    payload.TrackId);
                return Ok(new { received = true });
            }

            var verifiedStatus = verified.Status?.ToLowerInvariant() ?? "";
            if (verifiedStatus is not ("paid" or "complete" or "sending"))
            {
                _logger.LogWarning(
                    "SECURITY: Callback status mismatch. Callback={CallbackStatus}, Verified={VerifiedStatus}, trackId={TrackId}",
                    payload.Status, verified.Status, payload.TrackId);
                return Ok(new { received = true });
            }
        }

        try
        {
            var (success, error) = await _depositService.HandleCallbackAsync(payload);
            if (!success)
            {
                _logger.LogWarning("Payment callback processing failed: {Error}", error);
            }

            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing payment callback for trackId={TrackId}", payload.TrackId);
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
            "Payout callback received: trackId={TrackId}, status={Status}, txId={TxId}",
            payload.TrackId, payload.Status, payload.TxId);

        // Layer 1: HMAC signature verification
        if (!string.IsNullOrEmpty(payload.Hmac))
        {
            if (!_oxaPayService.ValidateCallbackHmac(payload))
            {
                _logger.LogWarning(
                    "SECURITY: Payout callback HMAC validation failed. trackId={TrackId}, IP={IP}",
                    payload.TrackId, HttpContext.Connection.RemoteIpAddress);
                return Ok(new { received = true });
            }
        }

        try
        {
            var (success, error) = await _withdrawalService.HandlePayoutCallbackAsync(payload);
            if (!success)
            {
                _logger.LogWarning("Payout callback processing failed: {Error}", error);
            }

            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing payout callback for trackId={TrackId}", payload.TrackId);
            return Ok(new { received = true, error = "internal_error" });
        }
    }
}
