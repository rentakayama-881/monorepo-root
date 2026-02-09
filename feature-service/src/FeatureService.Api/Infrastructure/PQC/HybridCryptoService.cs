using System.Security.Cryptography;
using System.Text;
using Org.BouncyCastle.Crypto.Generators;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Org.BouncyCastle.Pqc.Crypto.Crystals.Dilithium;
using Org.BouncyCastle.Security;

namespace FeatureService.Api.Infrastructure.PQC;

/// <summary>
/// Hybrid Post-Quantum Cryptography Service
///
/// Combines classical cryptographic algorithms with post-quantum algorithms
/// to provide defense-in-depth security. This approach ensures:
///
/// 1. Backward Compatibility: Classical algorithms work with existing infrastructure
/// 2. Future-Proofing: PQC algorithms protect against quantum computer attacks
/// 3. Defense-in-Depth: If either algorithm family is broken, the other provides security
///
/// Current Implementation:
/// - Key Encapsulation: ECDH P-384 (classical only)
///   NOTE: Kyber/ML-KEM will be added when BouncyCastle library adds proper support
/// - Digital Signatures: Ed25519 + Dilithium3 (TRUE HYBRID - quantum resistant)
///
/// Mathematical Foundations:
///
/// CRYSTALS-Dilithium (ML-DSA) - NIST FIPS 204:
/// - Based on Module LWE and Module SIS (Short Integer Solution)
/// - Signature: s = H(μ || w) + c * e (mod q)
/// - Zero-knowledge property: transcript reveals nothing about secret key
/// - Post-quantum secure: 128-bit security level at Dilithium3
///
/// ECDH (Elliptic Curve Diffie-Hellman):
/// - Based on Discrete Logarithm Problem on elliptic curves
/// - Key exchange: K = [a]([b]G) = [b]([a]G) = [ab]G
/// - P-384 provides ~192-bit classical security
/// - Note: Vulnerable to Shor's algorithm (future quantum threat)
///
/// Ed25519:
/// - Based on Twisted Edwards curve over GF(2^255 - 19)
/// - Fast, constant-time, and deterministic signatures
/// - Combined with Dilithium for hybrid protection
///
/// Hybrid Key Derivation (HKDF - RFC 5869):
/// - Extract: PRK = HMAC-Hash(salt, IKM)
/// - Expand: OKM = T(1) || T(2) || ... || T(N)
/// - Where: T(i) = HMAC-Hash(PRK, T(i-1) || info || i)
///
/// Physics Context - Quantum Threat:
///
/// Shor's Algorithm:
/// - Complexity: O((log N)³) for factoring/discrete log
/// - Breaks RSA, ECDH, ECDSA, Ed25519
/// - Requires ~4000+ logical qubits for 2048-bit RSA
/// - Estimated timeline: 10-20 years (NIST recommendation: prepare now)
///
/// Grover's Algorithm:
/// - Provides √N speedup for brute force search
/// - Halves effective security: AES-256 becomes ~AES-128
/// - Solution: Use 256-bit symmetric keys (post-quantum 128-bit security)
///
/// Reference Standards:
/// - NIST FIPS 204 (ML-DSA/Dilithium)
/// - RFC 5869 (HKDF)
/// - RFC 8032 (Ed25519)
/// - NIST SP 800-56A Rev 3 (ECDH key agreement)
/// </summary>
public class HybridCryptoService : IHybridCryptoService
{
    private readonly ILogger<HybridCryptoService> _logger;
    private readonly SecureRandom _secureRandom;

    // Algorithm identifiers
    // Note: Using ECDH-P384 only for KEM until ML-KEM/Kyber is available in BouncyCastle
    private const string KemAlgorithm = "ECDH-P384";
    private const string SignatureAlgorithm = "Ed25519+Dilithium3";

    // HKDF parameters
    private static readonly byte[] DefaultSalt = Encoding.UTF8.GetBytes("aivalid-hybrid-v1-2026");
    private static readonly byte[] KemInfo = Encoding.UTF8.GetBytes("hybrid-kem-key-derivation");
    private const int SharedSecretLength = 48; // 384 bits for AES-256 + extra entropy

