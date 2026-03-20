package handlers

// swagger_models.go contains types used exclusively by swaggo annotations.
// These mirror the gin.H{} responses produced by handlers so that Swagger
// can render accurate request/response schemas. They are NOT used at runtime.

// --- Generic ---

// SwaggerErrorResponse is the standard error envelope returned by all endpoints.
type SwaggerErrorResponse struct {
	Code    string `json:"code" example:"AUTH001"`
	Message string `json:"message" example:"Email atau password salah"`
	Details string `json:"details,omitempty" example:"Detail tambahan"`
}

// SwaggerMessageResponse is a simple message envelope.
type SwaggerMessageResponse struct {
	Message string `json:"message" example:"Operasi berhasil"`
}

// SwaggerStatusResponse is a simple status envelope.
type SwaggerStatusResponse struct {
	Status string `json:"status" example:"ok"`
}

// --- Auth ---

// SwaggerLoginResponse is the successful login response.
type SwaggerLoginResponse struct {
	AccessToken  string                `json:"access_token" example:"eyJhbGciOi..."`
	RefreshToken string                `json:"refresh_token" example:"dGhpcyBpcyBh..."`
	ExpiresIn    int64                 `json:"expires_in" example:"300"`
	TokenType    string                `json:"token_type" example:"Bearer"`
	User         SwaggerLoginUserBrief `json:"user"`
}

// SwaggerLoginUserBrief is the user info returned in login response.
type SwaggerLoginUserBrief struct {
	Email    string `json:"email" example:"user@example.com"`
	Username string `json:"username" example:"johndoe"`
	FullName string `json:"full_name" example:"John Doe"`
}

// SwaggerLoginTOTPRequiredResponse is returned when 2FA is required.
type SwaggerLoginTOTPRequiredResponse struct {
	RequiresTOTP bool                  `json:"requires_totp" example:"true"`
	TOTPPending  string                `json:"totp_pending" example:"pending-token-string"`
	User         SwaggerLoginUserBrief `json:"user"`
}

// SwaggerRegisterResponse is the successful registration response.
type SwaggerRegisterResponse struct {
	Message      string                        `json:"message" example:"Registrasi berhasil"`
	Verification SwaggerRegisterVerificationObj `json:"verification"`
}

// SwaggerRegisterVerificationObj contains verification info.
type SwaggerRegisterVerificationObj struct {
	Required bool `json:"required" example:"true"`
}

// SwaggerRefreshResponse is the successful token refresh response.
type SwaggerRefreshResponse struct {
	AccessToken  string `json:"access_token" example:"eyJhbGciOi..."`
	RefreshToken string `json:"refresh_token" example:"dGhpcyBpcyBh..."`
	ExpiresIn    int64  `json:"expires_in" example:"300"`
	TokenType    string `json:"token_type" example:"Bearer"`
}

// --- Account ---

// SwaggerAccountMeResponse is the GET /account/me response.
type SwaggerAccountMeResponse struct {
	Email          string      `json:"email" example:"user@example.com"`
	Username       string      `json:"username" example:"johndoe"`
	FullName       string      `json:"full_name" example:"John Doe"`
	Bio            string      `json:"bio" example:"Software engineer"`
	Pronouns       string      `json:"pronouns" example:"he/him"`
	Company        string      `json:"company" example:"AIValid"`
	Telegram       string      `json:"telegram" example:"@johndoe"`
	TelegramAuth   interface{} `json:"telegram_auth"`
	SocialAccounts interface{} `json:"social_accounts"`
	AvatarURL      string      `json:"avatar_url" example:"https://example.com/avatar.jpg"`
}

// --- Validation Cases ---

// SwaggerValidationCaseCreateRequest is the create validation case request body.
type SwaggerValidationCaseCreateRequest struct {
	CategorySlug string      `json:"category_slug" example:"ai-text"`
	Title        string      `json:"title" example:"Review GPT-4 Output"`
	Summary      string      `json:"summary" example:"Perlu validasi output AI"`
	ContentType  string      `json:"content_type" example:"text"`
	Content      interface{} `json:"content"`
	BountyAmount int64       `json:"bounty_amount" example:"50000"`
	Meta         interface{} `json:"meta"`
	TagSlugs     []string    `json:"tag_slugs"`
}

// SwaggerValidationCaseCreateResponse is the create validation case response.
type SwaggerValidationCaseCreateResponse struct {
	ID uint `json:"id" example:"42"`
}

// SwaggerValidationCaseListResponse wraps a list of validation cases.
type SwaggerValidationCaseListResponse struct {
	ValidationCases []interface{} `json:"validation_cases"`
}

// SwaggerCategoryListResponse wraps a list of categories.
type SwaggerCategoryListResponse struct {
	Categories []interface{} `json:"categories"`
}

// --- Feature Flags ---

// SwaggerFeatureFlagItem represents a single feature flag.
type SwaggerFeatureFlagItem struct {
	ID                int    `json:"id" example:"1"`
	Key               string `json:"key" example:"dark_mode"`
	Enabled           bool   `json:"enabled" example:"true"`
	Description       string `json:"description" example:"Enable dark mode UI"`
	RolloutPercentage int    `json:"rollout_percentage" example:"100"`
	CreatedAt         string `json:"created_at" example:"2024-01-01T00:00:00Z"`
	UpdatedAt         string `json:"updated_at" example:"2024-01-01T00:00:00Z"`
}

