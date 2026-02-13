package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/tag"
	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
	"backend-gin/ent/validationcaselog"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// EntValidationCaseWorkflowService implements the Validation Protocol workflow for Validation Cases.
// Financial actions (escrow/dispute) are verified against Feature Service using the caller's Authorization header.
type EntValidationCaseWorkflowService struct {
	client *ent.Client
}

func NewEntValidationCaseWorkflowService() *EntValidationCaseWorkflowService {
	return &EntValidationCaseWorkflowService{client: database.GetEntClient()}
}

const (
	caseStatusOpen                 = "open"
	caseStatusWaitingOwnerResponse = "waiting_owner_response"
	caseStatusOnHoldOwnerInactive  = "on_hold_owner_inactive"

	clarificationStateNone                    = "none"
	clarificationStateWaitingOwnerResponse    = "waiting_owner_response"
	clarificationStateAssumptionPending       = "assumption_pending_owner_decision"
	clarificationStateOwnerResponded          = "owner_responded"
	clarificationStateAssumptionApproved      = "assumption_approved"
	clarificationStateAssumptionRejected      = "assumption_rejected"
	clarificationStateOwnerInactiveSLAExpired = "owner_inactive_sla_expired"

	consultationStatusPending              = "pending"
	consultationStatusApproved             = "approved"
	consultationStatusRejected             = "rejected"
	consultationStatusWaitingOwnerResponse = "waiting_owner_response"
	consultationStatusOwnerTimeout         = "owner_timeout"

	clarificationModeQuestion   = "question"
	clarificationModeAssumption = "assumption"

	ownerResponseSLAHours   = 12
	ownerReminderFirstHour  = 2
	ownerReminderSecondHour = 8
)

