using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a user's wallet with their balance and PIN status.
/// This is a mutable aggregate derived from the immutable TransactionLedger.
/// </summary>
public class UserWallet
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty; // wlt_xxx format using Ulid

    /// <summary>
    /// UserID from the Go backend (PostgreSQL User table)
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Current balance in IDR (smallest unit - Rupiah)
    /// This is calculated from the ledger entries
    /// </summary>
    [BsonElement("balance")]
    public long Balance { get; set; } = 0;

    /// <summary>
    /// Hashed PIN using PBKDF2 with 310,000 iterations
    /// </summary>
    [BsonElement("pinHash")]
    public string? PinHash { get; set; }

    /// <summary>
    /// Indicates whether the user has set up their PIN
    /// </summary>
    [BsonElement("pinSet")]
    public bool PinSet { get; set; } = false;

    /// <summary>
    /// Number of failed PIN verification attempts (for rate limiting)
    /// Max 4 attempts before lock
    /// </summary>
    [BsonElement("failedPinAttempts")]
    public int FailedPinAttempts { get; set; } = 0;

    /// <summary>
    /// Timestamp when PIN was locked due to too many failed attempts (4 attempts = 4 hours lock)
    /// </summary>
    [BsonElement("pinLockedUntil")]
    public DateTime? PinLockedUntil { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
