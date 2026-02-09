namespace FeatureService.Api.Infrastructure.Security;

/// <summary>
/// Interface for HKDF-based key derivation.
/// Implements RFC 5869 HMAC-based Extract-and-Expand Key Derivation Function.
///
/// Mathematical Foundation (RFC 5869):
///
/// HKDF consists of two stages:
///
/// 1. Extract: Condenses input key material into a fixed-length pseudorandom key (PRK)
///    PRK = HMAC-Hash(salt, IKM)
///
///    Where:
///    - IKM = Input Keying Material (possibly low-entropy or non-uniform)
///    - salt = Optional random value (recommended to be hash-length)
///    - PRK = Pseudorandom Key (hash-length, uniformly distributed)
///
/// 2. Expand: Expands PRK into arbitrary-length output keying material (OKM)
///    T(0) = empty string
///    T(1) = HMAC-Hash(PRK, T(0) || info || 0x01)
///    T(2) = HMAC-Hash(PRK, T(1) || info || 0x02)
///    ...
///    T(N) = HMAC-Hash(PRK, T(N-1) || info || N)
///    OKM = first L octets of T(1) || T(2) || ... || T(N)
///
///    Where:
///    - info = Optional context/application-specific information
///    - L = Desired output length in octets
///    - N = ceil(L/HashLen)
///
/// Security Properties:
/// - PRK is computationally indistinguishable from random if IKM has sufficient entropy
/// - OKM segments are independent when using different 'info' values
/// - Salt provides domain separation between applications
///
/// Use Cases in AIValid:
/// - Deriving per-purpose keys from master key (encryption key, MAC key, etc.)
/// - Key rotation: derive new keys from old keys + rotation context
/// - Hybrid crypto: combining classical + PQC shared secrets
/// </summary>
public interface IKeyDerivationService
{
    /// <summary>
    /// Derive a key using HKDF-SHA384.
    ///
    /// SHA-384 provides:
    /// - 384-bit output (48 bytes)
    /// - 192-bit security level against collision attacks
    /// - Suitable for deriving keys up to 384 bits
    /// </summary>
    /// <param name="inputKeyMaterial">The source key material (must have sufficient entropy)</param>
    /// <param name="salt">Random value for domain separation (null = all-zeros)</param>
    /// <param name="info">Context/purpose identifier (e.g., "encryption-key")</param>
    /// <param name="outputLength">Desired output length in bytes (max: 255 * HashLen)</param>
    /// <returns>Derived key of specified length</returns>
    byte[] DeriveKey(byte[] inputKeyMaterial, byte[]? salt, byte[] info, int outputLength);

    /// <summary>
    /// Derive multiple keys from the same input material using different contexts.
    /// More efficient than calling DeriveKey multiple times.
    /// </summary>
    /// <param name="inputKeyMaterial">The source key material</param>
    /// <param name="salt">Random value for domain separation</param>
    /// <param name="keyDefinitions">List of (info, length) tuples defining keys to derive</param>
    /// <returns>Dictionary mapping info strings to derived keys</returns>
    Dictionary<string, byte[]> DeriveMultipleKeys(
        byte[] inputKeyMaterial,
        byte[]? salt,
        IEnumerable<(string info, int length)> keyDefinitions);

    /// <summary>
    /// Derive an encryption key and MAC key from a single password/secret.
    ///
    /// This is a common pattern for authenticated encryption where you need
    /// separate keys for encryption and authentication.
    ///
    /// Formula:
    /// enc_key = HKDF(secret, salt, "encryption", 32)
    /// mac_key = HKDF(secret, salt, "authentication", 32)
    /// </summary>
    /// <param name="secret">The shared secret or password-derived key</param>
    /// <param name="salt">Domain separation salt</param>
    /// <returns>Tuple of (encryption key, MAC key)</returns>
    (byte[] encryptionKey, byte[] macKey) DeriveEncryptionAndMacKeys(byte[] secret, byte[]? salt);

    /// <summary>
    /// Derive a key specifically for AES-256-GCM encryption.
    /// Returns a 32-byte key suitable for AES-256.
    /// </summary>
    byte[] DeriveAes256Key(byte[] inputKeyMaterial, byte[]? salt, string purpose);

    /// <summary>
    /// Derive a key with automatic salt generation.
    /// Returns both the derived key and the salt used.
    /// Salt should be stored alongside the derived data for later derivation.
    /// </summary>
    (byte[] derivedKey, byte[] salt) DeriveKeyWithGeneratedSalt(
        byte[] inputKeyMaterial,
        byte[] info,
        int outputLength);
}
