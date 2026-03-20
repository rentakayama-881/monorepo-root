package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/tag"
	"backend-gin/ent/validationcase"

	"github.com/gin-gonic/gin"
)

func tagGroupBySlug(slug string) string {
	normalized := strings.ToLower(strings.TrimSpace(slug))
	switch {
	case strings.HasPrefix(normalized, "artifact-"):
		return "artifact"
	case strings.HasPrefix(normalized, "stage-"):
		return "stage"
	case strings.HasPrefix(normalized, "domain-"):
		return "domain"
	case strings.HasPrefix(normalized, "evidence-"):
		return "evidence"
	default:
		return ""
	}
}

// GetAllTagsHandler godoc
// @Summary      List all tags
// @Description  Returns all active tags ordered by priority and name.
// @Tags         Tags
// @Produce      json
// @Success      200  {object}  handlers.SwaggerTagListResponse
// @Failure      500  {object}  handlers.SwaggerErrorResponse
// @Router       /tags [get]
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

// GetTagBySlugHandler godoc
// @Summary      Get tag by slug
// @Description  Returns a single active tag by its slug.
// @Tags         Tags
// @Produce      json
// @Param        slug  path      string  true  "Tag slug"
// @Success      200   {object}  handlers.SwaggerTagItem
// @Failure      404   {object}  handlers.SwaggerErrorResponse
// @Router       /tags/{slug} [get]
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

// GetValidationCasesByTagHandler godoc
// @Summary      Get validation cases by tag
// @Description  Returns all validation cases that have the specified tag, along with the tag details.
// @Tags         Tags
// @Produce      json
// @Param        slug  path      string  true  "Tag slug"
// @Success      200   {object}  handlers.SwaggerTagWithCasesResponse
// @Failure      404   {object}  handlers.SwaggerErrorResponse
// @Failure      500   {object}  handlers.SwaggerErrorResponse
// @Router       /tags/{slug}/validation-cases [get]
func GetValidationCasesByTagHandler(c *gin.Context) {
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

	// Get validation cases with this tag
	cases, err := client.ValidationCase.Query().
		Where(validationcase.HasTagsWith(tag.IDEQ(t.ID))).
		WithUser().
		WithCategory().
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Order(ent.Desc(validationcase.FieldCreatedAt)).
		Limit(50).
		All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca validation cases"})
		return
	}

	res := make([]gin.H, 0, len(cases))
	for _, vc := range cases {
		// Build user info
		var username string
		var avatarURL string
		if vc.Edges.User != nil {
			if vc.Edges.User.Username != nil {
				username = *vc.Edges.User.Username
			}
			avatarURL = vc.Edges.User.AvatarURL
		}

		// Build category info
		var categoryName, categorySlug string
		if vc.Edges.Category != nil {
			categoryName = vc.Edges.Category.Name
			categorySlug = vc.Edges.Category.Slug
		}

		// Build tags list
		tagList := make([]gin.H, 0)
		for _, tg := range vc.Edges.Tags {
			tagList = append(tagList, gin.H{
				"id":    tg.ID,
				"slug":  tg.Slug,
				"name":  tg.Name,
				"color": tg.Color,
			})
		}

		res = append(res, gin.H{
			"id":            vc.ID,
			"title":         vc.Title,
			"summary":       vc.Summary,
			"status":        vc.Status,
			"bounty_amount": vc.BountyAmount,
			"created_at":    vc.CreatedAt.Unix(),
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
		"validation_cases": res,
	})
}

// GetValidationCaseTagsHandler godoc
// @Summary      Get case tags
// @Description  Returns all tags attached to a specific validation case.
// @Tags         ValidationCases
// @Produce      json
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerTagListResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/tags [get]
func GetValidationCaseTagsHandler(c *gin.Context) {
	idStr := c.Param("id")
	validationCaseID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Get Validation Case with tags
	vc, err := client.ValidationCase.Query().
		Where(validationcase.IDEQ(validationCaseID)).
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "validation case tidak ditemukan"})
		return
	}

	res := make([]gin.H, 0)
	for _, t := range vc.Edges.Tags {
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

type AddTagToValidationCaseRequest struct {
	TagIDs []int `json:"tag_ids" binding:"required"`
}

// AddTagsToValidationCaseHandler godoc
// @Summary      Add tags to case
// @Description  Set tags on a validation case (replaces existing). Owner only. Min 2, max 4 tags.
// @Tags         ValidationCases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                             true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerAddTagsRequest  true  "Tag IDs to set"
// @Success      200  {object}  handlers.SwaggerTagListResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/tags [post]
func AddTagsToValidationCaseHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	validationCaseID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var req AddTagToValidationCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Get Validation Case and verify ownership
	vc, err := client.ValidationCase.Query().
		Where(validationcase.IDEQ(validationCaseID)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "validation case tidak ditemukan"})
		return
	}

	if vc.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki akses untuk mengedit validation case ini"})
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

	// Protocol taxonomy: min 2, max 4, single-per-dimension.
	if len(tags) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "minimal 2 tag per validation case"})
		return
	}
	if len(tags) > 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maksimal 4 tag per validation case"})
		return
	}
	seenGroup := map[string]string{}
	for _, t := range tags {
		group := tagGroupBySlug(t.Slug)
		if group == "" {
			continue
		}
		if existing, ok := seenGroup[group]; ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "hanya boleh satu tag per dimensi taxonomy", "details": group + " (" + existing + ", " + t.Slug + ")"})
			return
		}
		seenGroup[group] = t.Slug
	}

	// Ensure all provided IDs are valid/active.
	if len(tags) != len(req.TagIDs) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "terdapat tag tidak valid atau tidak aktif"})
		return
	}

	// Add tags to validation case
	_, err = client.ValidationCase.UpdateOneID(validationCaseID).
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

// RemoveTagFromValidationCaseHandler godoc
// @Summary      Remove tag from case
// @Description  Remove a specific tag from a validation case by tag slug. Owner only. Min 2 tags enforced.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id       path  int     true  "Validation Case ID"
// @Param        tagSlug  path  string  true  "Tag slug to remove"
// @Success      200  {object}  handlers.SwaggerMessageResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/tags/{tagSlug} [delete]
func RemoveTagFromValidationCaseHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	validationCaseID, err := strconv.Atoi(idStr)
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

	// Get Validation Case and verify ownership
	vc, err := client.ValidationCase.Query().
		Where(validationcase.IDEQ(validationCaseID)).
		Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "validation case tidak ditemukan"})
		return
	}

	if vc.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki akses untuk mengedit validation case ini"})
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

	currentTags, err := client.ValidationCase.Query().
		Where(validationcase.IDEQ(validationCaseID)).
		QueryTags().
		All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca tags"})
		return
	}
	if len(currentTags) <= 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "minimal 2 tag per validation case"})
		return
	}

	// Remove tag from validation case
	_, err = client.ValidationCase.UpdateOneID(validationCaseID).
		RemoveTags(t).
		Save(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menghapus tag"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tag berhasil dihapus"})
}
