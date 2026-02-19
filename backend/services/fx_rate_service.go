package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type FXRateService struct {
	client   *http.Client
	cacheTTL time.Duration

	mu       sync.RWMutex
	cached   map[string]float64
	cachedAt time.Time
}

type exchangeRateHostResponse struct {
	Success bool               `json:"success"`
	Rates   map[string]float64 `json:"rates"`
}

func NewFXRateServiceFromEnv() *FXRateService {
	ttlSeconds := 180
	if raw := strings.TrimSpace(os.Getenv("MARKET_FX_CACHE_SECONDS")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			ttlSeconds = n
		}
	}

	return &FXRateService{
		client:   &http.Client{Timeout: 8 * time.Second},
		cacheTTL: time.Duration(ttlSeconds) * time.Second,
		cached:   make(map[string]float64),
	}
}

func (s *FXRateService) ConvertToIDR(amount float64, sourceCurrency string) (float64, float64, error) {
	if amount <= 0 {
		return 0, 0, fmt.Errorf("invalid amount")
	}

	currency := strings.ToUpper(strings.TrimSpace(sourceCurrency))
	if currency == "" {
		currency = "RUB"
	}
	if currency == "IDR" {
		return amount, 1, nil
	}

	rate, err := s.getRateToIDR(currency)
	if err != nil {
		return 0, 0, err
	}
	return amount * rate, rate, nil
}

func (s *FXRateService) getRateToIDR(currency string) (float64, error) {
	s.mu.RLock()
	if time.Since(s.cachedAt) <= s.cacheTTL {
		if rate, ok := s.cached[currency]; ok && rate > 0 {
			s.mu.RUnlock()
			return rate, nil
		}
	}
	s.mu.RUnlock()

	if err := s.refreshRates(currency); err != nil {
		// fallback to stale cache if available
		s.mu.RLock()
		rate, ok := s.cached[currency]
		s.mu.RUnlock()
		if ok && rate > 0 {
			return rate, nil
		}
		return 0, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	rate, ok := s.cached[currency]
	if !ok || rate <= 0 {
		return 0, fmt.Errorf("rate for %s is unavailable", currency)
	}
	return rate, nil
}

func (s *FXRateService) refreshRates(baseCurrency string) error {
	endpoint := strings.TrimSpace(os.Getenv("MARKET_FX_API_URL_TEMPLATE"))
	if endpoint == "" {
		endpoint = "https://open.er-api.com/v6/latest/{base}"
	}
	url := strings.ReplaceAll(endpoint, "{base}", baseCurrency)

	resp, err := s.client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("fx provider returned status %d", resp.StatusCode)
	}

	var parsed exchangeRateHostResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return err
	}

	rate := parsed.Rates["IDR"]
	if rate <= 0 {
		return fmt.Errorf("invalid fx rate")
	}

	s.mu.Lock()
	s.cached[baseCurrency] = rate
	s.cachedAt = time.Now()
	s.mu.Unlock()

	return nil
}
