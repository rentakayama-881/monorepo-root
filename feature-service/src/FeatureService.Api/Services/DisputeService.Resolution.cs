using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using System.Text;
using System.Text.Json;

namespace FeatureService.Api.Services;

public partial class DisputeService
{
    public async Task<(bool success, string? error)> ResolveDisputeAsync(
        string disputeId, uint adminId, string adminUsername, ResolveDisputeRequest request)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        if (dispute.Status == DisputeStatus.Resolved)
            return (false, "Dispute sudah resolved");

        if (dispute.Status == DisputeStatus.Cancelled)
            return (false, "Dispute sudah dibatalkan");

        // Get the transfer for fund operations
        var transfer = await _transfers.Find(t => t.Id == dispute.TransferId).FirstOrDefaultAsync();
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");

        // Safety: do not resolve disputes for transfers that were already released previously.
        // That would require clawback / negative-balance handling (not implemented here).
        if (transfer.ReleasedAt.HasValue || transfer.Status == TransferStatus.Released)
            return (false, "Transfer sudah direlease; penyelesaian dispute memerlukan proses clawback (hubungi admin)");

        if (transfer.Status != TransferStatus.Disputed)
            return (false, "Transfer tidak dalam status Disputed");

        // Calculate resolution amounts
        long refundToSender = 0;
        long releaseToReceiver = 0;

        switch (request.Type)
        {
            case ResolutionType.FullRefundToSender:
                refundToSender = dispute.Amount;
                break;

            case ResolutionType.FullReleaseToReceiver:
                // Apply 2% fee
                var fee = (long)(dispute.Amount * 0.02m);
                releaseToReceiver = dispute.Amount - fee;
                break;

            case ResolutionType.Split:
                var senderPercent = request.SenderPercent ?? 50;
                senderPercent = Math.Clamp(senderPercent, 0, 100);
                refundToSender = dispute.Amount * senderPercent / 100;
                var receiverAmount = dispute.Amount - refundToSender;
                // Apply 2% fee on receiver's portion
                var receiverFee = (long)(receiverAmount * 0.02m);
                releaseToReceiver = receiverAmount - receiverFee;
                break;

            case ResolutionType.NoAction:
                // No funds moved
                break;
        }

        var now = DateTime.UtcNow;

