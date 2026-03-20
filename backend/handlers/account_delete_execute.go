package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/utils"
	"backend-gin/ent/artifactsubmission"
	"backend-gin/ent/backupcode"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/devicefingerprint"
	"backend-gin/ent/deviceusermapping"
	"backend-gin/ent/emailverificationtoken"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/passkey"
	"backend-gin/ent/passwordresettoken"
	"backend-gin/ent/securityevent"
	"backend-gin/ent/session"
	"backend-gin/ent/sessionlock"
	"backend-gin/ent/sudosession"
	"backend-gin/ent/totppendingtoken"
	"backend-gin/ent/userbadge"
	"backend-gin/ent/validationcase"
	"backend-gin/ent/validationcaselog"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func callFeatureServiceCleanup(c *gin.Context, userID uint) (*FeatureServiceCleanupResult, error) {
	url := fmt.Sprintf("%s/api/v1/user/%d/cleanup", config.FeatureServiceURL, userID)

	req, err := http.NewRequestWithContext(c.Request.Context(), "DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	// Forward the JWT token for authentication
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := utils.LongHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, fmt.Errorf("failed reading feature-service cleanup response: %w", readErr)
	}

	var result FeatureServiceCleanupResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		if result.BlockingReason != "" {
			return &result, fmt.Errorf("%s", result.BlockingReason)
		}
		return nil, fmt.Errorf("feature-service cleanup failed")
	}

	return &result, nil
}

