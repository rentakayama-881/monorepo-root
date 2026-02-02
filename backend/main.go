package main

import (
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/handlers"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/services"
	"backend-gin/utils"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

func init() {
	// Set Gin mode based on environment variable
	// GIN_MODE can be: "debug", "release", or "test"
	mode := os.Getenv("GIN_MODE")
	if mode == "" {
		mode = gin.ReleaseMode // Default to release mode in production
	}
	gin.SetMode(mode)
}

// Delete account rate limiter: 3 attempts per hour
var deleteAccountLimiter = middleware.NewRateLimiter(3, time.Hour)

// AI Explain rate limiter: 2 requests per minute per IP
var aiExplainLimiter = middleware.NewRateLimiter(2, time.Minute)

// DeleteAccountRateLimit is a middleware that rate limits delete account requests
func DeleteAccountRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !deleteAccountLimiter.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Terlalu banyak percobaan. Silakan coba lagi dalam 1 jam.",
			})
			return
		}
		c.Next()
	}
}

// AIExplainRateLimit is a middleware that rate limits AI explain requests (2/min)
func AIExplainRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !aiExplainLimiter.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Terlalu banyak permintaan AI. Silakan tunggu 1 menit sebelum mencoba lagi.",
			})
			return
		}
		c.Next()
	}
}

func buildCORSConfig() cors.Config {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization", "X-Sudo-Token"}

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
	if frontend == "" {
		frontend = "https://alephdraad.fun"
	}

	allowedOriginsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	var rawOrigins []string
	if allowedOriginsEnv != "" {
		rawOrigins = strings.Split(allowedOriginsEnv, ",")
	} else {
		rawOrigins = []string{frontend}
	}

	allowedSet := map[string]struct{}{}
	allowedList := []string{}
	for _, origin := range rawOrigins {
		clean := strings.TrimSpace(origin)
		if clean == "" {
			continue
		}
		if _, exists := allowedSet[clean]; exists {
			continue
		}
		allowedSet[clean] = struct{}{}
		allowedList = append(allowedList, clean)
	}

	corsConfig.AllowOrigins = allowedList
	corsConfig.AllowOriginFunc = func(origin string) bool {
		if origin == "" {
			return true
		}
		_, ok := allowedSet[origin]
		return ok
	}

	return corsConfig
}

func expandWWWOrigins(origin string) []string {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return []string{origin}
	}

	host := parsed.Hostname()
	port := parsed.Port()
	if host == "" {
		return []string{origin}
	}

	variants := []string{origin}
	addVariant := func(h string) {
		u := *parsed
		if port != "" {
			u.Host = h + ":" + port
		} else {
			u.Host = h
		}
		variants = append(variants, u.String())
	}

	if strings.HasPrefix(host, "www.") {
		bare := strings.TrimPrefix(host, "www.")
		if bare != "" {
			addVariant(bare)
		}
	} else if len(strings.Split(host, ".")) == 2 {
		addVariant("www." + host)
	}

	return variants
}

func deriveRPOrigins() []string {
	var rawOrigins []string
	originsEnv := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ORIGINS"))
	if originsEnv != "" {
		rawOrigins = strings.Split(originsEnv, ",")
	} else {
		rpOrigin := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ORIGIN"))
		if rpOrigin == "" {
			rpOrigin = strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
			if rpOrigin == "" {
				rpOrigin = "http://localhost:3000"
			}
		}
		rawOrigins = []string{rpOrigin}
	}

	originSet := map[string]struct{}{}
	origins := []string{}
	for _, origin := range rawOrigins {
		clean := strings.TrimSpace(origin)
		if clean == "" {
			continue
		}
		for _, candidate := range expandWWWOrigins(clean) {
			if candidate == "" {
				continue
			}
			if _, exists := originSet[candidate]; exists {
				continue
			}
			originSet[candidate] = struct{}{}
			origins = append(origins, candidate)
		}
	}

	if len(origins) == 0 {
		return []string{"http://localhost:3000"}
	}

	return origins
}

