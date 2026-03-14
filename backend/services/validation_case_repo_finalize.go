package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	apperrors "backend-gin/errors"
)

func buildRepoPayoutLedger(bounty int64, winner string, latest map[uint]RepoVerdictItem) *RepoPayoutLedger {
	if bounty <= 0 || len(latest) == 0 {
		return nil
	}

	validatorIDs := make([]uint, 0, len(latest))
	for validatorID := range latest {
		validatorIDs = append(validatorIDs, validatorID)
	}
	sort.Slice(validatorIDs, func(i, j int) bool { return validatorIDs[i] < validatorIDs[j] })

	basePool := (bounty * 70) / 100
	qualityPool := (bounty * 20) / 100
	chainPool := bounty - basePool - qualityPool

	n := int64(len(validatorIDs))
	basePer := int64(0)
	baseRemainder := int64(0)
	if n > 0 {
		basePer = basePool / n
		baseRemainder = basePool % n
	}

	chainPer := int64(0)
	chainRemainder := int64(0)
	if n > 0 {
		chainPer = chainPool / n
		chainRemainder = chainPool % n
	}

	points := make(map[uint]int64, len(validatorIDs))
	totalPoints := int64(0)
	for _, validatorID := range validatorIDs {
		verdict := latest[validatorID]
		if normalizeRepoVerdict(verdict.Verdict) == winner {
			p := int64(verdict.Confidence)
			if p < 1 {
				p = 1
			}
			points[validatorID] = p
			totalPoints += p
			continue
		}
		points[validatorID] = 0
	}

	qualityByValidator := make(map[uint]int64, len(validatorIDs))
	qualityAssigned := int64(0)
	if totalPoints <= 0 && n > 0 {
		qPer := qualityPool / n
		qRem := qualityPool % n
		for i, validatorID := range validatorIDs {
			qualityByValidator[validatorID] = qPer
			if int64(i) < qRem {
				qualityByValidator[validatorID]++
			}
			qualityAssigned += qualityByValidator[validatorID]
		}
	} else if totalPoints > 0 {
		for _, validatorID := range validatorIDs {
			share := (qualityPool * points[validatorID]) / totalPoints
			qualityByValidator[validatorID] = share
			qualityAssigned += share
		}
		remaining := qualityPool - qualityAssigned
		for i := 0; i < len(validatorIDs) && remaining > 0; i++ {
			qualityByValidator[validatorIDs[i]]++
			remaining--
		}
	}

	entries := make([]RepoPayoutEntry, 0, len(validatorIDs))
	for i, validatorID := range validatorIDs {
		baseAmount := basePer
		if int64(i) < baseRemainder {
			baseAmount++
		}
		chainLocked := chainPer
		if int64(i) < chainRemainder {
			chainLocked++
		}
		entries = append(entries, RepoPayoutEntry{
			ValidatorUserID: validatorID,
			BaseAmount:      baseAmount,
			QualityAmount:   qualityByValidator[validatorID],
			ChainLocked:     chainLocked,
			ChainStatus:     repoChainStatusLocked,
		})
	}

	return &RepoPayoutLedger{
		BountyAmount: bounty,
		BasePool:     basePool,
		QualityPool:  qualityPool,
		ChainPool:    chainPool,
		Entries:      entries,
		CreatedAt:    time.Now().Unix(),
	}
}

func buildConfidenceBreakdownByValidator(
	assignments []RepoAssignmentItem,
	votes []RepoConfidenceVoteItem,
) map[string]int {
	activeSet := validatorIDSet(activeAssignmentValidatorIDs(assignments))
	normalized := normalizeConfidenceVotes(votes, activeSet)
	countByValidator := confidenceVoteCountByValidator(normalized)
	breakdown := make(map[string]int, len(countByValidator))
	for validatorID, count := range countByValidator {
		breakdown[fmt.Sprintf("validator_%d", validatorID)] = count
	}
	return breakdown
}

func (s *EntValidationCaseRepoWorkflowService) buildConsensusResponse(
	validationCaseID uint,
	state repoMetaState,
) *RepoConsensusResponse {
	uploadedCount := len(activeValidatorOutputCounts(state.RepoFiles, state.RepoAssignments))
	return &RepoConsensusResponse{
		CaseID:          validationCaseID,
		CompletionMode:  normalizeRepoCompletionMode(state.CompletionMode),
		ConsensusStatus: normalizeRepoConsensusStatus(state.ConsensusStatus),
		ConsensusResult: strings.TrimSpace(state.ConsensusResult),
		RequiredVotes:   repoMinimumValidatorUploads,
		SubmittedVotes:  uploadedCount,
		Breakdown:       buildConfidenceBreakdownByValidator(state.RepoAssignments, state.RepoConfidenceVotes),
		Payout:          state.RepoPayout,
	}
}