// SwaggerFeatureFlagListResponse is the list feature flags response.
type SwaggerFeatureFlagListResponse struct {
	FeatureFlags []SwaggerFeatureFlagItem `json:"feature_flags"`
}

// SwaggerFeatureFlagCreateRequest is the create feature flag request.
type SwaggerFeatureFlagCreateRequest struct {
	Key               string `json:"key" example:"dark_mode"`
	Description       string `json:"description" example:"Enable dark mode UI"`
	Enabled           bool   `json:"enabled" example:"false"`
	RolloutPercentage *int   `json:"rollout_percentage" example:"100"`
}

// SwaggerFeatureFlagCreateResponse is the create feature flag response.
type SwaggerFeatureFlagCreateResponse struct {
	Message     string                 `json:"message" example:"Feature flag berhasil dibuat"`
	FeatureFlag SwaggerFeatureFlagItem `json:"feature_flag"`
}

// SwaggerFeatureFlagCheckResponse is the check feature flag response.
type SwaggerFeatureFlagCheckResponse struct {
	Enabled bool `json:"enabled" example:"true"`
}

// SwaggerUpdateAccountRequest is the swagger-friendly version of UpdateAccountRequest.
type SwaggerUpdateAccountRequest struct {
	FullName       *string     `json:"full_name" example:"John Doe"`
	Bio            *string     `json:"bio" example:"Software engineer"`
	Pronouns       *string     `json:"pronouns" example:"he/him"`
	Company        *string     `json:"company" example:"AIValid"`
	Telegram       *string     `json:"telegram" example:"@johndoe"`
	SocialAccounts interface{} `json:"social_accounts"`
}

// --- Health ---

// SwaggerHealthResponse is the health check response.
type SwaggerHealthResponse struct {
	OK      bool   `json:"ok" example:"true"`
	Time    string `json:"time" example:"2024-01-01T00:00:00Z"`
	Version string `json:"version" example:"1.0.0"`
}

// SwaggerReadinessResponse is the readiness check response.
type SwaggerReadinessResponse struct {
	OK      bool              `json:"ok" example:"true"`
	Time    string            `json:"time" example:"2024-01-01T00:00:00Z"`
	Version string            `json:"version" example:"1.0.0"`
	Checks  map[string]string `json:"checks"`
	Mode    string            `json:"mode" example:"release"`
}

// --- Admin ---

// SwaggerAdminLoginRequest is the admin login request.
type SwaggerAdminLoginRequest struct {
	Email    string `json:"email" example:"admin@aivalid.id"`
	Password string `json:"password" example:"secret"`
}

// SwaggerAdminLoginResponse is the admin login response.
type SwaggerAdminLoginResponse struct {
	Token string                    `json:"token" example:"eyJhbGciOi..."`
	Admin SwaggerAdminLoginAdminObj `json:"admin"`
}

// SwaggerAdminLoginAdminObj is the admin user in login response.
type SwaggerAdminLoginAdminObj struct {
	ID    int    `json:"id" example:"1"`
	Email string `json:"email" example:"admin@aivalid.id"`
	Name  string `json:"name" example:"Admin"`
}

// --- Sessions ---

// SwaggerSessionItem represents a single session.
type SwaggerSessionItem struct {
	ID         int    `json:"id" example:"1"`
	IPAddress  string `json:"ip_address" example:"127.0.0.1"`
	UserAgent  string `json:"user_agent" example:"Mozilla/5.0"`
	CreatedAt  string `json:"created_at" example:"2024-01-01T00:00:00Z"`
	LastUsedAt string `json:"last_used_at" example:"2024-01-01T00:00:00Z"`
	ExpiresAt  string `json:"expires_at" example:"2024-01-08T00:00:00Z"`
}

// SwaggerSessionListResponse is the list sessions response.
type SwaggerSessionListResponse struct {
	Sessions []SwaggerSessionItem `json:"sessions"`
}

// --- Auth TOTP Login ---

// SwaggerLoginTOTPRequest is the request body for TOTP login completion.
type SwaggerLoginTOTPRequest struct {
	TOTPPending       string `json:"totp_pending" example:"pending-token-string"`
	Code              string `json:"code" example:"123456"`
	DeviceFingerprint string `json:"device_fingerprint,omitempty" example:"fp_abc123"`
}

// SwaggerLoginBackupCodeRequest is the request body for backup code login.
type SwaggerLoginBackupCodeRequest struct {
	TOTPPending       string `json:"totp_pending" example:"pending-token-string"`
	Code              string `json:"code" example:"ABCD-1234-EFGH"`
	DeviceFingerprint string `json:"device_fingerprint,omitempty" example:"fp_abc123"`
}

// SwaggerVerifyRequestResponse is the response for requesting email verification.
type SwaggerVerifyRequestResponse struct {
	Message           string `json:"message" example:"Jika email terdaftar, tautan verifikasi telah dikirim."`
	RetryAfterSeconds int    `json:"retry_after_seconds,omitempty" example:"60"`
}

// --- TOTP ---

// SwaggerTOTPVerifyEnabledResponse is the response after enabling TOTP.
type SwaggerTOTPVerifyEnabledResponse struct {
	Message     string   `json:"message" example:"2FA berhasil diaktifkan"`
	Enabled     bool     `json:"enabled" example:"true"`
	BackupCodes []string `json:"backup_codes" example:"ABCD-1234"`
}

