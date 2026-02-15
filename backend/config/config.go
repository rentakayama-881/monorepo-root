package config

import (
	"log"
	"os"
	"strings"
)

var (
	JWTKey        []byte
	JWTIssuer     string
	JWTAudience   string
	ServiceToken  string

	FeatureServiceURL string
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
}
