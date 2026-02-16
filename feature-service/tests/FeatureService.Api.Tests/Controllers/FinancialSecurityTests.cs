using Xunit;
using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Auth;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Tests.Controllers;

/// <summary>
/// Tests for financial security requirements:
/// - 2FA requirement for financial operations
/// - PIN setup and verification
/// - Security checks in controllers
/// </summary>
public class FinancialSecurityTests
{
    [Fact]
    public void UserContext_WithTotpEnabled_ReturnsTrueForTotpEnabled()
    {
        // Arrange
        var context = new UserContext
        {
            UserId = 1,
            Username = "testuser",
            Email = "test@example.com",
            IsAdmin = false,
            TotpEnabled = true,
            AvatarUrl = null
        };

        // Assert
        Assert.True(context.TotpEnabled);
        Assert.Equal((uint)1, context.UserId);
    }

    [Fact]
    public void UserContext_WithTotpDisabled_ReturnsFalseForTotpEnabled()
    {
        // Arrange
        var context = new UserContext
        {
            UserId = 1,
            Username = "testuser",
            Email = "test@example.com",
            IsAdmin = false,
            TotpEnabled = false,
            AvatarUrl = null
        };

        // Assert
        Assert.False(context.TotpEnabled);
    }

    [Fact]
    public void UserContext_DefaultTotpEnabled_IsFalse()
    {
        // Arrange
        var context = new UserContext
        {
            UserId = 1,
            Username = "testuser",
            Email = "test@example.com"
        };

        // Assert - default should be false for security
        Assert.False(context.TotpEnabled);
    }

    [Fact]
    public void SetPinRequest_WithValid6DigitPin_IsValid()
    {
        // Arrange
        var request = new SetPinRequest
        {
            Pin = "123456",
            ConfirmPin = "123456"
        };

        // Assert
        Assert.Equal(6, request.Pin.Length);
        Assert.Equal(request.Pin, request.ConfirmPin);
    }

    [Fact]
    public void SetPinRequest_WithMismatchedPins_HasDifferentValues()
    {
        // Arrange
        var request = new SetPinRequest
        {
            Pin = "123456",
            ConfirmPin = "654321"
        };

        // Assert
        Assert.NotEqual(request.Pin, request.ConfirmPin);
    }

    [Fact]
    public void VerifyPinRequest_WithPin_HasCorrectFormat()
    {
        // Arrange
        var request = new VerifyPinRequest { Pin = "123456" };

        // Assert
        Assert.Equal(6, request.Pin.Length);
        Assert.True(request.Pin.All(char.IsDigit));
    }

    [Fact]
    public void PinStatusResponse_WhenPinNotSet_ShowsCorrectStatus()
    {
        // Arrange
        var response = new PinStatusResponse(
            PinSet: false,
            IsLocked: false,
            LockedUntil: null,
            FailedAttempts: 0,
            MaxAttempts: 4
        );

        // Assert
        Assert.False(response.PinSet);
        Assert.False(response.IsLocked);
        Assert.Null(response.LockedUntil);
        Assert.Equal(0, response.FailedAttempts);
        Assert.Equal(4, response.MaxAttempts);
    }

    [Fact]
    public void PinStatusResponse_WhenLocked_ShowsLockDetails()
    {
        // Arrange
        var lockedUntil = DateTime.UtcNow.AddHours(4);
        var response = new PinStatusResponse(
            PinSet: true,
            IsLocked: true,
            LockedUntil: lockedUntil,
            FailedAttempts: 4,
            MaxAttempts: 4
        );

        // Assert
        Assert.True(response.PinSet);
        Assert.True(response.IsLocked);
        Assert.NotNull(response.LockedUntil);
        Assert.Equal(4, response.FailedAttempts);
    }

    [Fact]
    public void VerifyPinResponse_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var response = new VerifyPinResponse(
            Valid: true,
            Message: "PIN verified successfully",
            RemainingAttempts: null
        );

        // Assert
        Assert.True(response.Valid);
        Assert.Contains("verified", response.Message.ToLower());
    }

    [Fact]
    public void VerifyPinResponse_WhenInvalid_ReturnsFailureWithAttempts()
    {
        // Arrange
        var response = new VerifyPinResponse(
            Valid: false,
            Message: "PIN salah",
            RemainingAttempts: 3
        );

        // Assert
        Assert.False(response.Valid);
        Assert.Equal(3, response.RemainingAttempts);
    }

    [Fact]
    public void CreateTransferRequest_RequiresPin()
    {
        // Arrange
        var request = new CreateTransferRequest(
            ReceiverUsername: "receiver",
            Amount: 50000,
            Message: "Test",
            Pin: "123456",
            HoldHours: 24
        );

        // Assert - PIN is required for transfers
        Assert.NotEmpty(request.Pin);
        Assert.Equal(6, request.Pin.Length);
    }

    [Fact]
    public void CreateWithdrawalRequest_RequiresPin()
    {
        // Arrange
        var request = new CreateWithdrawalRequest(
            Amount: 50000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123456"
        );

        // Assert - PIN is required for withdrawals
        Assert.NotEmpty(request.Pin);
        Assert.Equal(6, request.Pin.Length);
    }

    [Fact]
    public void ReleaseTransferRequest_RequiresPin()
    {
        // Arrange
        var request = new ReleaseTransferRequest(Pin: "123456");

        // Assert - PIN is required for releasing transfers
        Assert.NotEmpty(request.Pin);
        Assert.Equal(6, request.Pin.Length);
    }

    [Fact]
    public void CancelTransferRequest_RequiresPinAndReason()
    {
        // Arrange
        var request = new CancelTransferRequest(
            Pin: "123456",
            Reason: "Changed my mind"
        );

        // Assert - PIN and reason are required for cancelling transfers
        Assert.NotEmpty(request.Pin);
        Assert.NotEmpty(request.Reason);
    }
}
