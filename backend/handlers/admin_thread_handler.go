package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/category"
	"backend-gin/ent/thread"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminMoveThreadRequest struct {
	NewOwnerUserID uint  `json:"new_owner_user_id" binding:"required"`
	NewCategoryID  *uint `json:"new_category_id"`
	Reason         string `json:"reason" binding:"required"`
	DryRun         bool   `json:"dry_run"`
}

type AdminCategoryItem struct {
	ID          uint   `json:"id"`
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AdminMoveThreadUserSnapshot struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
}

type AdminMoveThreadResponse struct {
	ThreadID uint `json:"thread_id"`

	OldOwner AdminMoveThreadUserSnapshot `json:"old_owner"`
	NewOwner AdminMoveThreadUserSnapshot `json:"new_owner"`

	OldCategory AdminCategoryItem `json:"old_category"`
	NewCategory AdminCategoryItem `json:"new_category"`

	ChangedOwner    bool   `json:"changed_owner"`
	ChangedCategory bool   `json:"changed_category"`
	DryRun          bool   `json:"dry_run"`
	RequestID       string `json:"request_id"`
}

func generateRequestID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "req_" + strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return "req_" + hex.EncodeToString(buf)
}

// AdminListCategories handles GET /admin/categories (admin auth required)
func AdminListCategories(c *gin.Context) {
	ctx := c.Request.Context()

	cats, err := database.GetEntClient().Category.
		Query().
		Order(ent.Asc(category.FieldName)).
		All(ctx)
	if err != nil {
		logger.Error("Failed to list categories (admin)", zap.Error(err))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
		return
	}

	out := make([]AdminCategoryItem, 0, len(cats))
	for _, cat := range cats {
		out = append(out, AdminCategoryItem{
			ID:          uint(cat.ID),
			Slug:        cat.Slug,
			Name:        cat.Name,
			Description: cat.Description,
		})
	}

	c.JSON(http.StatusOK, gin.H{"categories": out})
}

