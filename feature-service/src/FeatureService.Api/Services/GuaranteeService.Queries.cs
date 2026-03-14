using System.Text.Json;
using MongoDB.Driver;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public partial class GuaranteeService
{
    public async Task<GuaranteeLock?> GetActiveGuaranteeAsync(uint userId)
    {
        return await _context.GuaranteeLocks
            .Find(g => g.UserId == userId && g.Status == GuaranteeStatus.Active)
            .FirstOrDefaultAsync();
    }

    public async Task<long> GetGuaranteeAmountAsync(uint userId)
    {
        var active = await GetActiveGuaranteeAsync(userId);
        return active?.Amount ?? 0;
    }

    private sealed record ConsultationLockInfo(uint ValidationCaseId, string EscrowTransferId);

    private async Task EnsureNoActiveValidationCaseLockAsync(uint userId)
    {
        var locks = await GetActiveConsultationLocksAsync(userId);
        if (locks.Count == 0)
        {
            return;
        }

        var preEscrowCaseIds = locks
            .Where(l => string.IsNullOrWhiteSpace(l.EscrowTransferId))
            .Select(l => l.ValidationCaseId)
            .Distinct()
            .ToList();

        if (preEscrowCaseIds.Count > 0)
        {
            var caseList = string.Join(", ", preEscrowCaseIds.Select(id => $"#{id}"));
            throw new InvalidOperationException(
                $"Jaminan tidak bisa dilepas karena Anda masih menjadi validator aktif pada Validation Case {caseList}. Selesaikan kasus terlebih dahulu.");
        }

        var transferIds = locks
            .Select(l => l.EscrowTransferId.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (transferIds.Count == 0)
        {
            return;
        }

        var transfers = await _context.Transfers
            .Find(Builders<Transfer>.Filter.In(t => t.Id, transferIds))
            .ToListAsync();

        var transferById = transfers.ToDictionary(t => t.Id, t => t, StringComparer.Ordinal);
        var unresolvedTransfers = new List<string>();

        foreach (var transferId in transferIds)
        {
            if (!transferById.TryGetValue(transferId, out var transfer))
            {
                unresolvedTransfers.Add(transferId);
                continue;
            }

            if (transfer.ReceiverId != userId)
            {
                unresolvedTransfers.Add(transferId);
                continue;
            }

            if (transfer.Status == TransferStatus.Pending || transfer.Status == TransferStatus.Disputed)
            {
                unresolvedTransfers.Add(transferId);
            }
        }

        if (unresolvedTransfers.Count > 0)
        {
            throw new InvalidOperationException(
                "Jaminan tidak bisa dilepas karena masih ada escrow/dispute Validation Case yang belum selesai.");
        }
    }

    private async Task<IReadOnlyList<ConsultationLockInfo>> GetActiveConsultationLocksAsync(uint userId)
    {
        var baseUrl = GetGoBackendBaseUrl();
        var internalKey = _configuration["GoBackend:InternalApiKey"];
        if (string.IsNullOrWhiteSpace(internalKey))
        {
            _logger.LogWarning(
                "GoBackend:InternalApiKey is not configured; cannot verify consultation lock for user {UserId}",
                userId);
            throw new InvalidOperationException("Status consultation validator belum bisa diverifikasi. Coba lagi nanti.");
        }

        HttpResponseMessage response;
        string body;

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"{baseUrl}/api/internal/users/{userId}/consultation-locks");

            request.Headers.Add("X-Internal-Api-Key", internalKey);
            response = await _httpClient.SendAsync(request);
            body = await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error verifying consultation lock for user {UserId}", userId);
            throw new InvalidOperationException("Status consultation validator belum bisa diverifikasi. Coba lagi nanti.");
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Consultation lock check failed. Status: {StatusCode}. Body: {Body}. UserId: {UserId}",
                (int)response.StatusCode,
                body,
                userId);
            throw new InvalidOperationException("Status consultation validator belum bisa diverifikasi. Coba lagi nanti.");
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var hasLock = root.TryGetProperty("has_active_consultation_lock", out var hasLockEl) &&
                          hasLockEl.ValueKind == JsonValueKind.True;
            if (!hasLock)
            {
                return Array.Empty<ConsultationLockInfo>();
            }

            if (!root.TryGetProperty("locks", out var locksEl) || locksEl.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException("Respons consultation lock tidak valid.");
            }

            var locks = new List<ConsultationLockInfo>();
            foreach (var item in locksEl.EnumerateArray())
            {
                uint validationCaseId = 0;
                if (item.TryGetProperty("validation_case_id", out var caseIdEl) && caseIdEl.ValueKind == JsonValueKind.Number)
                {
                    _ = caseIdEl.TryGetUInt32(out validationCaseId);
                }

                var escrowTransferId = string.Empty;
                if (item.TryGetProperty("escrow_transfer_id", out var transferIdEl) &&
                    transferIdEl.ValueKind == JsonValueKind.String)
                {
                    escrowTransferId = transferIdEl.GetString()?.Trim() ?? string.Empty;
                }

                locks.Add(new ConsultationLockInfo(validationCaseId, escrowTransferId));
            }

            return locks;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse consultation lock response for user {UserId}", userId);
            throw new InvalidOperationException("Status consultation validator belum bisa diverifikasi. Coba lagi nanti.");
        }
    }

    private string GetGoBackendBaseUrl()
    {
        return (_configuration["Backend:ApiUrl"]
                ?? _configuration["GoBackend:BaseUrl"]
                ?? "http://127.0.0.1:8080").TrimEnd('/');
    }

    private async Task BestEffortSyncGuaranteeAmountAsync(uint userId, long amount)
    {
        var baseUrl = GetGoBackendBaseUrl();
        var internalKey = _configuration["GoBackend:InternalApiKey"];
        if (string.IsNullOrWhiteSpace(internalKey))
        {
            _logger.LogWarning(
                "GoBackend:InternalApiKey is not configured; skipping guarantee sync for user {UserId}. Amount: {Amount}",
                userId,
                amount);
            return;
        }

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Put,
                $"{baseUrl}/api/internal/users/{userId}/guarantee");

            request.Headers.Add("X-Internal-Api-Key", internalKey);
            // Ensure guarantee_amount is always present, even when amount=0.
            request.Content = new StringContent(
                $"{{\"guarantee_amount\":{amount}}}",
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var respBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Failed to sync guarantee amount to Go backend. Status: {StatusCode}. Body: {Body}. UserId: {UserId}",
                    (int)response.StatusCode,
                    respBody,
                    userId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error syncing guarantee amount to Go backend for user {UserId}", userId);
        }
    }
}
