using FluentAssertions;
using FeatureService.Api.DTOs;
using FeatureService.Api.Validators;

namespace FeatureService.Api.Tests.Validators;

public class ReactionValidatorTests
{
    private readonly CreateReactionRequestValidator _validator = new();

    [Theory]
    [InlineData("like")]
    [InlineData("love")]
    [InlineData("fire")]
    [InlineData("sad")]
    [InlineData("laugh")]
    public void CreateReaction_WithValidReactionType_ShouldPass(string reactionType)
    {
        // Arrange
        var request = new CreateReactionRequest
        {
            ReactionType = reactionType
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CreateReaction_WithInvalidReactionType_ShouldFail()
    {
        // Arrange
        var request = new CreateReactionRequest
        {
            ReactionType = "invalid"
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("like, love, fire, sad, laugh"));
    }

    [Fact]
    public void CreateReaction_WithEmptyReactionType_ShouldFail()
    {
        // Arrange
        var request = new CreateReactionRequest
        {
            ReactionType = ""
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("required"));
    }
}
