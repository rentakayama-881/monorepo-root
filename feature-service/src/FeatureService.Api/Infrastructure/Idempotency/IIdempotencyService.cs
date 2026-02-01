namespace FeatureService.Api.Infrastructure.Idempotency;

/// <summary>
/// Service untuk memastikan transaksi tidak dieksekusi dua kali.
/// Menggunakan Redis untuk distributed locking.
/// </summary>
public interface IIdempotencyService
{
    /// <summary>
    /// Mencoba mengakuisisi lock idempotency untuk operasi tertentu.
    /// </summary>
    /// <param name="idempotencyKey">Unique key untuk operasi</param>
    /// <param name="lockDuration">Durasi lock</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Result yang menunjukkan status akuisisi</returns>
    Task<IdempotencyResult> TryAcquireAsync(
        string idempotencyKey,
        TimeSpan lockDuration,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Menyimpan hasil operasi yang sukses untuk idempotency.
    /// </summary>
    /// <typeparam name="T">Tipe hasil</typeparam>
    /// <param name="idempotencyKey">Key yang sama dengan TryAcquire</param>
    /// <param name="result">Hasil yang akan disimpan</param>
    /// <param name="ttl">Time-to-live untuk hasil</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task StoreResultAsync<T>(
        string idempotencyKey,
        T result,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Mengambil hasil operasi yang sudah pernah dieksekusi.
    /// </summary>
    /// <typeparam name="T">Tipe hasil</typeparam>
    /// <param name="idempotencyKey">Key idempotency</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Hasil tersimpan atau null jika tidak ada</returns>
    Task<T?> GetStoredResultAsync<T>(
        string idempotencyKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Release lock jika operasi gagal (tidak menyimpan hasil).
    /// </summary>
    /// <param name="idempotencyKey">Key idempotency</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task ReleaseAsync(
        string idempotencyKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generate idempotency key baru.
    /// </summary>
    /// <param name="prefix">Prefix untuk key (misal: "transfer", "withdrawal")</param>
    /// <returns>Generated idempotency key</returns>
    string GenerateKey(string prefix);
}

/// <summary>
/// Hasil dari TryAcquire operation
/// </summary>
public record IdempotencyResult(
    bool Acquired,
    
    bool AlreadyProcessed,
    
    string? StoredResultJson
);
