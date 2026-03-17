package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/category"
	"backend-gin/ent/tag"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/validators"

	"go.uber.org/zap"
)

func (s *EntValidationCaseService) CreateValidationCase(ctx context.Context, ownerUserID uint, input validators.CreateValidationCaseInput, authHeader string) (*ValidationCaseDetailResponse, error) {
	if err := input.Validate(); err != nil {
		logger.Error("ValidationCase validation failed", zap.Uint("user_id", ownerUserID), zap.Error(err))
		return nil, err
	}

	owner, err := s.client.User.Get(ctx, int(ownerUserID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if owner.TelegramAuthUserID == nil || *owner.TelegramAuthUserID <= 0 || owner.TelegramAuthVerifiedAt == nil {
		return nil, apperrors.ErrTelegramVerificationRequired.WithDetails("Sambungkan akun Telegram terverifikasi di Account Settings sebelum membuat Validation Case")
	}

	cat, err := s.client.Category.
		Query().
		Where(category.SlugEQ(input.CategorySlug)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrCategoryNotFound.WithDetails(input.CategorySlug)
		}
		logger.Error("Failed to get category", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	metaJSON, err := validators.NormalizeMeta(input.Meta)
	if err != nil {
		logger.Error("Failed to normalize meta", zap.Uint("user_id", ownerUserID), zap.Error(err))
		return nil, err
	}
	var metaMap map[string]interface{}
	if err := json.Unmarshal(metaJSON, &metaMap); err != nil {
		metaMap = make(map[string]interface{})
	}
	delete(metaMap, "protocol_mode")
	delete(metaMap, "workflow_mode")
	delete(metaMap, "workflow_version")

	var tags []*ent.Tag
	if len(input.TagSlugs) > 0 {
		tags, err = s.resolveActiveTagsBySlug(ctx, input.TagSlugs)
		if err != nil {
			return nil, err
		}
	}

	structuredIntake := input.StructuredIntake
	if structuredIntake == nil {
		structuredIntake, err = validators.ParseStructuredIntakeContent(input.Content)
		if err != nil {
			return nil, err
		}
	}
	contentMap := validators.BuildCanonicalStructuredContent(structuredIntake)
	autoSummary := validators.BuildAutoSummary(structuredIntake)

	workspaceState := defaultRepoMetaState()
	workspaceState.WorkflowFamily = workspaceWorkflowFamily
	workspaceState.CompletionMode = normalizeRepoCompletionMode(workspaceState.CompletionMode)
	workspaceState.ConsensusStatus = normalizeRepoConsensusStatus(workspaceState.ConsensusStatus)
	workspaceState.RepoStage = repoStageReady
	workspaceState.BountyReserveStatus = repoBountyReserveStatusNone
	workspaceState.BountyReserveOrderID = ""
	if len(input.WorkspaceBootstrapFiles) > 0 {
		createdAt := time.Now().Unix()
		seed := time.Now().UnixNano()
		workspaceFiles := make([]RepoCaseFileItem, 0, len(input.WorkspaceBootstrapFiles))
		for idx, file := range input.WorkspaceBootstrapFiles {
			kind := normalizeRepoFileKind(file.Kind)
			if kind == "" {
				continue
			}
			visibility := normalizeRepoFileVisibility(file.Visibility)
			if kind == repoFileKindSensitive {
				visibility = repoFileVisibilityAssignedValidators
			}
			workspaceFiles = append(workspaceFiles, RepoCaseFileItem{
				ID:         fmt.Sprintf("wcf_%d_%d_%d", seed, ownerUserID, idx+1),
				DocumentID: strings.TrimSpace(file.DocumentID),
				Kind:       kind,
				Label:      strings.TrimSpace(file.Label),
				Visibility: visibility,
				UploadedBy: ownerUserID,
				UploadedAt: createdAt,
			})
		}
		workspaceState.RepoFiles = workspaceFiles
	}
	metaMap = mergeRepoMeta(metaMap, workspaceState)

	create := s.client.ValidationCase.
		Create().
		SetCategoryID(cat.ID).
		SetUserID(int(ownerUserID)).
		SetTitle(input.Title).
		SetSummary(autoSummary).
		SetContentType("json").
		SetContentJSON(contentMap).
		SetMeta(sanitizeCaseMeta(metaMap)).
		SetBountyAmount(input.BountyAmount).
		SetSensitivityLevel(structuredIntake.SensitivityLevel).
		SetIntakeSchemaVersion(validators.IntakeSchemaVersion).
		SetClarificationState("none").
		SetOwnerInactivityCount(0).
		SetStatus("open")

	if len(tags) > 0 {
		create.AddTags(tags...)
	}

	vc, err := create.Save(ctx)
	if err != nil {
		logger.Error("Failed to create validation case", zap.Uint("user_id", ownerUserID), zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal membuat Validation Case")
	}

	authHeader = strings.TrimSpace(authHeader)
	if authHeader == "" {
		_ = s.DeleteValidationCase(ctx, ownerUserID, uint(vc.ID))
		return nil, apperrors.ErrInvalidInput.WithDetails("Authorization header tidak ditemukan. Silakan login ulang.")
	}

	reserveOrderID := fmt.Sprintf("validation-case:%d:bounty", vc.ID)
	walletClient := NewFeatureWalletClientFromConfig()
	if _, reserveErr := walletClient.ReserveMarketPurchase(
		ctx,
		authHeader,
		reserveOrderID,
		input.BountyAmount,
	); reserveErr != nil {
		_ = s.DeleteValidationCase(ctx, ownerUserID, uint(vc.ID))
		logger.Warn("bounty reserve failed",
			zap.Uint("owner_user_id", ownerUserID),
			zap.Error(reserveErr))
		return nil, apperrors.ErrInvalidInput.WithDetails(
			"Saldo wallet tidak cukup atau reserve bounty gagal. Silakan coba lagi.",
		)
	}

	workspaceState.BountyReserveOrderID = reserveOrderID
	workspaceState.BountyReserveStatus = repoBountyReserveStatusReserved
	metaWithReserve := mergeRepoMeta(vc.Meta, workspaceState)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(metaWithReserve).Save(ctx); err != nil {
		logger.Error("Failed to persist validation case reserve metadata",
			zap.Int("validation_case_id", vc.ID),
			zap.Error(err),
		)
		_ = s.DeleteValidationCase(ctx, ownerUserID, uint(vc.ID))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal menyimpan metadata reserve bounty")
	}

	// Append Case Log entries (best effort).
	_, _ = s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(vc.ID).
		SetActorUserID(int(ownerUserID)).
		SetEventType("validation_case_created").
		SetDetailJSON(map[string]interface{}{
			"bounty_amount":         input.BountyAmount,
			"sensitivity_level":     structuredIntake.SensitivityLevel,
			"intake_schema_version": validators.IntakeSchemaVersion,
			"repo_stage":            workspaceState.RepoStage,
		}).
		Save(ctx)
	_, _ = s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(vc.ID).
		SetActorUserID(int(ownerUserID)).
		SetEventType("repo_bounty_reserved").
		SetDetailJSON(map[string]interface{}{
			"reserve_order_id": reserveOrderID,
			"bounty_amount":    input.BountyAmount,
		}).
		Save(ctx)

	vc, err = s.client.ValidationCase.
		Query().
		Where(validationcase.IDEQ(vc.ID)).
		WithUser(func(q *ent.UserQuery) { q.WithPrimaryBadge() }).
		WithCategory().
		WithTags(func(q *ent.TagQuery) { q.Where(tag.IsActiveEQ(true)) }).
		Only(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	return s.validationCaseToDetailResponse(vc, nil), nil
}
