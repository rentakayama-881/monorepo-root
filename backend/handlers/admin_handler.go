package handlers

import (
	"net/http"
	"os"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/ent/admin"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)


// ==================== Admin Auth ====================

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AdminLogin godoc
// @Summary      Admin login
// @Description  Authenticate admin user with email and password. Returns admin JWT token.
// @Tags         Admin
// @Accept       json
// @Produce      json
// @Param        body  body      AdminLoginRequest  true  "Admin login credentials"
// @Success      200   {object}  handlers.SwaggerAdminLoginResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Router       /admin/auth/login [post]
func AdminLogin(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Email dan password wajib diisi"},
		})
		return
	}

	// Query Ent Admin by email using admin predicate
	adminUser, err := database.GetEntClient().Admin.Query().
		Where(admin.EmailEQ(strings.ToLower(req.Email))).
		Only(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "ADMIN006", "message": "Email atau password salah"},
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(adminUser.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "ADMIN006", "message": "Email atau password salah"},
		})
		return
	}

	// Generate admin JWT - secret is REQUIRED
	secret := strings.TrimSpace(os.Getenv("ADMIN_JWT_SECRET"))
	if secret == "" {
		logger.Error("ADMIN_JWT_SECRET not configured")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Server configuration error"},
		})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"type":     "admin",
		"admin_id": adminUser.ID,
		"email":    adminUser.Email,
		"name":     adminUser.Name,
		"iss":      config.JWTIssuer,
		"aud":      []string{config.JWTAudience},
		"exp":      time.Now().Add(config.AdminTokenExpiry).Unix(), // 8 hour expiry
		"iat":      time.Now().Unix(),
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		logger.Error("Failed to sign admin token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal membuat token"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"admin": gin.H{
			"id":    adminUser.ID,
			"email": adminUser.Email,
			"name":  adminUser.Name,
		},
	})
}
