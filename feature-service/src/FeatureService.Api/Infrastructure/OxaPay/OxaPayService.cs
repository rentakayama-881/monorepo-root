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

    /// <summary>
    /// Verify a payment by calling OxaPay GET /payment/{trackId}.
    /// Returns the actual payment status from OxaPay, or null if verification fails.
    /// </summary>
    Task<OxaPayPaymentInfo?> VerifyPaymentAsync(string trackId);

    /// <summary>
    /// Validate HMAC signature of an OxaPay callback payload.
    /// Computes HMAC-SHA512 of the payload using MerchantApiKey and compares with the provided hmac.
    /// </summary>
    bool ValidateCallbackHmac(OxaPayCallbackPayload payload);
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

    public async Task<OxaPayPaymentInfo?> VerifyPaymentAsync(string trackId)
    {
        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Get, $"payment/{trackId}");
            httpRequest.Headers.Add("merchant_api_key", _settings.MerchantApiKey);

            var response = await _httpClient.SendAsync(httpRequest);
            var responseBody = await response.Content.ReadAsStringAsync();

            _logger.LogDebug("OxaPay verify payment response: {StatusCode} {Body}", response.StatusCode, responseBody);

            var result = JsonSerializer.Deserialize<OxaPayPaymentInfoResponse>(responseBody, JsonOptions);
            if (result?.Status != 200 || result.Data == null)
            {
                _logger.LogWarning("OxaPay payment verification failed for trackId={TrackId}: status={Status}",
                    trackId, result?.Status);
                return null;
            }

            return result.Data;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OxaPay payment verification error for trackId={TrackId}", trackId);
            return null;
        }
    }

    public bool ValidateCallbackHmac(OxaPayCallbackPayload payload)
    {
        if (string.IsNullOrEmpty(payload.Hmac))
            return false;

        var hmacData = BuildHmacData(payload);
        using var hmac = new System.Security.Cryptography.HMACSHA512(
            Encoding.UTF8.GetBytes(_settings.MerchantApiKey));
        var computedBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(hmacData));
        var computedHmac = Convert.ToHexString(computedBytes).ToLowerInvariant();

        return System.Security.Cryptography.CryptographicOperations
            .FixedTimeEquals(
                Encoding.UTF8.GetBytes(computedHmac),
                Encoding.UTF8.GetBytes(payload.Hmac.ToLowerInvariant()));
    }

    private static string BuildHmacData(OxaPayCallbackPayload payload)
    {
        // Build sorted key=value pairs from non-null, non-hmac fields
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal);

        if (payload.TrackId != null) fields["track_id"] = payload.TrackId;
        if (payload.Status != null) fields["status"] = payload.Status;
        if (payload.PayCurrency != null) fields["pay_currency"] = payload.PayCurrency;
        if (payload.PayAmount != null) fields["pay_amount"] = payload.PayAmount.Value.ToString("G");
        if (payload.Network != null) fields["network"] = payload.Network;
        if (payload.Address != null) fields["address"] = payload.Address;
        if (payload.OrderId != null) fields["order_id"] = payload.OrderId;
        if (payload.Price != null) fields["price"] = payload.Price.Value.ToString("G");
        if (payload.Amount != null) fields["amount"] = payload.Amount.Value.ToString("G");
        if (payload.Currency != null) fields["currency"] = payload.Currency;
        if (payload.FeePaidByPayer != null) fields["fee_paid_by_payer"] = payload.FeePaidByPayer.Value.ToString("G");
        if (payload.UnderPaidCoverage != null) fields["under_paid_coverage"] = payload.UnderPaidCoverage.Value.ToString("G");
        if (payload.ReceivedAmount != null) fields["received_amount"] = payload.ReceivedAmount.Value.ToString("G");
        if (payload.TxId != null) fields["txID"] = payload.TxId;
        if (payload.Type != null) fields["type"] = payload.Type;
        if (payload.Description != null) fields["description"] = payload.Description;
        if (payload.Email != null) fields["email"] = payload.Email;
        if (payload.Date != null) fields["date"] = payload.Date.Value.ToString();
        if (payload.ExpiredAt != null) fields["expired_at"] = payload.ExpiredAt.Value.ToString();

        return string.Join("&", fields.Select(kv => $"{kv.Key}={kv.Value}"));
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
    [JsonPropertyName("track_id")]
    public string? TrackId { get; set; }
    [JsonPropertyName("status")]
    public string? Status { get; set; }
    [JsonPropertyName("pay_currency")]
    public string? PayCurrency { get; set; }
    [JsonPropertyName("pay_amount")]
    public decimal? PayAmount { get; set; }
    [JsonPropertyName("network")]
    public string? Network { get; set; }
    [JsonPropertyName("address")]
    public string? Address { get; set; }
    [JsonPropertyName("order_id")]
    public string? OrderId { get; set; }
    [JsonPropertyName("price")]
    public decimal? Price { get; set; }
    [JsonPropertyName("amount")]
    public decimal? Amount { get; set; }
    [JsonPropertyName("currency")]
    public string? Currency { get; set; }
    [JsonPropertyName("fee_paid_by_payer")]
    public decimal? FeePaidByPayer { get; set; }
    [JsonPropertyName("under_paid_coverage")]
    public decimal? UnderPaidCoverage { get; set; }
    [JsonPropertyName("received_amount")]
    public decimal? ReceivedAmount { get; set; }
    [JsonPropertyName("txID")]
    public string? TxId { get; set; }
    [JsonPropertyName("type")]
    public string? Type { get; set; }
    [JsonPropertyName("description")]
    public string? Description { get; set; }
    [JsonPropertyName("email")]
    public string? Email { get; set; }
    [JsonPropertyName("date")]
    public long? Date { get; set; }
    [JsonPropertyName("expired_at")]
    public long? ExpiredAt { get; set; }
    [JsonPropertyName("hmac")]
    public string? Hmac { get; set; }
}

// ==================
// PAYMENT INFO (for server-side verification)
// ==================

public class OxaPayPaymentInfoResponse
{
    public OxaPayPaymentInfo? Data { get; set; }
    public string? Message { get; set; }
    public OxaPayError? Error { get; set; }
    public int Status { get; set; }
    public string? Version { get; set; }
}

public class OxaPayPaymentInfo
{
    public string? TrackId { get; set; }
    public string? Status { get; set; }
    public decimal? Amount { get; set; }
    public string? Currency { get; set; }
    public string? Type { get; set; }
    public string? OrderId { get; set; }
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
