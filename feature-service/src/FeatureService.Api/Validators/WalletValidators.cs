using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class SetPinRequestValidator : AbstractValidator<SetPinRequest>
{
    public SetPinRequestValidator()
    {
        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");

        RuleFor(x => x.ConfirmPin)
            .NotEmpty().WithMessage("Konfirmasi PIN wajib diisi")
            .Equal(x => x.Pin).WithMessage("Konfirmasi PIN tidak cocok");
    }
}

public class VerifyPinRequestValidator : AbstractValidator<VerifyPinRequest>
{
    public VerifyPinRequestValidator()
    {
        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");
    }
}

public class SetGuaranteeRequestValidator : AbstractValidator<SetGuaranteeRequest>
{
    public SetGuaranteeRequestValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(100_000).WithMessage("Minimal jaminan adalah Rp 100.000");

        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");
    }
}

public class ReleaseGuaranteeRequestValidator : AbstractValidator<ReleaseGuaranteeRequest>
{
    public ReleaseGuaranteeRequestValidator()
    {
        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");
    }
}
