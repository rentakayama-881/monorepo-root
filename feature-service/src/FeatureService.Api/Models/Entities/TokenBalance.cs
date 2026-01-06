using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a user's AI token balance.
/// Tokens are purchased with wallet balance and used for AI chat services.
/// </summary>
public class TokenBalance
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // tkn_xxx format using Ulid

    /// <summary>
    /// User ID
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Current token balance
    /// </summary>
    [BsonElement("balance")]
    public long Balance { get; set; } = 0;

    /// <summary>
    /// Total tokens ever purchased
    /// </summary>
    [BsonElement("totalPurchased")]
    public long TotalPurchased { get; set; } = 0;

    /// <summary>
    /// Total tokens ever used
    /// </summary>
    [BsonElement("totalUsed")]
    public long TotalUsed { get; set; } = 0;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Represents a token purchase transaction
/// </summary>
public class TokenPurchase
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // tpu_xxx format using Ulid

    /// <summary>
    /// User ID
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Package purchased
    /// </summary>
    [BsonElement("packageId")]
    public string PackageId { get; set; } = string.Empty;

    /// <summary>
    /// Amount paid in IDR
    /// </summary>
    [BsonElement("amountPaid")]
    public long AmountPaid { get; set; }

    /// <summary>
    /// Tokens received
    /// </summary>
    [BsonElement("tokensReceived")]
    public long TokensReceived { get; set; }

    /// <summary>
    /// Wallet transaction ID reference
    /// </summary>
    [BsonElement("walletTransactionId")]
    public string? WalletTransactionId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Represents a token usage record for AI services
/// </summary>
public class TokenUsage
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // tus_xxx format using Ulid

    /// <summary>
    /// User ID
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Service used: huggingface, external_llm
    /// </summary>
    [BsonElement("service")]
    public string Service { get; set; } = string.Empty;

    /// <summary>
    /// Model used (for external LLM)
    /// </summary>
    [BsonElement("model")]
    public string? Model { get; set; }

    /// <summary>
    /// Chat session ID
    /// </summary>
    [BsonElement("chatSessionId")]
    public string? ChatSessionId { get; set; }

    /// <summary>
    /// Input tokens consumed
    /// </summary>
    [BsonElement("inputTokens")]
    public int InputTokens { get; set; }

    /// <summary>
    /// Output tokens consumed
    /// </summary>
    [BsonElement("outputTokens")]
    public int OutputTokens { get; set; }

    /// <summary>
    /// Total tokens consumed
    /// </summary>
    [BsonElement("totalTokens")]
    public int TotalTokens { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Token package definitions
/// </summary>
public static class TokenPackages
{
    public static readonly TokenPackage[] All = new[]
    {
        new TokenPackage("pkg_10k", "Starter", 10_000, 100),
        new TokenPackage("pkg_25k", "Basic", 25_000, 300),
        new TokenPackage("pkg_50k", "Standard", 50_000, 700),
        new TokenPackage("pkg_100k", "Plus", 100_000, 1_600),
        new TokenPackage("pkg_250k", "Pro", 250_000, 4_500),
        new TokenPackage("pkg_500k", "Enterprise", 500_000, 10_000),
    };

    public static TokenPackage? GetById(string id) => All.FirstOrDefault(p => p.Id == id);
}

/// <summary>
/// Token package definition
/// </summary>
public record TokenPackage(string Id, string Name, long PriceIdr, long TokenAmount);
