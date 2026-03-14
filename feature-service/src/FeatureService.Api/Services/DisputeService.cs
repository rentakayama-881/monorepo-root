using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using System.Text;
using System.Text.Json;

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

public partial class DisputeService : IDisputeService
{
    private const string DisputeSettlementOutcomeOwnerRefund = "owner_refund";
    private const string DisputeSettlementOutcomeValidatorRelease = "validator_release";

    private readonly IMongoCollection<Dispute> _disputes;
    private readonly IMongoCollection<Transfer> _transfers;
    private readonly IWalletService _walletService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DisputeService> _logger;

    public DisputeService(
        MongoDbContext dbContext,
        IWalletService walletService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<DisputeService> logger)
    {
        _disputes = dbContext.GetCollection<Dispute>("disputes");
        _transfers = dbContext.GetCollection<Transfer>("transfers");
        _walletService = walletService;
        _httpClient = httpClient;
        _configuration = configuration;
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
}
