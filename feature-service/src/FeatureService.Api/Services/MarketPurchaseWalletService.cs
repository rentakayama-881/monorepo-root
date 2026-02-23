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
        : this(dbContext.GetCollection<MarketPurchaseReservation>("market_purchase_reservations"), walletService, logger)
    {
    }

    internal MarketPurchaseWalletService(
        IMongoCollection<MarketPurchaseReservation> reservations,
        IWalletService walletService,
        ILogger<MarketPurchaseWalletService> logger)
    {
        _reservations = reservations;
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
            return (false, "Reservasi sudah dilepas", reservation);
        }

        if (!string.Equals(reservation.Status, ReservationStatus.Reserved, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Reservasi tidak bisa direlease", reservation);
        }

        var claimNow = DateTime.UtcNow;
        var claimReservedFilter = Builders<MarketPurchaseReservation>.Filter.And(
            filter,
            Builders<MarketPurchaseReservation>.Filter.Eq(r => r.Status, ReservationStatus.Reserved));
        var claimUpdate = Builders<MarketPurchaseReservation>.Update
            .Set(r => r.Status, ReservationStatus.Releasing)
            .Set(r => r.UpdatedAt, claimNow);

        var claimResult = await _reservations.UpdateOneAsync(claimReservedFilter, claimUpdate);
        if (claimResult.ModifiedCount == 0)
        {
            var latest = await _reservations.Find(filter).FirstOrDefaultAsync();
            var latestStatus = latest?.Status ?? "missing";

            _logger.LogWarning(
                "Release reservation claim skipped because state already processed. orderId={OrderId}, userId={UserId}, latestStatus={LatestStatus}",
                orderId,
                userId,
                latestStatus);

            if (latest == null)
            {
                return (false, "Reservasi tidak ditemukan", null);
            }

            if (string.Equals(latest.Status, ReservationStatus.Released, StringComparison.OrdinalIgnoreCase))
            {
                return (false, "Reservasi sudah dilepas", latest);
            }

            return (false, "Reservasi tidak bisa direlease", latest);
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
            var rollbackResult = await _reservations.UpdateOneAsync(
                Builders<MarketPurchaseReservation>.Filter.And(
                    filter,
                    Builders<MarketPurchaseReservation>.Filter.Eq(r => r.Status, ReservationStatus.Releasing)),
                Builders<MarketPurchaseReservation>.Update
                    .Set(r => r.Status, ReservationStatus.Reserved)
                    .Set(r => r.UpdatedAt, DateTime.UtcNow));

            if (rollbackResult.ModifiedCount == 0)
            {
                _logger.LogCritical(
                    "Failed to rollback reservation status after release credit failure. orderId={OrderId}, userId={UserId}",
                    orderId,
                    userId);
            }

            var latest = await _reservations.Find(filter).FirstOrDefaultAsync();
            return (false, "Gagal mengembalikan saldo", latest ?? reservation);
        }

        var now = DateTime.UtcNow;
        var update = Builders<MarketPurchaseReservation>.Update
            .Set(r => r.Status, ReservationStatus.Released)
            .Set(r => r.Reason, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim())
            .Set(r => r.ReleasedAt, now)
            .Set(r => r.UpdatedAt, now)
            .Set(r => r.ReleaseTransactionId, transactionId);

        var finalizeFilter = Builders<MarketPurchaseReservation>.Filter.And(
            filter,
            Builders<MarketPurchaseReservation>.Filter.Eq(r => r.Status, ReservationStatus.Releasing));

        var finalizeResult = await _reservations.UpdateOneAsync(finalizeFilter, update);
        if (finalizeResult.ModifiedCount == 0)
        {
            _logger.LogCritical(
                "Failed to finalize reservation release because state ownership was lost. orderId={OrderId}, userId={UserId}, transactionId={TransactionId}",
                orderId,
                userId,
                transactionId);

            var latest = await _reservations.Find(filter).FirstOrDefaultAsync();
            return (false, "Gagal finalize release reservation", latest ?? reservation);
        }

        var updated = await _reservations.Find(filter).FirstOrDefaultAsync();
        return (true, null, updated);
    }
}
