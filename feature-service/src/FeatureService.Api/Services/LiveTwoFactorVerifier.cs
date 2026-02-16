using System.Text.Json;

namespace FeatureService.Api.Services;

/// <summary>
/// Verifies 2FA status by calling the Go backend live,
/// instead of trusting the (potentially stale) JWT claim.
/// </summary>
public interface ITwoFactorVerifier
{
    /// <summary>
    /// Returns true only if the Go backend confirms 2FA is currently enabled.
    /// Fail-closed: returns false on any error, timeout, or unexpected response.
    /// </summary>
    Task<bool> IsEnabledLiveAsync(string authorizationHeader);
}

public class LiveTwoFactorVerifier : ITwoFactorVerifier
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LiveTwoFactorVerifier> _logger;

    public LiveTwoFactorVerifier(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<LiveTwoFactorVerifier> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> IsEnabledLiveAsync(string authorizationHeader)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader))
            return false;

        var backendUrl = (_configuration["Backend:ApiUrl"]
                          ?? _configuration["GoBackend:BaseUrl"]
                          ?? "http://127.0.0.1:8080").TrimEnd('/');

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{backendUrl}/api/auth/totp/status");
            request.Headers.TryAddWithoutValidation("Authorization", authorizationHeader);

            using var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Live 2FA check returned HTTP {StatusCode} from Go backend",
                    (int)response.StatusCode);
                return false;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (doc.RootElement.TryGetProperty("enabled", out var prop) && prop.ValueKind == JsonValueKind.True)
                return true;

            // Also handle PascalCase variant from possible serializer differences
            if (doc.RootElement.TryGetProperty("Enabled", out var propPascal) && propPascal.ValueKind == JsonValueKind.True)
                return true;

            return false;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Live 2FA check timed out calling Go backend");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Live 2FA check failed unexpectedly");
            return false;
        }
    }
}
