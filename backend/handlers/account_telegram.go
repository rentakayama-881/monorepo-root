package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/ent"
	entuser "backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

func buildTelegramAuthResponse(u *ent.User) gin.H {
	connected := u.TelegramAuthUserID != nil && *u.TelegramAuthUserID > 0 && u.TelegramAuthVerifiedAt != nil
	response := gin.H{
		"connected": connected,
	}
	if !connected {
		return response
	}

	telegramUserID := strconv.FormatInt(*u.TelegramAuthUserID, 10)
	username := services.NormalizeTelegramUsername(u.TelegramAuthUsername)

	response["telegram_user_id"] = telegramUserID
	response["username"] = username
	response["display_username"] = services.BuildTelegramDisplayHandle(username, u.TelegramAuthUserID)
	response["deep_link"] = services.BuildTelegramDeepLink(username, u.TelegramAuthUserID)
	response["first_name"] = strings.TrimSpace(u.TelegramAuthFirstName)
	response["last_name"] = strings.TrimSpace(u.TelegramAuthLastName)
	response["photo_url"] = strings.TrimSpace(u.TelegramAuthPhotoURL)
	if u.TelegramAuthVerifiedAt != nil {
		response["verified_at"] = u.TelegramAuthVerifiedAt.UTC().Format(time.RFC3339)
	}
	return response
}

// ConnectTelegramAuthHandler godoc
// @Summary      Connect Telegram account
// @Description  Link a Telegram account to the authenticated user using Telegram Login Widget data. The payload is verified against the bot token.
// @Tags         Account
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      SwaggerTelegramConnectRequest  true  "Telegram login widget payload"
// @Success      200   {object}  handlers.SwaggerTelegramConnectResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      409   {object}  handlers.SwaggerErrorResponse  "Telegram account already linked to another user"
// @Failure      500   {object}  handlers.SwaggerErrorResponse
// @Router       /account/telegram/connect [post]
// POST /api/account/telegram/connect
func ConnectTelegramAuthHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req services.TelegramLoginPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	if err := services.VerifyTelegramLoginPayload(req, config.TelegramBotToken, config.TelegramAuthMaxAgeSeconds, time.Now()); err != nil {
		handleError(c, err)
		return
	}

	ctx := c.Request.Context()
	existingOwner, err := database.GetEntClient().User.Query().
		Where(entuser.TelegramAuthUserIDEQ(req.ID)).
		Only(ctx)
	if err == nil && existingOwner.ID != user.ID {
		handleError(c, apperrors.ErrTelegramAlreadyLinked)
		return
	}
	if err != nil && !ent.IsNotFound(err) {
		handleError(c, apperrors.ErrDatabase)
		return
	}

	normalizedUsername := services.NormalizeTelegramUsername(req.Username)
	update := database.GetEntClient().User.UpdateOneID(user.ID).
		SetTelegramAuthUserID(req.ID).
		SetTelegramAuthUsername(normalizedUsername).
		SetTelegramAuthFirstName(strings.TrimSpace(req.FirstName)).
		SetTelegramAuthLastName(strings.TrimSpace(req.LastName)).
		SetTelegramAuthPhotoURL(strings.TrimSpace(req.PhotoURL)).
		SetTelegramAuthVerifiedAt(time.Now().UTC()).
		SetTelegramAuthLastAuthDate(req.AuthDate)

	// Keep legacy field in sync for compatibility with existing admin views/logs.
	if normalizedUsername != "" {
		update.SetTelegram("@" + normalizedUsername)
	} else {
		update.SetTelegram("")
	}

	updatedUser, err := update.Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) {
			handleError(c, apperrors.ErrTelegramAlreadyLinked)
			return
		}
		handleError(c, apperrors.ErrDatabase)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "ok",
		"telegram_auth": buildTelegramAuthResponse(updatedUser),
	})
}

// DisconnectTelegramAuthHandler godoc
// @Summary      Disconnect Telegram account
// @Description  Unlink the connected Telegram account from the authenticated user.
// @Tags         Account
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerTelegramConnectResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      500  {object}  handlers.SwaggerErrorResponse
// @Router       /account/telegram/disconnect [post]
// POST /api/account/telegram/disconnect
func DisconnectTelegramAuthHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	updatedUser, err := database.GetEntClient().User.UpdateOneID(user.ID).
		ClearTelegramAuthUserID().
		SetTelegramAuthUsername("").
		SetTelegramAuthFirstName("").
		SetTelegramAuthLastName("").
		SetTelegramAuthPhotoURL("").
		ClearTelegramAuthVerifiedAt().
		SetTelegramAuthLastAuthDate(0).
		SetTelegram("").
		Save(c.Request.Context())
	if err != nil {
		handleError(c, apperrors.ErrDatabase)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "ok",
		"telegram_auth": buildTelegramAuthResponse(updatedUser),
	})
}
