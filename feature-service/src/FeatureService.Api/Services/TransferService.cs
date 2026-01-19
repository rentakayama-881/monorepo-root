using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface ITransferService
{
    Task<CreateTransferResponse> CreateTransferAsync(uint senderId, CreateTransferRequest request);
    Task<List<TransferDto>> GetTransfersAsync(uint userId, TransferFilter? filter = null);
    Task<TransferDto?> GetTransferByIdAsync(string transferId, uint userId);
    Task<TransferDto?> GetTransferByCodeAsync(string code, uint userId);
    Task<(bool success, string? error)> ReleaseTransferAsync(string transferId, uint userId, string pin);
    Task<(bool success, string? error)> CancelTransferAsync(string transferId, uint userId, string pin, string reason);
    Task<(bool success, string? error)> RejectTransferAsync(string transferId, uint receiverId, string pin, string reason);
    Task<SearchUserResponse> SearchUserAsync(string username);
    Task AutoReleaseExpiredTransfersAsync();
}

public class TransferFilter
{
    public TransferStatus? Status { get; set; }
    public string? Role { get; set; } // "sender", "receiver", or null for both
    public int Limit { get; set; } = 50;
}

public class TransferService : ITransferService
{
    private readonly IMongoCollection<Transfer> _transfers;
    private readonly IWalletService _walletService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TransferService> _logger;

    // Fee configuration - 2% for transfers
    private const decimal TransferFeePercent = 0.02m;
    private const int DefaultHoldHours = 24;

    public TransferService(
        MongoDbContext dbContext,
        IWalletService walletService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<TransferService> logger)
    {
        _transfers = dbContext.GetCollection<Transfer>("transfers");
        _walletService = walletService;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        CreateIndexes();
    }

    private void CreateIndexes()
    {
        // Index for sender transfers
        _transfers.Indexes.CreateOne(new CreateIndexModel<Transfer>(
            Builders<Transfer>.IndexKeys
                .Ascending(t => t.SenderId)
                .Descending(t => t.CreatedAt)
        ));

        // Index for receiver transfers
        _transfers.Indexes.CreateOne(new CreateIndexModel<Transfer>(
            Builders<Transfer>.IndexKeys
                .Ascending(t => t.ReceiverId)
                .Descending(t => t.CreatedAt)
        ));

        // Unique index for code
        _transfers.Indexes.CreateOne(new CreateIndexModel<Transfer>(
            Builders<Transfer>.IndexKeys.Ascending(t => t.Code),
            new CreateIndexOptions { Unique = true }
        ));

        // Index for auto-release check
        _transfers.Indexes.CreateOne(new CreateIndexModel<Transfer>(
            Builders<Transfer>.IndexKeys
                .Ascending(t => t.Status)
                .Ascending(t => t.HoldUntil)
        ));
    }

