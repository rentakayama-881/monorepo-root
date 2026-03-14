package services

import (
	"context"
	"strings"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/validationcaselog"
	apperrors "backend-gin/errors"
)

func (s *EntValidationCaseWorkflowService) RevealOwnerTelegramContact(ctx context.Context, validationCaseID uint, validatorUserID uint) (string, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return "", apperrors.ErrValidationCaseNotFound
		}
		return "", apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return "", err
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
			consultationrequest.WorkflowCycleEQ(currentWorkflowCycle(vc)),
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

	var telegram string
	if owner.TelegramAuthUserID != nil && *owner.TelegramAuthUserID > 0 && owner.TelegramAuthVerifiedAt != nil {
		normalizedUsername := NormalizeTelegramUsername(owner.TelegramAuthUsername)
		if normalizedUsername != "" {
			telegram = "@" + normalizedUsername
		} else {
			telegram = BuildTelegramDeepLink("", owner.TelegramAuthUserID)
		}
	} else {
		// Backward compatibility for historical cases created before Telegram verification rollout.
		legacyTelegram := strings.TrimSpace(owner.Telegram)
		if legacyTelegram != "" {
			if strings.HasPrefix(legacyTelegram, "tg://") || strings.HasPrefix(legacyTelegram, "http://") || strings.HasPrefix(legacyTelegram, "https://") {
				telegram = legacyTelegram
			} else if strings.HasPrefix(legacyTelegram, "@") {
				telegram = legacyTelegram
			} else {
				telegram = "@" + strings.TrimPrefix(legacyTelegram, "@")
			}
		}
	}
	if strings.TrimSpace(telegram) == "" {
		return "", apperrors.ErrInvalidInput.WithDetails("Pemilik kasus belum menghubungkan Telegram terverifikasi")
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
