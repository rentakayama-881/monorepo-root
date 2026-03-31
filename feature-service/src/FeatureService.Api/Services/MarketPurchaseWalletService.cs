using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface IMarketPurchaseWalletService
{
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReserveAsync(uint userId, string orderId, long amountIdr, string? description, string? referenceType);
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> CaptureAsync(uint userId, string orderId, string? reason);
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReleaseAsync(uint userId, string orderId, string? reason);
    Task<(IReadOnlyList<MarketPurchaseReservation> items, long total)> GetHistoryAsync(uint userId, int page, int pageSize, string? status);
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> DistributeAsync(
        uint userId,
        string orderId,
        IReadOnlyList<(uint userId, long amountIdr)> recipients,
        string? reason,
        string? referenceType);
}

public partial class MarketPurchaseWalletService : IMarketPurchaseWalletService
{
    private readonly AppDbContext _db;
    private readonly IWalletService _walletService;
    private readonly ILogger<MarketPurchaseWalletService> _logger;

    public MarketPurchaseWalletService(AppDbContext db, IWalletService walletService, ILogger<MarketPurchaseWalletService> logger)
    {
        _db = db;
        _walletService = walletService;
        _logger = logger;
    }

    public async Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReserveAsync(
        uint userId,
        string orderId,
        long amountIdr,
        string? description,
        string? referenceType)
    {
        if (amountIdr <= 0)
        {
            return (false, "Jumlah tidak valid", null);
        }

        orderId = (orderId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(orderId))
        {
            return (false, "OrderId wajib diisi", null);
        }

        var existing = await _db.MarketPurchaseReservations
            .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);

        if (existing != null)
        {
            if (string.Equals(existing.Status, ReservationStatus.Reserved, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(existing.Status, ReservationStatus.Captured, StringComparison.OrdinalIgnoreCase))
            {
                return (true, null, existing);
            }

            if (string.Equals(existing.Status, ReservationStatus.Released, StringComparison.OrdinalIgnoreCase))
            {
                return (false, "Reservasi untuk order ini sudah dilepas", existing);
            }
        }

        var reserveDescription = string.IsNullOrWhiteSpace(description)
            ? "Reserve saldo pembelian Market ChatGPT"
            : description.Trim();

        var referenceKind = string.IsNullOrWhiteSpace(referenceType) ? "market_chatgpt" : referenceType.Trim();
        var (ok, err, transactionId) = await _walletService.DeductBalanceAsync(
            userId,
            amountIdr,
            reserveDescription,
            TransactionType.MarketPurchaseReserve,
            orderId,
            referenceKind);

        if (!ok || string.IsNullOrWhiteSpace(transactionId))
        {
            return (false, string.IsNullOrWhiteSpace(err) ? "Saldo tidak mencukupi" : err, null);
        }

        var now = DateTime.UtcNow;
        var reservation = new MarketPurchaseReservation
        {
            Id = $"mpr_{Ulid.NewUlid()}",
            OrderId = orderId,
            UserId = userId,
            AmountIdr = amountIdr,
            Status = ReservationStatus.Reserved,
            ReserveTransactionId = transactionId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        try
        {
            _db.MarketPurchaseReservations.Add(reservation);
            await _db.SaveChangesAsync();
            return (true, null, reservation);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Duplicate reservation orderId={OrderId} userId={UserId}", orderId, userId);
            _db.Entry(reservation).State = EntityState.Detached;

            try
            {
                _ = await _walletService.AddBalanceAsync(
                    userId,
                    amountIdr,
                    "Kompensasi reserve duplicate",
                    TransactionType.MarketPurchaseRelease,
                    orderId,
                    referenceKind);
            }
            catch (Exception refundEx)
            {
                _logger.LogCritical(refundEx, "Failed to compensate duplicate reservation for orderId={OrderId}, userId={UserId}", orderId, userId);
            }

            var duplicate = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);

            return (duplicate != null, duplicate == null ? "Gagal membuat reservasi" : null, duplicate);
        }
    }

    public async Task<(bool success, string? error, MarketPurchaseReservation? reservation)> CaptureAsync(uint userId, string orderId, string? reason)
    {
        orderId = (orderId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(orderId))
        {
            return (false, "OrderId wajib diisi", null);
        }

        var reservation = await _db.MarketPurchaseReservations
            .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);

        if (reservation == null)
        {
            return (false, "Reservasi tidak ditemukan", null);
        }

        if (string.Equals(reservation.Status, ReservationStatus.Captured, StringComparison.OrdinalIgnoreCase))
        {
            return (true, null, reservation);
        }

        if (string.Equals(reservation.Status, ReservationStatus.Released, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Reservasi sudah dilepas", reservation);
        }

        var now = DateTime.UtcNow;
        var updated = await _db.MarketPurchaseReservations
            .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Reserved)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, ReservationStatus.Captured)
                .SetProperty(r => r.Reason, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim())
                .SetProperty(r => r.CapturedAt, now)
                .SetProperty(r => r.UpdatedAt, now));

        if (updated == 0)
        {
            var latest = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
            _logger.LogWarning("Capture failed — reservation already modified for orderId={OrderId}, userId={UserId}", orderId, userId);
            return (false, "Reservasi sudah diproses atau dimodifikasi", latest);
        }

        var result = await _db.MarketPurchaseReservations
            .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
        return (true, null, result);
    }
}
