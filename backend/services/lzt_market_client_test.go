package services

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func newJSONResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
}

func TestLZTMarketClient_DoUsesSearchRateLimitForChatGPTListings(t *testing.T) {
	t.Setenv("LZT_MARKET_BASE_URL", "https://provider.invalid")
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_SEARCH_MIN_INTERVAL_MS", "40")

	client := NewLZTMarketClientFromEnv()

	var mu sync.Mutex
	callTimes := make([]time.Time, 0, 3)
	callPaths := make([]string, 0, 3)
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			mu.Lock()
			callTimes = append(callTimes, time.Now())
			callPaths = append(callPaths, req.URL.Path)
			mu.Unlock()
			return newJSONResponse(`{"items":[]}`), nil
		}),
	}

	ctx := context.Background()
	if _, err := client.Do(ctx, LZTMarketRequest{Method: http.MethodGet, Path: "/chatgpt"}); err != nil {
		t.Fatalf("unexpected first search request error: %v", err)
	}
	if _, err := client.Do(ctx, LZTMarketRequest{Method: http.MethodGet, Path: "/chatgpt"}); err != nil {
		t.Fatalf("unexpected second search request error: %v", err)
	}
	if _, err := client.Do(ctx, LZTMarketRequest{Method: http.MethodPost, Path: "/123/fast-buy"}); err != nil {
		t.Fatalf("unexpected general request error: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(callTimes) != 3 {
		t.Fatalf("unexpected round trip count: got %d want 3", len(callTimes))
	}

	searchGap := callTimes[1].Sub(callTimes[0])
	if searchGap < 35*time.Millisecond {
		t.Fatalf("expected search requests to honor search limiter, got gap %s", searchGap)
	}

	generalGap := callTimes[2].Sub(callTimes[1])
	if generalGap >= 35*time.Millisecond {
		t.Fatalf("expected general request to use separate limiter, got gap %s", generalGap)
	}

	if callPaths[0] != "/chatgpt" || callPaths[1] != "/chatgpt" || callPaths[2] != "/123/fast-buy" {
		t.Fatalf("unexpected request paths: %v", callPaths)
	}
}

func TestLZTMarketClient_DoStopsWaitingWhenContextIsCanceled(t *testing.T) {
	t.Setenv("LZT_MARKET_BASE_URL", "https://provider.invalid")
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "80")
	t.Setenv("LZT_MARKET_SEARCH_MIN_INTERVAL_MS", "80")

	client := NewLZTMarketClientFromEnv()

	var mu sync.Mutex
	roundTrips := 0
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			mu.Lock()
			roundTrips++
			mu.Unlock()
			return newJSONResponse(`{"status":"ok"}`), nil
		}),
	}

	if _, err := client.Do(context.Background(), LZTMarketRequest{Method: http.MethodPost, Path: "/123/fast-buy"}); err != nil {
		t.Fatalf("unexpected first request error: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := client.Do(ctx, LZTMarketRequest{Method: http.MethodPost, Path: "/123/fast-buy"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation error, got %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if roundTrips != 1 {
		t.Fatalf("expected canceled request to stop before transport, got %d round trips", roundTrips)
	}
}