// minCredibilityStakeIDR returns minimum required active guarantee/stake for validators to request consultation.
//
// Evidence basis:
// Feature Service enforces a minimum guarantee lock of Rp 100.000 for `GuaranteeService.SetGuaranteeAsync`.
// We mirror that as the default stake gate in Go backend (configurable via env).
func minCredibilityStakeIDR() int64 {
	const defaultMin = int64(100_000)
	raw := strings.TrimSpace(os.Getenv("MIN_CREDIBILITY_STAKE_IDR"))
	if raw == "" {
		return defaultMin
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v < 0 {
		return defaultMin
	}
	return v
}

func normalizeStatus(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func unixPtr(t *time.Time) *int64 {
	if t == nil {
		return nil
	}
	v := t.Unix()
	return &v
}

func valueOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func dueTimeFromNow(now time.Time) time.Time {
	return now.Add(ownerResponseSLAHours * time.Hour)
}

func reminderScheduleHours() []int {
	return []int{ownerReminderFirstHour, ownerReminderSecondHour}
}

func clampScore(v int) int {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

func overlapScore(caseTags map[string]struct{}, historyTags map[string]struct{}) int {
	if len(caseTags) == 0 {
		return 50
	}
	if len(historyTags) == 0 {
		return 0
	}
	matches := 0
	for slug := range caseTags {
		if _, ok := historyTags[slug]; ok {
			matches++
		}
	}
	return clampScore(int(math.Round(float64(matches) * 100 / float64(len(caseTags)))))
}

func extractTagSetByPrefix(tags []*ent.Tag, prefix string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, t := range tags {
		slug := strings.ToLower(strings.TrimSpace(t.Slug))
		if slug == "" {
			continue
		}
		if strings.HasPrefix(slug, prefix) {
			out[slug] = struct{}{}
		}
	}
	return out
}

func stakeGuaranteeScore(guaranteeAmount int64) int {
	required := minCredibilityStakeIDR()
	if required <= 0 {
		required = 100_000
	}
	if guaranteeAmount <= 0 {
		return 0
	}
	ratio := float64(guaranteeAmount) / float64(required)
	switch {
	case ratio >= 3.0:
		return 100
	case ratio >= 2.0:
		return 85
	case ratio >= 1.5:
		return 70
	case ratio >= 1.0:
		return 55
	default:
		return 35
	}
}

func responsivenessSLAScore(approvedReqs []*ent.ConsultationRequest, firstOfferByCase map[int]time.Time, now time.Time) int {
	if len(approvedReqs) == 0 {
		return 50
	}

	total := 0
	count := 0
	for _, req := range approvedReqs {
		if req.ApprovedAt == nil {
			continue
		}
		approvedAt := *req.ApprovedAt
		offerAt, hasOffer := firstOfferByCase[req.ValidationCaseID]
		score := 50
		if hasOffer {
			if offerAt.Before(approvedAt) {
				offerAt = approvedAt
			}
			lag := offerAt.Sub(approvedAt)
			switch {
			case lag <= 2*time.Hour:
				score = 100
			case lag <= 8*time.Hour:
				score = 80
			case lag <= 24*time.Hour:
				score = 60
			default:
				score = 30
			}
		} else {
			if now.Sub(approvedAt) > 24*time.Hour {
				score = 0
			}
		}
		total += score
		count++
	}

	if count == 0 {
		return 50
	}
	return clampScore(int(math.Round(float64(total) / float64(count))))
}

func (s *EntValidationCaseWorkflowService) buildMatchingScore(
	ctx context.Context,
	vc *ent.ValidationCase,
	validatorUserID int,
	guaranteeAmount int64,
) (*MatchingScoreBreakdown, error) {
	caseDomain := extractTagSetByPrefix(vc.Edges.Tags, "domain-")
	caseEvidence := extractTagSetByPrefix(vc.Edges.Tags, "evidence-")

	offers, err := s.client.FinalOffer.Query().
		Where(finaloffer.ValidatorUserIDEQ(validatorUserID)).
		Order(ent.Desc(finaloffer.FieldCreatedAt)).
		Limit(300).
		All(ctx)
	if err != nil {
		return nil, err
	}

	caseIDs := make([]int, 0, len(offers))
	seenCase := make(map[int]struct{})
	firstOfferByCase := make(map[int]time.Time)
	for _, offer := range offers {
		if _, ok := seenCase[offer.ValidationCaseID]; !ok {
			seenCase[offer.ValidationCaseID] = struct{}{}
			caseIDs = append(caseIDs, offer.ValidationCaseID)
		}
		if current, ok := firstOfferByCase[offer.ValidationCaseID]; !ok || offer.CreatedAt.Before(current) {
			firstOfferByCase[offer.ValidationCaseID] = offer.CreatedAt
		}
	}

	var historyCases []*ent.ValidationCase
	if len(caseIDs) > 0 {
		historyCases, err = s.client.ValidationCase.Query().
			Where(validationcase.IDIn(caseIDs...)).
			WithTags(func(q *ent.TagQuery) {
				q.Where(tag.IsActiveEQ(true))
			}).
			All(ctx)
		if err != nil {
			return nil, err
		}
	}

	historyDomain := map[string]struct{}{}
	historyEvidence := map[string]struct{}{}
	disputedCount := 0
	for _, hc := range historyCases {
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "domain-") {
			historyDomain[slug] = struct{}{}
		}
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "evidence-") {
			historyEvidence[slug] = struct{}{}
		}
		if normalizeStatus(hc.Status) == "disputed" {
			disputedCount++
		}
	}

	domainScore := overlapScore(caseDomain, historyDomain)
	evidenceScore := overlapScore(caseEvidence, historyEvidence)

	historyDisputeScore := 50
	if len(historyCases) > 0 {
		historyDisputeScore = clampScore(int(math.Round((1 - float64(disputedCount)/float64(len(historyCases))) * 100)))
	}

	approvedReqs, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidatorUserIDEQ(validatorUserID),
			consultationrequest.ApprovedAtNotNil(),
		).
		Limit(200).
		All(ctx)
	if err != nil {
		return nil, err
	}
	responsivenessScore := responsivenessSLAScore(approvedReqs, firstOfferByCase, time.Now())

	stakeScore := stakeGuaranteeScore(guaranteeAmount)
	total := clampScore(int(math.Round(float64(domainScore+evidenceScore+historyDisputeScore+responsivenessScore+stakeScore) / 5)))

	return &MatchingScoreBreakdown{
		Total:             total,
		DomainFit:         domainScore,
		EvidenceFit:       evidenceScore,
		HistoryDispute:    historyDisputeScore,
		ResponsivenessSLA: responsivenessScore,
		StakeGuarantee:    stakeScore,
	}, nil
}

