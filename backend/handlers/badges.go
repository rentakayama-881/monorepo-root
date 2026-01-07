package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/credential"
	"backend-gin/ent/user"

	"github.com/gin-gonic/gin"
)

// For now, use existing Credential model as badges
func GetUserBadgesHandler(c *gin.Context) {
	username := c.Param("username")
	ctx := c.Request.Context()
	client := database.GetEntClient()
	u, err := client.User.Query().Where(user.UsernameEQ(username)).Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}
	creds, err := client.Credential.Query().Where(credential.UserIDEQ(u.ID)).Order(ent.Desc(credential.FieldCreatedAt)).All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca badges"})
		return
	}
	res := make([]gin.H, 0, len(creds))
	for _, cr := range creds {
		res = append(res, gin.H{
			"id":          cr.ID,
			"platform":    cr.Platform,
			"description": cr.Description,
			"created_at":  cr.CreatedAt.Unix(),
		})
	}
	c.JSON(http.StatusOK, gin.H{"badges": res})
}
