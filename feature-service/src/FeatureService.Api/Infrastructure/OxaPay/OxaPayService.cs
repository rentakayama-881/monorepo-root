using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FeatureService.Api.Infrastructure.OxaPay;

/// <summary>
/// HTTP client for OxaPay crypto payment gateway.
/// Handles white-label payment creation (deposits) and payout creation (withdrawals).
/// </summary>
public interface IOxaPayService
{
    Task<OxaPayWhiteLabelResponse> CreateWhiteLabelPaymentAsync(OxaPayWhiteLabelRequest request);
    Task<OxaPayPayoutResponse> CreatePayoutAsync(OxaPayPayoutRequest request);

    /// <summary>
    /// Get the current price of a crypto currency in IDR.
    /// Returns the price of 1 unit of the currency in IDR.
    /// </summary>
    Task<decimal?> GetCryptoPriceInIdrAsync(string cryptoCurrency);
}

public class OxaPayService : IOxaPayService
{
    private readonly HttpClient _httpClient;
    private readonly OxaPaySettings _settings;
    private readonly ILogger<OxaPayService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    public OxaPayService(HttpClient httpClient, OxaPaySettings settings, ILogger<OxaPayService> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _logger = logger;

        _httpClient.BaseAddress = new Uri(_settings.BaseUrl.TrimEnd('/') + "/");
        _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<OxaPayWhiteLabelResponse> CreateWhiteLabelPaymentAsync(OxaPayWhiteLabelRequest request)
    {
        _logger.LogInformation(
            "Creating OxaPay white-label payment: amount={Amount}, currency={Currency}, payCurrency={PayCurrency}, orderId={OrderId}",
            request.Amount, request.Currency, request.PayCurrency, request.OrderId);

        var jsonContent = JsonSerializer.Serialize(request, JsonOptions);
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "payment/white-label")
        {
            Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Add("merchant_api_key", _settings.MerchantApiKey);

        var response = await _httpClient.SendAsync(httpRequest);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogDebug("OxaPay white-label response: {StatusCode} {Body}", response.StatusCode, responseBody);

        var result = JsonSerializer.Deserialize<OxaPayWhiteLabelResponse>(responseBody, JsonOptions);
        if (result == null)
        {
            throw new InvalidOperationException("Gagal memproses respons dari OxaPay");
        }

        if (result.Status != 200)
        {
            var errorMsg = result.Error?.Message ?? result.Message ?? "Unknown OxaPay error";
            _logger.LogError("OxaPay white-label failed: status={Status}, error={Error}", result.Status, errorMsg);
            throw new OxaPayException(result.Status, errorMsg);
        }

        return result;
    }

    public async Task<OxaPayPayoutResponse> CreatePayoutAsync(OxaPayPayoutRequest request)
    {
        _logger.LogInformation(
            "Creating OxaPay payout: amount={Amount}, currency={Currency}, address={Address}",
            request.Amount, request.Currency, MaskAddress(request.Address));

        var jsonContent = JsonSerializer.Serialize(request, JsonOptions);
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "payout")
        {
            Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Add("payout_api_key", _settings.PayoutApiKey);

        var response = await _httpClient.SendAsync(httpRequest);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogDebug("OxaPay payout response: {StatusCode} {Body}", response.StatusCode, responseBody);

        var result = JsonSerializer.Deserialize<OxaPayPayoutResponse>(responseBody, JsonOptions);
        if (result == null)
        {
            throw new InvalidOperationException("Gagal memproses respons dari OxaPay");
        }

        if (result.Status != 200)
        {
            var errorMsg = result.Error?.Message ?? result.Message ?? "Unknown OxaPay error";
            _logger.LogError("OxaPay payout failed: status={Status}, error={Error}", result.Status, errorMsg);
            throw new OxaPayException(result.Status, errorMsg);
        }

        return result;
    }

    public async Task<decimal?> GetCryptoPriceInIdrAsync(string cryptoCurrency)
    {
        var coinId = cryptoCurrency.ToUpperInvariant() switch
        {
            "USDT" => "tether",
            "TON" => "the-open-network",
            _ => null
        };

        if (coinId == null) return null;

        try
        {
            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var url = $"https://api.coingecko.com/api/v3/simple/price?ids={coinId}&vs_currencies=idr";
            var response = await httpClient.GetStringAsync(url);
            var doc = System.Text.Json.JsonDocument.Parse(response);

            if (doc.RootElement.TryGetProperty(coinId, out var coinObj) &&
                coinObj.TryGetProperty("idr", out var idrPrice))
            {
                return idrPrice.GetDecimal();
            }

            _logger.LogWarning("CoinGecko price not found for {CoinId}", coinId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch crypto price for {Currency} from CoinGecko", cryptoCurrency);
            return null;
        }
    }

    private static string MaskAddress(string address)
    {
        if (string.IsNullOrEmpty(address) || address.Length <= 10)
            return "***";
        return address[..6] + "..." + address[^4..];
    }
}

// ==================
// REQUEST DTOs
// ==================

public class OxaPayWhiteLabelRequest
{
    public string PayCurrency { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? Network { get; set; }
    public int? Lifetime { get; set; }
    public decimal? FeePaidByPayer { get; set; }
    public decimal? UnderPaidCoverage { get; set; }
    public string? ToCurrency { get; set; }
    public string? CallbackUrl { get; set; }
    public string? OrderId { get; set; }
    public string? Description { get; set; }
}

public class OxaPayPayoutRequest
{
    public string Address { get; set; } = null!;
    public string Currency { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Network { get; set; }
    public string? CallbackUrl { get; set; }
    public string? Memo { get; set; }
    public string? Description { get; set; }
}

// ==================
// RESPONSE DTOs
// ==================

public class OxaPayWhiteLabelResponse
{
    public OxaPayWhiteLabelData? Data { get; set; }
    public string? Message { get; set; }
    public OxaPayError? Error { get; set; }
    public int Status { get; set; }
    public string? Version { get; set; }
}

public class OxaPayWhiteLabelData
{
    public string TrackId { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public decimal PayAmount { get; set; }
    public string PayCurrency { get; set; } = null!;
    public string? Network { get; set; }
    public string Address { get; set; } = null!;
    public string? CallbackUrl { get; set; }
    public string? Description { get; set; }
    public decimal? FeePaidByPayer { get; set; }
    public int? Lifetime { get; set; }
    public string? OrderId { get; set; }
    public decimal? UnderPaidCoverage { get; set; }
    public decimal? Rate { get; set; }
    public string? QrCode { get; set; }
    public long ExpiredAt { get; set; }
    public long Date { get; set; }
}

public class OxaPayPayoutResponse
{
    public OxaPayPayoutData? Data { get; set; }
    public string? Message { get; set; }
    public OxaPayError? Error { get; set; }
    public int Status { get; set; }
    public string? Version { get; set; }
}

public class OxaPayPayoutData
{
    public string TrackId { get; set; } = null!;
    public string? Status { get; set; }
}

public class OxaPayError
{
    public string? Type { get; set; }
    public string? Key { get; set; }
    public string? Message { get; set; }
}

/// <summary>
/// OxaPay callback payload (shared structure for payment and payout callbacks).
/// </summary>
public class OxaPayCallbackPayload
{
    public string? TrackId { get; set; }
    public string? Status { get; set; }
    public string? PayCurrency { get; set; }
    public decimal? PayAmount { get; set; }
    public string? Network { get; set; }
    public string? Address { get; set; }
    public string? OrderId { get; set; }
    public decimal? Price { get; set; }
    public decimal? Amount { get; set; }
    public string? Currency { get; set; }
    public decimal? FeePaidByPayer { get; set; }
    public decimal? UnderPaidCoverage { get; set; }
    public decimal? ReceivedAmount { get; set; }
    public string? TxId { get; set; }
    public string? Type { get; set; }
    public string? Description { get; set; }
    public string? Email { get; set; }
    public long? Date { get; set; }
    public long? ExpiredAt { get; set; }
    [JsonPropertyName("hmac")]
    public string? Hmac { get; set; }
}

// ==================
// EXCEPTION
// ==================

public class OxaPayException : Exception
{
    public int StatusCode { get; }

    public OxaPayException(int statusCode, string message)
        : base(message)
    {
        StatusCode = statusCode;
    }
}
