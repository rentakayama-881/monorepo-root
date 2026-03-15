package services

import (
	"testing"

	"backend-gin/logger"
)

func init() {
	logger.InitLogger()
}

func TestNormalizeRepoStage(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"ready", repoStageReady},
		{"READY", repoStageReady},
		{"  ready  ", repoStageReady},
		{"published", repoStageReady},
		{"draft", repoStageReady},
		{"in_review", repoStageInReview},
		{"finalized", repoStageFinalized},
		{"unknown", repoStageReady},
		{"", repoStageReady},
	}
	for _, tt := range tests {
		got := normalizeRepoStage(tt.input)
		if got != tt.want {
			t.Errorf("normalizeRepoStage(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeRepoFileKind(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{repoFileKindReadme, repoFileKindReadme},
		{repoFileKindTaskInput, repoFileKindTaskInput},
		{repoFileKindOutput, repoFileKindOutput},
		{repoFileKindSensitive, repoFileKindSensitive},
		{"CASE_README", repoFileKindReadme},
		{"unknown", ""},
		{"", ""},
	}
	for _, tt := range tests {
		got := normalizeRepoFileKind(tt.input)
		if got != tt.want {
			t.Errorf("normalizeRepoFileKind(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeRepoFileVisibility(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{repoFileVisibilityPublic, repoFileVisibilityPublic},
		{repoFileVisibilityAssignedValidators, repoFileVisibilityAssignedValidators},
		{"ASSIGNED_VALIDATORS", repoFileVisibilityAssignedValidators},
		{"unknown", repoFileVisibilityPublic},
		{"", repoFileVisibilityPublic},
	}
	for _, tt := range tests {
		got := normalizeRepoFileVisibility(tt.input)
		if got != tt.want {
			t.Errorf("normalizeRepoFileVisibility(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeRepoVerdict(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{repoVerdictValid, repoVerdictValid},
		{repoVerdictNeedsRevision, repoVerdictNeedsRevision},
		{repoVerdictReject, repoVerdictReject},
		{"VALID", repoVerdictValid},
		{"unknown", ""},
		{"", ""},
	}
	for _, tt := range tests {
		got := normalizeRepoVerdict(tt.input)
		if got != tt.want {
			t.Errorf("normalizeRepoVerdict(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeRepoConsensusStatus(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{repoConsensusFinalized, repoConsensusFinalized},
		{"FINALIZED", repoConsensusFinalized},
		{repoConsensusPending, repoConsensusPending},
		{"unknown", repoConsensusPending},
		{"", repoConsensusPending},
	}
	for _, tt := range tests {
		got := normalizeRepoConsensusStatus(tt.input)
		if got != tt.want {
			t.Errorf("normalizeRepoConsensusStatus(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeRepoBountyReserveStatus(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{repoBountyReserveStatusReserved, repoBountyReserveStatusReserved},
		{repoBountyReserveStatusDisbursed, repoBountyReserveStatusDisbursed},
		{"RESERVED", repoBountyReserveStatusReserved},
		{"unknown", repoBountyReserveStatusNone},
		{"", repoBountyReserveStatusNone},
	}
	for _, tt := range tests {
		got := normalizeRepoBountyReserveStatus(tt.input)
		if got != tt.want {
			t.Errorf("normalizeRepoBountyReserveStatus(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeWorkflowFamily(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{workspaceWorkflowFamily, workspaceWorkflowFamily},
		{"EVIDENCE_VALIDATION_WORKSPACE", workspaceWorkflowFamily},
		{"  Evidence_Validation_Workspace  ", workspaceWorkflowFamily},
		{"other", "other"},
		{"", ""},
	}
	for _, tt := range tests {
		got := normalizeWorkflowFamily(tt.input)
		if got != tt.want {
			t.Errorf("normalizeWorkflowFamily(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestIsWorkspaceMetaState(t *testing.T) {
	tests := []struct {
		name  string
		state repoMetaState
		want  bool
	}{
		{"workspace family", repoMetaState{WorkflowFamily: workspaceWorkflowFamily}, true},
		{"v2 protocol", repoMetaState{ProtocolMode: repoProtocolModeV2}, true},
		{"both", repoMetaState{WorkflowFamily: workspaceWorkflowFamily, ProtocolMode: repoProtocolModeV2}, true},
		{"neither", repoMetaState{WorkflowFamily: "other", ProtocolMode: "v1"}, false},
		{"empty", repoMetaState{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isWorkspaceMetaState(tt.state)
			if got != tt.want {
				t.Errorf("isWorkspaceMetaState() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDefaultRepoMetaState(t *testing.T) {
	state := defaultRepoMetaState()
	if state.WorkflowFamily != workspaceWorkflowFamily {
		t.Errorf("WorkflowFamily = %q, want %q", state.WorkflowFamily, workspaceWorkflowFamily)
	}
	if state.CompletionMode != repoCompletionOpen {
		t.Errorf("CompletionMode = %q, want %q", state.CompletionMode, repoCompletionOpen)
	}
	if state.ConsensusStatus != repoConsensusPending {
		t.Errorf("ConsensusStatus = %q, want %q", state.ConsensusStatus, repoConsensusPending)
	}
	if state.RepoStage != repoStageReady {
		t.Errorf("RepoStage = %q, want %q", state.RepoStage, repoStageReady)
	}
	if state.RepoFiles == nil {
		t.Error("RepoFiles should not be nil")
	}
}

func TestLoadRepoMetaState_Nil(t *testing.T) {
	state := loadRepoMetaState(nil)
	if state.WorkflowFamily != workspaceWorkflowFamily {
		t.Errorf("nil meta: WorkflowFamily = %q, want %q", state.WorkflowFamily, workspaceWorkflowFamily)
	}
	if state.RepoStage != repoStageReady {
		t.Errorf("nil meta: RepoStage = %q, want %q", state.RepoStage, repoStageReady)
	}
}

func TestLoadRepoMetaState_WithValues(t *testing.T) {
	meta := map[string]interface{}{
		"WorkflowFamily":  workspaceWorkflowFamily,
		"ProtocolMode":    repoProtocolModeV2,
		"ConsensusStatus": repoConsensusFinalized,
		"RepoStage":       repoStageInReview,
	}
	state := loadRepoMetaState(meta)
	if state.WorkflowFamily != workspaceWorkflowFamily {
		t.Errorf("WorkflowFamily = %q, want %q", state.WorkflowFamily, workspaceWorkflowFamily)
	}
	if state.ConsensusStatus != repoConsensusFinalized {
		t.Errorf("ConsensusStatus = %q, want %q", state.ConsensusStatus, repoConsensusFinalized)
	}
	if state.RepoStage != repoStageInReview {
		t.Errorf("RepoStage = %q, want %q", state.RepoStage, repoStageInReview)
	}
}

func TestCloneMeta_Repo(t *testing.T) {
	t.Run("nil", func(t *testing.T) {
		got := cloneMeta(nil)
		if got == nil {
			t.Error("cloneMeta(nil) should return empty map, not nil")
		}
		if len(got) != 0 {
			t.Error("cloneMeta(nil) should return empty map")
		}
	})
	t.Run("clones correctly", func(t *testing.T) {
		src := map[string]interface{}{"key": "value", "num": 42}
		got := cloneMeta(src)
		if got["key"] != "value" || got["num"] != 42 {
			t.Error("cloneMeta did not copy values correctly")
		}
		// Mutation shouldn't affect original
		got["key"] = "changed"
		if src["key"] != "value" {
			t.Error("cloneMeta did not create a shallow copy")
		}
	})
}

func TestMetaString_Repo(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  string
	}{
		{"string value", "hello", "hello"},
		{"trimmed string", "  hello  ", "hello"},
		{"int value", 42, ""},
		{"nil value", nil, ""},
		{"bool value", true, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := metaString(tt.input)
			if got != tt.want {
				t.Errorf("metaString(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestIsWorkspaceCaseMeta(t *testing.T) {
	t.Run("nil", func(t *testing.T) {
		// nil meta => default state => workspace family => true
		got := isWorkspaceCaseMeta(nil)
		if !got {
			t.Error("isWorkspaceCaseMeta(nil) should be true (defaults to workspace family)")
		}
	})
	t.Run("workspace meta", func(t *testing.T) {
		meta := map[string]interface{}{
			"WorkflowFamily": workspaceWorkflowFamily,
		}
		got := isWorkspaceCaseMeta(meta)
		if !got {
			t.Error("isWorkspaceCaseMeta should be true for workspace family")
		}
	})
	t.Run("other meta", func(t *testing.T) {
		meta := map[string]interface{}{
			"WorkflowFamily": "other_workflow",
			"ProtocolMode":   "other_mode",
		}
		got := isWorkspaceCaseMeta(meta)
		if got {
			t.Error("isWorkspaceCaseMeta should be false for non-workspace family")
		}
	})
}
