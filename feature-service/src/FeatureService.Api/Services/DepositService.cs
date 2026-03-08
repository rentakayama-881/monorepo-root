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
}

public class DepositService : IDepositService
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
    {
        _deposits = dbContext.GetCollection<DepositRequest>("deposit_requests");
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

        // Check for existing unexpired deposit for this user
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

    public async Task<(bool success, string? error)> HandleCallbackAsync(OxaPayCallbackPayload payload)
    {
        if (string.IsNullOrEmpty(payload.TrackId) && string.IsNullOrEmpty(payload.OrderId))
            return (false, "Missing trackId and orderId");

        // Find deposit by trackId or orderId
        DepositRequest? deposit = null;
        if (!string.IsNullOrEmpty(payload.TrackId))
        {
            deposit = await _deposits.Find(d => d.TrackId == payload.TrackId).FirstOrDefaultAsync();
        }
        if (deposit == null && !string.IsNullOrEmpty(payload.OrderId))
        {
            deposit = await _deposits.Find(d => d.Id == payload.OrderId).FirstOrDefaultAsync();
        }

        if (deposit == null)
        {
            _logger.LogWarning("OxaPay callback: deposit not found for trackId={TrackId} orderId={OrderId}",
                payload.TrackId, payload.OrderId);
            return (false, "Deposit not found");
        }

        // Idempotent: skip if already credited
        if (deposit.Status == DepositStatus.Approved)
        {
            _logger.LogInformation("OxaPay callback: deposit {DepositId} already approved, skipping", deposit.Id);
            return (true, null);
        }

        var callbackStatus = payload.Status?.ToLowerInvariant() ?? "";
        _logger.LogInformation("OxaPay callback: deposit {DepositId} status={Status}", deposit.Id, payload.Status);

        switch (callbackStatus)
        {
            case "waiting":
                // No change needed
                break;

            case "confirming":
                await UpdateDepositStatusAsync(deposit.Id, DepositStatus.Confirming, payload.Status);
                break;

            case "paid":
            case "complete":
            case "sending":
                await CreditWalletForDeposit(deposit, payload);
                break;

            case "expired":
                await UpdateDepositStatusAsync(deposit.Id, DepositStatus.Expired, payload.Status);
                break;

            case "failed":
                await UpdateDepositStatusAsync(deposit.Id, DepositStatus.Failed, payload.Status);
                break;

            default:
                _logger.LogWarning("OxaPay callback: unknown status '{Status}' for deposit {DepositId}", payload.Status, deposit.Id);
                await UpdateDepositStatusAsync(deposit.Id, deposit.Status, payload.Status);
                break;
        }

        return (true, null);
    }

    private async Task CreditWalletForDeposit(DepositRequest deposit, OxaPayCallbackPayload payload)
    {
        // Atomically update status to Approved to prevent double-credit
        var filter = Builders<DepositRequest>.Filter.And(
            Builders<DepositRequest>.Filter.Eq(d => d.Id, deposit.Id),
            Builders<DepositRequest>.Filter.Ne(d => d.Status, DepositStatus.Approved));

        var now = DateTime.UtcNow;

        // Calculate credit amount based on actual received crypto
        // If OxaPay reports receivedAmount, convert back to IDR using stored rate
        long creditAmountIdr = deposit.Amount; // fallback to original
        if (payload.ReceivedAmount is > 0 && decimal.TryParse(deposit.Rate, out var rate) && rate > 0)
        {
            // rate = crypto_per_idr, so idr = receivedAmount / rate
            var actualIdr = payload.ReceivedAmount.Value / rate;
            // Subtract platform fee percentage (~5.26% = 1 - 1/1.0526)
            var afterFee = Math.Floor(actualIdr * 0.95m);
            var computedIdr = (long)afterFee;
            if (computedIdr > 0)
            {
                creditAmountIdr = computedIdr;
                _logger.LogInformation(
                    "Deposit {DepositId}: received {Received} {Currency}, converted to {Idr} IDR (rate {Rate}, original {Original} IDR)",
                    deposit.Id, payload.ReceivedAmount, deposit.PayCurrency, creditAmountIdr, deposit.Rate, deposit.Amount);
            }
        }

        var update = Builders<DepositRequest>.Update
            .Set(d => d.Status, DepositStatus.Approved)
            .Set(d => d.OxaPayStatus, payload.Status)
            .Set(d => d.Amount, creditAmountIdr)
            .Set(d => d.UpdatedAt, now)
            .Set(d => d.CreditedAt, now);

        var result = await _deposits.UpdateOneAsync(filter, update);
        if (result.ModifiedCount == 0)
        {
            _logger.LogInformation("Deposit {DepositId} already processed (race condition prevented)", deposit.Id);
            return;
        }

        // Credit wallet with the calculated amount
        string walletTransactionId;
        try
        {
            walletTransactionId = await _walletService.AddBalanceAsync(
                deposit.UserId,
                creditAmountIdr,
                $"Deposit {deposit.PayCurrency} ({deposit.TrackId})",
                TransactionType.Deposit,
                deposit.Id,
                "deposit"
            );
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex,
                "CRITICAL: Failed to credit wallet after deposit approval. DepositId: {DepositId}, UserId: {UserId}, Amount: {Amount}",
                deposit.Id, deposit.UserId, creditAmountIdr);

            // Rollback status
            try
            {
                var rollback = Builders<DepositRequest>.Update
                    .Set(d => d.Status, DepositStatus.Paid)
                    .Set(d => d.OxaPayStatus, "paid_wallet_error")
                    .Set(d => d.UpdatedAt, DateTime.UtcNow)
                    .Unset(d => d.CreditedAt);

                await _deposits.UpdateOneAsync(
                    Builders<DepositRequest>.Filter.Eq(d => d.Id, deposit.Id),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(rollbackEx,
                    "CRITICAL: Failed to rollback deposit status after wallet credit failure. DepositId: {DepositId}",
                    deposit.Id);
            }
            return;
        }

        // Store wallet transaction ID
        try
        {
            var txUpdate = Builders<DepositRequest>.Update
                .Set(d => d.WalletTransactionId, walletTransactionId)
                .Set(d => d.UpdatedAt, DateTime.UtcNow);

            await _deposits.UpdateOneAsync(d => d.Id == deposit.Id, txUpdate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to store walletTransactionId for deposit {DepositId}", deposit.Id);
        }

        _logger.LogInformation(
            "Deposit credited: {DepositId} user {UserId} amount {Amount} IDR, walletTxId {WalletTxId}",
            deposit.Id, deposit.UserId, deposit.Amount, walletTransactionId);
    }

    private async Task UpdateDepositStatusAsync(string depositId, DepositStatus status, string? oxaPayStatus)
    {
        var update = Builders<DepositRequest>.Update
            .Set(d => d.Status, status)
            .Set(d => d.OxaPayStatus, oxaPayStatus)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _deposits.UpdateOneAsync(d => d.Id == depositId, update);
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
