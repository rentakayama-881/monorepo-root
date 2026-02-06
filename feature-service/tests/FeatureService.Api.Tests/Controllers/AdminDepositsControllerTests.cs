using System.Security.Claims;
using FeatureService.Api.Controllers;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Controllers;

public class AdminDepositsControllerTests
{
    [Fact]
    public async Task Approve_WhenDepositIdIsBlank_ReturnsBadRequest_AndDoesNotCallService()
    {
        var depositService = new Mock<IDepositService>(MockBehavior.Strict);
        var controller = CreateController(depositService.Object, adminId: 10, adminName: "Admin Test");

        var result = await controller.Approve("   ", null);

        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        depositService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Reject_WhenReasonIsWhitespace_ReturnsBadRequest_AndDoesNotCallService()
    {
        var depositService = new Mock<IDepositService>(MockBehavior.Strict);
        var controller = CreateController(depositService.Object, adminId: 10, adminName: "Admin Test");

        var result = await controller.Reject("507f1f77bcf86cd799439015", new RejectDepositRequest
        {
            Reason = "   "
        });

        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        depositService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Reject_WhenReasonTooLong_ReturnsBadRequest_AndDoesNotCallService()
    {
        var depositService = new Mock<IDepositService>(MockBehavior.Strict);
        var controller = CreateController(depositService.Object, adminId: 10, adminName: "Admin Test");

        var result = await controller.Reject("507f1f77bcf86cd799439015", new RejectDepositRequest
        {
            Reason = new string('x', 201)
        });

        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        depositService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Reject_WithValidPayload_UsesTrimmedValues()
    {
        var depositService = new Mock<IDepositService>(MockBehavior.Strict);
        depositService
            .Setup(s => s.RejectAsync(
                "507f1f77bcf86cd799439016",
                11,
                "Admin Name",
                "Bukti transfer tidak sesuai"))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService.Object, adminId: 11, adminName: "Admin Name");

        var result = await controller.Reject(" 507f1f77bcf86cd799439016 ", new RejectDepositRequest
        {
            Reason = "  Bukti transfer tidak sesuai  "
        });

        result.Should().BeOfType<OkObjectResult>();
        depositService.VerifyAll();
    }

    [Fact]
    public async Task Approve_WithValidPayload_UsesTrimmedIdAndAdminNameClaim()
    {
        var depositService = new Mock<IDepositService>(MockBehavior.Strict);
        depositService
            .Setup(s => s.ApproveAsync(
                "507f1f77bcf86cd799439017",
                12,
                "Admin Name",
                150_000))
            .ReturnsAsync((true, (string?)null));

        var controller = CreateController(depositService.Object, adminId: 12, adminName: "Admin Name");

        var result = await controller.Approve(" 507f1f77bcf86cd799439017 ", new ApproveDepositRequest
        {
            AmountOverride = 150_000
        });

        result.Should().BeOfType<OkObjectResult>();
        depositService.VerifyAll();
    }

    private static AdminDepositsController CreateController(
        IDepositService depositService,
        uint adminId,
        string adminName)
    {
        var logger = new Mock<ILogger<AdminDepositsController>>(MockBehavior.Loose);
        var controller = new AdminDepositsController(depositService, logger.Object);

        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, adminId.ToString()),
                new Claim("name", adminName),
                new Claim(ClaimTypes.Role, "admin"),
            },
            authenticationType: "Test");

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity)
        };
        httpContext.Items["RequestId"] = "req-test";

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }
}
