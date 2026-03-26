package services

import (
	"testing"
)

func TestShouldSyncWorkspaceFileSharing(t *testing.T) {
	tests := []struct {
		name string
		file RepoCaseFileItem
		want bool
	}{
		{
			"readme with document ID",
			RepoCaseFileItem{Kind: "case_readme", DocumentID: "doc-123"},
			true,
		},
		{
			"task_input with document ID",
			RepoCaseFileItem{Kind: "task_input", DocumentID: "doc-456"},
			true,
		},
		{
			"validator_output with document ID",
			RepoCaseFileItem{Kind: "validator_output", DocumentID: "doc-789"},
			true,
		},
		{
			"sensitive_context with document ID",
			RepoCaseFileItem{Kind: "sensitive_context", DocumentID: "doc-abc"},
			true,
		},
		{
			"readme without document ID",
			RepoCaseFileItem{Kind: "case_readme", DocumentID: ""},
			false,
		},
		{
			"readme with whitespace only document ID",
			RepoCaseFileItem{Kind: "case_readme", DocumentID: "  "},
			false,
		},
		{
			"unknown kind with document ID",
			RepoCaseFileItem{Kind: "unknown_kind", DocumentID: "doc-xyz"},
			false,
		},
		{
			"empty kind with document ID",
			RepoCaseFileItem{Kind: "", DocumentID: "doc-xyz"},
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldSyncWorkspaceFileSharing(tt.file)
			if got != tt.want {
				t.Errorf("shouldSyncWorkspaceFileSharing() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPlaceholder_RepoSharing_WorkspaceFileShareTargets(t *testing.T) {
	t.Skip("requires database connection - uses ent.ValidationCase")
}

func TestPlaceholder_RepoSharing_UpdateWorkspaceDocumentSharing(t *testing.T) {
	t.Skip("requires external HTTP service")
}

func TestPlaceholder_RepoSharing_SyncWorkspaceFileSharing(t *testing.T) {
	t.Skip("requires database connection")
}
