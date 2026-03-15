package validators

import (
	"testing"
)

func TestNormalizeWorkspaceBootstrapFiles_Empty(t *testing.T) {
	got, err := normalizeWorkspaceBootstrapFiles(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for empty input, got %v", got)
	}
}

func TestNormalizeWorkspaceBootstrapFiles_TooMany(t *testing.T) {
	files := make([]WorkspaceBootstrapFileInput, workspaceBootstrapMaxFiles+1)
	for i := range files {
		files[i] = WorkspaceBootstrapFileInput{
			DocumentID: "doc-" + string(rune('a'+i)),
			Kind:       "case_readme",
			Label:      "File",
			Visibility: "public",
		}
	}
	_, err := normalizeWorkspaceBootstrapFiles(files)
	if err == nil {
		t.Error("expected error for too many files")
	}
}

func TestNormalizeWorkspaceBootstrapFiles_InvalidKind(t *testing.T) {
	files := []WorkspaceBootstrapFileInput{
		{DocumentID: "doc-1", Kind: "invalid_kind", Label: "File", Visibility: "public"},
	}
	_, err := normalizeWorkspaceBootstrapFiles(files)
	if err == nil {
		t.Error("expected error for invalid kind")
	}
}

func TestNormalizeWorkspaceBootstrapFiles_MissingDocumentID(t *testing.T) {
	files := []WorkspaceBootstrapFileInput{
		{DocumentID: "", Kind: "case_readme", Label: "File", Visibility: "public"},
	}
	_, err := normalizeWorkspaceBootstrapFiles(files)
	if err == nil {
		t.Error("expected error for missing document ID")
	}
}

func TestNormalizeWorkspaceBootstrapFiles_MissingLabel(t *testing.T) {
	files := []WorkspaceBootstrapFileInput{
		{DocumentID: "doc-1", Kind: "case_readme", Label: "", Visibility: "public"},
	}
	_, err := normalizeWorkspaceBootstrapFiles(files)
	if err == nil {
		t.Error("expected error for missing label")
	}
}

func TestNormalizeWorkspaceBootstrapFiles_Valid(t *testing.T) {
	files := []WorkspaceBootstrapFileInput{
		{DocumentID: "doc-1", Kind: "case_readme", Label: "README", Visibility: "public"},
		{DocumentID: "doc-2", Kind: "task_input", Label: "Input Data", Visibility: "public"},
	}
	got, err := normalizeWorkspaceBootstrapFiles(files)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Errorf("got %d files, want 2", len(got))
	}
}

func TestNormalizeWorkspaceBootstrapFiles_Deduplication(t *testing.T) {
	files := []WorkspaceBootstrapFileInput{
		{DocumentID: "doc-1", Kind: "case_readme", Label: "First", Visibility: "public"},
		{DocumentID: "doc-1", Kind: "case_readme", Label: "Duplicate", Visibility: "public"},
	}
	got, err := normalizeWorkspaceBootstrapFiles(files)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("got %d files, want 1 (deduplicated)", len(got))
	}
}

func TestNormalizeWorkspaceBootstrapFiles_SensitiveForced(t *testing.T) {
	files := []WorkspaceBootstrapFileInput{
		{DocumentID: "doc-1", Kind: "sensitive_context", Label: "Secret", Visibility: "public"},
	}
	got, err := normalizeWorkspaceBootstrapFiles(files)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatal("expected 1 file")
	}
	if got[0].Visibility != "assigned_validators" {
		t.Errorf("sensitive_context should force visibility to assigned_validators, got %q", got[0].Visibility)
	}
}