func (s *EntValidationCaseRepoWorkflowService) FinalizeRepoCase(
	ctx context.Context,
	validationCaseID uint,
	ownerUserID uint,
	authHeader string,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}

	outputCountByValidator := activeValidatorOutputCounts(state.RepoFiles, state.RepoAssignments)
	if len(outputCountByValidator) < repoMinimumValidatorUploads {
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf("finalisasi membutuhkan minimal %d validator yang upload hasil", repoMinimumValidatorUploads),
		)
	}

	eligibleVoteBase := make(map[uint]int, len(outputCountByValidator))
	for validatorID := range outputCountByValidator {
		eligibleVoteBase[validatorID] = 0
	}
	eligibleSet := validatorIDSet(sortedKeysUint(eligibleVoteBase))
	normalizedVotes := normalizeConfidenceVotes(state.RepoConfidenceVotes, eligibleSet)
	confidenceByValidator := confidenceVoteCountByValidator(normalizedVotes)

	maxVotes := -1
	winnerIDs := make([]uint, 0, len(eligibleVoteBase))
	for _, validatorID := range sortedKeysUint(eligibleVoteBase) {
		votes := confidenceByValidator[validatorID]
		if votes > maxVotes {
			maxVotes = votes
			winnerIDs = []uint{validatorID}
			continue
		}
		if votes == maxVotes {
			winnerIDs = append(winnerIDs, validatorID)
		}
	}
	if len(winnerIDs) == 0 {
		return nil, apperrors.ErrInvalidInput.WithDetails("tidak ada validator eligible untuk finalisasi")
	}

	payoutByValidator := splitAmountEvenly(vc.BountyAmount, winnerIDs)
	payoutEntries := make([]RepoPayoutEntry, 0, len(winnerIDs))
	for _, validatorID := range winnerIDs {
		payoutEntries = append(payoutEntries, RepoPayoutEntry{
			ValidatorUserID: validatorID,
			Amount:          payoutByValidator[validatorID],
			ConfidenceVotes: confidenceByValidator[validatorID],
		})
	}

	if strings.TrimSpace(state.BountyReserveOrderID) == "" || normalizeRepoBountyReserveStatus(state.BountyReserveStatus) != repoBountyReserveStatusReserved {
		return nil, apperrors.ErrInvalidInput.WithDetails("reserve bounty belum aktif. Case tidak bisa difinalisasi.")
	}

	featureWallet := NewFeatureWalletClientFromConfig()
	recipients := make([]FeatureMarketDistributionRecipient, 0, len(payoutEntries))
	for _, entry := range payoutEntries {
		recipients = append(recipients, FeatureMarketDistributionRecipient{
			UserID:    entry.ValidatorUserID,
			AmountIDR: entry.Amount,
		})
	}
	if _, err := featureWallet.DistributeMarketPurchase(
		ctx,
		strings.TrimSpace(authHeader),
		state.BountyReserveOrderID,
		recipients,
		fmt.Sprintf("Validation Case #%d finalized payout", vc.ID),
		"validation_case",
	); err != nil {
		return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("gagal mencairkan bounty: %s", err.Error()))
	}

	confidenceStringMap := make(map[string]int, len(confidenceByValidator))
	for validatorID, votes := range confidenceByValidator {
		confidenceStringMap[fmt.Sprintf("%d", validatorID)] = votes
	}
	state.RepoPayout = &RepoPayoutLedger{
		BountyAmount:      vc.BountyAmount,
		WinnerValidatorID: winnerIDs,
		Confidence:        confidenceStringMap,
		Entries:           payoutEntries,
		CreatedAt:         time.Now().Unix(),
	}
	state.ConsensusStatus = repoConsensusFinalized
	state.ConsensusResult = "confidence_vote"
	state.RepoStage = repoStageFinalized
	state.BountyReserveStatus = repoBountyReserveStatusDisbursed

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetMeta(meta).
		SetStatus(caseStatusCompleted).
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_case_finalized", map[string]interface{}{
		"winner_validator_ids": winnerIDs,
		"bounty_amount":        vc.BountyAmount,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, ownerUserID)
}

func (s *EntValidationCaseRepoWorkflowService) GetRepoConsensus(
	ctx context.Context,
	validationCaseID uint,
	viewerUserID uint,
) (*RepoConsensusResponse, error) {
	_ = viewerUserID
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	return s.buildConsensusResponse(validationCaseID, state), nil
}
