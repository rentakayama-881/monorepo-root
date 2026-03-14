package services

import (
	"context"
	"fmt"
	"strings"

	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
)

func containsUint(values []uint, target uint) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

func dedupeUint(values []uint) []uint {
	seen := make(map[uint]struct{}, len(values))
	out := make([]uint, 0, len(values))
	for _, v := range values {
		if v == 0 {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func validatorIDSet(values []uint) map[uint]struct{} {
	set := make(map[uint]struct{}, len(values))
	for _, id := range values {
		if id == 0 {
			continue
		}
		set[id] = struct{}{}
	}
	return set
}

func validatorPairKey(a uint, b uint) string {
	if a > b {
		a, b = b, a
	}
	return fmt.Sprintf("%d:%d", a, b)
}

func activeAssignmentValidatorIDs(assignments []RepoAssignmentItem) []uint {
	out := make([]uint, 0, len(assignments))
	for _, asn := range assignments {
		if strings.EqualFold(strings.TrimSpace(asn.Status), repoAssignmentStatusActive) && asn.ValidatorUserID > 0 {
			out = append(out, asn.ValidatorUserID)
		}
	}
	return dedupeUint(out)
}

func activeValidatorOutputCounts(files []RepoCaseFileItem, assignments []RepoAssignmentItem) map[uint]int {
	activeSet := validatorIDSet(activeAssignmentValidatorIDs(assignments))
	out := make(map[uint]int, len(activeSet))
	for _, file := range files {
		if normalizeRepoFileKind(file.Kind) != repoFileKindOutput {
			continue
		}
		if _, ok := activeSet[file.UploadedBy]; !ok {
			continue
		}
		out[file.UploadedBy]++
	}
	return out
}

func hasValidatorUploadedOutput(files []RepoCaseFileItem, validatorUserID uint) bool {
	for _, file := range files {
		if normalizeRepoFileKind(file.Kind) != repoFileKindOutput {
			continue
		}
		if file.UploadedBy == validatorUserID {
			return true
		}
	}
	return false
}

func normalizeConfidenceVotes(votes []RepoConfidenceVoteItem, validValidatorIDs map[uint]struct{}) []RepoConfidenceVoteItem {
	if len(votes) == 0 {
		return []RepoConfidenceVoteItem{}
	}

	latestByVoter := make(map[uint]RepoConfidenceVoteItem, len(votes))
	for _, vote := range votes {
		if vote.VoterUserID == 0 || vote.ValidatorUserID == 0 {
			continue
		}
		if len(validValidatorIDs) > 0 {
			if _, ok := validValidatorIDs[vote.ValidatorUserID]; !ok {
				continue
			}
		}
		prev, exists := latestByVoter[vote.VoterUserID]
		if !exists || vote.VotedAt >= prev.VotedAt {
			latestByVoter[vote.VoterUserID] = vote
		}
	}

	out := make([]RepoConfidenceVoteItem, 0, len(latestByVoter))
	for _, vote := range latestByVoter {
		out = append(out, vote)
	}
	return out
}

func confidenceVoteCountByValidator(votes []RepoConfidenceVoteItem) map[uint]int {
	counts := make(map[uint]int)
	for _, vote := range votes {
		if vote.ValidatorUserID == 0 {
			continue
		}
		counts[vote.ValidatorUserID]++
	}
	return counts
}

func viewerConfidenceVote(votes []RepoConfidenceVoteItem, viewerUserID uint) *uint {
	if viewerUserID == 0 {
		return nil
	}
	for _, vote := range votes {
		if vote.VoterUserID != viewerUserID {
			continue
		}
		id := vote.ValidatorUserID
		return &id
	}
	return nil
}

func (s *EntValidationCaseRepoWorkflowService) isAssignedValidator(validatorUserID uint, assignments []RepoAssignmentItem) bool {
	for _, it := range assignments {
		if it.ValidatorUserID == validatorUserID && strings.EqualFold(it.Status, repoAssignmentStatusActive) {
			return true
		}
	}
	return false
}

func (s *EntValidationCaseRepoWorkflowService) unlockChainVestingForValidator(
	ctx context.Context,
	validatorUserID uint,
	currentValidationCaseID uint,
) {
	cases, err := s.client.ValidationCase.Query().
		Where(validationcase.StatusEQ(caseStatusCompleted)).
		All(ctx)
	if err != nil {
		return
	}

	for _, vc := range cases {
		if uint(vc.ID) == currentValidationCaseID {
			continue
		}
		state := loadRepoMetaState(vc.Meta)
		if !isWorkspaceMetaState(state) || state.RepoPayout == nil {
			continue
		}

		changed := false
		for i := range state.RepoPayout.Entries {
			entry := &state.RepoPayout.Entries[i]
			if entry.ValidatorUserID != validatorUserID {
				continue
			}
			if !strings.EqualFold(entry.ChainStatus, repoChainStatusLocked) || entry.ChainLocked <= 0 {
				continue
			}
			entry.ChainUnlocked += entry.ChainLocked
			entry.ChainLocked = 0
			entry.ChainStatus = repoChainStatusUnlocked
			changed = true
		}
		if !changed {
			continue
		}

		meta := mergeRepoMeta(vc.Meta, state)
		if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
			continue
		}
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "repo_chain_vesting_unlocked", map[string]interface{}{
			"validator_user_id": validatorUserID,
			"source_case_id":    currentValidationCaseID,
		})
	}
}

func (s *EntValidationCaseRepoWorkflowService) userSummariesByID(
	ctx context.Context,
	userIDs []uint,
) (map[uint]UserSummary, error) {
	out := make(map[uint]UserSummary)
	userIDs = dedupeUint(userIDs)
	if len(userIDs) == 0 {
		return out, nil
	}

	intIDs := make([]int, 0, len(userIDs))
	for _, id := range userIDs {
		intIDs = append(intIDs, int(id))
	}
	users, err := s.client.User.Query().
		Where(user.IDIn(intIDs...)).
		WithPrimaryBadge().
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	for _, u := range users {
		out[uint(u.ID)] = buildUserSummaryFromEnt(u)
	}
	return out, nil
}
