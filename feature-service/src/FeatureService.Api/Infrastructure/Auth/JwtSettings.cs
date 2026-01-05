namespace FeatureService.Api.Infrastructure.Auth;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "api.alephdraad.fun";
    public string Audience { get; set; } = "alephdraad-clients";
}
