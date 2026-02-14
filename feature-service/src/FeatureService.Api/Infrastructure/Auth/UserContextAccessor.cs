using System.Security.Claims;

namespace FeatureService.Api.Infrastructure.Auth;

public interface IUserContextAccessor
{
    UserContext? GetCurrentUser();
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
}

public class UserContextAccessor : IUserContextAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserContextAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated == true;

    public bool IsAdmin
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext?.User == null) return false;
            var isAdminToken = string.Equals(
                httpContext.User.FindFirst("type")?.Value,
                "admin",
                StringComparison.OrdinalIgnoreCase);
            if (!isAdminToken) return false;
            return httpContext.User.IsInRole("admin")
                || httpContext.User.HasClaim("role", "admin")
                || httpContext.User.HasClaim(ClaimTypes.Role, "admin");
        }
    }

    public UserContext? GetCurrentUser()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext?.User?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var userIdClaim = httpContext.User.FindFirst("user_id") 
            ?? httpContext.User.FindFirst(ClaimTypes.NameIdentifier)
            ?? httpContext.User.FindFirst("sub");
        var emailClaim = httpContext.User.FindFirst("email") ?? httpContext.User.FindFirst(ClaimTypes.Email);
        var usernameClaim = httpContext.User.FindFirst("username") ?? httpContext.User.FindFirst(ClaimTypes.Name);
        var avatarClaim = httpContext.User.FindFirst("avatar_url");
        var totpEnabledClaim = httpContext.User.FindFirst("totp_enabled");

        if (userIdClaim == null || !uint.TryParse(userIdClaim.Value, out var userId))
        {
            return null;
        }

        // Parse totp_enabled claim (defaults to false if not present)
        var totpEnabled = totpEnabledClaim?.Value?.Equals("true", StringComparison.OrdinalIgnoreCase) == true
            || totpEnabledClaim?.Value?.Equals("True", StringComparison.OrdinalIgnoreCase) == true;

        return new UserContext
        {
            UserId = userId,
            Email = emailClaim?.Value ?? string.Empty,
            Username = usernameClaim?.Value ?? string.Empty,
            IsAdmin = IsAdmin,
            TotpEnabled = totpEnabled,
            AvatarUrl = avatarClaim?.Value
        };
    }
}
