namespace FeatureService.Api.DTOs;

// Request DTOs
public class CreateReplyRequest
{
    public string Content { get; set; } = string.Empty;
    public string? ParentReplyId { get; set; }
}

public class UpdateReplyRequest
{
    public string Content { get; set; } = string.Empty;
}

// Response DTOs
public class ReplyResponse
{
    public string Id { get; set; } = string.Empty;
    public uint ThreadId { get; set; }
    public uint UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? ParentReplyId { get; set; }
    public int Depth { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class PaginatedRepliesResponse
{
    public bool Success { get; set; } = true;
    public List<ReplyResponse> Data { get; set; } = new();
    public PaginationMeta Meta { get; set; } = new();
}

public class PaginationMeta
{
    public int Count { get; set; }
    public bool HasMore { get; set; }
    public string? NextCursor { get; set; }
    public string RequestId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
