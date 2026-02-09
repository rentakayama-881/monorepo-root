using System.Security.Cryptography;
using System.Text;

namespace FeatureService.Api.Infrastructure.Security;

/// <summary>
/// HKDF-based Key Derivation Service implementing RFC 5869.
///
/// This service provides cryptographically secure key derivation using
/// HMAC-based Extract-and-Expand Key Derivation Function (HKDF).
///
/// Mathematical Foundation:
///
/// HKDF-Extract(salt, IKM) -> PRK
///   PRK = HMAC-SHA384(salt, IKM)
///
/// HKDF-Expand(PRK, info, L) -> OKM
///   N = ceil(L/HashLen)
///   T = T(1) || T(2) || ... || T(N)
///   OKM = first L octets of T
///
///   where:
///   T(0) = empty string
///   T(i) = HMAC-SHA384(PRK, T(i-1) || info || i)
///
/// Security Analysis:
///
/// 1. Entropy Preservation:
///    If IKM has min-entropy ≥ k bits, PRK is computationally
///    indistinguishable from random with probability 2^(-k)
///
/// 2. Independence:
///    Keys derived with different 'info' values are independent
///    (no information leakage between derived keys)
///
/// 3. Quantum Security:
///    HKDF based on SHA-384 provides ~192-bit security against
///    Grover's algorithm (quantum brute force)
///
/// Design Decisions:
/// - SHA-384 chosen for balance of security and performance
/// - Default salt length = 48 bytes (hash output length)
/// - Salt is optional but HIGHLY recommended for production
///
/// Reference: RFC 5869 - HMAC-based Extract-and-Expand Key Derivation Function
/// Authors: Hugo Krawczyk, Pasi Eronen (2010)
/// </summary>
public class KeyDerivationService : IKeyDerivationService
{
    private readonly ILogger<KeyDerivationService> _logger;

    // SHA-384 produces 48-byte (384-bit) output
    private const int HashLength = 48;

    // Default info strings for common purposes
    private static readonly byte[] EncryptionInfo = Encoding.UTF8.GetBytes("aivalid-encryption-key-v1");
    private static readonly byte[] MacInfo = Encoding.UTF8.GetBytes("aivalid-mac-key-v1");

    public KeyDerivationService(ILogger<KeyDerivationService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc/>
    public byte[] DeriveKey(byte[] inputKeyMaterial, byte[]? salt, byte[] info, int outputLength)
    {
        ArgumentNullException.ThrowIfNull(inputKeyMaterial);
        ArgumentNullException.ThrowIfNull(info);

        if (inputKeyMaterial.Length == 0)
        {
            throw new ArgumentException("Input key material cannot be empty", nameof(inputKeyMaterial));
        }

        if (outputLength <= 0)
        {
            throw new ArgumentException("Output length must be positive", nameof(outputLength));
        }

        // Maximum output length is 255 * HashLen (per RFC 5869)
        int maxOutputLength = 255 * HashLength;
        if (outputLength > maxOutputLength)
        {
            throw new ArgumentException(
                $"Output length cannot exceed {maxOutputLength} bytes",
                nameof(outputLength));
        }

        // Warn if input key material seems low entropy
        if (inputKeyMaterial.Length < 16)
        {
            _logger.LogWarning(
                "Input key material is only {Length} bytes. Recommend at least 16 bytes for adequate entropy.",
                inputKeyMaterial.Length);
        }

        // Use .NET's built-in HKDF which implements RFC 5869
        // The .NET implementation handles both Extract and Expand phases
        var derivedKey = HKDF.DeriveKey(
            HashAlgorithmName.SHA384,
            inputKeyMaterial,
            outputLength,
            salt ?? Array.Empty<byte>(),
            info);

        _logger.LogDebug(
            "Derived {OutputLength}-byte key using HKDF-SHA384. Salt: {HasSalt}, Info: {InfoLength}B",
            outputLength, salt != null, info.Length);

        return derivedKey;
    }

    /// <inheritdoc/>
    public Dictionary<string, byte[]> DeriveMultipleKeys(
        byte[] inputKeyMaterial,
        byte[]? salt,
        IEnumerable<(string info, int length)> keyDefinitions)
    {
        ArgumentNullException.ThrowIfNull(inputKeyMaterial);
        ArgumentNullException.ThrowIfNull(keyDefinitions);

        var result = new Dictionary<string, byte[]>();

        // First, extract the PRK (Pseudorandom Key) once
        // This is more efficient than calling HKDF.DeriveKey multiple times
        var prk = HKDF.Extract(
            HashAlgorithmName.SHA384,
            inputKeyMaterial,
            salt ?? Array.Empty<byte>());

        try
        {
            foreach (var (info, length) in keyDefinitions)
            {
                if (string.IsNullOrEmpty(info))
                {
                    throw new ArgumentException("Key info cannot be null or empty");
                }

                var infoBytes = Encoding.UTF8.GetBytes(info);
                var derivedKey = HKDF.Expand(
                    HashAlgorithmName.SHA384,
                    prk,
                    length,
                    infoBytes);

                result[info] = derivedKey;
            }

            _logger.LogDebug("Derived {Count} keys using HKDF-SHA384", result.Count);

            return result;
        }
        finally
        {
            // Clear the PRK from memory
            CryptographicOperations.ZeroMemory(prk);
        }
    }

    /// <inheritdoc/>
    public (byte[] encryptionKey, byte[] macKey) DeriveEncryptionAndMacKeys(byte[] secret, byte[]? salt)
    {
        ArgumentNullException.ThrowIfNull(secret);

        // Extract PRK once
        var prk = HKDF.Extract(
            HashAlgorithmName.SHA384,
            secret,
            salt ?? Array.Empty<byte>());

        try
        {
            // Derive 256-bit encryption key for AES-256
            var encryptionKey = HKDF.Expand(
                HashAlgorithmName.SHA384,
                prk,
                32,  // 256 bits
                EncryptionInfo);

            // Derive 256-bit MAC key for HMAC-SHA256
            var macKey = HKDF.Expand(
                HashAlgorithmName.SHA384,
                prk,
                32,  // 256 bits
                MacInfo);

            _logger.LogDebug("Derived encryption and MAC keys from shared secret");

            return (encryptionKey, macKey);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(prk);
        }
    }

    /// <inheritdoc/>
    public byte[] DeriveAes256Key(byte[] inputKeyMaterial, byte[]? salt, string purpose)
    {
        ArgumentNullException.ThrowIfNull(inputKeyMaterial);
        ArgumentException.ThrowIfNullOrEmpty(purpose);

        // Create purpose-specific info with version prefix
        var info = Encoding.UTF8.GetBytes($"aivalid-aes256-{purpose}-v1");

        return DeriveKey(inputKeyMaterial, salt, info, 32);  // 256 bits for AES-256
    }

    /// <inheritdoc/>
    public (byte[] derivedKey, byte[] salt) DeriveKeyWithGeneratedSalt(
        byte[] inputKeyMaterial,
        byte[] info,
        int outputLength)
    {
        ArgumentNullException.ThrowIfNull(inputKeyMaterial);
        ArgumentNullException.ThrowIfNull(info);

        // Generate cryptographically random salt
        // Using hash length (48 bytes) as recommended by RFC 5869
        var salt = RandomNumberGenerator.GetBytes(HashLength);

        var derivedKey = DeriveKey(inputKeyMaterial, salt, info, outputLength);

        return (derivedKey, salt);
    }
}
