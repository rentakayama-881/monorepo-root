using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using NUlid;
using System.Text.Json;

namespace FeatureService.Api.Services;

public interface IChatService
{
    Task<ChatSession> CreateSessionAsync(uint userId, string serviceType, string? model);
    Task<ChatSession?> GetSessionByIdAsync(string sessionId);
    Task<ChatSessionDetailDto?> GetSessionDetailAsync(string sessionId, uint userId);
    Task<ChatSessionsResponse> GetUserSessionsAsync(uint userId, string? serviceType);
    Task<SendChatMessageResponse> SendMessageAsync(string sessionId, uint userId, string content);
    Task ArchiveSessionAsync(string sessionId, uint userId);
    Task DeleteSessionAsync(string sessionId, uint userId);
}

public class ChatService : IChatService
{
    private readonly MongoDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IHuggingFaceService _huggingFaceService;
    private readonly IExternalLlmService _externalLlmService;
    private readonly ILogger<ChatService> _logger;

    public ChatService(
        MongoDbContext context, 
        ITokenService tokenService,
        IHuggingFaceService huggingFaceService,
        IExternalLlmService externalLlmService,
        ILogger<ChatService> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _huggingFaceService = huggingFaceService;
        _externalLlmService = externalLlmService;
        _logger = logger;
    }

    public async Task<ChatSession> CreateSessionAsync(uint userId, string serviceType, string? model)
    {
        // Validate service type
        if (serviceType != ChatServiceType.HuggingFace && serviceType != ChatServiceType.ExternalLlm)
        {
            throw new ArgumentException("Invalid service type. Must be 'huggingface' or 'external_llm'");
        }

        // Validate model for external LLM
        if (serviceType == ChatServiceType.ExternalLlm)
        {
            if (string.IsNullOrEmpty(model))
            {
                throw new ArgumentException("Model is required for external LLM service");
            }
            if (ExternalLlmModels.GetById(model) == null)
            {
                throw new ArgumentException($"Invalid model. Available models: {string.Join(", ", ExternalLlmModels.All.Select(m => m.Id))}");
            }
        }

        var session = new ChatSession
        {
            Id = $"cht_{Ulid.NewUlid()}",
            UserId = userId,
            ServiceType = serviceType,
            Model = model,
            Title = "New Chat",
            TotalTokensUsed = 0,
            MessageCount = 0,
            IsArchived = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.ChatSessions.InsertOneAsync(session);
        _logger.LogInformation("Chat session created: {SessionId} for user {UserId}, service: {Service}", 
            session.Id, userId, serviceType);

        return session;
    }

    public async Task<ChatSession?> GetSessionByIdAsync(string sessionId)
    {
        return await _context.ChatSessions
            .Find(s => s.Id == sessionId)
            .FirstOrDefaultAsync();
    }

    public async Task<ChatSessionDetailDto?> GetSessionDetailAsync(string sessionId, uint userId)
    {
        var session = await GetSessionByIdAsync(sessionId);
        if (session == null || session.UserId != userId)
        {
            return null;
        }

        var messages = await _context.ChatMessages
            .Find(m => m.SessionId == sessionId)
            .SortBy(m => m.CreatedAt)
            .ToListAsync();

        var messageDtos = messages.Select(m => new ChatMessageDto(
            m.Id,
            m.Role,
            m.Content,
            m.TokensUsed,
            m.CreatedAt
        )).ToList();

        return new ChatSessionDetailDto(
            session.Id,
            session.ServiceType,
            session.Model,
            session.Title,
            session.TotalTokensUsed,
            messageDtos,
            session.CreatedAt,
            session.UpdatedAt
        );
    }

    public async Task<ChatSessionsResponse> GetUserSessionsAsync(uint userId, string? serviceType)
    {
        var filterBuilder = Builders<ChatSession>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Eq(s => s.UserId, userId),
            filterBuilder.Eq(s => s.IsArchived, false)
        );

        if (!string.IsNullOrEmpty(serviceType))
        {
            filter = filterBuilder.And(filter, filterBuilder.Eq(s => s.ServiceType, serviceType));
        }

        var sessions = await _context.ChatSessions
            .Find(filter)
            .SortByDescending(s => s.UpdatedAt)
            .ToListAsync();

        var dtos = sessions.Select(s => new ChatSessionSummaryDto(
            s.Id,
            s.ServiceType,
            s.Model,
            s.Title,
            s.TotalTokensUsed,
            s.MessageCount,
            s.LastMessageAt,
            s.CreatedAt
        )).ToList();

        return new ChatSessionsResponse(dtos, sessions.Count);
    }

