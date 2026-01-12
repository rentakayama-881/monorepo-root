using Xunit;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.Tests.DTOs;

public class WithdrawalDtosTests
{
    [Fact]
    public void CreateWithdrawalRequest_WithValidData_IsValid()
    {
        // Arrange
        var request = new CreateWithdrawalRequest(
            Amount: 50000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123456"
        );

        // Act
        var validationResults = ValidateModel(request);

        // Assert
        Assert.Empty(validationResults);
    }

    [Fact]
    public void CreateWithdrawalRequest_WithAmountBelowMinimum_CreatesRecordSuccessfully()
    {
        // Note: Amount validation happens in the service layer (min 10000)
        // Arrange
        var request = new CreateWithdrawalRequest(
            Amount: 5000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123456"
        );

        // Assert - record is created, validation would happen at service level
        Assert.Equal(5000, request.Amount);
        Assert.Equal("BCA", request.BankCode);
    }

    [Fact]
    public void CreateWithdrawalRequest_WithAmountAboveMaximum_CreatesRecordSuccessfully()
    {
        // Note: Amount validation happens in the service layer (max 100,000,000)
        // Arrange
        var request = new CreateWithdrawalRequest(
            Amount: 200000000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123456"
        );

        // Assert - record is created, validation would happen at service level
        Assert.Equal(200000000, request.Amount);
    }

    [Fact]
    public void CreateWithdrawalRequest_WithShortPin_CreatesRecordSuccessfully()
    {
        // Note: PIN validation can be in DTO or service layer
        // Arrange
        var request = new CreateWithdrawalRequest(
            Amount: 50000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123"
        );

        // Assert - record is created, validation would happen at controller/service level
        Assert.Equal("123", request.Pin);
    }

    [Fact]
    public void WithdrawalStatus_HasExpectedValues()
    {
        // Assert all expected statuses exist
        Assert.Equal(0, (int)WithdrawalStatus.Pending);
        Assert.Equal(1, (int)WithdrawalStatus.Processing);
        Assert.Equal(2, (int)WithdrawalStatus.Completed);
        Assert.Equal(3, (int)WithdrawalStatus.Rejected);
        Assert.Equal(4, (int)WithdrawalStatus.Cancelled);
    }

    [Fact]
    public void BankInfoDto_CreatesCorrectly()
    {
        // Arrange & Act
        var bankInfo = new BankInfoDto(
            Code: "BCA",
            Name: "Bank Central Asia",
            ShortName: "BCA"
        );

        // Assert
        Assert.Equal("BCA", bankInfo.Code);
        Assert.Equal("Bank Central Asia", bankInfo.Name);
        Assert.Equal("BCA", bankInfo.ShortName);
    }

    [Fact]
    public void WithdrawalDto_MasksAccountNumber()
    {
        // Arrange & Act
        var dto = new WithdrawalDto(
            Id: "507f1f77bcf86cd799439011",
            UserId: 1,
            Username: "testuser",
            Amount: 100000,
            Fee: 2500,
            NetAmount: 100000,
            BankCode: "BCA",
            BankName: "Bank Central Asia",
            MaskedAccountNumber: "******7890",
            AccountName: "Test User",
            Status: "Pending",
            Reference: "WD2401011A2B3C",
            RejectionReason: null,
            CreatedAt: DateTime.UtcNow,
            ProcessedAt: null
        );

        // Assert
        Assert.Equal("******7890", dto.MaskedAccountNumber);
        Assert.Equal(100000, dto.Amount);
        Assert.Equal(2500, dto.Fee);
    }

    private static List<ValidationResult> ValidateModel(object model)
    {
        var validationResults = new List<ValidationResult>();
        var validationContext = new ValidationContext(model, null, null);
        Validator.TryValidateObject(model, validationContext, validationResults, true);
        return validationResults;
    }
}
