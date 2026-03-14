using MongoDB.Bson;
using MongoDB.Driver;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface IDepositService
{
    Task<CreateDepositResponse> CreateRequestAsync(uint userId, string username, CreateDepositRequest request);
    Task<DepositHistoryResponse> GetUserDepositsAsync(uint userId, int limit = 50);
    Task<DepositStatusResponse?> GetDepositStatusAsync(string depositId, uint userId);
    Task<CreateDepositResponse?> GetPendingDepositAsync(uint userId);
    Task<(bool success, string? error)> HandleCallbackAsync(OxaPayCallbackPayload payload);
    Task<(bool success, string? error)> CancelDepositAsync(string depositId, uint userId);
}

public partial class DepositService : IDepositService
{
    private readonly IMongoCollection<DepositRequest> _deposits;
    private readonly IWalletService _walletService;
    private readonly IOxaPayService _oxaPayService;
    private readonly OxaPaySettings _oxaPaySettings;
    private readonly ILogger<DepositService> _logger;

    private const long MinDeposit = 2000;
    private const long MaxDeposit = 4_000_000; // Rp 4 juta

    public DepositService(
        MongoDbContext dbContext,
        IWalletService walletService,
        IOxaPayService oxaPayService,
        OxaPaySettings oxaPaySettings,
        ILogger<DepositService> logger)
        : this(
            dbContext.GetCollection<DepositRequest>("deposit_requests"),
            walletService,
            oxaPayService,
            oxaPaySettings,
            logger)
    {
    }

    internal DepositService(
        IMongoCollection<DepositRequest> deposits,
        IWalletService walletService,
        IOxaPayService oxaPayService,
        OxaPaySettings oxaPaySettings,
        ILogger<DepositService> logger)
    {
        _deposits = deposits;
        _walletService = walletService;
        _oxaPayService = oxaPayService;
        _oxaPaySettings = oxaPaySettings;
        _logger = logger;
    }

