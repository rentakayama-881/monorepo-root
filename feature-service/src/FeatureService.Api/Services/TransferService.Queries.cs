using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class TransferService
{
    public async Task<List<TransferDto>> GetTransfersAsync(uint userId, TransferFilter? filter = null)
    {
        IQueryable<Transfer> query;

        if (filter?.Role == "sender")
        {
            query = _db.Transfers.Where(t => t.SenderId == userId);
        }
        else if (filter?.Role == "receiver")
        {
            query = _db.Transfers.Where(t => t.ReceiverId == userId);
        }
        else
        {
            query = _db.Transfers.Where(t => t.SenderId == userId || t.ReceiverId == userId);
        }

        if (filter?.Status.HasValue == true)
        {
            var statusValue = filter.Status.Value;
            query = query.Where(t => t.Status == statusValue);
        }

        var transfers = await query
            .OrderByDescending(t => t.CreatedAt)
            .Take(filter?.Limit ?? 50)
            .ToListAsync();

        return transfers.Select(MapToDto).ToList();
    }

    public async Task<TransferDto?> GetTransferByIdAsync(string transferId, uint userId)
    {
        var transfer = await _db.Transfers.FirstOrDefaultAsync(t => t.Id == transferId);

        if (transfer == null)
            return null;

        // Only sender or receiver can view
        if (transfer.SenderId != userId && transfer.ReceiverId != userId)
            return null;

        return MapToDto(transfer);
    }

    public async Task<TransferDto?> GetTransferByCodeAsync(string code, uint userId)
    {
        var transfer = await _db.Transfers.FirstOrDefaultAsync(t => t.Code == code);

        if (transfer == null)
            return null;

        // Only sender or receiver can view
        if (transfer.SenderId != userId && transfer.ReceiverId != userId)
            return null;

        return MapToDto(transfer);
    }
}
