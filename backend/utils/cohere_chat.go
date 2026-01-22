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

type cohereChatReq struct {
	Model     string `json:"model"`
	Message   string `json:"message"`
	Documents []struct {
		Title   string `json:"title,omitempty"`
		Snippet string `json:"snippet"`
	} `json:"documents,omitempty"`
	Temperature float32 `json:"temperature,omitempty"`
}

type cohereChatResp struct {
	Text string `json:"text"`
}

func CohereAnswer(model, prompt string, contexts []string) (string, error) {
	apiKey := os.Getenv("COHERE_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("COHERE_API_KEY kosong")
	}
	if model == "" {
		// Model chat Cohere. Pilihan: "command-r", "command-r-plus", "command-r7b-12-2024"
		model = os.Getenv("COHERE_CHAT_MODEL")
		if model == "" {
			model = "command-r" // aman & cukup pintar
		}
	}

	// siapkan dokumen konteks
	docs := make([]struct {
		Title   string `json:"title,omitempty"`
		Snippet string `json:"snippet"`
	}, 0, len(contexts))
	for _, c := range contexts {
		docs = append(docs, struct {
			Title   string `json:"title,omitempty"`
			Snippet string `json:"snippet"`
		}{
			Title:   "",
			Snippet: c,
		})
	}

	body, _ := json.Marshal(cohereChatReq{
		Model:       model,
		Message:     prompt,
		Documents:   docs,
		Temperature: 0.0,
	})

	req, err := http.NewRequestWithContext(context.Background(), "POST", "https://api.cohere.ai/v1/chat", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("cohere chat %d: %s", res.StatusCode, string(b))
	}

	var out cohereChatResp
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.Text, nil
}
