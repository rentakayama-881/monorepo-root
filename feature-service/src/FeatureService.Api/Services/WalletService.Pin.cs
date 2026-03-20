using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public partial class WalletService
{
    // === PIN Security Helpers ===

    private void ValidatePin(string pin)
    {
        if (string.IsNullOrEmpty(pin) || pin.Length != 6)
        {
            throw new ArgumentException("PIN harus 6 digit");
        }

        if (!pin.All(char.IsDigit))
        {
            throw new ArgumentException("PIN harus berisi angka saja");
        }

        // Check for weak PINs
        if (IsWeakPin(pin))
        {
            throw new ArgumentException("PIN terlalu lemah. Hindari urutan berulang atau berurutan.");
        }
    }

    private static bool IsWeakPin(string pin)
    {
        // Check for repeated digits (e.g., 111111, 222222)
        if (pin.Distinct().Count() == 1)
            return true;

        // Check for sequential digits (e.g., 123456, 654321)
        var sequential = "0123456789";
        var reverseSequential = "9876543210";
        if (sequential.Contains(pin) || reverseSequential.Contains(pin))
            return true;

        // Check for common weak PINs
        var weakPins = new[] { "000000", "123123", "111222", "121212", "123321" };
        if (weakPins.Contains(pin))
            return true;

        return false;
    }

    private static void CheckPinLock(UserWallet wallet)
    {
        if (wallet.PinLockedUntil.HasValue && wallet.PinLockedUntil.Value > DateTime.UtcNow)
        {
            var remainingTime = wallet.PinLockedUntil.Value - DateTime.UtcNow;
            throw new InvalidOperationException($"PIN terkunci. Coba lagi dalam {Math.Ceiling(remainingTime.TotalMinutes)} menit");
        }
    }

    /// <summary>
    /// Hashes PIN using PBKDF2 with 310,000 iterations and SHA256
    /// </summary>
    private static string HashPin(string pin)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        
        using var pbkdf2 = new Rfc2898DeriveBytes(
            Encoding.UTF8.GetBytes(pin),
            salt,
            PbkdfIterations,
            HashAlgorithmName.SHA256
        );
        
        var hash = pbkdf2.GetBytes(HashSize);
        
        // Combine salt + hash for storage
        var hashBytes = new byte[SaltSize + HashSize];
        Array.Copy(salt, 0, hashBytes, 0, SaltSize);
        Array.Copy(hash, 0, hashBytes, SaltSize, HashSize);
        
        return Convert.ToBase64String(hashBytes);
    }

    /// <summary>
    /// Verifies PIN against stored hash using constant-time comparison
    /// </summary>
    private static bool VerifyPinHash(string pin, string storedHash)
    {
        try
        {
            var hashBytes = Convert.FromBase64String(storedHash);
            
            if (hashBytes.Length != SaltSize + HashSize)
            {
                return false;
            }

            var salt = new byte[SaltSize];
            Array.Copy(hashBytes, 0, salt, 0, SaltSize);
            
            using var pbkdf2 = new Rfc2898DeriveBytes(
                Encoding.UTF8.GetBytes(pin),
                salt,
                PbkdfIterations,
                HashAlgorithmName.SHA256
            );
            
            var hash = pbkdf2.GetBytes(HashSize);
            
            // Constant-time comparison to prevent timing attacks
            return CryptographicOperations.FixedTimeEquals(
                new ReadOnlySpan<byte>(hashBytes, SaltSize, HashSize),
                hash
            );
        }
        catch
        {
            return false;
        }
    }
}
