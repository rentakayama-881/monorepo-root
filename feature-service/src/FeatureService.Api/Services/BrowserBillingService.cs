using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IBrowserBillingService
{
    Task<BrowserBillingTickResponse> ProcessBillingTickAsync(BrowserBillingTickRequest request);
    Task<BrowserPricingDto> GetPricingAsync();
    Task<bool> CanStartSessionAsync(uint userId);
    Task EnsureDefaultPricingAsync();
}

public class BrowserBillingService : IBrowserBillingService
{
    private readonly IMongoCollection<BrowserPricing> _pricing;
    private readonly IMongoCollection<BrowserSession> _sessions;
    private readonly IWalletService _walletService;
    private readonly IBrowserSessionService _sessionService;
    private readonly ILogger<BrowserBillingService> _logger;

    public BrowserBillingService(
        MongoDbContext dbContext,
        IWalletService walletService,
        IBrowserSessionService sessionService,
        ILogger<BrowserBillingService> logger)
    {
        _pricing = dbContext.BrowserPricings;
        _sessions = dbContext.BrowserSessions;
        _walletService = walletService;
        _sessionService = sessionService;
        _logger = logger;
    }

    public async Task<BrowserBillingTickResponse> ProcessBillingTickAsync(BrowserBillingTickRequest request)
    {
        // 1. Ambil pricing
        var pricing = await _pricing.Find(p => p.Id == "pricing_default").FirstOrDefaultAsync();
        if (pricing == null)
        {
            await EnsureDefaultPricingAsync();
            pricing = await _pricing.Find(p => p.Id == "pricing_default").FirstOrDefaultAsync();
        }

        if (pricing == null)
        {
            _logger.LogError("Konfigurasi pricing tidak ditemukan setelah ensure default");
            return new BrowserBillingTickResponse(
                Success: false,
                RemainingBalance: 0,
                ShouldStop: true,
                Reason: "Konfigurasi pricing tidak tersedia");
        }

        // 2. Hitung biaya: (harga per jam * menit yang ditagih) / 60
        var cost = (pricing.PricePerHourIdr * request.MinutesToBill) / 60;
        if (cost <= 0) cost = 1; // Minimal 1 IDR per tick

        // 3. Deduct wallet
        var (success, error, transactionId) = await _walletService.DeductBalanceAsync(
            request.UserId,
            cost,
            $"Biaya Smart Browser sesi {request.SessionId} ({request.MinutesToBill} menit)",
            TransactionType.Fee,
            referenceId: request.SessionId,
            referenceType: "browser_session");

        if (!success)
        {
            _logger.LogWarning("Gagal memotong saldo untuk sesi {SessionId} user {UserId}: {Error}",
                request.SessionId, request.UserId, error);

            return new BrowserBillingTickResponse(
                Success: false,
                RemainingBalance: 0,
                ShouldStop: true,
                Reason: error ?? "Saldo tidak mencukupi");
        }

        // 4. Update billed minutes dan total cost di sesi
        var sessionUpdate = Builders<BrowserSession>.Update
            .Inc(s => s.BilledMinutes, request.MinutesToBill)
            .Inc(s => s.TotalCost, cost)
            .Set(s => s.LastBilledAt, DateTime.UtcNow);

        await _sessions.UpdateOneAsync(s => s.Id == request.SessionId, sessionUpdate);

        // 5. Cek sisa saldo
        var wallet = await _walletService.GetOrCreateWalletAsync(request.UserId);
        var shouldStop = wallet.Balance < pricing.MinBalanceToStartIdr;

        _logger.LogInformation(
            "Billing tick sesi {SessionId}: biaya={Cost}, sisa saldo={Balance}, harus stop={ShouldStop}",
            request.SessionId, cost, wallet.Balance, shouldStop);

        return new BrowserBillingTickResponse(
            Success: true,
            RemainingBalance: wallet.Balance,
            ShouldStop: shouldStop,
            Reason: shouldStop ? "Saldo mendekati batas minimum" : null);
    }

    public async Task<BrowserPricingDto> GetPricingAsync()
    {
        var pricing = await _pricing.Find(p => p.Id == "pricing_default").FirstOrDefaultAsync();

        if (pricing == null)
        {
            await EnsureDefaultPricingAsync();
            pricing = await _pricing.Find(p => p.Id == "pricing_default").FirstOrDefaultAsync();
        }

        // Fallback jika masih null (seharusnya tidak terjadi)
        pricing ??= new BrowserPricing
        {
            PricePerHourIdr = 10000,
            BillingIntervalMinutes = 1,
            MinBalanceToStartIdr = 5000,
            MaxConcurrentSessions = 2,
            MaxSessionDurationMinutes = 720,
            IsActive = true
        };

        return new BrowserPricingDto(
            PricePerHourIdr: pricing.PricePerHourIdr,
            BillingIntervalMinutes: pricing.BillingIntervalMinutes,
            MinBalanceToStartIdr: pricing.MinBalanceToStartIdr,
            MaxConcurrentSessions: pricing.MaxConcurrentSessions,
            MaxSessionDurationMinutes: pricing.MaxSessionDurationMinutes,
            IsActive: pricing.IsActive);
    }

    public async Task<bool> CanStartSessionAsync(uint userId)
    {
        var pricing = await _pricing.Find(p => p.Id == "pricing_default").FirstOrDefaultAsync();
        if (pricing == null)
        {
            await EnsureDefaultPricingAsync();
            pricing = await _pricing.Find(p => p.Id == "pricing_default").FirstOrDefaultAsync();
        }

        if (pricing == null || !pricing.IsActive)
            return false;

        // Cek saldo minimum
        var wallet = await _walletService.GetOrCreateWalletAsync(userId);
        if (wallet.Balance < pricing.MinBalanceToStartIdr)
            return false;

        // Cek concurrent sessions
        var activeCount = await _sessionService.GetActiveSessionCountAsync(userId);
        if (activeCount >= pricing.MaxConcurrentSessions)
            return false;

        return true;
    }

    public async Task EnsureDefaultPricingAsync()
    {
        var filter = Builders<BrowserPricing>.Filter.Eq(p => p.Id, "pricing_default");

        var update = Builders<BrowserPricing>.Update
            .SetOnInsert(p => p.Id, "pricing_default")
            .SetOnInsert(p => p.PricePerHourIdr, 10000)
            .SetOnInsert(p => p.BillingIntervalMinutes, 1)
            .SetOnInsert(p => p.MinBalanceToStartIdr, 5000)
            .SetOnInsert(p => p.MaxConcurrentSessions, 2)
            .SetOnInsert(p => p.MaxSessionDurationMinutes, 720)
            .SetOnInsert(p => p.IsActive, true)
            .SetOnInsert(p => p.UpdatedAt, DateTime.UtcNow);

        await _pricing.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
        _logger.LogInformation("Default pricing browser dipastikan tersedia");
    }
}
