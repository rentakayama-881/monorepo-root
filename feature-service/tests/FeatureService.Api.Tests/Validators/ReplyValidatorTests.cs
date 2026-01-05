using FluentAssertions;
using FeatureService.Api.DTOs;
using FeatureService.Api.Validators;

namespace FeatureService.Api.Tests.Validators;

public class ReplyValidatorTests
{
    private readonly CreateReplyRequestValidator _createValidator = new();
    private readonly UpdateReplyRequestValidator _updateValidator = new();

    [Fact]
    public void CreateReply_WithValidContent_ShouldPass()
    {
        // Arrange
        var request = new CreateReplyRequest
        {
            Content = "This is a valid reply"
        };

        // Act
        var result = _createValidator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CreateReply_WithEmptyContent_ShouldFail()
    {
        // Arrange
        var request = new CreateReplyRequest
        {
            Content = ""
        };

        // Act
        var result = _createValidator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("Content is required"));
    }

    [Fact]
    public void CreateReply_WithTooLongContent_ShouldFail()
    {
        // Arrange
        var request = new CreateReplyRequest
        {
            Content = new string('a', 5001)
        };

        // Act
        var result = _createValidator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("5000 characters"));
    }

    [Fact]
    public void CreateReply_WithValidParentReplyId_ShouldPass()
    {
        // Arrange
        var request = new CreateReplyRequest
        {
            Content = "Reply to parent",
            ParentReplyId = "rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T"
        };

        // Act
        var result = _createValidator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CreateReply_WithInvalidParentReplyId_ShouldFail()
    {
        // Arrange
        var request = new CreateReplyRequest
        {
            Content = "Reply to parent",
            ParentReplyId = "invalid-id"
        };

        // Act
        var result = _createValidator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("Invalid parent reply ID format"));
    }

    [Fact]
    public void UpdateReply_WithValidContent_ShouldPass()
    {
        // Arrange
        var request = new UpdateReplyRequest
        {
            Content = "Updated content"
        };

        // Act
        var result = _updateValidator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
