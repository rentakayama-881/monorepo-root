package services

import (
	"testing"
)

func TestValidationCaseTypes(t *testing.T) {
	// Verify types can be properly instantiated
	item := ValidationCaseListItem{
		ID:           1,
		Title:        "Test Case",
		Summary:      "Summary here",
		Status:       "open",
		BountyAmount: 50000,
	}
	if item.ID != 1 {
		t.Errorf("ID = %d, want 1", item.ID)
	}
	if item.Title != "Test Case" {
		t.Errorf("Title = %q", item.Title)
	}
}

func TestCategoryResponseType(t *testing.T) {
	cat := CategoryResponse{
		Slug:        "tech",
		Name:        "Technology",
		Description: "Tech cases",
	}
	if cat.Slug != "tech" {
		t.Errorf("Slug = %q", cat.Slug)
	}
}

func TestTagResponseType(t *testing.T) {
	tag := TagResponse{
		ID:    1,
		Name:  "Go",
		Slug:  "go",
		Color: "#00ADD8",
		Icon:  "code",
	}
	if tag.Slug != "go" {
		t.Errorf("Slug = %q", tag.Slug)
	}
}

func TestUserSummaryType(t *testing.T) {
	user := UserSummary{
		ID:              42,
		Username:        "testuser",
		AvatarURL:       "https://example.com/avatar.jpg",
		GuaranteeAmount: 100000,
	}
	if user.ID != 42 {
		t.Errorf("ID = %d, want 42", user.ID)
	}
	if user.PrimaryBadge != nil {
		t.Error("PrimaryBadge should be nil")
	}
}

func TestValidationCaseDetailResponse(t *testing.T) {
	detail := ValidationCaseDetailResponse{
		ID:           1,
		Title:        "Detail Test",
		BountyAmount: 100000,
		Content:      map[string]interface{}{"text": "content"},
	}
	if detail.BountyAmount != 100000 {
		t.Errorf("BountyAmount = %d", detail.BountyAmount)
	}
	if detail.AssignedValidator != nil {
		t.Error("AssignedValidator should be nil")
	}
}