// SwaggerTOTPDisableResponse is the response after disabling TOTP.
type SwaggerTOTPDisableResponse struct {
	Message string `json:"message" example:"2FA berhasil dinonaktifkan"`
	Enabled bool   `json:"enabled" example:"false"`
}

// SwaggerBackupCodesGenerateResponse is the response for generating backup codes.
type SwaggerBackupCodesGenerateResponse struct {
	Codes []string `json:"codes" example:"ABCD-1234"`
}

// SwaggerBackupCodeCountResponse is the response for backup code count.
type SwaggerBackupCodeCountResponse struct {
	Count int `json:"count" example:"8"`
}

// SwaggerTOTPVerifyCodeResponse is the response for verifying a single TOTP code.
type SwaggerTOTPVerifyCodeResponse struct {
	Valid   bool   `json:"valid" example:"true"`
	Message string `json:"message" example:"Kode valid"`
}

// --- Account Telegram ---

// SwaggerTelegramConnectRequest is the request body for connecting Telegram account.
type SwaggerTelegramConnectRequest struct {
	ID        int64  `json:"id" example:"123456789"`
	FirstName string `json:"first_name" example:"John"`
	LastName  string `json:"last_name" example:"Doe"`
	Username  string `json:"username" example:"johndoe"`
	PhotoURL  string `json:"photo_url" example:"https://t.me/i/userpic/photo.jpg"`
	AuthDate  int64  `json:"auth_date" example:"1700000000"`
	Hash      string `json:"hash" example:"abc123def456"`
}

// SwaggerTelegramAuthInfo represents the Telegram auth details in responses.
type SwaggerTelegramAuthInfo struct {
	Connected       bool   `json:"connected" example:"true"`
	TelegramUserID  string `json:"telegram_user_id,omitempty" example:"123456789"`
	Username        string `json:"username,omitempty" example:"johndoe"`
	DisplayUsername string `json:"display_username,omitempty" example:"@johndoe"`
	DeepLink        string `json:"deep_link,omitempty" example:"https://t.me/johndoe"`
	FirstName       string `json:"first_name,omitempty" example:"John"`
	LastName        string `json:"last_name,omitempty" example:"Doe"`
	PhotoURL        string `json:"photo_url,omitempty" example:"https://t.me/i/userpic/photo.jpg"`
	VerifiedAt      string `json:"verified_at,omitempty" example:"2024-01-01T00:00:00Z"`
}

// SwaggerTelegramConnectResponse is the response after connecting Telegram.
type SwaggerTelegramConnectResponse struct {
	Status       string                  `json:"status" example:"ok"`
	TelegramAuth SwaggerTelegramAuthInfo `json:"telegram_auth"`
}

// --- Account Change Username ---

// SwaggerChangeUsernameRequest is the request body for changing username.
type SwaggerChangeUsernameRequest struct {
	NewUsername string `json:"new_username" example:"newusername"`
}

// SwaggerChangeUsernameResponse is the response after changing username.
type SwaggerChangeUsernameResponse struct {
	Status      string `json:"status" example:"ok"`
	NewUsername string `json:"new_username" example:"newusername"`
}

// --- Account Avatar ---

// SwaggerUploadAvatarResponse is the response after uploading avatar.
type SwaggerUploadAvatarResponse struct {
	AvatarURL string `json:"avatar_url" example:"https://storage.example.com/avatars/u1_1700000000.jpg"`
}

// --- Account Delete ---

// SwaggerCanDeleteResponse is the response for checking if account can be deleted.
type SwaggerCanDeleteResponse struct {
	CanDelete          bool     `json:"can_delete" example:"true"`
	BlockingReasons    []string `json:"blocking_reasons"`
	Warnings           []string `json:"warnings"`
	WalletBalance      int64    `json:"wallet_balance" example:"0"`
	PendingTransfers   int      `json:"pending_transfers" example:"0"`
	DisputedTransfers  int      `json:"disputed_transfers" example:"0"`
	PendingWithdrawals int      `json:"pending_withdrawals" example:"0"`
}

// SwaggerDeleteAccountRequest is the request body for deleting account.
type SwaggerDeleteAccountRequest struct {
	Confirmation string `json:"confirmation" example:"DELETE"`
}

// --- User ---

// SwaggerUserInfoResponse is the response for GET /user/me.
type SwaggerUserInfoResponse struct {
	ID        int    `json:"id" example:"1"`
	Email     string `json:"email" example:"user@example.com"`
	Name      string `json:"name" example:"johndoe"`
	Username  string `json:"username" example:"johndoe"`
	AvatarURL string `json:"avatar_url" example:"https://example.com/avatar.jpg"`
}

// SwaggerPublicUserProfileResponse is the response for GET /user/:username.
type SwaggerPublicUserProfileResponse struct {
	ID                  int         `json:"id" example:"1"`
	Username            string      `json:"username" example:"johndoe"`
	FullName            string      `json:"full_name" example:"John Doe"`
	Bio                 string      `json:"bio" example:"Software engineer"`
	Pronouns            string      `json:"pronouns" example:"he/him"`
	Company             string      `json:"company" example:"AIValid"`
	SocialAccounts      interface{} `json:"social_accounts"`
	AvatarURL           string      `json:"avatar_url" example:"https://example.com/avatar.jpg"`
	ValidationCaseCount int         `json:"validation_case_count" example:"5"`
	GuaranteeAmount     int64       `json:"guarantee_amount" example:"100000"`
	PrimaryBadge        interface{} `json:"primary_badge"`
	Badges              interface{} `json:"badges"`
}

