using MongoDB.Driver;
using FeatureService.Api.Models.Entities;
using Microsoft.Extensions.Logging;

namespace FeatureService.Api.Infrastructure.MongoDB;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;
    private readonly ILogger<MongoDbContext> _logger;

    public MongoDbContext(MongoDbSettings settings, ILogger<MongoDbContext> logger)
    {
        var client = new MongoClient(settings.ConnectionString);
        _database = client.GetDatabase(settings.DatabaseName);
        _logger = logger;

        CreateIndexes();
    }

    public IMongoDatabase Database => _database;

    // Generic collection accessor
    public IMongoCollection<T> GetCollection<T>(string name)
    {
        return _database.GetCollection<T>(name);
    }

    #region Report & Moderation Collections

    public IMongoCollection<Report> Reports => _database.GetCollection<Report>("reports");
    public IMongoCollection<DeviceBan> DeviceBans => _database.GetCollection<DeviceBan>("device_bans");
    public IMongoCollection<UserWarning> UserWarnings => _database.GetCollection<UserWarning>("user_warnings");
    public IMongoCollection<HiddenContent> HiddenContents => _database.GetCollection<HiddenContent>("hidden_contents");
    public IMongoCollection<AdminActionLog> AdminActionLogs => _database.GetCollection<AdminActionLog>("admin_action_logs");
    // Note: collection name is still legacy ("thread_ownership_transfers") for backward compatibility.
    // New documents should use Validation Case terminology.
    public IMongoCollection<ValidationCaseOwnershipTransfer> ValidationCaseOwnershipTransfers => _database.GetCollection<ValidationCaseOwnershipTransfer>("thread_ownership_transfers");

    #endregion

    #region Document Storage Collections

    public IMongoCollection<Document> Documents => _database.GetCollection<Document>("documents");

    #endregion

    #region Wallet Collections

    public IMongoCollection<UserWallet> Wallets => _database.GetCollection<UserWallet>("wallets");
    public IMongoCollection<Transaction> Transactions => _database.GetCollection<Transaction>("transactions");
    public IMongoCollection<TransactionLedger> TransactionLedger => _database.GetCollection<TransactionLedger>("transaction_ledger");
    public IMongoCollection<DepositRequest> DepositRequests => _database.GetCollection<DepositRequest>("deposit_requests");
    public IMongoCollection<Transfer> Transfers => _database.GetCollection<Transfer>("transfers");
    public IMongoCollection<Dispute> Disputes => _database.GetCollection<Dispute>("disputes");
    public IMongoCollection<Withdrawal> Withdrawals => _database.GetCollection<Withdrawal>("withdrawals");
    public IMongoCollection<GuaranteeLock> GuaranteeLocks => _database.GetCollection<GuaranteeLock>("guarantee_locks");
    public IMongoCollection<MarketPurchaseReservation> MarketPurchaseReservations => _database.GetCollection<MarketPurchaseReservation>("market_purchase_reservations");

    #endregion

    #region PQC Security Collections

    public IMongoCollection<UserPqcKey> UserPqcKeys => _database.GetCollection<UserPqcKey>("user_pqc_keys");

    #endregion

    private void CreateIndexes()
    {
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

        // Wallet indexes
        Wallets.Indexes.CreateOne(new CreateIndexModel<UserWallet>(
            Builders<UserWallet>.IndexKeys.Ascending(w => w.UserId),
            new CreateIndexOptions { Unique = true }
        ));

        Transactions.Indexes.CreateOne(new CreateIndexModel<Transaction>(
            Builders<Transaction>.IndexKeys
                .Ascending(t => t.UserId)
                .Descending(t => t.CreatedAt)
        ));

        TransactionLedger.Indexes.CreateOne(new CreateIndexModel<TransactionLedger>(
            Builders<TransactionLedger>.IndexKeys
                .Ascending(l => l.UserId)
                .Descending(l => l.CreatedAt)
        ));

        // Deposit indexes
        DepositRequests.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<DepositRequest>(Builders<DepositRequest>.IndexKeys
                .Ascending(d => d.UserId)
                .Descending(d => d.CreatedAt)),
            new CreateIndexModel<DepositRequest>(Builders<DepositRequest>.IndexKeys.Ascending(d => d.Status))
        });

        try
        {
            DepositRequests.Indexes.CreateOne(new CreateIndexModel<DepositRequest>(
                Builders<DepositRequest>.IndexKeys.Ascending(d => d.ExternalTransactionId),
                new CreateIndexOptions
                {
                    Unique = true,
                    Name = "externalTransactionId_1"
                }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create unique index for deposit externalTransactionId");
        }

        // Transfer indexes
        Transfers.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Transfer>(Builders<Transfer>.IndexKeys
                .Ascending(t => t.SenderId)
                .Descending(t => t.CreatedAt)),
            new CreateIndexModel<Transfer>(Builders<Transfer>.IndexKeys
                .Ascending(t => t.ReceiverId)
                .Descending(t => t.CreatedAt)),
            new CreateIndexModel<Transfer>(Builders<Transfer>.IndexKeys
                .Ascending(t => t.Status)
                .Ascending(t => t.HoldUntil))
        });

        try
        {
            Transfers.Indexes.CreateOne(new CreateIndexModel<Transfer>(
                Builders<Transfer>.IndexKeys.Ascending(t => t.Code),
                new CreateIndexOptions { Unique = true }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create unique index for transfer code");
        }

        try
        {
            Transfers.Indexes.CreateOne(new CreateIndexModel<Transfer>(
                Builders<Transfer>.IndexKeys.Ascending(t => t.CaseLockKey),
                new CreateIndexOptions<Transfer>
                {
                    Unique = true,
                    Name = "caseLockKey_pending_unique",
                    // Allow only one pending lock-funds transfer for each validation-case lock key.
                    PartialFilterExpression = Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Ne(t => t.CaseLockKey, null),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Pending))
                }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create unique partial index for transfer caseLockKey");
        }

        // Guarantee lock indexes
        GuaranteeLocks.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<GuaranteeLock>(Builders<GuaranteeLock>.IndexKeys.Ascending(g => g.UserId)),
            new CreateIndexModel<GuaranteeLock>(
                // Use a different key pattern than (UserId) to avoid Mongo's index options conflict.
                // Partial unique index still enforces: one Active guarantee per user.
                Builders<GuaranteeLock>.IndexKeys
                    .Ascending(g => g.UserId)
                    .Ascending(g => g.Status),
                new CreateIndexOptions<GuaranteeLock>
                {
                    Unique = true,
                    Name = "userId_status_active_unique",
                    PartialFilterExpression = Builders<GuaranteeLock>.Filter.Eq(g => g.Status, GuaranteeStatus.Active)
                })
        });

        // Dispute indexes
        Disputes.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Dispute>(Builders<Dispute>.IndexKeys
                .Ascending(d => d.InitiatorId)
                .Descending(d => d.CreatedAt)),
            new CreateIndexModel<Dispute>(Builders<Dispute>.IndexKeys
                .Ascending(d => d.Status)
                .Descending(d => d.CreatedAt))
        });

        try
        {
            Disputes.Indexes.CreateOne(new CreateIndexModel<Dispute>(
                Builders<Dispute>.IndexKeys.Ascending(d => d.TransferId),
                new CreateIndexOptions { Unique = true }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create unique index for dispute transferId");
        }

        // Withdrawal indexes
        Withdrawals.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<Withdrawal>(Builders<Withdrawal>.IndexKeys
                .Ascending(w => w.UserId)
                .Descending(w => w.CreatedAt)),
            new CreateIndexModel<Withdrawal>(Builders<Withdrawal>.IndexKeys
                .Ascending(w => w.Status)
                .Ascending(w => w.CreatedAt))
        });

        // Market purchase reservation indexes
        MarketPurchaseReservations.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<MarketPurchaseReservation>(Builders<MarketPurchaseReservation>.IndexKeys
                .Ascending(r => r.UserId)
                .Descending(r => r.CreatedAt)),
            new CreateIndexModel<MarketPurchaseReservation>(Builders<MarketPurchaseReservation>.IndexKeys
                .Ascending(r => r.Status)
                .Descending(r => r.UpdatedAt))
        });
        try
        {
            MarketPurchaseReservations.Indexes.CreateOne(new CreateIndexModel<MarketPurchaseReservation>(
                Builders<MarketPurchaseReservation>.IndexKeys
                    .Ascending(r => r.OrderId)
                    .Ascending(r => r.UserId),
                new CreateIndexOptions
                {
                    Unique = true,
                    Name = "orderId_userId_unique"
                }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create unique index for market purchase reservation orderId+userId");
        }

        try
        {
            Withdrawals.Indexes.CreateOne(new CreateIndexModel<Withdrawal>(
                Builders<Withdrawal>.IndexKeys.Ascending(w => w.Reference),
                new CreateIndexOptions { Unique = true }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create unique index for withdrawal reference");
        }

        try
        {
            Withdrawals.Indexes.CreateOne(new CreateIndexModel<Withdrawal>(
                Builders<Withdrawal>.IndexKeys.Ascending(w => w.UserId),
                new CreateIndexOptions<Withdrawal>
                {
                    Unique = true,
                    PartialFilterExpression = Builders<Withdrawal>.Filter.In(
                        w => w.Status,
                        new[] { WithdrawalStatus.Pending, WithdrawalStatus.Processing })
                }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create partial unique index for active withdrawals by user");
        }

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
