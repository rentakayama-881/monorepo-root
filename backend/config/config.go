package config

import (
	"log"
	"os"
	"strings"
)

var (
	JWTKey      []byte
	JWTIssuer   string
	JWTAudience string

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
	FeatureServiceURL = os.Getenv("FEATURE_SERVICE_URL")
	if FeatureServiceURL == "" {
		FeatureServiceURL = "http://localhost:5000" // Default for development
	}
}
