using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Infrastructure.Auth;

namespace FeatureService.Api.Controllers.Social;

[ApiController]
[Route("api/v1/threads/{threadId}/reactions")]
[Authorize]
public class ReactionsController : ControllerBase
{
    private readonly IReactionService _reactionService;
    private readonly IUserContextAccessor _userContextAccessor;

    public ReactionsController(IReactionService reactionService, IUserContextAccessor userContextAccessor)
    {
        _reactionService = reactionService;
        _userContextAccessor = userContextAccessor;
    }

    [HttpPost]
    public async Task<ActionResult<ReactionResponse>> AddReaction(
        [FromRoute] uint threadId,
        [FromBody] CreateReactionRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return Unauthorized();
        }

        var response = await _reactionService.AddOrUpdateReactionAsync(
            "thread",
            threadId.ToString(),
            request,
            user
        );

        return Ok(response);
    }

    [HttpDelete]
    public async Task<ActionResult<ReactionResponse>> RemoveReaction([FromRoute] uint threadId)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return Unauthorized();
        }

        var response = await _reactionService.RemoveReactionAsync(
            "thread",
            threadId.ToString(),
            user
        );

        return Ok(response);
    }

    [HttpGet("summary")]
    [AllowAnonymous]
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
