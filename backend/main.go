package main

import (
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
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

func buildCORSConfig() cors.Config {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization", "X-Sudo-Token"}
	corsConfig.AllowCredentials = true

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
	if frontend == "" {
		frontend = "https://aivalid.id"
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

func getEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		logger.Warn("Invalid integer env value, using default",
			zap.String("key", key),
			zap.String("value", raw),
			zap.Int("default", fallback),
		)
		return fallback
	}

	return value
}

func getEnvPositiveInt(key string, fallback int) int {
	value := getEnvInt(key, fallback)
	if value <= 0 {
		logger.Warn("Non-positive integer env value is not allowed, using default",
			zap.String("key", key),
			zap.Int("value", value),
			zap.Int("default", fallback),
		)
		return fallback
	}
	return value
}

func getEnvBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.ParseBool(raw)
	if err != nil {
		logger.Warn("Invalid boolean env value, using default",
			zap.String("key", key),
			zap.String("value", raw),
			zap.Bool("default", fallback),
		)
		return fallback
	}

	return value
}

func getEnvCSV(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		clean := strings.TrimSpace(part)
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		out = append(out, clean)
	}

	return out
}

func buildRateLimitConfig() middleware.RateLimitConfig {
	cfg := middleware.DefaultRateLimitConfig()

	cfg.RequestsPerMinute = getEnvPositiveInt("RATE_LIMIT_REQUESTS_PER_MINUTE", cfg.RequestsPerMinute)
	cfg.RequestsPerHour = getEnvPositiveInt("RATE_LIMIT_REQUESTS_PER_HOUR", cfg.RequestsPerHour)
	cfg.AuthRequestsPerMinute = getEnvPositiveInt("RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE", cfg.AuthRequestsPerMinute)
	cfg.AuthRequestsPerHour = getEnvPositiveInt("RATE_LIMIT_AUTH_REQUESTS_PER_HOUR", cfg.AuthRequestsPerHour)
	cfg.SearchRequestsPerMinute = getEnvPositiveInt("RATE_LIMIT_SEARCH_REQUESTS_PER_MINUTE", cfg.SearchRequestsPerMinute)
	cfg.EnableIPLimit = getEnvBool("RATE_LIMIT_ENABLE_IP_LIMIT", cfg.EnableIPLimit)
	cfg.EnableUserLimit = getEnvBool("RATE_LIMIT_ENABLE_USER_LIMIT", cfg.EnableUserLimit)

	if whitelist := getEnvCSV("RATE_LIMIT_WHITELIST_IPS"); len(whitelist) > 0 {
		cfg.WhitelistIPs = whitelist
	}
	if blacklist := getEnvCSV("RATE_LIMIT_BLACKLIST_IPS"); len(blacklist) > 0 {
		cfg.BlacklistIPs = blacklist
	}

	return cfg
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

	logger.Info("Starting AIValid Backend Server")

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

	// Initialize device tracker (must be before auth service)
	services.InitEntDeviceTracker()

	// Initialize geo lookup service for impossible travel detection
	services.InitGeoLookupService()

	// Initialize Feature Service device ban checker
	deviceBanChecker := services.NewFeatureServiceDeviceBanChecker(config.FeatureServiceURL, config.ServiceToken)
	services.SetDeviceBanChecker(deviceBanChecker)

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

	// Use Ent-based Validation Case service exclusively
	var caseService services.ValidationCaseServiceInterface
	caseService = services.NewEntValidationCaseService()
	logger.Info("Using Ent ORM for ValidationCaseService")
	workflowService := services.NewEntValidationCaseWorkflowService()
	ownerResponseSLAWorker := services.NewOwnerResponseSLAWorker(workflowService)
	ownerResponseSLAWorker.Start()
	defer ownerResponseSLAWorker.Stop()

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
		rpName = "AIValid"
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
	caseHandler := handlers.NewValidationCaseHandler(caseService)
	workflowHandler := handlers.NewValidationCaseWorkflowHandler(workflowService)
	totpHandler := handlers.NewTOTPHandler(totpServiceWrapper, logger.GetLogger())
	passkeyHandler := handlers.NewPasskeyHandler(passkeyService, authServiceWrapper, logger.GetLogger())
	sudoHandler := handlers.NewEntSudoHandler(sudoEntService, logger.GetLogger())
	sudoValidator := services.NewSudoValidatorAdapter(sudoEntService)
	// Financial features are handled by the ASP.NET service; keep Go focused on core identity/content.

	// Verify all handlers are properly initialized
	if authHandler == nil || caseHandler == nil || workflowHandler == nil || userHandler == nil {
		logger.Fatal("Failed to initialize handlers")
	}

	router := gin.Default()
	// SECURITY: Gin trusts all proxies by default (unsafe). Trust only explicit proxies instead.
	// Default: loopback only, which is correct for a VPS behind Nginx on the same host.
	trustedProxiesEnv := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	var trustedProxies []string
	switch strings.ToLower(trustedProxiesEnv) {
	case "", "default":
		trustedProxies = []string{"127.0.0.1", "::1"}
	case "none", "off", "disabled":
		trustedProxies = nil // Disable forwarded IP handling entirely.
	default:
		for _, part := range strings.Split(trustedProxiesEnv, ",") {
			clean := strings.TrimSpace(part)
			if clean == "" {
				continue
			}
			trustedProxies = append(trustedProxies, clean)
		}
	}
	if err := router.SetTrustedProxies(trustedProxies); err != nil {
		logger.Fatal("Failed to configure trusted proxies", zap.Error(err))
	}
	logger.Info("Trusted proxies configured", zap.Strings("trusted_proxies", trustedProxies))

	// Basic request size limits to reduce DoS blast-radius (per-endpoint checks still apply).
	router.Use(middleware.JSONRequestSizeLimitMiddleware())
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(cors.New(buildCORSConfig()))
	// Serve file statis: /static/...
	router.Static("/static", "./public")

	rateLimitConfig := buildRateLimitConfig()
	enhancedRateLimiter := middleware.NewEnhancedRateLimiter(rateLimitConfig)
	// Inject shared Redis client into limiters without creating package import cycles.
	// Kept in main so middleware package stays independent from services package.
	enhancedRateLimiter.SetRedisClient(services.RedisClient)
	deleteAccountLimiter.SetRedisClient(services.RedisClient)
	logger.Info("Enhanced rate limiter configured",
		zap.Int("requests_per_minute", rateLimitConfig.RequestsPerMinute),
		zap.Int("requests_per_hour", rateLimitConfig.RequestsPerHour),
		zap.Int("auth_requests_per_minute", rateLimitConfig.AuthRequestsPerMinute),
		zap.Int("auth_requests_per_hour", rateLimitConfig.AuthRequestsPerHour),
		zap.Bool("enable_ip_limit", rateLimitConfig.EnableIPLimit),
		zap.Bool("enable_user_limit", rateLimitConfig.EnableUserLimit),
		zap.Strings("whitelist_ips", rateLimitConfig.WhitelistIPs),
		zap.Strings("blacklist_ips", rateLimitConfig.BlacklistIPs),
		zap.Bool("redis_rate_limit_enabled", services.RedisClient != nil),
	)

	// Health endpoints are kept outside request rate limits.
	// Also exposed at root because production deployment scripts curl /health directly.
	router.GET("/health", handlers.HealthHandler)
	router.GET("/ready", handlers.ReadinessHandler)

	api := router.Group("/api")
	{
		api.GET("/health", handlers.HealthHandler)
		api.GET("/ready", handlers.ReadinessHandler)

		// Keep health/readiness outside request rate limits.
		apiRateLimited := api.Group("")
		apiRateLimited.Use(enhancedRateLimiter.Middleware())
		{
			auth := apiRateLimited.Group("/auth")
			{
				authSensitive := auth.Group("")
				authSensitive.Use(enhancedRateLimiter.AuthMiddleware())
				authSensitive.POST("/register", authHandler.Register)
				authSensitive.POST("/login", authHandler.Login)
				authSensitive.POST("/login/totp", authHandler.LoginTOTP)
				authSensitive.POST("/login/backup-code", authHandler.LoginBackupCode)
				authSensitive.POST("/refresh", authHandler.RefreshToken)
				authSensitive.POST("/logout", authHandler.Logout)
				authSensitive.POST("/verify/request", authHandler.RequestVerification)
				authSensitive.POST("/verify/confirm", authHandler.ConfirmVerification)
				authSensitive.POST("/forgot-password", authHandler.ForgotPassword)
				authSensitive.POST("/reset-password", authHandler.ResetPassword)

				auth.POST("/logout-all", middleware.AuthMiddleware(), authHandler.LogoutAll)
				auth.GET("/sessions", middleware.AuthMiddleware(), authHandler.GetActiveSessions)
				auth.DELETE("/sessions/:id", middleware.AuthMiddleware(), authHandler.RevokeSession)
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
					passkeysPublic := passkeys.Group("")
					passkeysPublic.Use(enhancedRateLimiter.AuthMiddleware())
					passkeysPublic.POST("/check", passkeyHandler.CheckPasskeys)
					passkeysPublic.POST("/login/begin", passkeyHandler.BeginLogin)
					passkeysPublic.POST("/login/finish", passkeyHandler.FinishLogin)

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

			account := apiRateLimited.Group("/account")
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

			user := apiRateLimited.Group("/user")
			{
				user.GET("/me", middleware.AuthMiddleware(), userHandler.GetUserInfo)
				user.GET("/:username", userHandler.GetPublicUserProfile)
				user.GET("/:username/validation-cases", enhancedRateLimiter.SearchMiddleware(), caseHandler.GetValidationCasesByUsername)
				user.GET("/:username/badges", handlers.GetUserBadgesHandler)
			}

			// Internal API for service-to-service calls
			users := apiRateLimited.Group("/users")
			{
				users.GET("/:id/public", userHandler.GetPublicUserProfileByID)
			}

			// Internal API protected by service token
			internal := apiRateLimited.Group("/internal")
			internal.Use(middleware.InternalServiceAuth())
			{
				internal.PUT("/users/:id/guarantee", userHandler.UpdateGuaranteeAmount)
				internal.GET("/users/:id/consultation-locks", workflowHandler.InternalGetValidatorConsultationLocks)
				// Feature-service callback: finalize Validation Case after escrow is auto-released.
				internal.POST("/validation-cases/escrow/released", workflowHandler.InternalMarkEscrowReleasedByTransfer)
			}

			validationCases := apiRateLimited.Group("/validation-cases")
			{
				validationCases.GET("/categories", caseHandler.GetCategories)
				validationCases.GET("/category/:slug", caseHandler.GetValidationCasesByCategory)
				validationCases.GET("/latest", enhancedRateLimiter.SearchMiddleware(), caseHandler.GetLatestValidationCases)
				validationCases.GET("/:id/public", caseHandler.GetPublicValidationCaseDetail)
				validationCases.GET("/:id", middleware.AuthMiddleware(), caseHandler.GetValidationCaseDetail)
				validationCases.POST("", middleware.AuthMiddleware(), caseHandler.CreateValidationCase)
				validationCases.GET("/me", middleware.AuthMiddleware(), caseHandler.GetMyValidationCases)
				validationCases.PUT("/:id", middleware.AuthMiddleware(), caseHandler.UpdateValidationCase)
				validationCases.DELETE("/:id", middleware.AuthMiddleware(), caseHandler.DeleteValidationCase)
				// Validation Case tags
				validationCases.GET("/:id/tags", handlers.GetValidationCaseTagsHandler)
				validationCases.POST("/:id/tags", middleware.AuthMiddleware(), handlers.AddTagsToValidationCaseHandler)
				validationCases.DELETE("/:id/tags/:tagSlug", middleware.AuthMiddleware(), handlers.RemoveTagFromValidationCaseHandler)
				// Validation Protocol workflow
				validationCases.POST("/:id/consultation-requests", middleware.AuthMiddleware(), workflowHandler.RequestConsultation)
				validationCases.GET("/:id/consultation-requests", middleware.AuthMiddleware(), workflowHandler.ListConsultationRequests)
				validationCases.GET("/:id/consultation-requests/me", middleware.AuthMiddleware(), workflowHandler.GetMyConsultationRequest)
				validationCases.POST("/:id/consultation-requests/:requestId/approve", middleware.AuthMiddleware(), workflowHandler.ApproveConsultationRequest)
				validationCases.POST("/:id/consultation-requests/:requestId/reject", middleware.AuthMiddleware(), workflowHandler.RejectConsultationRequest)
				validationCases.POST("/:id/clarification/request", middleware.AuthMiddleware(), workflowHandler.RequestOwnerClarificationFromValidator)
				validationCases.POST("/:id/consultation-requests/:requestId/clarification/request", middleware.AuthMiddleware(), workflowHandler.RequestOwnerClarification)
				validationCases.POST("/:id/consultation-requests/:requestId/clarification/respond", middleware.AuthMiddleware(), workflowHandler.RespondOwnerClarification)
				validationCases.GET("/:id/contact", middleware.AuthMiddleware(), workflowHandler.RevealContact)

				validationCases.POST("/:id/final-offers", middleware.AuthMiddleware(), workflowHandler.SubmitFinalOffer)
				validationCases.GET("/:id/final-offers", middleware.AuthMiddleware(), workflowHandler.ListFinalOffers)
				validationCases.POST("/:id/final-offers/:offerId/accept", middleware.AuthMiddleware(), workflowHandler.AcceptFinalOffer)

				validationCases.POST("/:id/lock-funds", middleware.AuthMiddleware(), workflowHandler.ConfirmLockFunds)
				validationCases.POST("/:id/artifact-submission", middleware.AuthMiddleware(), workflowHandler.SubmitArtifact)
				validationCases.POST("/:id/escrow/released", middleware.AuthMiddleware(), workflowHandler.MarkEscrowReleased)
				validationCases.POST("/:id/dispute/attach", middleware.AuthMiddleware(), workflowHandler.AttachDispute)

				validationCases.GET("/:id/case-log", middleware.AuthMiddleware(), workflowHandler.GetCaseLog)
			}

			// Tags endpoints
			tags := apiRateLimited.Group("/tags")
			{
				tags.GET("", handlers.GetAllTagsHandler)
				tags.GET("/:slug", handlers.GetTagBySlugHandler)
				tags.GET("/:slug/validation-cases", enhancedRateLimiter.SearchMiddleware(), handlers.GetValidationCasesByTagHandler)
			}

			// Financial endpoints are handled by the ASP.NET service; omitted here to keep responsibilities separated.

			badges := apiRateLimited.Group("/badges")
			{
				badges.GET("/:id", handlers.GetBadgeDetailHandler)
			}

			// Account badge settings (authenticated)
			account.GET("/badges", middleware.AuthMiddleware(), handlers.GetMyBadges)
			account.PUT("/primary-badge", middleware.AuthMiddleware(), handlers.SetPrimaryBadge)
		}

	}

	// Admin routes (separate auth)
	admin := router.Group("/admin")
	admin.Use(enhancedRateLimiter.Middleware())
	{
		admin.POST("/auth/login", enhancedRateLimiter.AuthMiddleware(), handlers.AdminLogin)

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
			adminProtected.GET("/users", enhancedRateLimiter.SearchMiddleware(), handlers.AdminListUsers)
			adminProtected.GET("/users/:userId", handlers.AdminGetUser)
			adminProtected.POST("/users/:userId/badges", handlers.AssignBadgeToUser)
			adminProtected.DELETE("/users/:userId/badges/:badgeId", handlers.RevokeBadgeFromUser)

			// Category management (admin only)
			adminProtected.GET("/categories", handlers.AdminListCategories)
			// Validation Case management (admin only)
			adminProtected.POST("/validation-cases/:id/move", handlers.AdminMoveValidationCase)

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

	server := &http.Server{
		Addr:              listenAddr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MiB
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("Failed to start server: ", err)
	}
}
