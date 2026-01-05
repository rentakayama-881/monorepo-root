using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Infrastructure.Auth;

namespace FeatureService.Api.Controllers.Social;

[ApiController]
[Route("api/v1/threads/{threadId}/replies")]
[Authorize]
public class RepliesController : ControllerBase
{
    private readonly IReplyService _replyService;
    private readonly IUserContextAccessor _userContextAccessor;

    public RepliesController(IReplyService replyService, IUserContextAccessor userContextAccessor)
    {
        _replyService = replyService;
        _userContextAccessor = userContextAccessor;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PaginatedRepliesResponse>> GetReplies(
        [FromRoute] uint threadId,
        [FromQuery] string? cursor = null,
        [FromQuery] int limit = 30)
    {
        if (limit <= 0 || limit > 100)
        {
            limit = 30;
        }

        var response = await _replyService.GetRepliesAsync(threadId, cursor, limit);
        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<ReplyResponse>> CreateReply(
        [FromRoute] uint threadId,
        [FromBody] CreateReplyRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return Unauthorized();
        }

        var response = await _replyService.CreateReplyAsync(threadId, request, user);
        return CreatedAtAction(nameof(GetReplies), new { threadId }, response);
    }

    [HttpPatch("{replyId}")]
    public async Task<ActionResult<ReplyResponse>> UpdateReply(
        [FromRoute] uint threadId,
        [FromRoute] string replyId,
        [FromBody] UpdateReplyRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return Unauthorized();
        }

        var response = await _replyService.UpdateReplyAsync(threadId, replyId, request, user);
        return Ok(response);
    }

    [HttpDelete("{replyId}")]
    public async Task<ActionResult> DeleteReply(
        [FromRoute] uint threadId,
        [FromRoute] string replyId)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return Unauthorized();
        }

        await _replyService.DeleteReplyAsync(threadId, replyId, user);
        return NoContent();
    }
}
