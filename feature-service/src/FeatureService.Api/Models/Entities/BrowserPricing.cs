namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Singleton configuration document for Smart Browser pricing.
/// Only one document should exist in the collection with Id "pricing_default".
/// </summary>
public class BrowserPricing
{
    public string Id { get; set; } = "pricing_default";

    /// <summary>
    /// Price per hour in IDR (e.g. 10000 = Rp 10.000/jam)
    /// </summary>
    public long PricePerHourIdr { get; set; }

    /// <summary>
    /// Billing interval in minutes (e.g. 1 = per menit)
    /// </summary>
    public int BillingIntervalMinutes { get; set; } = 1;

    /// <summary>
    /// Minimum wallet balance required to start a session (IDR)
    /// </summary>
    public long MinBalanceToStartIdr { get; set; }

    /// <summary>
    /// Maximum number of concurrent sessions per user
    /// </summary>
    public int MaxConcurrentSessions { get; set; } = 2;

    /// <summary>
    /// Maximum session duration in minutes (e.g. 720 = 12 jam)
    /// </summary>
    public int MaxSessionDurationMinutes { get; set; } = 720;

    /// <summary>
    /// Feature flag — set to false to disable Smart Browser
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
