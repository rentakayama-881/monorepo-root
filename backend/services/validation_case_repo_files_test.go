package services

import (
	"testing"
)

func TestRepoFileRequirements(t *testing.T) {
	tests := []struct {
		name          string
		files         []RepoCaseFileItem
		wantReadme    bool
		wantTaskInput bool
	}{
		{
			"empty files",
			nil,
			false, false,
		},
		{
			"has readme only",
			[]RepoCaseFileItem{{Kind: "case_readme"}},
			true, false,
		},
		{
			"has task input only",
			[]RepoCaseFileItem{{Kind: "task_input"}},
			false, true,
		},
		{
			"has both",
			[]RepoCaseFileItem{
				{Kind: "case_readme"},
				{Kind: "task_input"},
			},
			true, true,
		},
		{
			"only validator output",
			[]RepoCaseFileItem{{Kind: "validator_output"}},
			false, false,
		},
		{
			"mixed with sensitive",
			[]RepoCaseFileItem{
				{Kind: "sensitive_context"},
				{Kind: "case_readme"},
				{Kind: "validator_output"},
			},
			true, false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotReadme, gotTaskInput := repoFileRequirements(tt.files)
			if gotReadme != tt.wantReadme {
				t.Errorf("hasReadme = %v, want %v", gotReadme, tt.wantReadme)
			}
			if gotTaskInput != tt.wantTaskInput {
				t.Errorf("hasTaskInput = %v, want %v", gotTaskInput, tt.wantTaskInput)
			}
		})
	}
}

func TestPlaceholder_RepoFiles_BuildRepoTreeResponse(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_RepoFiles_EnsureActorCanEditRepoFiles(t *testing.T) {
	t.Skip("requires database connection - uses ent.ValidationCase")
}

func TestPlaceholder_RepoFiles_AttachRepoFile(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_RepoFiles_GetRepoTree(t *testing.T) {
	t.Skip("requires database connection")
}
