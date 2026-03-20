package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService *services.EntUserService
}

func NewUserHandler(userService *services.EntUserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetUserInfo godoc
// @Summary      Get current user info
// @Description  Returns basic identity info (id, email, username, avatar) for the authenticated user.
// @Tags         User
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerUserInfoResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /user/me [get]
func (h *UserHandler) GetUserInfo(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}
	name := ""
	if user.Username != nil {
		name = *user.Username
	}
	c.JSON(http.StatusOK, gin.H{
		"id":         user.ID,
		"email":      user.Email,
		"name":       name,
		"username":   name,
		"avatar_url": user.AvatarURL,
	})
}

// GetPublicUserProfile godoc
// @Summary      Get public user profile
// @Description  Returns the public profile of a user by username, including badges, validation case count, and guarantee amount.
// @Tags         User
// @Produce      json
// @Param        username  path      string  true  "Username"
// @Success      200       {object}  handlers.SwaggerPublicUserProfileResponse
// @Failure      404       {object}  handlers.SwaggerErrorResponse
// @Router       /user/{username} [get]
func (h *UserHandler) GetPublicUserProfile(c *gin.Context) {
	username := c.Param("username")

	u, err := h.userService.GetUserByUsername(c.Request.Context(), username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, BuildPublicProfileFromEnt(c, u))
}

// GetPublicUserProfileByID godoc
// @Summary      Get public user info by ID
// @Description  Returns minimal public info (id, username, avatar) for a user by their numeric ID. Intended for internal service-to-service lookups.
// @Tags         User
// @Produce      json
// @Param        id  path      int  true  "User ID"
// @Success      200  {object}  handlers.SwaggerPublicUserByIDResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /users/{id}/public [get]
func (h *UserHandler) GetPublicUserProfileByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	u, err := h.userService.GetUserByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}

	// Return minimal public info
	username := ""
	if u.Username != nil {
		username = *u.Username
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         u.ID,
		"username":   username,
		"avatar_url": u.AvatarURL,
	})
}

type UpdateGuaranteeAmountRequest struct {
	// Pointer type so `binding:"required"` allows guarantee_amount=0 (valid for release).
	GuaranteeAmount *int64 `json:"guarantee_amount" binding:"required"`
}

// UpdateGuaranteeAmount godoc
// @Summary      Update user guarantee amount
// @Description  Sets the guarantee amount for a user. Service-to-service endpoint protected by X-Internal-Api-Key.
// @Tags         Internal
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id    path      int                                            true  "User ID"
// @Param        body  body      handlers.SwaggerInternalUpdateGuaranteeRequest  true  "Guarantee amount"
// @Success      200   {object}  handlers.SwaggerStatusResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      404   {object}  handlers.SwaggerErrorResponse
// @Failure      500   {object}  handlers.SwaggerErrorResponse
// @Router       /internal/users/{id}/guarantee [put]
func (h *UserHandler) UpdateGuaranteeAmount(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req UpdateGuaranteeAmountRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.GuaranteeAmount == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	amount := *req.GuaranteeAmount
	if amount < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "guarantee_amount tidak boleh negatif"})
		return
	}

	ctx := c.Request.Context()
	_, err = database.GetEntClient().User.
		UpdateOneID(id).
		SetGuaranteeAmount(amount).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
