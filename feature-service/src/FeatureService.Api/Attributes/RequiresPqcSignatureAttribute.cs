namespace FeatureService.Api.Attributes;

/// <summary>
/// Attribute untuk menandai endpoint yang memerlukan PQC signature verification.
/// Endpoint dengan attribute ini akan memvalidasi header X-PQC-Signature dan X-PQC-Key-Id.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequiresPqcSignatureAttribute : Attribute
{
    /// <summary>
    /// Apakah body request dimasukkan dalam data yang di-sign
    /// </summary>
    public bool IncludeBody { get; set; } = true;

    /// <summary>
    /// Apakah timestamp divalidasi (untuk mencegah replay attack)
    /// </summary>
    public bool ValidateTimestamp { get; set; } = true;

    /// <summary>
    /// Apakah header X-Idempotency-Key wajib ada dan ikut di-sign.
    /// Sangat direkomendasikan untuk semua operasi finansial yang mengubah state,
    /// agar request replay tidak bisa mengeksekusi transaksi lebih dari sekali.
    /// </summary>
    public bool RequireIdempotencyKey { get; set; } = false;

    /// <summary>
    /// Maximum age of timestamp dalam detik (default 5 menit)
    /// </summary>
    public int MaxTimestampAgeSeconds { get; set; } = 300;
}
