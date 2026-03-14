using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace FeatureService.Api.Infrastructure.Security;

public partial class SoftwareKeyManagementService
{
    /// <inheritdoc/>
    public Task<KeyMetadata> GenerateSymmetricKeyAsync(
        string keyId,
        SymmetricAlgorithmType algorithm,
        string purpose,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyId);
        ArgumentException.ThrowIfNullOrEmpty(purpose);

        if (_keyStore.ContainsKey(keyId))
        {
            throw new InvalidOperationException($"Key with ID '{keyId}' already exists");
        }

        // Determine key size based on algorithm
        int keySize = algorithm switch
        {
            SymmetricAlgorithmType.Aes128 => 16,
            SymmetricAlgorithmType.Aes192 => 24,
            SymmetricAlgorithmType.Aes256 or SymmetricAlgorithmType.Aes256Gcm => 32,
            SymmetricAlgorithmType.ChaCha20Poly1305 => 32,
            _ => throw new ArgumentException($"Unsupported algorithm: {algorithm}")
        };

        // Generate random key
        var keyMaterial = RandomNumberGenerator.GetBytes(keySize);

        try
        {
            // Wrap (encrypt) the key with master key
            var wrappedKey = WrapKeyMaterial(keyMaterial, keyId);

            var metadata = new KeyMetadata(
                KeyId: keyId,
                Algorithm: algorithm.ToString(),
                Purpose: purpose,
                State: KeyState.Enabled,
                CreatedAt: DateTime.UtcNow,
                ExpiresAt: null,
                RotatedAt: null,
                Version: 1,
                IsExportable: false,
                Provider: KeyManagementProvider.Software
            );

            var storedKey = new WrappedKey(wrappedKey, metadata, null);

            if (!_keyStore.TryAdd(keyId, storedKey))
            {
                throw new InvalidOperationException($"Failed to store key '{keyId}'");
            }

            _logger.LogInformation(
                "Generated symmetric key. KeyId: {KeyId}, Algorithm: {Algorithm}, Purpose: {Purpose}",
                keyId, algorithm, purpose);

            return Task.FromResult(metadata);
        }
        finally
        {
            // Clear key material from memory
            CryptographicOperations.ZeroMemory(keyMaterial);
        }
    }

    /// <inheritdoc/>
    public Task<AsymmetricKeyMetadata> GenerateAsymmetricKeyPairAsync(
        string keyId,
        AsymmetricAlgorithmType algorithm,
        string purpose,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyId);
        ArgumentException.ThrowIfNullOrEmpty(purpose);

        if (_keyStore.ContainsKey(keyId))
        {
            throw new InvalidOperationException($"Key with ID '{keyId}' already exists");
        }

        byte[] privateKey;
        byte[] publicKey;

        // Generate key pair based on algorithm
        switch (algorithm)
        {
            case AsymmetricAlgorithmType.EcP384:
                using (var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP384))
                {
                    privateKey = ecdsa.ExportPkcs8PrivateKey();
                    publicKey = ecdsa.ExportSubjectPublicKeyInfo();
                }
                break;

            case AsymmetricAlgorithmType.Ed25519:
                // Use BouncyCastle for Ed25519
                var ed25519Gen = new Org.BouncyCastle.Crypto.Generators.Ed25519KeyPairGenerator();
                ed25519Gen.Init(new Org.BouncyCastle.Crypto.Parameters.Ed25519KeyGenerationParameters(
                    new Org.BouncyCastle.Security.SecureRandom()));
                var ed25519Pair = ed25519Gen.GenerateKeyPair();

                privateKey = ((Org.BouncyCastle.Crypto.Parameters.Ed25519PrivateKeyParameters)ed25519Pair.Private).GetEncoded();
                publicKey = ((Org.BouncyCastle.Crypto.Parameters.Ed25519PublicKeyParameters)ed25519Pair.Public).GetEncoded();
                break;

            case AsymmetricAlgorithmType.Rsa4096:
                using (var rsa = RSA.Create(4096))
                {
                    privateKey = rsa.ExportPkcs8PrivateKey();
                    publicKey = rsa.ExportSubjectPublicKeyInfo();
                }
                break;

            default:
                throw new ArgumentException($"Unsupported algorithm: {algorithm}");
        }

        try
        {
            // Wrap private key
            var wrappedPrivateKey = WrapKeyMaterial(privateKey, keyId);

            var metadata = new AsymmetricKeyMetadata(
                KeyId: keyId,
                Algorithm: algorithm.ToString(),
                Purpose: purpose,
                State: KeyState.Enabled,
                CreatedAt: DateTime.UtcNow,
                ExpiresAt: null,
                RotatedAt: null,
                Version: 1,
                IsExportable: false,
                Provider: KeyManagementProvider.Software,
                PublicKey: publicKey
            );

            var storedKey = new WrappedKey(wrappedPrivateKey, metadata, publicKey);

            if (!_keyStore.TryAdd(keyId, storedKey))
            {
                throw new InvalidOperationException($"Failed to store key '{keyId}'");
            }

            _logger.LogInformation(
                "Generated asymmetric keypair. KeyId: {KeyId}, Algorithm: {Algorithm}",
                keyId, algorithm);

            return Task.FromResult(metadata);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(privateKey);
        }
    }

    /// <inheritdoc/>
    public Task<byte[]> WrapKeyAsync(
        string keyToWrapId,
        string wrappingKeyId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyToWrapId);
        ArgumentException.ThrowIfNullOrEmpty(wrappingKeyId);

        if (!_keyStore.TryGetValue(keyToWrapId, out var keyToWrap))
        {
            throw new KeyNotFoundException($"Key '{keyToWrapId}' not found");
        }

        if (!_keyStore.TryGetValue(wrappingKeyId, out var wrappingKey))
        {
            throw new KeyNotFoundException($"Wrapping key '{wrappingKeyId}' not found");
        }

        // Unwrap both keys
        var keyMaterial = UnwrapKeyMaterial(keyToWrap.WrappedKeyMaterial, keyToWrapId);
        var wrapperMaterial = UnwrapKeyMaterial(wrappingKey.WrappedKeyMaterial, wrappingKeyId);

        try
        {
            // Wrap key-to-wrap using wrapper key
            using var aesGcm = new AesGcm(wrapperMaterial, TagSize);

            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[keyMaterial.Length];
            var tag = new byte[TagSize];
            var aad = Encoding.UTF8.GetBytes($"wrap:{keyToWrapId}");

            aesGcm.Encrypt(nonce, keyMaterial, ciphertext, tag, aad);

            // Format: [nonce][tag][ciphertext]
            var wrapped = new byte[NonceSize + TagSize + ciphertext.Length];
            Buffer.BlockCopy(nonce, 0, wrapped, 0, NonceSize);
            Buffer.BlockCopy(tag, 0, wrapped, NonceSize, TagSize);
            Buffer.BlockCopy(ciphertext, 0, wrapped, NonceSize + TagSize, ciphertext.Length);

            return Task.FromResult(wrapped);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(keyMaterial);
            CryptographicOperations.ZeroMemory(wrapperMaterial);
        }
    }

    /// <inheritdoc/>
    public Task<KeyMetadata> UnwrapKeyAsync(
        byte[] wrappedKey,
        string unwrappingKeyId,
        string newKeyId,
        SymmetricAlgorithmType algorithm,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wrappedKey);
        ArgumentException.ThrowIfNullOrEmpty(unwrappingKeyId);
        ArgumentException.ThrowIfNullOrEmpty(newKeyId);

        if (_keyStore.ContainsKey(newKeyId))
        {
            throw new InvalidOperationException($"Key '{newKeyId}' already exists");
        }

        if (!_keyStore.TryGetValue(unwrappingKeyId, out var unwrappingKey))
        {
            throw new KeyNotFoundException($"Unwrapping key '{unwrappingKeyId}' not found");
        }

        var unwrapperMaterial = UnwrapKeyMaterial(unwrappingKey.WrappedKeyMaterial, unwrappingKeyId);

        try
        {
            // Extract nonce, tag, ciphertext
            var nonce = new byte[NonceSize];
            var tag = new byte[TagSize];
            var ciphertext = new byte[wrappedKey.Length - NonceSize - TagSize];

            Buffer.BlockCopy(wrappedKey, 0, nonce, 0, NonceSize);
            Buffer.BlockCopy(wrappedKey, NonceSize, tag, 0, TagSize);
            Buffer.BlockCopy(wrappedKey, NonceSize + TagSize, ciphertext, 0, ciphertext.Length);

            // Decrypt
            using var aesGcm = new AesGcm(unwrapperMaterial, TagSize);
            var keyMaterial = new byte[ciphertext.Length];
            var aad = Encoding.UTF8.GetBytes($"wrap:{newKeyId}");

            aesGcm.Decrypt(nonce, ciphertext, tag, keyMaterial, aad);

            // Store the unwrapped key (re-wrapped with master key)
            var reWrapped = WrapKeyMaterial(keyMaterial, newKeyId);

            var metadata = new KeyMetadata(
                KeyId: newKeyId,
                Algorithm: algorithm.ToString(),
                Purpose: "imported",
                State: KeyState.Enabled,
                CreatedAt: DateTime.UtcNow,
                ExpiresAt: null,
                RotatedAt: null,
                Version: 1,
                IsExportable: false,
                Provider: KeyManagementProvider.Software
            );

            _keyStore.TryAdd(newKeyId, new WrappedKey(reWrapped, metadata, null));

            CryptographicOperations.ZeroMemory(keyMaterial);

            return Task.FromResult(metadata);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(unwrapperMaterial);
        }
    }
}
