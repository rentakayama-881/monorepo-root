using Xunit;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.Tests.DTOs;

public class DisputeDtosTests
{
    [Fact]
    public void CreateDisputeRequest_WithValidData_IsValid()
    {
        // Arrange
        var request = new CreateDisputeRequest(
            TransferId: "507f1f77bcf86cd799439011",
            Reason: "Item tidak sesuai dengan deskripsi yang diberikan seller",
            Category: DisputeCategory.ItemNotAsDescribed
        );

        // Act
        var validationResults = ValidateModel(request);

        // Assert
        Assert.Empty(validationResults);
    }

    [Fact]
    public void CreateDisputeRequest_WithShortReason_CreatesRecordSuccessfully()
    {
        // Note: Reason length validation happens in the service layer
        // Arrange
        var request = new CreateDisputeRequest(
            TransferId: "507f1f77bcf86cd799439011",
            Reason: "Too short",
            Category: DisputeCategory.Other
        );

        // Assert - record is created, validation would happen at service level
        Assert.Equal("Too short", request.Reason);
        Assert.Equal(DisputeCategory.Other, request.Category);
    }

    [Fact]
    public void DisputeCategory_HasExpectedValues()
    {
        // Assert all expected categories exist
        Assert.Equal(0, (int)DisputeCategory.ItemNotReceived);
        Assert.Equal(1, (int)DisputeCategory.ItemNotAsDescribed);
        Assert.Equal(2, (int)DisputeCategory.Fraud);
        Assert.Equal(3, (int)DisputeCategory.SellerNotResponding);
        Assert.Equal(4, (int)DisputeCategory.Other);
    }

    [Fact]
    public void DisputeStatus_HasExpectedValues()
    {
        // Assert all expected statuses exist
        Assert.Equal(0, (int)DisputeStatus.Open);
        Assert.Equal(1, (int)DisputeStatus.UnderReview);
        Assert.Equal(2, (int)DisputeStatus.WaitingForEvidence);
        Assert.Equal(3, (int)DisputeStatus.Resolved);
        Assert.Equal(4, (int)DisputeStatus.Cancelled);
    }

    [Fact]
    public void ResolutionType_HasExpectedValues()
    {
        Assert.Equal(0, (int)ResolutionType.FullRefundToSender);
        Assert.Equal(1, (int)ResolutionType.FullReleaseToReceiver);
        Assert.Equal(2, (int)ResolutionType.Split);
        Assert.Equal(3, (int)ResolutionType.NoAction);
    }

    [Fact]
    public void DisputeDto_MapsCorrectly()
    {
        // Arrange & Act
        var dto = new DisputeDto(
            Id: "507f1f77bcf86cd799439011",
            TransferId: "507f1f77bcf86cd799439022",
            InitiatorId: 1,
            InitiatorUsername: "buyer",
            RespondentId: 2,
            RespondentUsername: "seller",
            Reason: "Item tidak diterima",
            Category: "ItemNotReceived",
            Status: "Open",
            Amount: 100000,
            Evidence: new List<DisputeEvidenceDto>(),
            Messages: new List<DisputeMessageDto>(),
            Resolution: null,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow,
            ResolvedAt: null
        );

        // Assert
        Assert.Equal("buyer", dto.InitiatorUsername);
        Assert.Equal("seller", dto.RespondentUsername);
        Assert.Equal("ItemNotReceived", dto.Category);
        Assert.Equal("Open", dto.Status);
        Assert.Equal(100000, dto.Amount);
        Assert.Null(dto.Resolution);
    }

    [Fact]
    public void DisputeResolutionDto_WithSplitResolution()
    {
        // Arrange & Act
        var resolution = new DisputeResolutionDto(
            Type: "Split",
            RefundToSender: 50000,
            ReleaseToReceiver: 49000, // minus fee
            Note: "50-50 split berdasarkan bukti"
        );

        // Assert
        Assert.Equal("Split", resolution.Type);
        Assert.Equal(50000, resolution.RefundToSender);
        Assert.Equal(49000, resolution.ReleaseToReceiver);
    }

    [Fact]
    public void AddDisputeMessageRequest_WithValidContent_IsValid()
    {
        // Arrange
        var request = new AddDisputeMessageRequest(
            Content: "Ini adalah tanggapan saya terhadap dispute ini."
        );

        // Act
        var validationResults = ValidateModel(request);

        // Assert
        Assert.Empty(validationResults);
    }

    [Fact]
    public void ResolveDisputeRequest_FullRefund()
    {
        // Arrange & Act
        var request = new ResolveDisputeRequest(
            Type: ResolutionType.FullRefundToSender,
            SenderPercent: null,
            Note: "Seller tidak merespons dalam 7 hari"
        );

        // Assert
        Assert.Equal(ResolutionType.FullRefundToSender, request.Type);
        Assert.Null(request.SenderPercent);
    }

    private static List<ValidationResult> ValidateModel(object model)
    {
        var validationResults = new List<ValidationResult>();
        var validationContext = new ValidationContext(model, null, null);
        Validator.TryValidateObject(model, validationContext, validationResults, true);
        return validationResults;
    }
}
