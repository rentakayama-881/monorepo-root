using FeatureService.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace FeatureService.Api.Tests.Controllers;

public class HealthVersionEndpointTests
{
    [Fact]
    public void GetVersion_WhenGitShaProvidedViaEnvironment_ReturnsExpectedPayload()
    {
        Environment.SetEnvironmentVariable("GIT_SHA", "abc123def456");
        Environment.SetEnvironmentVariable("BUILD_TIME_UTC", "2026-02-21T00:00:00Z");

        try
        {
            var logger = new Mock<ILogger<HealthController>>(MockBehavior.Loose);
            var controller = new HealthController(
                mongoDbContext: null!,
                redis: null!,
                logger: logger.Object);

            var result = controller.GetVersion();

            var objectResult = result.Should().BeOfType<OkObjectResult>().Subject;
            objectResult.StatusCode.Should().Be(StatusCodes.Status200OK);

            var payload = objectResult.Value.Should().BeOfType<HealthVersionResponse>().Subject;
            payload.Status.Should().Be("ok");
            payload.Service.Should().Be("feature-service");
            payload.GitSha.Should().Be("abc123def456");
            payload.BuildTimeUtc.Should().Be("2026-02-21T00:00:00Z");
        }
        finally
        {
            Environment.SetEnvironmentVariable("GIT_SHA", null);
            Environment.SetEnvironmentVariable("BUILD_TIME_UTC", null);
        }
    }
}
