package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"backend-gin/database"

	"github.com/gin-gonic/gin"
)


func normalizeSocialAccounts(socialAccounts map[string]interface{}) interface{} {
	if len(socialAccounts) == 0 {
		return nil
	}
	if items, ok := socialAccounts["items"]; ok {
		return items
	}

	normalized := make([]map[string]interface{}, 0, len(socialAccounts))
	for label, value := range socialAccounts {
		entry := map[string]interface{}{"label": label}
		switch v := value.(type) {
		case string:
			entry["url"] = v
		default:
			entry["url"] = fmt.Sprint(value)
		}
		normalized = append(normalized, entry)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

type UpdateAccountRequest struct {
	FullName       *string         `json:"full_name"`
	Bio            *string         `json:"bio"`
	Pronouns       *string         `json:"pronouns"`
	Company        *string         `json:"company"`
	Telegram       *string         `json:"telegram"`
	SocialAccounts json.RawMessage `json:"social_accounts"` // allow array or map payloads
}

type ChangeUsernameRequest struct {
	NewUsername string `json:"new_username" binding:"required"`
}

// GET /api/account/me
func GetMyAccountHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	socials := normalizeSocialAccounts(user.SocialAccounts)
	name := ""
	if user.Username != nil {
		name = *user.Username
	}
	c.JSON(http.StatusOK, gin.H{
		"email":           user.Email,
		"username":        name,
		"full_name":       user.FullName,
		"bio":             user.Bio,
		"pronouns":        user.Pronouns,
		"company":         user.Company,
		"telegram":        user.Telegram,
		"telegram_auth":   buildTelegramAuthResponse(user),
		"social_accounts": socials,
		"avatar_url":      user.AvatarURL,
	})
}

// PUT /api/account
func UpdateMyAccountHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	// Update via Ent ORM
	upd := database.GetEntClient().User.UpdateOneID(user.ID)
	if req.FullName != nil {
		upd = upd.SetNillableFullName(req.FullName)
	}
	if req.Bio != nil {
		upd = upd.SetBio(*req.Bio)
	}
	if req.Pronouns != nil {
		upd = upd.SetPronouns(*req.Pronouns)
	}
	if req.Company != nil {
		upd = upd.SetCompany(*req.Company)
	}
	// Legacy field kept for backward compatibility, but no longer writable via profile update.
	_ = req.Telegram
	if len(req.SocialAccounts) > 0 {
		var socialList []map[string]interface{}
		var socialMap map[string]interface{}

		if err := json.Unmarshal(req.SocialAccounts, &socialList); err == nil {
			if len(socialList) == 0 {
				upd = upd.ClearSocialAccounts()
			} else {
				upd = upd.SetSocialAccounts(map[string]interface{}{"items": socialList})
			}
		} else if err := json.Unmarshal(req.SocialAccounts, &socialMap); err == nil {
			if len(socialMap) == 0 {
				upd = upd.ClearSocialAccounts()
			} else {
				upd = upd.SetSocialAccounts(socialMap)
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "format social account tidak valid"})
			return
		}
	}
	if _, err := upd.Save(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
