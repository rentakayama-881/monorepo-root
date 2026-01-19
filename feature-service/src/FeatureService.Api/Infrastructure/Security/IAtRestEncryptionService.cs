namespace FeatureService.Api.Infrastructure.Security;

/// <summary>
/// Interface untuk enkripsi data sensitif saat disimpan (At-Rest encryption).
/// Menggunakan AES-256-GCM dengan authenticated encryption.
/// </summary>
public interface IAtRestEncryptionService
{
    /// <summary>
    /// Encrypt bytes dengan authenticated encryption.
    /// </summary>
    /// <param name="plaintext">Data yang akan dienkripsi</param>
    /// <param name="associatedData">Data tambahan untuk authentication (tidak dienkripsi tapi di-verify)</param>
    /// <returns>Encrypted data dengan nonce dan tag</returns>
    byte[] Encrypt(byte[] plaintext, byte[] associatedData);

    /// <summary>
    /// Decrypt bytes dengan verification.
    /// </summary>
    /// <param name="ciphertext">Data terenkripsi</param>
    /// <param name="associatedData">Associated data yang sama saat encrypt</param>
    /// <returns>Decrypted data</returns>
    /// <exception cref="System.Security.Cryptography.CryptographicException">Jika verification gagal</exception>
    byte[] Decrypt(byte[] ciphertext, byte[] associatedData);

    /// <summary>
    /// Encrypt string dengan context.
    /// </summary>
    /// <param name="plaintext">String yang akan dienkripsi</param>
    /// <param name="context">Context string untuk associated data (misal: "user_123_pin")</param>
    /// <returns>Base64-encoded encrypted string</returns>
    string EncryptString(string plaintext, string context);

    /// <summary>
    /// Decrypt string dengan context.
    /// </summary>
    /// <param name="ciphertext">Base64-encoded encrypted string</param>
    /// <param name="context">Context string yang sama saat encrypt</param>
    /// <returns>Decrypted string</returns>
    string DecryptString(string ciphertext, string context);

    /// <summary>
    /// Generate encryption key baru (untuk key rotation).
    /// </summary>
    /// <returns>Base64-encoded 256-bit key</returns>
    string GenerateKey();
}
