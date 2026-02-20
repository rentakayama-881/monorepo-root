using MongoDB.Driver;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class TransferService
{
    public async Task<(bool success, string? error)> ReleaseTransferAsync(string transferId, uint userId, string pin)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();

        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        var isSender = transfer.SenderId == userId;
        var isReceiver = transfer.ReceiverId == userId;

        if (!isSender && !isReceiver)
            return (false, "Anda tidak berhak memproses transfer ini");

        if (transfer.Status != TransferStatus.Pending)
            return (false, $"Transfer sudah {transfer.Status}");

        // Escrow rules:
        // - Before holdUntil: only sender can release early
        // - After holdUntil: receiver can claim (release)
        var now = DateTime.UtcNow;
        var holdUntil = transfer.HoldUntil ?? now;
        var holdExpired = holdUntil <= now;

        if (holdExpired)
        {
            if (!isReceiver)
                return (false, "Hold period sudah selesai; hanya penerima yang dapat klaim dana");
        }
        else
        {
            if (!isSender)
                return (false, $"Hold period belum selesai hingga {holdUntil:O}");
        }

        // Verify actor's PIN (sender for early release, receiver for claim)
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Update transfer status first to prevent double-credit (server-side)
        var filterBuilder = Builders<Transfer>.Filter;
        var updateFilter = filterBuilder.And(
            filterBuilder.Eq(t => t.Id, transferId),
            filterBuilder.Eq(t => t.Status, TransferStatus.Pending),
            holdExpired
                ? filterBuilder.Or(
                    filterBuilder.Lte(t => t.HoldUntil, now),
                    filterBuilder.Eq(t => t.HoldUntil, null))
                : filterBuilder.Gt(t => t.HoldUntil, now));

        var statusUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Released)
            .Set(t => t.ReleasedAt, now)
            .Set(t => t.UpdatedAt, now);

        var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, await BuildReleaseConflictMessageAsync(transferId, userId, now));

        // Calculate fee (2% from transfer amount, integer arithmetic - no precision loss)
        var fee = (transfer.Amount * TransferFeeNumerator) / TransferFeeDenominator;
        var amountAfterFee = transfer.Amount - fee;

        // Add to receiver's wallet (minus fee)
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.ReceiverId,
                amountAfterFee,
                $"Transfer dari @{transfer.SenderUsername}",
                TransactionType.TransferIn,
                transfer.Id,
                "transfer"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to credit receiver for released transfer {TransferId}. Attempting status rollback.", transferId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Pending)
                    .Unset(t => t.ReleasedAt)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Released)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after credit failure. TransferId: {TransferId}",
                    transferId);
            }

            return (false, "Gagal melepaskan dana. Silakan coba lagi atau hubungi support.");
        }

        // Record fee (if fee > 0)
        if (fee > 0)
        {
            // Log fee as separate transaction for audit
            _logger.LogInformation(
                "Transfer fee collected: {Fee} from transfer {TransferId}",
                fee, transfer.Id
            );
        }

        _logger.LogInformation(
            "Transfer released: {TransferId}, amount {Amount}, fee {Fee}",
            transferId, amountAfterFee, fee
        );

        return (true, null);
    }

    public async Task<(bool success, string? error)> CancelTransferAsync(string transferId, uint userId, string pin, string reason)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();

        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Only sender can cancel
        if (transfer.SenderId != userId)
            return (false, "Anda tidak berhak membatalkan transfer ini");

        if (transfer.Status != TransferStatus.Pending)
            return (false, $"Transfer sudah {transfer.Status}");

        // Prevent sender from cancelling after hold period ended (anti-fraud)
        var now = DateTime.UtcNow;
        if (transfer.HoldUntil.HasValue && transfer.HoldUntil.Value <= now)
            return (false, "Hold period sudah selesai; transfer tidak bisa dibatalkan oleh pengirim");

        // Verify sender's PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        // Update status first to prevent double refund
        var filterBuilder = Builders<Transfer>.Filter;
        var updateFilter = filterBuilder.And(
            filterBuilder.Eq(t => t.Id, transferId),
            filterBuilder.Eq(t => t.Status, TransferStatus.Pending),
            filterBuilder.Or(
                filterBuilder.Gt(t => t.HoldUntil, now),
                filterBuilder.Eq(t => t.HoldUntil, null)));

        var statusUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Cancelled)
            .Set(t => t.CancelledAt, now)
            .Set(t => t.CancelReason, reason)
            .Set(t => t.UpdatedAt, now);

        var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, await BuildCancelConflictMessageAsync(transferId, now));

        // Refund to sender
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.SenderId,
                transfer.Amount,
                $"Pembatalan transfer ke @{transfer.ReceiverUsername}",
                TransactionType.Refund,
                transfer.Id,
                "transfer"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund sender for cancelled transfer {TransferId}. Attempting status rollback.", transferId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Pending)
                    .Unset(t => t.CancelledAt)
                    .Unset(t => t.CancelReason)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Cancelled)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after refund failure. TransferId: {TransferId}",
                    transferId);
            }

            return (false, "Gagal mengembalikan dana. Silakan coba lagi atau hubungi support.");
        }

        _logger.LogInformation(
            "Transfer cancelled: {TransferId}, refunded {Amount} to sender",
            transferId, transfer.Amount
        );

        return (true, null);
    }

    public async Task<(bool success, string? error)> RejectTransferAsync(string transferId, uint receiverId, string pin, string reason)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();

        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Only receiver can reject
        if (transfer.ReceiverId != receiverId)
            return (false, "Anda tidak berhak menolak transfer ini");

        if (transfer.Status != TransferStatus.Pending && transfer.Status != TransferStatus.Disputed)
            return (false, $"Transfer sudah {transfer.Status}");

        // Verify receiver's PIN
        var pinResult = await _walletService.VerifyPinAsync(receiverId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        var now = DateTime.UtcNow;

        // Update status first to prevent double refund
        var updateFilter = Builders<Transfer>.Filter.And(
            Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
            Builders<Transfer>.Filter.In(t => t.Status, new[] { TransferStatus.Pending, TransferStatus.Disputed }));

        var statusUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Rejected)
            .Set(t => t.CancelledAt, now)
            .Set(t => t.CancelReason, reason)
            .Set(t => t.UpdatedAt, now);

        var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, await BuildRejectConflictMessageAsync(transferId));

        // Refund to sender (full amount, no fee for rejection)
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.SenderId,
                transfer.Amount,
                $"Penolakan transfer dari @{transfer.ReceiverUsername}",
                TransactionType.Refund,
                transfer.Id,
                "transfer"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund sender for rejected transfer {TransferId}. Attempting status rollback.", transferId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Pending)
                    .Unset(t => t.CancelledAt)
                    .Unset(t => t.CancelReason)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Rejected)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after refund failure. TransferId: {TransferId}",
                    transferId);
            }

            return (false, "Gagal memproses penolakan. Silakan coba lagi atau hubungi support.");
        }

        _logger.LogInformation(
            "Transfer rejected by receiver: {TransferId}, refunded {Amount} to sender",
            transferId, transfer.Amount
        );

        return (true, null);
    }

    private async Task<string> BuildReleaseConflictMessageAsync(string transferId, uint actorUserId, DateTime now)
    {
        var latest = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (latest == null)
            return "Transfer tidak ditemukan";

        if (latest.Status != TransferStatus.Pending)
            return $"Transfer sudah {latest.Status}";

        var holdUntil = latest.HoldUntil ?? now;
        var holdExpired = holdUntil <= now;
        var isSender = latest.SenderId == actorUserId;
        var isReceiver = latest.ReceiverId == actorUserId;

        if (holdExpired && isSender && !isReceiver)
            return "Hold period sudah selesai; hanya penerima yang dapat klaim dana";

        if (!holdExpired && isReceiver && !isSender)
            return $"Hold period belum selesai hingga {holdUntil:O}";

        return "Transfer sedang diproses oleh request lain";
    }

    private async Task<string> BuildCancelConflictMessageAsync(string transferId, DateTime now)
    {
        var latest = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (latest == null)
            return "Transfer tidak ditemukan";

        if (latest.Status != TransferStatus.Pending)
            return $"Transfer sudah {latest.Status}";

        if (latest.HoldUntil.HasValue && latest.HoldUntil.Value <= now)
            return "Hold period sudah selesai; transfer tidak bisa dibatalkan oleh pengirim";

        return "Transfer sedang diproses oleh request lain";
    }

    private async Task<string> BuildRejectConflictMessageAsync(string transferId)
    {
        var latest = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (latest == null)
            return "Transfer tidak ditemukan";

        if (latest.Status != TransferStatus.Pending && latest.Status != TransferStatus.Disputed)
            return $"Transfer sudah {latest.Status}";

        return "Transfer sedang diproses oleh request lain";
    }

    public async Task<SearchUserResponse> SearchUserAsync(string username)
    {
        try
        {
            var backendUrl = GetGoBackendBaseUrl();
            var response = await _httpClient.GetAsync($"{backendUrl}/api/user/{username}");

            if (!response.IsSuccessStatusCode)
            {
                return new SearchUserResponse(0, username, null, false);
            }

            var content = await response.Content.ReadFromJsonAsync<UserProfileResponse>();
            if (content == null)
            {
                return new SearchUserResponse(0, username, null, false);
            }

            return new SearchUserResponse(
                (uint)content.Id,
                content.Username ?? username,
                content.AvatarUrl,
                true
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to search user {Username}", username);
            return new SearchUserResponse(0, username, null, false);
        }
    }

    public async Task AutoReleaseExpiredTransfersAsync()
    {
        // Find all pending transfers past their hold time
        var expiredTransfers = await _transfers
            .Find(t => t.Status == TransferStatus.Pending && t.HoldUntil < DateTime.UtcNow)
            .ToListAsync();

        foreach (var transfer in expiredTransfers)
        {
            try
            {
                var now = DateTime.UtcNow;

                // Mark as released first to ensure exactly-once crediting
                var updateFilter = Builders<Transfer>.Filter.And(
                    Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
                    Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Pending),
                    Builders<Transfer>.Filter.Lt(t => t.HoldUntil, now));

                var statusUpdate = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Released)
                    .Set(t => t.ReleasedAt, now)
                    .Set(t => t.UpdatedAt, now);

                var updateResult = await _transfers.UpdateOneAsync(updateFilter, statusUpdate);
                if (updateResult.ModifiedCount == 0)
                {
                    continue;
                }

                // Calculate fee (integer arithmetic - no precision loss)
                var fee = (transfer.Amount * TransferFeeNumerator) / TransferFeeDenominator;
                var amountAfterFee = transfer.Amount - fee;

                // Add to receiver
                try
                {
                    _ = await _walletService.AddBalanceAsync(
                        transfer.ReceiverId,
                        amountAfterFee,
                        $"Auto-release transfer dari @{transfer.SenderUsername}",
                        TransactionType.TransferIn,
                        transfer.Id,
                        "transfer"
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to credit receiver for auto-released transfer {TransferId}. Attempting status rollback.", transfer.Id);

                    try
                    {
                        var rollback = Builders<Transfer>.Update
                            .Set(t => t.Status, TransferStatus.Pending)
                            .Unset(t => t.ReleasedAt)
                            .Set(t => t.UpdatedAt, DateTime.UtcNow);

                        await _transfers.UpdateOneAsync(
                            Builders<Transfer>.Filter.And(
                                Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
                                Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Released)),
                            rollback);
                    }
                    catch (Exception rollbackEx)
                    {
                        _logger.LogCritical(
                            rollbackEx,
                            "CRITICAL: Failed to rollback transfer status after auto-release credit failure. TransferId: {TransferId}",
                            transfer.Id);
                    }

                    continue;
                }

                _logger.LogInformation(
                    "Auto-released transfer: {TransferId}, amount {Amount}",
                    transfer.Id, amountAfterFee
                );

                await BestEffortNotifyGoBackendEscrowAutoReleasedAsync(transfer.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-release transfer {TransferId}", transfer.Id);
            }
        }

        if (expiredTransfers.Count > 0)
        {
            _logger.LogInformation("Auto-released {Count} expired transfers", expiredTransfers.Count);
        }
    }

    private string GetGoBackendBaseUrl()
    {
        return (_configuration["Backend:ApiUrl"]
                ?? _configuration["GoBackend:BaseUrl"]
                ?? "http://127.0.0.1:8080").TrimEnd('/');
    }

    private async Task BestEffortNotifyGoBackendEscrowAutoReleasedAsync(string transferId)
    {
        var baseUrl = GetGoBackendBaseUrl();
        var internalKey = _configuration["GoBackend:InternalApiKey"];
        if (string.IsNullOrWhiteSpace(internalKey))
        {
            _logger.LogWarning(
                "GoBackend:InternalApiKey is not configured; skipping validation-case escrow auto-release callback. TransferId: {TransferId}",
                transferId);
            return;
        }

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{baseUrl}/api/internal/validation-cases/escrow/released");

            request.Headers.Add("X-Internal-Api-Key", internalKey);
            request.Content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(new { transfer_id = transferId }),
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Go backend escrow auto-release callback failed. Status: {StatusCode}. Body: {Body}. TransferId: {TransferId}",
                    (int)response.StatusCode,
                    body,
                    transferId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error calling Go backend escrow auto-release callback. TransferId: {TransferId}", transferId);
        }
    }

	    private async Task<string?> GetUsernameFromBackend(uint userId)
	    {
	        try
	        {
	            var backendUrl = GetGoBackendBaseUrl();
	            var response = await _httpClient.GetAsync($"{backendUrl}/api/users/{userId}/public");

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = System.Text.Json.JsonDocument.Parse(json);

                // Try to get username from response
                if (doc.RootElement.TryGetProperty("username", out var usernameElement))
                {
                    var username = usernameElement.GetString();
                    if (!string.IsNullOrEmpty(username))
                    {
                        return username;
                    }
                }
            }

            _logger.LogWarning("Failed to get username for user {UserId}: {StatusCode}",
                userId, response.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching username for user {UserId}", userId);
            return null;
        }
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        var random = new Random();
        string code;
        bool exists;

        do
        {
            code = random.Next(10000000, 99999999).ToString();
            exists = await _transfers.Find(t => t.Code == code).AnyAsync();
        } while (exists);

        return code;
    }

    private static TransferDto MapToDto(Transfer t) => new(
        t.Id,
        t.Code,
        t.SenderId,
        t.SenderUsername,
        null, // SenderAvatarUrl - can be fetched separately if needed
        t.ReceiverId,
        t.ReceiverUsername,
        null, // ReceiverAvatarUrl - can be fetched separately if needed
        t.Amount,
        t.Message,
        t.Status.ToString(),
        t.HoldUntil,
        t.ReleasedAt,
        t.CancelledAt,
        t.CancelReason,
        t.CreatedAt
    );

    // Helper class for deserializing user profile from backend
    private class UserProfileResponse
    {
        public int Id { get; set; }
        public string? Username { get; set; }
        public string? AvatarUrl { get; set; }
    }
}
