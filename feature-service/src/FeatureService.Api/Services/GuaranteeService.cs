using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface IGuaranteeService
{
    Task<GuaranteeLock?> GetActiveGuaranteeAsync(uint userId);
    Task<long> GetGuaranteeAmountAsync(uint userId);
    Task<GuaranteeLock> SetGuaranteeAsync(uint userId, long amount, string pin);
    Task<GuaranteeLock> ReleaseGuaranteeAsync(uint userId, string pin);
    Task SyncGuaranteeAmountAsync(uint userId, long amount);
}

public partial class GuaranteeService : IGuaranteeService
{
    private const long MinGuaranteeAmount = 100_000;

    private readonly AppDbContext _db;
    private readonly IWalletService _walletService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GuaranteeService> _logger;

    public GuaranteeService(
        AppDbContext db,
        IWalletService walletService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GuaranteeService> logger)
    {
        _db = db;
        _walletService = walletService;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<GuaranteeLock> SetGuaranteeAsync(uint userId, long amount, string pin)
    {
        if (amount < MinGuaranteeAmount)
        {
            throw new ArgumentException($"Minimal jaminan adalah Rp {MinGuaranteeAmount:N0}", nameof(amount));
        }

        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
        {
            throw new UnauthorizedAccessException(pinResult.Message);
        }

        var existing = await GetActiveGuaranteeAsync(userId);
        if (existing != null)
        {
            throw new InvalidOperationException("Anda sudah memiliki jaminan aktif. Lepaskan terlebih dahulu.");
        }

        var wallet = await _walletService.GetOrCreateWalletAsync(userId);
        if (wallet.Balance < amount)
        {
            throw new InvalidOperationException("Saldo tidak mencukupi");
        }

        var now = DateTime.UtcNow;
        var guarantee = new GuaranteeLock
        {
            Id = $"grt_{Ulid.NewUlid()}",
            UserId = userId,
            Amount = amount,
            Status = GuaranteeStatus.Active,
            CreatedAt = now,
            UpdatedAt = now,
            ReleasedAt = null
        };

        // Deduct wallet balance first (funds frozen), then insert GuaranteeLock.
        // If insertion fails, attempt refund (similar to TransferService).
        var (deductSuccess, deductError, _) = await _walletService.DeductBalanceAsync(
            userId,
            amount,
            "Jaminan profil (lock)",
            TransactionType.GuaranteeLock,
            guarantee.Id,
            "guarantee"
        );

        if (!deductSuccess)
        {
            throw new InvalidOperationException(deductError ?? "Gagal memproses jaminan");
        }

        try
        {
            _db.GuaranteeLocks.Add(guarantee);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            _db.Entry(guarantee).State = EntityState.Detached;
            _logger.LogWarning(ex, "Duplicate active guarantee detected for user {UserId} after deduction; attempting refund. GuaranteeId: {GuaranteeId}", userId, guarantee.Id);
            await BestEffortRefundAsync(userId, amount, guarantee.Id);
            throw new InvalidOperationException("Anda sudah memiliki jaminan aktif. Lepaskan terlebih dahulu.");
        }

        await BestEffortSyncGuaranteeAmountAsync(userId, amount);

        return guarantee;
    }

    public async Task<GuaranteeLock> ReleaseGuaranteeAsync(uint userId, string pin)
    {
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
        {
            throw new UnauthorizedAccessException(pinResult.Message);
        }

        var active = await GetActiveGuaranteeAsync(userId);
        if (active == null)
        {
            throw new InvalidOperationException("Tidak ada jaminan aktif");
        }

        await EnsureNoActiveValidationCaseLockAsync(userId);

        var now = DateTime.UtcNow;

        // Update status first to prevent double-credit (server-side), then refund wallet.
        var updated = await _db.GuaranteeLocks
            .Where(g => g.Id == active.Id && g.Status == GuaranteeStatus.Active)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.Status, GuaranteeStatus.Released)
                .SetProperty(g => g.ReleasedAt, now)
                .SetProperty(g => g.UpdatedAt, now));

        if (updated == 0)
        {
            throw new InvalidOperationException("Jaminan sudah diproses oleh request lain");
        }

        try
        {
            _ = await _walletService.AddBalanceAsync(
                userId,
                active.Amount,
                "Jaminan profil (release)",
                TransactionType.GuaranteeRelease,
                active.Id,
                "guarantee"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund wallet for released guarantee {GuaranteeId}. Attempting status rollback. UserId: {UserId}", active.Id, userId);

            try
            {
                await _db.GuaranteeLocks
                    .Where(g => g.Id == active.Id && g.Status == GuaranteeStatus.Released)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(g => g.Status, GuaranteeStatus.Active)
                        .SetProperty(g => g.ReleasedAt, (DateTime?)null)
                        .SetProperty(g => g.UpdatedAt, DateTime.UtcNow));
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback guarantee status after refund failure. GuaranteeId: {GuaranteeId}, UserId: {UserId}",
                    active.Id,
                    userId);
            }

            throw new InvalidOperationException("Gagal melepaskan jaminan. Silakan coba lagi atau hubungi support.");
        }

        await BestEffortSyncGuaranteeAmountAsync(userId, 0);

        active.Status = GuaranteeStatus.Released;
        active.ReleasedAt = now;
        active.UpdatedAt = now;
        return active;
    }

    public async Task SyncGuaranteeAmountAsync(uint userId, long amount)
    {
        await BestEffortSyncGuaranteeAmountAsync(userId, amount);
    }

    private async Task BestEffortRefundAsync(uint userId, long amount, string referenceId)
    {
        try
        {
            _ = await _walletService.AddBalanceAsync(
                userId,
                amount,
                "Refund: gagal mengunci jaminan profil",
                TransactionType.Refund,
                referenceId,
                "guarantee"
            );
        }
        catch (Exception refundEx)
        {
            _logger.LogCritical(
                refundEx,
                "CRITICAL: Failed to refund after guarantee set failure. ReferenceId: {ReferenceId}, UserId: {UserId}, Amount: {Amount}",
                referenceId,
                userId,
                amount);
        }
    }
}
