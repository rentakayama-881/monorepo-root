using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using System.Security.Claims;

namespace FeatureService.Api.Controllers;

/// <summary>
/// User account cleanup endpoints - called by Go backend during account deletion
/// </summary>
[ApiController]
[Route("api/v1/user")]
public class UserCleanupController : ControllerBase
{
    private readonly IUserCleanupService _cleanupService;
    private readonly ILogger<UserCleanupController> _logger;

    public UserCleanupController(
        IUserCleanupService cleanupService,
        ILogger<UserCleanupController> logger)
    {
        _cleanupService = cleanupService;
        _logger = logger;
    }

    /// <summary>
    /// Validate if a user can delete their account.
    /// Returns blocking reasons (wallet balance > 0, pending transfers, disputes)
    /// and warnings (token balance will be lost).
    /// Called by Go backend before showing delete confirmation.
    /// </summary>
    [HttpGet("{userId}/can-delete")]
    [Authorize] // Requires valid JWT - either user's own or internal service token
    [ProducesResponseType(typeof(UserDeleteValidationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ValidateAccountDeletion(uint userId)
    {
        // Verify the request is either:
        // 1. From the user themselves
        // 2. From an admin
        // 3. From internal service (service-to-service)
        var userIdClaim = User.FindFirst("user_id")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isAdmin = User.IsInRole("admin");
        var isInternal = User.HasClaim("scope", "internal") || User.HasClaim("aud", "feature-service-internal");

        if (!isAdmin && !isInternal && userIdClaim != userId.ToString())
        {
            return Forbid();
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
    [Authorize] // Requires valid JWT
    [ProducesResponseType(typeof(UserCleanupResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(UserCleanupResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CleanupUserData(uint userId)
    {
        // Same authorization check
        var userIdClaim = User.FindFirst("user_id")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isAdmin = User.IsInRole("admin");
        var isInternal = User.HasClaim("scope", "internal") || User.HasClaim("aud", "feature-service-internal");

        if (!isAdmin && !isInternal && userIdClaim != userId.ToString())
        {
            return Forbid();
        }

        _logger.LogWarning("Account cleanup initiated for user {UserId} by {Actor}", 
            userId, 
            isAdmin ? "admin" : (isInternal ? "internal-service" : "self"));

        var result = await _cleanupService.CleanupUserDataAsync(userId);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
}
