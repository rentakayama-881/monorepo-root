package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/tag"
	"backend-gin/ent/thread"

	"github.com/gin-gonic/gin"
)

// GetAllTagsHandler returns all active tags
// GET /api/tags
func GetAllTagsHandler(c *gin.Context) {
	ctx := c.Request.Context()
	client := database.GetEntClient()

	tags, err := client.Tag.Query().
		Where(tag.IsActiveEQ(true)).
		Order(ent.Asc(tag.FieldOrder), ent.Asc(tag.FieldName)).
		All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca tags"})
		return
	}

	res := make([]gin.H, 0, len(tags))
	for _, t := range tags {
		res = append(res, gin.H{
			"id":          t.ID,
			"slug":        t.Slug,
			"name":        t.Name,
			"description": t.Description,
			"color":       t.Color,
			"icon":        t.Icon,
		})
	}

	c.JSON(http.StatusOK, gin.H{"tags": res})
}

// GetTagBySlugHandler returns a specific tag by slug
// GET /api/tags/:slug
func GetTagBySlugHandler(c *gin.Context) {
	slug := c.Param("slug")
	ctx := c.Request.Context()
	client := database.GetEntClient()

	t, err := client.Tag.Query().
		Where(tag.SlugEQ(slug), tag.IsActiveEQ(true)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tag tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          t.ID,
		"slug":        t.Slug,
		"name":        t.Name,
		"description": t.Description,
		"color":       t.Color,
		"icon":        t.Icon,
	})
}

// GetThreadsByTagHandler returns all threads with a specific tag
// GET /api/tags/:slug/threads
func GetThreadsByTagHandler(c *gin.Context) {
	slug := c.Param("slug")
	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Find tag
	t, err := client.Tag.Query().
		Where(tag.SlugEQ(slug), tag.IsActiveEQ(true)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tag tidak ditemukan"})
		return
	}

	// Get threads with this tag
	threads, err := client.Thread.Query().
		Where(thread.HasTagsWith(tag.IDEQ(t.ID))).
		WithUser().
		WithCategory().
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Order(ent.Desc(thread.FieldCreatedAt)).
		Limit(50).
		All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca threads"})
		return
	}

	res := make([]gin.H, 0, len(threads))
	for _, th := range threads {
		// Build user info
		var username string
		var avatarURL string
		if th.Edges.User != nil {
			if th.Edges.User.Username != nil {
				username = *th.Edges.User.Username
			}
			avatarURL = th.Edges.User.AvatarURL
		}

		// Build category info
		var categoryName, categorySlug string
		if th.Edges.Category != nil {
			categoryName = th.Edges.Category.Name
			categorySlug = th.Edges.Category.Slug
		}

		// Build tags list
		tagList := make([]gin.H, 0)
		for _, tg := range th.Edges.Tags {
			tagList = append(tagList, gin.H{
				"id":    tg.ID,
				"slug":  tg.Slug,
				"name":  tg.Name,
				"color": tg.Color,
			})
		}

		res = append(res, gin.H{
			"id":            th.ID,
			"title":         th.Title,
			"summary":       th.Summary,
			"created_at":    th.CreatedAt.Unix(),
			"username":      username,
			"avatar_url":    avatarURL,
			"category_name": categoryName,
			"category_slug": categorySlug,
			"tags":          tagList,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"tag": gin.H{
			"id":          t.ID,
			"slug":        t.Slug,
			"name":        t.Name,
			"description": t.Description,
			"color":       t.Color,
		},
		"threads": res,
	})
}

// GetThreadTagsHandler returns tags for a specific thread
// GET /api/threads/:id/tags
func GetThreadTagsHandler(c *gin.Context) {
	idStr := c.Param("id")
	threadID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Get thread with tags
	th, err := client.Thread.Query().
		Where(thread.IDEQ(threadID)).
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
		return
	}

	res := make([]gin.H, 0)
	for _, t := range th.Edges.Tags {
		res = append(res, gin.H{
			"id":    t.ID,
			"slug":  t.Slug,
			"name":  t.Name,
			"color": t.Color,
			"icon":  t.Icon,
		})
	}

	c.JSON(http.StatusOK, gin.H{"tags": res})
}

// AddTagToThreadRequest is the request body for adding tags
type AddTagToThreadRequest struct {
	TagIDs []int `json:"tag_ids" binding:"required"`
}

// AddTagsToThreadHandler adds tags to a thread (owner only)
// POST /api/threads/:id/tags
func AddTagsToThreadHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

	idStr := c.Param("id")
	threadID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var req AddTagToThreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Get thread and verify ownership
	th, err := client.Thread.Query().
		Where(thread.IDEQ(threadID)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
		return
	}

	if th.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki akses untuk mengedit thread ini"})
		return
	}

	// Validate tag IDs exist and are active
	tags, err := client.Tag.Query().
		Where(tag.IDIn(req.TagIDs...), tag.IsActiveEQ(true)).
		All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memvalidasi tags"})
		return
	}

	if len(tags) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tidak ada tag yang valid"})
		return
	}

	// Limit to max 5 tags per thread
	if len(tags) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maksimal 5 tag per thread"})
		return
	}

	// Add tags to thread
	_, err = client.Thread.UpdateOneID(threadID).
		ClearTags().
		AddTags(tags...).
		Save(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menambahkan tags"})
		return
	}

	// Return updated tags
	res := make([]gin.H, 0, len(tags))
	for _, t := range tags {
		res = append(res, gin.H{
			"id":    t.ID,
			"slug":  t.Slug,
			"name":  t.Name,
			"color": t.Color,
		})
	}

	c.JSON(http.StatusOK, gin.H{"tags": res})
}

// RemoveTagFromThreadHandler removes a tag from a thread (owner only)
// DELETE /api/threads/:id/tags/:tagSlug
func RemoveTagFromThreadHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

	idStr := c.Param("id")
	threadID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	tagSlug := c.Param("tagSlug")
	if tagSlug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tag slug diperlukan"})
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Get thread and verify ownership
	th, err := client.Thread.Query().
		Where(thread.IDEQ(threadID)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "thread tidak ditemukan"})
		return
	}

	if th.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki akses untuk mengedit thread ini"})
		return
	}

	// Find tag
	t, err := client.Tag.Query().
		Where(tag.SlugEQ(tagSlug)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tag tidak ditemukan"})
		return
	}

	// Remove tag from thread
	_, err = client.Thread.UpdateOneID(threadID).
		RemoveTags(t).
		Save(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menghapus tag"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tag berhasil dihapus"})
}
