using System.Net;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FeatureService.Api.Controllers.Finance;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace FeatureService.Api.Tests.Controllers;

/// <summary>
/// Hardening tests for the PIN set endpoint:
///  1. Live 2FA rejection — stale JWT claim must not bypass.
///  2. Set-once — second attempt returns 400.
///  3. Route contract — pin/change endpoint is permanently removed.
/// </summary>
public class PinHardeningTests
{
    // ── helpers ──────────────────────────────────────────────────────

    private static WalletsController CreateController(
        Mock<IWalletService>? walletService = null,
        Mock<ITwoFactorVerifier>? twoFactorVerifier = null,
        bool authenticated = true,
        bool totpClaimEnabled = true)
    {
        walletService ??= new Mock<IWalletService>();
        twoFactorVerifier ??= new Mock<ITwoFactorVerifier>();

        var userContext = authenticated
            ? new UserContext
            {
                UserId = 42,
                Username = "testuser",
                Email = "test@example.com",
                TotpEnabled = totpClaimEnabled
            }
            : null;

        var userAccessor = new Mock<IUserContextAccessor>();
        userAccessor.Setup(x => x.GetCurrentUser()).Returns(userContext);

        var logger = new Mock<ILogger<WalletsController>>();

        var controller = new WalletsController(
            walletService.Object,
            userAccessor.Object,
            twoFactorVerifier.Object,
            logger.Object);

        // Set up HttpContext so controller can read Authorization header
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["Authorization"] = "Bearer fake-jwt";

        // Set up ClaimsPrincipal with totp_enabled claim (simulates stale JWT)
        var claims = new List<Claim>
        {
            new("user_id", "42"),
            new("totp_enabled", totpClaimEnabled ? "true" : "false")
        };
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    // ── Test 1: Stale JWT claim bypass is blocked ────────────────────

    /// <summary>
    /// Even though the JWT claim says totp_enabled=true, the live check
    /// against the Go backend returns false (user disabled 2FA after login).
    /// SetPin must return 403.
    /// </summary>
    [Fact]
    public async Task SetPin_ReturnsHttp403_WhenLive2faIsDisabled_DespiteJwtClaimBeingTrue()
    {
        // Arrange: JWT says totp_enabled=true, but live check returns false
        var verifier = new Mock<ITwoFactorVerifier>();
        verifier
            .Setup(v => v.IsEnabledLiveAsync(It.IsAny<string>()))
            .ReturnsAsync(false);

        var controller = CreateController(
            twoFactorVerifier: verifier,
            totpClaimEnabled: true);

        var request = new SetPinRequest { Pin = "482916", ConfirmPin = "482916" };

        // Act
        var result = await controller.SetPin(request);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, objectResult.StatusCode);

        // Verify the error code in the response body
        var json = JsonSerializer.Serialize(objectResult.Value);
        Assert.Contains("TWO_FACTOR_REQUIRED", json);
    }

    // ── Test 2: Set-once enforcement ─────────────────────────────────

    /// <summary>
    /// When WalletService.SetPinAsync throws InvalidOperationException
    /// (PIN already set — enforced by atomic MongoDB filter), the controller
    /// must return 400 with the rejection message.
    /// </summary>
    [Fact]
    public async Task SetPin_ReturnsHttp400_WhenPinAlreadySet()
    {
        // Arrange: live 2FA passes, but WalletService rejects (already set)
        var verifier = new Mock<ITwoFactorVerifier>();
        verifier
            .Setup(v => v.IsEnabledLiveAsync(It.IsAny<string>()))
            .ReturnsAsync(true);

        var walletSvc = new Mock<IWalletService>();
        walletSvc
            .Setup(w => w.SetPinAsync(It.IsAny<uint>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException(
                "PIN sudah diset sebelumnya. PIN tidak dapat diubah."));

        var controller = CreateController(
            walletService: walletSvc,
            twoFactorVerifier: verifier);

        var request = new SetPinRequest { Pin = "482916", ConfirmPin = "482916" };

        // Act
        var result = await controller.SetPin(request);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(400, objectResult.StatusCode);

        var json = JsonSerializer.Serialize(objectResult.Value);
        Assert.Contains("PIN sudah diset", json);
    }

    // ── Test 3: pin/change route permanently removed ─────────────────

    /// <summary>
    /// WalletsController must NOT have any method named ChangePin.
    /// This is a route contract test — ensures the endpoint can never be
    /// accidentally re-introduced without breaking this test.
    /// </summary>
    [Fact]
    public void WalletsController_HasNo_ChangePinMethod()
    {
        var methods = typeof(WalletsController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);

        Assert.DoesNotContain(methods, m =>
            string.Equals(m.Name, "ChangePin", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// No method in WalletsController should have an HttpPost route
    /// matching "pin/change".
    /// </summary>
    [Fact]
    public void WalletsController_HasNo_PinChangeRoute()
    {
        var methods = typeof(WalletsController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);

        foreach (var method in methods)
        {
            var httpPostAttr = method.GetCustomAttribute<HttpPostAttribute>();
            if (httpPostAttr?.Template != null)
            {
                Assert.DoesNotContain("pin/change",
                    httpPostAttr.Template,
                    StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    // ── Test 4: Live 2FA verifier fail-closed behavior ───────────────

    /// <summary>
    /// When the Go backend is unreachable (network error), the verifier
    /// must return false (fail-closed), causing SetPin to reject.
    /// </summary>
    [Fact]
    public async Task SetPin_ReturnsHttp403_WhenLive2faCheckTimesOut()
    {
        var verifier = new Mock<ITwoFactorVerifier>();
        verifier
            .Setup(v => v.IsEnabledLiveAsync(It.IsAny<string>()))
            .ReturnsAsync(false); // simulates timeout / unreachable → fail-closed

        var controller = CreateController(
            twoFactorVerifier: verifier,
            totpClaimEnabled: true);

        var request = new SetPinRequest { Pin = "482916", ConfirmPin = "482916" };

        // Act
        var result = await controller.SetPin(request);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, objectResult.StatusCode);
    }
}
