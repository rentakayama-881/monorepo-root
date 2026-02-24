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
				Title:        "Validasi Ringkas",
				ContentType:  "json",
				Content:      validStructuredContent(),
				TagSlugs:     []string{"artifact-review", "domain-backend"},
				BountyAmount: 10_000,
			},
		},
		{
			name: "Valid with all fields",
			input: CreateValidationCaseInput{
				CategorySlug: "diskusi",
				Title:        "Validasi Klaim A",
				Summary:      "Ringkasan singkat",
				ContentType:  "json",
				Content:      validStructuredContent(),
				BountyAmount: 25_000,
				Meta: map[string]interface{}{
					"image": "https://example.com/image.jpg",
				},
				TagSlugs: []string{"artifact-review", "domain-backend", "stage-ready"},
			},
		},
		{
			name: "Valid with workspace bootstrap files",
			input: CreateValidationCaseInput{
				CategorySlug: "diskusi",
				Title:        "Workspace bootstrap files",
				ContentType:  "json",
				Content:      validStructuredContent(),
				BountyAmount: 30_000,
				TagSlugs:     []string{"artifact-review", "domain-backend"},
				WorkspaceBootstrapFiles: []WorkspaceBootstrapFileInput{
					{
						DocumentID: "doc-readme-1",
						Kind:       "case_readme",
						Label:      "README Draft",
						Visibility: "public",
					},
					{
						DocumentID: "doc-sensitive-1",
						Kind:       "sensitive_context",
						Label:      "Sensitive Notes",
						Visibility: "public",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.NoError(t, err)

			assert.Equal(t, "json", tt.input.ContentType)
			assert.NotNil(t, tt.input.StructuredIntake)
			assert.Equal(t, "S1", tt.input.StructuredIntake.SensitivityLevel)
			assert.GreaterOrEqual(t, len(tt.input.TagSlugs), 2)
			for _, file := range tt.input.WorkspaceBootstrapFiles {
				if file.Kind == "sensitive_context" {
					assert.Equal(t, "assigned_validators", file.Visibility)
				}
			}
		})
	}
}

func TestCreateValidationCaseInput_Validate_AllowsLongCaseRecord(t *testing.T) {
	in := baseValidCreateInput()
	content := validStructuredContent()
	content["case_record_text"] = strings.Repeat("## Bukti tambahan\n- Item A\n- Item B\n\n", 500)
	in.Content = content

	err := in.Validate()
	assert.NoError(t, err)
	if assert.NotNil(t, in.StructuredIntake) {
		assert.Greater(t, len(in.StructuredIntake.CaseRecord), 4000)
	}
}

func TestCreateValidationCaseInput_Validate_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		mutate      func(in *CreateValidationCaseInput)
		expectedErr *apperrors.AppError
	}{
		{
			name: "Missing category slug",
			mutate: func(in *CreateValidationCaseInput) {
				in.CategorySlug = ""
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Missing bounty amount",
			mutate: func(in *CreateValidationCaseInput) {
				in.BountyAmount = 0
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Bounty below minimum",
			mutate: func(in *CreateValidationCaseInput) {
				in.BountyAmount = 9_999
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Missing title",
			mutate: func(in *CreateValidationCaseInput) {
				in.Title = ""
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Title too short",
			mutate: func(in *CreateValidationCaseInput) {
				in.Title = "Ab"
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Title too long",
			mutate: func(in *CreateValidationCaseInput) {
				in.Title = strings.Repeat("a", 201)
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Summary too long",
			mutate: func(in *CreateValidationCaseInput) {
				in.Summary = strings.Repeat("a", 501)
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid content type",
			mutate: func(in *CreateValidationCaseInput) {
				in.ContentType = "invalid"
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Missing content",
			mutate: func(in *CreateValidationCaseInput) {
				in.Content = nil
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Missing case record text",
			mutate: func(in *CreateValidationCaseInput) {
				content := validStructuredContent()
				delete(content, "case_record_text")
				in.Content = content
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Checklist item unchecked",
			mutate: func(in *CreateValidationCaseInput) {
				content := validStructuredContent()
				checklist := content["checklist"].(map[string]interface{})
				checklist["sensitive_data_filtered"] = false
				in.Content = content
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid sensitivity",
			mutate: func(in *CreateValidationCaseInput) {
				content := validStructuredContent()
				content["sensitivity_level"] = "S9"
				in.Content = content
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Not enough tags",
			mutate: func(in *CreateValidationCaseInput) {
				in.TagSlugs = []string{"artifact-review"}
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Duplicate taxonomy dimension",
			mutate: func(in *CreateValidationCaseInput) {
				in.TagSlugs = []string{"domain-backend", "domain-frontend"}
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid meta type",
			mutate: func(in *CreateValidationCaseInput) {
				in.Meta = "not a map"
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Meta telegram is disallowed",
			mutate: func(in *CreateValidationCaseInput) {
				in.Meta = map[string]interface{}{"telegram": "@testuser"}
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid meta image URL",
			mutate: func(in *CreateValidationCaseInput) {
				in.Meta = map[string]interface{}{"image": "not-a-url"}
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Invalid workspace bootstrap file kind",
			mutate: func(in *CreateValidationCaseInput) {
				in.WorkspaceBootstrapFiles = []WorkspaceBootstrapFileInput{
					{DocumentID: "doc-1", Kind: "invalid_kind", Label: "File X", Visibility: "public"},
				}
			},
			expectedErr: apperrors.ErrInvalidInput,
		},
		{
			name: "Missing workspace bootstrap file label",
			mutate: func(in *CreateValidationCaseInput) {
				in.WorkspaceBootstrapFiles = []WorkspaceBootstrapFileInput{
					{DocumentID: "doc-2", Kind: "task_input", Label: "", Visibility: "public"},
				}
			},
			expectedErr: apperrors.ErrMissingField,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := baseValidCreateInput()
			tt.mutate(&in)
			err := in.Validate()
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
				Content:          validStructuredContent(),
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

func validStructuredContent() map[string]interface{} {
	return map[string]interface{}{
		"sensitivity_level": "S1",
		"validation_goal":   "Memastikan output AI konsisten dengan objective user.",
		"output_type":       "Dokumen analisis",
		"evidence_input":    "Draft output AI, dataset ringkas, dan instruksi awal user.",
		"pass_criteria":     "Semua klaim utama tervalidasi dengan evidence yang relevan.",
		"constraints":       "Tidak mengubah scope, tidak menambah asumsi tanpa persetujuan.",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
		"case_record_text": "Owner membutuhkan verifikasi objektif atas output AI dan tidak ingin diskusi chat panjang.",
	}
}

func baseValidCreateInput() CreateValidationCaseInput {
	return CreateValidationCaseInput{
		CategorySlug: "jual-beli",
		Title:        "Validasi Output AI",
		ContentType:  "json",
		Content:      validStructuredContent(),
		BountyAmount: 10_000,
		TagSlugs:     []string{"artifact-review", "domain-backend"},
	}
}