// buildMatchingScoreBatch computes matching score using pre-loaded data to avoid N+1 queries.
func (s *EntValidationCaseWorkflowService) buildMatchingScoreBatch(
	vc *ent.ValidationCase,
	validatorUserID int,
	guaranteeAmount int64,
	offers []*ent.FinalOffer,
	approvedReqs []*ent.ConsultationRequest,
	historyCaseByID map[int]*ent.ValidationCase,
) (*MatchingScoreBreakdown, error) {
	caseDomain := extractTagSetByPrefix(vc.Edges.Tags, "domain-")
	caseEvidence := extractTagSetByPrefix(vc.Edges.Tags, "evidence-")

	// Build history from pre-loaded offers
	firstOfferByCase := make(map[int]time.Time)
	caseIDs := make([]int, 0)
	seenCase := make(map[int]struct{})
	for _, offer := range offers {
		if _, ok := seenCase[offer.ValidationCaseID]; !ok {
			seenCase[offer.ValidationCaseID] = struct{}{}
			caseIDs = append(caseIDs, offer.ValidationCaseID)
		}
		if current, ok := firstOfferByCase[offer.ValidationCaseID]; !ok || offer.CreatedAt.Before(current) {
			firstOfferByCase[offer.ValidationCaseID] = offer.CreatedAt
		}
	}

	historyDomain := map[string]struct{}{}
	historyEvidence := map[string]struct{}{}
	disputedCount := 0
	historyCaseCount := 0
	for _, caseID := range caseIDs {
		hc, ok := historyCaseByID[caseID]
		if !ok {
			continue
		}
		historyCaseCount++
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "domain-") {
			historyDomain[slug] = struct{}{}
		}
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "evidence-") {
			historyEvidence[slug] = struct{}{}
		}
		if normalizeStatus(hc.Status) == "disputed" {
			disputedCount++
		}
	}

	domainScore := overlapScore(caseDomain, historyDomain)
	evidenceScore := overlapScore(caseEvidence, historyEvidence)

	historyDisputeScore := 50
	if historyCaseCount > 0 {
		historyDisputeScore = clampScore(int(math.Round((1 - float64(disputedCount)/float64(historyCaseCount)) * 100)))
	}

	responsivenessScore := responsivenessSLAScore(approvedReqs, firstOfferByCase, time.Now())
	stakeScore := stakeGuaranteeScore(guaranteeAmount)
	total := clampScore(int(math.Round(float64(domainScore+evidenceScore+historyDisputeScore+responsivenessScore+stakeScore) / 5)))

	return &MatchingScoreBreakdown{
		Total:             total,
		DomainFit:         domainScore,
		EvidenceFit:       evidenceScore,
		HistoryDispute:    historyDisputeScore,
		ResponsivenessSLA: responsivenessScore,
		StakeGuarantee:    stakeScore,
	}, nil
}

func sanitizeAssumptionItems(items []AssumptionItem) []map[string]string {
	out := make([]map[string]string, 0, len(items))
	for _, item := range items {
		label := strings.TrimSpace(item.Item)
		if label == "" {
			continue
		}
		out = append(out, map[string]string{
			"item":      label,
			"rationale": strings.TrimSpace(item.Rationale),
			"impact":    strings.TrimSpace(item.Impact),
		})
	}
	return out
}

func isConsultationApprovedStatus(status string) bool {
	return normalizeStatus(status) == consultationStatusApproved
}

func (s *EntValidationCaseWorkflowService) appendCaseLogBestEffort(ctx context.Context, validationCaseID int, actorUserID *int, eventType string, detail map[string]interface{}) {
	create := s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(validationCaseID).
		SetEventType(eventType).
		SetDetailJSON(detail)
	if actorUserID != nil && *actorUserID > 0 {
		create.SetActorUserID(*actorUserID)
	}
	if _, err := create.Save(ctx); err != nil {
		logger.Warn("Failed to append case log (best effort)",
			zap.Error(err),
			zap.Int("validation_case_id", validationCaseID),
			zap.String("event_type", eventType),
		)
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

	requiredStake := minCredibilityStakeIDR()
	if validator.GuaranteeAmount < requiredStake {
		return 0, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("Credibility Stake tidak memenuhi syarat. Minimal Rp %d", requiredStake))
	}

	exists, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
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
	})

	return uint(req.ID), nil
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
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}

	items, err := s.client.ConsultationRequest.Query().
		Where(consultationrequest.ValidationCaseIDEQ(int(validationCaseID))).
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

func (s *EntValidationCaseWorkflowService) RequestOwnerClarification(
	ctx context.Context,
	validationCaseID uint,
	requestID uint,
	validatorUserID uint,
	input ClarificationRequestInput,
) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
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
	if req.ValidatorUserID != int(validatorUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if !isConsultationApprovedStatus(req.Status) {
		return apperrors.ErrInvalidInput.WithDetails("Clarification hanya bisa diajukan setelah Consultation disetujui")
	}

	mode := normalizeStatus(input.Mode)
	if mode == "" {
		mode = clarificationModeQuestion
	}
	if mode != clarificationModeQuestion && mode != clarificationModeAssumption {
		return apperrors.ErrInvalidInput.WithDetails("mode harus 'question' atau 'assumption'")
	}

	message := strings.TrimSpace(input.Message)
	if len(message) < 8 {
		return apperrors.ErrInvalidInput.WithDetails("message minimal 8 karakter")
	}

	assumptions := sanitizeAssumptionItems(input.Assumptions)
	caseClarificationState := clarificationStateWaitingOwnerResponse
	eventType := "clarification_requested"
	if mode == clarificationModeAssumption {
		if len(assumptions) == 0 {
			return apperrors.ErrInvalidInput.WithDetails("assumptions minimal 1 item untuk mode assumption")
		}
		caseClarificationState = clarificationStateAssumptionPending
		eventType = "assumption_mode_submitted"
	}

	// Use transaction to ensure atomicity of consultation request + validation case updates
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
	due := dueTimeFromNow(now)
	if _, err := tx.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus(consultationStatusWaitingOwnerResponse).
		SetOwnerResponseDueAt(due).
		SetExpiresAt(due).
		SetReminderCount(0).
		ClearAutoClosedReason().
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return apperrors.ErrDatabase
	}

	previousStatus := normalizeStatus(vc.Status)
	if _, err := tx.ValidationCase.UpdateOneID(vc.ID).
		SetStatus(caseStatusWaitingOwnerResponse).
		SetClarificationState(caseClarificationState).
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return apperrors.ErrDatabase
	}

	if err := tx.Commit(); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, eventType, map[string]interface{}{
		"consultation_request_id": req.ID,
		"mode":                    mode,
		"message":                 message,
		"assumptions":             assumptions,
		"owner_response_due_at":   due.Unix(),
		"sla_reminder_hours":      reminderScheduleHours(),
	})
	if previousStatus != caseStatusWaitingOwnerResponse {
		s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "case_status_changed", map[string]interface{}{
			"from":   previousStatus,
			"to":     caseStatusWaitingOwnerResponse,
			"reason": "validator_requested_owner_response",
		})
	}

	return nil
}

