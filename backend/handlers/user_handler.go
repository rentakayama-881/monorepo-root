package handlers

import (
	"net/http"

	"backend-gin/ent"
	"backend-gin/models"
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
	user := userIfc.(*models.User)
	name := ""
	if user.Username != nil {
		name = *user.Username
	}
	c.JSON(http.StatusOK, gin.H{
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

	// Map ent.User to models.User for existing projection function
	mapped := mapEntUserToModel(u)
	c.JSON(http.StatusOK, BuildPublicProfile(c, mapped))
}

func mapEntUserToModel(u *ent.User) *models.User {
	m := &models.User{
		Email:     u.Email,
		AvatarURL: u.AvatarURL,
		Bio:       u.Bio,
		Pronouns:  u.Pronouns,
		Company:   u.Company,
		Telegram:  u.Telegram,
		PrimaryBadgeID: func() *uint {
			if u.PrimaryBadgeID != nil {
				v := uint(*u.PrimaryBadgeID)
				return &v
			}
			return nil
		}(),
	}
	m.ID = uint(u.ID)
	if u.Username != nil {
		name := *u.Username
		m.Username = &name
	}
	if u.FullName != nil {
		fn := *u.FullName
		m.FullName = &fn
	}
	return m
}
