using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace FeatureService.Api.Infrastructure.Auth;

/// <summary>
/// Custom authentication handler that validates admin JWT tokens from Go backend
/// </summary>
public class AdminJwtAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly JwtSettings _jwtSettings;

    public AdminJwtAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IOptions<JwtSettings> jwtSettings)
        : base(options, logger, encoder)
    {
        _jwtSettings = jwtSettings.Value;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Get Authorization header
        if (!Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var headerValue = authHeader.ToString();
        if (!headerValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var token = headerValue.Substring("Bearer ".Length).Trim();

        try
        {
            // Try to validate with admin secret first
            var adminSecret = _jwtSettings.AdminSecret;
            if (string.IsNullOrEmpty(adminSecret))
            {
                adminSecret = Environment.GetEnvironmentVariable("ADMIN_JWT_SECRET") ?? "";
            }

            if (!string.IsNullOrEmpty(adminSecret))
            {
                var result = ValidateToken(token, adminSecret);
                if (result != null)
                {
                    return Task.FromResult(AuthenticateResult.Success(result));
                }
            }

            // Fall back to regular JWT secret
            var regularSecret = _jwtSettings.Secret;
            if (!string.IsNullOrEmpty(regularSecret))
            {
                var result = ValidateToken(token, regularSecret);
                if (result != null)
                {
                    return Task.FromResult(AuthenticateResult.Success(result));
                }
            }

            return Task.FromResult(AuthenticateResult.Fail("Invalid token"));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Token validation failed");
            return Task.FromResult(AuthenticateResult.Fail("Token validation failed"));
        }
    }

    private AuthenticationTicket? ValidateToken(string token, string secret)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(secret);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);

            // Check if this is an admin token (from Go backend)
            var tokenType = principal.FindFirst("type")?.Value;
            var isAdmin = tokenType == "admin" || principal.IsInRole("admin");

            if (isAdmin)
            {
                // Add admin role claim if not present
                var identity = (ClaimsIdentity)principal.Identity!;
                if (!principal.IsInRole("admin"))
                {
                    identity.AddClaim(new Claim(ClaimTypes.Role, "admin"));
                }

                // Map admin_id to NameIdentifier if present
                var adminId = principal.FindFirst("admin_id")?.Value;
                if (!string.IsNullOrEmpty(adminId) && principal.FindFirst(ClaimTypes.NameIdentifier) == null)
                {
                    identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, adminId));
                }
            }

            var ticket = new AuthenticationTicket(principal, Scheme.Name);
            return ticket;
        }
        catch
        {
            return null;
        }
    }
}
