using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace FeatureService.Api.Services;

/// <summary>
/// Multi-source crypto pricing with cache and retry.
/// Sources: Binance (primary) → CoinGecko (fallback) → emergency hardcoded (USDT only).
/// </summary>
public interface ICryptoPricingService
{
    /// <summary>
    /// Get the current price of 1 unit of a cryptocurrency in IDR.
    /// Uses multiple sources with fallback and caching.
    /// </summary>
    Task<decimal?> GetPriceInIdrAsync(string cryptoCurrency);
}

public class CryptoPricingService : ICryptoPricingService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<CryptoPricingService> _logger;

    private const int MaxRetries = 3;
    private const int CacheTtlSeconds = 60;
    private const int EmergencyCacheTtlSeconds = 300;
    private const int HttpTimeoutSeconds = 10;

    // Binance coin pair mapping
    private static readonly Dictionary<string, string> BinanceUsdtPairs = new()
    {
        ["USDT"] = "USDTBIDR",  // direct IDR pair
        ["TON"]  = "TONUSDT",   // needs USDT→IDR conversion
    };

    // CoinGecko coin ID mapping
    private static readonly Dictionary<string, string> CoinGeckoIds = new()
    {
        ["USDT"] = "tether",
        ["TON"]  = "the-open-network",
    };

    public CryptoPricingService(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<CryptoPricingService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<decimal?> GetPriceInIdrAsync(string cryptoCurrency)
    {
        var currency = cryptoCurrency.ToUpperInvariant();
        var cacheKey = $"crypto_price_idr:{currency}";
        var emergencyCacheKey = $"crypto_price_idr_emergency:{currency}";

        // 1. Check primary cache (60s TTL)
        if (_cache.TryGetValue(cacheKey, out decimal cachedPrice))
        {
            _logger.LogDebug("Price cache hit for {Currency}: {Price} IDR", currency, cachedPrice);
            return cachedPrice;
        }

        // 2. Try Binance (primary source)
        var price = await FetchFromBinanceWithRetryAsync(currency);

        // 3. Fallback to CoinGecko
        if (price == null)
        {
            _logger.LogWarning("Binance failed for {Currency}, trying CoinGecko", currency);
            price = await FetchFromCoinGeckoWithRetryAsync(currency);
        }

        // 4. If all live sources fail, try emergency cache (5 min TTL)
        if (price == null && _cache.TryGetValue(emergencyCacheKey, out decimal emergencyPrice))
        {
            _logger.LogWarning("All sources failed for {Currency}, using emergency cached price: {Price} IDR",
                currency, emergencyPrice);
            return emergencyPrice;
        }

        // 5. Last resort: USDT hardcoded (stablecoin ≈ Rp 16.300)
        if (price == null && currency == "USDT")
        {
            _logger.LogWarning("All sources failed for USDT, using emergency hardcoded rate");
            price = 16300m;
        }

        if (price == null)
        {
            _logger.LogError("Failed to get price for {Currency} from all sources", currency);
            return null;
        }

        // Cache the successful price
        _cache.Set(cacheKey, price.Value, TimeSpan.FromSeconds(CacheTtlSeconds));
        _cache.Set(emergencyCacheKey, price.Value, TimeSpan.FromSeconds(EmergencyCacheTtlSeconds));

        _logger.LogInformation("Crypto price for {Currency}: {Price} IDR (cached for {Ttl}s)",
            currency, price.Value, CacheTtlSeconds);

        return price;
    }

    // ── Binance ──────────────────────────────────────────────

    private async Task<decimal?> FetchFromBinanceWithRetryAsync(string currency)
    {
        for (int attempt = 1; attempt <= MaxRetries; attempt++)
        {
            try
            {
                var result = await FetchFromBinanceAsync(currency);
                if (result != null) return result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Binance attempt {Attempt}/{Max} failed for {Currency}",
                    attempt, MaxRetries, currency);
            }

            if (attempt < MaxRetries)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)); // 1s, 2s, 4s
                await Task.Delay(delay);
            }
        }
        return null;
    }

    private async Task<decimal?> FetchFromBinanceAsync(string currency)
    {
        if (!BinanceUsdtPairs.TryGetValue(currency, out var pair))
            return null;

        using var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(HttpTimeoutSeconds);

        if (currency == "USDT")
        {
            // Direct IDR pair: USDTBIDR
            var url = $"https://api.binance.com/api/v3/ticker/price?symbol={pair}";
            var json = await client.GetStringAsync(url);
            var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("price", out var priceEl))
            {
                if (decimal.TryParse(priceEl.GetString(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var price))
                    return price;
            }
        }
        else
        {
            // 2-step: get TON/USDT, then USDT/IDR
            var usdtPriceTask = GetBinanceTickerPriceAsync(client, pair);          // e.g. TONUSDT
            var idrRateTask = GetBinanceTickerPriceAsync(client, "USDTBIDR");       // USDT→IDR

            await Task.WhenAll(usdtPriceTask, idrRateTask);

            var usdtPrice = await usdtPriceTask;
            var idrRate = await idrRateTask;

            if (usdtPrice != null && idrRate != null)
                return usdtPrice.Value * idrRate.Value;
        }

        return null;
    }

    private static async Task<decimal?> GetBinanceTickerPriceAsync(HttpClient client, string symbol)
    {
        var url = $"https://api.binance.com/api/v3/ticker/price?symbol={symbol}";
        var json = await client.GetStringAsync(url);
        var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("price", out var priceEl))
        {
            if (decimal.TryParse(priceEl.GetString(), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var price))
                return price;
        }
        return null;
    }

    // ── CoinGecko ────────────────────────────────────────────

    private async Task<decimal?> FetchFromCoinGeckoWithRetryAsync(string currency)
    {
        for (int attempt = 1; attempt <= MaxRetries; attempt++)
        {
            try
            {
                var result = await FetchFromCoinGeckoAsync(currency);
                if (result != null) return result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CoinGecko attempt {Attempt}/{Max} failed for {Currency}",
                    attempt, MaxRetries, currency);
            }

            if (attempt < MaxRetries)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1));
                await Task.Delay(delay);
            }
        }
        return null;
    }

    private async Task<decimal?> FetchFromCoinGeckoAsync(string currency)
    {
        if (!CoinGeckoIds.TryGetValue(currency, out var coinId))
            return null;

        using var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(HttpTimeoutSeconds);

        var url = $"https://api.coingecko.com/api/v3/simple/price?ids={coinId}&vs_currencies=idr";
        var json = await client.GetStringAsync(url);
        var doc = JsonDocument.Parse(json);

        if (doc.RootElement.TryGetProperty(coinId, out var coinObj) &&
            coinObj.TryGetProperty("idr", out var idrPrice))
        {
            return idrPrice.GetDecimal();
        }

        return null;
    }
}