    public HybridCryptoService(ILogger<HybridCryptoService> logger)
    {
        _logger = logger;
        _secureRandom = new SecureRandom();
    }

    /// <inheritdoc/>
    public HybridKeyPair GenerateHybridKeyPair()
    {
        try
        {
            // Generate ECDH P-384 key pair
            // P-384 provides ~192-bit classical security
            // NIST SP 800-56A Rev 3 compliant
            using var ecdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP384);
            var ecdhPublicKey = ecdh.ExportSubjectPublicKeyInfo();
            var ecdhPrivateKey = ecdh.ExportPkcs8PrivateKey();

            // NOTE: Kyber/ML-KEM keys would be generated here once BouncyCastle adds support
            // For now, we use empty placeholder arrays for Kyber keys
            // The hybrid signature (Ed25519+Dilithium3) still provides post-quantum security for signatures
            var kyberPublicKey = Array.Empty<byte>();
            var kyberPrivateKey = Array.Empty<byte>();

            var keyId = GenerateKeyId(ecdhPublicKey, ecdhPublicKey);

            _logger.LogInformation(
                "Generated ECDH P-384 KEM keypair. KeyId: {KeyId}, ECDH: {EcdhSize}B",
                keyId, ecdhPublicKey.Length);

            return new HybridKeyPair(
                new HybridPublicKeys(ecdhPublicKey, kyberPublicKey),
                new HybridPrivateKeys(ecdhPrivateKey, kyberPrivateKey),
                KemAlgorithm,
                keyId,
                DateTime.UtcNow
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate KEM keypair");
            throw new CryptographicException("Failed to generate KEM keypair", ex);
        }
    }