func (s *EntValidationCaseWorkflowService) RequestOwnerClarificationForValidator(
	ctx context.Context,
	validationCaseID uint,
	validatorUserID uint,
	input ClarificationRequestInput,
) error {
	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusEQ(consultationStatusApproved),
		).
		Order(ent.Desc(consultationrequest.FieldCreatedAt)).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrInvalidInput.WithDetails("Anda belum memiliki Consultation Request yang disetujui untuk kasus ini")
		}
		return apperrors.ErrDatabase
	}
	return s.RequestOwnerClarification(ctx, validationCaseID, uint(req.ID), validatorUserID, input)
}

func (s *EntValidationCaseWorkflowService) RespondOwnerClarification(
	ctx context.Context,
	validationCaseID uint,
	requestID uint,
	ownerUserID uint,
	input ClarificationResponseInput,
) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
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

	status := normalizeStatus(req.Status)
	if status != consultationStatusWaitingOwnerResponse && status != consultationStatusOwnerTimeout {
		return apperrors.ErrInvalidInput.WithDetails("Tidak ada request klarifikasi aktif untuk Consultation Request ini")
	}

	action := normalizeStatus(input.Action)
	if action == "" {
		action = "clarify"
	}
	switch action {
	case "clarify", "approve", "reject":
	default:
		return apperrors.ErrInvalidInput.WithDetails("action harus 'clarify', 'approve', atau 'reject'")
	}

	clarification := strings.TrimSpace(input.Clarification)
	if (action == "clarify" || action == "reject") && len(clarification) < 8 {
		return apperrors.ErrInvalidInput.WithDetails("clarification minimal 8 karakter")
	}
	if action == "approve" && normalizeStatus(vc.ClarificationState) != clarificationStateAssumptionPending {
		return apperrors.ErrInvalidInput.WithDetails("approve hanya valid untuk Assumption Mode")
	}

	newClarificationState := clarificationStateOwnerResponded
	eventType := "owner_clarification_submitted"
	switch action {
	case "approve":
		newClarificationState = clarificationStateAssumptionApproved
		eventType = "assumption_mode_approved"
	case "reject":
		newClarificationState = clarificationStateAssumptionRejected
		eventType = "assumption_mode_rejected"
	}

	// Use transaction to ensure atomicity of consultation request + validation case updates
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

	previousStatus := normalizeStatus(vc.Status)
	if _, err := tx.ValidationCase.UpdateOneID(vc.ID).
		SetStatus(caseStatusOpen).
		SetClarificationState(newClarificationState).
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return apperrors.ErrDatabase
	}

	if err := tx.Commit(); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, eventType, map[string]interface{}{
		"consultation_request_id": req.ID,
		"action":                  action,
		"clarification":           clarification,
	})
	if previousStatus != caseStatusOpen {
		s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "case_status_changed", map[string]interface{}{
			"from":   previousStatus,
			"to":     caseStatusOpen,
			"reason": "owner_response_received",
		})
	}
	if previousStatus == caseStatusOnHoldOwnerInactive {
		s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "case_resumed_from_owner_inactive", map[string]interface{}{
			"consultation_request_id": req.ID,
		})
	}

	return nil
}

