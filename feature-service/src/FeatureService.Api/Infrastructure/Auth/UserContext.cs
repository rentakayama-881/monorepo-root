namespace FeatureService.Api.Infrastructure.Auth;

public class UserContext
{
    public uint UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public bool TotpEnabled { get; set; }
    public string? AvatarUrl { get; set; }
}
