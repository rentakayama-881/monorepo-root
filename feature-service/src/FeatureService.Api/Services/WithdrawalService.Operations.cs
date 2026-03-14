using MongoDB.Bson;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class WithdrawalService
{
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
                    .Set(w => w.FailureReason, $"Payout crypto {callbackStatus}")
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
