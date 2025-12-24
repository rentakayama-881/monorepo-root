package validators

import (
	"encoding/json"
	"strings"
	"testing"

	apperrors "backend-gin/errors"

	"github.com/stretchr/testify/assert"
)

func TestCreateThreadInput_Validate_Valid(t *testing.T) {
	tests := []struct {
		name  string
		input CreateThreadInput
	}{
		{
			name: "Valid thread with all fields",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Test Thread Title",
				Summary:      "This is a test summary",
				ContentType:  "table",
				Content:      map[string]interface{}{"data": "test"},
				Meta: map[string]interface{}{
					"image":    "https://example.com/image.jpg",
					"telegram": "@testuser",
				},
			},
		},
		{
			name: "Valid thread with minimal fields",
			input: CreateThreadInput{
				CategorySlug: "diskusi",
				Title:        "Min",
				Content:      []string{"test"},
			},
		},
		{
			name: "Valid thread with text content type",
			input: CreateThreadInput{
				CategorySlug: "informasi",
				Title:        "Text Content Thread",
				ContentType:  "text",
				Content:      "This is text content",
			},
		},
		{
			name: "Valid thread with json content type",
			input: CreateThreadInput{
				CategorySlug: "bantuan",
				Title:        "JSON Content Thread",
				ContentType:  "json",
				Content:      map[string]interface{}{"key": "value"},
			},
		},
		{
			name: "Valid thread with telegram without @ prefix",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Telegram Thread",
				Content:      "test",
				Meta: map[string]interface{}{
					"telegram": "testuser",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.NoError(t, err)

			// Check defaults
			if tt.input.ContentType == "" {
				assert.Equal(t, "table", tt.input.ContentType)
			}

			// Check telegram normalization
			if tt.input.Meta != nil {
				if metaMap, ok := tt.input.Meta.(map[string]interface{}); ok {
					if tg, ok := metaMap["telegram"].(string); ok && tg != "" {
						assert.True(t, len(tg) == 0 || tg[0] == '@', "telegram should have @ prefix")
					}
				}
			}
		})
	}
}

func TestCreateThreadInput_Validate_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		input       CreateThreadInput
		expectedErr *apperrors.AppError
	}{
		{
			name: "Empty category slug",
			input: CreateThreadInput{
				CategorySlug: "",
				Title:        "Test Title",
				Content:      "test",
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Empty title",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "",
				Content:      "test",
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Title too short",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Ab",
				Content:      "test",
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too long",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        string(make([]byte, 201)),
				Content:      "test",
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Summary too long",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Summary:      string(make([]byte, 501)),
				Content:      "test",
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid content type",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				ContentType:  "invalid",
				Content:      "test",
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Missing content",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      nil,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Invalid image URL",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				Meta: map[string]interface{}{
					"image": "not-a-url",
				},
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid image URL scheme",
			input: CreateThreadInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				Meta: map[string]interface{}{
					"image": "ftp://example.com/image.jpg",
				},
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.Error(t, err)
			if appErr, ok := err.(*apperrors.AppError); ok {
				assert.Equal(t, tt.expectedErr.Code, appErr.Code)
			}
		})
	}
}

func TestUpdateThreadInput_Validate_Valid(t *testing.T) {
	title := "Updated Title"
	summary := "Updated summary"
	contentType := "json"

	tests := []struct {
		name  string
		input UpdateThreadInput
	}{
		{
			name: "Valid update with all fields",
			input: UpdateThreadInput{
				ThreadID:    123,
				Title:       &title,
				Summary:     &summary,
				ContentType: &contentType,
				Content:     map[string]interface{}{"data": "updated"},
				Meta:        map[string]interface{}{"telegram": "@updated"},
			},
		},
		{
			name: "Valid update with only title",
			input: UpdateThreadInput{
				ThreadID: 456,
				Title:    &title,
			},
		},
		{
			name: "Valid update with empty summary",
			input: UpdateThreadInput{
				ThreadID: 789,
				Summary:  stringPtr(""),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.NoError(t, err)
		})
	}
}

func TestUpdateThreadInput_Validate_Invalid(t *testing.T) {
	emptyTitle := ""
	shortTitle := "Ab"
	longTitle := string(make([]byte, 201))
	longSummary := string(make([]byte, 501))
	invalidContentType := "invalid"

	tests := []struct {
		name        string
		input       UpdateThreadInput
		expectedErr *apperrors.AppError
	}{
		{
			name: "Missing thread ID",
			input: UpdateThreadInput{
				ThreadID: 0,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Empty title",
			input: UpdateThreadInput{
				ThreadID: 123,
				Title:    &emptyTitle,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too short",
			input: UpdateThreadInput{
				ThreadID: 123,
				Title:    &shortTitle,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too long",
			input: UpdateThreadInput{
				ThreadID: 123,
				Title:    &longTitle,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Summary too long",
			input: UpdateThreadInput{
				ThreadID: 123,
				Summary:  &longSummary,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid content type",
			input: UpdateThreadInput{
				ThreadID:    123,
				ContentType: &invalidContentType,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid meta image URL",
			input: UpdateThreadInput{
				ThreadID: 123,
				Meta: map[string]interface{}{
					"image": "not-a-url",
				},
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.Error(t, err)
			if appErr, ok := err.(*apperrors.AppError); ok {
				assert.Equal(t, tt.expectedErr.Code, appErr.Code)
			}
		})
	}
}

func TestCategorySlugInput_Validate(t *testing.T) {
	tests := []struct {
		name    string
		input   CategorySlugInput
		wantErr bool
	}{
		{
			name:    "Valid slug",
			input:   CategorySlugInput{Slug: "jual-beli"},
			wantErr: false,
		},
		{
			name:    "Valid slug with spaces",
			input:   CategorySlugInput{Slug: "  diskusi  "},
			wantErr: false,
		},
		{
			name:    "Empty slug",
			input:   CategorySlugInput{Slug: ""},
			wantErr: true,
		},
		{
			name:    "Only whitespace",
			input:   CategorySlugInput{Slug: "   "},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, tt.input.Slug)
				assert.Equal(t, strings.TrimSpace(tt.input.Slug), tt.input.Slug)
			}
		})
	}
}

func TestNormalizeMeta(t *testing.T) {
	tests := []struct {
		name       string
		meta       interface{}
		wantErr    bool
		checkTg    bool
		expectedTg string
	}{
		{
			name: "Telegram without @ prefix",
			meta: map[string]interface{}{
				"telegram": "testuser",
			},
			wantErr:    false,
			checkTg:    true,
			expectedTg: "@testuser",
		},
		{
			name: "Telegram with @ prefix",
			meta: map[string]interface{}{
				"telegram": "@testuser",
			},
			wantErr:    false,
			checkTg:    true,
			expectedTg: "@testuser",
		},
		{
			name:    "Nil meta",
			meta:    nil,
			wantErr: false,
		},
		{
			name:    "Invalid meta type",
			meta:    "not a map",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := NormalizeMeta(tt.meta)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)

				if tt.checkTg {
					var metaMap map[string]interface{}
					json.Unmarshal(result, &metaMap)
					assert.Equal(t, tt.expectedTg, metaMap["telegram"])
				}
			}
		})
	}
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
