using FeatureService.Api.Controllers.Callbacks;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Controllers;

/// <summary>
/// Security tests for OxaPayCallbackController:
/// HMAC verification and dual-layer payment validation.
/// </summary>
public class OxaPayCallbackSecurityTests
{
    private static OxaPayCallbackController CreateController(
        Mock<IDepositService>? depositService = null,
        Mock<IWithdrawalService>? withdrawalService = null,
        Mock<IOxaPayService>? oxaPayService = null)
    {
        depositService ??= new Mock<IDepositService>();
        withdrawalService ??= new Mock<IWithdrawalService>();
        oxaPayService ??= new Mock<IOxaPayService>();
        var logger = new Mock<ILogger<OxaPayCallbackController>>();

        var controller = new OxaPayCallbackController(
            depositService.Object,
            withdrawalService.Object,
            oxaPayService.Object,
            logger.Object);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        return controller;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Payment callback — HMAC validation
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task PaymentCallback_SilentlyRejects_WhenHmacInvalid()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay
            .Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>()))
            .Returns(false);

        var depositService = new Mock<IDepositService>();

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-123",
            Status = "Paid",
            Hmac = "invalid-hmac-signature"
        };

        var result = await controller.PaymentCallback(payload);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        // CRITICAL: deposit service should NOT be called when HMAC fails
        depositService.Verify(
            s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Never);
    }

    [Fact]
    public async Task PaymentCallback_Proceeds_WhenHmacValid_NonCreditStatus()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay
            .Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>()))
            .Returns(true);

        var depositService = new Mock<IDepositService>();
        depositService
            .Setup(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-123",
            Status = "Waiting",
            Hmac = "valid-hmac"
        };

        var result = await controller.PaymentCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        // Non-credit status skips server-side verify, goes straight to deposit service
        depositService.Verify(
            s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Once);
    }

    [Fact]
    public async Task PaymentCallback_SkipsHmacCheck_WhenHmacFieldEmpty()
    {
        var oxaPay = new Mock<IOxaPayService>();
        var depositService = new Mock<IDepositService>();
        depositService
            .Setup(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-123",
            Status = "Waiting",
            Hmac = null
        };

        var result = await controller.PaymentCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        // HMAC check is skipped when Hmac is null
        oxaPay.Verify(
            s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>()),
            Times.Never);
        depositService.Verify(
            s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Once);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Payment callback — Server-side verification (Layer 2)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task PaymentCallback_VerifiesServerSide_ForCreditStatus_Paid()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay.Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>())).Returns(true);
        oxaPay.Setup(s => s.VerifyPaymentAsync("track-456"))
            .ReturnsAsync(new OxaPayPaymentInfo { TrackId = "track-456", Status = "Paid" });

        var depositService = new Mock<IDepositService>();
        depositService
            .Setup(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-456",
            Status = "Paid",
            Hmac = "valid"
        };

        var result = await controller.PaymentCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        oxaPay.Verify(s => s.VerifyPaymentAsync("track-456"), Times.Once);
        depositService.Verify(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()), Times.Once);
    }

    [Fact]
    public async Task PaymentCallback_RejectsCredit_WhenServerVerifyFails()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay.Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>())).Returns(true);
        oxaPay.Setup(s => s.VerifyPaymentAsync("track-789"))
            .ReturnsAsync((OxaPayPaymentInfo?)null);

        var depositService = new Mock<IDepositService>();

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-789",
            Status = "Paid",
            Hmac = "valid"
        };

        var result = await controller.PaymentCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        // CRITICAL: deposit callback NOT called when server-side verify returns null
        depositService.Verify(
            s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Never);
    }

    [Fact]
    public async Task PaymentCallback_RejectsCredit_WhenStatusMismatch()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay.Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>())).Returns(true);
        oxaPay.Setup(s => s.VerifyPaymentAsync("track-mismatch"))
            .ReturnsAsync(new OxaPayPaymentInfo { TrackId = "track-mismatch", Status = "Expired" });

        var depositService = new Mock<IDepositService>();

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-mismatch",
            Status = "Complete",
            Hmac = "valid"
        };

        var result = await controller.PaymentCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        // Status mismatch → deposit not processed
        depositService.Verify(
            s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Never);
    }

    [Fact]
    public async Task PaymentCallback_RejectsCredit_WhenTrackIdMissing()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay.Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>())).Returns(true);

        var depositService = new Mock<IDepositService>();

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = null,
            Status = "Paid",
            Hmac = "valid"
        };

        var result = await controller.PaymentCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        // Missing trackId on credit → rejected silently
        depositService.Verify(
            s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Never);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Payout callback — HMAC validation
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task PayoutCallback_SilentlyRejects_WhenHmacInvalid()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay
            .Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>()))
            .Returns(false);

        var withdrawalService = new Mock<IWithdrawalService>();

        var controller = CreateController(withdrawalService: withdrawalService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "payout-track-1",
            Status = "Complete",
            Hmac = "bad-hmac"
        };

        var result = await controller.PayoutCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        // CRITICAL: withdrawal service NOT called when HMAC fails
        withdrawalService.Verify(
            s => s.HandlePayoutCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Never);
    }

    [Fact]
    public async Task PayoutCallback_Proceeds_WhenHmacValid()
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay
            .Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>()))
            .Returns(true);

        var withdrawalService = new Mock<IWithdrawalService>();
        withdrawalService
            .Setup(s => s.HandlePayoutCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(withdrawalService: withdrawalService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "payout-track-2",
            Status = "Complete",
            Hmac = "valid-hmac"
        };

        var result = await controller.PayoutCallback(payload);

        Assert.IsType<OkObjectResult>(result);
        withdrawalService.Verify(
            s => s.HandlePayoutCallbackAsync(It.IsAny<OxaPayCallbackPayload>()),
            Times.Once);
    }

    [Fact]
    public async Task PayoutCallback_HandlesException_GracefullyReturns200()
    {
        var oxaPay = new Mock<IOxaPayService>();
        var withdrawalService = new Mock<IWithdrawalService>();
        withdrawalService
            .Setup(s => s.HandlePayoutCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ThrowsAsync(new Exception("DB connection lost"));

        var controller = CreateController(withdrawalService: withdrawalService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "payout-err",
            Status = "Complete",
            Hmac = null
        };

        var result = await controller.PayoutCallback(payload);

        // Callbacks always return 200 to avoid retries
        Assert.IsType<OkObjectResult>(result);
    }

    // ═══════════════════════════════════════════════════════════════
    //  All credit-worthy statuses trigger server-side verification
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("paid")]
    [InlineData("complete")]
    [InlineData("sending")]
    [InlineData("Paid")]
    [InlineData("Complete")]
    [InlineData("Sending")]
    public async Task PaymentCallback_VerifiesServerSide_ForAllCreditStatuses(string status)
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay.Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>())).Returns(true);
        oxaPay.Setup(s => s.VerifyPaymentAsync("track-credit"))
            .ReturnsAsync(new OxaPayPaymentInfo { TrackId = "track-credit", Status = status });

        var depositService = new Mock<IDepositService>();
        depositService
            .Setup(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-credit",
            Status = status,
            Hmac = "valid"
        };

        await controller.PaymentCallback(payload);

        oxaPay.Verify(s => s.VerifyPaymentAsync("track-credit"), Times.Once);
    }

    [Theory]
    [InlineData("Waiting")]
    [InlineData("Confirming")]
    [InlineData("Expired")]
    [InlineData("Failed")]
    public async Task PaymentCallback_SkipsServerVerify_ForNonCreditStatuses(string status)
    {
        var oxaPay = new Mock<IOxaPayService>();
        oxaPay.Setup(s => s.ValidateCallbackHmac(It.IsAny<OxaPayCallbackPayload>())).Returns(true);

        var depositService = new Mock<IDepositService>();
        depositService
            .Setup(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService: depositService, oxaPayService: oxaPay);

        var payload = new OxaPayCallbackPayload
        {
            TrackId = "track-non-credit",
            Status = status,
            Hmac = "valid"
        };

        await controller.PaymentCallback(payload);

        // Non-credit statuses bypass server-side verification
        oxaPay.Verify(s => s.VerifyPaymentAsync(It.IsAny<string>()), Times.Never);
        depositService.Verify(s => s.HandleCallbackAsync(It.IsAny<OxaPayCallbackPayload>()), Times.Once);
    }
}