func (s *EntValidationCaseWorkflowService) ProcessOwnerResponseSLA(ctx context.Context) (int, int, error) {
	now := time.Now()
	reminderEvents := 0
	timeoutEvents := 0

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

func (s *EntValidationCaseWorkflowService) RevealOwnerTelegramContact(ctx context.Context, validationCaseID uint, validatorUserID uint) (string, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return "", apperrors.ErrValidationCaseNotFound
		}
		return "", apperrors.ErrDatabase
	}
	switch strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)) {
	case "S2", "S3":
		return "", apperrors.ErrInvalidInput.WithDetails("Sensitivity policy melarang reveal Telegram untuk tier ini")
	}

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(vc.ID),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusEQ(consultationStatusApproved),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// Authenticated validator, but not authorized to reveal contact until owner approves.
			return "", apperrors.ErrConsultationNotApproved
		}
		return "", apperrors.ErrDatabase
	}
	_ = req

	owner, err := s.client.User.Get(ctx, vc.UserID)
	if err != nil {
		return "", apperrors.ErrDatabase
	}

	telegram := strings.TrimSpace(owner.Telegram)
	if telegram == "" {
		return "", apperrors.ErrInvalidInput.WithDetails("Pemilik kasus belum mengatur Telegram di akun")
	}
	if !strings.HasPrefix(telegram, "@") {
		telegram = "@" + strings.TrimPrefix(telegram, "@")
	}

	// Log reveal at most once per validator to avoid spam.
	alreadyLogged, err := s.client.ValidationCaseLog.Query().
		Where(
			validationcaselog.ValidationCaseIDEQ(vc.ID),
			validationcaselog.ActorUserIDEQ(int(validatorUserID)),
			validationcaselog.EventTypeEQ("contact_revealed"),
		).
		Exist(ctx)
	if err == nil && !alreadyLogged {
		actorID := int(validatorUserID)
		s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "contact_revealed", map[string]interface{}{
			"channel":           "telegram",
			"owner_user_id":     vc.UserID,
			"validator_user_id": validatorUserID,
			"telegram":          telegram,
		})
	}

	return telegram, nil
}

func (s *EntValidationCaseWorkflowService) SubmitFinalOffer(ctx context.Context, validationCaseID uint, validatorUserID uint, holdHours int, terms string) (uint, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrValidationCaseNotFound
		}
		return 0, apperrors.ErrDatabase
	}

	if vc.UserID == int(validatorUserID) {
		return 0, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat mengajukan Final Offer pada kasusnya sendiri")
	}
	if normalizeStatus(vc.Status) != caseStatusOpen {
		return 0, apperrors.ErrInvalidInput.WithDetails("Final Offer hanya dapat diajukan saat status kasus open")
	}

	// Require approved consultation to submit an offer.
	approved, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(vc.ID),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusEQ(consultationStatusApproved),
		).
		Exist(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}
	if !approved {
		// Authenticated validator, but not authorized to submit an offer until consultation is approved.
		return 0, apperrors.ErrFinalOfferRequiresApproval
	}

	// Final Offer amount is locked to the posted bounty. Validators do not negotiate amount in-platform.
	amount := vc.BountyAmount
	if amount <= 0 {
		return 0, apperrors.ErrInvalidInput.WithDetails("bounty_amount belum diatur")
	}
	if amount < 10_000 {
		return 0, apperrors.ErrInvalidInput.WithDetails("bounty_amount minimal Rp 10.000")
	}

	// Escrow hold windows are discrete options (mirrors wallet transfer UI):
	// 1 day 8 hours (light), 7 days (standard), 30 days (long).
	if holdHours <= 0 {
		holdHours = 7 * 24
	}
	switch holdHours {
	case 32, 7 * 24, 30 * 24:
		// ok
	default:
		return 0, apperrors.ErrInvalidInput.WithDetails("hold_hours harus 32, 168, atau 720")
	}

	offer, err := s.client.FinalOffer.Create().
		SetValidationCaseID(vc.ID).
		SetValidatorUserID(int(validatorUserID)).
		SetAmount(amount).
		SetHoldHours(holdHours).
		SetTerms(strings.TrimSpace(terms)).
		SetStatus("submitted").
		Save(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "final_offer_submitted", map[string]interface{}{
		"final_offer_id": offer.ID,
		"amount":         amount,
		"hold_hours":     holdHours,
	})

	return uint(offer.ID), nil
}

func (s *EntValidationCaseWorkflowService) ListFinalOffers(ctx context.Context, validationCaseID uint, viewerUserID uint) ([]FinalOfferItem, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	// Owner can list all offers. Validators can list their own offers.
	isOwner := vc.UserID == int(viewerUserID)

	query := s.client.FinalOffer.Query().
		Where(finaloffer.ValidationCaseIDEQ(vc.ID)).
		WithValidatorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Order(ent.Desc(finaloffer.FieldCreatedAt))

	if !isOwner {
		query = query.Where(finaloffer.ValidatorUserIDEQ(int(viewerUserID)))
	}

	offers, err := query.All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	out := make([]FinalOfferItem, 0, len(offers))
	for _, it := range offers {
		validator := buildUserSummaryFromEnt(it.Edges.ValidatorUser)
		out = append(out, FinalOfferItem{
			ID:               uint(it.ID),
			ValidationCaseID: validationCaseID,
			Validator:        validator,
			Amount:           it.Amount,
			HoldHours:        it.HoldHours,
			Terms:            it.Terms,
			Status:           it.Status,
			AcceptedAt:       unixPtr(it.AcceptedAt),
			RejectedAt:       unixPtr(it.RejectedAt),
			CreatedAt:        it.CreatedAt.Unix(),
		})
	}
	return out, nil
}

