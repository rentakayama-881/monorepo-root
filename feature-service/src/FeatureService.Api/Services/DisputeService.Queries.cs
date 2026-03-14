using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using System.Text;
using System.Text.Json;

namespace FeatureService.Api.Services;

public partial class DisputeService
{
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

    public async Task<DisputeDto?> GetDisputeForAdminAsync(string disputeId)
    {
        var dispute = await _disputes.Find(d => d.Id == disputeId).FirstOrDefaultAsync();
        if (dispute == null)
            return null;

        return MapToDto(dispute);
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
