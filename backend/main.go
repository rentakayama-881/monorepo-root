package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"backend-gin/buildinfo"
	"backend-gin/config"
	"backend-gin/database"
	_ "backend-gin/docs" // Swagger generated docs
	"backend-gin/handlers"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/services"
	"backend-gin/utils"

	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
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

// @title           AIValid API
// @version         1.0
// @description     API untuk platform validasi hasil kerja AI oleh ahli manusia.
// @termsOfService  https://aivalid.id/rules-content

// @contact.name   AIValid Support
// @contact.url    https://aivalid.id/contact-support

// @license.name  Proprietary

// @host      api.aivalid.id
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @securityDefinitions.apikey AdminAuth
// @in header
// @name Authorization
// @description Admin JWT token. Type "Bearer" followed by a space and admin JWT token.
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

	// Initialize Sentry error tracking (optional — skipped when SENTRY_DSN is empty).
	if dsn := os.Getenv("SENTRY_DSN"); dsn != "" {
		sentryEnv := os.Getenv("SENTRY_ENVIRONMENT")
		if sentryEnv == "" {
			sentryEnv = os.Getenv("APP_ENV")
		}
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              dsn,
			Environment:      sentryEnv,
			Release:          buildinfo.Version,
			TracesSampleRate: getEnvFloat64("SENTRY_TRACES_SAMPLE_RATE", 0.1),
			EnableTracing:    true,
		})
		if err != nil {
			logger.Error("Sentry initialization failed", zap.Error(err))
		} else {
			defer sentry.Flush(2 * time.Second)
			logger.Info("Sentry initialized", zap.String("environment", sentryEnv))
		}
	}

	logger.Info("Starting AIValid Backend Server")

	// Initialize Email Queue with 3 workers for async email sending
	utils.InitEmailQueue(3)
	defer utils.GetEmailQueue().Shutdown()

	// Initialize Ent database (new ORM)
	database.InitEntDB()
	defer database.CloseEntDB()

	config.InitConfig()

	// Initialize device tracker (must be before auth service)
	services.InitEntDeviceTracker()

	// Initialize geo lookup service for impossible travel detection
	services.InitGeoLookupService()

	// Initialize Feature Service device ban checker
	deviceBanChecker := services.NewFeatureServiceDeviceBanChecker(config.FeatureServiceURL, config.ServiceToken)
	services.SetDeviceBanChecker(deviceBanChecker)

	services.InitEmailRateLimiter()
	authEntService := services.NewEntAuthService()
	sessionEntService := services.NewEntSessionService()

	// Session cleanup goroutine — delete expired sessions every hour
	// Prevents DB bloat on Neon free tier (CleanupExpiredSessions exists but was never called)
	sessionCleanupTicker := time.NewTicker(config.SessionCleanupInterval)
	go func() {
		for range sessionCleanupTicker.C {
			ctx, cancel := context.WithTimeout(context.Background(), config.SessionCleanupTimeout)
			affected, err := sessionEntService.CleanupExpiredSessions(ctx)
			cancel()
			if err != nil {
				logger.Error("Session cleanup failed", zap.Error(err))
			} else if affected > 0 {
				logger.Info("Session cleanup completed", zap.Int("deleted", affected))
			}
		}
	}()
	defer sessionCleanupTicker.Stop()

	totpEntService := services.NewEntTOTPService(logger.GetLogger())
	sudoEntService := services.NewEntSudoService(logger.GetLogger(), totpEntService)

	var caseService services.ValidationCaseServiceInterface = services.NewEntValidationCaseService()
	workflowService := services.NewEntValidationCaseWorkflowService()
	repoWorkflowService := services.NewEntValidationCaseRepoWorkflowService()
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

	userEntService := services.NewEntUserService()
	userHandler := handlers.NewUserHandler(userEntService)

	authHandler := handlers.NewAuthHandler(authEntService, sessionEntService)
	caseHandler := handlers.NewValidationCaseHandler(caseService)
	workflowHandler := handlers.NewValidationCaseWorkflowHandler(workflowService)
	repoWorkflowHandler := handlers.NewValidationCaseRepoWorkflowHandler(repoWorkflowService)
	totpHandler := handlers.NewTOTPHandler(totpEntService)
	passkeyHandler := handlers.NewPasskeyHandler(
		passkeyService,
		authEntService,
		services.NewFeatureWalletClientFromConfig(),
		logger.GetLogger(),
	)
	sudoHandler := handlers.NewEntSudoHandler(sudoEntService, logger.GetLogger())
	sudoValidator := services.NewSudoValidatorAdapter(sudoEntService)
	lztMarketClient := services.NewLZTMarketClientFromEnv()
	lztMarketHandler := handlers.NewLZTMarketHandler(lztMarketClient)
	lztMarketHandler.StartBackgroundRefresh()
	// Financial features are handled by the ASP.NET service; keep Go focused on core identity/content.

	// Feature flag service + handler
	featureFlagService := services.NewFeatureFlagService()
	featureFlagHandler := handlers.NewFeatureFlagHandler(featureFlagService)

	// Verify all handlers are properly initialized
	if authHandler == nil || caseHandler == nil || workflowHandler == nil || repoWorkflowHandler == nil || userHandler == nil {
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

	// Sentry request tracking (must be first so it wraps the entire chain).
	router.Use(middleware.SentryMiddleware())
	router.Use(middleware.SentryUserEnrich())

	// Prometheus metrics (after Sentry so panics are recovered before recording).
	router.Use(middleware.PrometheusMiddleware())

	// Basic request size limits to reduce DoS blast-radius (per-endpoint checks still apply).
	router.Use(middleware.JSONRequestSizeLimitMiddleware())
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(cors.New(buildCORSConfig()))
	// Serve file statis: /static/...
	router.Static("/static", "./public")

	rateLimitConfig := buildRateLimitConfig()
	enhancedRateLimiter := middleware.NewEnhancedRateLimiter(rateLimitConfig)
	logger.Info("Enhanced rate limiter configured",
		zap.Int("requests_per_minute", rateLimitConfig.RequestsPerMinute),
		zap.Int("requests_per_hour", rateLimitConfig.RequestsPerHour),
		zap.Int("auth_requests_per_minute", rateLimitConfig.AuthRequestsPerMinute),
		zap.Int("auth_requests_per_hour", rateLimitConfig.AuthRequestsPerHour),
		zap.Bool("enable_ip_limit", rateLimitConfig.EnableIPLimit),
		zap.Bool("enable_user_limit", rateLimitConfig.EnableUserLimit),
		zap.Strings("whitelist_ips", rateLimitConfig.WhitelistIPs),
		zap.Strings("blacklist_ips", rateLimitConfig.BlacklistIPs),
	)

	// Health endpoints are kept outside request rate limits.
	// Also exposed at root because production deployment scripts curl /health directly.
	router.GET("/health", handlers.HealthHandler)
	router.GET("/health/version", handlers.HealthVersionHandler)
	router.GET("/ready", handlers.ReadinessHandler)

	// Prometheus metrics endpoint (outside rate limits, no auth required).
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Swagger API documentation (disabled in production by default).
	if os.Getenv("ENABLE_SWAGGER") == "true" || os.Getenv("GIN_MODE") != "release" {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	deps := routeDeps{
		authHandler:         authHandler,
		caseHandler:         caseHandler,
		workflowHandler:     workflowHandler,
		repoWorkflowHandler: repoWorkflowHandler,
		userHandler:         userHandler,
		totpHandler:         totpHandler,
		passkeyHandler:      passkeyHandler,
		sudoHandler:         sudoHandler,
		sudoValidator:       sudoValidator,
		lztMarketHandler:    lztMarketHandler,
		featureFlagHandler:  featureFlagHandler,
	}

	// registerAPIGroup wires health probes and public routes onto a router group.
	// Used to dual-mount routes under both /api/v1 (versioned) and /api (legacy).
	registerAPIGroup := func(g *gin.RouterGroup) {
		g.GET("/health", handlers.HealthHandler)
		g.GET("/health/version", handlers.HealthVersionHandler)
		g.GET("/ready", handlers.ReadinessHandler)
		registerPublicRoutes(g, enhancedRateLimiter, deps)
	}

	// Versioned API — new clients should target /api/v1.
	registerAPIGroup(router.Group("/api/v1"))

	// Legacy unversioned API — kept for backward compatibility; new clients use /api/v1.
	registerAPIGroup(router.Group("/api"))

	registerAdminRoutes(router, enhancedRateLimiter, lztMarketHandler, featureFlagHandler)

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

	server := &http.Server{
		Addr:              listenAddr,
		Handler:           router,
		ReadHeaderTimeout: config.ServerReadHeaderTimeout,
		ReadTimeout:       config.ServerReadTimeout,
		WriteTimeout:      config.ServerWriteTimeout,
		IdleTimeout:       config.ServerIdleTimeout,
		MaxHeaderBytes:    1 << 20, // 1 MiB
	}

	// Start server in goroutine
	go func() {
		logger.Info("Server backend berjalan", zap.String("addr", listenAddr))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	logger.Info("Received shutdown signal", zap.String("signal", sig.String()))

	// Graceful shutdown with 30 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), config.GracefulShutdownTimeout)
	defer cancel()

	logger.Info("Shutting down server gracefully...")
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", zap.Error(err))
	} else {
		logger.Info("Server stopped gracefully")
	}
}
