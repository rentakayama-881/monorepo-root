using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
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

public partial class WithdrawalService : IWithdrawalService
{
    private readonly AppDbContext _db;
    private readonly IWalletService _walletService;
    private readonly IOxaPayService _oxaPayService;
    private readonly ICryptoPricingService _cryptoPricingService;
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
        AppDbContext db,
        IWalletService walletService,
        IOxaPayService oxaPayService,
        ICryptoPricingService cryptoPricingService,
        OxaPaySettings oxaPaySettings,
        ILogger<WithdrawalService> logger)
    {
        _db = db;
        _walletService = walletService;
        _oxaPayService = oxaPayService;
        _cryptoPricingService = cryptoPricingService;
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
        var pendingCount = await _db.Withdrawals.CountAsync(
            w => w.UserId == userId && w.Status == WithdrawalStatus.Processing);
        if (pendingCount > 0)
            return new CreateWithdrawalResponse(false, null, null,
                "Anda memiliki penarikan yang sedang diproses. Harap tunggu hingga selesai.");

        // Check daily withdrawal limit
        var todayStart = DateTime.UtcNow.Date;
        var todayTotal = await _db.Withdrawals
            .Where(w => w.UserId == userId
                && (w.Status == WithdrawalStatus.Processing || w.Status == WithdrawalStatus.Completed)
                && w.CreatedAt >= todayStart)
            .SumAsync(w => w.Amount);
        if (todayTotal + request.Amount > DailyWithdrawalLimit)
        {
            var remaining = DailyWithdrawalLimit - todayTotal;
            return new CreateWithdrawalResponse(false, null, null,
                $"Melebihi batas penarikan harian (Rp{DailyWithdrawalLimit:N0}/hari). " +
                $"Sisa kuota hari ini: Rp{(remaining > 0 ? remaining : 0):N0}");
        }

        var withdrawalId = Ulid.NewUlid().ToString();
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
        decimal cryptoAmount;
        try
        {
            // Convert IDR to crypto amount using multi-source pricing
            var priceInIdr = await _cryptoPricingService.GetPriceInIdrAsync(currency);
            if (priceInIdr == null || priceInIdr <= 0)
            {
                _logger.LogError("Failed to get crypto price for {Currency}", currency);
                // Refund wallet
                _ = await _walletService.AddBalanceAsync(userId, totalDeduction,
                    $"Refund: gagal konversi rate {reference}", TransactionType.Refund, withdrawalId, "withdrawal");
                return new CreateWithdrawalResponse(false, null, null,
                    "Gagal mendapatkan harga crypto saat ini. Silakan coba lagi.");
            }

            cryptoAmount = Math.Round((decimal)netAmount / priceInIdr.Value, 8);
            if (cryptoAmount <= 0)
            {
                _ = await _walletService.AddBalanceAsync(userId, totalDeduction,
                    $"Refund: jumlah terlalu kecil {reference}", TransactionType.Refund, withdrawalId, "withdrawal");
                return new CreateWithdrawalResponse(false, null, null,
                    "Jumlah terlalu kecil untuk dikonversi ke crypto.");
            }

            _logger.LogInformation(
                "Withdrawal rate conversion: {Amount} IDR → {CryptoAmount} {Currency} (rate: 1 unit = {Rate} IDR)",
                netAmount, cryptoAmount, currency, priceInIdr.Value);

            var payoutRequest = new OxaPayPayoutRequest
            {
                Address = request.CryptoAddress,
                Currency = currency,
                Amount = cryptoAmount,
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
                "Gagal memproses penarikan crypto. Silakan coba lagi.");
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
            CryptoAmount = cryptoAmount.ToString("G"),
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
            _db.Withdrawals.Add(withdrawal);
            await _db.SaveChangesAsync();
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

}
