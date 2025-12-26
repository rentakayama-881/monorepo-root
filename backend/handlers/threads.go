package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

type ThreadListItem struct {
	ID        uint   `json:"id"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Username  string `json:"username"`
	Category  string `json:"category"`
	CreatedAt int64  `json:"created_at"`
}

func GetCategoriesHandler(c *gin.Context) {
	var cats []models.Category
	if err := database.DB.Order("name asc").Find(&cats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca kategori"})
		return
	}
	out := make([]gin.H, 0, len(cats))
	for _, cat := range cats {
		out = append(out, gin.H{"slug": cat.Slug, "name": cat.Name, "description": cat.Description})
	}
	c.JSON(http.StatusOK, gin.H{"categories": out})
}

func GetThreadsByCategoryHandler(c *gin.Context) {
	slug := c.Param("slug")
	cat := models.Category{}
	if err := database.DB.Where("slug = ?", slug).First(&cat).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "kategori tidak ditemukan"})
		return
	}
	var threads []models.Thread
	if err := database.DB.Preload("User").Where("category_id = ?", cat.ID).Order("created_at desc").Limit(100).Find(&threads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca threads"})
		return
	}
	items := make([]ThreadListItem, 0, len(threads))
	for _, t := range threads {
		uname := ""
		if t.User.Username != nil {
			uname = *t.User.Username
		}
		items = append(items, ThreadListItem{
			ID:        t.ID,
			Title:     t.Title,
			Summary:   t.Summary,
			Username:  uname,
			Category:  cat.Slug,
			CreatedAt: t.CreatedAt.Unix(),
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"category": gin.H{
			"slug":        cat.Slug,
			"name":        cat.Name,
			"description": cat.Description,
		},
		"threads": items,
	})
}

func GetThreadDetailHandler(c *gin.Context) {
	id := c.Param("id")
	thr := models.Thread{}
	if err := database.DB.Preload("User").Preload("Category").First(&thr, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
		return
	}
	uname := ""
	if thr.User.Username != nil {
		uname = *thr.User.Username
	}
	var content interface{}
	_ = json.Unmarshal(thr.ContentJSON, &content)
	var meta interface{}
	_ = json.Unmarshal(thr.Meta, &meta)

	// Get user's primary badge
	var primaryBadge interface{}
	if thr.User.PrimaryBadgeID != nil && *thr.User.PrimaryBadgeID > 0 {
		var badge models.Badge
		if err := database.DB.First(&badge, *thr.User.PrimaryBadgeID).Error; err == nil {
			primaryBadge = gin.H{
				"id":       badge.ID,
				"name":     badge.Name,
				"slug":     badge.Slug,
				"icon_url": badge.IconURL,
				"color":    badge.Color,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           thr.ID,
		"title":        thr.Title,
		"summary":      thr.Summary,
		"content_type": thr.ContentType,
		"content":      content,
		"meta":         meta, // seluruh meta dikirim (image, telegram, etc)
		"created_at":   thr.CreatedAt.Unix(),
		"user": gin.H{
			"username":      uname,
			"avatar_url":    thr.User.AvatarURL,
			"id":            thr.UserID,
			"primary_badge": primaryBadge,
		},
		"category": gin.H{"slug": thr.Category.Slug, "name": thr.Category.Name},
	})
}

// GET /api/threads/:id/public - Public endpoint without auth requirement
func GetPublicThreadDetailHandler(c *gin.Context) {
	id := c.Param("id")
	thr := models.Thread{}
	if err := database.DB.Preload("User").Preload("Category").First(&thr, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
		return
	}
	uname := ""
	if thr.User.Username != nil {
		uname = *thr.User.Username
	}
	var content interface{}
	_ = json.Unmarshal(thr.ContentJSON, &content)
	var meta interface{}
	_ = json.Unmarshal(thr.Meta, &meta)

	// Get user's primary badge
	var primaryBadge interface{}
	if thr.User.PrimaryBadgeID != nil && *thr.User.PrimaryBadgeID > 0 {
		var badge models.Badge
		if err := database.DB.First(&badge, *thr.User.PrimaryBadgeID).Error; err == nil {
			primaryBadge = gin.H{
				"id":       badge.ID,
				"name":     badge.Name,
				"slug":     badge.Slug,
				"icon_url": badge.IconURL,
				"color":    badge.Color,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           thr.ID,
		"title":        thr.Title,
		"summary":      thr.Summary,
		"content_type": thr.ContentType,
		"content":      content,
		"meta":         meta,
		"created_at":   thr.CreatedAt.Unix(),
		"user": gin.H{
			"username":      uname,
			"avatar_url":    thr.User.AvatarURL,
			"id":            thr.UserID,
			"primary_badge": primaryBadge,
		},
		"category": gin.H{"slug": thr.Category.Slug, "name": thr.Category.Name},
	})
}

func GetLatestThreadsHandler(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	query := database.DB.Preload("User").Preload("Category").Order("created_at desc").Limit(limit)

	categorySlug := strings.TrimSpace(c.Query("category"))
	if categorySlug != "" {
		cat := models.Category{}
		if err := database.DB.Where("slug = ?", categorySlug).First(&cat).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "kategori tidak ditemukan"})
			return
		}
		query = query.Where("category_id = ?", cat.ID)
	}

	var threads []models.Thread
	if err := query.Find(&threads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca threads"})
		return
	}

	out := make([]gin.H, 0, len(threads))
	for _, t := range threads {
		uname := ""
		if t.User.Username != nil {
			uname = *t.User.Username
		}

		// Get user's primary badge if set
		var primaryBadge interface{}
		if t.User.PrimaryBadgeID != nil && *t.User.PrimaryBadgeID > 0 {
			var badge models.Badge
			if err := database.DB.First(&badge, *t.User.PrimaryBadgeID).Error; err == nil {
				primaryBadge = gin.H{
					"id":       badge.ID,
					"name":     badge.Name,
					"slug":     badge.Slug,
					"icon_url": badge.IconURL,
					"color":    badge.Color,
				}
			}
		}

		out = append(out, gin.H{
			"id":            t.ID,
			"title":         t.Title,
			"summary":       t.Summary,
			"category":      gin.H{"slug": t.Category.Slug, "name": t.Category.Name},
			"created_at":    t.CreatedAt.Unix(),
			"username":      uname,
			"primary_badge": primaryBadge,
		})
	}

	c.JSON(http.StatusOK, gin.H{"threads": out})
}

func CreateThreadHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	var req dto.CreateThreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}
	req.ContentType = strings.ToLower(req.ContentType)
	if req.ContentType == "" {
		req.ContentType = "table"
	}

	cat := models.Category{}
	if err := database.DB.Where("slug = ?", req.CategorySlug).First(&cat).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kategori tidak ditemukan"})
		return
	}

	// Pastikan meta adalah map (bisa dari frontend, image/telegram sudah masuk di meta)
	meta := req.Meta
	if meta == nil {
		meta = map[string]interface{}{}
	}

	contentJSON := datatypes.JSON([]byte("{}"))
	if req.Content != nil {
		b, _ := json.Marshal(req.Content)
		contentJSON = datatypes.JSON(b)
	}
	metaJSON := datatypes.JSON([]byte("{}"))
	if meta != nil {
		b, _ := json.Marshal(meta)
		metaJSON = datatypes.JSON(b)
	}

	thr := models.Thread{
		CategoryID:  cat.ID,
		UserID:      user.ID,
		Title:       req.Title,
		Summary:     req.Summary,
		ContentType: req.ContentType,
		ContentJSON: contentJSON,
		Meta:        metaJSON,
	}
	if err := database.DB.Create(&thr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuat thread"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": thr.ID})
}

func UpdateThreadHandler(c *gin.Context) {
	// Hanya pemilik thread yang boleh edit
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	id := c.Param("id")
	var thr models.Thread
	if err := database.DB.First(&thr, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
		return
	}
	if thr.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "tidak boleh mengedit thread milik orang lain"})
		return
	}

	var req dto.UpdateThreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	// Apply perubahan jika ada
	if req.Title != nil {
		thr.Title = *req.Title
	}
	if req.Summary != nil {
		thr.Summary = *req.Summary
	}
	if req.ContentType != nil {
		ct := strings.ToLower(strings.TrimSpace(*req.ContentType))
		if ct == "" {
			ct = "table"
		}
		thr.ContentType = ct
	}
	if req.Content != nil {
		if b, err := json.Marshal(req.Content); err == nil {
			thr.ContentJSON = datatypes.JSON(b)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content tidak valid"})
			return
		}
	}
	if req.Meta != nil {
		// Normalisasi telegram agar konsisten: simpan selalu dengan awalan '@'
		// Jika Meta adalah map[string]any, kita sentuh kunci "telegram" bila ada
		// (Jika tidak ada, langsung simpan apa adanya)
		if m, ok := req.Meta.(map[string]interface{}); ok {
			if tg, ok := m["telegram"].(string); ok {
				tg = strings.TrimSpace(tg)
				if tg != "" && !strings.HasPrefix(tg, "@") {
					tg = "@" + tg
					m["telegram"] = tg
				}
				req.Meta = m
			}
		}
		if b, err := json.Marshal(req.Meta); err == nil {
			thr.Meta = datatypes.JSON(b)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "meta tidak valid"})
			return
		}
	}

	if err := database.DB.Save(&thr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan perubahan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "id": thr.ID})
}
