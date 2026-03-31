using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using System.Text;
using System.Text.Json;

namespace FeatureService.Api.Services;

public partial class DisputeService
{
    public async Task<(bool success, string? error)> MutualRefundAsync(string disputeId, uint userId)
    {
        var dispute = await _db.Disputes.AsNoTracking().FirstOrDefaultAsync(d => d.Id == disputeId);
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Only RECEIVER (penerima/penjual, the one with escrowed funds) can agree to refund
        // Use ReceiverId from the dispute, NOT RespondentId
        if (dispute.ReceiverId != userId)
            return (false, "Hanya penerima yang dapat menyetujui refund");

        if (dispute.Status != DisputeStatus.Open)
            return (false, "Dispute sudah ditutup");

        // Get transfer
        var transfer = await _db.Transfers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == dispute.TransferId);
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Safety: do not allow refund if funds were already released previously.
        if (transfer.ReleasedAt.HasValue || transfer.Status == TransferStatus.Released)
            return (false, "Transfer sudah direlease; refund mutual memerlukan proses clawback (hubungi admin)");

        if (transfer.Status != TransferStatus.Disputed)
            return (false, "Transfer tidak dalam status Disputed");

        // Update transfer status first to enforce exactly-once refund
        var now = DateTime.UtcNow;
        var transferUpdated = await _db.Transfers
            .Where(t => t.Id == transfer.Id && t.Status == TransferStatus.Disputed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Cancelled)
                .SetProperty(t => t.CancelReason, "Mutual refund dari dispute")
                .SetProperty(t => t.CancelledAt, now)
                .SetProperty(t => t.UpdatedAt, now));

        if (transferUpdated == 0)
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
                await _db.Transfers
                    .Where(t => t.Id == transfer.Id && t.Status == TransferStatus.Cancelled)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(t => t.Status, TransferStatus.Disputed)
                        .SetProperty(t => t.CancelledAt, (DateTime?)null)
                        .SetProperty(t => t.CancelReason, (string?)null)
                        .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
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

        var disputeUpdated = await _db.Disputes
            .Where(d => d.Id == disputeId
                && d.Status != DisputeStatus.Resolved
                && d.Status != DisputeStatus.Cancelled)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.Status, DisputeStatus.Resolved)
                .SetProperty(d => d.Resolution, resolution)
                .SetProperty(d => d.ResolvedAt, now)
                .SetProperty(d => d.UpdatedAt, now));

        if (disputeUpdated == 0)
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
                $"{baseUrl}/api/v1/internal/validation-cases/disputes/settled");

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
        await _db.Transfers
            .Where(t => t.Id == transferId && t.Status == TransferStatus.Disputed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Pending)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
    }

    private async Task TryRollbackTransferToDisputedAsync(string transferId)
    {
        await _db.Transfers
            .Where(t => t.Id == transferId && t.Status == TransferStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Disputed)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
    }

    private async Task<string> BuildTransferDisputeConflictMessageAsync(string transferId)
    {
        var transfer = await _db.Transfers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == transferId);
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
        var dispute = await _db.Disputes.AsNoTracking().FirstOrDefaultAsync(d => d.Id == disputeId);
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
