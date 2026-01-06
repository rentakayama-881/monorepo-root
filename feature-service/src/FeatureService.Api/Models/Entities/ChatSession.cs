using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents an AI chat session.
/// Stores conversation history for context.
/// </summary>
public class ChatSession
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // cht_xxx format using Ulid

    /// <summary>
    /// User ID
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Chat service type: huggingface, external_llm
    /// </summary>
    [BsonElement("serviceType")]
    public string ServiceType { get; set; } = string.Empty;

    /// <summary>
    /// Model used (for external LLM)
    /// </summary>
    [BsonElement("model")]
    public string? Model { get; set; }

    /// <summary>
    /// Session title (auto-generated from first message)
    /// </summary>
    [BsonElement("title")]
    public string Title { get; set; } = "New Chat";

    /// <summary>
    /// Total tokens used in this session
    /// </summary>
    [BsonElement("totalTokensUsed")]
    public long TotalTokensUsed { get; set; } = 0;

    /// <summary>
    /// Message count
    /// </summary>
    [BsonElement("messageCount")]
    public int MessageCount { get; set; } = 0;

    /// <summary>
    /// Last message timestamp
    /// </summary>
    [BsonElement("lastMessageAt")]
    public DateTime? LastMessageAt { get; set; }

    /// <summary>
    /// Whether the session is archived
    /// </summary>
    [BsonElement("isArchived")]
    public bool IsArchived { get; set; } = false;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Represents a single message in a chat session.
/// </summary>
public class ChatMessage
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // msg_xxx format using Ulid

    /// <summary>
    /// Chat session ID
    /// </summary>
    [BsonElement("sessionId")]
    public string SessionId { get; set; } = string.Empty;

    /// <summary>
    /// User ID
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Message role: user, assistant, system
    /// </summary>
    [BsonElement("role")]
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// Message content
    /// </summary>
    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Tokens used for this message
    /// </summary>
    [BsonElement("tokensUsed")]
    public int TokensUsed { get; set; } = 0;

    /// <summary>
    /// Processing time in milliseconds
    /// </summary>
    [BsonElement("processingTimeMs")]
    public int? ProcessingTimeMs { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Chat service types
/// </summary>
public static class ChatServiceType
{
    public const string HuggingFace = "huggingface";
    public const string ExternalLlm = "external_llm";

    public static readonly string[] All = { HuggingFace, ExternalLlm };
}

/// <summary>
/// Message roles
/// </summary>
public static class MessageRole
{
    public const string User = "user";
    public const string Assistant = "assistant";
    public const string System = "system";
}

/// <summary>
/// Available external LLM models (from n8n provider)
/// </summary>
public static class ExternalLlmModels
{
    // String constants for model IDs
    public const string Gpt4o = "gpt-4o";
    public const string Gpt4oMini = "gpt-4o-mini";
    public const string Claude35Sonnet = "claude-3-5-sonnet";
    public const string Claude35Haiku = "claude-3-5-haiku";
    public const string GeminiPro = "gemini-pro";
    public const string GeminiFlash = "gemini-flash";
    public const string DeepseekV3 = "deepseek-v3";
    public const string Llama370b = "llama-3-70b";
    public const string MistralLarge = "mistral-large";

    public static readonly LlmModel[] All = new[]
    {
        new LlmModel(Gpt4o, "GPT-4o", "OpenAI's most capable model", 5, 15),
        new LlmModel(Gpt4oMini, "GPT-4o Mini", "Faster, more affordable GPT-4", 1, 3),
        new LlmModel(Claude35Sonnet, "Claude 3.5 Sonnet", "Anthropic's balanced model", 3, 15),
        new LlmModel(Claude35Haiku, "Claude 3.5 Haiku", "Fast and efficient", 1, 5),
        new LlmModel(GeminiPro, "Gemini Pro", "Google's advanced model", 2, 8),
        new LlmModel(GeminiFlash, "Gemini Flash", "Fast Gemini variant", 1, 4),
        new LlmModel(DeepseekV3, "Deepseek V3", "Powerful coding-focused model", 2, 6),
        new LlmModel(Llama370b, "Llama 3 70B", "Meta's open model", 1, 4),
        new LlmModel(MistralLarge, "Mistral Large", "Mistral's flagship", 2, 6),
    };

    /// <summary>
    /// All model IDs as strings
    /// </summary>
    public static readonly string[] AllIds = All.Select(m => m.Id).ToArray();

    public static LlmModel? GetById(string id) => All.FirstOrDefault(m => m.Id == id);
}

/// <summary>
/// LLM model definition
/// </summary>
/// <param name="Id">Model identifier</param>
/// <param name="Name">Display name</param>
/// <param name="Description">Short description</param>
/// <param name="InputTokenCost">Cost per 1000 input tokens</param>
/// <param name="OutputTokenCost">Cost per 1000 output tokens</param>
public record LlmModel(string Id, string Name, string Description, int InputTokenCost, int OutputTokenCost);
