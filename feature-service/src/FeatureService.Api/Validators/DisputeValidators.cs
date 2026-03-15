using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class CreateDisputeRequestValidator : AbstractValidator<CreateDisputeRequest>
{
    public CreateDisputeRequestValidator()
    {
        RuleFor(x => x.TransferId)
            .NotEmpty().WithMessage("ID transfer wajib diisi");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Alasan dispute wajib diisi")
            .MinimumLength(20).WithMessage("Alasan dispute minimal 20 karakter")
            .MaximumLength(1000).WithMessage("Alasan dispute maksimal 1000 karakter");

        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("Kategori dispute tidak valid");
    }
}

public class AddDisputeMessageRequestValidator : AbstractValidator<AddDisputeMessageRequest>
{
    public AddDisputeMessageRequestValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Pesan wajib diisi")
            .MinimumLength(1).WithMessage("Pesan tidak boleh kosong")
            .MaximumLength(2000).WithMessage("Pesan maksimal 2000 karakter");
    }
}

public class AddDisputeEvidenceRequestValidator : AbstractValidator<AddDisputeEvidenceRequest>
{
    private static readonly HashSet<string> ValidTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image", "document", "screenshot"
    };

    public AddDisputeEvidenceRequestValidator()
    {
        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Tipe bukti wajib diisi")
            .Must(t => ValidTypes.Contains(t!))
            .WithMessage("Tipe bukti harus: image, document, atau screenshot");

        RuleFor(x => x.Url)
            .NotEmpty().WithMessage("URL bukti wajib diisi")
            .MaximumLength(2000).WithMessage("URL terlalu panjang");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Deskripsi bukti maksimal 500 karakter")
            .When(x => x.Description != null);
    }
}

public class ResolveDisputeRequestValidator : AbstractValidator<ResolveDisputeRequest>
{
    public ResolveDisputeRequestValidator()
    {
        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Tipe resolusi tidak valid");

        RuleFor(x => x.SenderPercent)
            .InclusiveBetween(0, 100).WithMessage("Persentase sender harus 0–100")
            .When(x => x.SenderPercent.HasValue);

        RuleFor(x => x.Note)
            .MaximumLength(1000).WithMessage("Catatan resolusi maksimal 1000 karakter")
            .When(x => x.Note != null);
    }
}
