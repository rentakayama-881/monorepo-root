using MongoDB.Bson;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Infrastructure.MongoDB;

internal static class MongoIndexFilters
{
    internal static BsonDocument PendingTransferCaseLockPartialFilter()
    {
        return new BsonDocument
        {
            { "caseLockKey", new BsonDocument("$exists", true) },
            { "status", (int)TransferStatus.Pending }
        };
    }

    internal static BsonDocument ActiveWithdrawalByUserPartialFilter()
    {
        return new BsonDocument(
            "status",
            new BsonDocument("$lte", (int)WithdrawalStatus.Processing));
    }
}
