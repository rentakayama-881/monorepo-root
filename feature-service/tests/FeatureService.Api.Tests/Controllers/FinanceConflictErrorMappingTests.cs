using System.Security.Claims;
using FeatureService.Api.Controllers.Finance;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Controllers;

public class FinanceConflictErrorMappingTests
{
    private const string InvalidCachedIdempotencyResultMessage =
        "Data idempotency tidak valid. Permintaan diblokir untuk mencegah duplikasi transaksi.";

    [Fact]
    public async Task SetGuarantee_WhenFailClosedIdempotencyTriggered_ReturnsConflictWithConsistentCode()
    {
        var guaranteeService = new Mock<IGuaranteeService>(MockBehavior.Strict);
        var userContextAccessor = BuildAuthenticatedUserContextAccessor();
        var logger = new Mock<ILogger<GuaranteesController>>(MockBehavior.Loose);

        guaranteeService
            .Setup(s => s.SetGuaranteeAsync(42, 100_000, "123456"))
            .ThrowsAsync(new InvalidOperationException(InvalidCachedIdempotencyResultMessage));

        var controller = new GuaranteesController(
            guaranteeService.Object,
            userContextAccessor.Object,
            logger.Object);
        AttachUserContext(controller, withTwoFactorEnabled: true);

        var result = await controller.SetGuarantee(new SetGuaranteeRequest
        {
            Amount = 100_000,
            Pin = "123456"
        });

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.IdempotencyStateInvalid);
        error.Error.Message.Should().Be(InvalidCachedIdempotencyResultMessage);
    }

    [Fact]
    public async Task ReleaseGuarantee_WhenStateConflictTriggered_ReturnsConflict()
    {
        var guaranteeService = new Mock<IGuaranteeService>(MockBehavior.Strict);
        var userContextAccessor = BuildAuthenticatedUserContextAccessor();
        var logger = new Mock<ILogger<GuaranteesController>>(MockBehavior.Loose);

        guaranteeService
            .Setup(s => s.ReleaseGuaranteeAsync(42, "123456"))
            .ThrowsAsync(new InvalidOperationException("Jaminan sudah diproses oleh request lain"));

        var controller = new GuaranteesController(
            guaranteeService.Object,
            userContextAccessor.Object,
            logger.Object);
        AttachUserContext(controller, withTwoFactorEnabled: true);

        var result = await controller.ReleaseGuarantee(new ReleaseGuaranteeRequest
        {
            Pin = "123456"
        });

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.Conflict);
        error.Error.Message.Should().Be("Jaminan sudah diproses oleh request lain");
    }

    [Fact]
    public async Task ReserveMarketPurchase_WhenReservationAlreadyReleased_ReturnsConflict()
    {
        var service = new Mock<IMarketPurchaseWalletService>(MockBehavior.Strict);
        var userContextAccessor = BuildAuthenticatedUserContextAccessor();

        service
            .Setup(s => s.ReserveAsync(42, "order-1234", 500_000, "reserve", "market_chatgpt"))
            .ReturnsAsync((false, "Reservasi untuk order ini sudah dilepas", null as FeatureService.Api.Models.Entities.MarketPurchaseReservation));

        var controller = new MarketPurchasesController(service.Object, userContextAccessor.Object);
        AttachUserContext(controller);

        var result = await controller.Reserve(new ReserveMarketPurchaseRequest(
            OrderId: "order-1234",
            AmountIdr: 500_000,
            Description: "reserve",
            ReferenceType: "market_chatgpt"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.Conflict);
        error.Error.Message.Should().Be("Reservasi untuk order ini sudah dilepas");
    }

    [Fact]
    public async Task CaptureMarketPurchase_WhenReservationNotFound_ReturnsNotFound()
    {
        var service = new Mock<IMarketPurchaseWalletService>(MockBehavior.Strict);
        var userContextAccessor = BuildAuthenticatedUserContextAccessor();

        service
            .Setup(s => s.CaptureAsync(42, "order-1234", "capture"))
            .ReturnsAsync((false, "Reservasi tidak ditemukan", null as FeatureService.Api.Models.Entities.MarketPurchaseReservation));

        var controller = new MarketPurchasesController(service.Object, userContextAccessor.Object);
        AttachUserContext(controller);

        var result = await controller.Capture(new CaptureMarketPurchaseRequest(
            OrderId: "order-1234",
            Reason: "capture"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status404NotFound);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.NotFound);
        error.Error.Message.Should().Be("Reservasi tidak ditemukan");
    }

    [Fact]
    public async Task ReleaseMarketPurchase_WhenReservationStateIsInvalid_ReturnsConflict()
    {
        var service = new Mock<IMarketPurchaseWalletService>(MockBehavior.Strict);
        var userContextAccessor = BuildAuthenticatedUserContextAccessor();

        service
            .Setup(s => s.ReleaseAsync(42, "order-1234", "release"))
            .ReturnsAsync((false, "Reservasi tidak bisa direlease", null as FeatureService.Api.Models.Entities.MarketPurchaseReservation));

        var controller = new MarketPurchasesController(service.Object, userContextAccessor.Object);
        AttachUserContext(controller);

        var result = await controller.Release(new ReleaseMarketPurchaseRequest(
            OrderId: "order-1234",
            Reason: "release"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.Conflict);
        error.Error.Message.Should().Be("Reservasi tidak bisa direlease");
    }

    private static Mock<IUserContextAccessor> BuildAuthenticatedUserContextAccessor()
    {
        var accessor = new Mock<IUserContextAccessor>(MockBehavior.Strict);
        accessor
            .Setup(a => a.GetCurrentUser())
            .Returns(new UserContext
            {
                UserId = 42,
                Username = "test-user",
                TotpEnabled = true
            });

        return accessor;
    }

    private static void AttachUserContext(ControllerBase controller, bool withTwoFactorEnabled = false)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "42"),
            new("name", "test-user"),
        };

        if (withTwoFactorEnabled)
        {
            claims.Add(new Claim("totp_enabled", "true"));
        }

        var identity = new ClaimsIdentity(claims, authenticationType: "Test");
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity)
        };
        httpContext.Items["RequestId"] = "req-finance-conflict";

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
    }
}