func main() {
	err := godotenv.Load()
	if err != nil {
		// Environment file not found - this is acceptable in production with env vars set directly
		_ = err
	}

	// Validate required environment variables
	if os.Getenv("ADMIN_JWT_SECRET") == "" {
		log.Fatal("FATAL: ADMIN_JWT_SECRET environment variable is required")
	}

	// Initialize logger
	logger.InitLogger()
	defer func() { _ = logger.Log.Sync() }()

	logger.Info("Starting Alephdraad Backend Server")

	// Initialize Email Queue with 3 workers for async email sending
	utils.InitEmailQueue(3)
	defer utils.GetEmailQueue().Shutdown()

	// Initialize Ent database (new ORM)
	database.InitEntDB()
	defer database.CloseEntDB()

	// Initialize Redis (optional - graceful degradation if unavailable)
	if err := services.InitRedis(); err != nil {
		logger.Info("Redis not available - using in-memory rate limiting", zap.String("note", "This is acceptable for development"))
	} else {
		defer services.CloseRedis()
	}

	config.InitConfig()
	// Initialize services (Ent)
	services.InitEmailRateLimiter()
	authEntService := services.NewEntAuthService()
	sessionEntService := services.NewEntSessionService()
	totpEntService := services.NewEntTOTPService(logger.GetLogger())
	sudoEntService := services.NewEntSudoService(logger.GetLogger(), totpEntService)

	// Create service wrappers for handler compatibility
	authServiceWrapper := services.NewAuthServiceWrapper(authEntService)
	sessionServiceWrapper := services.NewSessionServiceWrapper(sessionEntService)
	totpServiceWrapper := services.NewTOTPServiceWrapper(totpEntService)

	// Use Ent-based ThreadService exclusively
	var threadService services.ThreadServiceInterface
	threadService = services.NewEntThreadService()
	logger.Info("Using Ent ORM for ThreadService")

	// Initialize passkey service with WebAuthn config
	rpID := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ID"))
	rpOrigins := deriveRPOrigins()
	if rpID == "" {
		rpID = "localhost"
		if len(rpOrigins) > 0 {
			if parsed, err := url.Parse(rpOrigins[0]); err == nil && parsed.Hostname() != "" {
				rpID = parsed.Hostname()
			}
		}
	}
	rpName := os.Getenv("WEBAUTHN_RP_NAME")
	if rpName == "" {
		rpName = "Alephdraad"
	}
	passkeyService, err := services.NewEntPasskeyService(logger.GetLogger(), rpID, rpOrigins, rpName)
	if err != nil {
		logger.Fatal("Failed to initialize passkey service", zap.Error(err))
	}

	// Initialize handlers
	userEntService := services.NewEntUserService()
	userHandler := handlers.NewUserHandler(userEntService)

	// Use service wrappers for handlers expecting legacy interfaces
	authHandler := handlers.NewAuthHandler(authServiceWrapper, sessionServiceWrapper)
	threadHandler := handlers.NewThreadHandler(threadService)
	totpHandler := handlers.NewTOTPHandler(totpServiceWrapper, logger.GetLogger())
	passkeyHandler := handlers.NewPasskeyHandler(passkeyService, authServiceWrapper, logger.GetLogger())
	sudoHandler := handlers.NewEntSudoHandler(sudoEntService, logger.GetLogger())
	sudoValidator := services.NewSudoValidatorAdapter(sudoEntService)
	// Financial features are handled by the ASP.NET service; keep Go focused on core identity/content.

	// Verify all handlers are properly initialized
	if authHandler == nil || threadHandler == nil || userHandler == nil {
		logger.Fatal("Failed to initialize handlers")
	}

	router := gin.Default()
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(cors.New(buildCORSConfig()))
	// Serve file statis: /static/...
	router.Static("/static", "./public")

	api := router.Group("/api")
	{
		api.GET("/health", handlers.HealthHandler)
		api.GET("/ready", handlers.ReadinessHandler)

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/login/totp", authHandler.LoginTOTP)
			auth.POST("/login/backup-code", authHandler.LoginBackupCode)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/logout", authHandler.Logout)
			auth.POST("/logout-all", middleware.AuthMiddleware(), authHandler.LogoutAll)
			auth.GET("/sessions", middleware.AuthMiddleware(), authHandler.GetActiveSessions)
			auth.DELETE("/sessions/:id", middleware.AuthMiddleware(), authHandler.RevokeSession)
			auth.POST("/verify/request", authHandler.RequestVerification)
			auth.POST("/verify/confirm", authHandler.ConfirmVerification)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
			auth.POST("/username", middleware.AuthMiddleware(), handlers.CreateUsernameHandler)

			// TOTP / 2FA routes
			totp := auth.Group("/totp")
			totp.Use(middleware.AuthMiddleware())
			{
				totp.GET("/status", totpHandler.GetStatus)
				totp.POST("/setup", totpHandler.Setup)
				totp.POST("/verify", totpHandler.Verify) // Returns backup codes on first enable
				totp.POST("/verify-code", totpHandler.VerifyCode)
				totp.POST("/disable", totpHandler.Disable)
				// NOTE: POST /backup-codes removed for security - backup codes only generated during TOTP enable
				totp.GET("/backup-codes/count", totpHandler.GetBackupCodeCount)
			}

			// Passkey / WebAuthn routes
			passkeys := auth.Group("/passkeys")
			{
				// Public endpoints (for login)
				passkeys.POST("/check", passkeyHandler.CheckPasskeys)
				passkeys.POST("/login/begin", passkeyHandler.BeginLogin)
				passkeys.POST("/login/finish", passkeyHandler.FinishLogin)

				// Protected endpoints (for registration/management)
				passkeys.Use(middleware.AuthMiddleware())
				passkeys.GET("/status", passkeyHandler.GetStatus)
				passkeys.GET("", passkeyHandler.ListPasskeys)
				passkeys.POST("/register/begin", passkeyHandler.BeginRegistration)
				passkeys.POST("/register/finish", passkeyHandler.FinishRegistration)
				passkeys.DELETE("/:id", passkeyHandler.DeletePasskey)
				passkeys.PUT("/:id/name", passkeyHandler.RenamePasskey)
			}

			// Sudo mode routes (re-authentication for critical actions)
			sudo := auth.Group("/sudo")
			sudo.Use(middleware.AuthMiddleware())
			{
				sudo.POST("/verify", sudoHandler.Verify)
				sudo.GET("/status", sudoHandler.GetStatus)
				sudo.POST("/extend", sudoHandler.Extend)
				sudo.DELETE("", sudoHandler.Revoke)
			}
		}

		account := api.Group("/account")
		{
			account.GET("/me", middleware.AuthMiddleware(), handlers.GetMyAccountHandler)
			account.PUT("", middleware.AuthMiddleware(), handlers.UpdateMyAccountHandler)
			account.POST("/change-username", middleware.AuthMiddleware(), handlers.ChangeUsernamePaidHandler)
			account.PUT("/avatar", middleware.AuthMiddleware(), handlers.UploadAvatarHandler)
			account.DELETE("/avatar", middleware.AuthMiddleware(), handlers.DeleteAvatarHandler)
			// Check if user can delete account (validates wallet balance, pending transfers, disputes)
			account.GET("/can-delete", middleware.AuthMiddleware(), handlers.CanDeleteAccountHandler)
			// Delete account requires sudo mode
			account.DELETE("", middleware.AuthMiddleware(), DeleteAccountRateLimit(), middleware.RequireSudo(sudoValidator), handlers.DeleteAccountHandler)
		}

		user := api.Group("/user")
		{
			user.GET("/me", middleware.AuthMiddleware(), userHandler.GetUserInfo)
			user.GET("/:username", userHandler.GetPublicUserProfile)
			user.GET("/:username/threads", threadHandler.GetThreadsByUsername)
			user.GET("/:username/badges", handlers.GetUserBadgesHandler)
		}

		// Internal API for service-to-service calls
		users := api.Group("/users")
		{
			users.GET("/:id/public", userHandler.GetPublicUserProfileByID)
		}

		threads := api.Group("/threads")
		{
			threads.GET("/categories", threadHandler.GetCategories)
			threads.GET("/category/:slug", threadHandler.GetThreadsByCategory)
			threads.GET("/latest", threadHandler.GetLatestThreads)
			threads.GET("/:id/public", threadHandler.GetPublicThreadDetail)
			threads.GET("/:id", middleware.AuthMiddleware(), threadHandler.GetThreadDetail)
			threads.POST("", middleware.AuthMiddleware(), threadHandler.CreateThread)
			threads.GET("/me", middleware.AuthMiddleware(), threadHandler.GetMyThreads)
			threads.PUT("/:id", middleware.AuthMiddleware(), threadHandler.UpdateThread)
			threads.DELETE("/:id", middleware.AuthMiddleware(), threadHandler.DeleteThread)
			// Thread tags
			threads.GET("/:id/tags", handlers.GetThreadTagsHandler)
			threads.POST("/:id/tags", middleware.AuthMiddleware(), handlers.AddTagsToThreadHandler)
			threads.DELETE("/:id/tags/:tagSlug", middleware.AuthMiddleware(), handlers.RemoveTagFromThreadHandler)
		}

		// Tags endpoints
		tags := api.Group("/tags")
		{
			tags.GET("", handlers.GetAllTagsHandler)
			tags.GET("/:slug", handlers.GetTagBySlugHandler)
			tags.GET("/:slug/threads", handlers.GetThreadsByTagHandler)
		}

		// Financial endpoints are handled by the ASP.NET service; omitted here to keep responsibilities separated.

		badges := api.Group("/badges")
		{
			badges.GET("/:id", handlers.GetBadgeDetailHandler)
		}

		// Account badge settings (authenticated)
		account.GET("/badges", middleware.AuthMiddleware(), handlers.GetMyBadges)
		account.PUT("/primary-badge", middleware.AuthMiddleware(), handlers.SetPrimaryBadge)

		// RAG/AI Search endpoints
		// Public: search and explain (read-only)
		router.GET("/api/rag/ask", handlers.AskHandler)
		router.GET("/api/rag/answer", handlers.AnswerHandler)
		router.GET("/api/rag/search-threads", handlers.SearchThreadsHandler)
		router.GET("/api/rag/explain/:id", AIExplainRateLimit(), handlers.ExplainThreadHandler)
	}

	// Admin routes (separate auth)
	admin := router.Group("/admin")
	{
		admin.POST("/auth/login", handlers.AdminLogin)

		// Protected admin routes
		adminProtected := admin.Group("")
		adminProtected.Use(middleware.AdminAuthMiddleware())
		{
			// Badge management
			adminProtected.POST("/badges", handlers.CreateBadge)
			adminProtected.GET("/badges", handlers.ListBadges)
			adminProtected.GET("/badges/:id", handlers.GetBadge)
			adminProtected.PUT("/badges/:id", handlers.UpdateBadge)
			adminProtected.DELETE("/badges/:id", handlers.DeleteBadge)

			// User management
			adminProtected.GET("/users", handlers.AdminListUsers)
			adminProtected.GET("/users/:userId", handlers.AdminGetUser)
			adminProtected.POST("/users/:userId/badges", handlers.AssignBadgeToUser)
			adminProtected.DELETE("/users/:userId/badges/:badgeId", handlers.RevokeBadgeFromUser)

			// Thread management (admin only)
			adminProtected.GET("/categories", handlers.AdminListCategories)
			adminProtected.POST("/threads/:id/move", handlers.AdminMoveThread)

			// RAG indexing (admin only)
			adminProtected.POST("/rag/index-chunk", handlers.IndexChunkHandler)
			adminProtected.POST("/rag/index-long", handlers.IndexLongHandler)
			adminProtected.POST("/rag/index-thread/:id", handlers.IndexThreadByIDHandler)
		}
	}

	// Get port from environment variable
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Bind address for the HTTP server.
	// Best practice: default to loopback so the app is only reachable via Nginx/reverse-proxy.
	bindAddr := strings.TrimSpace(os.Getenv("BIND_ADDR"))
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}

	listenAddr := bindAddr + ":" + port
	logger.Info("Server backend berjalan", zap.String("addr", listenAddr))

	if err := router.Run(listenAddr); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
