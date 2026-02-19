using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets/market-purchases")]
[Authorize]
public class MarketPurchasesController : ApiControllerBase
{
    private readonly IMarketPurchaseWalletService _marketPurchaseWalletService;
    private readonly IUserContextAccessor _userContextAccessor;

    public MarketPurchasesController(
        IMarketPurchaseWalletService marketPurchaseWalletService,
        IUserContextAccessor userContextAccessor)
    {
        _marketPurchaseWalletService = marketPurchaseWalletService;
        _userContextAccessor = userContextAccessor;
    }

    [HttpPost("reserve")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> Reserve([FromBody] ReserveMarketPurchaseRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        var (success, error, reservation) = await _marketPurchaseWalletService.ReserveAsync(
            user.UserId,
            request.OrderId,
            request.AmountIdr,
            request.Description,
            request.ReferenceType);

        if (!success)
        {
            return ApiBadRequest(ApiErrorCodes.InsufficientBalance, error ?? "Saldo tidak mencukupi");
        }

        return ApiOk(new
        {
            reservationId = reservation?.Id,
            orderId = reservation?.OrderId,
            status = reservation?.Status,
            amountIdr = reservation?.AmountIdr,
            updatedAt = reservation?.UpdatedAt,
        }, "Saldo berhasil di-reserve");
    }

    [HttpPost("capture")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> Capture([FromBody] CaptureMarketPurchaseRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        var (success, error, reservation) = await _marketPurchaseWalletService.CaptureAsync(
            user.UserId,
            request.OrderId,
            request.Reason);

        if (!success)
        {
            return ApiBadRequest("CAPTURE_FAILED", error ?? "Gagal capture reserve");
        }

        return ApiOk(new
        {
            reservationId = reservation?.Id,
            orderId = reservation?.OrderId,
            status = reservation?.Status,
            updatedAt = reservation?.UpdatedAt,
        }, "Reserve berhasil di-capture");
    }

    [HttpPost("release")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> Release([FromBody] ReleaseMarketPurchaseRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        var (success, error, reservation) = await _marketPurchaseWalletService.ReleaseAsync(
            user.UserId,
            request.OrderId,
            request.Reason);

        if (!success)
        {
            return ApiBadRequest("RELEASE_FAILED", error ?? "Gagal release reserve");
        }

        return ApiOk(new
        {
            reservationId = reservation?.Id,
            orderId = reservation?.OrderId,
            status = reservation?.Status,
            updatedAt = reservation?.UpdatedAt,
        }, "Reserve berhasil direlease");
    }
}
