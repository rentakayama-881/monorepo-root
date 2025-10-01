package config

import (
	"log"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

var (
	OAuthConf *oauth2.Config
        JWTKey    []byte
)

func InitConfig() {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	redirectURL := os.Getenv("OAUTH_REDIRECT_URL")
        secret := os.Getenv("JWT_SECRET")
	if clientID == "" || clientSecret == "" {
		log.Fatal("GITHUB_CLIENT_ID dan GITHUB_CLIENT_SECRET wajib di-set")
	}
	if redirectURL == "" {
		redirectURL = "http://localhost:5000/github-callback"
	}
        if secret == "" {
        log.Fatal("ERROR: JWT_SECRET is not set in environment variables")

        }

        JWTKey =  []byte(secret)

	OAuthConf = &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"user:email", "read:user"},
		Endpoint:     github.Endpoint,
	}
}
