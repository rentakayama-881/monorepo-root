using System.Security.Cryptography;

namespace FeatureService.Api.Infrastructure.PQC;

/// <summary>
/// Interface for Hybrid Post-Quantum Cryptography operations.
/// Combines classical algorithms (ECDH, Ed25519) with post-quantum algorithms (Kyber, Dilithium)
/// for defense-in-depth security that remains secure even if one algorithm family is broken.
///
/// Mathematical Foundation:
/// - Hybrid Key: K_shared = HKDF(K_classical || K_pqc)
/// - Provides security guarantee: min(classical_security, pqc_security)
///
/// NIST Recommendations:
/// - Use hybrid schemes during transition period to post-quantum cryptography
/// - Ensures backward compatibility while providing quantum resistance
/// </summary>
public interface IHybridCryptoService
{
    /// <summary>
    /// Generate a hybrid key pair combining ECDH-P384 and Kyber768.
    ///
    /// Security Levels:
    /// - ECDH P-384: ~192-bit classical security
    /// - Kyber768: NIST Level 3 (~128-bit post-quantum security)
    /// </summary>
    HybridKeyPair GenerateHybridKeyPair();

    /// <summary>
    /// Generate a hybrid signature key pair combining Ed25519 and Dilithium3.
    ///
    /// Security Levels:
    /// - Ed25519: ~128-bit classical security
    /// - Dilithium3: NIST Level 3 (~128-bit post-quantum security)
    /// </summary>
    HybridSignatureKeyPair GenerateHybridSignatureKeyPair();

    /// <summary>
    /// Perform hybrid key encapsulation using both ECDH and Kyber.
    ///
    /// Mathematical Formula:
    /// K_shared = HKDF-SHA384(K_ecdh || K_kyber, salt="alephdraad-hybrid-v1", info="key-encapsulation")
    /// </summary>
    /// <param name="recipientPublicKeys">Recipient's hybrid public keys</param>
    /// <returns>Shared secret and ciphertext for decapsulation</returns>
    HybridEncapsulationResult Encapsulate(HybridPublicKeys recipientPublicKeys);

    /// <summary>
    /// Perform hybrid key decapsulation using both ECDH and Kyber.
    /// </summary>
    /// <param name="ciphertext">The encapsulation ciphertext</param>
    /// <param name="privateKeys">Recipient's private keys</param>
    /// <returns>The shared secret</returns>
    byte[] Decapsulate(HybridCiphertext ciphertext, HybridPrivateKeys privateKeys);

    /// <summary>
    /// Create a hybrid signature using both Ed25519 and Dilithium3.
    ///
    /// The signature is valid only if BOTH signatures verify.
    /// This prevents attacks on either algorithm from compromising authenticity.
    /// </summary>
    /// <param name="data">Data to sign</param>
    /// <param name="privateKeys">Hybrid private keys</param>
    /// <returns>Hybrid signature containing both classical and PQC signatures</returns>
    HybridSignature Sign(byte[] data, HybridSignaturePrivateKeys privateKeys);

    /// <summary>
    /// Verify a hybrid signature using both Ed25519 and Dilithium3.
    /// Returns true only if BOTH signatures are valid.
    /// </summary>
    /// <param name="data">Original data that was signed</param>
    /// <param name="signature">The hybrid signature</param>
    /// <param name="publicKeys">Hybrid public keys</param>
    /// <returns>True if both signatures verify</returns>
    bool Verify(byte[] data, HybridSignature signature, HybridSignaturePublicKeys publicKeys);

    /// <summary>
    /// Derive a key using HKDF with the specified parameters.
    ///
    /// Based on RFC 5869:
    /// PRK = HMAC-Hash(salt, IKM)
    /// OKM = HMAC-Hash(PRK, T(i-1) || info || i)
    /// </summary>
    byte[] DeriveKey(byte[] inputKeyMaterial, byte[] salt, byte[] info, int outputLength);
}

/// <summary>
/// Hybrid key pair for key encapsulation (ECDH + Kyber)
/// </summary>
public record HybridKeyPair(
    HybridPublicKeys PublicKeys,
    HybridPrivateKeys PrivateKeys,
    string Algorithm,
    string KeyId,
    DateTime GeneratedAt
);

/// <summary>
/// Hybrid public keys
/// </summary>
public record HybridPublicKeys(
    byte[] EcdhPublicKey,
    byte[] KyberPublicKey
);

/// <summary>
/// Hybrid private keys
/// </summary>
public record HybridPrivateKeys(
    byte[] EcdhPrivateKey,
    byte[] KyberPrivateKey
);

/// <summary>
/// Hybrid signature key pair (Ed25519 + Dilithium3)
/// </summary>
public record HybridSignatureKeyPair(
    HybridSignaturePublicKeys PublicKeys,
    HybridSignaturePrivateKeys PrivateKeys,
    string Algorithm,
    string KeyId,
    DateTime GeneratedAt
);

/// <summary>
/// Hybrid signature public keys
/// </summary>
public record HybridSignaturePublicKeys(
    byte[] Ed25519PublicKey,
    byte[] DilithiumPublicKey
);

/// <summary>
/// Hybrid signature private keys
/// </summary>
public record HybridSignaturePrivateKeys(
    byte[] Ed25519PrivateKey,
    byte[] DilithiumPrivateKey
);

/// <summary>
/// Result of hybrid key encapsulation
/// </summary>
public record HybridEncapsulationResult(
    byte[] SharedSecret,
    HybridCiphertext Ciphertext
);

/// <summary>
/// Hybrid ciphertext containing both ECDH and Kyber components
/// </summary>
public record HybridCiphertext(
    byte[] EcdhPublicKey,  // Ephemeral public key for ECDH
    byte[] KyberCiphertext  // Kyber encapsulation
);

/// <summary>
/// Hybrid signature containing both classical and PQC signatures
/// </summary>
public record HybridSignature(
    byte[] Ed25519Signature,
    byte[] DilithiumSignature,
    string Algorithm,
    DateTime SignedAt,
    string KeyId
);
