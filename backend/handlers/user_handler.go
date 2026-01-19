package handlers

import (
	"net/http"

	"backend-gin/ent"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// UserHandler handles user HTTP requests
type UserHandler struct {
	userService *services.EntUserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(userService *services.EntUserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetUserInfo returns current authenticated user info
func (h *UserHandler) GetUserInfo(c *gin.Context) {
	userIfc, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)
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

// GetPublicUserProfile returns public profile by username
func (h *UserHandler) GetPublicUserProfile(c *gin.Context) {
	username := c.Param("username")

	u, err := h.userService.GetUserByUsername(c.Request.Context(), username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, BuildPublicProfileFromEnt(c, u))
}

// GetPublicUserProfileByID returns public profile by user ID (for internal service calls)
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
