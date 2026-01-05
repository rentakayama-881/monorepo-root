using MongoDB.Driver;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.Auth;

namespace FeatureService.Api.Services;

public interface IReplyService
{
    Task<PaginatedRepliesResponse> GetRepliesAsync(uint threadId, string? cursor, int limit);
    Task<ReplyResponse> CreateReplyAsync(uint threadId, CreateReplyRequest request, UserContext user);
    Task<ReplyResponse> UpdateReplyAsync(uint threadId, string replyId, UpdateReplyRequest request, UserContext user);
    Task DeleteReplyAsync(uint threadId, string replyId, UserContext user);
}

public class ReplyService : IReplyService
{
    private readonly IMongoCollection<Reply> _replies;
    private const int MaxDepth = 3;

    public ReplyService(MongoDbContext dbContext)
    {
        _replies = dbContext.GetCollection<Reply>("replies");
    }

    public async Task<PaginatedRepliesResponse> GetRepliesAsync(uint threadId, string? cursor, int limit)
    {
        var filter = Builders<Reply>.Filter.And(
            Builders<Reply>.Filter.Eq(r => r.ThreadId, threadId),
            Builders<Reply>.Filter.Eq(r => r.IsDeleted, false)
        );

        if (!string.IsNullOrEmpty(cursor))
        {
            // Cursor is the createdAt timestamp
            if (DateTime.TryParse(cursor, out var cursorDate))
            {
                filter = Builders<Reply>.Filter.And(
                    filter,
                    Builders<Reply>.Filter.Lt(r => r.CreatedAt, cursorDate)
                );
            }
        }

        var replies = await _replies
            .Find(filter)
            .Sort(Builders<Reply>.Sort.Descending(r => r.CreatedAt))
            .Limit(limit + 1)
            .ToListAsync();

        var hasMore = replies.Count > limit;
        if (hasMore)
        {
            replies = replies.Take(limit).ToList();
        }

        var nextCursor = hasMore && replies.Any()
            ? replies.Last().CreatedAt.ToString("o")
            : null;

        var requestId = Guid.NewGuid().ToString();

        return new PaginatedRepliesResponse
        {
            Success = true,
            Data = replies.Select(MapToResponse).ToList(),
            Meta = new PaginationMeta
            {
                Count = replies.Count,
                HasMore = hasMore,
                NextCursor = nextCursor,
                RequestId = requestId,
                Timestamp = DateTime.UtcNow
            }
        };
    }

    public async Task<ReplyResponse> CreateReplyAsync(uint threadId, CreateReplyRequest request, UserContext user)
    {
        int depth = 0;
        string? parentReplyId = request.ParentReplyId;

        if (!string.IsNullOrEmpty(parentReplyId))
        {
            var parentReply = await _replies.Find(r => r.Id == parentReplyId).FirstOrDefaultAsync()
                ?? throw new KeyNotFoundException("Parent reply not found");

            if (parentReply.ThreadId != threadId)
            {
                throw new InvalidOperationException("Parent reply does not belong to this thread");
            }

            depth = parentReply.Depth + 1;

            if (depth > MaxDepth)
            {
                throw new InvalidOperationException($"Maximum nesting depth of {MaxDepth} exceeded");
            }
        }

        var reply = new Reply
        {
            Id = $"rpl_{Ulid.NewUlid()}",
            ThreadId = threadId,
            UserId = user.UserId,
            Username = user.Username,
            Content = request.Content,
            ParentReplyId = parentReplyId,
            Depth = depth,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _replies.InsertOneAsync(reply);

        return MapToResponse(reply);
    }

    public async Task<ReplyResponse> UpdateReplyAsync(uint threadId, string replyId, UpdateReplyRequest request, UserContext user)
    {
        var reply = await _replies.Find(r => r.Id == replyId && r.ThreadId == threadId).FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Reply not found");

        if (reply.UserId != user.UserId)
        {
            throw new UnauthorizedAccessException("You can only edit your own replies");
        }

        if (reply.IsDeleted)
        {
            throw new InvalidOperationException("Cannot edit deleted reply");
        }

        var update = Builders<Reply>.Update
            .Set(r => r.Content, request.Content)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _replies.UpdateOneAsync(r => r.Id == replyId, update);

        reply.Content = request.Content;
        reply.UpdatedAt = DateTime.UtcNow;

        return MapToResponse(reply);
    }

    public async Task DeleteReplyAsync(uint threadId, string replyId, UserContext user)
    {
        var reply = await _replies.Find(r => r.Id == replyId && r.ThreadId == threadId).FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Reply not found");

        if (reply.UserId != user.UserId)
        {
            throw new UnauthorizedAccessException("You can only delete your own replies");
        }

        var update = Builders<Reply>.Update
            .Set(r => r.IsDeleted, true)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _replies.UpdateOneAsync(r => r.Id == replyId, update);
    }

    private static ReplyResponse MapToResponse(Reply reply)
    {
        return new ReplyResponse
        {
            Id = reply.Id,
            ThreadId = reply.ThreadId,
            UserId = reply.UserId,
            Username = reply.Username,
            Content = reply.Content,
            ParentReplyId = reply.ParentReplyId,
            Depth = reply.Depth,
            IsDeleted = reply.IsDeleted,
            CreatedAt = reply.CreatedAt,
            UpdatedAt = reply.UpdatedAt
        };
    }
}
