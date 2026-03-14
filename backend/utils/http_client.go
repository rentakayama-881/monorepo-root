package utils

import (
	"net/http"
	"time"

	"backend-gin/config"
)

// DefaultHTTPClient is a shared HTTP client with standard timeout (10s).
// Use for most internal service calls.
var DefaultHTTPClient = &http.Client{
	Timeout: config.HTTPClientTimeout,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	},
}

// LongHTTPClient is a shared HTTP client with longer timeout (30s).
// Use for operations that may take longer (file uploads, account deletion).
var LongHTTPClient = &http.Client{
	Timeout: config.HTTPLongTimeout,
	Transport: &http.Transport{
		MaxIdleConns:        50,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	},
}
