using MongoDB.Driver;
using System.Text.RegularExpressions;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface ITransferService
{
    Task<CreateTransferResponse> CreateTransferAsync(uint senderId, CreateTransferRequest request, string? senderUsername = null);
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

    // Fee configuration - 2% for transfers (integer arithmetic: amount * 2 / 100)
    private const int TransferFeeNumerator = 2;
    private const int TransferFeeDenominator = 100;
    private const int HoursPerDay = 24;
    private const int DefaultHoldHours = 7 * HoursPerDay;
    private const int MaxHoldHours = 30 * HoursPerDay;
    private const string PendingCaseLockIndexName = "caseLockKey_pending_unique";
    private static readonly Regex ValidationCaseLockMessageRegex = new(
        @"Validation\s*Case\s*#(?<caseId>\d+)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

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
    }

    public async Task<CreateTransferResponse> CreateTransferAsync(uint senderId, CreateTransferRequest request, string? senderUsername = null)
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

        // Calculate hold period (default 7 days, max 30 days)
        var holdHours = request.HoldHours > 0 ? Math.Min(request.HoldHours, MaxHoldHours) : DefaultHoldHours;
        var holdUntil = DateTime.UtcNow.AddHours(holdHours);

        var transferMessage = string.IsNullOrWhiteSpace(request.Message)
            ? null
            : request.Message.Trim();
        string? caseLockKey = null;
        if (TryExtractValidationCaseId(transferMessage, out var validationCaseId))
        {
            transferMessage = BuildValidationCaseLockMessage(validationCaseId);
            caseLockKey = BuildValidationCaseLockKey(validationCaseId, senderId, receiver.UserId, request.Amount, holdHours);

            var existingPendingLock = await FindExistingPendingCaseLockAsync(
                senderId,
                receiver.UserId,
                request.Amount,
                transferMessage,
                caseLockKey);

            if (existingPendingLock != null)
            {
                _logger.LogWarning(
                    "Duplicate validation-case lock transfer blocked (pre-check). SenderId={SenderId}, ReceiverId={ReceiverId}, CaseId={CaseId}, ExistingTransferId={TransferId}",
                    senderId,
                    receiver.UserId,
                    validationCaseId,
                    existingPendingLock.Id);
                return ToCreateTransferResponse(existingPendingLock);
            }
        }

        // Get sender's wallet to get username
        var senderWallet = await _walletService.GetOrCreateWalletAsync(senderId);
        senderUsername = !string.IsNullOrWhiteSpace(senderUsername)
            ? senderUsername
            : await GetUsernameFromBackend(senderId);

        // Check sender balance
        if (senderWallet.Balance < request.Amount)
        {
            throw new InvalidOperationException($"Saldo tidak cukup. Saldo: Rp {senderWallet.Balance:N0}, Dibutuhkan: Rp {request.Amount:N0}");
        }

        // Create transfer record (Code assigned just before insert; may retry on duplicate)
        var transfer = new Transfer
        {
            Id = $"trf_{Ulid.NewUlid()}",
            Code = string.Empty,
            SenderId = senderId,
            SenderUsername = senderUsername ?? $"user_{senderId}",
            ReceiverId = receiver.UserId,
            ReceiverUsername = receiver.Username,
            Amount = request.Amount,
            Message = transferMessage,
            CaseLockKey = caseLockKey,
            Status = TransferStatus.Pending,
            HoldUntil = holdUntil,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Deduct from sender's wallet (hold the funds)
        var (deductSuccess, deductError, _) = await _walletService.DeductBalanceAsync(
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

        // Save transfer (retry on duplicate code)
        try
        {
            var inserted = false;
            for (var attempt = 0; attempt < 3; attempt++)
            {
                transfer.Code = await GenerateUniqueCodeAsync();
                try
                {
                    await _transfers.InsertOneAsync(transfer);
                    inserted = true;
                    break;
                }
                catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey && IsPendingCaseLockDuplicate(ex))
                {
                    if (!string.IsNullOrWhiteSpace(caseLockKey))
                    {
                        var existingPendingLock = await FindPendingCaseLockByKeyAsync(caseLockKey);
                        if (existingPendingLock != null)
                        {
                            _logger.LogWarning(
                                "Duplicate validation-case lock transfer blocked (race). SenderId={SenderId}, ReceiverId={ReceiverId}, ExistingTransferId={TransferId}",
                                senderId,
                                receiver.UserId,
                                existingPendingLock.Id);

                            if (!await TryRefundFailedTransferDeductionAsync(
                                    senderId,
                                    request.Amount,
                                    receiver.Username,
                                    transfer.Id,
                                    "duplicate validation-case lock transfer"))
                            {
                                throw new InvalidOperationException(
                                    "Dana sempat terpotong saat request duplikat dan refund otomatis gagal. Hubungi support.");
                            }

                            return ToCreateTransferResponse(existingPendingLock);
                        }
                    }

                    throw;
                }
                catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
                {
                    if (attempt == 2)
                    {
                        throw;
                    }
                }
            }

            if (!inserted)
            {
                throw new InvalidOperationException("Gagal menyimpan transfer setelah percobaan ulang.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to insert transfer {TransferId} after wallet deduction; attempting refund", transfer.Id);

            if (!await TryRefundFailedTransferDeductionAsync(
                    senderId,
                    request.Amount,
                    receiver.Username,
                    transfer.Id,
                    "transfer insertion failure"))
            {
                _logger.LogCritical(
                    "CRITICAL: Failed to refund after transfer insert failure. TransferId: {TransferId}, UserId: {UserId}, Amount: {Amount}",
                    transfer.Id,
                    senderId,
                    request.Amount);
            }

            throw;
        }

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

    private static bool TryExtractValidationCaseId(string? message, out int caseId)
    {
        caseId = 0;
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var match = ValidationCaseLockMessageRegex.Match(message);
        if (!match.Success)
        {
            return false;
        }

        return int.TryParse(match.Groups["caseId"].Value, out caseId) && caseId > 0;
    }

    private static string BuildValidationCaseLockMessage(int caseId)
    {
        return $"Lock Funds: Validation Case #{caseId}";
    }

    private static string BuildValidationCaseLockKey(int caseId, uint senderId, uint receiverId, long amount, int holdHours)
    {
        return $"validation-case-lock:case:{caseId}:sender:{senderId}:receiver:{receiverId}:amount:{amount}:hold:{holdHours}";
    }

    private async Task<Transfer?> FindExistingPendingCaseLockAsync(
        uint senderId,
        uint receiverId,
        long amount,
        string transferMessage,
        string caseLockKey)
    {
        var pendingByLockKey = await FindPendingCaseLockByKeyAsync(caseLockKey);
        if (pendingByLockKey != null)
        {
            return pendingByLockKey;
        }

        // Backward-compatibility for legacy documents before caseLockKey existed.
        return await _transfers.Find(t =>
                t.SenderId == senderId &&
                t.ReceiverId == receiverId &&
                t.Amount == amount &&
                t.Status == TransferStatus.Pending &&
                t.Message == transferMessage)
            .SortByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();
    }

    private async Task<Transfer?> FindPendingCaseLockByKeyAsync(string caseLockKey)
    {
        return await _transfers.Find(t =>
                t.CaseLockKey == caseLockKey &&
                t.Status == TransferStatus.Pending)
            .SortByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();
    }

    private static bool IsPendingCaseLockDuplicate(MongoWriteException ex)
    {
        var msg = ex.WriteError?.Message ?? string.Empty;
        return msg.Contains(PendingCaseLockIndexName, StringComparison.OrdinalIgnoreCase)
            || msg.Contains("caseLockKey", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> TryRefundFailedTransferDeductionAsync(
        uint senderId,
        long amount,
        string receiverUsername,
        string transferId,
        string reason)
    {
        try
        {
            _ = await _walletService.AddBalanceAsync(
                senderId,
                amount,
                $"Refund: {reason} (to @{receiverUsername})",
                TransactionType.Refund,
                transferId,
                "transfer"
            );
            return true;
        }
        catch (Exception refundEx)
        {
            _logger.LogCritical(
                refundEx,
                "CRITICAL: Failed to refund transfer deduction. TransferId: {TransferId}, UserId: {UserId}, Amount: {Amount}, Reason: {Reason}",
                transferId,
                senderId,
                amount,
                reason);
            return false;
        }
    }

    private static CreateTransferResponse ToCreateTransferResponse(Transfer transfer)
    {
        return new CreateTransferResponse(
            transfer.Id,
            transfer.Code,
            transfer.Amount,
            transfer.ReceiverUsername,
            transfer.HoldUntil ?? transfer.CreatedAt
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

        var isSender = transfer.SenderId == userId;
        var isReceiver = transfer.ReceiverId == userId;

        if (!isSender && !isReceiver)
            return (false, "Anda tidak berhak memproses transfer ini");

        if (transfer.Status != TransferStatus.Pending)
            return (false, $"Transfer sudah {transfer.Status}");

        // Escrow rules:
        // - Before holdUntil: only sender can release early
        // - After holdUntil: receiver can claim (release)
        var now = DateTime.UtcNow;
        var holdUntil = transfer.HoldUntil ?? now;
        var holdExpired = holdUntil <= now;

        if (holdExpired)
        {
            if (!isReceiver)
                return (false, "Hold period sudah selesai; hanya penerima yang dapat klaim dana");
        }
        else
        {
            if (!isSender)
                return (false, $"Hold period belum selesai hingga {holdUntil:O}");
        }

        // Verify actor's PIN (sender for early release, receiver for claim)
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Update transfer status first to prevent double-credit (server-side)
        var filterBuilder = Builders<Transfer>.Filter;
        var updateFilter = filterBuilder.And(
            filterBuilder.Eq(t => t.Id, transferId),
            filterBuilder.Eq(t => t.Status, TransferStatus.Pending),
            holdExpired
                ? filterBuilder.Or(
                    filterBuilder.Lte(t => t.HoldUntil, now),
                    filterBuilder.Eq(t => t.HoldUntil, null))
                : filterBuilder.Gt(t => t.HoldUntil, now));

        var statusUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Released)
            .Set(t => t.ReleasedAt, now)
            .Set(t => t.UpdatedAt, now);

        var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, await BuildReleaseConflictMessageAsync(transferId, userId, now));

        // Calculate fee (2% from transfer amount, integer arithmetic - no precision loss)
        var fee = (transfer.Amount * TransferFeeNumerator) / TransferFeeDenominator;
        var amountAfterFee = transfer.Amount - fee;

        // Add to receiver's wallet (minus fee)
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.ReceiverId,
                amountAfterFee,
                $"Transfer dari @{transfer.SenderUsername}",
                TransactionType.TransferIn,
                transfer.Id,
                "transfer"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to credit receiver for released transfer {TransferId}. Attempting status rollback.", transferId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Pending)
                    .Unset(t => t.ReleasedAt)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Released)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after credit failure. TransferId: {TransferId}",
                    transferId);
            }

            return (false, "Gagal melepaskan dana. Silakan coba lagi atau hubungi support.");
        }

        // Record fee (if fee > 0)
        if (fee > 0)
        {
            // Log fee as separate transaction for audit
            _logger.LogInformation(
                "Transfer fee collected: {Fee} from transfer {TransferId}",
                fee, transfer.Id
            );
        }

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

        // Prevent sender from cancelling after hold period ended (anti-fraud)
        var now = DateTime.UtcNow;
        if (transfer.HoldUntil.HasValue && transfer.HoldUntil.Value <= now)
            return (false, "Hold period sudah selesai; transfer tidak bisa dibatalkan oleh pengirim");

        // Verify sender's PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Update status first to prevent double refund
        var filterBuilder = Builders<Transfer>.Filter;
        var updateFilter = filterBuilder.And(
            filterBuilder.Eq(t => t.Id, transferId),
            filterBuilder.Eq(t => t.Status, TransferStatus.Pending),
            filterBuilder.Or(
                filterBuilder.Gt(t => t.HoldUntil, now),
                filterBuilder.Eq(t => t.HoldUntil, null)));

        var statusUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Cancelled)
            .Set(t => t.CancelledAt, now)
            .Set(t => t.CancelReason, reason)
            .Set(t => t.UpdatedAt, now);

        var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, await BuildCancelConflictMessageAsync(transferId, now));

        // Refund to sender
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.SenderId,
                transfer.Amount,
                $"Pembatalan transfer ke @{transfer.ReceiverUsername}",
                TransactionType.Refund,
                transfer.Id,
                "transfer"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund sender for cancelled transfer {TransferId}. Attempting status rollback.", transferId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Pending)
                    .Unset(t => t.CancelledAt)
                    .Unset(t => t.CancelReason)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Cancelled)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after refund failure. TransferId: {TransferId}",
                    transferId);
            }

            return (false, "Gagal mengembalikan dana. Silakan coba lagi atau hubungi support.");
        }

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

        var now = DateTime.UtcNow;

        // Update status first to prevent double refund
        var updateFilter = Builders<Transfer>.Filter.And(
            Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
            Builders<Transfer>.Filter.In(t => t.Status, new[] { TransferStatus.Pending, TransferStatus.Disputed }));

        var statusUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Rejected)
            .Set(t => t.CancelledAt, now)
            .Set(t => t.CancelReason, reason)
            .Set(t => t.UpdatedAt, now);

        var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, await BuildRejectConflictMessageAsync(transferId));

        // Refund to sender (full amount, no fee for rejection)
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.SenderId,
                transfer.Amount,
                $"Penolakan transfer dari @{transfer.ReceiverUsername}",
                TransactionType.Refund,
                transfer.Id,
                "transfer"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund sender for rejected transfer {TransferId}. Attempting status rollback.", transferId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Pending)
                    .Unset(t => t.CancelledAt)
                    .Unset(t => t.CancelReason)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Rejected)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after refund failure. TransferId: {TransferId}",
                    transferId);
            }

            return (false, "Gagal memproses penolakan. Silakan coba lagi atau hubungi support.");
        }

        _logger.LogInformation(
            "Transfer rejected by receiver: {TransferId}, refunded {Amount} to sender",
            transferId, transfer.Amount
        );

        return (true, null);
    }

    private async Task<string> BuildReleaseConflictMessageAsync(string transferId, uint actorUserId, DateTime now)
    {
        var latest = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (latest == null)
            return "Transfer tidak ditemukan";

        if (latest.Status != TransferStatus.Pending)
            return $"Transfer sudah {latest.Status}";

        var holdUntil = latest.HoldUntil ?? now;
        var holdExpired = holdUntil <= now;
        var isSender = latest.SenderId == actorUserId;
        var isReceiver = latest.ReceiverId == actorUserId;

        if (holdExpired && isSender && !isReceiver)
            return "Hold period sudah selesai; hanya penerima yang dapat klaim dana";

        if (!holdExpired && isReceiver && !isSender)
            return $"Hold period belum selesai hingga {holdUntil:O}";

        return "Transfer sedang diproses oleh request lain";
    }

    private async Task<string> BuildCancelConflictMessageAsync(string transferId, DateTime now)
    {
        var latest = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (latest == null)
            return "Transfer tidak ditemukan";

        if (latest.Status != TransferStatus.Pending)
            return $"Transfer sudah {latest.Status}";

        if (latest.HoldUntil.HasValue && latest.HoldUntil.Value <= now)
            return "Hold period sudah selesai; transfer tidak bisa dibatalkan oleh pengirim";

        return "Transfer sedang diproses oleh request lain";
    }

    private async Task<string> BuildRejectConflictMessageAsync(string transferId)
    {
        var latest = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (latest == null)
            return "Transfer tidak ditemukan";

        if (latest.Status != TransferStatus.Pending && latest.Status != TransferStatus.Disputed)
            return $"Transfer sudah {latest.Status}";

        return "Transfer sedang diproses oleh request lain";
    }

    public async Task<SearchUserResponse> SearchUserAsync(string username)
    {
        try
        {
            var backendUrl = GetGoBackendBaseUrl();
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
                var now = DateTime.UtcNow;

                // Mark as released first to ensure exactly-once crediting
                var updateFilter = Builders<Transfer>.Filter.And(
                    Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
                    Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Pending),
                    Builders<Transfer>.Filter.Lt(t => t.HoldUntil, now));

                var statusUpdate = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Released)
                    .Set(t => t.ReleasedAt, now)
                    .Set(t => t.UpdatedAt, now);

                var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
                if (updateResult.ModifiedCount == 0)
                {
                    continue;
                }

                // Calculate fee (integer arithmetic - no precision loss)
                var fee = (transfer.Amount * TransferFeeNumerator) / TransferFeeDenominator;
                var amountAfterFee = transfer.Amount - fee;

                // Add to receiver
                try
                {
                    _ = await _walletService.AddBalanceAsync(
                        transfer.ReceiverId,
                        amountAfterFee,
                        $"Auto-release transfer dari @{transfer.SenderUsername}",
                        TransactionType.TransferIn,
                        transfer.Id,
                        "transfer"
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to credit receiver for auto-released transfer {TransferId}. Attempting status rollback.", transfer.Id);

                    try
                    {
                        var rollback = Builders<Transfer>.Update
                            .Set(t => t.Status, TransferStatus.Pending)
                            .Unset(t => t.ReleasedAt)
                            .Set(t => t.UpdatedAt, DateTime.UtcNow);

                        await _transfers.UpdateOneAsync(
                            Builders<Transfer>.Filter.And(
                                Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
                                Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Released)),
                            rollback);
                    }
                    catch (Exception rollbackEx)
                    {
                        _logger.LogCritical(
                            rollbackEx,
                            "CRITICAL: Failed to rollback transfer status after auto-release credit failure. TransferId: {TransferId}",
                            transfer.Id);
                    }

                    continue;
                }

                _logger.LogInformation(
                    "Auto-released transfer: {TransferId}, amount {Amount}",
                    transfer.Id, amountAfterFee
                );

                await BestEffortNotifyGoBackendEscrowAutoReleasedAsync(transfer.Id);
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

    private string GetGoBackendBaseUrl()
    {
        return (_configuration["Backend:ApiUrl"]
                ?? _configuration["GoBackend:BaseUrl"]
                ?? "http://127.0.0.1:8080").TrimEnd('/');
    }

    private async Task BestEffortNotifyGoBackendEscrowAutoReleasedAsync(string transferId)
    {
        var baseUrl = GetGoBackendBaseUrl();
        var internalKey = _configuration["GoBackend:InternalApiKey"];
        if (string.IsNullOrWhiteSpace(internalKey))
        {
            _logger.LogWarning(
                "GoBackend:InternalApiKey is not configured; skipping validation-case escrow auto-release callback. TransferId: {TransferId}",
                transferId);
            return;
        }

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{baseUrl}/api/internal/validation-cases/escrow/released");

            request.Headers.Add("X-Internal-Api-Key", internalKey);
            request.Content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(new { transfer_id = transferId }),
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Go backend escrow auto-release callback failed. Status: {StatusCode}. Body: {Body}. TransferId: {TransferId}",
                    (int)response.StatusCode,
                    body,
                    transferId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error calling Go backend escrow auto-release callback. TransferId: {TransferId}", transferId);
        }
    }

	    private async Task<string?> GetUsernameFromBackend(uint userId)
	    {
	        try
	        {
	            var backendUrl = GetGoBackendBaseUrl();
	            var response = await _httpClient.GetAsync($"{backendUrl}/api/users/{userId}/public");

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = System.Text.Json.JsonDocument.Parse(json);

                // Try to get username from response
                if (doc.RootElement.TryGetProperty("username", out var usernameElement))
                {
                    var username = usernameElement.GetString();
                    if (!string.IsNullOrEmpty(username))
                    {
                        return username;
                    }
                }
            }

            _logger.LogWarning("Failed to get username for user {UserId}: {StatusCode}",
                userId, response.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching username for user {UserId}", userId);
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
