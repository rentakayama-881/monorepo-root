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

    #region Token/Wallet Collections

    public IMongoCollection<TokenBalance> TokenBalances => _database.GetCollection<TokenBalance>("token_balances");
    public IMongoCollection<TokenPurchase> TokenPurchases => _database.GetCollection<TokenPurchase>("token_purchases");
    public IMongoCollection<TokenUsage> TokenUsages => _database.GetCollection<TokenUsage>("token_usages");

    #endregion

    #region AI Chat Collections

    public IMongoCollection<ChatSession> ChatSessions => _database.GetCollection<ChatSession>("chat_sessions");
    public IMongoCollection<ChatMessage> ChatMessages => _database.GetCollection<ChatMessage>("chat_messages");

    #endregion

    private void CreateIndexes()
    {
        // Reply indexes
        Replies.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Ascending(r => r.ThreadId)),
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Ascending(r => r.UserId)),
            new CreateIndexModel<Reply>(Builders<Reply>.IndexKeys.Ascending(r => r.ParentId)),
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

        // Token balance indexes
        TokenBalances.Indexes.CreateOne(new CreateIndexModel<TokenBalance>(
            Builders<TokenBalance>.IndexKeys.Ascending(t => t.UserId),
            new CreateIndexOptions { Unique = true }));

        // Token purchase indexes
        TokenPurchases.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<TokenPurchase>(Builders<TokenPurchase>.IndexKeys.Ascending(t => t.UserId)),
            new CreateIndexModel<TokenPurchase>(Builders<TokenPurchase>.IndexKeys.Descending(t => t.CreatedAt))
        });

        // Token usage indexes
        TokenUsages.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<TokenUsage>(Builders<TokenUsage>.IndexKeys.Ascending(t => t.UserId)),
            new CreateIndexModel<TokenUsage>(Builders<TokenUsage>.IndexKeys.Ascending(t => t.SessionId)),
            new CreateIndexModel<TokenUsage>(Builders<TokenUsage>.IndexKeys.Descending(t => t.CreatedAt))
        });

        // Chat session indexes
        ChatSessions.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<ChatSession>(Builders<ChatSession>.IndexKeys.Ascending(c => c.UserId)),
            new CreateIndexModel<ChatSession>(Builders<ChatSession>.IndexKeys.Ascending(c => c.ServiceType)),
            new CreateIndexModel<ChatSession>(Builders<ChatSession>.IndexKeys.Descending(c => c.LastMessageAt))
        });

        // Chat message indexes
        ChatMessages.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<ChatMessage>(Builders<ChatMessage>.IndexKeys.Ascending(m => m.SessionId)),
            new CreateIndexModel<ChatMessage>(Builders<ChatMessage>.IndexKeys.Ascending(m => m.CreatedAt))
        });
    }
}
