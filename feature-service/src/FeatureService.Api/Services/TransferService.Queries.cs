using MongoDB.Driver;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class TransferService
{
    public async Task<List<TransferDto>> GetTransfersAsync(uint userId, TransferFilter? filter = null)
    {
        var filterBuilder = Builders<Transfer>.Filter;
        FilterDefinition<Transfer> query;

        if (filter?.Role == "sender")
        {
            query = filterBuilder.Eq(t => t.SenderId, userId);
        }
        else if (filter?.Role == "receiver")
        {
            query = filterBuilder.Eq(t => t.ReceiverId, userId);
        }
        else
        {
            query = filterBuilder.Or(
                filterBuilder.Eq(t => t.SenderId, userId),
                filterBuilder.Eq(t => t.ReceiverId, userId)
            );
        }

        if (filter?.Status.HasValue == true)
        {
            query = filterBuilder.And(query, filterBuilder.Eq(t => t.Status, filter.Status.Value));
        }

        var transfers = await _transfers
            .Find(query)
            .SortByDescending(t => t.CreatedAt)
            .Limit(filter?.Limit ?? 50)
            .ToListAsync();

        return transfers.Select(MapToDto).ToList();
    }

    public async Task<TransferDto?> GetTransferByIdAsync(string transferId, uint userId)
    {
        var transfer = await _transfers.Find(t => t.Id == transferId).FirstOrDefaultAsync();

        if (transfer == null)
            return null;

        // Only sender or receiver can view
        if (transfer.SenderId != userId && transfer.ReceiverId != userId)
            return null;

        return MapToDto(transfer);
    }

    public async Task<TransferDto?> GetTransferByCodeAsync(string code, uint userId)
    {
        var transfer = await _transfers.Find(t => t.Code == code).FirstOrDefaultAsync();

        if (transfer == null)
            return null;

        // Only sender or receiver can view
        if (transfer.SenderId != userId && transfer.ReceiverId != userId)
            return null;

        return MapToDto(transfer);
    }
}