    public async Task<CreateTransferResponse> CreateTransferAsync(uint senderId, CreateTransferRequest request)
    {
        // Validate amount
        if (request.Amount <= 0)
        {
            throw new ArgumentException("Jumlah transfer harus lebih dari 0");
        }

        if (request.Amount < 10000)
        {
            throw new ArgumentException("Minimum transfer adalah Rp 10.000");
        }

        // Verify PIN first
        var pinResult = await _walletService.VerifyPinAsync(senderId, request.Pin);
        if (!pinResult.Valid)
        {
            throw new UnauthorizedAccessException(pinResult.Message);
        }

        // Search for receiver
        var receiver = await SearchUserAsync(request.ReceiverUsername);
        if (!receiver.Exists)
        {
            throw new ArgumentException($"User @{request.ReceiverUsername} tidak ditemukan");
        }

        if (receiver.UserId == senderId)
        {
            throw new ArgumentException("Tidak bisa transfer ke diri sendiri");
        }

        // Get sender's wallet to get username
        var senderWallet = await _walletService.GetOrCreateWalletAsync(senderId);
        var senderUsername = await GetUsernameFromBackend(senderId);

        // Check sender balance
        if (senderWallet.Balance < request.Amount)
        {
            throw new InvalidOperationException($"Saldo tidak cukup. Saldo: Rp {senderWallet.Balance:N0}, Dibutuhkan: Rp {request.Amount:N0}");
        }

        // Calculate hold period (max 30 days = 720 hours)
        var holdHours = request.HoldHours > 0 ? Math.Min(request.HoldHours, 720) : DefaultHoldHours;
        var holdUntil = DateTime.UtcNow.AddHours(holdHours);

        // Generate unique 8-digit code
        var code = await GenerateUniqueCodeAsync();

        // Create transfer record
        var transfer = new Transfer
        {
            Id = $"trf_{Ulid.NewUlid()}",
            Code = code,
            SenderId = senderId,
            SenderUsername = senderUsername ?? $"user_{senderId}",
            ReceiverId = receiver.UserId,
            ReceiverUsername = receiver.Username,
            Amount = request.Amount,
            Message = request.Message,
            Status = TransferStatus.Pending,
            HoldUntil = holdUntil,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Deduct from sender's wallet (hold the funds)
        var (deductSuccess, deductError) = await _walletService.DeductBalanceAsync(
            senderId,
            request.Amount,
            $"Transfer ke @{receiver.Username}",
            TransactionType.TransferOut,
            transfer.Id,
            "transfer"
        );

        if (!deductSuccess)
        {
            throw new InvalidOperationException(deductError ?? "Gagal memproses transfer");
        }

        // Save transfer
        await _transfers.InsertOneAsync(transfer);

        _logger.LogInformation(
            "Transfer created: {TransferId} from {SenderId} to {ReceiverId} amount {Amount}",
            transfer.Id, senderId, receiver.UserId, request.Amount
        );

        return new CreateTransferResponse(
            transfer.Id,
            transfer.Code,
            transfer.Amount,
            transfer.ReceiverUsername,
            holdUntil
        );
    }

    public async Task<List<TransferDto>> GetTransfersAsync(uint userId, TransferFilter? filter = null)
    {
        var filterBuilder = Builders<Transfer>.Filter;
        FilterDefinition<Transfer> query;

        if (filter?.Role == "sender")
        {
            query = filterBuilder.Eq(t => t.SenderId, userId);
        }
        else if (filter?.Role == "receiver")
        {
            query = filterBuilder.Eq(t => t.ReceiverId, userId);
        }
        else
        {
            query = filterBuilder.Or(
                filterBuilder.Eq(t => t.SenderId, userId),
                filterBuilder.Eq(t => t.ReceiverId, userId)
            );
        }

        if (filter?.Status.HasValue == true)
        {
            query = filterBuilder.And(query, filterBuilder.Eq(t => t.Status, filter.Status.Value));
        }

        var transfers = await _transfers
            .Find(query)
            .SortByDescending(t => t.CreatedAt)
            .Limit(filter?.Limit ?? 50)
            .ToListAsync();

        return transfers.Select(MapToDto).ToList();
    }

    public async Task<TransferDto?> GetTransferByIdAsync(string transferId, uint userId)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        
        if (transfer == null)
            return null;

        // Only sender or receiver can view
        if (transfer.SenderId != userId && transfer.ReceiverId != userId)
            return null;

        return MapToDto(transfer);
    }

    public async Task<TransferDto?> GetTransferByCodeAsync(string code, uint userId)
    {
        var transfer = await _transfers.Find(t => t.Code == code).FirstOrDefaultAsync();
        
        if (transfer == null)
            return null;

        // Only sender or receiver can view
        if (transfer.SenderId != userId && transfer.ReceiverId != userId)
            return null;

        return MapToDto(transfer);
    }

    public async Task<(bool success, string? error)> ReleaseTransferAsync(string transferId, uint userId, string pin)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // CRITICAL: Only SENDER can release funds early!
        // This is to prevent fraud - receiver must wait for hold period
        // or sender manually releases after satisfied with goods/services
        if (transfer.SenderId != userId)
            return (false, "Hanya pengirim yang dapat melepaskan dana");

        if (transfer.Status != TransferStatus.Pending)
            return (false, $"Transfer sudah {transfer.Status}");

        // Verify SENDER's PIN (only sender can release)
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Calculate fee (2% from transfer amount)
        var fee = (long)(transfer.Amount * TransferFeePercent);
        var amountAfterFee = transfer.Amount - fee;

        // Add to receiver's wallet (minus fee)
        await _walletService.AddBalanceAsync(
            transfer.ReceiverId,
            amountAfterFee,
            $"Transfer dari @{transfer.SenderUsername}",
            TransactionType.TransferIn,
            transfer.Id,
            "transfer"
        );

        // Record fee (if fee > 0)
        if (fee > 0)
        {
            // Log fee as separate transaction for audit
            _logger.LogInformation(
                "Transfer fee collected: {Fee} from transfer {TransferId}",
                fee, transfer.Id
            );
        }

