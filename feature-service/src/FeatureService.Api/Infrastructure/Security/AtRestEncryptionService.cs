using System.Security.Cryptography;
using System.Text;

namespace FeatureService.Api.Infrastructure.Security;

/// <summary>
/// Implementasi enkripsi at-rest menggunakan AES-256-GCM.
/// Menyediakan authenticated encryption untuk data sensitif.
/// </summary>
public class AtRestEncryptionService : IAtRestEncryptionService
{
    private readonly byte[] _masterKey;
    private readonly ILogger<AtRestEncryptionService> _logger;
    
    private const int NonceSize = 12;  // 96 bits for GCM (recommended by NIST)
    private const int TagSize = 16;    // 128 bits authentication tag
    private const int KeySize = 32;    // 256 bits

    public AtRestEncryptionService(
        IConfiguration configuration,
        ILogger<AtRestEncryptionService> logger)
    {
        _logger = logger;
        
        var keyBase64 = configuration["Security:MasterEncryptionKey"];
        
        if (string.IsNullOrEmpty(keyBase64))
        {
            _logger.LogWarning(
                "Master encryption key not configured. Generating temporary key. " +
                "This is acceptable for development but NOT for production!");
            
            _masterKey = RandomNumberGenerator.GetBytes(KeySize);
        }
        else
        {
            _masterKey = Convert.FromBase64String(keyBase64);
            
            if (_masterKey.Length != KeySize)
            {
                throw new InvalidOperationException(
                    $"Master encryption key must be {KeySize * 8} bits ({KeySize} bytes). " +
                    $"Got {_masterKey.Length * 8} bits.");
            }
        }
    }

    /// <inheritdoc/>
    public byte[] Encrypt(byte[] plaintext, byte[] associatedData)
    {
        ArgumentNullException.ThrowIfNull(plaintext);
        ArgumentNullException.ThrowIfNull(associatedData);

        using var aesGcm = new AesGcm(_masterKey, TagSize);
        
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];

        aesGcm.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);

        // Format: [nonce (12 bytes)][tag (16 bytes)][ciphertext]
        var result = new byte[NonceSize + TagSize + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, result, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, result, NonceSize, TagSize);
        Buffer.BlockCopy(ciphertext, 0, result, NonceSize + TagSize, ciphertext.Length);

        return result;
    }

    /// <inheritdoc/>
    public byte[] Decrypt(byte[] encryptedData, byte[] associatedData)
    {
        ArgumentNullException.ThrowIfNull(encryptedData);
        ArgumentNullException.ThrowIfNull(associatedData);

        if (encryptedData.Length < NonceSize + TagSize)
        {
            throw new ArgumentException(
                $"Invalid encrypted data. Minimum size is {NonceSize + TagSize} bytes.",
                nameof(encryptedData));
        }

        using var aesGcm = new AesGcm(_masterKey, TagSize);

        var nonce = new byte[NonceSize];
        var tag = new byte[TagSize];
        var ciphertext = new byte[encryptedData.Length - NonceSize - TagSize];

        Buffer.BlockCopy(encryptedData, 0, nonce, 0, NonceSize);
        Buffer.BlockCopy(encryptedData, NonceSize, tag, 0, TagSize);
        Buffer.BlockCopy(encryptedData, NonceSize + TagSize, ciphertext, 0, ciphertext.Length);

        var plaintext = new byte[ciphertext.Length];
        
        try
        {
            aesGcm.Decrypt(nonce, ciphertext, tag, plaintext, associatedData);
            return plaintext;
        }
        catch (CryptographicException ex)
        {
            _logger.LogWarning(ex, "Decryption failed - authentication tag mismatch");
            throw new CryptographicException("Decryption failed. Data may have been tampered with.", ex);
        }
    }

    /// <inheritdoc/>
    public string EncryptString(string plaintext, string context)
    {
        ArgumentException.ThrowIfNullOrEmpty(plaintext);
        ArgumentException.ThrowIfNullOrEmpty(context);

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var contextBytes = Encoding.UTF8.GetBytes(context);
        var encrypted = Encrypt(plaintextBytes, contextBytes);
        
        return Convert.ToBase64String(encrypted);
    }

    /// <inheritdoc/>
    public string DecryptString(string ciphertext, string context)
    {
        ArgumentException.ThrowIfNullOrEmpty(ciphertext);
        ArgumentException.ThrowIfNullOrEmpty(context);

        var encryptedBytes = Convert.FromBase64String(ciphertext);
        var contextBytes = Encoding.UTF8.GetBytes(context);
        var decrypted = Decrypt(encryptedBytes, contextBytes);
        
        return Encoding.UTF8.GetString(decrypted);
    }

    /// <inheritdoc/>
    public string GenerateKey()
    {
        var key = RandomNumberGenerator.GetBytes(KeySize);
        return Convert.ToBase64String(key);
    }
}
