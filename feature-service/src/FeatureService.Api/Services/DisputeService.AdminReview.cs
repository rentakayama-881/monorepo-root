using MongoDB.Driver;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using System.Text;
using System.Text.Json;

namespace FeatureService.Api.Services;

public partial class DisputeService
{
    public async Task<(bool success, string? error)> MutualRefundAsync(string disputeId, uint userId)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Only RECEIVER (penerima/penjual, the one with escrowed funds) can agree to refund
        // Use ReceiverId from the dispute, NOT RespondentId
        if (dispute.ReceiverId != userId)
            return (false, "Hanya penerima yang dapat menyetujui refund");

        if (dispute.Status != DisputeStatus.Open)
            return (false, "Dispute sudah ditutup");

        // Get transfer
        var transfer = await _transfers.Find(t => t.Id == dispute.TransferId).FirstOrDefaultAsync();
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Safety: do not allow refund if funds were already released previously.
        if (transfer.ReleasedAt.HasValue || transfer.Status == TransferStatus.Released)
            return (false, "Transfer sudah direlease; refund mutual memerlukan proses clawback (hubungi admin)");

        if (transfer.Status != TransferStatus.Disputed)
            return (false, "Transfer tidak dalam status Disputed");

        // Update transfer status first to enforce exactly-once refund
        var now = DateTime.UtcNow;
        var transferUpdateFilter = Builders<Transfer>.Filter.And(
            Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
            Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Disputed));

        var transferUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Cancelled)
            .Set(t => t.CancelReason, "Mutual refund dari dispute")
            .Set(t => t.CancelledAt, now)
            .Set(t => t.UpdatedAt, now);

        var transferUpdateResult = await _transfers.UpdateOneAsync(transferUpdateFilter, transferUpdate);
        if (transferUpdateResult.ModifiedCount == 0)
            return (false, "Transfer sudah diproses oleh request lain");

        // Refund to sender
        try
        {
            _ = await _walletService.AddBalanceAsync(
                transfer.SenderId,
                transfer.Amount,
                $"Refund mutual dari dispute #{disputeId.Substring(0, 8)}",
                TransactionType.Refund,
                transfer.Id,
                "dispute"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund sender for mutual refund dispute {DisputeId}. Attempting transfer status rollback.", disputeId);

            try
            {
                var rollback = Builders<Transfer>.Update
                    .Set(t => t.Status, TransferStatus.Disputed)
                    .Unset(t => t.CancelledAt)
                    .Unset(t => t.CancelReason)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);

                await _transfers.UpdateOneAsync(
                    Builders<Transfer>.Filter.And(
                        Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
                        Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Cancelled)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after mutual refund failure. TransferId: {TransferId}",
                    transfer.Id);
            }

            return (false, "Gagal mengembalikan dana. Silakan coba lagi atau hubungi support.");
        }

        // Resolve dispute
        var resolution = new DisputeResolution
        {
            Type = ResolutionType.FullRefundToSender,
            RefundToSender = transfer.Amount,
            ReleaseToReceiver = 0,
            Note = "Kedua pihak setuju untuk refund"
        };

        var disputeUpdateFilter = Builders<Dispute>.Filter.And(
            Builders<Dispute>.Filter.Eq(d => d.Id, disputeId),
            Builders<Dispute>.Filter.Nin(
                d => d.Status,
                new[] { DisputeStatus.Resolved, DisputeStatus.Cancelled }));

        var disputeUpdate = Builders<Dispute>.Update
            .Set(d => d.Status, DisputeStatus.Resolved)
            .Set(d => d.Resolution, resolution)
            .Set(d => d.ResolvedAt, now)
            .Set(d => d.UpdatedAt, now);

        var disputeUpdateResult = await _disputes.UpdateOneAsync(disputeUpdateFilter, disputeUpdate);
        if (disputeUpdateResult.ModifiedCount == 0)
        {
            _logger.LogCritical(
                "CRITICAL: Mutual refund transfer settled but dispute state could not be resolved. DisputeId: {DisputeId}",
                disputeId);
            return (false, "Transfer sudah diproses, namun status dispute gagal diperbarui. Hubungi admin/support.");
        }

        _logger.LogInformation("Mutual refund completed for dispute {DisputeId} by user {UserId}", disputeId, userId);
        await BestEffortNotifyGoBackendDisputeSettledAsync(
            transfer.Id,
            disputeId,
            DisputeSettlementOutcomeOwnerRefund,
            "mutual_refund");
        return (true, null);
    }

    private string GetGoBackendBaseUrl()
    {
        return (_configuration["Backend:ApiUrl"]
                ?? _configuration["GoBackend:BaseUrl"]
                ?? "http://127.0.0.1:8080").TrimEnd('/');
    }

    private async Task BestEffortNotifyGoBackendDisputeSettledAsync(
        string transferId,
        string disputeId,
        string outcome,
        string source)
    {
        var baseUrl = GetGoBackendBaseUrl();
        var internalKey = _configuration["GoBackend:InternalApiKey"];
        if (string.IsNullOrWhiteSpace(internalKey))
        {
            _logger.LogWarning(
                "GoBackend:InternalApiKey is not configured; skipping validation-case dispute callback. TransferId: {TransferId}, DisputeId: {DisputeId}",
                transferId,
                disputeId);
            return;
        }

        try
        {
            var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{baseUrl}/api/internal/validation-cases/disputes/settled");

            request.Headers.Add("X-Internal-Api-Key", internalKey);
            request.Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    transfer_id = transferId,
                    dispute_id = disputeId,
                    outcome,
                    source
                }),
                Encoding.UTF8,
                "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Go backend dispute-settlement callback failed. Status: {StatusCode}. Body: {Body}. TransferId: {TransferId}, DisputeId: {DisputeId}, Outcome: {Outcome}",
                    (int)response.StatusCode,
                    body,
                    transferId,
                    disputeId,
                    outcome);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Error calling Go backend dispute-settlement callback. TransferId: {TransferId}, DisputeId: {DisputeId}, Outcome: {Outcome}",
                transferId,
                disputeId,
                outcome);
        }
    }

    private async Task TryRollbackTransferToPendingAsync(string transferId)
    {
        var rollback = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Pending)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);

        await _transfers.UpdateOneAsync(
            Builders<Transfer>.Filter.And(
                Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Disputed)),
            rollback);
    }

    private async Task TryRollbackTransferToDisputedAsync(string transferId)
    {
        var rollback = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Disputed)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);

        await _transfers.UpdateOneAsync(
            Builders<Transfer>.Filter.And(
                Builders<Transfer>.Filter.Eq(t => t.Id, transferId),
                Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Pending)),
            rollback);
    }

    private async Task<string> BuildTransferDisputeConflictMessageAsync(string transferId)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();
        if (transfer == null)
            return "Transfer tidak ditemukan";

        return transfer.Status switch
        {
            TransferStatus.Released or TransferStatus.Expired => "Transfer sudah direlease",
            TransferStatus.Cancelled => "Transfer sudah dibatalkan",
            TransferStatus.Rejected => "Transfer sudah ditolak",
            TransferStatus.Pending => "Transfer tidak lagi dalam status dispute",
            TransferStatus.Disputed => "Transfer sudah diproses oleh request lain",
            _ => "Transfer sudah diproses oleh request lain"
        };
    }

    private async Task<string> BuildDisputeConflictMessageAsync(string disputeId)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return "Dispute tidak ditemukan";

        return dispute.Status switch
        {
            DisputeStatus.Resolved => "Dispute sudah resolved",
            DisputeStatus.Cancelled => "Dispute sudah dibatalkan",
            _ => "Dispute sudah diproses oleh request lain"
        };
    }
}
