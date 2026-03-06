package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	JWTKey           []byte
	JWTIssuer        string
	JWTAudience      string
	JWTAccessExpiry  time.Duration
	JWTRefreshExpiry time.Duration
	ServiceToken     string

	FeatureServiceURL         string
	TelegramBotToken          string
	TelegramAuthMaxAgeSeconds int64
)

func InitConfig() {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		log.Fatal("ERROR: JWT_SECRET is not set in environment variables")
	}
	JWTKey = []byte(secret)

	JWTIssuer = strings.TrimSpace(os.Getenv("JWT_ISSUER"))
	if JWTIssuer == "" {
		log.Fatal("ERROR: JWT_ISSUER is not set in environment variables")
	}

	JWTAudience = strings.TrimSpace(os.Getenv("JWT_AUDIENCE"))
	if JWTAudience == "" {
		log.Fatal("ERROR: JWT_AUDIENCE is not set in environment variables")
	}

	// JWT token expiry
	accessExpiryStr := strings.TrimSpace(os.Getenv("JWT_ACCESS_EXPIRY"))
	if accessExpiryStr == "" {
		accessExpiryStr = "5m"
	}
	accessExpiry, err := time.ParseDuration(accessExpiryStr)
	if err != nil || accessExpiry <= 0 {
		log.Printf("WARN: invalid JWT_ACCESS_EXPIRY=%q, using default 5m", accessExpiryStr)
		accessExpiry = 5 * time.Minute
	}
	JWTAccessExpiry = accessExpiry

	refreshExpiryStr := strings.TrimSpace(os.Getenv("JWT_REFRESH_EXPIRY"))
	if refreshExpiryStr == "" {
		refreshExpiryStr = "168h"
	}
	refreshExpiry, err := time.ParseDuration(refreshExpiryStr)
	if err != nil || refreshExpiry <= 0 {
		log.Printf("WARN: invalid JWT_REFRESH_EXPIRY=%q, using default 168h", refreshExpiryStr)
		refreshExpiry = 7 * 24 * time.Hour
	}
	JWTRefreshExpiry = refreshExpiry

	// Feature-Service URL for internal calls
	FeatureServiceURL = strings.TrimSpace(os.Getenv("FEATURE_SERVICE_URL"))
	if FeatureServiceURL == "" {
		env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
		if env == "production" || env == "staging" {
			log.Fatal("ERROR: FEATURE_SERVICE_URL is not set in environment variables (required in production/staging)")
		}
		FeatureServiceURL = "http://localhost:5000" // Default for development only
	}

	// Service token for Feature Service authentication
	ServiceToken = strings.TrimSpace(os.Getenv("SERVICE_TOKEN"))
	if ServiceToken == "" {
		env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
		if env == "production" || env == "staging" {
			log.Fatal("ERROR: SERVICE_TOKEN is not set in environment variables (required for secure Feature Service communication)")
		}
		// Default for development only - should be set in production
		ServiceToken = "dev-service-token"
	}

	// Telegram Login Widget configuration.
	TelegramBotToken = strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	TelegramAuthMaxAgeSeconds = 600
	if rawMaxAge := strings.TrimSpace(os.Getenv("TELEGRAM_AUTH_MAX_AGE_SECONDS")); rawMaxAge != "" {
		parsed, err := strconv.ParseInt(rawMaxAge, 10, 64)
		if err != nil || parsed <= 0 {
			log.Printf("WARN: invalid TELEGRAM_AUTH_MAX_AGE_SECONDS=%q, using default 600", rawMaxAge)
		} else {
			TelegramAuthMaxAgeSeconds = parsed
		}
	}
}
