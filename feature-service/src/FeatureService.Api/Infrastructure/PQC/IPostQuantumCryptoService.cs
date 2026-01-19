namespace FeatureService.Api.Infrastructure.PQC;

/// <summary>
/// Interface untuk Post-Quantum Cryptography operations.
/// Menggunakan ML-DSA (Dilithium) untuk tanda tangan digital.
/// </summary>
public interface IPostQuantumCryptoService
{
    /// <summary>
    /// Generate ML-DSA-65 (Dilithium3) keypair untuk tanda tangan digital
    /// </summary>
    /// <returns>Keypair dengan public dan private key</returns>
    PqcKeyPair GenerateKeyPair();
    
    /// <summary>
    /// Sign data menggunakan ML-DSA-65 (Dilithium3)
    /// </summary>
    /// <param name="data">Data yang akan di-sign</param>
    /// <param name="privateKey">Private key dalam format bytes</param>
    /// <returns>Signature result</returns>
    PqcSignature Sign(byte[] data, byte[] privateKey);
    
    /// <summary>
    /// Verifikasi tanda tangan ML-DSA-65
    /// </summary>
    /// <param name="data">Data asli yang di-sign</param>
    /// <param name="signature">Signature bytes</param>
    /// <param name="publicKey">Public key dalam format bytes</param>
    /// <returns>True jika signature valid</returns>
    bool Verify(byte[] data, byte[] signature, byte[] publicKey);
    
    /// <summary>
    /// Compute SHA-512 hash dari data
    /// </summary>
    /// <param name="data">Data yang akan di-hash</param>
    /// <returns>Hash bytes</returns>
    byte[] ComputeHash(byte[] data);
    
    /// <summary>
    /// Generate secure random bytes
    /// </summary>
    /// <param name="length">Jumlah bytes</param>
    /// <returns>Random bytes</returns>
    byte[] GenerateRandomBytes(int length);
}

/// <summary>
/// PQC Key Pair
/// </summary>
public record PqcKeyPair(
    byte[] PublicKey,
    byte[] PrivateKey,
    string Algorithm,
    string KeyId,
    DateTime GeneratedAt
);

/// <summary>
/// PQC Digital Signature
/// </summary>
public record PqcSignature(
    byte[] SignatureBytes,
    string Algorithm,
    DateTime SignedAt,
    string KeyId
);
