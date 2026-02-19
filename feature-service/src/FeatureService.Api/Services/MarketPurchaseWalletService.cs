using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using MongoDB.Driver;

namespace FeatureService.Api.Services;

public interface IMarketPurchaseWalletService
{
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReserveAsync(uint userId, string orderId, long amountIdr, string? description, string? referenceType);
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> CaptureAsync(uint userId, string orderId, string? reason);
    Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReleaseAsync(uint userId, string orderId, string? reason);
}

public class MarketPurchaseWalletService : IMarketPurchaseWalletService
{
    private readonly IMongoCollection<MarketPurchaseReservation> _reservations;
    private readonly IWalletService _walletService;
    private readonly ILogger<MarketPurchaseWalletService> _logger;

    public MarketPurchaseWalletService(MongoDbContext dbContext, IWalletService walletService, ILogger<MarketPurchaseWalletService> logger)
    {
        _reservations = dbContext.GetCollection<MarketPurchaseReservation>("market_purchase_reservations");
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

        var existing = await _reservations
            .Find(r => r.OrderId == orderId && r.UserId == userId)
            .FirstOrDefaultAsync();

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
            await _reservations.InsertOneAsync(reservation);
            return (true, null, reservation);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            _logger.LogWarning(ex, "Duplicate reservation orderId={OrderId} userId={UserId}", orderId, userId);

            // Compensate if another request already created reservation.
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

            var duplicate = await _reservations
                .Find(r => r.OrderId == orderId && r.UserId == userId)
                .FirstOrDefaultAsync();

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

        var filter = Builders<MarketPurchaseReservation>.Filter.And(
            Builders<MarketPurchaseReservation>.Filter.Eq(r => r.OrderId, orderId),
            Builders<MarketPurchaseReservation>.Filter.Eq(r => r.UserId, userId)
        );

        var reservation = await _reservations.Find(filter).FirstOrDefaultAsync();
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
        var update = Builders<MarketPurchaseReservation>.Update
            .Set(r => r.Status, ReservationStatus.Captured)
            .Set(r => r.Reason, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim())
            .Set(r => r.CapturedAt, now)
            .Set(r => r.UpdatedAt, now);

        await _reservations.UpdateOneAsync(filter, update);
        var updated = await _reservations.Find(filter).FirstOrDefaultAsync();
        return (true, null, updated);
    }

    public async Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReleaseAsync(uint userId, string orderId, string? reason)
    {
        orderId = (orderId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(orderId))
        {
            return (false, "OrderId wajib diisi", null);
        }

        var filter = Builders<MarketPurchaseReservation>.Filter.And(
            Builders<MarketPurchaseReservation>.Filter.Eq(r => r.OrderId, orderId),
            Builders<MarketPurchaseReservation>.Filter.Eq(r => r.UserId, userId)
        );

        var reservation = await _reservations.Find(filter).FirstOrDefaultAsync();
        if (reservation == null)
        {
            return (false, "Reservasi tidak ditemukan", null);
        }

        if (string.Equals(reservation.Status, ReservationStatus.Released, StringComparison.OrdinalIgnoreCase))
        {
            return (true, null, reservation);
        }

        if (!string.Equals(reservation.Status, ReservationStatus.Reserved, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Reservasi tidak bisa direlease", reservation);
        }

        var releaseReason = string.IsNullOrWhiteSpace(reason)
            ? "Release saldo pembelian Market ChatGPT"
            : reason.Trim();

        string transactionId;
        try
        {
            transactionId = await _walletService.AddBalanceAsync(
                userId,
                reservation.AmountIdr,
                releaseReason,
                TransactionType.MarketPurchaseRelease,
                orderId,
                "market_chatgpt");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to release reservation for orderId={OrderId}, userId={UserId}", orderId, userId);
            return (false, "Gagal mengembalikan saldo", reservation);
        }

        var now = DateTime.UtcNow;
        var update = Builders<MarketPurchaseReservation>.Update
            .Set(r => r.Status, ReservationStatus.Released)
            .Set(r => r.Reason, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim())
            .Set(r => r.ReleasedAt, now)
            .Set(r => r.UpdatedAt, now)
            .Set(r => r.ReleaseTransactionId, transactionId);

        await _reservations.UpdateOneAsync(filter, update);

        var updated = await _reservations.Find(filter).FirstOrDefaultAsync();
        return (true, null, updated);
    }
}
