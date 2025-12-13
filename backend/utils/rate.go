package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"sync"
	"time"
)

var (
	rateHTTP = &http.Client{Timeout: 12 * time.Second}

	rateMu    sync.Mutex
	rateCache = map[string]cachedRate{} // key: coinGeckoID
)

type cachedRate struct {
	rate float64
	exp  time.Time
}

// GetTokenToIDRRate mengambil kurs CoinGecko (simple/price) untuk 1 coinGeckoID -> IDR.
// Ada cache TTL untuk menghindari rate-limit.
func GetTokenToIDRRate(coinGeckoID string) (float64, error) {
	if coinGeckoID == "" {
		return 0, errors.New("coinGeckoID kosong")
	}

	ttl := getCacheTTL()

	// 1) Cache hit
	now := time.Now()
	rateMu.Lock()
	if cr, ok := rateCache[coinGeckoID]; ok && now.Before(cr.exp) && cr.rate > 0 {
		r := cr.rate
		rateMu.Unlock()
		return r, nil
	}
	rateMu.Unlock()

	// 2) Build URL dengan query encoding yang benar
	base := os.Getenv("COINGECKO_BASE_URL")
	if base == "" {
		base = "https://api.coingecko.com/api/v3/simple/price"
	}
	u, err := url.Parse(base)
	if err != nil {
		return 0, fmt.Errorf("invalid COINGECKO_BASE_URL: %w", err)
	}
	q := u.Query()
	q.Set("ids", coinGeckoID)
	q.Set("vs_currencies", "idr")
	u.RawQuery = q.Encode()

	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "backend-gin/1.0")

	resp, err := rateHTTP.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	// 3) Cek status code
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// ambil sedikit body untuk debug (hindari read besar)
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		if resp.StatusCode == 429 {
			return 0, fmt.Errorf("coingecko rate limited (429): %s", string(b))
		}
		return 0, fmt.Errorf("coingecko status %d: %s", resp.StatusCode, string(b))
	}

	// 4) Decode & validasi response
	var data map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return 0, err
	}
	row, ok := data[coinGeckoID]
	if !ok {
		return 0, fmt.Errorf("coingecko response missing id=%s", coinGeckoID)
	}
	r, ok := row["idr"]
	if !ok || r <= 0 {
		return 0, fmt.Errorf("coingecko response missing/invalid idr for id=%s", coinGeckoID)
	}

	// 5) Update cache
	rateMu.Lock()
	rateCache[coinGeckoID] = cachedRate{rate: r, exp: now.Add(ttl)}
	rateMu.Unlock()

	return r, nil
}

func getCacheTTL() time.Duration {
	// default 60 detik
	ttlSec := int64(60)
	if v := os.Getenv("RATE_CACHE_TTL_SECONDS"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 && n <= 3600 {
			ttlSec = n
		}
	}
	return time.Duration(ttlSec) * time.Second
}

