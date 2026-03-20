package main

import (
	"backend-gin/handlers"
	"backend-gin/middleware"

	"github.com/gin-gonic/gin"
)

type routeDeps struct {
	authHandler         *handlers.AuthHandler
	caseHandler         *handlers.ValidationCaseHandler
	workflowHandler     *handlers.ValidationCaseWorkflowHandler
	repoWorkflowHandler *handlers.ValidationCaseRepoWorkflowHandler
	userHandler         *handlers.UserHandler
	totpHandler         *handlers.TOTPHandler
	passkeyHandler      *handlers.PasskeyHandler
	sudoHandler         *handlers.SudoHandler
	sudoValidator       middleware.SudoValidator
	lztMarketHandler    *handlers.LZTMarketHandler
	featureFlagHandler  *handlers.FeatureFlagHandler
}

func registerPublicRoutes(api *gin.RouterGroup, enhancedRateLimiter *middleware.EnhancedRateLimiter, deps routeDeps) {
	// Keep health/readiness outside request rate limits.
	apiRateLimited := api.Group("")
	apiRateLimited.Use(enhancedRateLimiter.Middleware())
	{
		auth := apiRateLimited.Group("/auth")
		{
			authSensitive := auth.Group("")
			authSensitive.Use(enhancedRateLimiter.AuthMiddleware())
			authSensitive.POST("/register", deps.authHandler.Register)
			authSensitive.POST("/login", deps.authHandler.Login)
			authSensitive.POST("/login/totp", deps.authHandler.LoginTOTP)
			authSensitive.POST("/login/backup-code", deps.authHandler.LoginBackupCode)
			authSensitive.POST("/refresh", deps.authHandler.RefreshToken)
			authSensitive.POST("/logout", deps.authHandler.Logout)
			authSensitive.POST("/verify/request", deps.authHandler.RequestVerification)
			authSensitive.POST("/verify/confirm", deps.authHandler.ConfirmVerification)
			authSensitive.POST("/forgot-password", deps.authHandler.ForgotPassword)
			authSensitive.POST("/reset-password", deps.authHandler.ResetPassword)

			auth.POST("/logout-all", middleware.AuthMiddleware(), deps.authHandler.LogoutAll)
			auth.GET("/sessions", middleware.AuthMiddleware(), deps.authHandler.GetActiveSessions)
			auth.DELETE("/sessions/:id", middleware.AuthMiddleware(), deps.authHandler.RevokeSession)
			auth.POST("/username", middleware.AuthMiddleware(), handlers.CreateUsernameHandler)

			// TOTP / 2FA routes
			totp := auth.Group("/totp")
			totp.Use(middleware.AuthMiddleware())
			{
				totp.GET("/status", deps.totpHandler.GetStatus)
				totp.POST("/setup", deps.totpHandler.Setup)
				totp.POST("/verify", deps.totpHandler.Verify) // Returns backup codes on first enable
				totp.POST("/verify-code", deps.totpHandler.VerifyCode)
				totp.POST("/disable", deps.totpHandler.Disable)
				// NOTE: POST /backup-codes removed for security - backup codes only generated during TOTP enable
				totp.GET("/backup-codes/count", deps.totpHandler.GetBackupCodeCount)
			}

			// Passkey / WebAuthn routes
			passkeys := auth.Group("/passkeys")
			{
				// Public endpoints (for login)
				passkeysPublic := passkeys.Group("")
				passkeysPublic.Use(enhancedRateLimiter.AuthMiddleware())
				passkeysPublic.POST("/check", deps.passkeyHandler.CheckPasskeys)
				passkeysPublic.POST("/login/begin", deps.passkeyHandler.BeginLogin)
				passkeysPublic.POST("/login/finish", deps.passkeyHandler.FinishLogin)

				// Protected endpoints (for registration/management)
				passkeys.Use(middleware.AuthMiddleware())
				passkeys.GET("/status", deps.passkeyHandler.GetStatus)
				passkeys.GET("", deps.passkeyHandler.ListPasskeys)
				passkeys.POST("/register/begin", deps.passkeyHandler.BeginRegistration)
				passkeys.POST("/register/finish", deps.passkeyHandler.FinishRegistration)
				passkeys.DELETE("/:id", deps.passkeyHandler.DeletePasskey)
				passkeys.PUT("/:id/name", deps.passkeyHandler.RenamePasskey)
			}

			// Sudo mode routes (re-authentication for critical actions)
			sudo := auth.Group("/sudo")
			sudo.Use(middleware.AuthMiddleware())
			{
				sudo.POST("/verify", deps.sudoHandler.Verify)
				sudo.GET("/status", deps.sudoHandler.GetStatus)
				sudo.POST("/extend", deps.sudoHandler.Extend)
				sudo.DELETE("", deps.sudoHandler.Revoke)
			}
		}

		account := apiRateLimited.Group("/account")
		{
			account.GET("/me", middleware.AuthMiddleware(), handlers.GetMyAccountHandler)
			account.PUT("", middleware.AuthMiddleware(), handlers.UpdateMyAccountHandler)
			account.POST("/telegram/connect", middleware.AuthMiddleware(), handlers.ConnectTelegramAuthHandler)
			account.POST("/telegram/disconnect", middleware.AuthMiddleware(), handlers.DisconnectTelegramAuthHandler)
			account.POST("/change-username", middleware.AuthMiddleware(), handlers.ChangeUsernamePaidHandler)
			account.PUT("/avatar", middleware.AuthMiddleware(), handlers.UploadAvatarHandler)
			account.DELETE("/avatar", middleware.AuthMiddleware(), handlers.DeleteAvatarHandler)
			// Check if user can delete account (validates wallet balance, pending transfers, disputes)
			account.GET("/can-delete", middleware.AuthMiddleware(), handlers.CanDeleteAccountHandler)
			// Delete account requires sudo mode
			account.DELETE("", middleware.AuthMiddleware(), DeleteAccountRateLimit(), middleware.RequireSudo(deps.sudoValidator), handlers.DeleteAccountHandler)
		}

		user := apiRateLimited.Group("/user")
		{
			user.GET("/me", middleware.AuthMiddleware(), deps.userHandler.GetUserInfo)
			user.GET("/:username", deps.userHandler.GetPublicUserProfile)
			user.GET("/:username/validation-cases", enhancedRateLimiter.SearchMiddleware(), deps.caseHandler.GetValidationCasesByUsername)
			user.GET("/:username/badges", handlers.GetUserBadgesHandler)
		}

		// Internal API for service-to-service calls
		users := apiRateLimited.Group("/users")
		{
			users.GET("/:id/public", deps.userHandler.GetPublicUserProfileByID)
		}

		// Internal API protected by service token
		internal := apiRateLimited.Group("/internal")
		internal.Use(middleware.InternalServiceAuth())
		{
			internal.PUT("/users/:id/guarantee", deps.userHandler.UpdateGuaranteeAmount)
			internal.GET("/users/:id/consultation-locks", deps.workflowHandler.InternalGetValidatorConsultationLocks)
			// Feature-service callback: finalize Validation Case after escrow is auto-released.
			internal.POST("/validation-cases/escrow/released", deps.workflowHandler.InternalMarkEscrowReleasedByTransfer)
			// Feature-service callback: sync Validation Case status after dispute settlement.
			internal.POST("/validation-cases/disputes/settled", deps.workflowHandler.InternalSettleDisputeByTransfer)
		}

		validationCases := apiRateLimited.Group("/validation-cases")
		{
			validationCases.GET("/categories", deps.caseHandler.GetCategories)
			validationCases.GET("/category/:slug", deps.caseHandler.GetValidationCasesByCategory)
			validationCases.GET("/latest", deps.caseHandler.GetLatestValidationCases)
			validationCases.GET("/:id/public", deps.caseHandler.GetPublicValidationCaseDetail)
			validationCases.GET("/:id", middleware.AuthMiddleware(), deps.caseHandler.GetValidationCaseDetail)
			validationCases.POST("", middleware.AuthMiddleware(), deps.caseHandler.CreateValidationCase)
			validationCases.GET("/me", middleware.AuthMiddleware(), deps.caseHandler.GetMyValidationCases)
			validationCases.PUT("/:id", middleware.AuthMiddleware(), deps.caseHandler.UpdateValidationCase)
			validationCases.DELETE("/:id", middleware.AuthMiddleware(), deps.caseHandler.DeleteValidationCase)
			// Validation Case tags
			validationCases.GET("/:id/tags", handlers.GetValidationCaseTagsHandler)
			validationCases.POST("/:id/tags", middleware.AuthMiddleware(), handlers.AddTagsToValidationCaseHandler)
			validationCases.DELETE("/:id/tags/:tagSlug", middleware.AuthMiddleware(), handlers.RemoveTagFromValidationCaseHandler)
			// Validation Protocol workflow
			validationCases.POST("/:id/consultation-requests", middleware.AuthMiddleware(), deps.workflowHandler.RequestConsultation)
			validationCases.GET("/:id/consultation-requests", middleware.AuthMiddleware(), deps.workflowHandler.ListConsultationRequests)
			validationCases.GET("/:id/consultation-requests/me", middleware.AuthMiddleware(), deps.workflowHandler.GetMyConsultationRequest)
			validationCases.POST("/:id/consultation-requests/:requestId/approve", middleware.AuthMiddleware(), deps.workflowHandler.ApproveConsultationRequest)
			validationCases.POST("/:id/consultation-requests/:requestId/reject", middleware.AuthMiddleware(), deps.workflowHandler.RejectConsultationRequest)
			validationCases.GET("/:id/contact", middleware.AuthMiddleware(), deps.workflowHandler.RevealContact)

			validationCases.POST("/:id/final-offers", middleware.AuthMiddleware(), deps.workflowHandler.SubmitFinalOffer)
			validationCases.GET("/:id/final-offers", middleware.AuthMiddleware(), deps.workflowHandler.ListFinalOffers)
			validationCases.POST("/:id/final-offers/:offerId/accept", middleware.AuthMiddleware(), deps.workflowHandler.AcceptFinalOffer)

			validationCases.POST("/:id/lock-funds", middleware.AuthMiddleware(), deps.workflowHandler.ConfirmLockFunds)
			validationCases.POST("/:id/artifact-submission", middleware.AuthMiddleware(), deps.workflowHandler.SubmitArtifact)
			validationCases.POST("/:id/escrow/released", middleware.AuthMiddleware(), deps.workflowHandler.MarkEscrowReleased)
			validationCases.POST("/:id/dispute/attach", middleware.AuthMiddleware(), deps.workflowHandler.AttachDispute)

			validationCases.GET("/:id/case-log", middleware.AuthMiddleware(), deps.workflowHandler.GetCaseLog)

			// Evidence Validation Workspace (single write-path for new cases).
			validationCases.GET("/:id/workspace/tree", middleware.AuthMiddleware(), deps.repoWorkflowHandler.GetRepoTree)
			validationCases.POST("/:id/workspace/files", middleware.AuthMiddleware(), deps.repoWorkflowHandler.AttachRepoFile)
			validationCases.POST("/:id/workspace/publish", middleware.AuthMiddleware(), deps.repoWorkflowHandler.PublishRepoCase)
			validationCases.POST("/:id/workspace/apply", middleware.AuthMiddleware(), deps.repoWorkflowHandler.ApplyForRepoCase)
			validationCases.POST("/:id/workspace/validators/assign", middleware.AuthMiddleware(), deps.repoWorkflowHandler.AssignValidators)
			validationCases.POST("/:id/workspace/validators/auto-assign", middleware.AuthMiddleware(), deps.repoWorkflowHandler.AutoAssignValidators)
			validationCases.POST("/:id/workspace/confidence/vote", middleware.AuthMiddleware(), deps.repoWorkflowHandler.VoteConfidence)
			validationCases.POST("/:id/workspace/finalize", middleware.AuthMiddleware(), deps.repoWorkflowHandler.FinalizeRepoCase)
			validationCases.POST("/:id/workspace/verdicts", middleware.AuthMiddleware(), deps.repoWorkflowHandler.SubmitVerdict)
			validationCases.GET("/:id/workspace/consensus", middleware.AuthMiddleware(), deps.repoWorkflowHandler.GetConsensus)
		}

		// Tags endpoints
		tags := apiRateLimited.Group("/tags")
		{
			tags.GET("", handlers.GetAllTagsHandler)
			tags.GET("/:slug", handlers.GetTagBySlugHandler)
			tags.GET("/:slug/validation-cases", enhancedRateLimiter.SearchMiddleware(), handlers.GetValidationCasesByTagHandler)
		}

		// Financial endpoints are handled by the ASP.NET service; omitted here to keep responsibilities separated.

		// Public marketplace endpoints (LZT-backed listing via backend proxy)
		market := apiRateLimited.Group("/market")
		{
			market.GET("/chatgpt", enhancedRateLimiter.SearchMiddleware(), deps.lztMarketHandler.GetPublicChatGPTAccounts)
			market.GET("/chatgpt/:itemId/checkout", deps.lztMarketHandler.GetPublicChatGPTCheckout)
			market.POST("/chatgpt/orders", middleware.AuthMiddleware(), deps.lztMarketHandler.CreatePublicChatGPTOrder)
			market.GET("/chatgpt/orders", middleware.AuthMiddleware(), deps.lztMarketHandler.ListMyPublicChatGPTOrders)
			market.GET("/chatgpt/orders/:orderId", middleware.AuthMiddleware(), deps.lztMarketHandler.GetMyPublicChatGPTOrderDetail)
		}

		badges := apiRateLimited.Group("/badges")
		{
			badges.GET("/:id", handlers.GetBadgeDetailHandler)
		}

		// Feature flags public check
		featureFlags := apiRateLimited.Group("/feature-flags")
		{
			featureFlags.GET("/check/:key", deps.featureFlagHandler.CheckFlag)
		}

		// Account badge settings (authenticated)
		account.GET("/badges", middleware.AuthMiddleware(), handlers.GetMyBadges)
		account.PUT("/primary-badge", middleware.AuthMiddleware(), handlers.SetPrimaryBadge)
	}
}
