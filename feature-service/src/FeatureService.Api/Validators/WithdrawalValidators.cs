using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class CreateWithdrawalRequestValidator : AbstractValidator<CreateWithdrawalRequest>
{
    public CreateWithdrawalRequestValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(10_000).WithMessage("Minimal penarikan Rp 10.000")
            .LessThanOrEqualTo(100_000_000).WithMessage("Maksimal penarikan Rp 100.000.000");

        RuleFor(x => x.CryptoAddress)
            .NotEmpty().WithMessage("Alamat crypto wajib diisi")
            .MinimumLength(10).WithMessage("Alamat crypto tidak valid")
            .MaximumLength(256).WithMessage("Alamat crypto terlalu panjang");

        RuleFor(x => x.CryptoCurrency)
            .NotEmpty().WithMessage("Mata uang crypto wajib diisi")
            .MinimumLength(2).WithMessage("Mata uang crypto tidak valid")
            .MaximumLength(20).WithMessage("Mata uang crypto tidak valid");

        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");

        RuleFor(x => x.Network)
            .MaximumLength(50).WithMessage("Network maksimal 50 karakter")
            .When(x => x.Network != null);

        RuleFor(x => x.Memo)
            .MaximumLength(200).WithMessage("Memo maksimal 200 karakter")
            .When(x => x.Memo != null);
    }
}

public class CancelWithdrawalRequestValidator : AbstractValidator<CancelWithdrawalRequest>
{
    public CancelWithdrawalRequestValidator()
    {
        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");
    }
}
