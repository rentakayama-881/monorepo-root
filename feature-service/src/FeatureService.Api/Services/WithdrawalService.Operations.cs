using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class WithdrawalService
{
    public async Task<List<WithdrawalSummaryDto>> GetUserWithdrawalsAsync(
        uint userId, WithdrawalStatus? status = null, int limit = 50)
    {
        var query = _db.Withdrawals.Where(w => w.UserId == userId);

        if (status.HasValue)
        {
            query = query.Where(w => w.Status == status.Value);
        }

        var withdrawals = await query
            .OrderByDescending(w => w.CreatedAt)
            .Take(limit)
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
        var withdrawal = await _db.Withdrawals.FirstOrDefaultAsync(w => w.Id == withdrawalId);
        
        if (withdrawal == null || withdrawal.UserId != userId)
            return null;

        return MapToDto(withdrawal);
    }

    public async Task<(bool success, string? error)> CancelWithdrawalAsync(
        string withdrawalId, uint userId, string pin)
    {
        var withdrawal = await _db.Withdrawals.FirstOrDefaultAsync(w => w.Id == withdrawalId);
        
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
        var updated = await _db.Withdrawals
            .Where(w => w.Id == withdrawalId && w.UserId == userId && w.Status == WithdrawalStatus.Processing)
            .ExecuteUpdateAsync(s => s
                .SetProperty(w => w.Status, WithdrawalStatus.Cancelled)
                .SetProperty(w => w.UpdatedAt, now));

        if (updated == 0)
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
                await _db.Withdrawals
                    .Where(w => w.Id == withdrawalId && w.Status == WithdrawalStatus.Cancelled)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(w => w.Status, WithdrawalStatus.Processing)
                        .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));
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

        var withdrawal = await _db.Withdrawals.FirstOrDefaultAsync(w => w.TrackId == payload.TrackId);
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

        // All status transitions use atomic filter (Status == Processing)
        // to prevent double-processing from concurrent callbacks.
        switch (callbackStatus)
        {
            case "complete":
            case "completed":
                var completeCount = await _db.Withdrawals
                    .Where(w => w.Id == withdrawal.Id && w.Status == WithdrawalStatus.Processing)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(w => w.Status, WithdrawalStatus.Completed)
                        .SetProperty(w => w.OxaPayStatus, payload.Status)
                        .SetProperty(w => w.TxHash, payload.TxId)
                        .SetProperty(w => w.CryptoAmount, payload.Amount != null ? payload.Amount.Value.ToString("G") : withdrawal.CryptoAmount)
                        .SetProperty(w => w.CompletedAt, DateTime.UtcNow)
                        .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));

                if (completeCount == 0)
                {
                    _logger.LogInformation("Withdrawal {WithdrawalId} already processed (race prevented)", withdrawal.Id);
                    break;
                }
                _logger.LogInformation("Withdrawal completed: {WithdrawalId} txHash={TxHash}", withdrawal.Id, payload.TxId);
                break;

            case "failed":
            case "rejected":
                // CRITICAL: Atomic status update FIRST, then refund.
                // Prevents double-refund from concurrent callbacks.
                var failCount = await _db.Withdrawals
                    .Where(w => w.Id == withdrawal.Id && w.Status == WithdrawalStatus.Processing)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(w => w.Status, WithdrawalStatus.Failed)
                        .SetProperty(w => w.OxaPayStatus, payload.Status)
                        .SetProperty(w => w.FailureReason, $"Payout crypto {callbackStatus}")
                        .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));

                if (failCount == 0)
                {
                    _logger.LogInformation("Withdrawal {WithdrawalId} already processed (race prevented)", withdrawal.Id);
                    break;
                }

                // Refund wallet AFTER atomic status transition succeeded
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

                _logger.LogWarning("Withdrawal failed: {WithdrawalId}, refunded user {UserId}", withdrawal.Id, withdrawal.UserId);
                break;

            default:
                // Update OxaPay status for tracking (only if still Processing)
                await _db.Withdrawals
                    .Where(w => w.Id == withdrawal.Id && w.Status == WithdrawalStatus.Processing)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(w => w.OxaPayStatus, payload.Status)
                        .SetProperty(w => w.UpdatedAt, DateTime.UtcNow));
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
