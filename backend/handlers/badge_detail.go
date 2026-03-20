package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/database"

	"github.com/gin-gonic/gin"
)

// GetBadgeDetailHandler godoc
// @Summary      Get badge detail
// @Description  Returns details of a specific badge by its numeric ID.
// @Tags         Badges
// @Produce      json
// @Param        id   path      int  true  "Badge ID"
// @Success      200  {object}  handlers.SwaggerPublicBadgeDetailResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /badges/{id} [get]
func GetBadgeDetailHandler(c *gin.Context) {
	id := c.Param("id")
	badgeID, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	ctx := c.Request.Context()
	badge, err := database.GetEntClient().Badge.Get(ctx, badgeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "badge tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          badge.ID,
		"name":        badge.Name,
		"slug":        badge.Slug,
		"description": badge.Description,
		"icon_type":   badge.IconType,
		"color":       badge.Color,
		"created_at":  badge.CreatedAt.Unix(),
	})
}
