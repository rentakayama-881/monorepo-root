using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace FeatureService.Api.Infrastructure.Security;

/// <summary>
/// Software-based Key Management Service implementation.
///
/// This is a development/staging implementation that stores keys encrypted in memory.
/// For production with high security requirements, use an HSM-backed implementation.
///
/// Security Model:
/// - Master Key (MEK) loaded from environment/configuration
/// - All stored keys wrapped (encrypted) using MEK with AES-256-GCM
/// - Keys never stored in plaintext in memory (wrapped storage)
/// - Signing operations unwrap key, use it, and clear from memory
///
/// FIPS 140-2 Level 1 Compliant:
/// - Uses NIST-approved algorithms (AES-256-GCM, SHA-384)
/// - No hardware boundary, but follows secure coding practices
///
/// Limitations (compared to HSM):
/// - MEK exists in process memory (vulnerable to memory dump attacks)
/// - No hardware tamper protection
/// - No hardware-based random number generation
/// - Keys can be extracted if attacker has full memory access
///
/// Production Recommendations:
/// 1. Use environment variable or secure secret manager for MEK
/// 2. Implement key rotation policy
/// 3. Monitor for unauthorized key access patterns
/// 4. Consider migrating to cloud KMS (AWS KMS, Azure Key Vault) for cost-effective security
/// 5. For high-value keys (signing keys, master keys), use dedicated HSM
/// </summary>
public partial class SoftwareKeyManagementService : IKeyManagementService
{
    private readonly ILogger<SoftwareKeyManagementService> _logger;
    private readonly IKeyDerivationService _keyDerivation;
    private readonly byte[] _masterKey;

    // In-memory encrypted key storage
    // In production, this would be backed by a database with encrypted storage
    private readonly ConcurrentDictionary<string, WrappedKey> _keyStore = new();

    private const int NonceSize = 12;   // 96 bits for GCM
    private const int TagSize = 16;     // 128 bits for auth tag
    private const int Aes256KeySize = 32; // 256 bits

    public KeyManagementProvider Provider => KeyManagementProvider.Software;

    public SoftwareKeyManagementService(
        IConfiguration configuration,
        ILogger<SoftwareKeyManagementService> logger,
        IKeyDerivationService keyDerivation)
    {
        _logger = logger;
        _keyDerivation = keyDerivation;

        // Load master key from configuration
        var masterKeyBase64 = configuration["Security:MasterEncryptionKey"];

        if (string.IsNullOrEmpty(masterKeyBase64))
        {
            _logger.LogWarning(
                "Master encryption key not configured. Generating ephemeral key. " +
                "THIS IS ONLY ACCEPTABLE FOR DEVELOPMENT!");

            _masterKey = RandomNumberGenerator.GetBytes(32);
        }
        else
        {
            _masterKey = Convert.FromBase64String(masterKeyBase64);

            if (_masterKey.Length != 32)
            {
                throw new InvalidOperationException(
                    $"Master key must be 256 bits (32 bytes). Got {_masterKey.Length * 8} bits.");
            }
        }
    }

