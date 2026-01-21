using Xunit;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.Tests.DTOs;

public class TransferDtosTests
{
    [Fact]
    public void CreateTransferRequest_WithValidData_IsValid()
    {
        // Arrange
        var request = new CreateTransferRequest(
            ReceiverUsername: "testuser",
            Amount: 10000,
            Message: "Test transfer",
            Pin: "123456",
            HoldHours: 24
        );

        // Act
        var validationResults = ValidateModel(request);

        // Assert
        Assert.Empty(validationResults);
    }

    [Fact]
    public void CreateTransferRequest_WithZeroAmount_CreatesRecordSuccessfully()
    {
        // Note: Amount validation happens in the service layer, not via data annotations
        // Arrange
        var request = new CreateTransferRequest(
            ReceiverUsername: "testuser",
            Amount: 0,
            Message: "Test transfer",
            Pin: "123456",
            HoldHours: 24
        );

        // Assert - record is created, validation would happen at service level
        Assert.Equal(0, request.Amount);
        Assert.Equal("testuser", request.ReceiverUsername);
    }

    [Fact]
    public void CreateTransferRequest_WithLongHoldHours_CreatesRecordSuccessfully()
    {
        // Note: HoldHours validation (max 72) happens in the service layer
        // Arrange
        var request = new CreateTransferRequest(
            ReceiverUsername: "testuser",
            Amount: 10000,
            Message: "Test transfer",
            Pin: "123456",
            HoldHours: 100 // Service will cap this at 72
        );

        // Assert - record is created, service will enforce max
        Assert.Equal(100, request.HoldHours);
    }

    [Fact]
    public void TransferDto_MapsCorrectly()
    {
        // Arrange & Act
        var dto = new TransferDto(
            Id: "507f1f77bcf86cd799439011",
            Code: "TRF12345",
            SenderId: 1,
            SenderUsername: "sender",
            SenderAvatarUrl: null,
            ReceiverId: 2,
            ReceiverUsername: "receiver",
            ReceiverAvatarUrl: null,
            Amount: 50000,
            Message: "Test transfer",
            Status: "Pending",
            HoldUntil: DateTime.UtcNow.AddHours(24),
            ReleasedAt: null,
            CancelledAt: null,
            CancelReason: null,
            CreatedAt: DateTime.UtcNow
        );

        // Assert
        Assert.Equal("TRF12345", dto.Code);
        Assert.Equal(50000, dto.Amount);
        Assert.Equal("sender", dto.SenderUsername);
        Assert.Equal("receiver", dto.ReceiverUsername);
        Assert.Equal("Pending", dto.Status);
    }

    [Fact]
    public void TransferStatus_HasExpectedValues()
    {
        // Assert all expected statuses exist with correct enum values
        Assert.Equal(0, (int)TransferStatus.Pending);
        Assert.Equal(1, (int)TransferStatus.Released);
        Assert.Equal(2, (int)TransferStatus.Cancelled);
        Assert.Equal(3, (int)TransferStatus.Rejected);
        Assert.Equal(4, (int)TransferStatus.Disputed);
        Assert.Equal(5, (int)TransferStatus.Expired);
    }

    private static List<ValidationResult> ValidateModel(object model)
    {
        var validationResults = new List<ValidationResult>();
        var validationContext = new ValidationContext(model, null, null);
        Validator.TryValidateObject(model, validationContext, validationResults, true);
        return validationResults;
    }
}
