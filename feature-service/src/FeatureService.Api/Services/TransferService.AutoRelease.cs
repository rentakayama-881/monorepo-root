using MongoDB.Driver;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class TransferService
{
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