    /// <inheritdoc/>
    public HybridSignatureKeyPair GenerateHybridSignatureKeyPair()
    {
        try
        {
            // Generate Ed25519 key pair using BouncyCastle for consistency
            var ed25519Gen = new Ed25519KeyPairGenerator();
            ed25519Gen.Init(new Ed25519KeyGenerationParameters(_secureRandom));
            var ed25519KeyPair = ed25519Gen.GenerateKeyPair();

            var ed25519PublicKey = ((Ed25519PublicKeyParameters)ed25519KeyPair.Public).GetEncoded();
            var ed25519PrivateKey = ((Ed25519PrivateKeyParameters)ed25519KeyPair.Private).GetEncoded();

            // Generate Dilithium3 key pair
            #pragma warning disable CS0618
            var dilithiumKeyGen = new DilithiumKeyPairGenerator();
            dilithiumKeyGen.Init(new DilithiumKeyGenerationParameters(_secureRandom, DilithiumParameters.Dilithium3));
            var dilithiumKeyPair = dilithiumKeyGen.GenerateKeyPair();

            var dilithiumPublicKey = ((DilithiumPublicKeyParameters)dilithiumKeyPair.Public).GetEncoded();
            var dilithiumPrivateKey = ((DilithiumPrivateKeyParameters)dilithiumKeyPair.Private).GetEncoded();
            #pragma warning restore CS0618

            var keyId = GenerateKeyId(ed25519PublicKey, dilithiumPublicKey);

            _logger.LogInformation(
                "Generated hybrid signature keypair. KeyId: {KeyId}, Ed25519: {EdSize}B, Dilithium: {DilSize}B",
                keyId, ed25519PublicKey.Length, dilithiumPublicKey.Length);

            return new HybridSignatureKeyPair(
                new HybridSignaturePublicKeys(ed25519PublicKey, dilithiumPublicKey),
                new HybridSignaturePrivateKeys(ed25519PrivateKey, dilithiumPrivateKey),
                SignatureAlgorithm,
                keyId,
                DateTime.UtcNow
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate hybrid signature keypair");
            throw new CryptographicException("Failed to generate hybrid signature keypair", ex);
        }
    }

    /// <inheritdoc/>
    public HybridEncapsulationResult Encapsulate(HybridPublicKeys recipientPublicKeys)
    {
        ArgumentNullException.ThrowIfNull(recipientPublicKeys);

        try
        {
            // ECDH key agreement (ephemeral-static pattern)
            // Generate ephemeral key pair and compute shared secret
            // Security: K_ecdh = [a]([b]G) where 'a' is ephemeral secret, 'b' is recipient secret
            using var ephemeralEcdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP384);
            var ephemeralPublicKey = ephemeralEcdh.ExportSubjectPublicKeyInfo();

            // Import recipient's public key
            using var recipientEcdh = ECDiffieHellman.Create();
            recipientEcdh.ImportSubjectPublicKeyInfo(recipientPublicKeys.EcdhPublicKey, out _);

            // Compute ECDH shared secret: K_ecdh = [a]([b]G)
            // Using DeriveKeyMaterial for raw ECDH output, then apply HKDF
            var ecdhSharedSecret = ephemeralEcdh.DeriveKeyMaterial(recipientEcdh.PublicKey);

            // NOTE: Kyber encapsulation would happen here once BouncyCastle adds support
            // For now, we derive the shared secret from ECDH only using HKDF
            // HKDF ensures proper key derivation even with single-source IKM
            var hybridSharedSecret = DeriveKey(ecdhSharedSecret, DefaultSalt, KemInfo, SharedSecretLength);

            // Clear intermediate secrets (defense in depth)
            CryptographicOperations.ZeroMemory(ecdhSharedSecret);

            _logger.LogDebug(
                "ECDH encapsulation complete. SharedSecret: {SecretSize}B",
                hybridSharedSecret.Length);

            return new HybridEncapsulationResult(
                hybridSharedSecret,
                new HybridCiphertext(ephemeralPublicKey, Array.Empty<byte>())
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to perform encapsulation");
            throw new CryptographicException("Failed to perform encapsulation", ex);
        }
    }

    /// <inheritdoc/>
    public byte[] Decapsulate(HybridCiphertext ciphertext, HybridPrivateKeys privateKeys)
    {
        ArgumentNullException.ThrowIfNull(ciphertext);
        ArgumentNullException.ThrowIfNull(privateKeys);

        try
        {
            // ECDH decapsulation
            // Import our private key
            using var recipientEcdh = ECDiffieHellman.Create();
            recipientEcdh.ImportPkcs8PrivateKey(privateKeys.EcdhPrivateKey, out _);

            // Import sender's ephemeral public key
            using var senderEcdh = ECDiffieHellman.Create();
            senderEcdh.ImportSubjectPublicKeyInfo(ciphertext.EcdhPublicKey, out _);

            // Compute ECDH shared secret: K_ecdh = [b]([a]G) = [ab]G
            // Using DeriveKeyMaterial for raw ECDH output, then apply HKDF
            var ecdhSharedSecret = recipientEcdh.DeriveKeyMaterial(senderEcdh.PublicKey);

            // NOTE: Kyber decapsulation would happen here once BouncyCastle adds support
            // Derive the shared secret using HKDF (must match encapsulation)
            var hybridSharedSecret = DeriveKey(ecdhSharedSecret, DefaultSalt, KemInfo, SharedSecretLength);

            // Clear intermediate secrets
            CryptographicOperations.ZeroMemory(ecdhSharedSecret);

            _logger.LogDebug("ECDH decapsulation complete. SharedSecret: {SecretSize}B", hybridSharedSecret.Length);

            return hybridSharedSecret;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to perform decapsulation");
            throw new CryptographicException("Failed to perform decapsulation", ex);
        }
    }

    /// <inheritdoc/>
    public HybridSignature Sign(byte[] data, HybridSignaturePrivateKeys privateKeys)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(privateKeys);

        try
        {
            // Hash the data first for consistency
            var dataHash = SHA512.HashData(data);

            // Ed25519 signature
            var ed25519PrivateKey = new Ed25519PrivateKeyParameters(privateKeys.Ed25519PrivateKey, 0);
            var ed25519Signer = new Ed25519Signer();
            ed25519Signer.Init(true, ed25519PrivateKey);
            ed25519Signer.BlockUpdate(dataHash, 0, dataHash.Length);
            var ed25519Signature = ed25519Signer.GenerateSignature();

            // Dilithium3 signature
            #pragma warning disable CS0618
            var dilithiumPrivateKey = new DilithiumPrivateKeyParameters(
                DilithiumParameters.Dilithium3,
                privateKeys.DilithiumPrivateKey,
                null);

            var dilithiumSigner = new DilithiumSigner();
            dilithiumSigner.Init(true, dilithiumPrivateKey);
            var dilithiumSignature = dilithiumSigner.GenerateSignature(dataHash);
            #pragma warning restore CS0618

            var keyId = GenerateKeyId(ed25519Signature[..8], dilithiumSignature[..8]);

            _logger.LogDebug(
                "Hybrid signature created. Ed25519: {EdSize}B, Dilithium: {DilSize}B",
                ed25519Signature.Length, dilithiumSignature.Length);

            return new HybridSignature(
                ed25519Signature,
                dilithiumSignature,
                SignatureAlgorithm,
                DateTime.UtcNow,
                keyId
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create hybrid signature");
            throw new CryptographicException("Failed to create hybrid signature", ex);
        }
    }

    /// <inheritdoc/>
    public bool Verify(byte[] data, HybridSignature signature, HybridSignaturePublicKeys publicKeys)
    {
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(signature);
        ArgumentNullException.ThrowIfNull(publicKeys);

        try
        {
            // Hash the data first
            var dataHash = SHA512.HashData(data);

            // Verify Ed25519 signature
            var ed25519PublicKey = new Ed25519PublicKeyParameters(publicKeys.Ed25519PublicKey, 0);
            var ed25519Signer = new Ed25519Signer();
            ed25519Signer.Init(false, ed25519PublicKey);
            ed25519Signer.BlockUpdate(dataHash, 0, dataHash.Length);
            var ed25519Valid = ed25519Signer.VerifySignature(signature.Ed25519Signature);

            if (!ed25519Valid)
            {
                _logger.LogWarning("Ed25519 signature verification failed");
                return false;
            }

            // Verify Dilithium signature
            #pragma warning disable CS0618
            var dilithiumPublicKey = new DilithiumPublicKeyParameters(
                DilithiumParameters.Dilithium3,
                publicKeys.DilithiumPublicKey);

            var dilithiumSigner = new DilithiumSigner();
            dilithiumSigner.Init(false, dilithiumPublicKey);
            var dilithiumValid = dilithiumSigner.VerifySignature(dataHash, signature.DilithiumSignature);
            #pragma warning restore CS0618

            if (!dilithiumValid)
            {
                _logger.LogWarning("Dilithium signature verification failed");
                return false;
            }

            _logger.LogDebug("Hybrid signature verification successful");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Hybrid signature verification failed with exception");
            return false;
        }
    }

    /// <inheritdoc/>
    public byte[] DeriveKey(byte[] inputKeyMaterial, byte[] salt, byte[] info, int outputLength)
    {
        ArgumentNullException.ThrowIfNull(inputKeyMaterial);

        // Use HKDF-SHA384 for key derivation (RFC 5869)
        // SHA-384 provides 192-bit security margin
        return HKDF.DeriveKey(
            HashAlgorithmName.SHA384,
            inputKeyMaterial,
            outputLength,
            salt ?? DefaultSalt,
            info ?? KemInfo);
    }

    /// <summary>
    /// Combine two secrets by concatenation for HKDF input.
    ///
    /// Security Note:
    /// Concatenation is safe when followed by HKDF extraction.
    /// HKDF ensures uniform distribution regardless of input structure.
    /// </summary>
    private static byte[] CombineSecrets(byte[] secret1, byte[] secret2)
    {
        var combined = new byte[secret1.Length + secret2.Length];
        Buffer.BlockCopy(secret1, 0, combined, 0, secret1.Length);
        Buffer.BlockCopy(secret2, 0, combined, secret1.Length, secret2.Length);
        return combined;
    }

    /// <summary>
    /// Generate a unique key identifier from public key material.
    /// Uses first 16 bytes of SHA-256 hash as fingerprint.
    /// </summary>
    private static string GenerateKeyId(byte[] publicKey1, byte[] publicKey2)
    {
        var combined = CombineSecrets(publicKey1, publicKey2);
        var hash = SHA256.HashData(combined);
        return Convert.ToHexString(hash[..8]).ToLowerInvariant();
    }
}