        // Update transfer status first to ensure exactly-once settlement
        var transferFilter = Builders<Transfer>.Filter.And(
            Builders<Transfer>.Filter.Eq(t => t.Id, transfer.Id),
            Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Disputed));

        UpdateDefinition<Transfer> transferUpdate;
        if (refundToSender > 0 && releaseToReceiver == 0)
        {
            transferUpdate = Builders<Transfer>.Update
                .Set(t => t.Status, TransferStatus.Cancelled)
                .Set(t => t.CancelReason, "Dispute resolved: refund to sender")
                .Set(t => t.CancelledAt, now)
                .Set(t => t.UpdatedAt, now);
        }
        else if (releaseToReceiver > 0)
        {
            transferUpdate = Builders<Transfer>.Update
                .Set(t => t.Status, TransferStatus.Released)
                .Set(t => t.ReleasedAt, now)
                .Set(t => t.UpdatedAt, now);
        }
        else
        {
            // NoAction: restore to pending, normal hold rules apply
            transferUpdate = Builders<Transfer>.Update
                .Set(t => t.Status, TransferStatus.Pending)
                .Set(t => t.UpdatedAt, now);
        }

        var transferUpdateResult = await _transfers.UpdateOneAsync(transferFilter, transferUpdate);
        if (transferUpdateResult.ModifiedCount == 0)
            return (false, "Transfer sudah diproses oleh request lain");

        // Execute fund transfers
        var senderCredited = false;
        var receiverCredited = false;
        if (refundToSender > 0)
        {
            try
            {
                _ = await _walletService.AddBalanceAsync(
                    transfer.SenderId,
                    refundToSender,
                    $"Refund dari dispute #{disputeId[^6..]}",
                    TransactionType.Refund,
                    disputeId,
                    "dispute"
                );
                senderCredited = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to credit sender for dispute resolution {DisputeId}", disputeId);
                return (false, "Gagal memproses refund. Hubungi admin/support.");
            }
        }

        if (releaseToReceiver > 0)
        {
            try
            {
                _ = await _walletService.AddBalanceAsync(
                    transfer.ReceiverId,
                    releaseToReceiver,
                    $"Pelepasan dari dispute #{disputeId[^6..]}",
                    TransactionType.EscrowRelease,
                    disputeId,
                    "dispute"
                );
                receiverCredited = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to credit receiver for dispute resolution {DisputeId}", disputeId);

                // Partial settlement is critical and requires manual reconciliation.
                if (senderCredited)
                {
                    _logger.LogCritical(
                        "CRITICAL: Partial dispute settlement. DisputeId: {DisputeId}, SenderCredited: {SenderCredited}, ReceiverCredited: {ReceiverCredited}",
                        disputeId,
                        senderCredited,
                        receiverCredited);
                }

                return (false, "Gagal memproses pelepasan dana. Hubungi admin/support.");
            }
        }

        var resolution = new DisputeResolution
        {
            Type = request.Type,
            RefundToSender = refundToSender,
            ReleaseToReceiver = releaseToReceiver,
            Note = request.Note
        };

        var update = Builders<Dispute>.Update
            .Set(d => d.Status, DisputeStatus.Resolved)
            .Set(d => d.Resolution, resolution)
            .Set(d => d.ResolvedById, adminId)
            .Set(d => d.ResolvedByUsername, adminUsername)
            .Set(d => d.ResolvedAt, now)
            .Set(d => d.UpdatedAt, now);

        await _disputes.UpdateOneAsync(d => d.Id == disputeId, update);

        _logger.LogInformation(
            "Dispute resolved: {DisputeId} by admin {AdminId}, type: {Type}, sender: {RefundToSender}, receiver: {ReleaseToReceiver}",
            disputeId, adminId, request.Type, refundToSender, releaseToReceiver
        );

        var settlementSource = request.Type switch
        {
            ResolutionType.FullRefundToSender => "admin_refund",
            ResolutionType.FullReleaseToReceiver => "admin_force_release",
            _ => null
        };
        var settlementOutcome = request.Type switch
        {
            ResolutionType.FullRefundToSender => DisputeSettlementOutcomeOwnerRefund,
            ResolutionType.FullReleaseToReceiver => DisputeSettlementOutcomeValidatorRelease,
            _ => null
        };
        if (!string.IsNullOrWhiteSpace(settlementSource) && !string.IsNullOrWhiteSpace(settlementOutcome))
        {
            await BestEffortNotifyGoBackendDisputeSettledAsync(
                transfer.Id,
                disputeId,
                settlementOutcome,
                settlementSource);
        }

        return (true, null);
    }

    public async Task<(bool success, string? error)> UpdateStatusAsync(
        string disputeId, uint adminId, DisputeStatus newStatus)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Can't change status of resolved/cancelled disputes
        if (dispute.Status == DisputeStatus.Resolved || dispute.Status == DisputeStatus.Cancelled)
            return (false, "Dispute sudah ditutup");

        var update = Builders<Dispute>.Update
            .Set(d => d.Status, newStatus)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _disputes.UpdateOneAsync(d => d.Id == disputeId, update);

        return (true, null);
    }

    public async Task<(bool success, string? error)> ContinueTransactionAsync(
        string disputeId, uint adminId, string adminUsername, string? note)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        if (dispute.Status == DisputeStatus.Resolved)
            return (false, "Dispute sudah resolved");

        if (dispute.Status == DisputeStatus.Cancelled)
            return (false, "Dispute sudah dibatalkan");

        // Get the transfer
        var transfer = await _transfers.Find(t => t.Id == dispute.TransferId).FirstOrDefaultAsync();
        if (transfer == null)
            return (false, "Transfer tidak ditemukan");
        if (transfer.Status != TransferStatus.Disputed)
            return (false, "Transfer tidak dalam status Disputed");

        // Add admin message about continuation
        var now = DateTime.UtcNow;
        var message = new DisputeMessage
        {
            SenderId = adminId,
            SenderUsername = adminUsername,
            IsAdmin = true,
            Content = $"[KEPUTUSAN ADMIN] Transaksi dilanjutkan. {note ?? "Dispute ditutup, transaksi mengikuti hold time normal."}",
            SentAt = now
        };

        // Create resolution with NoAction (funds not moved yet, will follow hold time)
        var resolution = new DisputeResolution
        {
            Type = ResolutionType.NoAction,
            RefundToSender = 0,
            ReleaseToReceiver = 0,
            Note = note ?? "Transaksi dilanjutkan sesuai hold time normal"
        };

        var disputeUpdateFilter = Builders<Dispute>.Filter.And(
            Builders<Dispute>.Filter.Eq(d => d.Id, disputeId),
            Builders<Dispute>.Filter.Eq(d => d.Status, dispute.Status));
        var disputeUpdate = Builders<Dispute>.Update
            .Set(d => d.Status, DisputeStatus.Resolved)
            .Set(d => d.Resolution, resolution)
            .Set(d => d.ResolvedById, adminId)
            .Set(d => d.ResolvedByUsername, adminUsername)
            .Set(d => d.ResolvedAt, now)
            .Set(d => d.UpdatedAt, now)
            .Push(d => d.Messages, message);

        // Restore transfer to Pending status (will follow hold time), CAS-protected.
        var transferUpdateFilter = Builders<Transfer>.Filter.And(
            Builders<Transfer>.Filter.Eq(t => t.Id, dispute.TransferId),
            Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Disputed));
        var transferUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Pending)
            .Unset(t => t.CancelledAt)
            .Unset(t => t.CancelReason)
            .Set(t => t.UpdatedAt, now);
        var transferUpdateResult = await _transfers.UpdateOneAsync(transferUpdateFilter, transferUpdate);
        if (transferUpdateResult.ModifiedCount == 0)
            return (false, await BuildTransferDisputeConflictMessageAsync(dispute.TransferId));

        var disputeUpdateResult = await _disputes.UpdateOneAsync(disputeUpdateFilter, disputeUpdate);
        if (disputeUpdateResult.ModifiedCount == 0)
        {
            await TryRollbackTransferToDisputedAsync(dispute.TransferId);
            return (false, await BuildDisputeConflictMessageAsync(disputeId));
        }

        _logger.LogInformation(
            "Dispute continued: {DisputeId} by admin {AdminId}, transfer restored to Pending",
            disputeId, adminId
        );

        return (true, null);
    }

}
