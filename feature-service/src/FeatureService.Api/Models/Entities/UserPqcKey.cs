using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Entity untuk menyimpan PQC public key milik user.
/// Private key disimpan di device user, hanya public key yang disimpan di server.
/// </summary>
[BsonIgnoreExtraElements]
public class UserPqcKey
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// User ID dari Go backend
    /// </summary>
    [BsonElement("userId")]
    public uint UserId { get; set; }

    /// <summary>
    /// Username untuk reference
    /// </summary>
    [BsonElement("username")]
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Key ID untuk identifikasi (derived dari public key hash)
    /// </summary>
    [BsonElement("keyId")]
    public string KeyId { get; set; } = string.Empty;

    /// <summary>
    /// Public key dalam format Base64
    /// </summary>
    [BsonElement("publicKeyBase64")]
    public string PublicKeyBase64 { get; set; } = string.Empty;

    /// <summary>
    /// Algorithm yang digunakan (Dilithium3 / ML-DSA-65 class)
    /// </summary>
    [BsonElement("algorithm")]
    public string Algorithm { get; set; } = "Dilithium3";

    /// <summary>
    /// SHA-256 hash dari public key untuk quick lookup
    /// </summary>
    [BsonElement("publicKeyHash")]
    public string PublicKeyHash { get; set; } = string.Empty;

    /// <summary>
    /// Device fingerprint dimana key di-generate
    /// </summary>
    [BsonElement("deviceFingerprint")]
    public string? DeviceFingerprint { get; set; }

    /// <summary>
    /// Apakah key ini aktif (belum di-revoke)
    /// </summary>
    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Waktu key di-register
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Waktu key di-revoke (jika ada)
    /// </summary>
    [BsonElement("revokedAt")]
    public DateTime? RevokedAt { get; set; }

    /// <summary>
    /// Alasan revoke (jika ada)
    /// </summary>
    [BsonElement("revokeReason")]
    public string? RevokeReason { get; set; }

    /// <summary>
    /// Terakhir digunakan untuk signing
    /// </summary>
    [BsonElement("lastUsedAt")]
    public DateTime? LastUsedAt { get; set; }

    /// <summary>
    /// Jumlah kali digunakan untuk signing
    /// </summary>
    [BsonElement("usageCount")]
    public long UsageCount { get; set; }
}
