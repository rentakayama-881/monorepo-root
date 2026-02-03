using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.DTOs;

/// <summary>
/// Request untuk mendaftarkan PQC public key
/// </summary>
public class RegisterPqcKeyRequest
{
    /// <summary>
    /// Public key dalam format Base64 (Dilithium3)
    /// </summary>
    [Required]
    [MinLength(100, ErrorMessage = "Public key terlalu pendek")]
    [MaxLength(5000, ErrorMessage = "Public key terlalu panjang")]
    public string PublicKeyBase64 { get; set; } = string.Empty;

    /// <summary>
    /// Device fingerprint untuk tracking (opsional)
    /// </summary>
    [MaxLength(256)]
    public string? DeviceFingerprint { get; set; }
}

/// <summary>
/// Response untuk PQC key operations
/// </summary>
public class PqcKeyResponse
{
    /// <summary>
    /// Key ID untuk referensi
    /// </summary>
    public string KeyId { get; set; } = string.Empty;

    /// <summary>
    /// User ID pemilik key
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Username pemilik
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Algorithm yang digunakan
    /// </summary>
    public string Algorithm { get; set; } = string.Empty;

    /// <summary>
    /// Public key dalam format Base64
    /// </summary>
    public string PublicKeyBase64 { get; set; } = string.Empty;

    /// <summary>
    /// Status key (aktif/revoked)
    /// </summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Waktu pendaftaran key
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Waktu revoke (jika sudah di-revoke)
    /// </summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>
    /// Jumlah kali key digunakan
    /// </summary>
    public long UsageCount { get; set; }

    /// <summary>
    /// Terakhir digunakan
    /// </summary>
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>
/// Request untuk revoke PQC key
/// </summary>
public class RevokePqcKeyRequest
{
    /// <summary>
    /// Alasan revoke
    /// </summary>
    [Required]
    [MinLength(10, ErrorMessage = "Alasan revoke harus minimal 10 karakter")]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Response untuk generate key pair (untuk development/testing)
/// </summary>
public class GenerateKeyPairResponse
{
    /// <summary>
    /// Public key dalam format Base64
    /// </summary>
    public string PublicKeyBase64 { get; set; } = string.Empty;

    /// <summary>
    /// Private key dalam format Base64 (SIMPAN DI CLIENT, JANGAN KIRIM KE SERVER!)
    /// </summary>
    public string PrivateKeyBase64 { get; set; } = string.Empty;

    /// <summary>
    /// Algorithm yang digunakan
    /// </summary>
    public string Algorithm { get; set; } = string.Empty;

    /// <summary>
    /// Key ID
    /// </summary>
    public string KeyId { get; set; } = string.Empty;

    /// <summary>
    /// Waktu generate
    /// </summary>
    public DateTime GeneratedAt { get; set; }
}
