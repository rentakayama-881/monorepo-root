package validators

import (
	"strings"
	"testing"
)

func strPtr(s string) *string  { return &s }
func int64Ptr(n int64) *int64  { return &n }

func TestUpdateValidationCaseInput_Validate_HappyPath(t *testing.T) {
	u := UpdateValidationCaseInput{
		ValidationCaseID: 1,
		Title:            strPtr("Updated title here"),
	}
	if err := u.Validate(); err != nil {
		t.Fatalf("expected valid input, got: %v", err)
	}
}

func TestUpdateValidationCaseInput_Validate_MissingID(t *testing.T) {
	u := UpdateValidationCaseInput{
		ValidationCaseID: 0,
	}
	err := u.Validate()
	if err == nil {
		t.Fatal("expected error for missing validation_case_id")
	}
	if !strings.Contains(err.Error(), "validation_case_id") {
		t.Errorf("error should mention validation_case_id: %v", err)
	}
}

func TestUpdateValidationCaseInput_Validate_Title(t *testing.T) {
	tests := []struct {
		name   string
		title  *string
		wantOK bool
	}{
		{"Nil (not updating)", nil, true},
		{"Empty string", strPtr(""), false},
		{"Too short", strPtr("ab"), false},
		{"Minimum length", strPtr("abc"), true},
		{"Normal", strPtr("A valid updated title"), true},
		{"Too long", strPtr(strings.Repeat("x", 201)), false},
		{"XSS", strPtr("<script>alert(1)</script>"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := UpdateValidationCaseInput{
				ValidationCaseID: 1,
				Title:            tt.title,
			}
			err := u.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Error("expected error")
			}
		})
	}
}

func TestUpdateValidationCaseInput_Validate_Summary(t *testing.T) {
	tests := []struct {
		name    string
		summary *string
		wantOK  bool
	}{
		{"Nil (not updating)", nil, true},
		{"Normal text", strPtr("A valid summary"), true},
		{"Too long", strPtr(strings.Repeat("x", 501)), false},
		{"XSS", strPtr("<script>alert(1)</script>"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := UpdateValidationCaseInput{
				ValidationCaseID: 1,
				Summary:          tt.summary,
			}
			err := u.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Error("expected error")
			}
		})
	}
}

func TestUpdateValidationCaseInput_Validate_ContentType(t *testing.T) {
	tests := []struct {
		name        string
		contentType *string
		wantOK      bool
	}{
		{"Nil", nil, true},
		{"Text", strPtr("text"), true},
		{"Table", strPtr("table"), true},
		{"JSON", strPtr("json"), true},
		{"Invalid", strPtr("xml"), false},
		{"Empty defaults to json", strPtr(""), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := UpdateValidationCaseInput{
				ValidationCaseID: 1,
				ContentType:      tt.contentType,
			}
			err := u.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Error("expected error")
			}
		})
	}
}

func TestUpdateValidationCaseInput_Validate_BountyAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount *int64
		wantOK bool
	}{
		{"Nil (not updating)", nil, true},
		{"Zero", int64Ptr(0), false},
		{"Negative", int64Ptr(-1000), false},
		{"Below minimum", int64Ptr(5_000), false},
		{"At minimum", int64Ptr(10_000), true},
		{"Above minimum", int64Ptr(100_000), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := UpdateValidationCaseInput{
				ValidationCaseID: 1,
				BountyAmount:     tt.amount,
			}
			err := u.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Error("expected error")
			}
		})
	}
}

func TestUpdateValidationCaseInput_Validate_Status(t *testing.T) {
	tests := []struct {
		name   string
		status *string
		wantOK bool
	}{
		{"Nil (not updating)", nil, true},
		{"Valid status", strPtr("open"), true},
		{"Empty string", strPtr(""), false},
		{"Whitespace-only", strPtr("   "), false},
		{"Uppercase normalized", strPtr("OPEN"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := UpdateValidationCaseInput{
				ValidationCaseID: 1,
				Status:           tt.status,
			}
			err := u.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Error("expected error")
			}
		})
	}
}

func TestUpdateValidationCaseInput_Validate_TagSlugs(t *testing.T) {
	twoTags := []string{"artifact-code", "stage-review"}
	fiveTags := []string{"a", "b", "c", "d", "e"}
	onlyOne := []string{"artifact-code"}

	tests := []struct {
		name   string
		tags   *[]string
		wantOK bool
	}{
		{"Nil (not updating)", nil, true},
		{"Valid", &twoTags, true},
		{"Too many", &fiveTags, false},
		{"Too few", &onlyOne, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := UpdateValidationCaseInput{
				ValidationCaseID: 1,
				TagSlugs:         tt.tags,
			}
			err := u.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Error("expected error")
			}
		})
	}
}
