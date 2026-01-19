using System.Security.Cryptography;
using Org.BouncyCastle.Pqc.Crypto.Crystals.Dilithium;
using Org.BouncyCastle.Security;

namespace FeatureService.Api.Infrastructure.PQC;

/// <summary>
/// Implementasi Post-Quantum Cryptography menggunakan BouncyCastle.
/// Menggunakan CRYSTALS-Dilithium3 (basis dari ML-DSA-65) - NIST Level 3 security.
/// </summary>
public class PostQuantumCryptoService : IPostQuantumCryptoService
{
    private readonly ILogger<PostQuantumCryptoService> _logger;
    private readonly SecureRandom _secureRandom;
    
    // Dilithium3 parameters (NIST Level 3, equivalent to ML-DSA-65)
    private const string Algorithm = "Dilithium3";
    
    public PostQuantumCryptoService(ILogger<PostQuantumCryptoService> logger)
    {
        _logger = logger;
        _secureRandom = new SecureRandom();
    }

    /// <inheritdoc/>
    public PqcKeyPair GenerateKeyPair()
    {
        try
        {
            #pragma warning disable CS0618 // Suppress obsolete warning - ML-DSA not yet fully available
            var keyGenParams = new DilithiumKeyGenerationParameters(_secureRandom, DilithiumParameters.Dilithium3);
            var keyPairGenerator = new DilithiumKeyPairGenerator();
            keyPairGenerator.Init(keyGenParams);
            
            var keyPair = keyPairGenerator.GenerateKeyPair();
            
            var dilithiumPublicKey = (DilithiumPublicKeyParameters)keyPair.Public;
            var dilithiumPrivateKey = (DilithiumPrivateKeyParameters)keyPair.Private;
            
            var publicKey = dilithiumPublicKey.GetEncoded();
            var privateKey = dilithiumPrivateKey.GetEncoded();
            #pragma warning restore CS0618
            
            var keyId = GenerateKeyId(publicKey);
            
            _logger.LogInformation(
                "Generated Dilithium3 keypair. KeyId: {KeyId}, PublicKey size: {PubSize} bytes",
                keyId, publicKey.Length);

            return new PqcKeyPair(
                publicKey,
                privateKey,
                Algorithm,
                keyId,
                DateTime.UtcNow
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate Dilithium3 keypair");
            throw new CryptographicException("Failed to generate PQC keypair", ex);
        }
    }

    /// <inheritdoc/>
    public PqcSignature Sign(byte[] data, byte[] privateKey)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(privateKey);

        try
        {
            #pragma warning disable CS0618
            // Reconstruct private key from encoded bytes
            var privateKeyParams = new DilithiumPrivateKeyParameters(
                DilithiumParameters.Dilithium3, 
                privateKey, 
                null // public key encoding - optional for signing
            );
            
            var signer = new DilithiumSigner();
            signer.Init(true, privateKeyParams);
            
            var signature = signer.GenerateSignature(data);
            #pragma warning restore CS0618
            
            var keyId = GenerateKeyId(privateKey[..Math.Min(32, privateKey.Length)]);

            _logger.LogDebug(
                "Created Dilithium3 signature. DataSize: {DataSize}, SignatureSize: {SigSize}",
                data.Length, signature.Length);

            return new PqcSignature(
                signature,
                Algorithm,
                DateTime.UtcNow,
                keyId
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sign data with Dilithium3");
            throw new CryptographicException("Failed to create PQC signature", ex);
        }
    }

    /// <inheritdoc/>
    public bool Verify(byte[] data, byte[] signature, byte[] publicKey)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(signature);
        ArgumentNullException.ThrowIfNull(publicKey);

        try
        {
            #pragma warning disable CS0618
            var publicKeyParams = new DilithiumPublicKeyParameters(DilithiumParameters.Dilithium3, publicKey);
            var signer = new DilithiumSigner();
            signer.Init(false, publicKeyParams);
            
            var isValid = signer.VerifySignature(data, signature);
            #pragma warning restore CS0618

            _logger.LogDebug(
                "Verified Dilithium3 signature. Valid: {IsValid}, DataSize: {DataSize}",
                isValid, data.Length);

            return isValid;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Signature verification failed");
            return false;
        }
    }

    /// <inheritdoc/>
    public byte[] ComputeHash(byte[] data)
    {
        ArgumentNullException.ThrowIfNull(data);
        return SHA512.HashData(data);
    }

    /// <inheritdoc/>
    public byte[] GenerateRandomBytes(int length)
    {
        if (length <= 0)
            throw new ArgumentException("Length must be positive", nameof(length));
            
        var bytes = new byte[length];
        _secureRandom.NextBytes(bytes);
        return bytes;
    }

    /// <summary>
    /// Generate Key ID dari public key bytes
    /// </summary>
    private static string GenerateKeyId(byte[] keyBytes)
    {
        var hash = SHA256.HashData(keyBytes);
        return $"pqc_{Convert.ToHexString(hash[..8]).ToLowerInvariant()}";
    }
}
