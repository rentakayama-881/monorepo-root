package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/handlers"
	"backend-gin/middleware"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Tidak dapat memuat file .env, pastikan file .env ada di root folder!")
	}

	database.InitDB()
	config.InitConfig()
	router := gin.Default()
	corsConfig := cors.DefaultConfig()
	frontend := os.Getenv("FRONTEND_BASE_URL")
	if frontend == "" {
		frontend = "https://frontend-three-xi-51.vercel.app/"
	}
	corsConfig.AllowOrigins = []string{frontend}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	router.Use(cors.New(corsConfig))
	// Serve file statis: /static/...
	router.Static("/static", "./public")

	api := router.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.RegisterHandler)
			auth.POST("/login", handlers.LoginHandler)
			auth.POST("/verify/request", handlers.RequestVerification)
			auth.POST("/verify/confirm", handlers.ConfirmVerification)
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
			threads.GET("/:id", middleware.AuthMiddleware(), handlers.GetThreadDetailHandler)
			threads.POST("", middleware.AuthMiddleware(), handlers.CreateThreadHandler)
			threads.GET("/me", middleware.AuthMiddleware(), handlers.GetMyThreadsHandler)
			threads.PUT("/:id", middleware.AuthMiddleware(), handlers.UpdateThreadHandler)
		}

		// Marketplace endpoints (sprint skeleton)
		orders := api.Group("/orders")
		{
			orders.POST("", middleware.AuthOptionalMiddleware(), handlers.CreateOrderHandler)
			orders.POST(":orderId/attach", handlers.AttachEscrowHandler)
			orders.GET(":orderId", handlers.GetOrderStatusHandler)
		}

		disputes := api.Group("/disputes")
		{
			disputes.GET(":id", middleware.AuthMiddleware(), handlers.GetDisputeHandler)
			disputes.POST(":id", middleware.AuthMiddleware(), handlers.PostDisputeActionHandler)
		}

		api.GET("/chainlink/rate", handlers.GetChainlinkRateHandler)

		badges := api.Group("/badges")
		{
			badges.GET("/:id", handlers.GetBadgeDetailHandler)
		}

		router.POST("/api/rag/index-chunk", handlers.IndexChunkHandler)
		router.GET("/api/rag/ask", handlers.AskHandler)
		router.GET("/api/rag/answer", handlers.AnswerHandler)
		router.POST("/api/rag/index-long", handlers.IndexLongHandler)
		router.POST("/api/rag/index-thread/:id", handlers.IndexThreadByIDHandler)
		router.GET("/api/rag/debug-chunks/:thread_id", handlers.DebugChunksHandler)
	}

	log.Println("Server backend berjalan di http://localhost:8080")
	router.Run(":8080")
}
