using System.Security.Claims;
using FeatureService.Api.Controllers;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Controllers;

/// <summary>
/// Security tests for AdminModerationController.CheckDeviceBan():
/// SERVICE_TOKEN validation using CryptographicOperations.FixedTimeEquals.
/// </summary>
public class AdminModerationServiceTokenTests
{
    private static AdminModerationController CreateController(
        Mock<IDeviceBanService>? deviceBanService = null,
        ClaimsPrincipal? user = null)
    {
        var reportService = new Mock<IReportService>();
        deviceBanService ??= new Mock<IDeviceBanService>();
        var warningService = new Mock<IUserWarningService>();
        var moderationService = new Mock<IAdminModerationService>();
        var logger = new Mock<ILogger<AdminModerationController>>();

        var controller = new AdminModerationController(
            reportService.Object,
            deviceBanService.Object,
            warningService.Object,
            moderationService.Object,
            logger.Object);

        var httpContext = new DefaultHttpContext();
        if (user != null)
            httpContext.User = user;
        else
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity());

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static ClaimsPrincipal CreateAdminUser()
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "1"),
            new(ClaimTypes.Role, "admin")
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
    }

    // ═══════════════════════════════════════════════════════════════
    //  SERVICE_TOKEN validation
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckDeviceBan_Returns200_WhenValidServiceToken()
    {
        var token = "test-service-token-abc123";
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", token);
        try
        {
            var banService = new Mock<IDeviceBanService>();
            banService
                .Setup(s => s.CheckDeviceBanAsync(It.IsAny<string>()))
                .ReturnsAsync((false, (string?)null));

            var controller = CreateController(deviceBanService: banService);
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, token);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<CheckDeviceBanResponse>(okResult.Value);
            Assert.False(response.IsBanned);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    [Fact]
    public async Task CheckDeviceBan_Returns401_WhenInvalidServiceToken()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "correct-token");
        try
        {
            var controller = CreateController();
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, "wrong-token");

            var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
            Assert.NotNull(unauthorized.Value);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    [Fact]
    public async Task CheckDeviceBan_Returns401_WhenMissingServiceToken()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "configured-token");
        try
        {
            var controller = CreateController();
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, null);

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    [Fact]
    public async Task CheckDeviceBan_Returns401_WhenEmptyServiceToken()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "configured-token");
        try
        {
            var controller = CreateController();
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, "");

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    [Fact]
    public async Task CheckDeviceBan_Returns401_WhenServiceTokenNotConfigured()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);

        var controller = CreateController();
        var request = new CheckDeviceBanRequest("device-fp-123");

        var result = await controller.CheckDeviceBan(request, "any-token");

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.NotNull(unauthorized.Value);
    }

    [Fact]
    public async Task CheckDeviceBan_Returns401_WhenEmptyConfiguredToken()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "");
        try
        {
            var controller = CreateController();
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, "some-token");

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin JWT fallback
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckDeviceBan_Returns200_WhenAdminJwt_NoServiceToken()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "configured-token");
        try
        {
            var banService = new Mock<IDeviceBanService>();
            banService
                .Setup(s => s.CheckDeviceBanAsync(It.IsAny<string>()))
                .ReturnsAsync((true, "Banned for abuse"));

            var adminUser = CreateAdminUser();
            var controller = CreateController(deviceBanService: banService, user: adminUser);
            var request = new CheckDeviceBanRequest("banned-device");

            var result = await controller.CheckDeviceBan(request, null);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<CheckDeviceBanResponse>(okResult.Value);
            Assert.True(response.IsBanned);
            Assert.Equal("Banned for abuse", response.Message);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    [Fact]
    public async Task CheckDeviceBan_Returns401_WhenNonAdminJwt_NoServiceToken()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "configured-token");
        try
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, "99"),
                new(ClaimTypes.Role, "user")
            };
            var regularUser = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

            var controller = CreateController(user: regularUser);
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, null);

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Timing-safe comparison (FixedTimeEquals) validation
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckDeviceBan_RejectsToken_WithExtraCharacters()
    {
        var token = "my-secret-token";
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", token);
        try
        {
            var controller = CreateController();
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, token + "X");

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }

    [Fact]
    public async Task CheckDeviceBan_RejectsToken_WithDifferentCase()
    {
        Environment.SetEnvironmentVariable("SERVICE_TOKEN", "MyToken");
        try
        {
            var controller = CreateController();
            var request = new CheckDeviceBanRequest("device-fp-123");

            var result = await controller.CheckDeviceBan(request, "mytoken");

            Assert.IsType<UnauthorizedObjectResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SERVICE_TOKEN", null);
        }
    }
}
