namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Entity untuk menyimpan PQC public key milik user.
/// Private key disimpan di device user, hanya public key yang disimpan di server.
/// </summary>
public class UserPqcKey
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// User ID dari Go backend
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Username untuk reference
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Key ID untuk identifikasi (derived dari public key hash)
    /// </summary>
    public string KeyId { get; set; } = string.Empty;

    /// <summary>
    /// Public key dalam format Base64
    /// </summary>
    public string PublicKeyBase64 { get; set; } = string.Empty;

    /// <summary>
    /// Algorithm yang digunakan (Dilithium3 / ML-DSA-65 class)
    /// </summary>
    public string Algorithm { get; set; } = "Dilithium3";

    /// <summary>
    /// SHA-256 hash dari public key untuk quick lookup
    /// </summary>
    public string PublicKeyHash { get; set; } = string.Empty;

    /// <summary>
    /// Device fingerprint dimana key di-generate
    /// </summary>
    public string? DeviceFingerprint { get; set; }

    /// <summary>
    /// Apakah key ini aktif (belum di-revoke)
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Waktu key di-register
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Waktu key di-revoke (jika ada)
    /// </summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>
    /// Alasan revoke (jika ada)
    /// </summary>
    public string? RevokeReason { get; set; }

    /// <summary>
    /// Terakhir digunakan untuk signing
    /// </summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>
    /// Jumlah kali digunakan untuk signing
    /// </summary>
    public long UsageCount { get; set; }
}
