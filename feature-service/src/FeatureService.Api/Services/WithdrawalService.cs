using MongoDB.Bson;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IWithdrawalService
{
    Task<CreateWithdrawalResponse> CreateWithdrawalAsync(uint userId, string username, CreateWithdrawalRequest request);
    Task<List<WithdrawalSummaryDto>> GetUserWithdrawalsAsync(uint userId, WithdrawalStatus? status = null, int limit = 50);
    Task<WithdrawalDto?> GetWithdrawalAsync(string withdrawalId, uint userId);
    Task<(bool success, string? error)> CancelWithdrawalAsync(string withdrawalId, uint userId, string pin);
    Task<List<CryptoCurrencyInfoDto>> GetSupportedCurrenciesAsync();
    Task<(bool success, string? error)> HandlePayoutCallbackAsync(OxaPayCallbackPayload payload);
}

public class WithdrawalService : IWithdrawalService
{
    private readonly IMongoCollection<Withdrawal> _withdrawals;
    private readonly IWalletService _walletService;
    private readonly IOxaPayService _oxaPayService;
    private readonly OxaPaySettings _oxaPaySettings;
    private readonly ILogger<WithdrawalService> _logger;

    // Fee configuration - percentage-based for crypto withdrawals
    private const decimal WithdrawalFeePercent = 0.02m; // 2% platform fee
    private const long MinWithdrawal = 10000; // Minimum Rp10,000
    private const long MaxWithdrawal = 100000000; // Maximum Rp100,000,000
    private const long DailyWithdrawalLimit = 50000000; // Rp50,000,000 per day

    // Supported cryptocurrencies
    private static readonly List<CryptoCurrencyInfoDto> SupportedCurrencies = new()
    {
        new CryptoCurrencyInfoDto("USDT", "Tether (USDT)", new[] { "TRC20", "ERC20", "BEP20", "Polygon", "SOL", "TON" }),
        new CryptoCurrencyInfoDto("TON", "Toncoin", new[] { "TON" })
    };

    public WithdrawalService(
        MongoDbContext dbContext,
        IWalletService walletService,
        IOxaPayService oxaPayService,
        OxaPaySettings oxaPaySettings,
        ILogger<WithdrawalService> logger)
    {
        _withdrawals = dbContext.GetCollection<Withdrawal>("withdrawals");
        _walletService = walletService;
        _oxaPayService = oxaPayService;
        _oxaPaySettings = oxaPaySettings;
        _logger = logger;
    }

