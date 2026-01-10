using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Infrastructure.Auth;

namespace FeatureService.Api.Controllers.Social;

/// <summary>
/// Reaction management endpoints for threads
/// </summary>
[ApiController]
[Route("api/v1/threads/{threadId}/reactions")]
[Authorize]
[Produces("application/json")]
public class ReactionsController : ApiControllerBase
{
    private readonly IReactionService _reactionService;
    private readonly IUserContextAccessor _userContextAccessor;

    public ReactionsController(IReactionService reactionService, IUserContextAccessor userContextAccessor)
    {
        _reactionService = reactionService;
        _userContextAccessor = userContextAccessor;
    }

    /// <summary>
    /// Add or update a reaction on a thread
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ReactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ReactionResponse>> AddReaction(
        [FromRoute] uint threadId,
        [FromBody] CreateReactionRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("Login diperlukan untuk memberi reaksi");
        }

        var response = await _reactionService.AddOrUpdateReactionAsync(
            "thread",
            threadId.ToString(),
            request,
            user
        );

        return Ok(response);
    }

    /// <summary>
    /// Remove a reaction from a thread
    /// </summary>
    [HttpDelete]
    [ProducesResponseType(typeof(ReactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ReactionResponse>> RemoveReaction([FromRoute] uint threadId)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("Login diperlukan untuk menghapus reaksi");
        }

        var response = await _reactionService.RemoveReactionAsync(
            "thread",
            threadId.ToString(),
            user
        );

        return Ok(response);
    }

    /// <summary>
    /// Get reaction summary for a thread
    /// </summary>
    [HttpGet("summary")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ReactionSummaryResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ReactionSummaryResponse>> GetReactionSummary([FromRoute] uint threadId)
    {
        var user = _userContextAccessor.GetCurrentUser();
        var userId = user?.UserId;

        var response = await _reactionService.GetReactionSummaryAsync(
            "thread",
            threadId.ToString(),
            userId
        );

        return Ok(response);
    }
}
