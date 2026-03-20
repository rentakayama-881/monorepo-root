using MongoDB.Driver;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class DepositService
{
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
        _logger.LogInformation("OxaPay callback: deposit {DepositId} status={Status} depositStatus={DepositStatus}",
            deposit.Id, payload.Status, deposit.Status);

        // If deposit was cancelled by user but payment arrived, still process it to protect funds.
        // Log warning for monitoring.
        if (deposit.Status == DepositStatus.Cancelled)
        {
            if (callbackStatus is "paid" or "complete" or "sending")
            {
                _logger.LogWarning(
                    "OxaPay callback: deposit {DepositId} was CANCELLED but payment received (status={Status}). Processing to protect user funds.",
                    deposit.Id, payload.Status);
                await CreditWalletForDeposit(deposit, payload);
                return (true, null);
            }
            _logger.LogInformation("OxaPay callback: deposit {DepositId} cancelled, ignoring non-payment callback status={Status}",
                deposit.Id, payload.Status);
            return (true, null);
        }

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

        // Defense-in-depth: cap credit to 120% of original requested amount.
        // Prevents inflated credit even if HMAC is somehow compromised.
        var maxAllowedIdr = (long)(deposit.Amount * 1.2m);
        if (creditAmountIdr > maxAllowedIdr)
        {
            _logger.LogWarning(
                "SECURITY: Deposit {DepositId} computed credit {Credit} IDR exceeds 120% of requested {Requested} IDR. Capping to {Max}.",
                deposit.Id, creditAmountIdr, deposit.Amount, maxAllowedIdr);
            creditAmountIdr = maxAllowedIdr;
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

    public async Task<(bool success, string? error)> CancelDepositAsync(string depositId, uint userId)
    {
        var deposit = await _deposits
            .Find(d => d.Id == depositId && d.UserId == userId)
            .FirstOrDefaultAsync();

        if (deposit == null)
            return (false, "Deposit tidak ditemukan");

        if (deposit.Status != DepositStatus.WaitingPayment)
            return (false, $"Deposit tidak dapat dibatalkan (status: {deposit.Status})");

        var filter = Builders<DepositRequest>.Filter.And(
            Builders<DepositRequest>.Filter.Eq(d => d.Id, depositId),
            Builders<DepositRequest>.Filter.Eq(d => d.Status, DepositStatus.WaitingPayment));

        var update = Builders<DepositRequest>.Update
            .Set(d => d.Status, DepositStatus.Cancelled)
            .Set(d => d.OxaPayStatus, "cancelled_by_user")
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        var result = await _deposits.UpdateOneAsync(filter, update);
        if (result.ModifiedCount == 0)
        {
            _logger.LogWarning("Cancel deposit {DepositId} failed: status changed during cancel (race condition)", depositId);
            return (false, "Deposit sudah berubah status, tidak dapat dibatalkan");
        }

        _logger.LogInformation("Deposit {DepositId} cancelled by user {UserId}", depositId, userId);
        return (true, null);
    }
}
