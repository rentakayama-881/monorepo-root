package main

import (
	"context"
	"log"
	"net/http"
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
	"backend-gin/worker"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

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
		frontend = "https:alephdraad.fun"
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

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Tidak dapat memuat file .env, pastikan file .env ada di root folder!")
	}

	// Validate required environment variables
	if os.Getenv("ADMIN_JWT_SECRET") == "" {
		log.Fatal("FATAL: ADMIN_JWT_SECRET environment variable is required")
	}

	// Initialize logger
	logger.InitLogger()
	defer func() { _ = logger.Log.Sync() }()

	logger.Info("Starting Alephdraad Backend Server")

	// Initialize database
	database.InitDB()
	config.InitConfig()

	// Initialize services
	services.InitSecurityServices(database.DB) // Initialize security services first
	services.InitEmailRateLimiter()            // Initialize email rate limiter
	authService := services.NewAuthService(database.DB)
	sessionService := services.NewSessionService(database.DB)
	threadService := services.NewThreadService(database.DB)
	totpService := services.NewTOTPService(database.DB, logger.GetLogger())
	sudoService := services.NewSudoService(database.DB, logger.GetLogger(), totpService)

	// Initialize passkey service with WebAuthn config
	rpID := os.Getenv("WEBAUTHN_RP_ID")
	if rpID == "" {
		rpID = "localhost"
	}
	rpOrigin := os.Getenv("WEBAUTHN_RP_ORIGIN")
	if rpOrigin == "" {
		rpOrigin = strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
		if rpOrigin == "" {
			rpOrigin = "http://localhost:3000"
		}
	}
	rpName := os.Getenv("WEBAUTHN_RP_NAME")
	if rpName == "" {
		rpName = "Alephdraad"
	}
	passkeyService, err := services.NewPasskeyService(database.DB, logger.GetLogger(), rpID, rpOrigin, rpName)
	if err != nil {
		logger.Fatal("Failed to initialize passkey service", zap.Error(err))
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, sessionService)
	threadHandler := handlers.NewThreadHandler(threadService)
	totpHandler := handlers.NewTOTPHandler(totpService, logger.GetLogger())
	passkeyHandler := handlers.NewPasskeyHandler(passkeyService, authService, logger.GetLogger())
	sudoHandler := handlers.NewSudoHandler(sudoService, logger.GetLogger())
	walletHandler := handlers.NewWalletHandler()
	transferHandler := handlers.NewTransferHandler()
	disputeHandler := handlers.NewDisputeHandler()
	withdrawalHandler := handlers.NewWithdrawalHandler()

	// Verify all handlers are properly initialized
	if authHandler == nil || threadHandler == nil {
		logger.Fatal("Failed to initialize handlers")
	}

	// Start event worker
	worker.StartEventWorker(context.Background())

	router := gin.Default()
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(cors.New(buildCORSConfig()))
	// Serve file statis: /static/...
	router.Static("/static", "./public")

	api := router.Group("/api")
	{
		api.GET("/health", handlers.HealthHandler)

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
				totp.POST("/verify", totpHandler.Verify)
				totp.POST("/verify-code", totpHandler.VerifyCode)
				totp.POST("/disable", totpHandler.Disable)
				totp.POST("/backup-codes", totpHandler.GenerateBackupCodes)
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
			// Delete account requires sudo mode
			account.DELETE("", middleware.AuthMiddleware(), DeleteAccountRateLimit(), middleware.RequireSudo(sudoService), handlers.DeleteAccountHandler)
		}

		user := api.Group("/user")
		{
			user.GET("/me", middleware.AuthMiddleware(), handlers.GetUserInfoHandler)
			user.GET("/:username", handlers.GetPublicUserProfileHandler)
			user.GET("/:username/threads", handlers.GetUserThreadsHandler)
			user.GET("/:username/badges", handlers.GetUserBadgesHandler)
		}

		threads := api.Group("/threads")
		{
			threads.GET("/categories", handlers.GetCategoriesHandler)
			threads.GET("/category/:slug", handlers.GetThreadsByCategoryHandler)
			threads.GET("/latest", handlers.GetLatestThreadsHandler)
			threads.GET("/:id/public", handlers.GetPublicThreadDetailHandler)
			threads.GET("/:id", middleware.AuthMiddleware(), handlers.GetThreadDetailHandler)
			threads.POST("", middleware.AuthMiddleware(), handlers.CreateThreadHandler)
			threads.GET("/me", middleware.AuthMiddleware(), handlers.GetMyThreadsHandler)
			threads.PUT("/:id", middleware.AuthMiddleware(), handlers.UpdateThreadHandler)
		}

		// Wallet endpoints
		wallet := api.Group("/wallet")
		wallet.Use(middleware.AuthMiddleware())
		{
			wallet.GET("/balance", walletHandler.GetBalance)
			wallet.POST("/pin/set", walletHandler.SetPIN)
			// Change PIN requires sudo mode
			wallet.POST("/pin/change", middleware.RequireSudo(sudoService), walletHandler.ChangePIN)
			wallet.POST("/pin/verify", walletHandler.VerifyPIN)
			wallet.POST("/deposit", walletHandler.CreateDeposit)
			wallet.GET("/deposits", walletHandler.GetDeposits)
			wallet.GET("/transactions", walletHandler.GetTransactionHistory)
		}

		// Transfer endpoints
		transfers := api.Group("/transfers")
		transfers.Use(middleware.AuthMiddleware())
		{
			// Create transfer requires sudo mode (sending money)
			transfers.POST("", middleware.RequireSudo(sudoService), transferHandler.CreateTransfer)
			transfers.GET("", transferHandler.GetMyTransfers)
			transfers.GET("/pending/sent", transferHandler.GetPendingSentTransfers)
			transfers.GET("/pending/received", transferHandler.GetPendingReceivedTransfers)
			transfers.GET("/search-user", transferHandler.SearchUser)
			transfers.GET("/:id", transferHandler.GetTransferByID)
			transfers.GET("/code/:code", transferHandler.GetTransferByCode)
			transfers.POST("/:id/release", transferHandler.ReleaseTransfer)
			transfers.POST("/:id/cancel", transferHandler.CancelTransfer)
		}

		// Dispute endpoints
		disputes := api.Group("/disputes")
		disputes.Use(middleware.AuthMiddleware())
		{
			disputes.POST("", disputeHandler.CreateDispute)
			disputes.GET("", disputeHandler.GetMyDisputes)
			disputes.GET("/:id", disputeHandler.GetDisputeByID)
			disputes.POST("/:id/evidence", disputeHandler.AddEvidence)
			disputes.GET("/:id/messages", disputeHandler.GetMessages)
			disputes.POST("/:id/messages", disputeHandler.AddMessage)
			disputes.POST("/:id/release", disputeHandler.MutualRelease)
			disputes.POST("/:id/refund", disputeHandler.MutualRefund)
			disputes.POST("/:id/escalate", disputeHandler.EscalateToAdmin)
		}

		// Withdrawal endpoints
		withdrawals := api.Group("/withdrawals")
		withdrawals.Use(middleware.AuthMiddleware())
		{
			// Create withdrawal requires sudo mode
			withdrawals.POST("", middleware.RequireSudo(sudoService), withdrawalHandler.CreateWithdrawal)
			withdrawals.GET("", withdrawalHandler.GetMyWithdrawals)
			withdrawals.GET("/banks", withdrawalHandler.GetAvailableBanks)
			withdrawals.GET("/info", withdrawalHandler.GetWithdrawalInfo) // Get withdrawal limits/requirements
		}

		// Payment gateway webhook callbacks (no auth - verified by callback signature)
		webhooks := api.Group("/webhooks")
		{
			// Keep Xendit webhooks for backward compatibility / migration period
			webhooks.POST("/xendit/invoice", walletHandler.XenditInvoiceCallback)
			// Faspay webhooks (for future integration)
			webhooks.POST("/faspay/disbursement", withdrawalHandler.FaspayDisbursementCallback)
		}

		// Demo/testing endpoints (only in development - protected by env var)
		if os.Getenv("ENABLE_DEMO_ENDPOINTS") == "true" {
			demo := api.Group("/demo")
			{
				demo.POST("/deposit/:external_id/simulate", walletHandler.SimulateDeposit)
				demo.POST("/withdrawal/:code/simulate", withdrawalHandler.SimulateWithdrawal)
			}
		}

		badges := api.Group("/badges")
		{
			badges.GET("/:id", handlers.GetBadgeDetailHandler)
		}

		// Account badge settings (authenticated)
		account.GET("/badges", middleware.AuthMiddleware(), handlers.GetMyBadges)
		account.PUT("/primary-badge", middleware.AuthMiddleware(), handlers.SetPrimaryBadge)

		router.POST("/api/rag/index-chunk", handlers.IndexChunkHandler)
		router.GET("/api/rag/ask", handlers.AskHandler)
		router.GET("/api/rag/answer", handlers.AnswerHandler)
		router.POST("/api/rag/index-long", handlers.IndexLongHandler)
		router.POST("/api/rag/index-thread/:id", handlers.IndexThreadByIDHandler)
		router.GET("/api/rag/debug-chunks/:thread_id", handlers.DebugChunksHandler)

		// NEW: Two-step AI Search endpoints
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

			// Dispute management
			adminProtected.GET("/disputes", disputeHandler.AdminGetAllDisputes)
			adminProtected.POST("/disputes/:id/resolve", disputeHandler.AdminResolveDispute)
			adminProtected.POST("/disputes/:id/messages", disputeHandler.AdminAddMessage)
		}
	}

	// --- BAGIAN INI YANG DIUBAH ---

	// Ambil port dari Environment Variable (Inject dari Render)
	port := os.Getenv("PORT")

	// Jika kosong (artinya sedang jalan di laptop/local), pakai 8080
	if port == "" {
		port = "8080"
	}

	logger.Info("Server backend berjalan di port "+port, zap.String("port", port))

	// Jalankan server dengan port dinamis
	// Tambahkan "0.0.0.0" agar bisa diakses dari luar container Render
	if err := router.Run("0.0.0.0:" + port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
