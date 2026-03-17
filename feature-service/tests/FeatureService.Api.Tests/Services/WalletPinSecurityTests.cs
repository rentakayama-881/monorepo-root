using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using FeatureService.Api.Services;

namespace FeatureService.Api.Tests.Services;

/// <summary>
/// Security tests for WalletService PIN logic:
/// - PIN validation (format, weak PIN rejection)
/// - PIN hashing (PBKDF2 with 310K iterations)
/// - PIN verification (constant-time comparison via FixedTimeEquals)
/// </summary>
public class WalletPinSecurityTests
{
    // Use reflection to test private static methods without requiring MongoDB
    private static readonly MethodInfo HashPinMethod = typeof(WalletService)
        .GetMethod("HashPin", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static readonly MethodInfo VerifyPinHashMethod = typeof(WalletService)
        .GetMethod("VerifyPinHash", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static readonly MethodInfo ValidatePinMethod = typeof(WalletService)
        .GetMethod("ValidatePin", BindingFlags.NonPublic | BindingFlags.Instance)!;

    private static readonly MethodInfo IsWeakPinMethod = typeof(WalletService)
        .GetMethod("IsWeakPin", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static string HashPin(string pin) =>
        (string)HashPinMethod.Invoke(null, new object[] { pin })!;

    private static bool VerifyPinHash(string pin, string storedHash) =>
        (bool)VerifyPinHashMethod.Invoke(null, new object[] { pin, storedHash })!;

    private static bool IsWeakPin(string pin) =>
        (bool)IsWeakPinMethod.Invoke(null, new object[] { pin })!;

    // ═══════════════════════════════════════════════════════════════
    //  PIN Hash + Verify round-trip
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void HashPin_ThenVerify_ReturnsTrue()
    {
        var pin = "482916";
        var hash = HashPin(pin);

        Assert.True(VerifyPinHash(pin, hash));
    }

    [Fact]
    public void VerifyPin_ReturnsFalse_ForWrongPin()
    {
        var hash = HashPin("482916");

        Assert.False(VerifyPinHash("000000", hash));
    }

    [Fact]
    public void HashPin_ProducesDifferentHashes_ForSamePin()
    {
        var hash1 = HashPin("123789");
        var hash2 = HashPin("123789");

        // Different salts → different hashes
        Assert.NotEqual(hash1, hash2);

        // Both should still verify
        Assert.True(VerifyPinHash("123789", hash1));
        Assert.True(VerifyPinHash("123789", hash2));
    }

    [Fact]
    public void HashPin_ProducesBase64_OfExpectedLength()
    {
        var hash = HashPin("482916");

        // SaltSize(32) + HashSize(32) = 64 bytes → base64
        var bytes = Convert.FromBase64String(hash);
        Assert.Equal(64, bytes.Length);
    }

    // ═══════════════════════════════════════════════════════════════
    //  VerifyPinHash — edge cases / fail-closed
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void VerifyPinHash_ReturnsFalse_ForInvalidBase64()
    {
        Assert.False(VerifyPinHash("482916", "not-valid-base64!!!"));
    }

    [Fact]
    public void VerifyPinHash_ReturnsFalse_ForEmptyHash()
    {
        Assert.False(VerifyPinHash("482916", ""));
    }

    [Fact]
    public void VerifyPinHash_ReturnsFalse_ForTruncatedHash()
    {
        var hash = HashPin("482916");
        var truncated = Convert.ToBase64String(Convert.FromBase64String(hash)[..32]);

        Assert.False(VerifyPinHash("482916", truncated));
    }

    [Fact]
    public void VerifyPinHash_ReturnsFalse_ForTamperedHash()
    {
        var hash = HashPin("482916");
        var bytes = Convert.FromBase64String(hash);
        bytes[^1] ^= 0xFF; // flip last byte
        var tampered = Convert.ToBase64String(bytes);

        Assert.False(VerifyPinHash("482916", tampered));
    }

    // ═══════════════════════════════════════════════════════════════
    //  Weak PIN detection
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("111111")]
    [InlineData("222222")]
    [InlineData("999999")]
    [InlineData("000000")]
    [InlineData("123456")]
    [InlineData("654321")]
    [InlineData("123123")]
    [InlineData("111222")]
    [InlineData("121212")]
    [InlineData("123321")]
    public void IsWeakPin_ReturnsTrue_ForKnownWeakPins(string pin)
    {
        Assert.True(IsWeakPin(pin));
    }

    [Theory]
    [InlineData("482916")]
    [InlineData("739150")]
    [InlineData("816274")]
    [InlineData("507382")]
    public void IsWeakPin_ReturnsFalse_ForStrongPins(string pin)
    {
        Assert.False(IsWeakPin(pin));
    }

    // ═══════════════════════════════════════════════════════════════
    //  PIN validation (format checks)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void ValidatePin_ThrowsForNonNumeric()
    {
        var instance = CreateWalletServiceForValidation();
        var ex = Assert.Throws<TargetInvocationException>(() =>
            ValidatePinMethod.Invoke(instance, new object[] { "abcdef" }));
        Assert.IsType<ArgumentException>(ex.InnerException);
        Assert.Contains("angka", ex.InnerException!.Message);
    }

    [Fact]
    public void ValidatePin_ThrowsForWrongLength()
    {
        var instance = CreateWalletServiceForValidation();
        var ex = Assert.Throws<TargetInvocationException>(() =>
            ValidatePinMethod.Invoke(instance, new object[] { "123" }));
        Assert.IsType<ArgumentException>(ex.InnerException);
        Assert.Contains("6 digit", ex.InnerException!.Message);
    }

    [Fact]
    public void ValidatePin_ThrowsForEmptyPin()
    {
        var instance = CreateWalletServiceForValidation();
        var ex = Assert.Throws<TargetInvocationException>(() =>
            ValidatePinMethod.Invoke(instance, new object[] { "" }));
        Assert.IsType<ArgumentException>(ex.InnerException);
    }

    [Fact]
    public void ValidatePin_ThrowsForWeakPin()
    {
        var instance = CreateWalletServiceForValidation();
        var ex = Assert.Throws<TargetInvocationException>(() =>
            ValidatePinMethod.Invoke(instance, new object[] { "123456" }));
        Assert.IsType<ArgumentException>(ex.InnerException);
        Assert.Contains("lemah", ex.InnerException!.Message);
    }

    [Fact]
    public void ValidatePin_AcceptsStrongPin()
    {
        var instance = CreateWalletServiceForValidation();
        // Should not throw
        ValidatePinMethod.Invoke(instance, new object[] { "482916" });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Helper — create minimal WalletService instance for instance method calls
    // ═══════════════════════════════════════════════════════════════

    private static WalletService CreateWalletServiceForValidation()
    {
        // Create uninitialized instance to test pure validation logic
        // without needing MongoDB dependencies
#pragma warning disable SYSLIB0050
        return (WalletService)System.Runtime.Serialization.FormatterServices
            .GetUninitializedObject(typeof(WalletService));
#pragma warning restore SYSLIB0050
    }
}
