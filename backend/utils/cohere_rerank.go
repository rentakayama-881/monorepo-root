package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type rerankRequest struct {
	Model     string   `json:"model"` // contoh: "rerank-english-v3.0" atau "rerank-multilingual-v3.0"
	Query     string   `json:"query"`
	Documents []string `json:"documents"`
	TopN      int      `json:"top_n"` // ambil N teratas setelah rerank
}

type rerankResponse struct {
	Results []struct {
		Index          int     `json:"index"` // index dokumen aslinya
		RelevanceScore float64 `json:"relevance_score"`
	} `json:"results"`
}

// Rerank dokumen berdasarkan query, mengembalikan indeks dokumen terurut relevansi menurun.
func CohereRerank(query string, docs []string, topN int) ([]int, error) {
	apiKey := os.Getenv("COHERE_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("COHERE_API_KEY kosong")
	}
	// Multibahasa supaya cocok ID/EN
	model := os.Getenv("COHERE_RERANK_MODEL")
	if model == "" {
		model = "rerank-multilingual-v3.0"
	}

	body, _ := json.Marshal(rerankRequest{
		Model:     model,
		Query:     query,
		Documents: docs,
		TopN:      topN,
	})

	req, err := http.NewRequestWithContext(context.Background(), "POST", "https://api.cohere.ai/v1/rerank", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("cohere rerank %d: %s", res.StatusCode, string(b))
	}

	var out rerankResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Results) == 0 {
		return []int{}, nil
	}

	// urutkan sesuai ranking Cohere (sudah urut dari paling relevan)
	indexes := make([]int, 0, len(out.Results))
	for _, r := range out.Results {
		indexes = append(indexes, r.Index)
	}
	return indexes, nil
}
