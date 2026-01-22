package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

type cohereEmbedRequest struct {
	Model     string   `json:"model"`
	Texts     []string `json:"texts"`
	InputType string   `json:"input_type"` // "search_document" (indexing) atau "search_query" (pertanyaan user)
}

type cohereEmbedResponse struct {
	Embeddings [][]float32 `json:"embeddings"`
}

// EmbedForDocument: pakai saat INDEXING dokumen/chunk
func EmbedForDocument(text string) ([]float32, error) {
	return cohereEmbed(text, "search_document")
}

// EmbedForQuery: pakai saat USER BERTANYA
func EmbedForQuery(text string) ([]float32, error) {
	return cohereEmbed(text, "search_query")
}

func cohereEmbed(text, inputType string) ([]float32, error) {
	apiKey := os.Getenv("COHERE_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("COHERE_API_KEY kosong (set di .env)")
	}

	model := os.Getenv("COHERE_MODEL")
	if model == "" {
		model = "embed-multilingual-v3.0" // cocok untuk Indonesia/English
	}

	// COHERE_ENDPOINT is base URL, we append /v1/embed
	baseURL := os.Getenv("COHERE_ENDPOINT")
	if baseURL == "" {
		baseURL = "https://api.cohere.ai"
	}
	endpoint := strings.TrimSuffix(baseURL, "/") + "/v1/embed"

	reqBody, _ := json.Marshal(cohereEmbedRequest{
		Model:     model,
		Texts:     []string{text},
		InputType: inputType,
	})

	req, err := http.NewRequestWithContext(context.Background(), "POST", endpoint, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http do: %w", err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("cohere %d: %s", res.StatusCode, string(b))
	}

	var out cohereEmbedResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if len(out.Embeddings) == 0 {
		return nil, fmt.Errorf("empty embeddings")
	}
	return out.Embeddings[0], nil
}