func (s *EntValidationCaseWorkflowService) AcceptFinalOffer(ctx context.Context, validationCaseID uint, ownerUserID uint, offerID uint) (*EscrowDraft, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}
	if normalizeStatus(vc.Status) != caseStatusOpen {
		return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer hanya dapat diterima saat status kasus open")
	}
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Lock Funds sudah dilakukan untuk kasus ini")
	}
	if vc.DisputeID != nil && strings.TrimSpace(*vc.DisputeID) != "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Kasus sedang dalam Dispute")
	}

	offer, err := s.client.FinalOffer.Query().
		Where(
			finaloffer.IDEQ(int(offerID)),
			finaloffer.ValidationCaseIDEQ(vc.ID),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer tidak ditemukan")
		}
		return nil, apperrors.ErrDatabase
	}

	validator, err := s.client.User.Query().Where(user.IDEQ(offer.ValidatorUserID)).Only(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	if validator.Username == nil || strings.TrimSpace(*validator.Username) == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Validator belum memiliki username. Tidak dapat Lock Funds.")
	}

	// Use transaction to ensure atomicity of offer + case updates
	tx, err := s.client.Tx(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()

	now := time.Now()

	// Mark offer accepted (pending funding confirmation).
	if _, err := tx.FinalOffer.UpdateOneID(offer.ID).
		SetStatus("accepted_pending_funding").
		SetAcceptedAt(now).
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return nil, apperrors.ErrDatabase
	}

	// Remember accepted offer on the case.
	if _, err := tx.ValidationCase.UpdateOneID(vc.ID).
		SetAcceptedFinalOfferID(offer.ID).
		SetStatus("offer_accepted").
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return nil, apperrors.ErrDatabase
	}

	if err := tx.Commit(); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "final_offer_accepted", map[string]interface{}{
		"final_offer_id":    offer.ID,
		"validator_user_id": offer.ValidatorUserID,
		"amount":            offer.Amount,
		"hold_hours":        offer.HoldHours,
		"accepted_at_unix":  now.Unix(),
	})

	return &EscrowDraft{
		ReceiverUsername: strings.TrimSpace(*validator.Username),
		Amount:           offer.Amount,
		HoldHours:        offer.HoldHours,
		Message:          fmt.Sprintf("Lock Funds: Validation Case #%d", vc.ID),
	}, nil
}

type featureServiceError struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Details []string `json:"details"`
}

type featureServiceResponse[T any] struct {
	Success bool                 `json:"success"`
	Data    *T                   `json:"data"`
	Error   *featureServiceError `json:"error"`
	Message string               `json:"message"`
}

type featureTransferDto struct {
	ID         string     `json:"id"`
	SenderID   uint       `json:"senderId"`
	ReceiverID uint       `json:"receiverId"`
	Amount     int64      `json:"amount"`
	Status     string     `json:"status"`
	HoldUntil  *time.Time `json:"holdUntil"`
}

type featureDisputeDto struct {
	ID         string `json:"id"`
	TransferID string `json:"transferId"`
	Status     string `json:"status"`
}

