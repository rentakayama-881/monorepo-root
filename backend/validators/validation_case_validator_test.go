package validators

import (
	"encoding/json"
	"strings"
	"testing"

	apperrors "backend-gin/errors"

	"github.com/stretchr/testify/assert"
)

func TestCreateValidationCaseInput_Validate_Valid(t *testing.T) {
	tests := []struct {
		name  string
		input CreateValidationCaseInput
	}{
		{
			name: "Valid minimal input",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Min",
				Content:      []string{"test"},
				BountyAmount: 10_000,
			},
		},
		{
			name: "Valid with all fields",
			input: CreateValidationCaseInput{
				CategorySlug: "diskusi",
				Title:        "Validasi Klaim A",
				Summary:      "Ringkasan singkat",
				ContentType:  "text",
				Content:      "Isi",
				BountyAmount: 25_000,
				Meta: map[string]interface{}{
					"image": "https://example.com/image.jpg",
				},
				TagSlugs: []string{"Finance", " finance ", "AI"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.NoError(t, err)

			if strings.TrimSpace(tt.input.ContentType) == "" {
				assert.Equal(t, "table", tt.input.ContentType)
			}
			if len(tt.input.TagSlugs) > 0 {
				for _, s := range tt.input.TagSlugs {
					assert.Equal(t, strings.ToLower(strings.TrimSpace(s)), s)
				}
			}
		})
	}
}

func TestCreateValidationCaseInput_Validate_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		input       CreateValidationCaseInput
		expectedErr *apperrors.AppError
	}{
		{
			name: "Missing category slug",
			input: CreateValidationCaseInput{
				CategorySlug: "",
				Title:        "Test Title",
				Content:      "test",
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Missing bounty amount",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				BountyAmount: 0,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Bounty below minimum",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				BountyAmount: 9_999,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Missing title",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "",
				Content:      "test",
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Title too short",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Ab",
				Content:      "test",
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too long",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        strings.Repeat("a", 201),
				Content:      "test",
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Summary too long",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Summary:      strings.Repeat("a", 501),
				Content:      "test",
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid content type",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				ContentType:  "invalid",
				Content:      "test",
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Missing content",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      nil,
				BountyAmount: 10_000,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Invalid meta type",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				BountyAmount: 10_000,
				Meta:         "not a map",
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Meta telegram is disallowed",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				BountyAmount: 10_000,
				Meta: map[string]interface{}{
					"telegram": "@testuser",
				},
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid meta image URL",
			input: CreateValidationCaseInput{
				CategorySlug: "jual-beli",
				Title:        "Test Title",
				Content:      "test",
				BountyAmount: 10_000,
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

func TestUpdateValidationCaseInput_Validate_Valid(t *testing.T) {
	title := "Updated Title"
	summary := "Updated summary"
	contentType := "json"
	bounty := int64(15_000)

	tests := []struct {
		name  string
		input UpdateValidationCaseInput
	}{
		{
			name: "Valid update with common fields",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Title:            &title,
				Summary:          &summary,
				ContentType:      &contentType,
				Content:          map[string]interface{}{"data": "updated"},
				Meta: map[string]interface{}{
					"image": "https://example.com/image.jpg",
				},
				BountyAmount: &bounty,
			},
		},
		{
			name: "Valid update with only title",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 456,
				Title:            &title,
			},
		},
		{
			name: "Valid update with empty summary",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 789,
				Summary:          stringPtr(""),
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

func TestUpdateValidationCaseInput_Validate_Invalid(t *testing.T) {
	emptyTitle := ""
	shortTitle := "Ab"
	longTitle := strings.Repeat("a", 201)
	longSummary := strings.Repeat("a", 501)
	invalidContentType := "invalid"
	tooSmallBounty := int64(9_999)
	negativeBounty := int64(-1)
	emptyStatus := "   "

	tests := []struct {
		name        string
		input       UpdateValidationCaseInput
		expectedErr *apperrors.AppError
	}{
		{
			name: "Missing validation case ID",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 0,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Empty title",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Title:            &emptyTitle,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too short",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Title:            &shortTitle,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too long",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Title:            &longTitle,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Summary too long",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Summary:          &longSummary,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid content type",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				ContentType:      &invalidContentType,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid bounty (too small)",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				BountyAmount:     &tooSmallBounty,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid bounty (negative)",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				BountyAmount:     &negativeBounty,
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid meta image URL",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Meta: map[string]interface{}{
					"image": "not-a-url",
				},
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Meta telegram is disallowed",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Meta: map[string]interface{}{
					"telegram": "@updated",
				},
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Empty status",
			input: UpdateValidationCaseInput{
				ValidationCaseID: 123,
				Status:           &emptyStatus,
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
		name    string
		meta    interface{}
		wantErr bool
	}{
		{
			name: "Valid meta without telegram",
			meta: map[string]interface{}{
				"image": "https://example.com/image.jpg",
			},
			wantErr: false,
		},
		{
			name: "Meta with telegram is rejected",
			meta: map[string]interface{}{
				"telegram": "@testuser",
			},
			wantErr: true,
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
				return
			}
			assert.NoError(t, err)
			assert.NotNil(t, result)
			var metaMap map[string]interface{}
			_ = json.Unmarshal(result, &metaMap)
			_, hasTelegram := metaMap["telegram"]
			assert.False(t, hasTelegram)
		})
	}
}

func stringPtr(s string) *string {
	return &s
}

