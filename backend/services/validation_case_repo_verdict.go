package services

import (
	"context"
	"sort"
	"strings"
	"time"

	apperrors "backend-gin/errors"
)

func latestVerdictsByValidator(verdicts []RepoVerdictItem, activeAssignments []RepoAssignmentItem) map[uint]RepoVerdictItem {
	active := make(map[uint]struct{}, len(activeAssignments))
	for _, asn := range activeAssignments {
		if strings.EqualFold(asn.Status, repoAssignmentStatusActive) {
			active[asn.ValidatorUserID] = struct{}{}
		}
	}

	out := make(map[uint]RepoVerdictItem)
	for _, item := range verdicts {
		if _, ok := active[item.ValidatorUserID]; !ok {
			continue
		}
		prev, exists := out[item.ValidatorUserID]
		if !exists || item.SubmittedAt >= prev.SubmittedAt {
			out[item.ValidatorUserID] = item
		}
	}
	return out
}

func requiredVotesByMode(mode string) int {
	if normalizeRepoCompletionMode(mode) == repoCompletionPanel10 {
		return 10
	}
	return 3
}

func consensusBreakdown(latest map[uint]RepoVerdictItem) map[string]int {
	breakdown := map[string]int{
		repoVerdictValid:         0,
		repoVerdictNeedsRevision: 0,
		repoVerdictReject:        0,
	}
	for _, v := range latest {
		key := normalizeRepoVerdict(v.Verdict)
		if key == "" {
			continue
		}
		breakdown[key]++
	}
	return breakdown
}

func consensusWinner(breakdown map[string]int) (string, int, int) {
	winner := ""
	maxCount := -1
	second := -1
	keys := []string{repoVerdictValid, repoVerdictNeedsRevision, repoVerdictReject}
	for _, key := range keys {
		v := breakdown[key]
		if v > maxCount {
			second = maxCount
			maxCount = v
			winner = key
			continue
		}
		if v > second {
			second = v
		}
	}
	if second < 0 {
		second = 0
	}
	return winner, maxCount, second
}

func (s *EntValidationCaseRepoWorkflowService) SubmitRepoVerdict(
	ctx context.Context,
	validationCaseID uint,
	validatorUserID uint,
	verdict string,
	confidence int,
	notes string,
	documentID string,
) (*RepoConsensusResponse, error) {
	_ = ctx
	_ = validationCaseID
	_ = validatorUserID
	_ = verdict
	_ = confidence
	_ = notes
	_ = documentID
	return nil, apperrors.ErrInvalidInput.WithDetails("submit verdict sudah tidak digunakan. Gunakan upload validator_output + confidence vote.")
}

func splitAmountEvenly(total int64, winnerIDs []uint) map[uint]int64 {
	out := make(map[uint]int64, len(winnerIDs))
	if total <= 0 || len(winnerIDs) == 0 {
		return out
	}
	base := total / int64(len(winnerIDs))
	remainder := total % int64(len(winnerIDs))
	for i, id := range winnerIDs {
		amount := base
		if int64(i) < remainder {
			amount++
		}
		out[id] = amount
	}
	return out
}

func sortedKeysUint(m map[uint]int) []uint {
	keys := make([]uint, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
	return keys
}

func (s *EntValidationCaseRepoWorkflowService) VoteRepoValidatorConfidence(
	ctx context.Context,
	validationCaseID uint,
	voterUserID uint,
	validatorUserID uint,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}
	if voterUserID == validatorUserID {
		return nil, apperrors.ErrInvalidInput.WithDetails("tidak bisa memberi confidence ke akun sendiri")
	}
	if !s.isAssignedValidator(validatorUserID, state.RepoAssignments) {
		return nil, apperrors.ErrInvalidInput.WithDetails("validator belum diassign owner")
	}

	activeSet := validatorIDSet(activeAssignmentValidatorIDs(state.RepoAssignments))
	if _, ok := activeSet[validatorUserID]; !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("validator tidak aktif pada case ini")
	}

	now := time.Now().Unix()
	nextVotes := make([]RepoConfidenceVoteItem, 0, len(state.RepoConfidenceVotes)+1)
	updated := false
	for _, vote := range normalizeConfidenceVotes(state.RepoConfidenceVotes, activeSet) {
		if vote.VoterUserID == voterUserID {
			nextVotes = append(nextVotes, RepoConfidenceVoteItem{
				VoterUserID:     voterUserID,
				ValidatorUserID: validatorUserID,
				VotedAt:         now,
			})
			updated = true
			continue
		}
		nextVotes = append(nextVotes, vote)
	}
	if !updated {
		nextVotes = append(nextVotes, RepoConfidenceVoteItem{
			VoterUserID:     voterUserID,
			ValidatorUserID: validatorUserID,
			VotedAt:         now,
		})
	}
	state.RepoConfidenceVotes = nextVotes

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(voterUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_confidence_vote_submitted", map[string]interface{}{
		"validator_user_id": validatorUserID,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, voterUserID)
}
