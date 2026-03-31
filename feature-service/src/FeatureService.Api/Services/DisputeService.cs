using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
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

    private readonly AppDbContext _db;
    private readonly IWalletService _walletService;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DisputeService> _logger;

    public DisputeService(
        AppDbContext db,
        IWalletService walletService,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<DisputeService> logger)
    {
        _db = db;
        _walletService = walletService;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<CreateDisputeResponse> CreateDisputeAsync(uint userId, CreateDisputeRequest request)
    {
        // Get the transfer
        var transfer = await _db.Transfers.FirstOrDefaultAsync(t => t.Id == request.TransferId);
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
        var existingDispute = await _db.Disputes.FirstOrDefaultAsync(d => d.TransferId == request.TransferId);
        if (existingDispute != null)
            return new CreateDisputeResponse(false, null, "Dispute sudah ada untuk transfer ini");

        // Update transfer status to Disputed first (acts as a concurrency lock)
        var now = DateTime.UtcNow;
        var transferUpdated = await _db.Transfers
            .Where(t => t.Id == request.TransferId && t.Status == TransferStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Disputed)
                .SetProperty(t => t.UpdatedAt, now));

        if (transferUpdated == 0)
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
            _db.Disputes.Add(dispute);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            _db.Entry(dispute).State = EntityState.Detached;

            _logger.LogWarning(
                ex,
                "Duplicate dispute insert detected for transfer {TransferId}. Returning existing dispute.",
                request.TransferId);

            var existing = await _db.Disputes.FirstOrDefaultAsync(d => d.TransferId == request.TransferId);
            if (existing != null)
                return new CreateDisputeResponse(true, existing.Id, null);

            await TryRollbackTransferToPendingAsync(request.TransferId);
            return new CreateDisputeResponse(false, null, "Dispute sudah ada untuk transfer ini");
        }

        _logger.LogInformation(
            "Dispute created: {DisputeId} for transfer {TransferId} by user {UserId}",
            dispute.Id, request.TransferId, userId
        );

        return new CreateDisputeResponse(true, dispute.Id, null);
    }

    public async Task<DisputeDto?> GetDisputeAsync(string disputeId, uint userId)
    {
        var dispute = await _db.Disputes
            .Include(d => d.Evidence)
            .Include(d => d.Messages)
            .FirstOrDefaultAsync(d => d.Id == disputeId);
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
        var query = _db.Disputes
            .Where(d => d.InitiatorId == userId || d.RespondentId == userId);

        if (status.HasValue)
        {
            var statusValue = status.Value;
            query = query.Where(d => d.Status == statusValue);
        }

        var disputes = await query
            .OrderByDescending(d => d.CreatedAt)
            .Take(100)
            .ToListAsync();

        return disputes.Select(MapToSummary).ToList();
    }

    public async Task<(bool success, string? error)> AddMessageAsync(
        string disputeId, uint userId, string username, string content, bool isAdmin = false)
    {
        var dispute = await _db.Disputes.FirstOrDefaultAsync(d => d.Id == disputeId);
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
            Id = Guid.NewGuid().ToString(),
            DisputeId = disputeId,
            SenderId = userId,
            SenderUsername = username,
            IsAdmin = isAdmin,
            Content = content,
            SentAt = DateTime.UtcNow
        };

        _db.DisputeMessages.Add(message);

        // Atomically check status hasn't changed
        var updated = await _db.Disputes
            .Where(d => d.Id == disputeId
                && d.Status != DisputeStatus.Resolved
                && d.Status != DisputeStatus.Cancelled)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.UpdatedAt, DateTime.UtcNow));

        if (updated == 0)
            return (false, "Dispute sudah ditutup");

        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<(bool success, string? error)> AddEvidenceAsync(
        string disputeId, uint userId, AddDisputeEvidenceRequest evidence)
    {
        var dispute = await _db.Disputes.FirstOrDefaultAsync(d => d.Id == disputeId);
        if (dispute == null)
            return (false, "Dispute tidak ditemukan");

        // Check access
        if (dispute.InitiatorId != userId && dispute.RespondentId != userId)
            return (false, "Anda tidak memiliki akses ke dispute ini");

        // Can't add evidence to resolved/cancelled disputes
        if (dispute.Status == DisputeStatus.Resolved || dispute.Status == DisputeStatus.Cancelled)
            return (false, "Dispute sudah ditutup");

        // Limit evidence count
        var evidenceCount = await _db.DisputeEvidence.CountAsync(e => e.DisputeId == disputeId);
        if (evidenceCount >= 10)
            return (false, "Maksimal 10 bukti per dispute");

        var evidenceDoc = new DisputeEvidence
        {
            Id = Guid.NewGuid().ToString(),
            DisputeId = disputeId,
            Type = evidence.Type,
            Url = evidence.Url,
            Description = evidence.Description,
            UploadedAt = DateTime.UtcNow,
            UploadedById = userId
        };

        _db.DisputeEvidence.Add(evidenceDoc);

        // Atomically check status hasn't changed
        var updated = await _db.Disputes
            .Where(d => d.Id == disputeId
                && d.Status != DisputeStatus.Resolved
                && d.Status != DisputeStatus.Cancelled)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.UpdatedAt, DateTime.UtcNow));

        if (updated == 0)
            return (false, "Dispute sudah ditutup");

        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<(bool success, string? error)> CancelDisputeAsync(string disputeId, uint userId)
    {
        var dispute = await _db.Disputes.AsNoTracking().FirstOrDefaultAsync(d => d.Id == disputeId);
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
        var transferUpdated = await _db.Transfers
            .Where(t => t.Id == dispute.TransferId && t.Status == TransferStatus.Disputed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Pending)
                .SetProperty(t => t.CancelledAt, (DateTime?)null)
                .SetProperty(t => t.CancelReason, (string?)null)
                .SetProperty(t => t.UpdatedAt, now));

        if (transferUpdated == 0)
            return (false, await BuildTransferDisputeConflictMessageAsync(dispute.TransferId));

        var disputeUpdated = await _db.Disputes
            .Where(d => d.Id == disputeId
                && d.InitiatorId == userId
                && d.Status == DisputeStatus.Open)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.Status, DisputeStatus.Cancelled)
                .SetProperty(d => d.UpdatedAt, now)
                .SetProperty(d => d.ResolvedAt, now));

        if (disputeUpdated == 0)
        {
            await TryRollbackTransferToDisputedAsync(dispute.TransferId);
            return (false, await BuildDisputeConflictMessageAsync(disputeId));
        }

        _logger.LogInformation("Dispute cancelled: {DisputeId} by user {UserId}", disputeId, userId);

        return (true, null);
    }
}
