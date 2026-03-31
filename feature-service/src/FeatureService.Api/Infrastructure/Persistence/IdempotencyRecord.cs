namespace FeatureService.Api.Infrastructure.Persistence;

public class IdempotencyRecord
{
    public string Key { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ResultJson { get; set; }
    public DateTime LockedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