// SwaggerPublicUserByIDResponse is the response for GET /users/:id/public.
type SwaggerPublicUserByIDResponse struct {
	ID        int    `json:"id" example:"1"`
	Username  string `json:"username" example:"johndoe"`
	AvatarURL string `json:"avatar_url" example:"https://example.com/avatar.jpg"`
}

// --- Badges ---

// SwaggerBadgeItem represents a single badge in list responses.
type SwaggerBadgeItem struct {
	ID          int    `json:"id" example:"1"`
	Name        string `json:"name" example:"Early Adopter"`
	Slug        string `json:"slug" example:"early-adopter"`
	Description string `json:"description,omitempty" example:"Joined during beta"`
	IconType    string `json:"icon_type" example:"emoji"`
	Color       string `json:"color" example:"#FFD700"`
	GrantedAt   string `json:"granted_at,omitempty" example:"2024-01-01T00:00:00Z"`
	Reason      string `json:"reason,omitempty" example:"Beta participant"`
}

// SwaggerBadgeBrief represents a badge without grant details (used in primary badge).
type SwaggerBadgeBrief struct {
	ID       int    `json:"id" example:"1"`
	Name     string `json:"name" example:"Early Adopter"`
	Slug     string `json:"slug" example:"early-adopter"`
	IconType string `json:"icon_type" example:"emoji"`
	Color    string `json:"color" example:"#FFD700"`
}

// SwaggerUserBadgesPublicResponse is the response for GET /user/:username/badges.
type SwaggerUserBadgesPublicResponse struct {
	Badges       []SwaggerBadgeItem `json:"badges"`
	PrimaryBadge *SwaggerBadgeBrief `json:"primary_badge"`
}

// SwaggerMyBadgesResponse is the response for GET /account/badges.
type SwaggerMyBadgesResponse struct {
	Badges         []SwaggerBadgeItem `json:"badges"`
	PrimaryBadgeID *int               `json:"primary_badge_id" example:"1"`
}

// SwaggerSetPrimaryBadgeRequest is the request body for setting primary badge.
type SwaggerSetPrimaryBadgeRequest struct {
	BadgeID *int `json:"badge_id" example:"1"`
}

// SwaggerUserBadgesListResponse is the response for GET /user/:username/badges (badges.go variant).
type SwaggerUserBadgesListResponse struct {
	Badges []SwaggerBadgeItem `json:"badges"`
}

// SwaggerValidationCasesByUsernameResponse is the response for GET /user/:username/validation-cases.
type SwaggerValidationCasesByUsernameResponse struct {
	ValidationCases []interface{} `json:"validation_cases"`
}

// --- Username ---

// SwaggerCreateUsernameResponse is the response after setting initial username.
type SwaggerCreateUsernameResponse struct {
	User            SwaggerCreateUsernameUser `json:"user"`
	SetupCompleted  bool                      `json:"setup_completed" example:"true"`
}

// SwaggerCreateUsernameUser is the user object in username response.
type SwaggerCreateUsernameUser struct {
	Email     string `json:"email" example:"user@example.com"`
	Name      string `json:"name" example:"johndoe"`
	AvatarURL string `json:"avatar_url" example:"https://example.com/avatar.jpg"`
}

// --- Feature Flag Update ---

// SwaggerFeatureFlagUpdateRequest is the update feature flag request.
type SwaggerFeatureFlagUpdateRequest struct {
	Enabled           *bool   `json:"enabled" example:"true"`
	Description       *string `json:"description" example:"Enable dark mode UI"`
	RolloutPercentage *int    `json:"rollout_percentage" example:"50"`
}

// --- Market ---

// SwaggerMarketListingResponse is the GET /market/chatgpt response.
type SwaggerMarketListingResponse struct {
	Cached bool        `json:"cached" example:"true"`
	Stale  bool        `json:"stale,omitempty" example:"false"`
	JSON   interface{} `json:"json"`
}

// SwaggerMarketCheckoutResponse is the GET /market/chatgpt/:itemId/checkout response.
type SwaggerMarketCheckoutResponse struct {
	ItemID      string `json:"item_id" example:"12345"`
	CheckoutURL string `json:"checkout_url" example:"https://lzt.market/12345"`
	Note        string `json:"note" example:"Gunakan endpoint POST /api/market/chatgpt/orders untuk checkout internal."`
}

// SwaggerMarketCreateOrderRequest is the POST /market/chatgpt/orders request body.
type SwaggerMarketCreateOrderRequest struct {
	ItemID string `json:"item_id" example:"12345"`
	I18n   string `json:"i18n,omitempty" example:"en-US"`
}

// SwaggerMarketOrderStep represents a single step in an order.
type SwaggerMarketOrderStep struct {
	Code    string `json:"code" example:"INIT"`
	Label   string `json:"label" example:"Order dibuat"`
	Status  string `json:"status" example:"done"`
	Message string `json:"message,omitempty" example:""`
	At      string `json:"at" example:"2024-01-01T00:00:00Z"`
}

