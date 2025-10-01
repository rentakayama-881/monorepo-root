package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
        "time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/middleware"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

func GithubLoginHandler(c *gin.Context) {
	url := config.OAuthConf.AuthCodeURL("random-state")
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func GithubCallbackHandler(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode tidak ditemukan"})
		return
	}
	token, err := config.OAuthConf.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menukar token"})
		return
	}
	client := config.OAuthConf.Client(context.Background(), token)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data GitHub"})
		return
	}
	defer resp.Body.Close()
	var ghUser dto.GithubUser
	if err := json.NewDecoder(resp.Body).Decode(&ghUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal decode data GitHub"})
		return
	}
	emailResp, err := client.Get("https://api.github.com/user/emails")
	if err != nil || emailResp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil email GitHub"})
		return
	}
	defer emailResp.Body.Close()
	var emails []dto.GithubEmail
	if err := json.NewDecoder(emailResp.Body).Decode(&emails); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal decode email"})
		return
	}
	var primaryEmail string
	for _, e := range emails {
		if e.Primary && e.Verified {
			primaryEmail = e.Email
			break
		}
	}
	if primaryEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email utama tidak ditemukan"})
		return
	}
	var user models.User
	result := database.DB.Where("email = ?", primaryEmail).First(&user)
	if result.Error != nil {
		var nilName *string = nil
		user = models.User{
			Email:     primaryEmail,
			AvatarURL: ghUser.AvatarURL,
			Name:      nilName,
		}
		if err := database.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendaftarkan pengguna baru"})
			return
		}
	}
	jwtString, err := middleware.GenerateJWT(user.Email, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token"})
		return
	}

	// Redirect to frontend /sync-token?token=...&next=...
	frontend := os.Getenv("FRONTEND_BASE_URL")
	if frontend == "" { frontend = "http://localhost:3000" }
	redir, _ := url.Parse(frontend)
	redir.Path = "/sync-token"
	q := redir.Query()
	q.Set("token", jwtString)
	// Tentukan langkah berikutnya
	next := "/"
	if user.Name == nil || *user.Name == "" {
		next = "/set-username"
	}
	q.Set("next", next)
	redir.RawQuery = q.Encode()
	c.Redirect(http.StatusTemporaryRedirect, redir.String())
}

