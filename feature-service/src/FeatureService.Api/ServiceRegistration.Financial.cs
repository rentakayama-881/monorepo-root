using Serilog;
using FeatureService.Api.Services;

namespace FeatureService.Api;

public static class ServiceRegistrationFinancial
{
    public static WebApplicationBuilder AddFinancialServices(this WebApplicationBuilder builder)
    {
        // Core financial services
        builder.Services.AddScoped<IWalletService, WalletService>();
        builder.Services.AddScoped<IMarketPurchaseWalletService, MarketPurchaseWalletService>();
        builder.Services.AddScoped<IGuaranteeService, GuaranteeService>();
        builder.Services.AddHttpClient<IGuaranteeService, GuaranteeService>();
        builder.Services.AddScoped<ILedgerBackfillService, LedgerBackfillService>();
        builder.Services.AddScoped<ITransferService, TransferService>();
        builder.Services.AddHttpClient<ITransferService, TransferService>();
        builder.Services.AddHostedService<TransferAutoReleaseHostedService>();
        builder.Services.AddScoped<IDisputeService, DisputeService>();
        builder.Services.AddHttpClient<IDisputeService, DisputeService>();

        // OxaPay crypto payment gateway
        var oxaPaySettings = new FeatureService.Api.Infrastructure.OxaPay.OxaPaySettings();
        builder.Configuration.GetSection("OxaPay").Bind(oxaPaySettings);
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OXAPAY__MERCHANTAPIKEY")))
            oxaPaySettings.MerchantApiKey = Environment.GetEnvironmentVariable("OXAPAY__MERCHANTAPIKEY")!;
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OXAPAY__PAYOUTAPIKEY")))
            oxaPaySettings.PayoutApiKey = Environment.GetEnvironmentVariable("OXAPAY__PAYOUTAPIKEY")!;
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OXAPAY__CALLBACKBASEURL")))
            oxaPaySettings.CallbackBaseUrl = Environment.GetEnvironmentVariable("OXAPAY__CALLBACKBASEURL")!;
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OXAPAY__DEFAULTPAYCURRENCY")))
            oxaPaySettings.DefaultPayCurrency = Environment.GetEnvironmentVariable("OXAPAY__DEFAULTPAYCURRENCY")!;
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OXAPAY__DEFAULTNETWORK")))
            oxaPaySettings.DefaultNetwork = Environment.GetEnvironmentVariable("OXAPAY__DEFAULTNETWORK")!;
        builder.Services.AddSingleton(oxaPaySettings);
        builder.Services.AddHttpClient<FeatureService.Api.Infrastructure.OxaPay.IOxaPayService,
            FeatureService.Api.Infrastructure.OxaPay.OxaPayService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(oxaPaySettings.TimeoutSeconds);
        });

        // Crypto pricing service (multi-source: Binance + CoinGecko + cache)
        builder.Services.AddSingleton<ICryptoPricingService, CryptoPricingService>();

        // Deposit & Withdrawal services (using OxaPay)
        builder.Services.AddScoped<IDepositService, DepositService>();
        builder.Services.AddScoped<IWithdrawalService, WithdrawalService>();

        // Secure Transfer and Withdrawal services (with idempotency and audit)
        builder.Services.AddScoped<ISecureTransferService, SecureTransferService>();
        builder.Services.AddScoped<ISecureWithdrawalService, SecureWithdrawalService>();

        // Smart Browser services
        builder.Services.AddScoped<IBrowserProfileService, BrowserProfileService>();
        builder.Services.AddScoped<IBrowserSessionService, BrowserSessionService>();
        builder.Services.AddScoped<IBrowserBillingService, BrowserBillingService>();

        return builder;
    }
}