// SwaggerMarketOrderItem represents a market purchase order.
type SwaggerMarketOrderItem struct {
	ID             string                   `json:"id" example:"mpo_abc123"`
	ItemID         string                   `json:"item_id" example:"12345"`
	Title          string                   `json:"title" example:"ChatGPT Plus Account"`
	Price          string                   `json:"price" example:"Rp 50.000"`
	Status         string                   `json:"status" example:"fulfilled"`
	Seller         string                   `json:"seller" example:"seller123"`
	SourcePrice    float64                  `json:"source_price,omitempty" example:"3.5"`
	SourceCurrency string                   `json:"source_currency,omitempty" example:"USD"`
	PriceIDR       int64                    `json:"price_idr,omitempty" example:"50000"`
	PriceDisplay   string                   `json:"price_display,omitempty" example:"Rp 50.000"`
	SourceDisplay  string                   `json:"source_display,omitempty" example:"$3.50"`
	Steps          []SwaggerMarketOrderStep `json:"steps,omitempty"`
	CreatedAt      string                   `json:"created_at" example:"2024-01-01T00:00:00Z"`
	UpdatedAt      string                   `json:"updated_at" example:"2024-01-01T00:00:00Z"`
}

// SwaggerMarketOrderResponse wraps a single order.
type SwaggerMarketOrderResponse struct {
	Order SwaggerMarketOrderItem `json:"order"`
}

// SwaggerMarketOrderListResponse wraps a list of orders.
type SwaggerMarketOrderListResponse struct {
	Orders []SwaggerMarketOrderItem `json:"orders"`
}

// --- Tags ---

// SwaggerTagItem represents a single tag.
type SwaggerTagItem struct {
	ID          int    `json:"id" example:"1"`
	Slug        string `json:"slug" example:"artifact-code"`
	Name        string `json:"name" example:"Code Artifact"`
	Description string `json:"description" example:"Source code artifacts"`
	Color       string `json:"color" example:"#3B82F6"`
	Icon        string `json:"icon" example:"💻"`
}

// SwaggerTagListResponse is the GET /tags response.
type SwaggerTagListResponse struct {
	Tags []SwaggerTagItem `json:"tags"`
}

// SwaggerTagValidationCaseBrief represents a validation case in tag listing.
type SwaggerTagValidationCaseBrief struct {
	ID           int         `json:"id" example:"42"`
	Title        string      `json:"title" example:"Review GPT-4 Output"`
	Summary      string      `json:"summary" example:"Perlu validasi output AI"`
	Status       string      `json:"status" example:"published"`
	BountyAmount int64       `json:"bounty_amount" example:"50000"`
	CreatedAt    int64       `json:"created_at" example:"1700000000"`
	Username     string      `json:"username" example:"johndoe"`
	AvatarURL    string      `json:"avatar_url" example:"https://example.com/avatar.jpg"`
	CategoryName string      `json:"category_name" example:"AI Text"`
	CategorySlug string      `json:"category_slug" example:"ai-text"`
	Tags         interface{} `json:"tags"`
}

// SwaggerTagWithCasesResponse is the GET /tags/:slug/validation-cases response.
type SwaggerTagWithCasesResponse struct {
	Tag             SwaggerTagItem                  `json:"tag"`
	ValidationCases []SwaggerTagValidationCaseBrief `json:"validation_cases"`
}

// --- Badge Detail ---

// SwaggerPublicBadgeDetailResponse is the GET /badges/:id response (flat fields).
type SwaggerPublicBadgeDetailResponse struct {
	ID          int    `json:"id" example:"1"`
	Name        string `json:"name" example:"Early Adopter"`
	Slug        string `json:"slug" example:"early-adopter"`
	Description string `json:"description" example:"Joined during beta"`
	IconType    string `json:"icon_type" example:"emoji"`
	Color       string `json:"color" example:"#FFD700"`
	CreatedAt   int64  `json:"created_at" example:"1700000000"`
}

// --- Health Version ---

// SwaggerHealthVersionResponse is the GET /health/version response.
type SwaggerHealthVersionResponse struct {
	Status       string `json:"status" example:"ok"`
	Service      string `json:"service" example:"backend-gin"`
	Version      string `json:"version" example:"1.0.0"`
	GitSHA       string `json:"git_sha" example:"abc123def"`
	BuildTimeUTC string `json:"build_time_utc" example:"2024-01-01T00:00:00Z"`
	Timestamp    string `json:"timestamp" example:"2024-01-01T00:00:00Z"`
}

// --- Internal ---

// SwaggerInternalUpdateGuaranteeRequest is the PUT /internal/users/:id/guarantee request.
type SwaggerInternalUpdateGuaranteeRequest struct {
	GuaranteeAmount *int64 `json:"guarantee_amount" example:"100000"`
}

// SwaggerInternalEscrowReleasedRequest is the POST /internal/validation-cases/escrow/released request.
type SwaggerInternalEscrowReleasedRequest struct {
	TransferID string `json:"transfer_id" example:"txn_abc123"`
}

// SwaggerInternalDisputeSettledRequest is the POST /internal/validation-cases/disputes/settled request.
type SwaggerInternalDisputeSettledRequest struct {
	TransferID string `json:"transfer_id" example:"txn_abc123"`
	DisputeID  string `json:"dispute_id" example:"dsp_abc123"`
	Outcome    string `json:"outcome" example:"refund"`
	Source     string `json:"source,omitempty" example:"admin"`
}

