namespace FeatureService.Api.Infrastructure.OxaPay;

/// <summary>
/// Configuration settings for OxaPay crypto payment gateway integration.
/// Bound from configuration section "OxaPay" with environment variable overrides.
/// </summary>
public class OxaPaySettings
{
    /// <summary>
    /// Merchant API key for white-label payment (deposit) operations.
    /// </summary>
    public string MerchantApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Payout API key for withdrawal operations.
    /// </summary>
    public string PayoutApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Base URL for OxaPay API. Default: https://api.oxapay.com/v1
    /// </summary>
    public string BaseUrl { get; set; } = "https://api.oxapay.com/v1";

    /// <summary>
    /// Base URL for callback endpoints (Feature Service public URL).
    /// Used to construct callback URLs sent to OxaPay.
    /// </summary>
    public string CallbackBaseUrl { get; set; } = "https://feature.aivalid.id";

    /// <summary>
    /// Default cryptocurrency for payments (e.g., "USDT", "TON").
    /// </summary>
    public string DefaultPayCurrency { get; set; } = "USDT";

    /// <summary>
    /// Default blockchain network. Empty = OxaPay default for the currency.
    /// </summary>
    public string DefaultNetwork { get; set; } = string.Empty;

    /// <summary>
    /// Payment link lifetime in minutes (15-2880). Default: 60 minutes.
    /// </summary>
    public int PaymentLifetimeMinutes { get; set; } = 60;

    /// <summary>
    /// Underpaid coverage percentage (0-60). Determines acceptable payment shortfall.
    /// </summary>
    public decimal UnderPaidCoverage { get; set; } = 2.0m;

    /// <summary>
    /// HTTP request timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 30;
}
