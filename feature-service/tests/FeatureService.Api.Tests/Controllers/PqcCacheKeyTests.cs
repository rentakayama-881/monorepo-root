using FeatureService.Api.Infrastructure.Security;
using Xunit;

namespace FeatureService.Api.Tests.Controllers;

public class PqcCacheKeyTests
{
    [Fact]
    public void UserHasActivePqcKey_ReturnsStableExpectedFormat()
    {
        var key = PqcCacheKeys.UserHasActivePqcKey(12345);
        Assert.Equal("pqc_key_exists:12345", key);
    }
}
