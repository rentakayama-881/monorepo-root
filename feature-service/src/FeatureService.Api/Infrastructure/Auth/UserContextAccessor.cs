using System.Security.Claims;

namespace FeatureService.Api.Infrastructure.Auth;

public interface IUserContextAccessor
{
    UserContext? GetCurrentUser();
}

public class UserContextAccessor : IUserContextAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserContextAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public UserContext? GetCurrentUser()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext?.User?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var userIdClaim = httpContext.User.FindFirst("user_id") ?? httpContext.User.FindFirst(ClaimTypes.NameIdentifier);
        var emailClaim = httpContext.User.FindFirst("email") ?? httpContext.User.FindFirst(ClaimTypes.Email);
        var usernameClaim = httpContext.User.FindFirst("username") ?? httpContext.User.FindFirst(ClaimTypes.Name);

        if (userIdClaim == null || !uint.TryParse(userIdClaim.Value, out var userId))
        {
            return null;
        }

        return new UserContext
        {
            UserId = userId,
            Email = emailClaim?.Value ?? string.Empty,
            Username = usernameClaim?.Value ?? string.Empty
        };
    }
}
