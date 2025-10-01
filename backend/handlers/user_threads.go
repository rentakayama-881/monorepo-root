package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

func GetUserThreadsHandler(c *gin.Context) {
	username := c.Param("username")
	var user models.User
	if err := database.DB.Where("name = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}
	var threads []models.Thread
	if err := database.DB.Preload("Category").Where("user_id = ?", user.ID).Order("created_at desc").Limit(200).Find(&threads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca threads"})
		return
	}
	list := make([]gin.H, 0, len(threads))
	for _, t := range threads {
		list = append(list, gin.H{
			"id":        t.ID,
			"title":     t.Title,
			"summary":   t.Summary,
			"category":  t.Category.Slug,
			"created_at": t.CreatedAt.Unix(),
		})
	}
	c.JSON(http.StatusOK, gin.H{"threads": list})
        }

func GetMyThreadsHandler(c *gin.Context) {
	// Ambil user dari context (AuthMiddleware sudah set)
	u, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user, ok := u.(*models.User)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var threads []models.Thread
	if err := database.DB.Preload("Category").
		Where("user_id = ?", user.ID).
		Order("created_at desc").
		Limit(200).
		Find(&threads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat threads"})
		return
	}

	// FE (app/threads/page.jsx) bisa menerima array langsung
	out := make([]gin.H, 0, len(threads))
	for _, t := range threads {
		out = append(out, gin.H{
			"id":         t.ID,
			"title":      t.Title,
			"summary":    t.Summary,
			"category":   t.Category.Slug,
			"created_at": t.CreatedAt.Unix(),
		})

	}

        c.JSON(http.StatusOK, out)
}