    public async Task<CreateWithdrawalResponse> CreateWithdrawalAsync(
        uint userId, string username, CreateWithdrawalRequest request)
    {
        // Validate amount
        if (request.Amount < MinWithdrawal)
            return new CreateWithdrawalResponse(false, null, null, $"Minimal penarikan Rp{MinWithdrawal:N0}");
        
        if (request.Amount > MaxWithdrawal)
            return new CreateWithdrawalResponse(false, null, null, $"Maksimal penarikan Rp{MaxWithdrawal:N0}");

        // Validate crypto currency
        var currency = request.CryptoCurrency.ToUpperInvariant();
        var supported = SupportedCurrencies.Find(c => c.Symbol == currency);
        if (supported == null)
            return new CreateWithdrawalResponse(false, null, null, $"Mata uang {currency} tidak didukung. Gunakan USDT atau TON.");

        // Validate address
        if (string.IsNullOrWhiteSpace(request.CryptoAddress) || request.CryptoAddress.Length < 10)
            return new CreateWithdrawalResponse(false, null, null, "Alamat crypto tidak valid");

        // Verify PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, request.Pin);
        if (!pinResult.Valid)
            return new CreateWithdrawalResponse(false, null, null, pinResult.Message);

        // Calculate fee
        var fee = (long)Math.Ceiling(request.Amount * WithdrawalFeePercent);
        var totalDeduction = request.Amount + fee;
        var netAmount = request.Amount;

        // Check balance
        var wallet = await _walletService.GetOrCreateWalletAsync(userId);
        if (wallet.Balance < totalDeduction)
            return new CreateWithdrawalResponse(false, null, null,
                $"Saldo tidak cukup. Diperlukan Rp{totalDeduction:N0} (termasuk fee Rp{fee:N0})");

        // Check for pending withdrawal
        var pendingCount = await _withdrawals.CountDocumentsAsync(
            w => w.UserId == userId && w.Status == WithdrawalStatus.Processing);
        if (pendingCount > 0)
            return new CreateWithdrawalResponse(false, null, null,
                "Anda memiliki penarikan yang sedang diproses. Harap tunggu hingga selesai.");

        // Check daily withdrawal limit
        var todayStart = DateTime.UtcNow.Date;
        var todayFilter = Builders<Withdrawal>.Filter.And(
            Builders<Withdrawal>.Filter.Eq(w => w.UserId, userId),
            Builders<Withdrawal>.Filter.In(w => w.Status, new[] { WithdrawalStatus.Processing, WithdrawalStatus.Completed }),
            Builders<Withdrawal>.Filter.Gte(w => w.CreatedAt, todayStart));
        var todayWithdrawals = await _withdrawals.Find(todayFilter).ToListAsync();
        var todayTotal = todayWithdrawals.Sum(w => w.Amount);
        if (todayTotal + request.Amount > DailyWithdrawalLimit)
        {
            var remaining = DailyWithdrawalLimit - todayTotal;
            return new CreateWithdrawalResponse(false, null, null,
                $"Melebihi batas penarikan harian (Rp{DailyWithdrawalLimit:N0}/hari). " +
                $"Sisa kuota hari ini: Rp{(remaining > 0 ? remaining : 0):N0}");
        }

        var withdrawalId = ObjectId.GenerateNewId().ToString();
        var reference = GenerateReference();

        // Deduct from wallet first
        var (success, error, _) = await _walletService.DeductBalanceAsync(
            userId,
            totalDeduction,
            $"Penarikan {currency} ke {MaskAddress(request.CryptoAddress)}",
            TransactionType.Withdrawal,
            withdrawalId,
            "withdrawal");

        if (!success)
            return new CreateWithdrawalResponse(false, null, null, error ?? "Gagal memproses penarikan");

        // Call OxaPay Payout API
        OxaPayPayoutResponse oxaPayResponse;
        try
        {
            var payoutRequest = new OxaPayPayoutRequest
            {
                Address = request.CryptoAddress,
                Currency = currency,
                Amount = netAmount,
                Network = string.IsNullOrEmpty(request.Network) ? null : request.Network,
                CallbackUrl = $"{_oxaPaySettings.CallbackBaseUrl.TrimEnd('/')}/api/v1/callbacks/oxapay/payout",
                Memo = request.Memo,
                Description = $"AIValid withdrawal {withdrawalId} user {userId}"
            };

            oxaPayResponse = await _oxaPayService.CreatePayoutAsync(payoutRequest);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OxaPay payout failed for withdrawal {WithdrawalId}. Refunding wallet.", withdrawalId);

            // Refund wallet on OxaPay failure
            try
            {
                _ = await _walletService.AddBalanceAsync(
                    userId,
                    totalDeduction,
                    $"Refund: gagal payout {reference}",
                    TransactionType.Refund,
                    withdrawalId,
                    "withdrawal");
            }
            catch (Exception refundEx)
            {
                _logger.LogCritical(refundEx,
                    "CRITICAL: Failed to refund after OxaPay payout failure. WithdrawalId: {WithdrawalId}, UserId: {UserId}, Amount: {Amount}",
                    withdrawalId, userId, totalDeduction);
            }

            return new CreateWithdrawalResponse(false, null, null,
                $"Gagal membuat payout crypto: {(ex is OxaPayException oxaEx ? oxaEx.Message : "Silakan coba lagi")}");
        }

        var trackId = oxaPayResponse.Data?.TrackId;

        var withdrawal = new Withdrawal
        {
            Id = withdrawalId,
            UserId = userId,
            Username = username,
            Amount = request.Amount,
            Fee = fee,
            NetAmount = netAmount,
            CryptoAddress = request.CryptoAddress,
            CryptoCurrency = currency,
            CryptoNetwork = request.Network,
            Memo = request.Memo,
            TrackId = trackId,
            OxaPayStatus = oxaPayResponse.Data?.Status,
            Status = WithdrawalStatus.Processing,
            Reference = reference,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        try
        {
            await _withdrawals.InsertOneAsync(withdrawal);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to insert withdrawal {WithdrawalId} after wallet deduction and OxaPay call", withdrawalId);

            // Refund wallet
            try
            {
                _ = await _walletService.AddBalanceAsync(
                    userId,
                    totalDeduction,
                    $"Refund: gagal menyimpan penarikan {reference}",
                    TransactionType.Refund,
                    withdrawalId,
                    "withdrawal");
            }
            catch (Exception refundEx)
            {
                _logger.LogCritical(refundEx,
                    "CRITICAL: Failed to refund after withdrawal insert failure. WithdrawalId: {WithdrawalId}",
                    withdrawalId);
            }

            throw;
        }

        _logger.LogInformation(
            "Withdrawal created: {WithdrawalId} user {UserId} amount {Amount} IDR → {Currency} trackId {TrackId}",
            withdrawal.Id, userId, request.Amount, currency, trackId);

        return new CreateWithdrawalResponse(true, withdrawal.Id, reference, null);
    }

    public async Task<List<WithdrawalSummaryDto>> GetUserWithdrawalsAsync(
        uint userId, WithdrawalStatus? status = null, int limit = 50)
    {
        var filter = Builders<Withdrawal>.Filter.Eq(w => w.UserId, userId);

        if (status.HasValue)
        {
            filter = Builders<Withdrawal>.Filter.And(
                filter,
                Builders<Withdrawal>.Filter.Eq(w => w.Status, status.Value));
        }

        var withdrawals = await _withdrawals
            .Find(filter)
            .SortByDescending(w => w.CreatedAt)
            .Limit(limit)
            .ToListAsync();

        return withdrawals.Select(w => new WithdrawalSummaryDto(
            w.Id,
            w.Amount,
            w.NetAmount,
            w.CryptoCurrency,
            w.Status.ToString(),
            w.Reference,
            w.CreatedAt
        )).ToList();
    }

    public async Task<WithdrawalDto?> GetWithdrawalAsync(string withdrawalId, uint userId)
    {
        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();
        
        if (withdrawal == null || withdrawal.UserId != userId)
            return null;

        return MapToDto(withdrawal);
    }

    public async Task<(bool success, string? error)> CancelWithdrawalAsync(
        string withdrawalId, uint userId, string pin)
    {
        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();
        
        if (withdrawal == null || withdrawal.UserId != userId)
            return (false, "Penarikan tidak ditemukan");

        // Can only cancel if not yet processed by OxaPay
        if (withdrawal.Status != WithdrawalStatus.Processing)
            return (false, "Penarikan sudah selesai atau gagal dan tidak bisa dibatalkan");

        // Verify PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        var now = DateTime.UtcNow;

        // Update status first to prevent double-refund
        var updateFilter = Builders<Withdrawal>.Filter.And(
            Builders<Withdrawal>.Filter.Eq(w => w.Id, withdrawalId),
            Builders<Withdrawal>.Filter.Eq(w => w.UserId, userId),
            Builders<Withdrawal>.Filter.Eq(w => w.Status, WithdrawalStatus.Processing));

        var statusUpdate = Builders<Withdrawal>.Update
            .Set(w => w.Status, WithdrawalStatus.Cancelled)
            .Set(w => w.UpdatedAt, now);

        var updateResult = await _withdrawals.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, "Penarikan sudah diproses oleh request lain");

        // Refund full amount (including fee)
        var totalRefund = withdrawal.Amount + withdrawal.Fee;
        try
        {
            _ = await _walletService.AddBalanceAsync(
                userId,
                totalRefund,
                $"Pembatalan penarikan {withdrawal.Reference}",
                TransactionType.Refund,
                withdrawalId,
                "withdrawal");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund cancelled withdrawal {WithdrawalId}. Attempting status rollback.", withdrawalId);

            try
            {
                var rollback = Builders<Withdrawal>.Update
                    .Set(w => w.Status, WithdrawalStatus.Processing)
                    .Set(w => w.UpdatedAt, DateTime.UtcNow);

                await _withdrawals.UpdateOneAsync(
                    Builders<Withdrawal>.Filter.And(
                        Builders<Withdrawal>.Filter.Eq(w => w.Id, withdrawalId),
                        Builders<Withdrawal>.Filter.Eq(w => w.Status, WithdrawalStatus.Cancelled)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(rollbackEx,
                    "CRITICAL: Failed to rollback withdrawal status after refund failure. WithdrawalId: {WithdrawalId}",
                    withdrawalId);
            }

            return (false, "Gagal mengembalikan dana. Silakan coba lagi atau hubungi support.");
        }

        _logger.LogInformation("Withdrawal cancelled: {WithdrawalId} by user {UserId}", withdrawalId, userId);
        return (true, null);
    }

    public Task<List<CryptoCurrencyInfoDto>> GetSupportedCurrenciesAsync()
    {
        return Task.FromResult(SupportedCurrencies);
    }

    public async Task<(bool success, string? error)> HandlePayoutCallbackAsync(OxaPayCallbackPayload payload)
    {
        if (string.IsNullOrEmpty(payload.TrackId))
            return (false, "Missing trackId");

        var withdrawal = await _withdrawals.Find(w => w.TrackId == payload.TrackId).FirstOrDefaultAsync();
        if (withdrawal == null)
        {
            _logger.LogWarning("OxaPay payout callback: withdrawal not found for trackId={TrackId}", payload.TrackId);
            return (false, "Withdrawal not found");
        }

        // Idempotent: skip if already completed or failed
        if (withdrawal.Status is WithdrawalStatus.Completed or WithdrawalStatus.Failed)
        {
            _logger.LogInformation("OxaPay payout callback: withdrawal {WithdrawalId} already {Status}, skipping",
                withdrawal.Id, withdrawal.Status);
            return (true, null);
        }

        var callbackStatus = payload.Status?.ToLowerInvariant() ?? "";
        _logger.LogInformation("OxaPay payout callback: withdrawal {WithdrawalId} status={Status} txId={TxId}",
            withdrawal.Id, payload.Status, payload.TxId);

        switch (callbackStatus)
        {
            case "complete":
            case "completed":
                var completeUpdate = Builders<Withdrawal>.Update
                    .Set(w => w.Status, WithdrawalStatus.Completed)
                    .Set(w => w.OxaPayStatus, payload.Status)
                    .Set(w => w.TxHash, payload.TxId)
                    .Set(w => w.CryptoAmount, payload.Amount?.ToString("G"))
                    .Set(w => w.CompletedAt, DateTime.UtcNow)
                    .Set(w => w.UpdatedAt, DateTime.UtcNow);

                await _withdrawals.UpdateOneAsync(w => w.Id == withdrawal.Id, completeUpdate);
                _logger.LogInformation("Withdrawal completed: {WithdrawalId} txHash={TxHash}", withdrawal.Id, payload.TxId);
                break;

            case "failed":
            case "rejected":
                // Refund wallet
                var totalRefund = withdrawal.Amount + withdrawal.Fee;
                try
                {
                    _ = await _walletService.AddBalanceAsync(
                        withdrawal.UserId,
                        totalRefund,
                        $"Refund payout gagal: {withdrawal.Reference}",
                        TransactionType.Refund,
                        withdrawal.Id,
                        "withdrawal");
                }
                catch (Exception ex)
                {
                    _logger.LogCritical(ex,
                        "CRITICAL: Failed to refund after payout failure. WithdrawalId: {WithdrawalId}, UserId: {UserId}, Amount: {Amount}",
                        withdrawal.Id, withdrawal.UserId, totalRefund);
                }

                var failUpdate = Builders<Withdrawal>.Update
                    .Set(w => w.Status, WithdrawalStatus.Failed)
                    .Set(w => w.OxaPayStatus, payload.Status)
                    .Set(w => w.FailureReason, $"OxaPay payout {callbackStatus}")
                    .Set(w => w.UpdatedAt, DateTime.UtcNow);

                await _withdrawals.UpdateOneAsync(w => w.Id == withdrawal.Id, failUpdate);
                _logger.LogWarning("Withdrawal failed: {WithdrawalId}, refunded user {UserId}", withdrawal.Id, withdrawal.UserId);
                break;

            default:
                // Update OxaPay status for tracking
                var statusUpdate = Builders<Withdrawal>.Update
                    .Set(w => w.OxaPayStatus, payload.Status)
                    .Set(w => w.UpdatedAt, DateTime.UtcNow);

                await _withdrawals.UpdateOneAsync(w => w.Id == withdrawal.Id, statusUpdate);
                break;
        }

        return (true, null);
    }

    // ==================
    // HELPERS
    // ==================

    private static string GenerateReference()
    {
        var date = DateTime.UtcNow.ToString("yyMMdd");
        var random = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        return $"WD{date}{random}";
    }

    private static string MaskAddress(string address)
    {
        if (string.IsNullOrEmpty(address) || address.Length <= 10)
            return "***";
        return address[..6] + "..." + address[^4..];
    }

    private static WithdrawalDto MapToDto(Withdrawal w)
    {
        return new WithdrawalDto(
            w.Id,
            w.UserId,
            w.Username,
            w.Amount,
            w.Fee,
            w.NetAmount,
            w.CryptoAddress,
            w.CryptoCurrency,
            w.CryptoNetwork,
            w.CryptoAmount,
            w.TrackId,
            w.TxHash,
            w.Status.ToString(),
            w.Reference,
            w.FailureReason,
            w.CreatedAt,
            w.CompletedAt
        );
    }
}
