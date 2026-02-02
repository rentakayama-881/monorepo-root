using MongoDB.Driver;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Infrastructure.MongoDB;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(MongoDbSettings settings)
    {
        var client = new MongoClient(settings.ConnectionString);
        _database = client.GetDatabase(settings.DatabaseName);

        CreateIndexes();
    }

    public IMongoDatabase Database => _database;

    // Generic collection accessor
    public IMongoCollection<T> GetCollection<T>(string name)
    {
        return _database.GetCollection<T>(name);
    }

    #region Reply System Collections

    public IMongoCollection<Reply> Replies => _database.GetCollection<Reply>("replies");
    public IMongoCollection<Reaction> Reactions => _database.GetCollection<Reaction>("reactions");

    #endregion

    #region Report & Moderation Collections

    public IMongoCollection<Report> Reports => _database.GetCollection<Report>("reports");
    public IMongoCollection<DeviceBan> DeviceBans => _database.GetCollection<DeviceBan>("device_bans");
    public IMongoCollection<UserWarning> UserWarnings => _database.GetCollection<UserWarning>("user_warnings");
    public IMongoCollection<HiddenContent> HiddenContents => _database.GetCollection<HiddenContent>("hidden_contents");
    public IMongoCollection<AdminActionLog> AdminActionLogs => _database.GetCollection<AdminActionLog>("admin_action_logs");
    public IMongoCollection<ThreadOwnershipTransfer> ThreadOwnershipTransfers => _database.GetCollection<ThreadOwnershipTransfer>("thread_ownership_transfers");

    #endregion

    #region Document Storage Collections

    public IMongoCollection<Document> Documents => _database.GetCollection<Document>("documents");

    #endregion

    #region Wallet Collections

    public IMongoCollection<UserWallet> Wallets => _database.GetCollection<UserWallet>("wallets");
    public IMongoCollection<Withdrawal> Withdrawals => _database.GetCollection<Withdrawal>("withdrawals");

    #endregion

    #region PQC Security Collections

    public IMongoCollection<UserPqcKey> UserPqcKeys => _database.GetCollection<UserPqcKey>("user_pqc_keys");

    #endregion

    private void CreateIndexes()
    {
        // Reply indexes
        // Note: Using string-based index for ParentId because it's a nullable field
        // and MongoDB Driver LINQ3 doesn't support lambda expressions for nullable fields
        Replies.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Ascending(r => r.ThreadId)),
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Ascending(r => r.UserId)),
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Ascending("ParentId")),
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Descending(r => r.CreatedAt))
        });

        // Reaction indexes
        Reactions.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Reaction>(Builders<Reaction>.IndexKeys
                .Ascending(r => r.TargetType)
                .Ascending(r => r.TargetId)),
            new CreateIndexModel<Reaction>(Builders<Reaction>.IndexKeys.Ascending(r => r.UserId)),
            new CreateIndexModel<Reaction>(Builders<Reaction>.IndexKeys
                .Ascending(r => r.UserId)
                .Ascending(r => r.TargetType)
                .Ascending(r => r.TargetId),
                new CreateIndexOptions { Unique = true })
        });

        // Report indexes
        Reports.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Report>(Builders<Report>.IndexKeys.Ascending(r => r.Status)),
            new CreateIndexModel<Report>(Builders<Report>.IndexKeys.Ascending(r => r.ReporterUserId)),
            new CreateIndexModel<Report>(Builders<Report>.IndexKeys
                .Ascending(r => r.TargetType)
                .Ascending(r => r.TargetId)),
            new CreateIndexModel<Report>(Builders<Report>.IndexKeys.Descending(r => r.CreatedAt))
        });

        // Device ban indexes
        DeviceBans.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<DeviceBan>(Builders<DeviceBan>.IndexKeys.Ascending(d => d.DeviceFingerprint)),
            new CreateIndexModel<DeviceBan>(Builders<DeviceBan>.IndexKeys.Ascending(d => d.IsActive)),
            new CreateIndexModel<DeviceBan>(Builders<DeviceBan>.IndexKeys.Ascending(d => d.UserId))
        });

        // User warning indexes
        UserWarnings.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<UserWarning>(Builders<UserWarning>.IndexKeys.Ascending(w => w.UserId)),
            new CreateIndexModel<UserWarning>(Builders<UserWarning>.IndexKeys.Descending(w => w.CreatedAt))
        });

        // Hidden content indexes
        HiddenContents.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<HiddenContent>(Builders<HiddenContent>.IndexKeys
                .Ascending(h => h.ContentType)
                .Ascending(h => h.ContentId)),
            new CreateIndexModel<HiddenContent>(Builders<HiddenContent>.IndexKeys.Ascending(h => h.IsActive))
        });

        // Admin action log indexes
        AdminActionLogs.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<AdminActionLog>(Builders<AdminActionLog>.IndexKeys.Ascending(l => l.AdminId)),
            new CreateIndexModel<AdminActionLog>(Builders<AdminActionLog>.IndexKeys.Ascending(l => l.ActionType)),
            new CreateIndexModel<AdminActionLog>(Builders<AdminActionLog>.IndexKeys.Descending(l => l.CreatedAt))
        });

        // Document indexes
        Documents.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Document>(Builders<Document>.IndexKeys.Ascending(d => d.UserId)),
            new CreateIndexModel<Document>(Builders<Document>.IndexKeys.Ascending(d => d.Visibility)),
            new CreateIndexModel<Document>(Builders<Document>.IndexKeys.Ascending(d => d.Category)),
            new CreateIndexModel<Document>(Builders<Document>.IndexKeys.Descending(d => d.CreatedAt)),
            new CreateIndexModel<Document>(Builders<Document>.IndexKeys.Text(d => d.Title).Text(d => d.Description))
        });

        // PQC Key indexes
        UserPqcKeys.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<UserPqcKey>(Builders<UserPqcKey>.IndexKeys.Ascending(k => k.UserId)),
            new CreateIndexModel<UserPqcKey>(Builders<UserPqcKey>.IndexKeys.Ascending(k => k.KeyId),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<UserPqcKey>(Builders<UserPqcKey>.IndexKeys.Ascending(k => k.PublicKeyHash)),
            new CreateIndexModel<UserPqcKey>(Builders<UserPqcKey>.IndexKeys
                .Ascending(k => k.UserId)
                .Ascending(k => k.IsActive))
        });
    }
}
