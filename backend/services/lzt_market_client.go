package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	// ErrLZTRequestInvalid indicates malformed request payload from caller.
	ErrLZTRequestInvalid = errors.New("lzt request invalid")
)

// LZTMarketRequest represents a proxied request to LZT Market API.
type LZTMarketRequest struct {
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	Query       map[string]string `json:"query"`
	ContentType string            `json:"content_type"` // "json" (default) or "form"
	JSONBody    interface{}       `json:"json_body"`
	FormBody    map[string]string `json:"form_body"`
}

// LZTMarketResponse wraps an upstream response.
type LZTMarketResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	JSON       interface{}       `json:"json,omitempty"`
	Raw        string            `json:"raw,omitempty"`
}

// LZTMarketClient performs authenticated calls to LZT Market API.
type LZTMarketClient struct {
	baseURL       string
	token         string
	timeout       time.Duration
	minInterval   time.Duration
	httpClient    *http.Client
	enabled       bool
	mu            sync.Mutex
	lastRequestAt time.Time
}

// NewLZTMarketClientFromEnv builds client from environment variables.
func NewLZTMarketClientFromEnv() *LZTMarketClient {
	baseURL := strings.TrimSpace(os.Getenv("LZT_MARKET_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://prod-api.lzt.market"
	}

	timeoutSeconds := readPositiveIntEnv("LZT_MARKET_TIMEOUT_SECONDS", 300)
	minIntervalMs := readPositiveIntEnv("LZT_MARKET_MIN_INTERVAL_MS", 200)
	insecureSkipVerify := readBoolEnv("LZT_MARKET_INSECURE_SKIP_VERIFY", false)
	token := strings.TrimSpace(os.Getenv("LZT_MARKET_TOKEN"))

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: insecureSkipVerify,
	}

	return &LZTMarketClient{
		baseURL:     strings.TrimRight(baseURL, "/"),
		token:       token,
		timeout:     time.Duration(timeoutSeconds) * time.Second,
		minInterval: time.Duration(minIntervalMs) * time.Millisecond,
		httpClient: &http.Client{
			Timeout:   time.Duration(timeoutSeconds) * time.Second,
			Transport: transport,
		},
		enabled: token != "",
	}
}

// IsEnabled returns true when token is configured.
func (c *LZTMarketClient) IsEnabled() bool {
	return c != nil && c.enabled
}

// BaseURL returns configured upstream URL.
func (c *LZTMarketClient) BaseURL() string {
	if c == nil {
		return ""
	}
	return c.baseURL
}

// Timeout returns request timeout.
func (c *LZTMarketClient) Timeout() time.Duration {
	if c == nil {
		return 0
	}
	return c.timeout
}

// MinInterval returns minimal delay between requests.
func (c *LZTMarketClient) MinInterval() time.Duration {
	if c == nil {
		return 0
	}
	return c.minInterval
}

// Do executes one request to LZT API.
func (c *LZTMarketClient) Do(ctx context.Context, reqInput LZTMarketRequest) (*LZTMarketResponse, error) {
	if c == nil || !c.enabled {
		return nil, fmt.Errorf("%w: LZT_MARKET_TOKEN not configured", ErrLZTRequestInvalid)
	}

	method := strings.ToUpper(strings.TrimSpace(reqInput.Method))
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete:
	default:
		return nil, fmt.Errorf("%w: unsupported method", ErrLZTRequestInvalid)
	}

	path := strings.TrimSpace(reqInput.Path)
	if path == "" || !strings.HasPrefix(path, "/") || strings.Contains(path, "://") {
		return nil, fmt.Errorf("%w: invalid path", ErrLZTRequestInvalid)
	}

	fullURL, err := url.Parse(c.baseURL + path)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid url", ErrLZTRequestInvalid)
	}
	query := fullURL.Query()
	for k, v := range reqInput.Query {
		key := strings.TrimSpace(k)
		if key == "" {
			continue
		}
		query.Set(key, v)
	}
	fullURL.RawQuery = query.Encode()

	var body io.Reader
	contentType := strings.ToLower(strings.TrimSpace(reqInput.ContentType))
	if contentType == "" {
		contentType = "json"
	}

	switch contentType {
	case "json":
		if reqInput.JSONBody != nil {
			b, err := json.Marshal(reqInput.JSONBody)
			if err != nil {
				return nil, fmt.Errorf("%w: invalid json_body", ErrLZTRequestInvalid)
			}
			body = bytes.NewReader(b)
		}
	case "form":
		if len(reqInput.FormBody) > 0 {
			val := url.Values{}
			for k, v := range reqInput.FormBody {
				if strings.TrimSpace(k) == "" {
					continue
				}
				val.Set(k, v)
			}
			body = strings.NewReader(val.Encode())
		}
	default:
		return nil, fmt.Errorf("%w: content_type must be json or form", ErrLZTRequestInvalid)
	}

	if err := c.waitForRateLimit(); err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, method, fullURL.String(), body)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.token)
	httpReq.Header.Set("Accept", "application/json")
	switch contentType {
	case "form":
		httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	default:
		httpReq.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	out := &LZTMarketResponse{
		StatusCode: resp.StatusCode,
		Headers: map[string]string{
			"content-type": resp.Header.Get("Content-Type"),
		},
	}

	ct := strings.ToLower(resp.Header.Get("Content-Type"))
	if strings.Contains(ct, "application/json") && len(bodyBytes) > 0 {
		var parsed interface{}
		if err := json.Unmarshal(bodyBytes, &parsed); err == nil {
			out.JSON = parsed
			return out, nil
		}
	}
	out.Raw = string(bodyBytes)
	return out, nil
}

func (c *LZTMarketClient) waitForRateLimit() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.lastRequestAt.IsZero() {
		c.lastRequestAt = time.Now()
		return nil
	}

	wait := c.minInterval - time.Since(c.lastRequestAt)
	if wait > 0 {
		timer := time.NewTimer(wait)
		defer timer.Stop()
		<-timer.C
	}
	c.lastRequestAt = time.Now()
	return nil
}

func readPositiveIntEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func readBoolEnv(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return v
}