    /// <inheritdoc/>
    public Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        // Software KMS is always "healthy" if initialized
        // Could add additional checks like master key validation
        return Task.FromResult(_masterKey.Length == 32);
    }

    /// <inheritdoc/>
    public Task<EncryptedData> EncryptAsync(
        string keyId,
        byte[] plaintext,
        byte[]? associatedData = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyId);
        ArgumentNullException.ThrowIfNull(plaintext);

        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        if (wrappedKey.Metadata.State != KeyState.Enabled)
        {
            throw new InvalidOperationException($"Key '{keyId}' is not enabled");
        }

        // Unwrap the key
        var keyMaterial = UnwrapKeyMaterial(wrappedKey.WrappedKeyMaterial, keyId);

        try
        {
            // Encrypt with AES-256-GCM
            using var aesGcm = new AesGcm(keyMaterial, TagSize);

            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[plaintext.Length];
            var tag = new byte[TagSize];

            aesGcm.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);

            return Task.FromResult(new EncryptedData(
                Ciphertext: ciphertext,
                Iv: nonce,
                AuthTag: tag,
                KeyId: keyId,
                KeyVersion: wrappedKey.Metadata.Version
            ));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(keyMaterial);
        }
    }

    /// <inheritdoc/>
    public Task<byte[]> DecryptAsync(
        string keyId,
        EncryptedData encryptedData,
        byte[]? associatedData = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyId);
        ArgumentNullException.ThrowIfNull(encryptedData);

        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        // Unwrap the key
        var keyMaterial = UnwrapKeyMaterial(wrappedKey.WrappedKeyMaterial, keyId);

        try
        {
            using var aesGcm = new AesGcm(keyMaterial, TagSize);

            var plaintext = new byte[encryptedData.Ciphertext.Length];

            aesGcm.Decrypt(
                encryptedData.Iv,
                encryptedData.Ciphertext,
                encryptedData.AuthTag,
                plaintext,
                associatedData);

            return Task.FromResult(plaintext);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(keyMaterial);
        }
    }

    /// <inheritdoc/>
    public Task<byte[]> SignAsync(
        string keyId,
        byte[] data,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyId);
        ArgumentNullException.ThrowIfNull(data);

        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        if (wrappedKey.Metadata.State != KeyState.Enabled)
        {
            throw new InvalidOperationException($"Key '{keyId}' is not enabled");
        }

        var keyMaterial = UnwrapKeyMaterial(wrappedKey.WrappedKeyMaterial, keyId);

        try
        {
            // Sign based on algorithm
            if (wrappedKey.Metadata.Algorithm.Contains("Ed25519"))
            {
                var privateKey = new Org.BouncyCastle.Crypto.Parameters.Ed25519PrivateKeyParameters(keyMaterial, 0);
                var signer = new Org.BouncyCastle.Crypto.Signers.Ed25519Signer();
                signer.Init(true, privateKey);
                signer.BlockUpdate(data, 0, data.Length);
                return Task.FromResult(signer.GenerateSignature());
            }
            else if (wrappedKey.Metadata.Algorithm.Contains("P384"))
            {
                using var ecdsa = ECDsa.Create();
                ecdsa.ImportPkcs8PrivateKey(keyMaterial, out _);
                return Task.FromResult(ecdsa.SignData(data, HashAlgorithmName.SHA384));
            }
            else
            {
                throw new NotSupportedException($"Signing not supported for {wrappedKey.Metadata.Algorithm}");
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(keyMaterial);
        }
    }

    /// <inheritdoc/>
    public Task<bool> VerifyAsync(
        string keyId,
        byte[] data,
        byte[] signature,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyId);
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(signature);

        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        if (wrappedKey.PublicKey == null)
        {
            throw new InvalidOperationException($"Key '{keyId}' does not have a public key");
        }

        // Verify using public key (no need to unwrap private key)
        if (wrappedKey.Metadata.Algorithm.Contains("Ed25519"))
        {
            var publicKey = new Org.BouncyCastle.Crypto.Parameters.Ed25519PublicKeyParameters(wrappedKey.PublicKey, 0);
            var verifier = new Org.BouncyCastle.Crypto.Signers.Ed25519Signer();
            verifier.Init(false, publicKey);
            verifier.BlockUpdate(data, 0, data.Length);
            return Task.FromResult(verifier.VerifySignature(signature));
        }
        else if (wrappedKey.Metadata.Algorithm.Contains("P384"))
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(wrappedKey.PublicKey, out _);
            return Task.FromResult(ecdsa.VerifyData(data, signature, HashAlgorithmName.SHA384));
        }

        throw new NotSupportedException($"Verification not supported for {wrappedKey.Metadata.Algorithm}");
    }

    /// <summary>
    /// Wrap key material using the master key and HKDF-derived context key.
    /// </summary>
    private byte[] WrapKeyMaterial(byte[] keyMaterial, string keyId)
    {
        // Derive a unique wrapping key for this key ID
        var info = Encoding.UTF8.GetBytes($"key-wrap:{keyId}");
        var wrappingKey = _keyDerivation.DeriveKey(_masterKey, null, info, Aes256KeySize);

        try
        {
            using var aesGcm = new AesGcm(wrappingKey, TagSize);

            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[keyMaterial.Length];
            var tag = new byte[TagSize];

            aesGcm.Encrypt(nonce, keyMaterial, ciphertext, tag);

            // Format: [nonce][tag][ciphertext]
            var wrapped = new byte[NonceSize + TagSize + ciphertext.Length];
            Buffer.BlockCopy(nonce, 0, wrapped, 0, NonceSize);
            Buffer.BlockCopy(tag, 0, wrapped, NonceSize, TagSize);
            Buffer.BlockCopy(ciphertext, 0, wrapped, NonceSize + TagSize, ciphertext.Length);

            return wrapped;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(wrappingKey);
        }
    }

    /// <summary>
    /// Unwrap key material using the master key and HKDF-derived context key.
    /// </summary>
    private byte[] UnwrapKeyMaterial(byte[] wrappedKey, string keyId)
    {
        // Derive the same wrapping key
        var info = Encoding.UTF8.GetBytes($"key-wrap:{keyId}");
        var wrappingKey = _keyDerivation.DeriveKey(_masterKey, null, info, Aes256KeySize);

        try
        {
            var nonce = new byte[NonceSize];
            var tag = new byte[TagSize];
            var ciphertext = new byte[wrappedKey.Length - NonceSize - TagSize];

            Buffer.BlockCopy(wrappedKey, 0, nonce, 0, NonceSize);
            Buffer.BlockCopy(wrappedKey, NonceSize, tag, 0, TagSize);
            Buffer.BlockCopy(wrappedKey, NonceSize + TagSize, ciphertext, 0, ciphertext.Length);

            using var aesGcm = new AesGcm(wrappingKey, TagSize);
            var keyMaterial = new byte[ciphertext.Length];

            aesGcm.Decrypt(nonce, ciphertext, tag, keyMaterial);

            return keyMaterial;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(wrappingKey);
        }
    }

    /// <summary>
    /// Internal wrapped key storage
    /// </summary>
    private record WrappedKey(byte[] WrappedKeyMaterial, KeyMetadata Metadata, byte[]? PublicKey);
}
