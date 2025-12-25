package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend-gin/logger"

	"go.uber.org/zap"
)

// SupabaseStorage handles file uploads to Supabase Storage
type SupabaseStorage struct {
	URL        string
	ServiceKey string
	Bucket     string
}

// NewSupabaseStorage creates a new Supabase storage client
func NewSupabaseStorage() *SupabaseStorage {
	return &SupabaseStorage{
		URL:        os.Getenv("SUPABASE_URL"),
		ServiceKey: os.Getenv("SUPABASE_SERVICE_KEY"),
		Bucket:     os.Getenv("SUPABASE_BUCKET"),
	}
}

// IsConfigured checks if Supabase storage is configured
func (s *SupabaseStorage) IsConfigured() bool {
	return s.URL != "" && s.ServiceKey != "" && s.Bucket != ""
}

// UploadFile uploads a file to Supabase Storage
// Returns the public URL of the uploaded file
func (s *SupabaseStorage) UploadFile(file multipart.File, filename string, contentType string) (string, error) {
	if !s.IsConfigured() {
		return "", fmt.Errorf("Supabase storage not configured")
	}

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Generate unique filename
	ext := filepath.Ext(filename)
	uniqueName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), strings.TrimSuffix(filename, ext), ext)

	// Supabase Storage API endpoint
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.URL, s.Bucket, uniqueName)

	// Create request
	req, err := http.NewRequest("POST", uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.ServiceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true") // Overwrite if exists

	// Send request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("Supabase upload failed",
			zap.Int("status", resp.StatusCode),
			zap.String("response", string(body)),
		)
		return "", fmt.Errorf("upload failed with status %d", resp.StatusCode)
	}

	// Return public URL
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.URL, s.Bucket, uniqueName)

	logger.Info("File uploaded to Supabase",
		zap.String("filename", uniqueName),
		zap.String("url", publicURL),
	)

	return publicURL, nil
}

// DeleteFile deletes a file from Supabase Storage
func (s *SupabaseStorage) DeleteFile(filename string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("Supabase storage not configured")
	}

	deleteURL := fmt.Sprintf("%s/storage/v1/object/%s", s.URL, s.Bucket)

	// Request body
	body, _ := json.Marshal(map[string]interface{}{
		"prefixes": []string{filename},
	})

	req, err := http.NewRequest("DELETE", deleteURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("delete failed with status %d", resp.StatusCode)
	}

	return nil
}