// SwaggerInternalCallbackResponse is the generic internal callback response.
type SwaggerInternalCallbackResponse struct {
	Status           string `json:"status" example:"ok"`
	ValidationCaseID int    `json:"validation_case_id,omitempty" example:"42"`
}

// SwaggerInternalConsultationLocksResponse is the GET /internal/users/:id/consultation-locks response.
type SwaggerInternalConsultationLocksResponse struct {
	ValidatorUserID            uint        `json:"validator_user_id" example:"1"`
	HasActiveConsultationLock  bool        `json:"has_active_consultation_lock" example:"false"`
	Locks                      interface{} `json:"locks"`
}

// --- Metrics ---

// SwaggerMetricsResponse is a placeholder for the Prometheus /metrics endpoint.
type SwaggerMetricsResponse struct {
	Body string `json:"body" example:"# HELP go_gc_duration_seconds ..."`
}

// --- Admin Badges ---

// SwaggerBadgeObj represents a badge in admin responses.
type SwaggerBadgeObj struct {
	ID          uint   `json:"id" example:"1"`
	Name        string `json:"name" example:"Verified"`
	Slug        string `json:"slug" example:"verified"`
	Description string `json:"description" example:"Verified member"`
	IconType    string `json:"icon_type" example:"verified"`
	Color       string `json:"color" example:"#6366f1"`
}

// SwaggerBadgeCreateResponse is the create/update badge response.
type SwaggerBadgeCreateResponse struct {
	Message string          `json:"message" example:"Badge berhasil dibuat"`
	Badge   SwaggerBadgeObj `json:"badge"`
}

// SwaggerBadgeListResponse is the list badges response.
type SwaggerBadgeListResponse struct {
	Badges []SwaggerBadgeObj `json:"badges"`
}

// SwaggerBadgeDetailResponse is the admin single badge detail response.
type SwaggerBadgeDetailResponse struct {
	Badge SwaggerBadgeObj `json:"badge"`
}

// --- Admin Users ---

// SwaggerAdminUserBadgeBrief represents a badge in the admin user list.
type SwaggerAdminUserBadgeBrief struct {
	ID          uint   `json:"id" example:"1"`
	Name        string `json:"name" example:"Verified"`
	Slug        string `json:"slug" example:"verified"`
	Description string `json:"description" example:"Verified member"`
	IconType    string `json:"icon_type" example:"verified"`
	Color       string `json:"color" example:"#6366f1"`
}

// SwaggerAdminUserItem represents a user in the admin user list.
type SwaggerAdminUserItem struct {
	ID           uint                       `json:"id" example:"1"`
	Email        string                     `json:"email" example:"user@example.com"`
	Username     *string                    `json:"username" example:"johndoe"`
	AvatarURL    string                     `json:"avatar_url" example:"https://example.com/avatar.jpg"`
	CreatedAt    string                     `json:"created_at" example:"2024-01-01T00:00:00Z"`
	PrimaryBadge *SwaggerAdminUserBadgeBrief `json:"primary_badge"`
	Badges       []SwaggerAdminUserBadgeBrief `json:"badges"`
}

// SwaggerAdminUserListResponse is the admin list users response.
type SwaggerAdminUserListResponse struct {
	Users []SwaggerAdminUserItem `json:"users"`
	Total int64                  `json:"total" example:"150"`
	Page  int                    `json:"page" example:"1"`
	Limit int                    `json:"limit" example:"20"`
}

// SwaggerAdminUserBadgeDetail represents a badge assignment in admin user detail.
type SwaggerAdminUserBadgeDetail struct {
	ID        int    `json:"id" example:"1"`
	UserID    int    `json:"user_id" example:"42"`
	BadgeID   int    `json:"badge_id" example:"3"`
	Reason    string `json:"reason" example:"Excellent contributor"`
	GrantedBy int    `json:"granted_by" example:"1"`
	GrantedAt string `json:"granted_at" example:"2024-01-01T00:00:00Z"`
	RevokedAt string `json:"revoked_at,omitempty" example:""`
}

// SwaggerAdminUserDetailObj represents the user object in admin user detail.
type SwaggerAdminUserDetailObj struct {
	ID             int     `json:"id" example:"42"`
	Email          string  `json:"email" example:"user@example.com"`
	Username       *string `json:"username" example:"johndoe"`
	FullName       string  `json:"full_name" example:"John Doe"`
	Bio            string  `json:"bio" example:"Software engineer"`
	AvatarURL      string  `json:"avatar_url" example:"https://example.com/avatar.jpg"`
	Pronouns       string  `json:"pronouns" example:"he/him"`
	Company        string  `json:"company" example:"AIValid"`
	Telegram       string  `json:"telegram" example:"@johndoe"`
	PrimaryBadgeID *int    `json:"primary_badge_id" example:"3"`
}

// SwaggerAdminUserDetailResponse is the admin get user detail response.
type SwaggerAdminUserDetailResponse struct {
	User   SwaggerAdminUserDetailObj     `json:"user"`
	Badges []SwaggerAdminUserBadgeDetail `json:"badges"`
}

// --- Admin User Badge Assignment ---

// SwaggerUserBadgeAssignObj represents the created user-badge assignment.
type SwaggerUserBadgeAssignObj struct {
	ID        int    `json:"id" example:"1"`
	UserID    int    `json:"user_id" example:"42"`
	BadgeID   int    `json:"badge_id" example:"3"`
	Reason    string `json:"reason" example:"Excellent contributor"`
	GrantedBy int    `json:"granted_by" example:"1"`
	GrantedAt string `json:"granted_at" example:"2024-01-01T00:00:00Z"`
}