// DeleteAccountHandler godoc
// @Summary      Delete account
// @Description  Permanently delete the authenticated user's account. Requires active sudo session (identity re-verification). Validates wallet balance and pending transactions before proceeding.
// @Tags         Account
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      SwaggerDeleteAccountRequest  true  "Confirmation (must be 'DELETE')"
// @Success      200   {object}  handlers.SwaggerMessageResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse  "Validation failed or confirmation incorrect"
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      403   {object}  handlers.SwaggerErrorResponse  "Sudo session required"
// @Failure      500   {object}  handlers.SwaggerErrorResponse
// @Failure      503   {object}  handlers.SwaggerErrorResponse  "Wallet verification service unavailable"
// @Router       /account [delete]
// DELETE /api/account
func DeleteAccountHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req DeleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Konfirmasi diperlukan"})
		return
	}

	// Validate confirmation text
	if req.Confirmation != "DELETE" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ketik DELETE untuk mengkonfirmasi penghapusan akun"})
		return
	}

	ctx := c.Request.Context()

	// Step 1: Validate with Feature-Service (check wallet balance, pending transfers, disputes)
	// STRICT MODE: Feature-Service MUST be available and validation MUST pass
	validation, err := callFeatureServiceValidation(c, uint(user.ID))
	if err != nil {
		// Feature-Service unavailable - BLOCK deletion for financial safety
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":               "Layanan verifikasi wallet tidak tersedia. Tidak dapat memproses penghapusan akun.",
			"service_unavailable": true,
		})
		return
	}

	if validation != nil && !validation.CanDelete {
		// Validation failed - user has blocking conditions
		c.JSON(http.StatusBadRequest, gin.H{
			"error":               "Tidak dapat menghapus akun",
			"blocking_reasons":    validation.BlockingReasons,
			"wallet_balance":      validation.WalletBalance,
			"pending_transfers":   validation.PendingTransfers,
			"disputed_transfers":  validation.DisputedTransfers,
			"pending_withdrawals": validation.PendingWithdrawals,
		})
		return
	}

	// Step 2: Call Feature-Service cleanup (hard delete MongoDB data)
	_, cleanupErr := callFeatureServiceCleanup(c, uint(user.ID))
	if cleanupErr != nil {
		// Check if it's a blocking error (wallet balance, pending transfer discovered during cleanup)
		if strings.Contains(cleanupErr.Error(), "saldo") ||
			strings.Contains(cleanupErr.Error(), "transfer") ||
			strings.Contains(cleanupErr.Error(), "dispute") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Akun tidak dapat dihapus karena masih ada saldo, transfer, atau dispute aktif."})
			return
		}
		// For other errors (network, etc.), log but continue with PostgreSQL deletion
		// Data in MongoDB becomes orphan but user can still delete account
	}

	// Step 3: Delete from PostgreSQL
	dbClient := database.GetEntClient()

	// Use Ent transaction for cascading delete
	tx, err := dbClient.Tx(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses penghapusan"})
		return
	}

	rollbackWithLog := func() {
		if rbErr := tx.Rollback(); rbErr != nil {
			logger.Warn(
				"rollback failed while deleting account",
				zap.Int("user_id", user.ID),
				zap.Error(rbErr),
			)
		}
	}

	ownerUserID := int(user.ID)

	// 1. Delete Validation Case child tables for cases owned by this user (FK safety)
	if _, err := tx.ValidationCaseLog.Delete().
		Where(validationcaselog.HasValidationCaseWith(validationcase.UserIDEQ(ownerUserID))).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Case Log"})
		return
	}
	if _, err := tx.ConsultationRequest.Delete().
		Where(consultationrequest.HasValidationCaseWith(validationcase.UserIDEQ(ownerUserID))).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Consultation Request"})
		return
	}
	if _, err := tx.FinalOffer.Delete().
		Where(finaloffer.HasValidationCaseWith(validationcase.UserIDEQ(ownerUserID))).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Final Offer"})
		return
	}
	if _, err := tx.ArtifactSubmission.Delete().
		Where(artifactsubmission.HasValidationCaseWith(validationcase.UserIDEQ(ownerUserID))).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Artifact Submission"})
		return
	}

	// 2. Delete all user's Validation Cases (domain replacement for legacy threads)
	if _, err := tx.ValidationCase.Delete().Where(validationcase.UserIDEQ(ownerUserID)).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Validation Case"})
		return
	}

	// 3. Delete Validation Case activity by this user on other cases (validator/actor roles)
	if _, err := tx.ConsultationRequest.Delete().
		Where(consultationrequest.ValidatorUserIDEQ(ownerUserID)).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Consultation Request user"})
		return
	}
	if _, err := tx.FinalOffer.Delete().
		Where(finaloffer.ValidatorUserIDEQ(ownerUserID)).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Final Offer user"})
		return
	}
	if _, err := tx.ArtifactSubmission.Delete().
		Where(artifactsubmission.ValidatorUserIDEQ(ownerUserID)).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Artifact Submission user"})
		return
	}
	if _, err := tx.ValidationCaseLog.Delete().
		Where(validationcaselog.ActorUserIDEQ(ownerUserID)).
		Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Case Log user"})
		return
	}

	// 4. Delete all sessions
	if _, err := tx.Session.Delete().Where(session.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi"})
		return
	}

	// 5. Delete sudo sessions
	if _, err := tx.SudoSession.Delete().Where(sudosession.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi sudo"})
		return
	}

	// 6. Delete session locks
	if _, err := tx.SessionLock.Delete().Where(sessionlock.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus session locks"})
		return
	}

	// 7. Delete backup codes
	if _, err := tx.BackupCode.Delete().Where(backupcode.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus backup codes"})
		return
	}

	// 8. Delete passkeys
	if _, err := tx.Passkey.Delete().Where(passkey.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus passkeys"})
		return
	}

	// 9. Delete user badges
	if _, err := tx.UserBadge.Delete().Where(userbadge.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus badge"})
		return
	}

	// 11. Delete security events
	if _, err := tx.SecurityEvent.Delete().Where(securityevent.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus security events"})
		return
	}

	// 12. Delete TOTP pending tokens
	if _, err := tx.TOTPPendingToken.Delete().Where(totppendingtoken.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus TOTP tokens"})
		return
	}

	// 13. Delete email verification tokens
	if _, err := tx.EmailVerificationToken.Delete().Where(emailverificationtoken.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus email tokens"})
		return
	}

	// 14. Delete password reset tokens
	if _, err := tx.PasswordResetToken.Delete().Where(passwordresettoken.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus password tokens"})
		return
	}

	// 15. Delete device fingerprints
	if _, err := tx.DeviceFingerprint.Delete().Where(devicefingerprint.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus device fingerprints"})
		return
	}

	// 16. Delete device user mappings
	if _, err := tx.DeviceUserMapping.Delete().Where(deviceusermapping.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus device mappings"})
		return
	}

	// 17. Clear primary badge reference (set to NULL to avoid FK issues)
	if _, err := tx.User.UpdateOneID(int(user.ID)).ClearPrimaryBadgeID().Save(ctx); err != nil {
		// Ignore error - user might not have primary badge
	}

	// 18. Delete user (finally)
	if err := tx.User.DeleteOneID(int(user.ID)).Exec(ctx); err != nil {
		rollbackWithLog()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus akun"})
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan penghapusan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Akun berhasil dihapus"})
}