func (s *EntValidationCaseWorkflowService) getFeatureTransfer(ctx context.Context, authHeader string, transferID string) (*featureTransferDto, error) {
	url := fmt.Sprintf("%s/api/v1/wallets/transfers/%s", strings.TrimRight(config.FeatureServiceURL, "/"), transferID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed featureServiceResponse[featureTransferDto]
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK || !parsed.Success || parsed.Data == nil {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return nil, fmt.Errorf("feature-service: %s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("feature-service: unexpected response")
	}
	return parsed.Data, nil
}

func (s *EntValidationCaseWorkflowService) getFeatureDispute(ctx context.Context, authHeader string, disputeID string) (*featureDisputeDto, error) {
	url := fmt.Sprintf("%s/api/v1/disputes/%s", strings.TrimRight(config.FeatureServiceURL, "/"), disputeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed featureServiceResponse[featureDisputeDto]
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK || !parsed.Success || parsed.Data == nil {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return nil, fmt.Errorf("feature-service: %s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("feature-service: unexpected response")
	}
	return parsed.Data, nil
}

func (s *EntValidationCaseWorkflowService) ConfirmLockFunds(ctx context.Context, validationCaseID uint, ownerUserID uint, transferID string, authHeader string) error {
	transferID = strings.TrimSpace(transferID)
	if transferID == "" {
		return apperrors.ErrMissingField.WithDetails("transfer_id")
	}

	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Lock Funds sudah dikonfirmasi untuk kasus ini")
	}
	if vc.AcceptedFinalOfferID == nil || *vc.AcceptedFinalOfferID <= 0 {
		return apperrors.ErrInvalidInput.WithDetails("Final Offer belum diterima")
	}

	offer, err := s.client.FinalOffer.Get(ctx, *vc.AcceptedFinalOfferID)
	if err != nil {
		return apperrors.ErrDatabase
	}

	ft, err := s.getFeatureTransfer(ctx, authHeader, transferID)
	if err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}

	if ft.SenderID != ownerUserID {
		return apperrors.ErrInvalidInput.WithDetails("transfer_id tidak valid (sender tidak sesuai)")
	}
	if ft.ReceiverID != uint(offer.ValidatorUserID) {
		return apperrors.ErrInvalidInput.WithDetails("transfer_id tidak valid (receiver tidak sesuai)")
	}
	if ft.Amount != offer.Amount {
		return apperrors.ErrInvalidInput.WithDetails("transfer_id tidak valid (amount tidak sesuai)")
	}
	if normalizeStatus(ft.Status) != "pending" {
		return apperrors.ErrInvalidInput.WithDetails("transfer harus berstatus pending untuk Lock Funds")
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetEscrowTransferID(transferID).
		SetStatus("funds_locked").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	if _, err := s.client.FinalOffer.UpdateOneID(offer.ID).
		SetStatus("accepted").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "funds_locked", map[string]interface{}{
		"escrow_transfer_id": transferID,
		"final_offer_id":     offer.ID,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) SubmitArtifact(ctx context.Context, validationCaseID uint, validatorUserID uint, documentID string, authHeader string) error {
	documentID = strings.TrimSpace(documentID)
	isManualSubmission := false
	if documentID == "" {
		// Manual artifact mark (no file upload): create a stable internal marker.
		documentID = fmt.Sprintf("artifact-submission-auto-%d-%d-%d", validationCaseID, validatorUserID, time.Now().Unix())
		isManualSubmission = true
	}

	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.AcceptedFinalOfferID == nil || *vc.AcceptedFinalOfferID <= 0 {
		return apperrors.ErrInvalidInput.WithDetails("Final Offer belum diterima")
	}
	if vc.EscrowTransferID == nil || strings.TrimSpace(*vc.EscrowTransferID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("Lock Funds belum dilakukan")
	}
	if vc.ArtifactDocumentID != nil && strings.TrimSpace(*vc.ArtifactDocumentID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Artifact Submission sudah ada")
	}

	offer, err := s.client.FinalOffer.Get(ctx, *vc.AcceptedFinalOfferID)
	if err != nil {
		return apperrors.ErrDatabase
	}
	if uint(offer.ValidatorUserID) != validatorUserID {
		// Authenticated user, but only the accepted validator may upload the artifact.
		return apperrors.ErrArtifactSubmissionAccessDenied
	}

	// Share document only when the submission references a real document in Feature Service.
	if !isManualSubmission {
		if err := s.shareDocumentWithCaseOwner(ctx, authHeader, documentID, uint(vc.UserID)); err != nil {
			return apperrors.ErrInvalidInput.WithDetails(err.Error())
		}
	}

	if _, err := s.client.ArtifactSubmission.Create().
		SetValidationCaseID(vc.ID).
		SetValidatorUserID(int(validatorUserID)).
		SetDocumentID(documentID).
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetArtifactDocumentID(documentID).
		SetStatus("artifact_submitted").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "artifact_submitted", map[string]interface{}{
		"document_id":       documentID,
		"manual_submission": isManualSubmission,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) shareDocumentWithCaseOwner(ctx context.Context, authHeader string, documentID string, ownerUserID uint) error {
	url := fmt.Sprintf("%s/api/v1/documents/%s/sharing", strings.TrimRight(config.FeatureServiceURL, "/"), documentID)
	payload := map[string]interface{}{
		"sharedWithUserIds": []uint{ownerUserID},
	}
	b, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var body map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if msg, ok := body["error"].(string); ok && strings.TrimSpace(msg) != "" {
			return fmt.Errorf("feature-service: %s", msg)
		}
		return fmt.Errorf("feature-service: failed to share document (status %d)", resp.StatusCode)
	}
	return nil
}

func (s *EntValidationCaseWorkflowService) MarkEscrowReleased(ctx context.Context, validationCaseID uint, ownerUserID uint, authHeader string) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID == nil || strings.TrimSpace(*vc.EscrowTransferID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("escrow_transfer_id belum ada")
	}

	ft, err := s.getFeatureTransfer(ctx, authHeader, strings.TrimSpace(*vc.EscrowTransferID))
	if err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}

	if normalizeStatus(ft.Status) != "released" {
		return apperrors.ErrInvalidInput.WithDetails("transfer belum berstatus released")
	}

	// Promote Artifact Submission to Certified Artifact (in this model: same document id).
	certifiedID := vc.ArtifactDocumentID
	if certifiedID == nil || strings.TrimSpace(*certifiedID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("Artifact Submission belum ada")
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetCertifiedArtifactDocumentID(strings.TrimSpace(*certifiedID)).
		SetStatus("completed").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "escrow_released_confirmed", map[string]interface{}{
		"escrow_transfer_id": strings.TrimSpace(*vc.EscrowTransferID),
	})
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "certified_artifact_issued", map[string]interface{}{
		"certified_artifact_document_id": strings.TrimSpace(*certifiedID),
	})

	return nil
}

// MarkEscrowReleasedInternalByTransferID is called by Feature Service (auto-release worker)
// to finalize a Validation Case after escrow funds are released.
//
// This endpoint is protected by internal API key auth and therefore does NOT re-fetch transfer state
// from Feature Service (which would require a user token). Instead, we validate local case invariants.
func (s *EntValidationCaseWorkflowService) MarkEscrowReleasedInternalByTransferID(ctx context.Context, transferID string) (*int, error) {
	transferID = strings.TrimSpace(transferID)
	if transferID == "" {
		return nil, apperrors.ErrMissingField.WithDetails("transfer_id")
	}

	vc, err := s.client.ValidationCase.Query().
		Where(validationcase.EscrowTransferIDEQ(transferID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	// Promote Artifact Submission to Certified Artifact (in this model: same document id).
	artifactID := vc.ArtifactDocumentID
	if artifactID == nil || strings.TrimSpace(*artifactID) == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Artifact Submission belum ada")
	}

	// Idempotent: if already completed and certified artifact set, no-op.
	if normalizeStatus(vc.Status) == "completed" && vc.CertifiedArtifactDocumentID != nil && strings.TrimSpace(*vc.CertifiedArtifactDocumentID) != "" {
		return &vc.ID, nil
	}

	certified := strings.TrimSpace(*artifactID)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetCertifiedArtifactDocumentID(certified).
		SetStatus("completed").
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	// System-generated case log entries (actor_user_id = NULL).
	s.appendCaseLogBestEffort(ctx, vc.ID, nil, "escrow_released_confirmed", map[string]interface{}{
		"escrow_transfer_id": transferID,
		"source":             "feature_service_auto_release",
	})
	s.appendCaseLogBestEffort(ctx, vc.ID, nil, "certified_artifact_issued", map[string]interface{}{
		"certified_artifact_document_id": certified,
		"source":                         "feature_service_auto_release",
	})

	return &vc.ID, nil
}

func (s *EntValidationCaseWorkflowService) AttachDispute(ctx context.Context, validationCaseID uint, ownerUserID uint, disputeID string, authHeader string) error {
	disputeID = strings.TrimSpace(disputeID)
	if disputeID == "" {
		return apperrors.ErrMissingField.WithDetails("dispute_id")
	}

	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID == nil || strings.TrimSpace(*vc.EscrowTransferID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("escrow_transfer_id belum ada")
	}
	if vc.DisputeID != nil && strings.TrimSpace(*vc.DisputeID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Dispute sudah terpasang pada kasus ini")
	}

	fd, err := s.getFeatureDispute(ctx, authHeader, disputeID)
	if err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}
	if strings.TrimSpace(fd.TransferID) != strings.TrimSpace(*vc.EscrowTransferID) {
		return apperrors.ErrInvalidInput.WithDetails("dispute_id tidak sesuai dengan escrow_transfer_id kasus ini")
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetDisputeID(disputeID).
		SetStatus("disputed").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "dispute_attached", map[string]interface{}{
		"dispute_id":     disputeID,
		"transfer_id":    strings.TrimSpace(*vc.EscrowTransferID),
		"dispute_status": fd.Status,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) GetCaseLog(ctx context.Context, validationCaseID uint, viewerUserID uint) ([]CaseLogItem, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	isOwner := vc.UserID == int(viewerUserID)
	if !isOwner {
		approved, err := s.client.ConsultationRequest.Query().
			Where(
				consultationrequest.ValidationCaseIDEQ(vc.ID),
				consultationrequest.ValidatorUserIDEQ(int(viewerUserID)),
				consultationrequest.StatusIn(
					consultationStatusApproved,
					consultationStatusWaitingOwnerResponse,
					consultationStatusOwnerTimeout,
				),
			).
			Exist(ctx)
		if err != nil {
			return nil, apperrors.ErrDatabase
		}
		if !approved {
			// Authenticated viewer, but Case Log is restricted to owner or approved validators.
			return nil, apperrors.ErrCaseLogAccessDenied
		}
	}

	logs, err := s.client.ValidationCaseLog.Query().
		Where(validationcaselog.ValidationCaseIDEQ(vc.ID)).
		WithActorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Order(ent.Asc(validationcaselog.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	out := make([]CaseLogItem, 0, len(logs))
	for _, it := range logs {
		var actor *UserSummary
		if it.Edges.ActorUser != nil {
			u := buildUserSummaryFromEnt(it.Edges.ActorUser)
			actor = &u
		}
		detail := it.DetailJSON
		if detail == nil {
			detail = map[string]interface{}{}
		}
		out = append(out, CaseLogItem{
			ID:               uint(it.ID),
			ValidationCaseID: validationCaseID,
			Actor:            actor,
			EventType:        it.EventType,
			Detail:           detail,
			CreatedAt:        it.CreatedAt.Unix(),
		})
	}
	return out, nil
}
