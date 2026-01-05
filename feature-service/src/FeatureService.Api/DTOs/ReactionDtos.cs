namespace FeatureService.Api.DTOs;

// Request DTOs
public class CreateReactionRequest
{
    public string ReactionType { get; set; } = string.Empty; // like, love, fire, sad, laugh
}

// Response DTOs
public class ReactionResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = string.Empty;
    public ReactionMeta Meta { get; set; } = new();
}

public class ReactionSummaryResponse
{
    public bool Success { get; set; } = true;
    public ReactionSummaryData Data { get; set; } = new();
    public ReactionMeta Meta { get; set; } = new();
}

public class ReactionSummaryData
{
    public Dictionary<string, int> Counts { get; set; } = new();
    public int TotalCount { get; set; }
    public string? UserReaction { get; set; }
}

public class ReactionMeta
{
    public string RequestId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