// AdminMoveThread handles POST /admin/threads/:id/move (admin auth required)
//
// Body:
// {
//   "new_owner_user_id": 123,
//   "new_category_id": 456, // optional
//   "reason": "....",
//   "dry_run": true // optional
// }
func AdminMoveThread(c *gin.Context) {
	// AdminAuthMiddleware populates these values in gin context
	adminIDIfc, ok := c.Get("admin_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return
	}
	adminID := adminIDIfc.(uint)
	adminEmail, _ := c.Get("admin_email")
	adminEmailStr, _ := adminEmail.(string)

	// Thread ID from URL
	threadIDStr := c.Param("id")
	threadID64, err := strconv.ParseUint(threadIDStr, 10, 32)
	if err != nil || threadID64 == 0 {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrInvalidInput.WithDetails("thread_id harus berupa angka")))
		return
	}
	threadID := int(threadID64)

	// Request body
	var req AdminMoveThreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrInvalidRequestBody.WithDetails(err.Error())))
		return
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrMissingField.WithDetails("reason")))
		return
	}
	if len(reason) < 5 {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrInvalidInput.WithDetails("reason minimal 5 karakter")))
		return
	}

	// Treat "0" as omitted
	if req.NewCategoryID != nil && *req.NewCategoryID == 0 {
		req.NewCategoryID = nil
	}

	requestID := strings.TrimSpace(c.GetHeader("X-Request-Id"))
	if requestID == "" {
		requestID = generateRequestID()
	}

	ctx := c.Request.Context()
	tx, err := database.GetEntClient().Tx(ctx)
	if err != nil {
		logger.Error("Failed to start transaction (admin move thread)", zap.Error(err))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
		return
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	// Load current thread
	th, err := tx.Thread.Query().
		Where(thread.IDEQ(threadID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, apperrors.ErrorResponse(apperrors.ErrThreadNotFound))
			return
		}
		logger.Error("Failed to load thread (admin move thread)", zap.Error(err), zap.Int("thread_id", threadID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase))
		return
	}

	oldOwnerID := uint(th.UserID)
	oldCategoryID := uint(th.CategoryID)

	// Resolve old owner + category snapshots for response
	oldOwnerEnt, err := tx.User.Query().Where(user.IDEQ(int(oldOwnerID))).Only(ctx)
	if err != nil {
		logger.Error("Failed to load old owner user (admin move thread)", zap.Error(err), zap.Uint("user_id", oldOwnerID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase))
		return
	}

	oldCategoryEnt, err := tx.Category.Query().Where(category.IDEQ(int(oldCategoryID))).Only(ctx)
	if err != nil {
		logger.Error("Failed to load old category (admin move thread)", zap.Error(err), zap.Uint("category_id", oldCategoryID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase))
		return
	}

	// Validate new owner exists + is eligible
	newOwnerEnt, err := tx.User.Query().Where(user.IDEQ(int(req.NewOwnerUserID))).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, apperrors.ErrorResponse(apperrors.ErrUserNotFound))
			return
		}
		logger.Error("Failed to load new owner user (admin move thread)", zap.Error(err), zap.Uint("user_id", req.NewOwnerUserID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase))
		return
	}

	now := time.Now()
	if newOwnerEnt.LockedUntil != nil && newOwnerEnt.LockedUntil.After(now) {
		appErr := apperrors.NewAppError("USER004", "User tujuan sedang terkunci", http.StatusConflict).
			WithDetails("locked_until: " + newOwnerEnt.LockedUntil.Format(time.RFC3339))
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	// Resolve new category (optional)
	newCategoryEnt := oldCategoryEnt
	if req.NewCategoryID != nil {
		cat, err := tx.Category.Query().Where(category.IDEQ(int(*req.NewCategoryID))).Only(ctx)
		if err != nil {
			if ent.IsNotFound(err) {
				c.JSON(http.StatusNotFound, apperrors.ErrorResponse(apperrors.ErrCategoryNotFound))
				return
			}
			logger.Error("Failed to load new category (admin move thread)", zap.Error(err), zap.Uint("category_id", *req.NewCategoryID))
			c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase))
			return
		}
		newCategoryEnt = cat
	}

	changedOwner := oldOwnerID != req.NewOwnerUserID
	changedCategory := uint(oldCategoryEnt.ID) != uint(newCategoryEnt.ID)
	if !changedOwner && !changedCategory {
		appErr := apperrors.NewAppError("THREAD005", "Tidak ada perubahan pada thread", http.StatusConflict)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	// Dry-run: validate only, no DB writes
	if req.DryRun {
		// We intentionally rollback below by returning without setting committed=true.
		c.JSON(http.StatusOK, gin.H{
			"message": "Dry-run OK. Tidak ada perubahan yang disimpan.",
			"data": AdminMoveThreadResponse{
				ThreadID: uint(th.ID),
				OldOwner: AdminMoveThreadUserSnapshot{
					ID:       uint(oldOwnerEnt.ID),
					Username: safeUsername(oldOwnerEnt),
				},
				NewOwner: AdminMoveThreadUserSnapshot{
					ID:       uint(newOwnerEnt.ID),
					Username: safeUsername(newOwnerEnt),
				},
				OldCategory: AdminCategoryItem{
					ID:          uint(oldCategoryEnt.ID),
					Slug:        oldCategoryEnt.Slug,
					Name:        oldCategoryEnt.Name,
					Description: oldCategoryEnt.Description,
				},
				NewCategory: AdminCategoryItem{
					ID:          uint(newCategoryEnt.ID),
					Slug:        newCategoryEnt.Slug,
					Name:        newCategoryEnt.Name,
					Description: newCategoryEnt.Description,
				},
				ChangedOwner:    changedOwner,
				ChangedCategory: changedCategory,
				DryRun:          true,
				RequestID:       requestID,
			},
		})
		return
	}

	// Apply update + audit log in one transaction
	upd := tx.Thread.UpdateOneID(threadID)
	if changedOwner {
		upd.SetUserID(int(req.NewOwnerUserID))
	}
	if changedCategory {
		upd.SetCategoryID(newCategoryEnt.ID)
	}

	if _, err := upd.Save(ctx); err != nil {
		logger.Error("Failed to update thread (admin move thread)", zap.Error(err), zap.Int("thread_id", threadID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase.WithDetails("Gagal memindahkan thread")))
		return
	}

	details := map[string]interface{}{
		"actor_admin_id":      adminID,
		"actor_admin_email":   adminEmailStr,
		"thread_id":           uint(th.ID),
		"old_owner_user_id":   oldOwnerID,
		"new_owner_user_id":   req.NewOwnerUserID,
		"old_category_id":     uint(oldCategoryEnt.ID),
		"new_category_id":     uint(newCategoryEnt.ID),
		"reason":              reason,
		"request_id":          requestID,
		"changed_owner":       changedOwner,
		"changed_category":    changedCategory,
		"previous_thread_title": th.Title,
	}
	detailsJSON, _ := json.Marshal(details)

	ip := c.ClientIP()
	ua := c.GetHeader("User-Agent")
	if len(ip) > 45 {
		ip = ip[:45]
	}
	if len(ua) > 512 {
		ua = ua[:512]
	}
	if len(adminEmailStr) > 255 {
		adminEmailStr = adminEmailStr[:255]
	}

	_, err = tx.SecurityEvent.Create().
		SetEventType("admin_thread_move").
		SetEmail(adminEmailStr).
		SetIPAddress(ip).
		SetUserAgent(ua).
		SetSuccess(true).
		SetSeverity("warning").
		SetDetails(string(detailsJSON)).
		Save(ctx)
	if err != nil {
		logger.Error("Failed to persist admin audit log (admin move thread)", zap.Error(err), zap.Int("thread_id", threadID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase.WithDetails("Gagal mencatat audit log")))
		return
	}

	if err := tx.Commit(); err != nil {
		logger.Error("Failed to commit transaction (admin move thread)", zap.Error(err), zap.Int("thread_id", threadID))
		c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrDatabase))
		return
	}
	committed = true

	logger.Warn("Thread moved by admin",
		zap.Uint("admin_id", adminID),
		zap.String("admin_email", adminEmailStr),
		zap.Int("thread_id", threadID),
		zap.Uint("old_owner_user_id", oldOwnerID),
		zap.Uint("new_owner_user_id", req.NewOwnerUserID),
		zap.Uint("old_category_id", uint(oldCategoryEnt.ID)),
		zap.Uint("new_category_id", uint(newCategoryEnt.ID)),
		zap.String("request_id", requestID),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Thread berhasil dipindahkan",
		"data": AdminMoveThreadResponse{
			ThreadID: uint(th.ID),
			OldOwner: AdminMoveThreadUserSnapshot{
				ID:       uint(oldOwnerEnt.ID),
				Username: safeUsername(oldOwnerEnt),
			},
			NewOwner: AdminMoveThreadUserSnapshot{
				ID:       uint(newOwnerEnt.ID),
				Username: safeUsername(newOwnerEnt),
			},
			OldCategory: AdminCategoryItem{
				ID:          uint(oldCategoryEnt.ID),
				Slug:        oldCategoryEnt.Slug,
				Name:        oldCategoryEnt.Name,
				Description: oldCategoryEnt.Description,
			},
			NewCategory: AdminCategoryItem{
				ID:          uint(newCategoryEnt.ID),
				Slug:        newCategoryEnt.Slug,
				Name:        newCategoryEnt.Name,
				Description: newCategoryEnt.Description,
			},
			ChangedOwner:    changedOwner,
			ChangedCategory: changedCategory,
			DryRun:          false,
			RequestID:       requestID,
		},
	})
}

func safeUsername(u *ent.User) string {
	if u == nil || u.Username == nil {
		return ""
	}
	return *u.Username
}
