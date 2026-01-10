package config

import (
	"log"
	"os"
)

var (
	JWTKey            []byte
	FeatureServiceURL string
)

func InitConfig() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("ERROR: JWT_SECRET is not set in environment variables")
	}
	JWTKey = []byte(secret)

	// Feature-Service URL for internal calls
	FeatureServiceURL = os.Getenv("FEATURE_SERVICE_URL")
	if FeatureServiceURL == "" {
		FeatureServiceURL = "http://localhost:5000" // Default for development
	}
}
