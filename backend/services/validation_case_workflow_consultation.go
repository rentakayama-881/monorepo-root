package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/tag"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

func requiredStakeForConsultation(vc *ent.ValidationCase) int64 {
	if vc == nil {
		return minCredibilityStakeIDR()
	}

	switch strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)) {
	case "S0":
		return 0
	case "S1":
		return consultationStakeMinS1
	case "S2":
		return consultationStakeMinS2
	case "S3":
		if vc.BountyAmount > 0 {
			return vc.BountyAmount
		}
		return minCredibilityStakeIDR()
	default:
		return minCredibilityStakeIDR()
	}
}

func (s *EntValidationCaseWorkflowService) RequestConsultation(ctx context.Context, validationCaseID uint, validatorUserID uint) (uint, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrValidationCaseNotFound
		}
		return 0, apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return 0, err
	}

	if vc.UserID == int(validatorUserID) {
		return 0, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat Request Consultation pada kasusnya sendiri")
	}
	switch normalizeStatus(vc.Status) {
	case caseStatusOpen:
		// allowed
	case caseStatusWaitingOwnerResponse, caseStatusOnHoldOwnerInactive:
		return 0, apperrors.ErrInvalidInput.WithDetails("kasus sedang menunggu respons owner. Tidak dapat menerima validator baru.")
	default:
		return 0, apperrors.ErrInvalidInput.WithDetails("Request Consultation hanya dapat diajukan saat status kasus masih open")
	}

	validator, err := s.client.User.Get(ctx, int(validatorUserID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrUserNotFound
		}
		return 0, apperrors.ErrDatabase
	}

	requiredStake := requiredStakeForConsultation(vc)
	if validator.GuaranteeAmount < requiredStake {
		return 0, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf(
				"Credibility Stake tidak memenuhi syarat untuk sensitivity %s. Minimal Rp %d",
				strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)),
				requiredStake,
			),
		)
	}

	cycle := currentWorkflowCycle(vc)
	exists, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.WorkflowCycleEQ(cycle),
		).
		Exist(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}
	if exists {
		return 0, apperrors.ErrInvalidInput.WithDetails("Request Consultation sudah pernah diajukan untuk kasus ini")
	}

	req, err := s.client.ConsultationRequest.
		Create().
		SetValidationCaseID(int(validationCaseID)).
		SetValidatorUserID(int(validatorUserID)).
		SetWorkflowCycle(cycle).
		SetStatus(consultationStatusPending).
		SetReminderCount(0).
		Save(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_requested", map[string]interface{}{
		"validator_user_id": validatorUserID,
		"required_stake":    requiredStake,
		"workflow_cycle":    cycle,
	})

	return uint(req.ID), nil
}

func (s *EntValidationCaseWorkflowService) GetConsultationRequestForValidator(
	ctx context.Context,
	validationCaseID uint,
	validatorUserID uint,
) (*ValidatorConsultationRequestSummary, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return nil, err
	}
	cycle := currentWorkflowCycle(vc)

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.WorkflowCycleEQ(cycle),
		).
		Order(ent.Desc(consultationrequest.FieldCreatedAt)).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, apperrors.ErrDatabase
	}

	return &ValidatorConsultationRequestSummary{
		ID:                 uint(req.ID),
		Status:             normalizeStatus(req.Status),
		ApprovedAt:         unixPtr(req.ApprovedAt),
		RejectedAt:         unixPtr(req.RejectedAt),
		ExpiresAt:          unixPtr(req.ExpiresAt),
		OwnerResponseDueAt: unixPtr(req.OwnerResponseDueAt),
		CreatedAt:          req.CreatedAt.Unix(),
	}, nil
}

