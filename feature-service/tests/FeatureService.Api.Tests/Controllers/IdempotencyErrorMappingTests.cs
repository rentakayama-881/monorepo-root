using System.Security.Claims;
using FeatureService.Api.Controllers.Finance;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Controllers;

public class IdempotencyErrorMappingTests
{
    private const string InvalidCachedIdempotencyResultMessage =
        "Data idempotency tidak valid. Permintaan diblokir untuk mencegah duplikasi transaksi.";

    [Fact]
    public async Task CreateTransfer_WhenFailClosedIdempotencyTriggered_ReturnsConflictWithConsistentCode()
    {
        var transferService = new Mock<ITransferService>(MockBehavior.Strict);
        var secureTransferService = new Mock<ISecureTransferService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<TransfersController>>(MockBehavior.Loose);

        secureTransferService
            .Setup(s => s.CreateTransferAsync(
                42,
                It.IsAny<CreateTransferRequest>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException(InvalidCachedIdempotencyResultMessage));

        var controller = new TransfersController(
            transferService.Object,
            secureTransferService.Object,
            logger.Object);
        AttachUserContext(controller);

        var result = await controller.CreateTransfer(new CreateTransferRequest(
            ReceiverUsername: "receiver",
            Amount: 100_000,
            Message: "test",
            Pin: "123456"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.IdempotencyStateInvalid);
        error.Error.Message.Should().Be(InvalidCachedIdempotencyResultMessage);
    }

    [Fact]
    public async Task ReleaseTransfer_WhenFailClosedIdempotencyTriggered_ReturnsConflictWithConsistentCode()
    {
        var transferService = new Mock<ITransferService>(MockBehavior.Strict);
        var secureTransferService = new Mock<ISecureTransferService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<TransfersController>>(MockBehavior.Loose);

        secureTransferService
            .Setup(s => s.ReleaseTransferAsync(
                "trf_1",
                42,
                "123456",
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ReturnsAsync((false, InvalidCachedIdempotencyResultMessage));

        var controller = new TransfersController(
            transferService.Object,
            secureTransferService.Object,
            logger.Object);
        AttachUserContext(controller);

        var result = await controller.ReleaseTransfer("trf_1", new ReleaseTransferRequest("123456"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.IdempotencyStateInvalid);
        error.Error.Message.Should().Be(InvalidCachedIdempotencyResultMessage);
    }

    [Fact]
    public async Task CreateWithdrawal_WhenFailClosedIdempotencyTriggered_ReturnsConflictWithConsistentCode()
    {
        var withdrawalService = new Mock<IWithdrawalService>(MockBehavior.Strict);
        var secureWithdrawalService = new Mock<ISecureWithdrawalService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<WithdrawalsController>>(MockBehavior.Loose);

        secureWithdrawalService
            .Setup(s => s.CreateWithdrawalAsync(
                42,
                It.IsAny<string>(),
                It.IsAny<CreateWithdrawalRequest>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ReturnsAsync(new CreateWithdrawalResponse(
                Success: false,
                WithdrawalId: null,
                Reference: null,
                Error: InvalidCachedIdempotencyResultMessage));

        var controller = new WithdrawalsController(
            withdrawalService.Object,
            secureWithdrawalService.Object,
            logger.Object);
        AttachUserContext(controller);

        var result = await controller.CreateWithdrawal(new CreateWithdrawalRequest(
            Amount: 100_000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123456"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.IdempotencyStateInvalid);
        error.Error.Message.Should().Be(InvalidCachedIdempotencyResultMessage);
    }

    [Fact]
    public async Task CancelWithdrawal_WhenFailClosedIdempotencyTriggered_ReturnsConflictWithConsistentCode()
    {
        var withdrawalService = new Mock<IWithdrawalService>(MockBehavior.Strict);
        var secureWithdrawalService = new Mock<ISecureWithdrawalService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<WithdrawalsController>>(MockBehavior.Loose);

        secureWithdrawalService
            .Setup(s => s.CancelWithdrawalAsync(
                "wd_1",
                42,
                "123456",
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ReturnsAsync((false, InvalidCachedIdempotencyResultMessage));

        var controller = new WithdrawalsController(
            withdrawalService.Object,
            secureWithdrawalService.Object,
            logger.Object);
        AttachUserContext(controller);

        var result = await controller.CancelWithdrawal("wd_1", new CancelWithdrawalRequest("123456"));

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var error = objectResult.Value.Should().BeOfType<ApiErrorResponse>().Subject;
        error.Error.Code.Should().Be(ApiErrorCodes.IdempotencyStateInvalid);
        error.Error.Message.Should().Be(InvalidCachedIdempotencyResultMessage);
    }

    private static void AttachUserContext(ControllerBase controller)
    {
        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "42"),
                new Claim("name", "test-user"),
                new Claim("totp_enabled", "true")
            },
            authenticationType: "Test");

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity)
        };
        httpContext.Items["RequestId"] = "req-idempotency";

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
    }
}
