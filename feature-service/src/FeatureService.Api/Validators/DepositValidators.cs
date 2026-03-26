using FluentValidation;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Validators;

public class CreateDepositRequestValidator : AbstractValidator<CreateDepositRequest>
{
    private static readonly HashSet<string> ValidCryptoCurrencies = new(StringComparer.OrdinalIgnoreCase)
    {
        "USDT", "TON", "BTC", "ETH", "LTC", "TRX", "BNB", "DOGE", "SOL", "MATIC"
    };

    public CreateDepositRequestValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(2_000).WithMessage("Minimum deposit Rp 2.000")
            .LessThanOrEqualTo(500_000_000).WithMessage("Maksimum deposit Rp 500.000.000");

        RuleFor(x => x.PayCurrency)
            .Must(c => ValidCryptoCurrencies.Contains(c!))
            .WithMessage("Mata uang crypto tidak didukung")
            .When(x => !string.IsNullOrEmpty(x.PayCurrency));

        RuleFor(x => x.Network)
            .MaximumLength(50).WithMessage("Network maksimal 50 karakter")
            .When(x => !string.IsNullOrEmpty(x.Network));
    }
}
