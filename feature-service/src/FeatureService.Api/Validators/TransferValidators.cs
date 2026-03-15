using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class CreateTransferRequestValidator : AbstractValidator<CreateTransferRequest>
{
    public CreateTransferRequestValidator()
    {
        RuleFor(x => x.ReceiverUsername)
            .NotEmpty().WithMessage("Username penerima wajib diisi")
            .MaximumLength(50).WithMessage("Username penerima maksimal 50 karakter");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Jumlah transfer harus lebih dari 0")
            .LessThanOrEqualTo(100_000_000).WithMessage("Maksimal transfer Rp 100.000.000");

        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");

        RuleFor(x => x.HoldHours)
            .InclusiveBetween(1, 720).WithMessage("Hold period harus antara 1–720 jam (30 hari)");

        RuleFor(x => x.Message)
            .MaximumLength(500).WithMessage("Pesan maksimal 500 karakter")
            .When(x => x.Message != null);
    }
}

public class ReleaseTransferRequestValidator : AbstractValidator<ReleaseTransferRequest>
{
    public ReleaseTransferRequestValidator()
    {
        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");
    }
}

public class CancelTransferRequestValidator : AbstractValidator<CancelTransferRequest>
{
    public CancelTransferRequestValidator()
    {
        RuleFor(x => x.Pin)
            .NotEmpty().WithMessage("PIN wajib diisi")
            .Length(6).WithMessage("PIN harus 6 digit")
            .Matches(@"^\d{6}$").WithMessage("PIN harus berisi angka saja");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Alasan pembatalan wajib diisi")
            .MaximumLength(500).WithMessage("Alasan maksimal 500 karakter");
    }
}
