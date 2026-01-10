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
            return httpContext.User.IsInRole("admin") || httpContext.User.HasClaim("role", "admin");
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

        if (userIdClaim == null || !uint.TryParse(userIdClaim.Value, out var userId))
        {
            return null;
        }

        return new UserContext
        {
            UserId = userId,
            Email = emailClaim?.Value ?? string.Empty,
            Username = usernameClaim?.Value ?? string.Empty,
            IsAdmin = IsAdmin,
            AvatarUrl = avatarClaim?.Value
        };
    }
}
