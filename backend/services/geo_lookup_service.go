package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"backend-gin/database"
	"backend-gin/ent/ipgeocache"
	"backend-gin/logger"
	"go.uber.org/zap"
)

// GeoLookupService provides IP geolocation lookup with caching
type GeoLookupService struct {
	httpClient *http.Client
	mu         sync.RWMutex
	cache      map[string]*GeoLocation
}

// GeoLocation represents geographical location information for an IP
type GeoLocation struct {
	IP          string
	CountryCode string
	CountryName string
	City        string
	Latitude    float64
	Longitude   float64
	CachedAt    time.Time
}

// IPAPIResponse matches the response from ip-api.com
type IPAPIResponse struct {
	Status      string  `json:"status"`
	CountryCode string  `json:"countryCode"`
	Country     string  `json:"country"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Message     string  `json:"message"`
}

const (
	// GeoLookupTimeout is the timeout for geo-IP API calls
	GeoLookupTimeout = 2 * time.Second
	// GeoCacheTTL is how long to cache geo-IP results (7 days)
	GeoCacheTTL = 7 * 24 * time.Hour
)

// NewGeoLookupService creates a new geo lookup service
func NewGeoLookupService() *GeoLookupService {
	return &GeoLookupService{
		httpClient: &http.Client{
			Timeout: GeoLookupTimeout,
		},
		cache: make(map[string]*GeoLocation),
	}
}

// IsPrivateIP checks if an IP address is in a private range
func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	// Check RFC1918 private ranges
	if ip.IsPrivate() {
		return true
	}

	// Check loopback
	if ip.IsLoopback() {
		return true
	}

	// Check link-local
	if ip.IsLinkLocalUnicast() {
		return true
	}

	return false
}

// LookupIP looks up geographical information for an IP address
// Returns the location or nil if lookup fails (fail-open design)
func (g *GeoLookupService) LookupIP(ctx context.Context, ipStr string) *GeoLocation {
	if ipStr == "" {
		return nil
	}

	// Don't lookup private IPs
	if isPrivateIP(ipStr) {
		logger.Debug("Skipping geo lookup for private IP", zap.String("ip", ipStr))
		return nil
	}

	// Check in-memory cache first
	g.mu.RLock()
	if cached, exists := g.cache[ipStr]; exists {
		g.mu.RUnlock()
		// Check if cache is still valid
		if time.Since(cached.CachedAt) < GeoCacheTTL {
			return cached
		}
	}
	g.mu.RUnlock()

	// Check database cache
	client := database.GetEntClient()
	dbCache, err := client.IPGeoCache.
		Query().
		Where(ipgeocache.IPAddressEQ(ipStr)).
		Only(ctx)

	if err == nil {
		// Found in database cache
		loc := &GeoLocation{
			IP:          dbCache.IPAddress,
			CountryCode: dbCache.CountryCode,
			CountryName: dbCache.CountryName,
			City:        dbCache.City,
			Latitude:    dbCache.Latitude,
			Longitude:   dbCache.Longitude,
			CachedAt:    dbCache.CachedAt,
		}

		// Update in-memory cache
		g.mu.Lock()
		g.cache[ipStr] = loc
		g.mu.Unlock()

		return loc
	}

	// Not in cache, do API lookup
	loc, err := g.lookupIPAPI(ctx, ipStr)
	if err != nil {
		logger.Debug("Failed to lookup IP geo location", zap.String("ip", ipStr), zap.Error(err))
		return nil // Fail-open: return nil instead of blocking
	}

	// Cache in database
	go func() {
		cacheCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		now := time.Now()
		_, _ = client.IPGeoCache.
			Create().
			SetIPAddress(ipStr).
			SetCountryCode(loc.CountryCode).
			SetCountryName(loc.CountryName).
			SetCity(loc.City).
			SetLatitude(loc.Latitude).
			SetLongitude(loc.Longitude).
			SetCachedAt(now).
			Save(cacheCtx)
	}()

	// Cache in memory
	g.mu.Lock()
	g.cache[ipStr] = loc
	g.mu.Unlock()

	return loc
}

// lookupIPAPI performs the actual IP geolocation API lookup
func (g *GeoLookupService) lookupIPAPI(ctx context.Context, ipStr string) (*GeoLocation, error) {
	// Sanitize IP to prevent injection
	ipStr = strings.TrimSpace(ipStr)

	// Use ip-api.com (free tier: 45 requests/minute)
	apiURL := "http://ip-api.com/json/" + ipStr + "?fields=status,countryCode,country,city,lat,lon"

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result IPAPIResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if result.Status != "success" {
		logger.Debug("IP API lookup failed", zap.String("ip", ipStr), zap.String("message", result.Message))
		return nil, fmt.Errorf("ip-api lookup failed for %s: %s", ipStr, result.Message)
	}

	return &GeoLocation{
		IP:          ipStr,
		CountryCode: result.CountryCode,
		CountryName: result.Country,
		City:        result.City,
		Latitude:    result.Lat,
		Longitude:   result.Lon,
		CachedAt:    time.Now(),
	}, nil
}

// Global geo lookup service instance
var geoLookupService *GeoLookupService

// InitGeoLookupService initializes the global geo lookup service
func InitGeoLookupService() {
	geoLookupService = NewGeoLookupService()
	logger.Info("Geo lookup service initialized")
}

// GetGeoLookupService returns the global geo lookup service
func GetGeoLookupService() *GeoLookupService {
	if geoLookupService == nil {
		InitGeoLookupService()
	}
	return geoLookupService
}
