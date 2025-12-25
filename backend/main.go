package main

import (
	"context"
	"log"
	"os"
	"strings"

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

func buildCORSConfig() cors.Config {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
	if frontend == "" {
		frontend = "https://monorepo-root-dun.vercel.app"
	}

	allowedOriginsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	rawOrigins := []string{}
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

	// Initialize logger
	logger.InitLogger()
	defer logger.Log.Sync()

	logger.Info("Starting Ballerina Backend Server")

	// Initialize database
	database.InitDB()
	config.InitConfig()

	// Initialize services
	authService := services.NewAuthService(database.DB)
	orderService := services.NewOrderService(database.DB)
	threadService := services.NewThreadService(database.DB)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)
	orderHandler := handlers.NewOrderHandler(orderService)
	threadHandler := handlers.NewThreadHandler(threadService)

	// Verify all handlers are properly initialized
	if authHandler == nil || orderHandler == nil || threadHandler == nil {
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
			auth.POST("/verify/request", authHandler.RequestVerification)
			auth.POST("/verify/confirm", authHandler.ConfirmVerification)
			auth.POST("/username", middleware.AuthMiddleware(), handlers.CreateUsernameHandler)
		}

		account := api.Group("/account")
		{
			account.GET("/me", middleware.AuthMiddleware(), handlers.GetMyAccountHandler)
			account.PUT("", middleware.AuthMiddleware(), handlers.UpdateMyAccountHandler)
			account.POST("/change-username", middleware.AuthMiddleware(), handlers.ChangeUsernamePaidHandler)
			account.PUT("/avatar", middleware.AuthMiddleware(), handlers.UploadAvatarHandler)
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

		// Marketplace endpoints
		orders := api.Group("/orders")
		{
			orders.POST("", middleware.AuthOptionalMiddleware(), orderHandler.CreateOrder)
			orders.POST("/:orderId/attach", orderHandler.AttachEscrow)
			orders.GET("", middleware.AuthMiddleware(), orderHandler.ListOrders)
			orders.GET("/:orderId", orderHandler.GetOrderStatus)
		}

		disputes := api.Group("/disputes")
		{
			disputes.GET("/escrow/:escrowAddress", middleware.AuthMiddleware(), handlers.GetDisputeByEscrowID)
			disputes.POST("/escrow/:escrowAddress/arbitrate", middleware.AuthMiddleware(), handlers.SubmitArbitrationVote)
		}

		api.GET("/chainlink/rate", handlers.GetChainlinkRateHandler)

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
	router.Run("0.0.0.0:" + port)
}
