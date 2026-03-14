package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/artifactsubmission"
	"backend-gin/ent/category"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/tag"
	"backend-gin/ent/validationcase"
	"backend-gin/ent/validationcaselog"
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
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf("Saldo wallet tidak cukup atau reserve bounty gagal: %s", reserveErr.Error()),
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

func (s *EntValidationCaseService) UpdateValidationCase(ctx context.Context, ownerUserID uint, input validators.UpdateValidationCaseInput) error {
	if err := input.Validate(); err != nil {
		return err
	}

	vc, err := s.client.ValidationCase.
		Query().
		Where(validationcase.IDEQ(int(input.ValidationCaseID))).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}

	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}

	update := s.client.ValidationCase.UpdateOneID(int(input.ValidationCaseID))

	if input.Title != nil {
		update.SetTitle(*input.Title)
	}
	if input.Summary != nil {
		update.SetSummary(*input.Summary)
	}
	if input.ContentType != nil && input.Content == nil {
		update.SetContentType(*input.ContentType)
	}
	if input.Content != nil {
		structuredIntake := input.StructuredIntake
		if structuredIntake == nil {
			structuredIntake, err = validators.ParseStructuredIntakeContent(input.Content)
			if err != nil {
				return err
			}
		}
		update.SetContentType("json")
		update.SetContentJSON(validators.BuildCanonicalStructuredContent(structuredIntake))
		update.SetSummary(validators.BuildAutoSummary(structuredIntake))
		update.SetSensitivityLevel(structuredIntake.SensitivityLevel)
		update.SetIntakeSchemaVersion(validators.IntakeSchemaVersion)
	}
	if input.Meta != nil {
		metaJSON, err := validators.NormalizeMeta(input.Meta)
		if err != nil {
			return err
		}
		var metaMap map[string]interface{}
		if err := json.Unmarshal(metaJSON, &metaMap); err != nil {
			metaMap = make(map[string]interface{})
		}
		update.SetMeta(sanitizeCaseMeta(metaMap))
	}
	if input.BountyAmount != nil {
		if isWorkspaceCaseMeta(vc.Meta) {
			return apperrors.ErrInvalidInput.WithDetails("bounty_amount tidak dapat diubah untuk Evidence Validation Workspace")
		}

		// Conservative: allow bounty edits only while still open.
		if strings.ToLower(strings.TrimSpace(vc.Status)) != "open" {
			return apperrors.ErrInvalidInput.WithDetails("bounty_amount hanya bisa diubah saat status masih 'open'")
		}
		update.SetBountyAmount(*input.BountyAmount)
	}

	if input.TagSlugs != nil {
		tags, err := s.resolveActiveTagsBySlug(ctx, *input.TagSlugs)
		if err != nil {
			return err
		}
		update.ClearTags()
		if len(tags) > 0 {
			update.AddTags(tags...)
		}
	}

	if _, err := update.Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	// Append Case Log entry (best effort).
	_, _ = s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(int(input.ValidationCaseID)).
		SetActorUserID(int(ownerUserID)).
		SetEventType("validation_case_updated").
		SetDetailJSON(map[string]interface{}{}).
		Save(ctx)

	return nil
}

func (s *EntValidationCaseService) DeleteValidationCase(ctx context.Context, ownerUserID uint, validationCaseID uint) error {
	tx, err := s.client.Tx(ctx)
	if err != nil {
		logger.Error("Failed to start delete validation case transaction",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menyiapkan proses hapus Validation Case")
	}
	defer func() { _ = tx.Rollback() }()

	vc, err := tx.ValidationCase.
		Query().
		Where(validationcase.IDEQ(int(validationCaseID))).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}

	// Conservative delete: refuse if escrow already linked.
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Validation Case tidak dapat dihapus setelah Lock Funds dilakukan")
	}
	if vc.DisputeID != nil && strings.TrimSpace(*vc.DisputeID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Validation Case tidak dapat dihapus setelah dispute dibuat")
	}
	if vc.ArtifactDocumentID != nil && strings.TrimSpace(*vc.ArtifactDocumentID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Validation Case tidak dapat dihapus setelah artifact submission tercatat")
	}
	if vc.CertifiedArtifactDocumentID != nil && strings.TrimSpace(*vc.CertifiedArtifactDocumentID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Validation Case tidak dapat dihapus setelah certified artifact diterbitkan")
	}
	if vc.AcceptedFinalOfferID != nil {
		return apperrors.ErrInvalidInput.WithDetails("Validation Case tidak dapat dihapus setelah Final Offer diterima")
	}

	// FK strategy in current schema uses NO ACTION for most child rows.
	// Delete children first, then parent case.
	// Clear M2M tags explicitly for compatibility with legacy deployments where
	// join-table FK behavior may not be fully aligned with current migrations.
	if err := tx.ValidationCase.UpdateOneID(int(validationCaseID)).
		ClearTags().
		Exec(ctx); err != nil {
		logger.Error("Failed to clear validation case tags",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus relasi Tag")
	}
	if _, err := tx.ValidationCaseLog.Delete().
		Where(validationcaselog.ValidationCaseIDEQ(int(validationCaseID))).
		Exec(ctx); err != nil {
		logger.Error("Failed to delete validation case logs",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus Case Log")
	}
	if _, err := tx.ConsultationRequest.Delete().
		Where(consultationrequest.ValidationCaseIDEQ(int(validationCaseID))).
		Exec(ctx); err != nil {
		logger.Error("Failed to delete consultation requests",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus Consultation Request")
	}
	if _, err := tx.FinalOffer.Delete().
		Where(finaloffer.ValidationCaseIDEQ(int(validationCaseID))).
		Exec(ctx); err != nil {
		logger.Error("Failed to delete final offers",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus Final Offer")
	}
	if _, err := tx.ArtifactSubmission.Delete().
		Where(artifactsubmission.ValidationCaseIDEQ(int(validationCaseID))).
		Exec(ctx); err != nil {
		logger.Error("Failed to delete artifact submissions",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus Artifact Submission")
	}

	if err := tx.ValidationCase.DeleteOneID(int(validationCaseID)).Exec(ctx); err != nil {
		logger.Error("Failed to delete validation case parent row",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus Validation Case")
	}
	if err := tx.Commit(); err != nil {
		logger.Error("Failed to commit validation case delete transaction",
			zap.Uint("validation_case_id", validationCaseID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("Gagal menyelesaikan proses hapus Validation Case")
	}
	return nil
}
