using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using MongoDB.Bson;

namespace FeatureService.Api.Tests.Infrastructure;

public class MongoIndexFiltersTests
{
    [Fact]
    public void PendingTransferCaseLockPartialFilter_UsesExistsAndPendingStatus()
    {
        var filter = MongoIndexFilters.PendingTransferCaseLockPartialFilter();

        Assert.True(filter.Contains("caseLockKey"));
        Assert.True(filter["caseLockKey"].AsBsonDocument.Contains("$exists"));
        Assert.True(filter["caseLockKey"]["$exists"].AsBoolean);
        Assert.Equal((int)TransferStatus.Pending, filter["status"].AsInt32);
        Assert.False(filter.ToJson().Contains("$ne", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void ActiveWithdrawalByUserPartialFilter_UsesLteProcessingStatus()
    {
        var filter = MongoIndexFilters.ActiveWithdrawalByUserPartialFilter();

        Assert.True(filter.Contains("status"));
        var statusDoc = filter["status"].AsBsonDocument;
        Assert.True(statusDoc.Contains("$lte"));
        Assert.Equal((int)WithdrawalStatus.Processing, statusDoc["$lte"].AsInt32);
        Assert.False(filter.ToJson().Contains("$in", StringComparison.OrdinalIgnoreCase));
    }
}
