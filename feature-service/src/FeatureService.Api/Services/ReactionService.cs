using MongoDB.Driver;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.Auth;

namespace FeatureService.Api.Services;

public interface IReactionService
{
    Task<ReactionResponse> AddOrUpdateReactionAsync(string targetType, string targetId, CreateReactionRequest request, UserContext user);
    Task<ReactionResponse> RemoveReactionAsync(string targetType, string targetId, UserContext user);
    Task<ReactionSummaryResponse> GetReactionSummaryAsync(string targetType, string targetId, uint? userId);
}

public class ReactionService : IReactionService
{
    private readonly IMongoCollection<Reaction> _reactions;
    private readonly IMongoCollection<ReactionCount> _reactionCounts;

    public ReactionService(MongoDbContext dbContext)
    {
        _reactions = dbContext.GetCollection<Reaction>("reactions");
        _reactionCounts = dbContext.GetCollection<ReactionCount>("reaction_counts");
    }

    public async Task<ReactionResponse> AddOrUpdateReactionAsync(string targetType, string targetId, CreateReactionRequest request, UserContext user)
    {
        var reactionType = request.ReactionType.ToLowerInvariant();

        // Check if user already has a reaction on this target
        var existingReaction = await _reactions.Find(r =>
            r.UserId == user.UserId &&
            r.TargetType == targetType &&
            r.TargetId == targetId
        ).FirstOrDefaultAsync();

        if (existingReaction != null)
        {
            // Update existing reaction
            if (existingReaction.ReactionType == reactionType)
            {
                // Same reaction - no change needed
                await UpdateReactionCounts(targetType, targetId);
                return new ReactionResponse
                {
                    Success = true,
                    Message = "Reaction already exists",
                    Meta = new ReactionMeta
                    {
                        RequestId = Guid.NewGuid().ToString(),
                        Timestamp = DateTime.UtcNow
                    }
                };
            }

            // Different reaction - update it
            var update = Builders<Reaction>.Update
                .Set(r => r.ReactionType, reactionType)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            await _reactions.UpdateOneAsync(r => r.Id == existingReaction.Id, update);
        }
        else
        {
            // Create new reaction
            var reaction = new Reaction
            {
                Id = $"rxn_{Ulid.NewUlid()}",
                UserId = user.UserId,
                TargetType = targetType,
                TargetId = targetId,
                ReactionType = reactionType,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _reactions.InsertOneAsync(reaction);
        }

        // Update reaction counts
        await UpdateReactionCounts(targetType, targetId);

        return new ReactionResponse
        {
            Success = true,
            Message = "Reaction added successfully",
            Meta = new ReactionMeta
            {
                RequestId = Guid.NewGuid().ToString(),
                Timestamp = DateTime.UtcNow
            }
        };
    }

    public async Task<ReactionResponse> RemoveReactionAsync(string targetType, string targetId, UserContext user)
    {
        var result = await _reactions.DeleteOneAsync(r =>
            r.UserId == user.UserId &&
            r.TargetType == targetType &&
            r.TargetId == targetId
        );

        if (result.DeletedCount == 0)
        {
            throw new KeyNotFoundException("Reaction not found");
        }

        // Update reaction counts
        await UpdateReactionCounts(targetType, targetId);

        return new ReactionResponse
        {
            Success = true,
            Message = "Reaction removed successfully",
            Meta = new ReactionMeta
            {
                RequestId = Guid.NewGuid().ToString(),
                Timestamp = DateTime.UtcNow
            }
        };
    }

    public async Task<ReactionSummaryResponse> GetReactionSummaryAsync(string targetType, string targetId, uint? userId)
    {
        var countId = $"{targetType}:{targetId}";
        var reactionCount = await _reactionCounts.Find(rc => rc.Id == countId).FirstOrDefaultAsync();

        string? userReaction = null;
        if (userId.HasValue)
        {
            var userReactionDoc = await _reactions.Find(r =>
                r.UserId == userId.Value &&
                r.TargetType == targetType &&
                r.TargetId == targetId
            ).FirstOrDefaultAsync();

            userReaction = userReactionDoc?.ReactionType;
        }

        return new ReactionSummaryResponse
        {
            Success = true,
            Data = new ReactionSummaryData
            {
                Counts = reactionCount?.Counts ?? new Dictionary<string, int>(),
                TotalCount = reactionCount?.TotalCount ?? 0,
                UserReaction = userReaction
            },
            Meta = new ReactionMeta
            {
                RequestId = Guid.NewGuid().ToString(),
                Timestamp = DateTime.UtcNow
            }
        };
    }

    private async Task UpdateReactionCounts(string targetType, string targetId)
    {
        var reactions = await _reactions.Find(r =>
            r.TargetType == targetType &&
            r.TargetId == targetId
        ).ToListAsync();

        var counts = reactions
            .GroupBy(r => r.ReactionType)
            .ToDictionary(g => g.Key, g => g.Count());

        var totalCount = reactions.Count;

        var countId = $"{targetType}:{targetId}";

        var reactionCount = new ReactionCount
        {
            Id = countId,
            TargetType = targetType,
            TargetId = targetId,
            Counts = counts,
            TotalCount = totalCount,
            UpdatedAt = DateTime.UtcNow
        };

        await _reactionCounts.ReplaceOneAsync(
            rc => rc.Id == countId,
            reactionCount,
            new ReplaceOptions { IsUpsert = true }
        );
    }
}
