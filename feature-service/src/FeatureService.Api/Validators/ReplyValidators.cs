using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class CreateReplyRequestValidator : AbstractValidator<CreateReplyRequest>
{
    public CreateReplyRequestValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Content is required")
            .MinimumLength(1).WithMessage("Content must be at least 1 character")
            .MaximumLength(5000).WithMessage("Content must be between 1 and 5000 characters");

        RuleFor(x => x.ParentReplyId)
            .Matches("^rpl_[A-Z0-9]{26}$")
            .When(x => !string.IsNullOrEmpty(x.ParentReplyId))
            .WithMessage("Invalid parent reply ID format");
    }
}

public class UpdateReplyRequestValidator : AbstractValidator<UpdateReplyRequest>
{
    public UpdateReplyRequestValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Content is required")
            .MinimumLength(1).WithMessage("Content must be at least 1 character")
            .MaximumLength(5000).WithMessage("Content must be between 1 and 5000 characters");
    }
}
