package validators

import (
	"strings"
	"testing"
)

// validContent builds a minimal valid structured intake content map for tests.
func validContent() map[string]interface{} {
	return map[string]interface{}{
		"case_record_text": "This is a sample case record for validation purposes.",
		"sensitivity_level": "S1",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
	}
}

func validCreate() CreateValidationCaseInput {
	return CreateValidationCaseInput{
		CategorySlug: "ai-review",
		BountyAmount: 50_000,
		Title:        "Sample validation case title",
		Summary:      "A short summary",
		ContentType:  "json",
		Content:      validContent(),
		TagSlugs:     []string{"artifact-code", "stage-review"},
	}
}

func TestCreateValidationCaseInput_Validate_HappyPath(t *testing.T) {
	c := validCreate()
	if err := c.Validate(); err != nil {
		t.Fatalf("expected valid input, got error: %v", err)
	}
}

func TestCreateValidationCaseInput_Validate_MissingCategorySlug(t *testing.T) {
	c := validCreate()
	c.CategorySlug = "  "
	err := c.Validate()
	if err == nil {
		t.Fatal("expected error for empty category slug")
	}
	if !strings.Contains(err.Error(), "category_slug") {
		t.Errorf("error should mention category_slug: %v", err)
	}
}

func TestCreateValidationCaseInput_Validate_BountyAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount int64
		wantOK bool
	}{
		{"Zero", 0, false},
		{"Negative", -1000, false},
		{"Below minimum", 5_000, false},
		{"At minimum", 10_000, true},
		{"Above minimum", 100_000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := validCreate()
			c.BountyAmount = tt.amount
			err := c.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid for bounty %d, got: %v", tt.amount, err)
			}
			if !tt.wantOK && err == nil {
				t.Errorf("expected error for bounty %d", tt.amount)
			}
		})
	}
}

func TestCreateValidationCaseInput_Validate_Title(t *testing.T) {
	tests := []struct {
		name   string
		title  string
		wantOK bool
	}{
		{"Empty", "", false},
		{"Too short", "ab", false},
		{"Minimum length", "abc", true},
		{"Normal", "Valid title for a case", true},
		{"Too long", strings.Repeat("a", 201), false},
		{"XSS in title", "<script>alert(1)</script>", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := validCreate()
			c.Title = tt.title
			err := c.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid for title %q, got: %v", tt.title, err)
			}
			if !tt.wantOK && err == nil {
				t.Errorf("expected error for title %q", tt.title)
			}
		})
	}
}

func TestCreateValidationCaseInput_Validate_Summary(t *testing.T) {
	tests := []struct {
		name    string
		summary string
		wantOK  bool
	}{
		{"Empty (optional)", "", true},
		{"Normal", "A valid summary", true},
		{"Too long", strings.Repeat("x", 501), false},
		{"XSS", "<script>alert(1)</script>", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := validCreate()
			c.Summary = tt.summary
			err := c.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid for summary, got: %v", err)
			}
			if !tt.wantOK && err == nil {
				t.Errorf("expected error for summary %q", tt.summary)
			}
		})
	}
}

func TestCreateValidationCaseInput_Validate_NilContent(t *testing.T) {
	c := validCreate()
	c.Content = nil
	err := c.Validate()
	if err == nil {
		t.Fatal("expected error for nil content")
	}
}

func TestCreateValidationCaseInput_Validate_TagSlugs(t *testing.T) {
	tests := []struct {
		name   string
		tags   []string
		wantOK bool
	}{
		{"Too few tags", []string{"artifact-code"}, false},
		{"Minimum tags", []string{"artifact-code", "stage-review"}, true},
		{"Too many tags", []string{"a", "b", "c", "d", "e"}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := validCreate()
			c.TagSlugs = tt.tags
			err := c.Validate()
			if tt.wantOK && err != nil {
				t.Errorf("expected valid for tags %v, got: %v", tt.tags, err)
			}
			if !tt.wantOK && err == nil {
				t.Errorf("expected error for tags %v", tt.tags)
			}
		})
	}
}
