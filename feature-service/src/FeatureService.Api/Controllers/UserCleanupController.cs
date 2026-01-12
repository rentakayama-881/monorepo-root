using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;

namespace FeatureService.Api.Controllers;

/// <summary>
/// User account cleanup endpoints - called by Go backend during account deletion
/// </summary>
[ApiController]
[Route("api/v1/user")]
[Produces("application/json")]
public class UserCleanupController : ApiControllerBase
{
    private readonly IUserCleanupService _cleanupService;
    private readonly IUserContextAccessor _userContext;
    private readonly ILogger<UserCleanupController> _logger;

    public UserCleanupController(
        IUserCleanupService cleanupService,
        IUserContextAccessor userContext,
        ILogger<UserCleanupController> logger)
    {
        _cleanupService = cleanupService;
        _userContext = userContext;
        _logger = logger;
    }

    /// <summary>
    /// Validate if a user can delete their account.
    /// Returns blocking reasons (wallet balance > 0, pending transfers, disputes)
    /// and warnings (token balance will be lost).
    /// Called by Go backend before showing delete confirmation.
    /// </summary>
    [HttpGet("{userId}/can-delete")]
    [Authorize]
    [ProducesResponseType(typeof(UserDeleteValidationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ValidateAccountDeletion(uint userId)
    {
        if (!_userContext.IsAuthenticated)
        {
            return ApiUnauthorized("User not authenticated");
        }

        var currentUser = _userContext.GetCurrentUser();
        var isInternal = User.HasClaim("scope", "internal") || User.HasClaim("aud", "feature-service-internal");

        if (!_userContext.IsAdmin && !isInternal && currentUser?.UserId != userId)
        {
            return ApiForbidden("You can only validate your own account deletion");
        }

        var result = await _cleanupService.ValidateAccountDeletionAsync(userId);
        return Ok(result);
    }

    /// <summary>
    /// Hard delete all user data from MongoDB.
    /// Called by Go backend during account deletion process.
    /// Will re-validate before deleting and refuse if conditions not met.
    /// </summary>
    [HttpDelete("{userId}/cleanup")]
    [Authorize]
    [ProducesResponseType(typeof(UserCleanupResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CleanupUserData(uint userId)
    {
        if (!_userContext.IsAuthenticated)
        {
            return ApiUnauthorized("User not authenticated");
        }

        var currentUser = _userContext.GetCurrentUser();
        var isInternal = User.HasClaim("scope", "internal") || User.HasClaim("aud", "feature-service-internal");

        if (!_userContext.IsAdmin && !isInternal && currentUser?.UserId != userId)
        {
            return ApiForbidden("You can only cleanup your own account");
        }

        var actor = _userContext.IsAdmin ? "admin" : (isInternal ? "internal-service" : "self");
        _logger.LogWarning("Account cleanup initiated for user {UserId} by {Actor}", userId, actor);

        var result = await _cleanupService.CleanupUserDataAsync(userId);

        if (!result.Success)
        {
            return ApiBadRequest("CLEANUP_FAILED", result.Error ?? "Cannot cleanup user data");
        }

        return Ok(result);
    }
}
