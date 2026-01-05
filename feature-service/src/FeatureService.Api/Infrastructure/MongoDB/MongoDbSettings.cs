namespace FeatureService.Api.Infrastructure.MongoDB;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = "mongodb://127.0.0.1:27017";
    public string DatabaseName { get; set; } = "feature_service_db";
}
