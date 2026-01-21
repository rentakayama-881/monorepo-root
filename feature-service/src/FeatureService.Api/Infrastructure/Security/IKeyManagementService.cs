namespace FeatureService.Api.Infrastructure.Security;

/// <summary>
/// Interface for cryptographic key management with HSM-ready abstraction.
///
/// This interface provides a unified API for key management operations that can be
/// implemented by either software-based storage or Hardware Security Module (HSM).
///
/// Architecture:
///
///                    ┌─────────────────────────┐
///                    │  IKeyManagementService  │
///                    └────────────┬────────────┘
///                                 │
///           ┌─────────────────────┼─────────────────────┐
///           │                     │                     │
///           ▼                     ▼                     ▼
///  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
///  │ SoftwareKMS    │   │ AWSCloudHSM    │   │ AzureKeyVault  │
///  │ (Development)  │   │ (Production)   │   │ (Alternative)  │
///  └────────────────┘   └────────────────┘   └────────────────┘
///
/// Key Hierarchy (NIST SP 800-57):
///
/// Level 1: Master Key (MEK - Master Encryption Key)
///   └─ Stored in HSM or encrypted in secure storage
///   └─ Never exported in plaintext
///   └─ Used only to wrap/unwrap DEKs
///
/// Level 2: Data Encryption Keys (DEK)
///   └─ Wrapped/encrypted by MEK
///   └─ Used for actual data encryption
///   └─ Can be rotated independently
///
/// Level 3: Session Keys
///   └─ Derived from DEKs or key exchange
///   └─ Short-lived, ephemeral
///
/// HSM Operations (PKCS#11 Model):
/// - C_GenerateKey: Create symmetric keys inside HSM
/// - C_GenerateKeyPair: Create asymmetric keys inside HSM
/// - C_WrapKey: Export key encrypted under another key
/// - C_UnwrapKey: Import encrypted key
/// - C_Sign/C_Verify: Signatures without exposing private key
/// - C_Encrypt/C_Decrypt: Encryption without exposing key
///
/// Compliance:
/// - FIPS 140-2 Level 3: HSM implementation
/// - FIPS 140-2 Level 1: Software implementation
/// - PCI-DSS: Key management requirements
/// </summary>
public interface IKeyManagementService
{
    /// <summary>
    /// Get the current key management provider type.
    /// </summary>
    KeyManagementProvider Provider { get; }

