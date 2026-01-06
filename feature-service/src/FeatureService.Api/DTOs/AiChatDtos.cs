namespace FeatureService.Api.DTOs;

// ================== Token Balance DTOs ==================

/// <summary>
/// User's token balance info
/// </summary>
public record TokenBalanceDto(
    long Balance,
    long TotalPurchased,
    long TotalUsed
);

/// <summary>
/// Available token packages
/// </summary>
public record TokenPackageDto(
    string Id,
    string Name,
    int TokenAmount,
    int PriceIdr,
    int BonusTokens,
    string Description
);

/// <summary>
/// Request to purchase tokens
/// </summary>
public record PurchaseTokensRequest(string PackageId);

/// <summary>
/// Response after purchasing tokens
/// </summary>
public record PurchaseTokensResponse(
    string TransactionId,
    long TokensPurchased,
    long NewBalance,
    string Message
);

/// <summary>
/// Token usage history item
/// </summary>
public record TokenUsageDto(
    string Id,
    string Service,
    string? Model,
    int InputTokens,
    int OutputTokens,
    int TotalTokens,
    DateTime CreatedAt
);

/// <summary>
/// Token usage history response
/// </summary>
public record TokenUsageHistoryResponse(
    List<TokenUsageDto> Usage,
    int TotalCount,
    string? Cursor
);

/// <summary>
/// Token purchase history item
/// </summary>
public record TokenPurchaseDto(
    string Id,
    string PackageName,
    long AmountPaid,
    long TokensReceived,
    DateTime CreatedAt
);

/// <summary>
/// Token purchase history response
/// </summary>
public record TokenPurchaseHistoryResponse(
    List<TokenPurchaseDto> Purchases,
    int TotalCount
);

// ================== AI Chat DTOs ==================

/// <summary>
/// Available LLM models for selection
/// </summary>
public record LlmModelDto(
    string Id,
    string Name,
    string Description,
    int InputTokenCost,  // per 1000 tokens
    int OutputTokenCost  // per 1000 tokens
);

/// <summary>
/// Chat session summary
/// </summary>
public record ChatSessionSummaryDto(
    string Id,
    string ServiceType,
    string? Model,
    string Title,
    long TotalTokensUsed,
    int MessageCount,
    DateTime? LastMessageAt,
    DateTime CreatedAt
);

/// <summary>
/// Chat message
/// </summary>
public record ChatMessageDto(
    string Id,
    string Role,
    string Content,
    int TokensUsed,
    DateTime CreatedAt
);

/// <summary>
/// Full chat session with messages
/// </summary>
public record ChatSessionDetailDto(
    string Id,
    string ServiceType,
    string? Model,
    string Title,
    long TotalTokensUsed,
    List<ChatMessageDto> Messages,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>
/// Request to create new chat session
/// </summary>
public record CreateChatSessionRequest(
    string ServiceType,  // huggingface, external_llm
    string? Model        // Required for external_llm
);

/// <summary>
/// Response after creating chat session
/// </summary>
public record CreateChatSessionResponse(
    string SessionId,
    string ServiceType,
    string? Model
);

/// <summary>
/// Request to send a chat message
/// </summary>
public record SendChatMessageRequest(
    string Message
);

/// <summary>
/// Response after sending a chat message
/// </summary>
public record SendChatMessageResponse(
    string MessageId,
    string Content,
    int TokensUsed,
    long RemainingBalance,
    int ProcessingTimeMs
);

/// <summary>
/// User's chat sessions list
/// </summary>
public record ChatSessionsResponse(
    List<ChatSessionSummaryDto> Sessions,
    int TotalCount
);

/// <summary>
/// AI service health/availability
/// </summary>
public record AiServiceStatusDto(
    string Service,
    bool Available,
    string? Message
);
