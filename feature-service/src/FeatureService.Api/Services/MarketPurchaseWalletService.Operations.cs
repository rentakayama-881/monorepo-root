using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class MarketPurchaseWalletService
{
    public async Task<(bool success, string? error, MarketPurchaseReservation? reservation)> ReleaseAsync(uint userId, string orderId, string? reason)
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

        if (string.Equals(reservation.Status, ReservationStatus.Released, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Reservasi sudah dilepas", reservation);
        }

        if (!string.Equals(reservation.Status, ReservationStatus.Reserved, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Reservasi tidak bisa direlease", reservation);
        }

        var claimNow = DateTime.UtcNow;
        var claimUpdated = await _db.MarketPurchaseReservations
            .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Reserved)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, ReservationStatus.Releasing)
                .SetProperty(r => r.UpdatedAt, claimNow));

        if (claimUpdated == 0)
        {
            var latest = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
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

            var rollbackUpdated = await _db.MarketPurchaseReservations
                .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Releasing)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, ReservationStatus.Reserved)
                    .SetProperty(r => r.UpdatedAt, DateTime.UtcNow));

            if (rollbackUpdated == 0)
            {
                _logger.LogCritical(
                    "Failed to rollback reservation status after release credit failure. orderId={OrderId}, userId={UserId}",
                    orderId,
                    userId);
            }

            var latestAfterRollback = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
            return (false, "Gagal mengembalikan saldo", latestAfterRollback ?? reservation);
        }

        var now = DateTime.UtcNow;
        var finalizeUpdated = await _db.MarketPurchaseReservations
            .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Releasing)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, ReservationStatus.Released)
                .SetProperty(r => r.Reason, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim())
                .SetProperty(r => r.ReleasedAt, now)
                .SetProperty(r => r.UpdatedAt, now)
                .SetProperty(r => r.ReleaseTransactionId, transactionId));

        if (finalizeUpdated == 0)
        {
            _logger.LogCritical(
                "Failed to finalize reservation release because state ownership was lost. orderId={OrderId}, userId={UserId}, transactionId={TransactionId}",
                orderId,
                userId,
                transactionId);

            var latestAfterFinalize = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
            return (false, "Gagal finalize release reservation", latestAfterFinalize ?? reservation);
        }

        var updated = await _db.MarketPurchaseReservations
            .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
        return (true, null, updated);
    }

    public async Task<(IReadOnlyList<MarketPurchaseReservation> items, long total)> GetHistoryAsync(
        uint userId,
        int page,
        int pageSize,
        string? status)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var skip = (page - 1) * pageSize;

        IQueryable<MarketPurchaseReservation> query = _db.MarketPurchaseReservations
            .Where(r => r.UserId == userId);

        var normalizedStatus = (status ?? string.Empty).Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedStatus))
        {
            query = query.Where(r => r.Status == normalizedStatus);
        }

        var total = await query.LongCountAsync();
        var items = await query
            .OrderByDescending(r => r.UpdatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<(bool success, string? error, MarketPurchaseReservation? reservation)> DistributeAsync(
        uint userId,
        string orderId,
        IReadOnlyList<(uint userId, long amountIdr)> recipients,
        string? reason,
        string? referenceType)
    {
        orderId = (orderId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(orderId))
        {
            return (false, "OrderId wajib diisi", null);
        }

        if (recipients == null || recipients.Count == 0)
        {
            return (false, "Recipients minimal 1", null);
        }

        var uniqueRecipients = new Dictionary<uint, long>();
        foreach (var (recipientUserId, amountIdr) in recipients)
        {
            if (recipientUserId == 0)
            {
                return (false, "Recipient userId tidak valid", null);
            }
            if (amountIdr <= 0)
            {
                return (false, "Amount recipient tidak valid", null);
            }
            if (uniqueRecipients.ContainsKey(recipientUserId))
            {
                return (false, "Recipient duplikat tidak diizinkan", null);
            }
            uniqueRecipients[recipientUserId] = amountIdr;
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

        if (!string.Equals(reservation.Status, ReservationStatus.Reserved, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Reservasi tidak bisa didistribusikan", reservation);
        }

        var totalDistribution = uniqueRecipients.Values.Sum();
        if (totalDistribution != reservation.AmountIdr)
        {
            return (false, "Total distribusi harus sama dengan amount reserve", reservation);
        }

        var claimNow = DateTime.UtcNow;
        var claimUpdated = await _db.MarketPurchaseReservations
            .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Reserved)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, ReservationStatus.Releasing)
                .SetProperty(r => r.UpdatedAt, claimNow));

        if (claimUpdated == 0)
        {
            var latest = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
            return (false, "Reservasi sedang diproses", latest);
        }

        var successfulCredits = new List<(uint userId, long amountIdr)>(uniqueRecipients.Count);
        var normalizedReason = string.IsNullOrWhiteSpace(reason)
            ? "Validation case payout"
            : reason.Trim();
        var normalizedReferenceType = string.IsNullOrWhiteSpace(referenceType)
            ? "validation_case"
            : referenceType.Trim();

        try
        {
            foreach (var recipient in uniqueRecipients)
            {
                _ = await _walletService.AddBalanceAsync(
                    recipient.Key,
                    recipient.Value,
                    normalizedReason,
                    TransactionType.TransferIn,
                    orderId,
                    normalizedReferenceType);
                successfulCredits.Add((recipient.Key, recipient.Value));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed distributing reservation orderId={OrderId}, userId={UserId}", orderId, userId);

            // Best-effort compensation for recipients that were already credited.
            foreach (var credit in successfulCredits)
            {
                try
                {
                    _ = await _walletService.DeductBalanceAsync(
                        credit.userId,
                        credit.amountIdr,
                        "Compensation rollback validation case payout",
                        TransactionType.TransferOut,
                        orderId,
                        normalizedReferenceType);
                }
                catch (Exception rollbackEx)
                {
                    _logger.LogCritical(
                        rollbackEx,
                        "CRITICAL: failed compensating recipient rollback. orderId={OrderId}, recipientUserId={RecipientUserId}",
                        orderId,
                        credit.userId);
                }
            }

            await _db.MarketPurchaseReservations
                .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Releasing)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, ReservationStatus.Reserved)
                    .SetProperty(r => r.UpdatedAt, DateTime.UtcNow));

            var latestAfterRollback = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
            return (false, "Gagal distribusi payout", latestAfterRollback ?? reservation);
        }

        var now = DateTime.UtcNow;
        var finalizeUpdated = await _db.MarketPurchaseReservations
            .Where(r => r.OrderId == orderId && r.UserId == userId && r.Status == ReservationStatus.Releasing)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, ReservationStatus.Captured)
                .SetProperty(r => r.CapturedAt, now)
                .SetProperty(r => r.UpdatedAt, now)
                .SetProperty(r => r.Reason, normalizedReason));

        if (finalizeUpdated == 0)
        {
            _logger.LogCritical(
                "Failed finalizing reservation distribution. orderId={OrderId}, userId={UserId}",
                orderId,
                userId);
            var latestAfterFinalize = await _db.MarketPurchaseReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
            return (false, "Gagal finalize distribusi payout", latestAfterFinalize ?? reservation);
        }

        var updated = await _db.MarketPurchaseReservations
            .FirstOrDefaultAsync(r => r.OrderId == orderId && r.UserId == userId);
        return (true, null, updated);
    }
}
