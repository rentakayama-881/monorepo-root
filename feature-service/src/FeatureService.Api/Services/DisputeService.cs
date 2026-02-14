using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IDisputeService
{
    Task<CreateDisputeResponse> CreateDisputeAsync(uint userId, CreateDisputeRequest request);
    Task<DisputeDto?> GetDisputeAsync(string disputeId, uint userId);
    Task<DisputeDto?> GetDisputeForAdminAsync(string disputeId);
    Task<List<DisputeSummaryDto>> GetUserDisputesAsync(uint userId, DisputeStatus? status = null);
    Task<(bool success, string? error)> AddMessageAsync(string disputeId, uint userId, string username, string content, bool isAdmin = false);
    Task<(bool success, string? error)> AddEvidenceAsync(string disputeId, uint userId, AddDisputeEvidenceRequest evidence);
    Task<(bool success, string? error)> CancelDisputeAsync(string disputeId, uint userId);
    
    // Mutual agreement - refund only (release requires admin approval)
    Task<(bool success, string? error)> MutualRefundAsync(string disputeId, uint userId);
    
    // Admin functions
    Task<List<DisputeSummaryDto>> GetAllDisputesAsync(DisputeStatus? status = null, int limit = 50);
    Task<(bool success, string? error)> ResolveDisputeAsync(string disputeId, uint adminId, string adminUsername, ResolveDisputeRequest request);
    Task<(bool success, string? error)> UpdateStatusAsync(string disputeId, uint adminId, DisputeStatus newStatus);
    Task<(bool success, string? error)> ContinueTransactionAsync(string disputeId, uint adminId, string adminUsername, string? note);
}

public class DisputeService : IDisputeService
{
    private readonly IMongoCollection<Dispute> _disputes;
    private readonly IMongoCollection<Transfer> _transfers;
    private readonly IWalletService _walletService;
    private readonly ILogger<DisputeService> _logger;

    public DisputeService(
        MongoDbContext dbContext,
        IWalletService walletService,
        ILogger<DisputeService> logger)
    {
        _disputes = dbContext.GetCollection<Dispute>("disputes");
        _transfers = dbContext.GetCollection<Transfer>("transfers");
        _walletService = walletService;
        _logger = logger;
    }

    public async Task<CreateDisputeResponse> CreateDisputeAsync(uint userId, CreateDisputeRequest request)
    {
        // Get the transfer
        var transfer = await _transfers.Find(t => t.Id == request.TransferId).FirstOrDefaultAsync();
        if (transfer == null)
            return new CreateDisputeResponse(false, null, "Transfer tidak ditemukan");

        // ONLY SENDER (pembeli/pembayar) can open dispute
        // Receiver cannot open dispute - they should defend themselves if sender opens one
        if (transfer.SenderId != userId)
            return new CreateDisputeResponse(false, null, "Hanya pengirim dana yang dapat membuka mediasi");

        // Only allow disputes while funds are still in escrow (Pending).
        // Allowing disputes after release would require clawback logic (not implemented here).
        if (transfer.Status != TransferStatus.Pending)
            return new CreateDisputeResponse(false, null, "Dispute hanya bisa dibuat untuk transfer yang masih pending");

        // Check if dispute already exists
        var existingDispute = await _disputes.Find(d => d.TransferId == request.TransferId).FirstOrDefaultAsync();
        if (existingDispute != null)
            return new CreateDisputeResponse(false, null, "Dispute sudah ada untuk transfer ini");

        // Update transfer status to Disputed first (acts as a concurrency lock)
        var now = DateTime.UtcNow;
        var transferUpdateFilter = Builders<Transfer>.Filter.And(
            Builders<Transfer>.Filter.Eq(t => t.Id, request.TransferId),
            Builders<Transfer>.Filter.Eq(t => t.Status, TransferStatus.Pending));

        var transferUpdate = Builders<Transfer>.Update
            .Set(t => t.Status, TransferStatus.Disputed)
            .Set(t => t.UpdatedAt, now);

        var transferUpdateResult = await _transfers.UpdateOneAsync(transferUpdateFilter, transferUpdate);
        if (transferUpdateResult.ModifiedCount == 0)
            return new CreateDisputeResponse(false, null, "Transfer sudah diproses oleh request lain");

        // Sender is always initiator, receiver is always respondent
        var initiatorId = transfer.SenderId;
        var initiatorUsername = transfer.SenderUsername;
        var respondentId = transfer.ReceiverId;
        var respondentUsername = transfer.ReceiverUsername;

        var dispute = new Dispute
        {
            TransferId = request.TransferId,
            InitiatorId = initiatorId,
            InitiatorUsername = initiatorUsername,
            RespondentId = respondentId,
            RespondentUsername = respondentUsername,
            // Always store original transfer sender/receiver
            SenderId = transfer.SenderId,
            SenderUsername = transfer.SenderUsername,
            ReceiverId = transfer.ReceiverId,
            ReceiverUsername = transfer.ReceiverUsername,
            Reason = request.Reason,
            Category = request.Category,
            Status = DisputeStatus.Open,
            Amount = transfer.Amount,
            Evidence = new List<DisputeEvidence>(),
            Messages = new List<DisputeMessage>(),
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            await _disputes.InsertOneAsync(dispute);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            _logger.LogWarning(
                ex,
                "Duplicate dispute insert detected for transfer {TransferId}. Returning existing dispute.",
                request.TransferId);

            var existing = await _disputes.Find(d => d.TransferId == request.TransferId).FirstOrDefaultAsync();
            if (existing != null)
                return new CreateDisputeResponse(true, existing.Id, null);

            await TryRollbackTransferToPendingAsync(request.TransferId);
            return new CreateDisputeResponse(false, null, "Dispute sudah ada untuk transfer ini");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to insert dispute for transfer {TransferId}. Attempting transfer status rollback.", request.TransferId);

            var existing = await _disputes.Find(d => d.TransferId == request.TransferId).FirstOrDefaultAsync();
            if (existing != null)
            {
                _logger.LogWarning(
                    "Dispute {DisputeId} already exists after insert failure for transfer {TransferId}. Skip transfer rollback.",
                    existing.Id,
                    request.TransferId);
                return new CreateDisputeResponse(true, existing.Id, null);
            }

            try
            {
                await TryRollbackTransferToPendingAsync(request.TransferId);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback transfer status after dispute insert failure. TransferId: {TransferId}",
                    request.TransferId);
            }

            throw;
        }

