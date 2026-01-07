package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/database"
	"backend-gin/ent/credential"

	"github.com/gin-gonic/gin"
)

func GetBadgeDetailHandler(c *gin.Context) {
	id := c.Param("id")
	credID, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	cr, err := database.GetEntClient().Credential.Query().
		Where(credential.IDEQ(credID)).
		Only(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "badge tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":          cr.ID,
		"user_id":     cr.UserID,
		"platform":    cr.Platform,
		"description": cr.Description,
		"created_at":  cr.CreatedAt.Unix(),
	})
}