    public async Task<SendChatMessageResponse> SendMessageAsync(string sessionId, uint userId, string content)
    {
        var session = await GetSessionByIdAsync(sessionId);
        if (session == null)
        {
            throw new KeyNotFoundException("Chat session not found");
        }

        if (session.UserId != userId)
        {
            throw new UnauthorizedAccessException("You don't have access to this chat session");
        }

        // Estimate tokens needed (rough estimate: 1 token per 4 characters)
        var estimatedInputTokens = (int)Math.Ceiling(content.Length / 4.0);
        var estimatedOutputTokens = 500; // Estimate for response
        var estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

        // Check token balance
        if (!await _tokenService.HasSufficientTokensAsync(userId, estimatedTotalTokens))
        {
            throw new InvalidOperationException("Insufficient token balance. Please purchase more tokens.");
        }

        var startTime = DateTime.UtcNow;

        // Get conversation history for context
        var previousMessages = await _context.ChatMessages
            .Find(m => m.SessionId == sessionId)
            .SortByDescending(m => m.CreatedAt)
            .Limit(10) // Last 10 messages for context
            .ToListAsync();

        previousMessages.Reverse(); // Oldest first

        // Call appropriate AI service
        string response;
        int actualInputTokens;
        int actualOutputTokens;

        if (session.ServiceType == ChatServiceType.HuggingFace)
        {
            var result = await _huggingFaceService.ChatAsync(content, previousMessages);
            response = result.Response;
            actualInputTokens = result.InputTokens;
            actualOutputTokens = result.OutputTokens;
        }
        else
        {
            var result = await _externalLlmService.ChatAsync(session.Model!, content, previousMessages);
            response = result.Response;
            actualInputTokens = result.InputTokens;
            actualOutputTokens = result.OutputTokens;
        }

        var actualTotalTokens = actualInputTokens + actualOutputTokens;
        var processingTime = (int)(DateTime.UtcNow - startTime).TotalMilliseconds;

        // Save user message
        var userMessage = new ChatMessage
        {
            Id = $"msg_{Ulid.NewUlid()}",
            SessionId = sessionId,
            UserId = userId,
            Role = MessageRole.User,
            Content = content,
            TokensUsed = actualInputTokens,
            CreatedAt = DateTime.UtcNow
        };
        await _context.ChatMessages.InsertOneAsync(userMessage);

        // Save assistant message
        var assistantMessage = new ChatMessage
        {
            Id = $"msg_{Ulid.NewUlid()}",
            SessionId = sessionId,
            UserId = userId,
            Role = MessageRole.Assistant,
            Content = response,
            TokensUsed = actualOutputTokens,
            ProcessingTimeMs = processingTime,
            CreatedAt = DateTime.UtcNow
        };
        await _context.ChatMessages.InsertOneAsync(assistantMessage);

        // Update session
        var sessionUpdate = Builders<ChatSession>.Update
            .Inc(s => s.TotalTokensUsed, actualTotalTokens)
            .Inc(s => s.MessageCount, 2) // User + Assistant
            .Set(s => s.LastMessageAt, DateTime.UtcNow)
            .Set(s => s.UpdatedAt, DateTime.UtcNow);

        // Update title if this is the first message
        if (session.MessageCount == 0)
        {
            var title = content.Length > 50 ? content.Substring(0, 47) + "..." : content;
            sessionUpdate = sessionUpdate.Set(s => s.Title, title);
        }

        await _context.ChatSessions.UpdateOneAsync(s => s.Id == sessionId, sessionUpdate);

        // Deduct tokens
        await _tokenService.DeductTokensAsync(userId, actualTotalTokens, session.ServiceType, session.Model, sessionId);

        // Get remaining balance
        var balance = await _tokenService.GetBalanceAsync(userId);

        _logger.LogDebug("Chat message processed: Session {SessionId}, Tokens used: {Tokens}, Time: {Time}ms", 
            sessionId, actualTotalTokens, processingTime);

        return new SendChatMessageResponse(
            assistantMessage.Id,
            response,
            actualTotalTokens,
            balance.Balance,
            processingTime
        );
    }

    public async Task ArchiveSessionAsync(string sessionId, uint userId)
    {
        var session = await GetSessionByIdAsync(sessionId);
        if (session == null || session.UserId != userId)
        {
            throw new KeyNotFoundException("Chat session not found");
        }

        var update = Builders<ChatSession>.Update
            .Set(s => s.IsArchived, true)
            .Set(s => s.UpdatedAt, DateTime.UtcNow);

        await _context.ChatSessions.UpdateOneAsync(s => s.Id == sessionId, update);
    }

    public async Task DeleteSessionAsync(string sessionId, uint userId)
    {
        var session = await GetSessionByIdAsync(sessionId);
        if (session == null || session.UserId != userId)
        {
            throw new KeyNotFoundException("Chat session not found");
        }

        // Delete all messages in session
        await _context.ChatMessages.DeleteManyAsync(m => m.SessionId == sessionId);

        // Delete session
        await _context.ChatSessions.DeleteOneAsync(s => s.Id == sessionId);

        _logger.LogInformation("Chat session deleted: {SessionId} by user {UserId}", sessionId, userId);
    }
}