        // Update transfer status
        var update = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Released)
            .Set(t => t.ReleasedAt, DateTime.UtcNow)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);

        await _transfers.UpdateOneAsync(t => t.Id == transferId, update);

        _logger.LogInformation(
            "Transfer released: {TransferId}, amount {Amount}, fee {Fee}",
            transferId, amountAfterFee, fee
        );

        return (true, null);
    }

    public async Task<(bool success, string? error)> CancelTransferAsync(string transferId, uint userId, string pin, string reason)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Only sender can cancel
        if (transfer.SenderId != userId)
            return (false, "Anda tidak berhak membatalkan transfer ini");

        if (transfer.Status != TransferStatus.Pending)
            return (false, $"Transfer sudah {transfer.Status}");

        // Verify sender's PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Refund to sender
        await _walletService.AddBalanceAsync(
            transfer.SenderId,
            transfer.Amount,
            $"Pembatalan transfer ke @{transfer.ReceiverUsername}",
            TransactionType.Refund,
            transfer.Id,
            "transfer"
        );

        // Update transfer status
        var update = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Cancelled)
            .Set(t => t.CancelledAt, DateTime.UtcNow)
            .Set(t => t.CancelReason, reason)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);

        await _transfers.UpdateOneAsync(t => t.Id == transferId, update);

        _logger.LogInformation(
            "Transfer cancelled: {TransferId}, refunded {Amount} to sender",
            transferId, transfer.Amount
        );

        return (true, null);
    }

    public async Task<(bool success, string? error)> RejectTransferAsync(string transferId, uint receiverId, string pin, string reason)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Only receiver can reject
        if (transfer.ReceiverId != receiverId)
            return (false, "Anda tidak berhak menolak transfer ini");

        if (transfer.Status != TransferStatus.Pending && transfer.Status != TransferStatus.Disputed)
            return (false, $"Transfer sudah {transfer.Status}");

        // Verify receiver's PIN
        var pinResult = await _walletService.VerifyPinAsync(receiverId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Refund to sender (full amount, no fee for rejection)
        await _walletService.AddBalanceAsync(
            transfer.SenderId,
            transfer.Amount,
            $"Penolakan transfer dari @{transfer.ReceiverUsername}",
            TransactionType.Refund,
            transfer.Id,
            "transfer"
        );

        // Update transfer status
        var update = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Rejected)
            .Set(t => t.CancelledAt, DateTime.UtcNow)
            .Set(t => t.CancelReason, reason)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);

        await _transfers.UpdateOneAsync(t => t.Id == transferId, update);

        _logger.LogInformation(
            "Transfer rejected by receiver: {TransferId}, refunded {Amount} to sender",
            transferId, transfer.Amount
        );

        return (true, null);
    }

    public async Task<SearchUserResponse> SearchUserAsync(string username)
    {
        try
        {
            var backendUrl = _configuration["Backend:ApiUrl"] ?? "http://localhost:8080";
            var response = await _httpClient.GetAsync($"{backendUrl}/api/user/{username}");
            
            if (!response.IsSuccessStatusCode)
            {
                return new SearchUserResponse(0, username, null, false);
            }

            var content = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
            if (content == null)
            {
                return new SearchUserResponse(0, username, null, false);
            }

            return new SearchUserResponse(
                (uint)content.Id,
                content.Username ?? username,
                content.AvatarUrl,
                true
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to search user {Username}", username);
            return new SearchUserResponse(0, username, null, false);
        }
    }

    public async Task AutoReleaseExpiredTransfersAsync()
    {
        // Find all pending transfers past their hold time
        var expiredTransfers = await _transfers
            .Find(t => t.Status == TransferStatus.Pending && t.HoldUntil < DateTime.UtcNow)
            .ToListAsync();

        foreach (var transfer in expiredTransfers)
        {
            try
            {
                // Calculate fee
                var fee = (long)(transfer.Amount * TransferFeePercent);
                var amountAfterFee = transfer.Amount - fee;

                // Add to receiver
                await _walletService.AddBalanceAsync(
                    transfer.ReceiverId,
                    amountAfterFee,
                    $"Auto-release transfer dari @{transfer.SenderUsername}",
                    TransactionType.TransferIn,
                    transfer.Id,
                    "transfer"
                );

                // Update status
                var update = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Released)
                    .Set(t => t.ReleasedAt, DateTime.UtcNow)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(t => t.Id == transfer.Id, update);

                _logger.LogInformation(
                    "Auto-released transfer: {TransferId}, amount {Amount}",
                    transfer.Id, amountAfterFee
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-release transfer {TransferId}", transfer.Id);
            }
        }

        if (expiredTransfers.Count > 0)
        {
            _logger.LogInformation("Auto-released {Count} expired transfers", expiredTransfers.Count);
        }
    }

    private async Task<string?> GetUsernameFromBackend(uint userId)
    {
        try
        {
            var backendUrl = _configuration["Backend:ApiUrl"] ?? "http://localhost:8080";
            // This would ideally be an internal API call
            // For now, return a placeholder
            return $"user_{userId}";
        }
        catch
        {
            return null;
        }
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        var random = new Random();
        string code;
        bool exists;

        do
        {
            code = random.Next(10000000, 99999999).ToString();
            exists = await _transfers.Find(t => t.Code == code).AnyAsync();
        } while (exists);

        return code;
    }

    private static TransferDto MapToDto(Transfer t) => new(
        t.Id,
        t.Code,
        t.SenderId,
        t.SenderUsername,
        null, // SenderAvatarUrl - can be fetched separately if needed
        t.ReceiverId,
        t.ReceiverUsername,
        null, // ReceiverAvatarUrl - can be fetched separately if needed
        t.Amount,
        t.Message,
        t.Status.ToString(),
        t.HoldUntil,
        t.ReleasedAt,
        t.CancelledAt,
        t.CancelReason,
        t.CreatedAt
    );

    // Helper class for deserializing user profile from backend
    private class UserProfileResponse
    {
        public int Id { get; set; }
        public string? Username { get; set; }
        public string? AvatarUrl { get; set; }
    }
}
