using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Singleton configuration document for Smart Browser pricing.
/// Only one document should exist in the collection with Id "pricing_default".
/// </summary>
[BsonIgnoreExtraElements]
public class BrowserPricing
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = "pricing_default";

    /// <summary>
    /// Price per hour in IDR (e.g. 10000 = Rp 10.000/jam)
    /// </summary>
    [BsonElement("pricePerHourIdr")]
    public long PricePerHourIdr { get; set; }

    /// <summary>
    /// Billing interval in minutes (e.g. 1 = per menit)
    /// </summary>
    [BsonElement("billingIntervalMinutes")]
    public int BillingIntervalMinutes { get; set; } = 1;

    /// <summary>
    /// Minimum wallet balance required to start a session (IDR)
    /// </summary>
    [BsonElement("minBalanceToStartIdr")]
    public long MinBalanceToStartIdr { get; set; }

    /// <summary>
    /// Maximum number of concurrent sessions per user
    /// </summary>
    [BsonElement("maxConcurrentSessions")]
    public int MaxConcurrentSessions { get; set; } = 2;

    /// <summary>
    /// Maximum session duration in minutes (e.g. 720 = 12 jam)
    /// </summary>
    [BsonElement("maxSessionDurationMinutes")]
    public int MaxSessionDurationMinutes { get; set; } = 720;

    /// <summary>
    /// Feature flag — set to false to disable Smart Browser
    /// </summary>
    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