    public async Task<CreateDepositResponse> CreateRequestAsync(uint userId, string username, CreateDepositRequest request)
    {
        if (request.Amount < MinDeposit)
            throw new ArgumentException($"Minimum deposit Rp{MinDeposit:N0}");

        if (request.Amount > MaxDeposit)
            throw new ArgumentException($"Maksimum deposit Rp{MaxDeposit:N0}");

        // Check for existing unexpired deposit for this user (skip cancelled)
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var existingPending = await _deposits
            .Find(d => d.UserId == userId
                && d.Status == DepositStatus.WaitingPayment
                && d.ExpiredAt > now)
            .SortByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync();

        if (existingPending != null)
        {
            _logger.LogInformation("Reusing existing pending deposit {DepositId} for user {UserId}", existingPending.Id, userId);
            return MapToCreateResponse(existingPending);
        }

        // Calculate fee: amount ÷ 0.95 = total charge, fee = total - amount
        // Use checked arithmetic to prevent overflow
        long chargeAmount;
        long platformFee;
        checked
        {
            var chargeAmountDecimal = Math.Ceiling((decimal)request.Amount / 0.95m);
            chargeAmount = (long)chargeAmountDecimal;
            platformFee = chargeAmount - request.Amount;
        }

        var payCurrency = request.PayCurrency ?? _oxaPaySettings.DefaultPayCurrency;
        var network = request.Network ?? _oxaPaySettings.DefaultNetwork;
        var depositId = ObjectId.GenerateNewId().ToString();

        // Call OxaPay White Label API
        var oxaPayRequest = new OxaPayWhiteLabelRequest
        {
            Amount = chargeAmount,
            Currency = "IDR",
            PayCurrency = payCurrency,
            Network = string.IsNullOrEmpty(network) ? null : network,
            Lifetime = _oxaPaySettings.PaymentLifetimeMinutes,
            FeePaidByPayer = 1,
            UnderPaidCoverage = _oxaPaySettings.UnderPaidCoverage,
            CallbackUrl = $"{_oxaPaySettings.CallbackBaseUrl.TrimEnd('/')}/api/v1/callbacks/oxapay/payment",
            OrderId = depositId,
            Description = $"AIValid deposit {depositId} user {userId}"
        };

        OxaPayWhiteLabelResponse oxaPayResponse;
        try
        {
            oxaPayResponse = await _oxaPayService.CreateWhiteLabelPaymentAsync(oxaPayRequest);
        }
        catch (OxaPayException ex)
        {
            _logger.LogError(ex, "OxaPay white-label failed for user {UserId}: {Message}", userId, ex.Message);
            throw new InvalidOperationException("Gagal membuat pembayaran crypto. Silakan coba lagi.");
        }

        var data = oxaPayResponse.Data
            ?? throw new InvalidOperationException("Respons pembayaran tidak lengkap. Silakan coba lagi.");

        var deposit = new DepositRequest
        {
            Id = depositId,
            UserId = userId,
            Username = username,
            Amount = request.Amount,
            PlatformFee = platformFee,
            TrackId = data.TrackId,
            PayCurrency = data.PayCurrency,
            PayAmount = data.PayAmount.ToString("G"),
            Network = data.Network ?? payCurrency,
            Address = data.Address,
            QrCode = data.QrCode,
            Rate = data.Rate?.ToString("G"),
            ExpiredAt = data.ExpiredAt,
            Status = DepositStatus.WaitingPayment,
            OxaPayStatus = "Waiting",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _deposits.InsertOneAsync(deposit);

        _logger.LogInformation(
            "Deposit created: {DepositId} user {UserId} amount {Amount} IDR → {PayAmount} {PayCurrency} trackId {TrackId}",
            deposit.Id, userId, request.Amount, data.PayAmount, data.PayCurrency, data.TrackId);

        return MapToCreateResponse(deposit);
    }

    public async Task<DepositHistoryResponse> GetUserDepositsAsync(uint userId, int limit = 50)
    {
        var deposits = await _deposits
            .Find(d => d.UserId == userId)
            .SortByDescending(d => d.CreatedAt)
            .Limit(Math.Clamp(limit, 1, 100))
            .ToListAsync();

        var items = deposits.Select(d => new DepositRequestResponse(
            d.Id,
            d.Amount,
            d.PlatformFee,
            d.PayCurrency,
            d.PayAmount,
            d.Network ?? d.PayCurrency,
            d.Status.ToString(),
            d.CreatedAt,
            d.ExpiredAt
        )).ToList();

        return new DepositHistoryResponse(items, deposits.Count);
    }

    public async Task<CreateDepositResponse?> GetPendingDepositAsync(uint userId)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var deposit = await _deposits
            .Find(d => d.UserId == userId
                && d.Status == DepositStatus.WaitingPayment
                && d.ExpiredAt > now)
            .SortByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync();

        if (deposit == null)
            return null;

        return new CreateDepositResponse(
            deposit.Id,
            deposit.TrackId,
            deposit.Address,
            deposit.QrCode,
            deposit.PayAmount,
            deposit.PayCurrency,
            deposit.Network ?? deposit.PayCurrency,
            deposit.Rate,
            deposit.ExpiredAt,
            deposit.PlatformFee,
            deposit.Amount
        );
    }

    public async Task<DepositStatusResponse?> GetDepositStatusAsync(string depositId, uint userId)
    {
        var deposit = await _deposits
            .Find(d => d.Id == depositId && d.UserId == userId)
            .FirstOrDefaultAsync();

        if (deposit == null)
            return null;

        return new DepositStatusResponse(
            deposit.Status.ToString(),
            deposit.PayAmount,
            deposit.PayCurrency,
            deposit.Network ?? deposit.PayCurrency,
            deposit.Address,
            deposit.QrCode,
            deposit.ExpiredAt,
            deposit.WalletTransactionId != null
        );
    }

    private static CreateDepositResponse MapToCreateResponse(DepositRequest d) => new(
        d.Id,
        d.TrackId,
        d.Address,
        d.QrCode,
        d.PayAmount,
        d.PayCurrency,
        d.Network,
        d.Rate,
        d.ExpiredAt,
        d.PlatformFee,
        d.Amount
    );
}
