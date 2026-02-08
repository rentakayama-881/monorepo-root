package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/ent"
	"backend-gin/ent/thread"
	"backend-gin/ent/threadcredential"

	"github.com/gin-gonic/gin"
)

type CredentialHandler struct {
	client *ent.Client
}

func NewCredentialHandler(client *ent.Client) *CredentialHandler {
	return &CredentialHandler{client: client}
}

// POST /api/threads/:id/credential (auth required)
func (h *CredentialHandler) GiveCredential(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

	threadIDStr := c.Param("id")
	threadID, err := strconv.Atoi(threadIDStr)
	if err != nil || threadID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid thread id"})
		return
	}

	ctx := c.Request.Context()

	t, err := h.client.Thread.
		Query().
		Where(thread.IDEQ(threadID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses"})
		return
	}

	if t.UserID == user.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat memberikan credential pada thread sendiri"})
		return
	}

	_, err = h.client.ThreadCredential.
		Create().
		SetUserID(user.ID).
		SetThreadID(t.ID).
		Save(ctx)
	if err != nil {
		// Idempotent success on unique constraint
		if ent.IsConstraintError(err) {
			resp := gin.H{"status": "ok", "already": true}
			if count, cntErr := h.client.ThreadCredential.
				Query().
				Where(threadcredential.ThreadIDEQ(t.ID)).
				Count(ctx); cntErr == nil {
				resp["count"] = count
			}
			c.JSON(http.StatusOK, resp)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses"})
		return
	}

	resp := gin.H{"status": "ok", "already": false}
	if count, cntErr := h.client.ThreadCredential.
		Query().
		Where(threadcredential.ThreadIDEQ(t.ID)).
		Count(ctx); cntErr == nil {
		resp["count"] = count
	}
	c.JSON(http.StatusOK, resp)
}

// DELETE /api/threads/:id/credential (auth required)
func (h *CredentialHandler) RemoveCredential(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

	threadIDStr := c.Param("id")
	threadID, err := strconv.Atoi(threadIDStr)
	if err != nil || threadID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid thread id"})
		return
	}

	ctx := c.Request.Context()

	// Idempotent: deleting non-existent row is success.
	_, err = h.client.ThreadCredential.
		Delete().
		Where(
			threadcredential.UserIDEQ(user.ID),
			threadcredential.ThreadIDEQ(threadID),
		).
		Exec(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses"})
		return
	}

	resp := gin.H{"status": "ok"}
	if count, cntErr := h.client.ThreadCredential.
		Query().
		Where(threadcredential.ThreadIDEQ(threadID)).
		Count(ctx); cntErr == nil {
		resp["count"] = count
	}
	c.JSON(http.StatusOK, resp)
}

// GET /api/threads/:id/credential/count (public)
func (h *CredentialHandler) GetCredentialCount(c *gin.Context) {
	threadIDStr := c.Param("id")
	threadID, err := strconv.Atoi(threadIDStr)
	if err != nil || threadID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid thread id"})
		return
	}

	ctx := c.Request.Context()

	count, err := h.client.ThreadCredential.
		Query().
		Where(threadcredential.ThreadIDEQ(threadID)).
		Count(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}
