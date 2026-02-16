using System.Net;
using FeatureService.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Services;

public class LiveTwoFactorVerifierTests
{
    [Fact]
    public async Task IsEnabledLiveAsync_ReturnsTrue_WhenBackendReturnsEnabledTrue()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"enabled\":true}")
            }));

        var sut = CreateSut(handler);

        var result = await sut.IsEnabledLiveAsync("Bearer token-123");

        Assert.True(result);
    }

    [Fact]
    public async Task IsEnabledLiveAsync_ReturnsTrue_WhenBackendReturnsEnabledPascalCaseTrue()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"Enabled\":true}")
            }));

        var sut = CreateSut(handler);

        var result = await sut.IsEnabledLiveAsync("Bearer token-123");

        Assert.True(result);
    }

    [Fact]
    public async Task IsEnabledLiveAsync_ReturnsFalse_WhenAuthorizationHeaderIsMissing()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"enabled\":true}")
            }));

        var sut = CreateSut(handler);

        var result = await sut.IsEnabledLiveAsync("   ");

        Assert.False(result);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task IsEnabledLiveAsync_ReturnsFalse_WhenBackendReturnsNonSuccessStatus()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)));

        var sut = CreateSut(handler);

        var result = await sut.IsEnabledLiveAsync("Bearer token-123");

        Assert.False(result);
    }

    [Fact]
    public async Task IsEnabledLiveAsync_ReturnsFalse_WhenBackendReturnsMalformedJson()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("this-is-not-json")
            }));

        var sut = CreateSut(handler);

        var result = await sut.IsEnabledLiveAsync("Bearer token-123");

        Assert.False(result);
    }

    [Fact]
    public async Task IsEnabledLiveAsync_ReturnsFalse_WhenBackendTimesOut()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            throw new TaskCanceledException("timeout"));

        var sut = CreateSut(handler);

        var result = await sut.IsEnabledLiveAsync("Bearer token-123");

        Assert.False(result);
    }

    [Fact]
    public async Task IsEnabledLiveAsync_ForwardsAuthorizationHeader_AndUsesConfiguredBackendUrl()
    {
        string? authorization = null;
        Uri? uri = null;

        var handler = new StubHttpMessageHandler((request, _) =>
        {
            request.Headers.TryGetValues("Authorization", out var values);
            authorization = values?.FirstOrDefault();
            uri = request.RequestUri;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"enabled\":true}")
            });
        });

        var sut = CreateSut(handler, new Dictionary<string, string?>
        {
            ["Backend:ApiUrl"] = "http://go-backend/"
        });

        var result = await sut.IsEnabledLiveAsync("Bearer live-token");

        Assert.True(result);
        Assert.Equal("Bearer live-token", authorization);
        Assert.Equal("http://go-backend/api/auth/totp/status", uri?.ToString());
    }

    private static LiveTwoFactorVerifier CreateSut(
        HttpMessageHandler handler,
        Dictionary<string, string?>? config = null)
    {
        var client = new HttpClient(handler);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(config ?? new Dictionary<string, string?>
            {
                ["Backend:ApiUrl"] = "http://127.0.0.1:8080"
            })
            .Build();

        var logger = new Mock<ILogger<LiveTwoFactorVerifier>>();

        return new LiveTwoFactorVerifier(client, configuration, logger.Object);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _responder;

        public StubHttpMessageHandler(
            Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> responder)
        {
            _responder = responder;
        }

        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount++;
            return _responder(request, cancellationToken);
        }
    }
}
