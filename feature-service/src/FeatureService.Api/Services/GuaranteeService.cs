using System.Linq;
using System.Text;
using System.Text.Json;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Services;

public interface IGuaranteeService
{
    Task<GuaranteeLock?> GetActiveGuaranteeAsync(uint userId);
    Task<long> GetGuaranteeAmountAsync(uint userId);
    Task<GuaranteeLock> SetGuaranteeAsync(uint userId, long amount, string pin);
    Task<GuaranteeLock> ReleaseGuaranteeAsync(uint userId, string pin);
    Task SyncGuaranteeAmountAsync(uint userId, long amount);
}

public class GuaranteeService : IGuaranteeService
{
    private const long MinGuaranteeAmount = 100_000;

    private readonly MongoDbContext _context;
    private readonly IWalletService _walletService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GuaranteeService> _logger;

    public GuaranteeService(
        MongoDbContext context,
        IWalletService walletService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GuaranteeService> logger)
    {
        _context = context;
        _walletService = walletService;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

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

    public async Task<GuaranteeLock> SetGuaranteeAsync(uint userId, long amount, string pin)
    {
        if (amount < MinGuaranteeAmount)
        {
            throw new ArgumentException($"Minimal jaminan adalah Rp {MinGuaranteeAmount:N0}", nameof(amount));
        }

        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
        {
            throw new UnauthorizedAccessException(pinResult.Message);
        }

        var existing = await GetActiveGuaranteeAsync(userId);
        if (existing != null)
        {
            throw new InvalidOperationException("Anda sudah memiliki jaminan aktif. Lepaskan terlebih dahulu.");
        }

        var wallet = await _walletService.GetOrCreateWalletAsync(userId);
        if (wallet.Balance < amount)
        {
            throw new InvalidOperationException("Saldo tidak mencukupi");
        }

        var now = DateTime.UtcNow;
        var guarantee = new GuaranteeLock
        {
            Id = $"grt_{Ulid.NewUlid()}",
            UserId = userId,
            Amount = amount,
            Status = GuaranteeStatus.Active,
            CreatedAt = now,
            UpdatedAt = now,
            ReleasedAt = null
        };

        // Deduct wallet balance first (funds frozen), then insert GuaranteeLock.
        // If insertion fails, attempt refund (similar to TransferService).
        var (deductSuccess, deductError, _) = await _walletService.DeductBalanceAsync(
            userId,
            amount,
            "Jaminan profil (lock)",
            TransactionType.GuaranteeLock,
            guarantee.Id,
            "guarantee"
        );

        if (!deductSuccess)
        {
            throw new InvalidOperationException(deductError ?? "Gagal memproses jaminan");
        }

        try
        {
            await _context.GuaranteeLocks.InsertOneAsync(guarantee);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            _logger.LogWarning(ex, "Duplicate active guarantee detected for user {UserId} after deduction; attempting refund. GuaranteeId: {GuaranteeId}", userId, guarantee.Id);
            await BestEffortRefundAsync(userId, amount, guarantee.Id);
            throw new InvalidOperationException("Anda sudah memiliki jaminan aktif. Lepaskan terlebih dahulu.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to insert guarantee lock {GuaranteeId} after deduction; attempting refund. UserId: {UserId}", guarantee.Id, userId);
            await BestEffortRefundAsync(userId, amount, guarantee.Id);
            throw;
        }

        await BestEffortSyncGuaranteeAmountAsync(userId, amount);

        return guarantee;
    }

    public async Task<GuaranteeLock> ReleaseGuaranteeAsync(uint userId, string pin)
    {
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
        {
            throw new UnauthorizedAccessException(pinResult.Message);
        }

        var active = await GetActiveGuaranteeAsync(userId);
        if (active == null)
        {
            throw new InvalidOperationException("Tidak ada jaminan aktif");
        }

        await EnsureNoActiveValidationCaseLockAsync(userId);

        var now = DateTime.UtcNow;

        // Update status first to prevent double-credit (server-side), then refund wallet.
        var updateFilter = Builders<GuaranteeLock>.Filter.And(
            Builders<GuaranteeLock>.Filter.Eq(g => g.Id, active.Id),
            Builders<GuaranteeLock>.Filter.Eq(g => g.Status, GuaranteeStatus.Active));

        var statusUpdate = Builders<GuaranteeLock>.Update
            .Set(g => g.Status, GuaranteeStatus.Released)
            .Set(g => g.ReleasedAt, now)
            .Set(g => g.UpdatedAt, now);

        var updateResult = await _context.GuaranteeLocks.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
        {
            throw new InvalidOperationException("Jaminan sudah diproses oleh request lain");
        }

        try
        {
            _ = await _walletService.AddBalanceAsync(
                userId,
                active.Amount,
                "Jaminan profil (release)",
                TransactionType.GuaranteeRelease,
                active.Id,
                "guarantee"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund wallet for released guarantee {GuaranteeId}. Attempting status rollback. UserId: {UserId}", active.Id, userId);

            try
            {
                var rollback = Builders<GuaranteeLock>.Update
                    .Set(g => g.Status, GuaranteeStatus.Active)
                    .Unset(g => g.ReleasedAt)
                    .Set(g => g.UpdatedAt, DateTime.UtcNow);

                await _context.GuaranteeLocks.UpdateOneAsync(
                    Builders<GuaranteeLock>.Filter.And(
                        Builders<GuaranteeLock>.Filter.Eq(g => g.Id, active.Id),
                        Builders<GuaranteeLock>.Filter.Eq(g => g.Status, GuaranteeStatus.Released)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback guarantee status after refund failure. GuaranteeId: {GuaranteeId}, UserId: {UserId}",
                    active.Id,
                    userId);
            }

            throw new InvalidOperationException("Gagal melepaskan jaminan. Silakan coba lagi atau hubungi support.");
        }

        await BestEffortSyncGuaranteeAmountAsync(userId, 0);

        active.Status = GuaranteeStatus.Released;
        active.ReleasedAt = now;
        active.UpdatedAt = now;
        return active;
    }

    public async Task SyncGuaranteeAmountAsync(uint userId, long amount)
    {
        await BestEffortSyncGuaranteeAmountAsync(userId, amount);
    }

    private async Task BestEffortRefundAsync(uint userId, long amount, string referenceId)
    {
        try
        {
            _ = await _walletService.AddBalanceAsync(
                userId,
                amount,
                "Refund: gagal mengunci jaminan profil",
                TransactionType.Refund,
                referenceId,
                "guarantee"
            );
        }
        catch (Exception refundEx)
        {
            _logger.LogCritical(
                refundEx,
                "CRITICAL: Failed to refund after guarantee set failure. ReferenceId: {ReferenceId}, UserId: {UserId}, Amount: {Amount}",
                referenceId,
                userId,
                amount);
        }
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
                Encoding.UTF8,
                "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Failed to sync guarantee amount to Go backend. Status: {StatusCode}. Body: {Body}. UserId: {UserId}",
                    (int)response.StatusCode,
                    body,
                    userId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error syncing guarantee amount to Go backend for user {UserId}", userId);
        }
    }
}
