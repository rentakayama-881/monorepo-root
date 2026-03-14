package services

import (
"bytes"
"context"
"encoding/json"
"fmt"
"net/http"
"strings"
"time"

"backend-gin/config"
"backend-gin/ent"
"backend-gin/logger"
"go.uber.org/zap"
)

func shouldSyncWorkspaceFileSharing(file RepoCaseFileItem) bool {
	switch normalizeRepoFileKind(file.Kind) {
	case repoFileKindReadme, repoFileKindTaskInput, repoFileKindSensitive, repoFileKindOutput:
		return strings.TrimSpace(file.DocumentID) != ""
	default:
		return false
	}
}

func (s *EntValidationCaseRepoWorkflowService) workspaceFileShareTargets(
	vc *ent.ValidationCase,
	state repoMetaState,
	file RepoCaseFileItem,
) []uint {
	if vc == nil {
		return []uint{}
	}

	assignedValidatorIDs := activeAssignmentValidatorIDs(state.RepoAssignments)
	kind := normalizeRepoFileKind(file.Kind)
	targets := make([]uint, 0, len(assignedValidatorIDs)+1)

	switch kind {
	case repoFileKindSensitive, repoFileKindReadme, repoFileKindTaskInput:
		targets = append(targets, assignedValidatorIDs...)
	case repoFileKindOutput:
		targets = append(targets, uint(vc.UserID))
		targets = append(targets, assignedValidatorIDs...)
	default:
		return []uint{}
	}

	filtered := make([]uint, 0, len(targets))
	for _, id := range dedupeUint(targets) {
		if id == 0 || id == file.UploadedBy {
			continue
		}
		filtered = append(filtered, id)
	}
	return dedupeUint(filtered)
}

func (s *EntValidationCaseRepoWorkflowService) updateWorkspaceDocumentSharing(
	ctx context.Context,
	authHeader string,
	documentID string,
	sharedWithUserIDs []uint,
) error {
	documentID = strings.TrimSpace(documentID)
	authHeader = strings.TrimSpace(authHeader)
	if documentID == "" || authHeader == "" {
		return nil
	}

	url := fmt.Sprintf("%s/api/v1/documents/%s/sharing", strings.TrimRight(config.FeatureServiceURL, "/"), documentID)
	payload := map[string]interface{}{
		"sharedWithUserIds": dedupeUint(sharedWithUserIDs),
	}
	b, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var body map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			logger.Warn("failed to decode feature-service sharing error", zap.Error(err))
		}
		if msg, ok := body["error"].(string); ok && strings.TrimSpace(msg) != "" {
			return fmt.Errorf("feature-service: %s", msg)
		}
		return fmt.Errorf("feature-service: gagal update sharing document (status %d)", resp.StatusCode)
	}
	return nil
}

func (s *EntValidationCaseRepoWorkflowService) syncWorkspaceFileSharing(
	ctx context.Context,
	authHeader string,
	vc *ent.ValidationCase,
	state repoMetaState,
	file RepoCaseFileItem,
) error {
	if !shouldSyncWorkspaceFileSharing(file) {
		return nil
	}
	targets := s.workspaceFileShareTargets(vc, state, file)
	return s.updateWorkspaceDocumentSharing(ctx, authHeader, file.DocumentID, targets)
}