    /// <summary>
    /// Check if the key management service is properly initialized and operational.
    /// </summary>
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Generate a new symmetric key inside the key store.
    /// For HSM: Key never leaves the HSM boundary.
    /// For Software: Key is generated and encrypted with master key.
    /// </summary>
    /// <param name="keyId">Unique identifier for the key</param>
    /// <param name="algorithm">Algorithm (e.g., "AES-256", "AES-256-GCM")</param>
    /// <param name="purpose">Purpose of the key for audit</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Key metadata (not the actual key material)</returns>
    Task<KeyMetadata> GenerateSymmetricKeyAsync(
        string keyId,
        SymmetricAlgorithmType algorithm,
        string purpose,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generate a new asymmetric key pair inside the key store.
    /// For HSM: Private key never leaves the HSM boundary.
    /// </summary>
    /// <param name="keyId">Unique identifier for the key pair</param>
    /// <param name="algorithm">Algorithm (e.g., "RSA-4096", "EC-P384", "Dilithium3")</param>
    /// <param name="purpose">Purpose of the key for audit</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Key metadata including exportable public key</returns>
    Task<AsymmetricKeyMetadata> GenerateAsymmetricKeyPairAsync(
        string keyId,
        AsymmetricAlgorithmType algorithm,
        string purpose,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Encrypt data using a key stored in the key management system.
    /// For HSM: Encryption performed inside HSM.
    /// </summary>
    /// <param name="keyId">ID of the encryption key</param>
    /// <param name="plaintext">Data to encrypt</param>
    /// <param name="associatedData">Additional authenticated data (for AEAD)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Encrypted data with IV/nonce</returns>
    Task<EncryptedData> EncryptAsync(
        string keyId,
        byte[] plaintext,
        byte[]? associatedData = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Decrypt data using a key stored in the key management system.
    /// </summary>
    /// <param name="keyId">ID of the encryption key</param>
    /// <param name="encryptedData">Encrypted data with IV/nonce</param>
    /// <param name="associatedData">Additional authenticated data (must match encryption)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Decrypted plaintext</returns>
    Task<byte[]> DecryptAsync(
        string keyId,
        EncryptedData encryptedData,
        byte[]? associatedData = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sign data using a private key stored in the key management system.
    /// For HSM: Signing performed inside HSM, private key never exported.
    /// </summary>
    /// <param name="keyId">ID of the signing key</param>
    /// <param name="data">Data to sign</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Digital signature</returns>
    Task<byte[]> SignAsync(
        string keyId,
        byte[] data,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verify a signature using the public key.
    /// Can be performed outside HSM since public key is exportable.
    /// </summary>
    /// <param name="keyId">ID of the signing key pair</param>
    /// <param name="data">Original data</param>
    /// <param name="signature">Signature to verify</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if signature is valid</returns>
    Task<bool> VerifyAsync(
        string keyId,
        byte[] data,
        byte[] signature,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Wrap (encrypt) a key using another key.
    /// Used for key export and key hierarchy.
    /// </summary>
    /// <param name="keyToWrapId">ID of the key to be wrapped</param>
    /// <param name="wrappingKeyId">ID of the key encryption key (KEK)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Wrapped key material</returns>
    Task<byte[]> WrapKeyAsync(
        string keyToWrapId,
        string wrappingKeyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Unwrap (decrypt) a key and import it into the key store.
    /// </summary>
    /// <param name="wrappedKey">Wrapped key material</param>
    /// <param name="unwrappingKeyId">ID of the key encryption key (KEK)</param>
    /// <param name="newKeyId">ID to assign to the unwrapped key</param>
    /// <param name="algorithm">Algorithm of the wrapped key</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Key metadata of the imported key</returns>
    Task<KeyMetadata> UnwrapKeyAsync(
        byte[] wrappedKey,
        string unwrappingKeyId,
        string newKeyId,
        SymmetricAlgorithmType algorithm,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get metadata about a key without exposing key material.
    /// </summary>
    Task<KeyMetadata> GetKeyMetadataAsync(
        string keyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// List all keys in the key store.
    /// </summary>
    Task<IReadOnlyList<KeyMetadata>> ListKeysAsync(
        string? purposeFilter = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Schedule a key for deletion after a grace period.
    /// Most KMS implementations require a waiting period before actual deletion.
    /// </summary>
    Task ScheduleKeyDeletionAsync(
        string keyId,
        TimeSpan? gracePeriod = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancel a scheduled key deletion.
    /// </summary>
    Task CancelKeyDeletionAsync(
        string keyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Rotate a key by generating a new version while keeping the old version for decryption.
    /// </summary>
    Task<KeyMetadata> RotateKeyAsync(
        string keyId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Key management provider types
/// </summary>
public enum KeyManagementProvider
{
    /// <summary>
    /// Software-based key storage (encrypted at rest)
    /// FIPS 140-2 Level 1 compliant
    /// </summary>
    Software,

    /// <summary>
    /// AWS CloudHSM
    /// FIPS 140-2 Level 3 compliant
    /// </summary>
    AwsCloudHsm,

    /// <summary>
    /// AWS KMS (Key Management Service)
    /// FIPS 140-2 Level 2 compliant (Level 3 for some regions)
    /// </summary>
    AwsKms,

    /// <summary>
    /// Azure Key Vault
    /// FIPS 140-2 Level 2 compliant
    /// </summary>
    AzureKeyVault,

    /// <summary>
    /// Azure Dedicated HSM
    /// FIPS 140-2 Level 3 compliant
    /// </summary>
    AzureDedicatedHsm,

    /// <summary>
    /// Google Cloud HSM
    /// FIPS 140-2 Level 3 compliant
    /// </summary>
    GoogleCloudHsm,

    /// <summary>
    /// HashiCorp Vault
    /// Software or HSM backend
    /// </summary>
    HashiCorpVault,

    /// <summary>
    /// Thales Luna HSM (on-premises)
    /// FIPS 140-2 Level 3 compliant
    /// </summary>
    ThalesLunaHsm
}

/// <summary>
/// Supported symmetric encryption algorithms
/// </summary>
public enum SymmetricAlgorithmType
{
    Aes128,
    Aes192,
    Aes256,
    Aes256Gcm,
    ChaCha20Poly1305
}

/// <summary>
/// Supported asymmetric algorithms
/// </summary>
public enum AsymmetricAlgorithmType
{
    // Classical algorithms (quantum-vulnerable)
    Rsa2048,
    Rsa4096,
    EcP256,
    EcP384,
    Ed25519,

    // Post-quantum algorithms (quantum-resistant)
    Dilithium2,
    Dilithium3,
    Dilithium5,
    Kyber512,
    Kyber768,
    Kyber1024,

    // Hybrid algorithms
    HybridEd25519Dilithium3,
    HybridEcdhP384Kyber768
}

/// <summary>
/// Key metadata (no actual key material)
/// </summary>
public record KeyMetadata(
    string KeyId,
    string Algorithm,
    string Purpose,
    KeyState State,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    DateTime? RotatedAt,
    int Version,
    bool IsExportable,
    KeyManagementProvider Provider
);

/// <summary>
/// Asymmetric key metadata including exportable public key
/// </summary>
public record AsymmetricKeyMetadata(
    string KeyId,
    string Algorithm,
    string Purpose,
    KeyState State,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    DateTime? RotatedAt,
    int Version,
    bool IsExportable,
    KeyManagementProvider Provider,
    byte[] PublicKey
) : KeyMetadata(KeyId, Algorithm, Purpose, State, CreatedAt, ExpiresAt, RotatedAt, Version, IsExportable, Provider);

/// <summary>
/// Key lifecycle state
/// </summary>
public enum KeyState
{
    /// <summary>Key is being created</summary>
    Creating,

    /// <summary>Key is active and can be used</summary>
    Enabled,

    /// <summary>Key is disabled and cannot be used</summary>
    Disabled,

    /// <summary>Key is scheduled for deletion</summary>
    PendingDeletion,

    /// <summary>Key has been deleted</summary>
    Deleted
}

/// <summary>
/// Encrypted data container
/// </summary>
public record EncryptedData(
    byte[] Ciphertext,
    byte[] Iv,
    byte[] AuthTag,
    string KeyId,
    int KeyVersion
);