        _logger.LogInformation(
            "Dispute created: {DisputeId} for transfer {TransferId} by user {UserId}",
            dispute.Id, request.TransferId, userId
        );

        return new CreateDisputeResponse(true, dispute.Id, null);
    }

    public async Task<DisputeDto?> GetDisputeAsync(string disputeId, uint userId)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return null;

        // Check access - only parties or admins can view
        // For now allow parties only, admin check done in controller
        if (dispute.InitiatorId != userId && dispute.RespondentId != userId)
            return null;

        return MapToDto(dispute);
    }

    public async Task<List<DisputeSummaryDto>> GetUserDisputesAsync(uint userId, DisputeStatus? status = null)
    {
        var filter = Builders<Dispute>.Filter.Or(
            Builders<Dispute>.Filter.Eq(d => d.InitiatorId, userId),
            Builders<Dispute>.Filter.Eq(d => d.RespondentId, userId)
        );

        if (status.HasValue)
        {
            filter = Builders<Dispute>.Filter.And(
                filter,
                Builders<Dispute>.Filter.Eq(d => d.Status, status.Value)
            );
        }

        var disputes = await _disputes
            .Find(filter)
            .SortByDescending(d => d.CreatedAt)
            .Limit(100)
            .ToListAsync();

        return disputes.Select(MapToSummary).ToList();
    }

    public async Task<(bool success, string? error)> AddMessageAsync(
        string disputeId, uint userId, string username, string content, bool isAdmin = false)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Check access
        if (!isAdmin && dispute.InitiatorId != userId && dispute.RespondentId != userId)
            return (false, "Anda tidak memiliki akses ke dispute ini");

        // Can't add message to resolved/cancelled disputes
        if (dispute.Status == DisputeStatus.Resolved || dispute.Status == DisputeStatus.Cancelled)
            return (false, "Dispute sudah ditutup");

        var message = new DisputeMessage
        {
            SenderId = userId,
            SenderUsername = username,
            IsAdmin = isAdmin,
            Content = content,
            SentAt = DateTime.UtcNow
        };

        var update = Builders<Dispute>.Update
            .Push(d => d.Messages, message)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        var updateFilter = Builders<Dispute>.Filter.And(
            Builders<Dispute>.Filter.Eq(d => d.Id, disputeId),
            Builders<Dispute>.Filter.Nin(
                d => d.Status,
                new[] { DisputeStatus.Resolved, DisputeStatus.Cancelled }));
        var updateResult = await _disputes.UpdateOneAsync(updateFilter, update);
        if (updateResult.ModifiedCount == 0)
            return (false, "Dispute sudah ditutup");

        return (true, null);
    }

    public async Task<(bool success, string? error)> AddEvidenceAsync(
        string disputeId, uint userId, AddDisputeEvidenceRequest evidence)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Check access
        if (dispute.InitiatorId != userId && dispute.RespondentId != userId)
            return (false, "Anda tidak memiliki akses ke dispute ini");

        // Can't add evidence to resolved/cancelled disputes
        if (dispute.Status == DisputeStatus.Resolved || dispute.Status == DisputeStatus.Cancelled)
            return (false, "Dispute sudah ditutup");

        // Limit evidence count
        if (dispute.Evidence.Count >= 10)
            return (false, "Maksimal 10 bukti per dispute");

        var evidenceDoc = new DisputeEvidence
        {
            Type = evidence.Type,
            Url = evidence.Url,
            Description = evidence.Description,
            UploadedAt = DateTime.UtcNow,
            UploadedById = userId
        };

        var update = Builders<Dispute>.Update
            .Push(d => d.Evidence, evidenceDoc)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        var updateFilter = Builders<Dispute>.Filter.And(
            Builders<Dispute>.Filter.Eq(d => d.Id, disputeId),
            Builders<Dispute>.Filter.Nin(
                d => d.Status,
                new[] { DisputeStatus.Resolved, DisputeStatus.Cancelled }));
        var updateResult = await _disputes.UpdateOneAsync(updateFilter, update);
        if (updateResult.ModifiedCount == 0)
            return (false, "Dispute sudah ditutup");

        return (true, null);
    }

    public async Task<(bool success, string? error)> CancelDisputeAsync(string disputeId, uint userId)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Only initiator can cancel
        if (dispute.InitiatorId != userId)
            return (false, "Hanya pembuat dispute yang bisa membatalkan");

        // Can only cancel open disputes
        if (dispute.Status != DisputeStatus.Open)
            return (false, "Dispute tidak bisa dibatalkan dalam status ini");

        var now = DateTime.UtcNow;

        // Restore transfer to Pending first using CAS to avoid overriding
        // another request that already moved the transfer out of disputed state.
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

        var disputeUpdateFilter = Builders<Dispute>.Filter.And(
            Builders<Dispute>.Filter.Eq(d => d.Id, disputeId),
            Builders<Dispute>.Filter.Eq(d => d.InitiatorId, userId),
            Builders<Dispute>.Filter.Eq(d => d.Status, DisputeStatus.Open));
        var disputeUpdate = Builders<Dispute>.Update
            .Set(d => d.Status, DisputeStatus.Cancelled)
            .Set(d => d.UpdatedAt, now)
            .Set(d => d.ResolvedAt, now);
        var disputeUpdateResult = await _disputes.UpdateOneAsync(disputeUpdateFilter, disputeUpdate);
        if (disputeUpdateResult.ModifiedCount == 0)
        {
            await TryRollbackTransferToDisputedAsync(dispute.TransferId);
            return (false, await BuildDisputeConflictMessageAsync(disputeId));
        }

        _logger.LogInformation("Dispute cancelled: {DisputeId} by user {UserId}", disputeId, userId);

        return (true, null);
    }

    // ==================
    // ADMIN FUNCTIONS
    // ==================

    public async Task<List<DisputeSummaryDto>> GetAllDisputesAsync(DisputeStatus? status = null, int limit = 50)
    {
        var filter = status.HasValue
            ? Builders<Dispute>.Filter.Eq(d => d.Status, status.Value)
            : Builders<Dispute>.Filter.Empty;

        var disputes = await _disputes
            .Find(filter)
            .SortByDescending(d => d.CreatedAt)
            .Limit(limit)
            .ToListAsync();

        return disputes.Select(MapToSummary).ToList();
    }

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

    public async Task<DisputeDto?> GetDisputeForAdminAsync(string disputeId)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return null;

        return MapToDto(dispute);
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
        return (true, null);
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

    // ==================
    // MAPPING HELPERS
    // ==================

    private static DisputeDto MapToDto(Dispute d) => new(
        d.Id,
        d.TransferId,
        d.InitiatorId,
        d.InitiatorUsername,
        d.RespondentId,
        d.RespondentUsername,
        d.SenderId,
        d.SenderUsername,
        d.ReceiverId,
        d.ReceiverUsername,
        d.Reason,
        d.Category.ToString(),
        d.Status.ToString(),
        d.Amount,
        d.Evidence.Select(e => new DisputeEvidenceDto(
            e.Type, e.Url, e.Description, e.UploadedAt, e.UploadedById
        )).ToList(),
        d.Messages.Select(m => new DisputeMessageDto(
            m.Id, m.SenderId, m.SenderUsername, m.IsAdmin, m.Content, m.SentAt
        )).ToList(),
        d.Resolution != null ? new DisputeResolutionDto(
            d.Resolution.Type.ToString(),
            d.Resolution.RefundToSender,
            d.Resolution.ReleaseToReceiver,
            d.Resolution.Note
        ) : null,
        d.CreatedAt,
        d.UpdatedAt,
        d.ResolvedAt
    );

    private static DisputeSummaryDto MapToSummary(Dispute d) => new(
        d.Id,
        d.TransferId,
        d.InitiatorUsername,
        d.RespondentUsername,
        d.Category.ToString(),
        d.Status.ToString(),
        d.Amount,
        d.CreatedAt
    );
}
