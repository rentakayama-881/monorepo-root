package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"backend-gin/ent"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	logger.Error("Unhandled error", zap.Error(err))
	c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
}

func mustGetUser(c *gin.Context) (*ent.User, bool) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return nil, false
	}
	u, ok := userIfc.(*ent.User)
	if !ok || u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return nil, false
	}
	return u, true
}

func parseUintParam(c *gin.Context, paramName string, label string) (uint, bool) {
	raw := strings.TrimSpace(c.Param(paramName))
	v, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || v == 0 {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrInvalidInput.WithDetails(label+" harus berupa angka")))
		return 0, false
	}
	return uint(v), true
}