// SwaggerUserBadgeAssignResponse is the assign badge to user response.
type SwaggerUserBadgeAssignResponse struct {
	Message   string                    `json:"message" example:"Badge berhasil diberikan"`
	UserBadge SwaggerUserBadgeAssignObj `json:"user_badge"`
}

// --- Admin Observed Devices ---

// SwaggerObservedDeviceItem represents a single observed device.
type SwaggerObservedDeviceItem struct {
	FingerprintHash string `json:"fingerprint_hash" example:"abc123def456"`
	AccountCount    int    `json:"account_count" example:"2"`
	Blocked         bool   `json:"blocked" example:"false"`
	BlockReason     string `json:"block_reason" example:""`
	LastSeenAt      string `json:"last_seen_at" example:"2024-01-01T00:00:00Z"`
	IPAddress       string `json:"ip_address" example:"192.168.1.1"`
	UserAgent       string `json:"user_agent" example:"Mozilla/5.0"`
	UserIDs         []int  `json:"user_ids"`
}

// SwaggerAdminObservedDevicesResponse is the list observed devices response.
type SwaggerAdminObservedDevicesResponse struct {
	Devices  []SwaggerObservedDeviceItem `json:"devices"`
	Total    int                         `json:"total" example:"100"`
	Page     int                         `json:"page" example:"1"`
	PageSize int                         `json:"pageSize" example:"50"`
}

// --- Admin Validation Case Move ---

// SwaggerAdminMoveValidationCaseResponse is the move validation case response.
type SwaggerAdminMoveValidationCaseResponse struct {
	Message string                                  `json:"message" example:"Validation Case berhasil dipindahkan"`
	Data    SwaggerAdminMoveValidationCaseDataObj   `json:"data"`
}

// SwaggerAdminMoveValidationCaseDataObj is the data payload of the move response.
type SwaggerAdminMoveValidationCaseDataObj struct {
	ValidationCaseID uint                                `json:"validation_case_id" example:"42"`
	OldOwner         SwaggerAdminMoveUserSnapshot        `json:"old_owner"`
	NewOwner         SwaggerAdminMoveUserSnapshot        `json:"new_owner"`
	OldCategory      SwaggerAdminMoveCategorySnapshot    `json:"old_category"`
	NewCategory      SwaggerAdminMoveCategorySnapshot    `json:"new_category"`
	ChangedOwner     bool                                `json:"changed_owner" example:"true"`
	ChangedCategory  bool                                `json:"changed_category" example:"false"`
	DryRun           bool                                `json:"dry_run" example:"false"`
	RequestID        string                              `json:"request_id" example:"req_abc123"`
}

// SwaggerAdminMoveUserSnapshot is a user snapshot in the move response.
type SwaggerAdminMoveUserSnapshot struct {
	ID       uint   `json:"id" example:"42"`
	Username string `json:"username" example:"johndoe"`
}

// SwaggerAdminMoveCategorySnapshot is a category snapshot in the move response.
type SwaggerAdminMoveCategorySnapshot struct {
	ID          uint   `json:"id" example:"1"`
	Slug        string `json:"slug" example:"ai-text"`
	Name        string `json:"name" example:"AI Text"`
	Description string `json:"description" example:"AI-generated text validation"`
}

// --- Admin Integrations (LZT) ---

// SwaggerLZTConfigResponse is the LZT integration config response.
type SwaggerLZTConfigResponse struct {
	Enabled                  bool   `json:"enabled" example:"true"`
	BaseURL                  string `json:"base_url" example:"https://api.lzt.market"`
	TimeoutSeconds           int    `json:"timeout_seconds" example:"30"`
	MinIntervalMillis        int    `json:"min_interval_millis" example:"1000"`
	SearchMinIntervalMillis  int    `json:"search_min_interval_millis" example:"3000"`
	TokenConfigured          bool   `json:"token_configured" example:"true"`
	IntegrationInstructions  string `json:"integration_instructions" example:"Gunakan endpoint POST /admin/integrations/lzt/request ..."`
}

// SwaggerLZTProxyRequest is the LZT proxy request body.
type SwaggerLZTProxyRequest struct {
	Method      string            `json:"method" example:"GET"`
	Path        string            `json:"path" example:"/chatgpt"`
	Query       map[string]string `json:"query"`
	ContentType string            `json:"content_type" example:"application/json"`
	JSONBody    interface{}       `json:"json_body"`
	FormBody    map[string]string `json:"form_body"`
}

// SwaggerLZTProxyResponse is the LZT proxy response.
type SwaggerLZTProxyResponse struct {
	UpstreamStatus  int               `json:"upstream_status" example:"200"`
	UpstreamHeaders map[string]string `json:"upstream_headers"`
	JSON            interface{}       `json:"json"`
	Raw             string            `json:"raw,omitempty"`
}

// --- Validation Cases: Category Browse ---

// SwaggerCategoryBrowseResponse wraps a category and its validation cases.
type SwaggerCategoryBrowseResponse struct {
	Category        interface{}   `json:"category"`
	ValidationCases []interface{} `json:"validation_cases"`
}

// --- Validation Cases: Update ---

