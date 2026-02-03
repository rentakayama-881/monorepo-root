namespace FeatureService.Api.Infrastructure.Auth;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public bool ValidateIssuer { get; set; } = true;
    public bool ValidateAudience { get; set; } = true;
    
    /// <summary>
    /// Separate secret for admin JWT tokens (from Go backend)
    /// </summary>
    public string AdminSecret { get; set; } = string.Empty;
}
