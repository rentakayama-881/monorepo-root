using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class CreateBrowserProfileRequestValidator : AbstractValidator<CreateBrowserProfileRequest>
{
    public CreateBrowserProfileRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Nama profil wajib diisi")
            .MaximumLength(100).WithMessage("Nama profil maksimal 100 karakter");

        RuleFor(x => x.ProxyServer)
            .MaximumLength(500).WithMessage("Alamat proxy maksimal 500 karakter")
            .Matches(@"^(https?|socks[45])://")
            .WithMessage("Format proxy harus dimulai dengan http://, https://, socks4://, atau socks5://")
            .When(x => !string.IsNullOrEmpty(x.ProxyServer));

        RuleFor(x => x.ProxyUsername)
            .MaximumLength(100).WithMessage("Username proxy maksimal 100 karakter")
            .When(x => x.ProxyUsername != null);

        RuleFor(x => x.ProxyPassword)
            .MaximumLength(200).WithMessage("Password proxy maksimal 200 karakter")
            .When(x => x.ProxyPassword != null);

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Catatan maksimal 500 karakter")
            .When(x => x.Notes != null);
    }
}

public class UpdateBrowserProfileRequestValidator : AbstractValidator<UpdateBrowserProfileRequest>
{
    public UpdateBrowserProfileRequestValidator()
    {
        RuleFor(x => x.Name)
            .MaximumLength(100).WithMessage("Nama profil maksimal 100 karakter")
            .When(x => x.Name != null);

        RuleFor(x => x.ProxyServer)
            .MaximumLength(500).WithMessage("Alamat proxy maksimal 500 karakter")
            .Matches(@"^(https?|socks[45])://")
            .WithMessage("Format proxy harus dimulai dengan http://, https://, socks4://, atau socks5://")
            .When(x => !string.IsNullOrEmpty(x.ProxyServer));

        RuleFor(x => x.ProxyUsername)
            .MaximumLength(100).WithMessage("Username proxy maksimal 100 karakter")
            .When(x => x.ProxyUsername != null);

        RuleFor(x => x.ProxyPassword)
            .MaximumLength(200).WithMessage("Password proxy maksimal 200 karakter")
            .When(x => x.ProxyPassword != null);

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Catatan maksimal 500 karakter")
            .When(x => x.Notes != null);
    }
}

public class StartBrowserSessionRequestValidator : AbstractValidator<StartBrowserSessionRequest>
{
    public StartBrowserSessionRequestValidator()
    {
        RuleFor(x => x.ProfileId)
            .NotEmpty().WithMessage("Profile ID wajib diisi")
            .Matches(@"^bpf_").WithMessage("Profile ID harus diawali dengan 'bpf_'");
    }
}

public class BrowserBillingTickRequestValidator : AbstractValidator<BrowserBillingTickRequest>
{
    public BrowserBillingTickRequestValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty().WithMessage("Session ID wajib diisi");

        RuleFor(x => x.UserId)
            .GreaterThan((uint)0).WithMessage("User ID harus lebih dari 0");

        RuleFor(x => x.MinutesToBill)
            .GreaterThan(0).WithMessage("Minutes to bill harus lebih dari 0")
            .LessThanOrEqualTo(60).WithMessage("Minutes to bill maksimal 60");
    }
}
