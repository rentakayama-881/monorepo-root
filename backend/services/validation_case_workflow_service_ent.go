package services

import (
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	apperrors "backend-gin/errors"
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
	caseStatusDisputed             = "disputed"
	caseStatusCompleted            = "completed"
	caseStatusOfferAccepted        = "offer_accepted"
	caseStatusFundsLocked          = "funds_locked"
	caseStatusArtifactSubmitted    = "artifact_submitted"
	caseStatusWaitingOwnerResponse = "waiting_owner_response"
	caseStatusOnHoldOwnerInactive  = "on_hold_owner_inactive"

	disputeSettlementOutcomeOwnerRefund      = "owner_refund"
	disputeSettlementOutcomeValidatorRelease = "validator_release"

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

	ownerResponseSLAHours   = 12
	ownerReminderFirstHour  = 2
	ownerReminderSecondHour = 8

	consultationStakeMinS1 int64 = 100_000
	consultationStakeMinS2 int64 = 500_000
)

// minCredibilityStakeIDR returns baseline stake used for reputation scoring/fallback checks.
//
// Evidence basis:
// Feature Service enforces a minimum guarantee lock of Rp 100.000 for `GuaranteeService.SetGuaranteeAsync`.
// We mirror that as baseline value in Go backend (configurable via env).
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

func currentWorkflowCycle(vc *ent.ValidationCase) int {
	if vc == nil || vc.WorkflowCycle < 1 {
		return 1
	}
	return vc.WorkflowCycle
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

func ensureWorkflowV1Case(vc *ent.ValidationCase) error {
	if vc == nil {
		return apperrors.ErrValidationCaseNotFound
	}
	if isWorkspaceCaseMeta(vc.Meta) {
		return apperrors.ErrInvalidInput.WithDetails("case ini menggunakan Evidence Validation Workspace. Gunakan endpoint workspace.")
	}
	return nil
}
