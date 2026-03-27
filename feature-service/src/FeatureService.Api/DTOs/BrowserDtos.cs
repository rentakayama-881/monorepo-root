namespace FeatureService.Api.DTOs;

// ──────────────────────────────────────────────────────────────
// Browser Profile DTOs
// ──────────────────────────────────────────────────────────────

public record CreateBrowserProfileRequest(
    string Name,
    string? ProxyServer,
    string? ProxyUsername,
    string? ProxyPassword,
    string? Notes
);

public record UpdateBrowserProfileRequest(
    string? Name,
    string? ProxyServer,
    string? ProxyUsername,
    string? ProxyPassword,
    string? Notes
);

public record BrowserFingerprintDto(
    string GpuVendor,
    string GpuRenderer,
    int ScreenWidth,
    int ScreenHeight,
    int ColorDepth,
    string Platform,
    string Timezone,
    string Language
);

public record BrowserProfileDto(
    string Id,
    string Name,
    string? ProxyServer,
    bool HasProxy,
    string UserAgentPreset,
    BrowserFingerprintDto Fingerprint,
    string? Notes,
    DateTime? LastSessionAt,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record BrowserProfileListResponse(
    List<BrowserProfileDto> Profiles,
    int Total
);

// ──────────────────────────────────────────────────────────────
// Browser Session DTOs
// ──────────────────────────────────────────────────────────────

public record StartBrowserSessionRequest(
    string ProfileId
);

public record StartBrowserSessionResponse(
    string SessionId,
    string ProfileName,
    string VncWsUrl,
    string Status
);

public record StopBrowserSessionResponse(
    string SessionId,
    string Status,
    int BilledMinutes,
    long TotalCost
);

public record BrowserSessionDto(
    string Id,
    string ProfileId,
    string ProfileName,
    string Status,
    string? VncWsUrl,
    DateTime StartedAt,
    DateTime? StoppedAt,
    int BilledMinutes,
    long TotalCost,
    string? StopReason
);

public record BrowserSessionListResponse(
    List<BrowserSessionDto> Sessions,
    int Total
);

// ──────────────────────────────────────────────────────────────
// Browser Billing DTOs
// ──────────────────────────────────────────────────────────────

/// <summary>
/// Internal billing tick request from Browser Service
/// </summary>
public record BrowserBillingTickRequest(
    string SessionId,
    uint UserId,
    int MinutesToBill
);

public record BrowserBillingTickResponse(
    bool Success,
    long RemainingBalance,
    bool ShouldStop,
    string? Reason
);

// ──────────────────────────────────────────────────────────────
// Browser Pricing DTOs
// ──────────────────────────────────────────────────────────────

public record BrowserPricingDto(
    long PricePerHourIdr,
    int BillingIntervalMinutes,
    long MinBalanceToStartIdr,
    int MaxConcurrentSessions,
    int MaxSessionDurationMinutes,
    bool IsActive
);
