package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/devicefingerprint"
	"backend-gin/ent/deviceusermapping"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/logger"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ==================== Admin User List ====================

// AdminListUsers godoc
// @Summary      List users
// @Description  Returns a paginated list of users with their badges. Supports search by email, username, or full name. Admin authentication required.
// @Tags         Admin-Users
// @Produce      json
// @Security     AdminAuth
// @Param        page    query     int     false  "Page number"      default(1)
// @Param        limit   query     int     false  "Items per page"   default(20)
// @Param        search  query     string  false  "Search by email, username, or full name"
// @Success      200     {object}  handlers.SwaggerAdminUserListResponse
// @Failure      401     {object}  handlers.SwaggerErrorResponse
// @Router       /admin/users [get]
func AdminListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := strings.TrimSpace(c.Query("search"))
	if len(search) > 128 {
		logger.Warn("Admin user search query too long, trimming",
			zap.Int("original_length", len(search)),
		)
		search = search[:128]
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	buildUsersQuery := func() *ent.UserQuery {
		query := database.GetEntClient().User.Query()
		if search != "" {
			query = query.Where(user.Or(
				user.EmailContainsFold(search),
				user.UsernameContainsFold(search),
				user.FullNameContainsFold(search),
			))
		}
		return query
	}

	count, countErr := buildUsersQuery().Count(c.Request.Context())
	if countErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengambil data user"},
		})
		return
	}
	total := int64(count)

	users, usersErr := buildUsersQuery().
		Offset(offset).
		Limit(limit).
		Order(ent.Desc(user.FieldCreatedAt)).
		WithPrimaryBadge().
		All(c.Request.Context())
	if usersErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengambil data user"},
		})
		return
	}

	// Prepare response with user badges
	type UserWithBadges struct {
		ID           uint             `json:"id"`
		Email        string           `json:"email"`
		Username     *string          `json:"username"`
		AvatarURL    string           `json:"avatar_url"`
		CreatedAt    time.Time        `json:"created_at"`
		PrimaryBadge *services.Badge  `json:"primary_badge"`
		Badges       []services.Badge `json:"badges"`
	}

	userBadgeMap := make(map[int][]services.Badge, len(users))
	if len(users) > 0 {
		userIDs := make([]int, 0, len(users))
		for _, u := range users {
			userIDs = append(userIDs, u.ID)
		}

		userBadges, err := database.GetEntClient().UserBadge.Query().
			Where(
				userbadge.UserIDIn(userIDs...),
				userbadge.RevokedAtIsNil(),
			).
			WithBadge().
			All(c.Request.Context())
		if err == nil {
			for _, ub := range userBadges {
				if ub.Edges.Badge == nil {
					continue
				}
				mb := services.Badge{
					Name:        ub.Edges.Badge.Name,
					Slug:        ub.Edges.Badge.Slug,
					Description: ub.Edges.Badge.Description,
					IconType:    ub.Edges.Badge.IconType,
					Color:       ub.Edges.Badge.Color,
				}
				mb.ID = uint(ub.Edges.Badge.ID)
				userBadgeMap[ub.UserID] = append(userBadgeMap[ub.UserID], mb)
			}
		} else {
			logger.Warn("Failed to fetch user badges in bulk for admin list",
				zap.Error(err),
				zap.Int("user_count", len(userIDs)),
			)
		}
	}

	var result []UserWithBadges
	for _, u := range users {
		uwb := UserWithBadges{
			ID:        uint(u.ID),
			Email:     u.Email,
			Username:  u.Username,
			AvatarURL: u.AvatarURL,
			CreatedAt: u.CreatedAt,
		}

		// Get primary badge if set using eager loaded data
		if u.Edges.PrimaryBadge != nil {
			pb := services.Badge{
				Name:        u.Edges.PrimaryBadge.Name,
				Slug:        u.Edges.PrimaryBadge.Slug,
				Description: u.Edges.PrimaryBadge.Description,
				IconType:    u.Edges.PrimaryBadge.IconType,
				Color:       u.Edges.PrimaryBadge.Color,
			}
			pb.ID = uint(u.Edges.PrimaryBadge.ID)
			uwb.PrimaryBadge = &pb
		}

		if badges, ok := userBadgeMap[u.ID]; ok {
			uwb.Badges = badges
		}

		result = append(result, uwb)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": result,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// AdminGetUser godoc
// @Summary      Get user detail
// @Description  Returns detailed user info including all badges (active and revoked). Admin authentication required.
// @Tags         Admin-Users
// @Produce      json
// @Security     AdminAuth
// @Param        userId  path      int  true  "User ID"
// @Success      200     {object}  handlers.SwaggerAdminUserDetailResponse
// @Failure      400     {object}  handlers.SwaggerErrorResponse
// @Failure      401     {object}  handlers.SwaggerErrorResponse
// @Failure      404     {object}  handlers.SwaggerErrorResponse
// @Router       /admin/users/{userId} [get]
func AdminGetUser(c *gin.Context) {
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID user tidak valid"},
		})
		return
	}

	// Get user using Ent
	entUser, err := database.GetEntClient().User.Get(c.Request.Context(), int(userID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Get user's badges (including revoked for admin view)
	userBadges, err := database.GetEntClient().UserBadge.Query().
		Where(userbadge.UserIDEQ(int(userID))).
		WithBadge().
		Order(ent.Desc(userbadge.FieldGrantedAt)).
		All(c.Request.Context())
	if err != nil {
		userBadges = []*ent.UserBadge{}
	}

	// Build badges response
	var badgesResponse []gin.H
	for _, ub := range userBadges {
		badgesResponse = append(badgesResponse, gin.H{
			"id":         ub.ID,
			"user_id":    ub.UserID,
			"badge_id":   ub.BadgeID,
			"reason":     ub.Reason,
			"granted_by": ub.GrantedBy,
			"granted_at": ub.GrantedAt,
			"revoked_at": ub.RevokedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":               entUser.ID,
			"email":            entUser.Email,
			"username":         entUser.Username,
			"full_name":        entUser.FullName,
			"bio":              entUser.Bio,
			"avatar_url":       entUser.AvatarURL,
			"pronouns":         entUser.Pronouns,
			"company":          entUser.Company,
			"telegram":         entUser.Telegram,
			"primary_badge_id": entUser.PrimaryBadgeID,
		},
		"badges": badgesResponse,
	})
}

// ==================== Observed Devices ====================

// AdminListObservedDevices godoc
// @Summary      List observed devices
// @Description  Returns a paginated list of observed device fingerprints with associated user mappings. Admin authentication required.
// @Tags         Admin-Devices
// @Produce      json
// @Security     AdminAuth
// @Param        page      query     int     false  "Page number"      default(1)
// @Param        pageSize  query     int     false  "Items per page"   default(50)
// @Param        search    query     string  false  "Search by fingerprint hash or user ID"
// @Success      200       {object}  handlers.SwaggerAdminObservedDevicesResponse
// @Failure      401       {object}  handlers.SwaggerErrorResponse
// @Router       /admin/observed-devices [get]
// AdminListObservedDevices returns a paginated list of observed device fingerprints.
// GET /admin/observed-devices?page=1&pageSize=50&search=...
func AdminListObservedDevices(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	search := strings.TrimSpace(c.Query("search"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	client := database.GetEntClient()
	ctx := c.Request.Context()

	// Build base query
	buildQuery := func() *ent.DeviceFingerprintQuery {
		q := client.DeviceFingerprint.Query().
			Where(devicefingerprint.DeletedAtIsNil())
		if search != "" {
			// Search by fingerprint hash or user ID (as string)
			searchID, idErr := strconv.Atoi(search)
			if idErr == nil {
				// If the search string is numeric, also match user_id
				q = q.Where(devicefingerprint.Or(
					devicefingerprint.FingerprintHashContainsFold(search),
					devicefingerprint.UserIDEQ(searchID),
				))
			} else {
				q = q.Where(devicefingerprint.FingerprintHashContainsFold(search))
			}
		}
		return q
	}

	total, err := buildQuery().Count(ctx)
	if err != nil {
		logger.Error("Failed to count observed devices", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "SRV001",
			"message": "Gagal mengambil data observed devices",
		})
		return
	}

	devices, err := buildQuery().
		Offset(offset).
		Limit(pageSize).
		Order(ent.Desc(devicefingerprint.FieldLastSeenAt)).
		All(ctx)
	if err != nil {
		logger.Error("Failed to query observed devices", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "SRV001",
			"message": "Gagal mengambil data observed devices",
		})
		return
	}

	// Collect all fingerprint hashes for bulk user mapping lookup
	fpHashes := make([]string, 0, len(devices))
	for _, d := range devices {
		fpHashes = append(fpHashes, d.FingerprintHash)
	}

	// Fetch all user mappings for these fingerprints in one query
	userMappingMap := make(map[string][]int)
	if len(fpHashes) > 0 {
		mappings, err := client.DeviceUserMapping.Query().
			Where(
				deviceusermapping.FingerprintHashIn(fpHashes...),
				deviceusermapping.DeletedAtIsNil(),
			).
			All(ctx)
		if err != nil {
			logger.Warn("Failed to fetch device user mappings", zap.Error(err))
		} else {
			for _, m := range mappings {
				userMappingMap[m.FingerprintHash] = append(userMappingMap[m.FingerprintHash], m.UserID)
			}
		}
	}

	// Build response
	type ObservedDevice struct {
		FingerprintHash string    `json:"fingerprint_hash"`
		AccountCount    int       `json:"account_count"`
		Blocked         bool      `json:"blocked"`
		BlockReason     string    `json:"block_reason"`
		LastSeenAt      time.Time `json:"last_seen_at"`
		IPAddress       string    `json:"ip_address"`
		UserAgent       string    `json:"user_agent"`
		UserIDs         []int     `json:"user_ids"`
	}

	items := make([]ObservedDevice, 0, len(devices))
	for _, d := range devices {
		userIDs := userMappingMap[d.FingerprintHash]
		if userIDs == nil {
			userIDs = []int{}
		}
		items = append(items, ObservedDevice{
			FingerprintHash: d.FingerprintHash,
			AccountCount:    d.AccountCount,
			Blocked:         d.Blocked,
			BlockReason:     d.BlockReason,
			LastSeenAt:      d.LastSeenAt,
			IPAddress:       d.IPAddress,
			UserAgent:       d.UserAgent,
			UserIDs:         userIDs,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"devices":  items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}
