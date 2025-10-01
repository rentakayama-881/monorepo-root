package middleware

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "backend-gin/database"
    "backend-gin/models"
    // ... import jwt lib yang dipakai
)

func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Ambil token dari header Authorization
        authHeader := c.GetHeader("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
            return
        }
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")

        // Parsing dan validasi JWT, lalu ambil claims
        claims, err := ParseJWT(tokenString) // Ganti dengan implementasi JWT-mu
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
            return
        }

        // Dapatkan user dari DB pakai email dari claims
        var user models.User
        if err := database.DB.Where("email = ?", claims.Email).First(&user).Error; err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
            return
        }

        // Set user ke context agar bisa diakses di handler: c.Get("user")
        c.Set("user", &user)
        c.Next()
    }
}