// SwaggerValidationCaseUpdateRequest is the update validation case request body.
type SwaggerValidationCaseUpdateRequest struct {
	Title        *string     `json:"title" example:"Updated Title"`
	Summary      *string     `json:"summary" example:"Updated summary"`
	ContentType  *string     `json:"content_type" example:"text"`
	Content      interface{} `json:"content"`
	BountyAmount *int64      `json:"bounty_amount" example:"100000"`
	Meta         interface{} `json:"meta"`
	TagSlugs     *[]string   `json:"tag_slugs"`
}

// SwaggerStatusIDResponse is a status response with an ID field.
type SwaggerStatusIDResponse struct {
	Status string `json:"status" example:"ok"`
	ID     uint64 `json:"id" example:"42"`
}

// SwaggerStatusMessageResponse is a status response with a message field.
type SwaggerStatusMessageResponse struct {
	Status  string `json:"status" example:"ok"`
	Message string `json:"message" example:"Operasi berhasil"`
}

// --- Validation Cases: ID Response ---

// SwaggerIDResponse is a simple ID response.
type SwaggerIDResponse struct {
	ID uint `json:"id" example:"42"`
}

// --- Consultation ---

// SwaggerConsultationRequestListResponse wraps a list of consultation requests.
type SwaggerConsultationRequestListResponse struct {
	ConsultationRequests []interface{} `json:"consultation_requests"`
}

// SwaggerConsultationRequestSingleResponse wraps a single consultation request.
type SwaggerConsultationRequestSingleResponse struct {
	ConsultationRequest interface{} `json:"consultation_request"`
}

// SwaggerRejectConsultationRequest is the reject consultation request body.
type SwaggerRejectConsultationRequest struct {
	Reason string `json:"reason" example:"Alasan penolakan yang valid"`
}

// --- Contact ---

// SwaggerContactRevealResponse is the contact reveal response.
type SwaggerContactRevealResponse struct {
	Telegram string `json:"telegram" example:"@username"`
}

// --- Final Offers ---

// SwaggerFinalOfferSubmitRequest is the submit final offer request body.
type SwaggerFinalOfferSubmitRequest struct {
	HoldHours int    `json:"hold_hours" example:"24"`
	Terms     string `json:"terms" example:"Syarat dan ketentuan penawaran"`
}

// SwaggerFinalOfferListResponse wraps a list of final offers.
type SwaggerFinalOfferListResponse struct {
	FinalOffers []interface{} `json:"final_offers"`
}

// SwaggerEscrowDraftResponse is the response after accepting a final offer.
type SwaggerEscrowDraftResponse struct {
	EscrowDraft interface{} `json:"escrow_draft"`
}

// --- Escrow ---

// SwaggerLockFundsRequest is the lock funds request body.
type SwaggerLockFundsRequest struct {
	TransferID string `json:"transfer_id" example:"transfer_abc123"`
}

// SwaggerArtifactSubmitRequest is the artifact submission request body.
type SwaggerArtifactSubmitRequest struct {
	DocumentID string `json:"document_id" example:"doc_abc123"`
}

// SwaggerDisputeAttachRequest is the attach dispute request body.
type SwaggerDisputeAttachRequest struct {
	DisputeID string `json:"dispute_id" example:"dispute_abc123"`
}

// --- Case Log ---

// SwaggerCaseLogResponse wraps a case audit log.
type SwaggerCaseLogResponse struct {
	CaseLog []interface{} `json:"case_log"`
}

// --- Workspace / Repo ---

// SwaggerRepoTreeResponse wraps a workspace file tree.
type SwaggerRepoTreeResponse struct {
	RepoTree interface{} `json:"repo_tree"`
}

// SwaggerAttachRepoFileRequest is the attach workspace file request body.
type SwaggerAttachRepoFileRequest struct {
	DocumentID string `json:"document_id" example:"doc_abc123"`
	Kind       string `json:"kind" example:"evidence"`
	Label      string `json:"label" example:"Screenshot bukti"`
	Visibility string `json:"visibility" example:"public"`
}

// SwaggerAssignValidatorsRequest is the assign validators request body.
type SwaggerAssignValidatorsRequest struct {
	ValidatorUserIDs []uint `json:"validator_user_ids"`
	PanelSize        int    `json:"panel_size" example:"3"`
}

// SwaggerAutoAssignValidatorsRequest is the auto-assign validators request body.
type SwaggerAutoAssignValidatorsRequest struct {
	PanelSize int `json:"panel_size" example:"3"`
}

// SwaggerVoteConfidenceRequest is the vote confidence request body.
type SwaggerVoteConfidenceRequest struct {
	ValidatorUserID uint `json:"validator_user_id" example:"1"`
}

// SwaggerVerdictSubmitRequest is the submit verdict request body.
type SwaggerVerdictSubmitRequest struct {
	Verdict    string `json:"verdict" example:"valid"`
	Confidence int    `json:"confidence" example:"85"`
	Notes      string `json:"notes" example:"Bukti sesuai dengan klaim"`
	DocumentID string `json:"document_id" example:"doc_abc123"`
}

// SwaggerConsensusResponse wraps a consensus status.
type SwaggerConsensusResponse struct {
	Consensus interface{} `json:"consensus"`
}

// SwaggerAddTagsRequest is the add tags to validation case request body.
type SwaggerAddTagsRequest struct {
	TagIDs []int `json:"tag_ids"`
}
