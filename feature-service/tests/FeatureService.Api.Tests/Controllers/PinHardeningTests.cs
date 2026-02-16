using System.Net;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using FeatureService.Api.Controllers.Finance;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using Xunit;

namespace FeatureService.Api.Tests.Controllers;

/// <summary>
/// Hardening tests for the PIN set endpoint:
///  1. Live 2FA rejection — stale JWT claim must not bypass.
///  2. Set-once — second attempt returns 400.
///  3. Route contract — pin/change endpoint is permanently removed.
///  4. LiveTwoFactorVerifier implementation — HTTP behavior + fail-closed.
/// </summary>
public class PinHardeningTests
{
    // ── controller test helper ──────────────────────────────────────

    private static WalletsController CreateController(
        Mock<IWalletService>? walletService = null,
        Mock<ITwoFactorVerifier>? twoFactorVerifier = null,
        bool totpClaimEnabled = true)
    {
        walletService ??= new Mock<IWalletService>();
        twoFactorVerifier ??= new Mock<ITwoFactorVerifier>();

        var userContext = new UserContext
        {
            UserId = 42,
            Username = "testuser",
            Email = "test@example.com",
            TotpEnabled = totpClaimEnabled
        };

        var userAccessor = new Mock<IUserContextAccessor>();
        userAccessor.Setup(x => x.GetCurrentUser()).Returns(userContext);

        var logger = new Mock<ILogger<WalletsController>>();

        var controller = new WalletsController(
            walletService.Object,
            userAccessor.Object,
            twoFactorVerifier.Object,
            logger.Object);

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["Authorization"] = "Bearer fake-jwt";

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

    // ── verifier test helper ────────────────────────────────────────

    /// <summary>
    /// Creates a LiveTwoFactorVerifier backed by a mock HttpMessageHandler,
    /// so we can control exactly what the HTTP call returns.
    /// </summary>
    private static LiveTwoFactorVerifier CreateVerifier(Mock<HttpMessageHandler> handler)
    {
        var httpClient = new HttpClient(handler.Object);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Backend:ApiUrl"] = "http://localhost:8080"
            })
            .Build();
        var logger = new Mock<ILogger<LiveTwoFactorVerifier>>();

        return new LiveTwoFactorVerifier(httpClient, config, logger.Object);
    }

    private static Mock<HttpMessageHandler> MockHandler(HttpStatusCode status, string body)
    {
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = status,
                Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
            })
            .Verifiable();
        return handler;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Controller-level tests
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Even though the JWT claim says totp_enabled=true, the live check
    /// against the Go backend returns false (user disabled 2FA after login).
    /// SetPin must return 403.
    /// </summary>
    [Fact]
    public async Task SetPin_Returns403_WhenLive2faDisabled_DespiteStaleJwtClaim()
    {
        var verifier = new Mock<ITwoFactorVerifier>();
        verifier
            .Setup(v => v.IsEnabledLiveAsync(It.IsAny<string>()))
            .ReturnsAsync(false);

        var controller = CreateController(
            twoFactorVerifier: verifier,
            totpClaimEnabled: true);

        var request = new SetPinRequest { Pin = "482916", ConfirmPin = "482916" };

        var result = await controller.SetPin(request);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);

        var json = JsonSerializer.Serialize(obj.Value);
        Assert.Contains("TWO_FACTOR_REQUIRED", json);
    }

    /// <summary>
    /// When WalletService.SetPinAsync throws InvalidOperationException
    /// (PIN already set — enforced by atomic MongoDB filter), the controller
    /// must return 400 with the rejection message.
    /// </summary>
    [Fact]
    public async Task SetPin_Returns400_WhenPinAlreadySet()
    {
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

        var result = await controller.SetPin(request);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(400, obj.StatusCode);

        var json = JsonSerializer.Serialize(obj.Value);
        Assert.Contains("PIN sudah diset", json);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Route contract tests
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void WalletsController_HasNo_ChangePinMethod()
    {
        var methods = typeof(WalletsController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);

        Assert.DoesNotContain(methods, m =>
            string.Equals(m.Name, "ChangePin", StringComparison.OrdinalIgnoreCase));
    }

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

    // ═══════════════════════════════════════════════════════════════
    //  LiveTwoFactorVerifier implementation tests
    //  (exercises real HTTP logic with mock HttpMessageHandler)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Verifier_ReturnsTrue_WhenBackendSaysEnabled()
    {
        var handler = MockHandler(HttpStatusCode.OK, """{"enabled":true,"verified_at":"2025-01-01T00:00:00Z"}""");
        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer valid-jwt");

        Assert.True(result);
        handler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(r =>
                r.Method == HttpMethod.Get
                && r.RequestUri!.AbsolutePath == "/api/auth/totp/status"
                && r.Headers.Authorization!.ToString() == "Bearer valid-jwt"),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_WhenBackendSaysDisabled()
    {
        var handler = MockHandler(HttpStatusCode.OK, """{"enabled":false}""");
        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer valid-jwt");

        Assert.False(result);
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_WhenBackendReturnsHttp500()
    {
        var handler = MockHandler(HttpStatusCode.InternalServerError, """{"error":"db down"}""");
        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer valid-jwt");

        Assert.False(result);
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_WhenBackendReturnsHttp401()
    {
        var handler = MockHandler(HttpStatusCode.Unauthorized, """{"error":"unauthorized"}""");
        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer expired-jwt");

        Assert.False(result);
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_WhenHttpThrows()
    {
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("connection refused"));

        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer valid-jwt");

        Assert.False(result);
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_OnTimeout()
    {
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new TaskCanceledException("request timed out"));

        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer valid-jwt");

        Assert.False(result);
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_WhenAuthHeaderEmpty()
    {
        // Should short-circuit without making any HTTP call
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        // No Setup → any call will throw, proving no HTTP call was made
        var verifier = CreateVerifier(handler);

        Assert.False(await verifier.IsEnabledLiveAsync(""));
        Assert.False(await verifier.IsEnabledLiveAsync("   "));
    }

    [Fact]
    public async Task Verifier_ReturnsFalse_WhenResponseHasUnexpectedJson()
    {
        var handler = MockHandler(HttpStatusCode.OK, """{"status":"ok"}""");
        var verifier = CreateVerifier(handler);

        var result = await verifier.IsEnabledLiveAsync("Bearer valid-jwt");

        Assert.False(result);
    }
}
