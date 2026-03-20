package main

import (
	"backend-gin/handlers"
	"backend-gin/middleware"

	"github.com/gin-gonic/gin"
)

func registerAdminRoutes(router *gin.Engine, enhancedRateLimiter *middleware.EnhancedRateLimiter, lztMarketHandler *handlers.LZTMarketHandler, featureFlagHandler *handlers.FeatureFlagHandler) {
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

			// Observed devices (read-only)
			adminProtected.GET("/observed-devices", handlers.AdminListObservedDevices)

			// Feature flag management
			adminProtected.GET("/feature-flags", featureFlagHandler.ListFlags)
			adminProtected.POST("/feature-flags", featureFlagHandler.CreateFlag)
			adminProtected.PUT("/feature-flags/:key", featureFlagHandler.UpdateFlag)
			adminProtected.DELETE("/feature-flags/:key", featureFlagHandler.DeleteFlag)

			// External integration (LZT Market API)
			adminProtected.GET("/integrations/lzt/config", lztMarketHandler.GetConfig)
			adminProtected.GET("/integrations/lzt/chatgpt", lztMarketHandler.GetChatGPTAccounts)
			adminProtected.POST("/integrations/lzt/request", lztMarketHandler.ProxyRequest)

		}
	}
}