func (s *EntValidationCaseWorkflowService) ListConsultationGuaranteeLocksForValidator(
	ctx context.Context,
	validatorUserID uint,
) ([]ConsultationGuaranteeLockItem, error) {
	reqs, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusIn(
				consultationStatusApproved,
				consultationStatusWaitingOwnerResponse,
				consultationStatusOwnerTimeout,
			),
		).
		WithValidationCase().
		Order(ent.Desc(consultationrequest.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	out := make([]ConsultationGuaranteeLockItem, 0, len(reqs))
	seenCaseID := make(map[uint]struct{}, len(reqs))
	for _, req := range reqs {
		vc := req.Edges.ValidationCase
		if vc == nil {
			continue
		}
		if err := ensureWorkflowV1Case(vc); err != nil {
			continue
		}
		if req.WorkflowCycle != currentWorkflowCycle(vc) {
			continue
		}

		escrowTransferID := strings.TrimSpace(valueOrEmpty(vc.EscrowTransferID))
		validationStatus := normalizeStatus(vc.Status)

		// Completed cases with no escrow are treated as already closed and should not block guarantee release.
		if validationStatus == "completed" && escrowTransferID == "" {
			continue
		}

		out = append(out, ConsultationGuaranteeLockItem{
			ValidationCaseID:   uint(vc.ID),
			ValidationStatus:   validationStatus,
			ConsultationStatus: normalizeStatus(req.Status),
			EscrowTransferID:   escrowTransferID,
			DisputeID:          strings.TrimSpace(valueOrEmpty(vc.DisputeID)),
		})
		seenCaseID[uint(vc.ID)] = struct{}{}
	}

	workspaceCases, err := s.client.ValidationCase.Query().
		Where(validationcase.StatusNEQ(caseStatusCompleted)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	for _, vc := range workspaceCases {
		vcID := uint(vc.ID)
		if _, exists := seenCaseID[vcID]; exists {
			continue
		}

		state := loadRepoMetaState(vc.Meta)
		if !isWorkspaceMetaState(state) {
			continue
		}
		if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
			continue
		}
		if !containsUint(activeAssignmentValidatorIDs(state.RepoAssignments), validatorUserID) {
			continue
		}

		out = append(out, ConsultationGuaranteeLockItem{
			ValidationCaseID:   vcID,
			ValidationStatus:   normalizeStatus(vc.Status),
			ConsultationStatus: "repo_assigned",
			EscrowTransferID:   strings.TrimSpace(valueOrEmpty(vc.EscrowTransferID)),
			DisputeID:          strings.TrimSpace(valueOrEmpty(vc.DisputeID)),
		})
		seenCaseID[vcID] = struct{}{}
	}

	return out, nil
}

func (s *EntValidationCaseWorkflowService) ListConsultationRequestsForOwner(ctx context.Context, validationCaseID uint, ownerUserID uint) ([]ConsultationRequestItem, error) {
	vc, err := s.client.ValidationCase.Query().
		Where(validationcase.IDEQ(int(validationCaseID))).
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return nil, err
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}
	cycle := currentWorkflowCycle(vc)

	items, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.WorkflowCycleEQ(cycle),
		).
		WithValidatorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Order(ent.Desc(consultationrequest.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	// Batch-load all FinalOffer and ConsultationRequest data for all validators
	// to avoid N+1 queries in buildMatchingScore.
	validatorIDs := make([]int, 0, len(items))
	validatorIDSet := make(map[int]struct{})
	for _, it := range items {
		if _, ok := validatorIDSet[it.ValidatorUserID]; !ok {
			validatorIDSet[it.ValidatorUserID] = struct{}{}
			validatorIDs = append(validatorIDs, it.ValidatorUserID)
		}
	}
	if len(validatorIDs) == 0 {
		return []ConsultationRequestItem{}, nil
	}

	// Batch load all FinalOffers for these validators
	allOffers, err := s.client.FinalOffer.Query().
		Where(finaloffer.ValidatorUserIDIn(validatorIDs...)).
		Order(ent.Desc(finaloffer.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	offersByValidator := make(map[int][]*ent.FinalOffer)
	for _, o := range allOffers {
		offersByValidator[o.ValidatorUserID] = append(offersByValidator[o.ValidatorUserID], o)
	}

	// Batch load all approved ConsultationRequests for these validators
	allApprovedReqs, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidatorUserIDIn(validatorIDs...),
			consultationrequest.ApprovedAtNotNil(),
		).
		Limit(200 * len(validatorIDs)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	approvedReqsByValidator := make(map[int][]*ent.ConsultationRequest)
	for _, r := range allApprovedReqs {
		approvedReqsByValidator[r.ValidatorUserID] = append(approvedReqsByValidator[r.ValidatorUserID], r)
	}

	// Batch load all history validation cases (from offers)
	historyCaseIDSet := make(map[int]struct{})
	for _, o := range allOffers {
		historyCaseIDSet[o.ValidationCaseID] = struct{}{}
	}
	historyCaseIDs := make([]int, 0, len(historyCaseIDSet))
	for id := range historyCaseIDSet {
		historyCaseIDs = append(historyCaseIDs, id)
	}
	var allHistoryCases []*ent.ValidationCase
	if len(historyCaseIDs) > 0 {
		allHistoryCases, err = s.client.ValidationCase.Query().
			Where(validationcase.IDIn(historyCaseIDs...)).
			WithTags(func(q *ent.TagQuery) {
				q.Where(tag.IsActiveEQ(true))
			}).
			All(ctx)
		if err != nil {
			return nil, apperrors.ErrDatabase
		}
	}
	historyCaseByID := make(map[int]*ent.ValidationCase)
	for _, hc := range allHistoryCases {
		historyCaseByID[hc.ID] = hc
	}

	out := make([]ConsultationRequestItem, 0, len(items))
	scoreCache := make(map[int]*MatchingScoreBreakdown)
	for _, it := range items {
		validator := buildUserSummaryFromEnt(it.Edges.ValidatorUser)
		score, cached := scoreCache[it.ValidatorUserID]
		if !cached {
			scored, scoreErr := s.buildMatchingScoreBatch(
				vc, it.ValidatorUserID, validator.GuaranteeAmount,
				offersByValidator[it.ValidatorUserID],
				approvedReqsByValidator[it.ValidatorUserID],
				historyCaseByID,
			)
			if scoreErr != nil {
				logger.Warn("Failed to compute validator matching score",
					zap.Error(scoreErr),
					zap.Int("validation_case_id", vc.ID),
					zap.Int("validator_user_id", it.ValidatorUserID),
				)
			}
			score = scored
			scoreCache[it.ValidatorUserID] = score
		}
		out = append(out, ConsultationRequestItem{
			ID:                 uint(it.ID),
			ValidationCaseID:   validationCaseID,
			Validator:          validator,
			Status:             it.Status,
			ApprovedAt:         unixPtr(it.ApprovedAt),
			RejectedAt:         unixPtr(it.RejectedAt),
			ExpiresAt:          unixPtr(it.ExpiresAt),
			OwnerResponseDueAt: unixPtr(it.OwnerResponseDueAt),
			ReminderCount:      it.ReminderCount,
			AutoClosedReason:   strings.TrimSpace(valueOrEmpty(it.AutoClosedReason)),
			MatchingScore:      score,
			CreatedAt:          it.CreatedAt.Unix(),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		si := -1
		sj := -1
		if out[i].MatchingScore != nil {
			si = out[i].MatchingScore.Total
		}
		if out[j].MatchingScore != nil {
			sj = out[j].MatchingScore.Total
		}
		if si == sj {
			return out[i].CreatedAt > out[j].CreatedAt
		}
		return si > sj
	})

	return out, nil
}

func (s *EntValidationCaseWorkflowService) ApproveConsultationRequest(ctx context.Context, validationCaseID uint, ownerUserID uint, requestID uint) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return err
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.IDEQ(int(requestID)),
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak ditemukan")
		}
		return apperrors.ErrDatabase
	}
	if req.WorkflowCycle != currentWorkflowCycle(vc) {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request berasal dari siklus workflow sebelumnya")
	}

	if normalizeStatus(req.Status) != consultationStatusPending {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak dalam status pending")
	}

	// Use transaction to ensure atomicity of consultation request + case log updates
	tx, err := s.client.Tx(ctx)
	if err != nil {
		return apperrors.ErrDatabase
	}
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()

	now := time.Now()
	if _, err := tx.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus(consultationStatusApproved).
		SetApprovedAt(now).
		ClearRejectedAt().
		ClearOwnerResponseDueAt().
		ClearExpiresAt().
		SetReminderCount(0).
		ClearAutoClosedReason().
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return apperrors.ErrDatabase
	}

	if err := tx.Commit(); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_approved", map[string]interface{}{
		"validator_user_id": req.ValidatorUserID,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) RejectConsultationRequest(ctx context.Context, validationCaseID uint, ownerUserID uint, requestID uint, reason string) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return err
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.IDEQ(int(requestID)),
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak ditemukan")
		}
		return apperrors.ErrDatabase
	}
	if req.WorkflowCycle != currentWorkflowCycle(vc) {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request berasal dari siklus workflow sebelumnya")
	}

	if normalizeStatus(req.Status) != consultationStatusPending {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak dalam status pending")
	}

	now := time.Now()
	if _, err := s.client.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus(consultationStatusRejected).
		SetRejectedAt(now).
		ClearApprovedAt().
		ClearOwnerResponseDueAt().
		ClearExpiresAt().
		SetReminderCount(0).
		ClearAutoClosedReason().
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_rejected", map[string]interface{}{
		"validator_user_id": req.ValidatorUserID,
		"reason":            strings.TrimSpace(reason),
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) ProcessOwnerResponseSLA(ctx context.Context) (int, int, error) {
	now := time.Now()
	reminderEvents := 0
	timeoutEvents := 0

	recovered, err := s.normalizeLegacyClarificationFlow(ctx, now)
	if err != nil {
		return 0, 0, err
	}
	if recovered > 0 {
		logger.Info("Normalized legacy clarification workflow states",
			zap.Int("recovered_items", recovered),
		)
	}

	items, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.StatusEQ(consultationStatusWaitingOwnerResponse),
			consultationrequest.OwnerResponseDueAtNotNil(),
		).
		All(ctx)
	if err != nil {
		return 0, 0, apperrors.ErrDatabase
	}

	for _, req := range items {
		if req.OwnerResponseDueAt == nil {
			continue
		}
		vc, err := s.client.ValidationCase.Get(ctx, req.ValidationCaseID)
		if err != nil {
			if ent.IsNotFound(err) {
				continue
			}
			return reminderEvents, timeoutEvents, apperrors.ErrDatabase
		}
		if err := ensureWorkflowV1Case(vc); err != nil {
			continue
		}
		if req.WorkflowCycle != currentWorkflowCycle(vc) {
			continue
		}

		due := req.OwnerResponseDueAt
		start := due.Add(-ownerResponseSLAHours * time.Hour)
		elapsed := now.Sub(start)

		newReminderCount := req.ReminderCount
		if elapsed >= ownerReminderFirstHour*time.Hour && newReminderCount < 1 {
			s.appendCaseLogBestEffort(ctx, vc.ID, nil, "owner_response_sla_reminder", map[string]interface{}{
				"consultation_request_id": req.ID,
				"reminder_hour":           ownerReminderFirstHour,
				"owner_response_due_at":   due.Unix(),
			})
			newReminderCount = 1
			reminderEvents++
		}
		if elapsed >= ownerReminderSecondHour*time.Hour && newReminderCount < 2 {
			s.appendCaseLogBestEffort(ctx, vc.ID, nil, "owner_response_sla_reminder", map[string]interface{}{
				"consultation_request_id": req.ID,
				"reminder_hour":           ownerReminderSecondHour,
				"owner_response_due_at":   due.Unix(),
			})
			newReminderCount = 2
			reminderEvents++
		}
		if newReminderCount != req.ReminderCount {
			_, _ = s.client.ConsultationRequest.UpdateOneID(req.ID).
				SetReminderCount(newReminderCount).
				Save(ctx)
		}

		if now.Before(*due) {
			continue
		}

		if _, err := s.client.ConsultationRequest.UpdateOneID(req.ID).
			SetStatus(consultationStatusOwnerTimeout).
			SetReminderCount(newReminderCount).
			SetExpiresAt(now).
			SetAutoClosedReason("owner_inactive_sla_timeout").
			Save(ctx); err != nil {
			return reminderEvents, timeoutEvents, apperrors.ErrDatabase
		}

		caseUpdate := s.client.ValidationCase.UpdateOneID(vc.ID).
			SetStatus(caseStatusOnHoldOwnerInactive).
			SetClarificationState(clarificationStateOwnerInactiveSLAExpired)
		if normalizeStatus(vc.Status) != caseStatusOnHoldOwnerInactive {
			caseUpdate.AddOwnerInactivityCount(1)
		}
		if _, err := caseUpdate.Save(ctx); err != nil {
			return reminderEvents, timeoutEvents, apperrors.ErrDatabase
		}

		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "owner_response_sla_expired", map[string]interface{}{
			"consultation_request_id": req.ID,
			"owner_response_due_at":   due.Unix(),
			"timeout_reason":          "owner_inactive_sla_timeout",
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "case_status_changed", map[string]interface{}{
			"from":   normalizeStatus(vc.Status),
			"to":     caseStatusOnHoldOwnerInactive,
			"reason": "owner_inactive_sla_timeout",
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "validator_released_without_penalty", map[string]interface{}{
			"validator_user_id":       req.ValidatorUserID,
			"consultation_request_id": req.ID,
			"reassignment":            false,
			"reputation_impact":       "none",
		})
		timeoutEvents++
	}

	return reminderEvents, timeoutEvents, nil
}
