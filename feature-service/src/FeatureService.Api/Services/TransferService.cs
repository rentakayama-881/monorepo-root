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

public partial class TransferService : ITransferService
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
        : this(
            dbContext.GetCollection<Transfer>("transfers"),
            walletService,
            httpClient,
            configuration,
            logger)
    {
    }

    internal TransferService(
        IMongoCollection<Transfer> transfers,
        IWalletService walletService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<TransferService> logger)
    {
        _transfers = transfers;
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

}
