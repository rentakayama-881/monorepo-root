using System.ComponentModel.DataAnnotations;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Tests.DTOs;

public class WithdrawalDtosTests
{
    [Fact]
    public void CreateWithdrawalRequest_WithValidCryptoData_IsValid()
    {
        var request = new CreateWithdrawalRequest(
            Amount: 50_000,
            CryptoAddress: "TQ9w7Tn4P3pK8sD2xR6m",
            CryptoCurrency: "USDT",
            Network: "TRC20",
            Memo: null,
            Pin: "123456");

        var validationResults = ValidateModel(request);

        Assert.Empty(validationResults);
    }

    [Fact]
    public void CreateWithdrawalRequest_WithShortAddress_HasValidationError()
    {
        var request = new CreateWithdrawalRequest(
            Amount: 50_000,
            CryptoAddress: "short",
            CryptoCurrency: "USDT",
            Network: "TRC20",
            Memo: null,
            Pin: "123456");

        var validationResults = ValidateModel(request);

        Assert.Contains(
            validationResults,
            result => result.ErrorMessage == "Alamat crypto tidak valid");
    }

    [Fact]
    public void WithdrawalStatus_HasExpectedValues()
    {
        Assert.Equal(0, (int)WithdrawalStatus.Processing);
        Assert.Equal(1, (int)WithdrawalStatus.Completed);
        Assert.Equal(2, (int)WithdrawalStatus.Failed);
        Assert.Equal(3, (int)WithdrawalStatus.Cancelled);
    }

    [Fact]
    public void CryptoCurrencyInfoDto_CreatesCorrectly()
    {
        var currency = new CryptoCurrencyInfoDto(
            Symbol: "USDT",
            Name: "Tether (USDT)",
            SupportedNetworks: new[] { "TRC20", "TON" });

        Assert.Equal("USDT", currency.Symbol);
        Assert.Equal("Tether (USDT)", currency.Name);
        Assert.Equal(new[] { "TRC20", "TON" }, currency.SupportedNetworks);
    }

    [Fact]
    public void WithdrawalDto_StoresCryptoFields()
    {
        var dto = new WithdrawalDto(
            Id: "507f1f77bcf86cd799439011",
            UserId: 1,
            Username: "testuser",
            Amount: 100_000,
            Fee: 2_000,
            NetAmount: 100_000,
            CryptoAddress: "TQ9w7Tn4P3pK8sD2xR6m",
            CryptoCurrency: "USDT",
            CryptoNetwork: "TRC20",
            CryptoAmount: "6.25",
            TrackId: "track_001",
            TxHash: null,
            Status: "Processing",
            Reference: "WD2401011A2B3C",
            FailureReason: null,
            CreatedAt: DateTime.UtcNow,
            CompletedAt: null);

        Assert.Equal("USDT", dto.CryptoCurrency);
        Assert.Equal("TRC20", dto.CryptoNetwork);
        Assert.Equal("6.25", dto.CryptoAmount);
        Assert.Equal("track_001", dto.TrackId);
    }

    private static List<ValidationResult> ValidateModel(object model)
    {
        var validationResults = new List<ValidationResult>();
        var validationContext = new ValidationContext(model, null, null);
        Validator.TryValidateObject(model, validationContext, validationResults, true);
        return validationResults;
    }
}
