using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.Security.Claims;

namespace FeatureService.Api.Controllers;

/// <summary>
/// AI Chat endpoints for Hugging Face and External LLM services (paid, per-token)
/// </summary>
[ApiController]
[Route("api/v1/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;
    private readonly ITokenService _tokenService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        IChatService chatService,
        ITokenService tokenService,
        ILogger<ChatController> logger)
    {
        _chatService = chatService;
        _tokenService = tokenService;
        _logger = logger;
    }

    #region Token/Wallet Management

    /// <summary>
    /// Get user's token balance
    /// </summary>
    [HttpGet("balance")]
    [ProducesResponseType(typeof(TokenBalanceDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBalance()
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        var balance = await _tokenService.GetBalanceAsync(userId);
        return Ok(balance);
    }

    /// <summary>
    /// Get available token packages for purchase
    /// </summary>
    [HttpGet("packages")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(TokenPackagesResponse), StatusCodes.Status200OK)]
    public IActionResult GetTokenPackages()
    {
        var packages = TokenPackage.AllPackages.Select(p => new TokenPackageDto(
            p.Id,
            p.Name,
            p.TokenAmount,
            p.PriceIdr,
            p.BonusTokens,
            p.Description
        )).ToList();

        return Ok(new TokenPackagesResponse(packages));
    }

    /// <summary>
    /// Purchase tokens (simulated - integration with payment gateway needed)
    /// </summary>
    [HttpPost("purchase")]
    [ProducesResponseType(typeof(TokenPurchaseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PurchaseTokens([FromBody] PurchaseTokensRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        var package = TokenPackage.AllPackages.FirstOrDefault(p => p.Id == request.PackageId);
        if (package == null)
        {
            return BadRequest(new { error = "Invalid package ID" });
        }

        try
        {
            // In production, this would integrate with a payment gateway
            // For now, we simulate a successful purchase
            var purchaseId = await _tokenService.PurchaseTokensAsync(
                userId,
                request.PackageId,
                package.TokenAmount + package.BonusTokens,
                package.PriceIdr,
                request.PaymentMethod,
                request.TransactionId ?? $"sim_{Guid.NewGuid():N}"
            );

            var newBalance = await _tokenService.GetBalanceAsync(userId);

            _logger.LogInformation("Token purchase: {PurchaseId} for user {UserId}, {Tokens} tokens",
                purchaseId, userId, package.TokenAmount + package.BonusTokens);

            return Ok(new TokenPurchaseResponse(
                purchaseId,
                package.TokenAmount + package.BonusTokens,
                newBalance.Balance,
                "Purchase successful"
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process token purchase for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to process purchase" });
        }
    }

    /// <summary>
    /// Get token usage history
    /// </summary>
    [HttpGet("usage")]
    [ProducesResponseType(typeof(PaginatedTokenUsageResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsageHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        pageSize = Math.Min(pageSize, 100);
        var usage = await _tokenService.GetUsageHistoryAsync(userId, page, pageSize);
        return Ok(usage);
    }

    #endregion

    #region Chat Sessions

    /// <summary>
    /// Create a new chat session
    /// </summary>
    [HttpPost("sessions")]
    [ProducesResponseType(typeof(ChatSessionCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSession([FromBody] CreateChatSessionRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        // Validate service type
        if (!ChatServiceType.All.Contains(request.ServiceType))
        {
            return BadRequest(new { error = "Invalid service type. Must be one of: " + string.Join(", ", ChatServiceType.All) });
        }

        // Validate model for external LLM
        if (request.ServiceType == ChatServiceType.ExternalLlm)
        {
            if (string.IsNullOrEmpty(request.Model) || !ExternalLlmModels.All.Contains(request.Model))
            {
                return BadRequest(new { error = "Invalid model. Must be one of: " + string.Join(", ", ExternalLlmModels.All) });
            }
        }

        // Check if user has sufficient balance
        var balance = await _tokenService.GetBalanceAsync(userId);
        if (balance.Balance < 10)
        {
            return BadRequest(new { error = "Insufficient token balance. Please purchase tokens to use AI chat." });
        }

        try
        {
            var sessionId = await _chatService.CreateSessionAsync(
                userId,
                request.ServiceType,
                request.Model,
                request.Title
            );

            return CreatedAtAction(nameof(GetSessionDetail), new { id = sessionId },
                new ChatSessionCreatedResponse(sessionId, "Chat session created"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create chat session for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to create chat session" });
        }
    }

    /// <summary>
    /// Get user's chat sessions
    /// </summary>
    [HttpGet("sessions")]
    [ProducesResponseType(typeof(PaginatedChatSessionsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSessions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? serviceType = null)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        pageSize = Math.Min(pageSize, 50);
        var sessions = await _chatService.GetUserSessionsAsync(userId, page, pageSize, serviceType);
        return Ok(sessions);
    }

    /// <summary>
    /// Get chat session with messages
    /// </summary>
    [HttpGet("sessions/{id}")]
    [ProducesResponseType(typeof(ChatSessionDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionDetail(string id)
    {
        var userId = GetCurrentUserId();
        var session = await _chatService.GetSessionDetailAsync(id, userId);

        if (session == null)
        {
            return NotFound(new { error = "Chat session not found" });
        }

        return Ok(session);
    }

    /// <summary>
    /// Send a message to a chat session
    /// </summary>
    [HttpPost("sessions/{id}/messages")]
    [ProducesResponseType(typeof(SendChatMessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SendMessage(string id, [FromBody] SendChatMessageRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "Message cannot be empty" });
        }

        // Limit message length
        if (request.Message.Length > 10000)
        {
            return BadRequest(new { error = "Message too long. Maximum 10,000 characters." });
        }

        try
        {
            var response = await _chatService.SendMessageAsync(id, userId, request.Message);
            return Ok(response);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Chat session not found" });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("balance"))
        {
            return StatusCode(402, new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send message to session {SessionId}", id);
            return StatusCode(500, new { error = "Failed to process message" });
        }
    }

    /// <summary>
    /// Archive a chat session
    /// </summary>
    [HttpPost("sessions/{id}/archive")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ArchiveSession(string id)
    {
        var userId = GetCurrentUserId();

        try
        {
            await _chatService.ArchiveSessionAsync(id, userId);
            return Ok(new { message = "Session archived successfully" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Chat session not found" });
        }
    }

    /// <summary>
    /// Delete a chat session
    /// </summary>
    [HttpDelete("sessions/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSession(string id)
    {
        var userId = GetCurrentUserId();

        try
        {
            await _chatService.DeleteSessionAsync(id, userId);
            _logger.LogInformation("Chat session deleted: {SessionId} by user {UserId}", id, userId);
            return Ok(new { message = "Session deleted successfully" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Chat session not found" });
        }
    }

    #endregion

    #region Available Models

    /// <summary>
    /// Get available AI models and their pricing
    /// </summary>
    [HttpGet("models")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AvailableModelsResponse), StatusCodes.Status200OK)]
    public IActionResult GetAvailableModels()
    {
        var models = new List<ModelInfoDto>
        {
            // Hugging Face
            new ModelInfoDto(
                "meta-llama/Llama-3.3-70B-Instruct",
                ChatServiceType.HuggingFace,
                "Llama 3.3 70B",
                "Meta's flagship open-source model, excellent for general tasks",
                1 // 1 token cost per token
            ),

            // External LLM via n8n
            new ModelInfoDto(
                ExternalLlmModels.Gpt4o,
                ChatServiceType.ExternalLlm,
                "GPT-4o",
                "OpenAI's most advanced model",
                3
            ),
            new ModelInfoDto(
                ExternalLlmModels.Gpt4oMini,
                ChatServiceType.ExternalLlm,
                "GPT-4o Mini",
                "Faster, more affordable GPT-4o variant",
                1
            ),
            new ModelInfoDto(
                ExternalLlmModels.Claude35Sonnet,
                ChatServiceType.ExternalLlm,
                "Claude 3.5 Sonnet",
                "Anthropic's best model for complex reasoning",
                3
            ),
            new ModelInfoDto(
                ExternalLlmModels.Claude35Haiku,
                ChatServiceType.ExternalLlm,
                "Claude 3.5 Haiku",
                "Fast and efficient Claude variant",
                1
            ),
            new ModelInfoDto(
                ExternalLlmModels.GeminiPro,
                ChatServiceType.ExternalLlm,
                "Gemini 1.5 Pro",
                "Google's advanced multimodal model",
                2
            ),
            new ModelInfoDto(
                ExternalLlmModels.GeminiFlash,
                ChatServiceType.ExternalLlm,
                "Gemini 1.5 Flash",
                "Fast Gemini variant for quick tasks",
                1
            ),
            new ModelInfoDto(
                ExternalLlmModels.DeepseekV3,
                ChatServiceType.ExternalLlm,
                "Deepseek V3",
                "Powerful coding-focused model",
                2
            )
        };

        return Ok(new AvailableModelsResponse(models));
    }

    #endregion

    private uint GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var id) ? id : 0;
    }
}

// Request/Response DTOs
public record PurchaseTokensRequest(string PackageId, string PaymentMethod, string? TransactionId);
public record TokenPurchaseResponse(string PurchaseId, int TokensAdded, int NewBalance, string Message);
public record TokenPackagesResponse(List<TokenPackageDto> Packages);
public record CreateChatSessionRequest(string ServiceType, string? Model, string? Title);
public record ChatSessionCreatedResponse(string SessionId, string Message);
public record PaginatedChatSessionsResponse(List<ChatSessionSummaryDto> Sessions, int TotalCount, int Page, int PageSize);
public record PaginatedTokenUsageResponse(List<TokenUsageDto> Usage, int TotalCount, int Page, int PageSize);
public record ModelInfoDto(string Id, string ServiceType, string Name, string Description, int TokenCostMultiplier);
public record AvailableModelsResponse(List<ModelInfoDto> Models);
