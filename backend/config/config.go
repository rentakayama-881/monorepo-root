package config

import (
	"log"
	"os"
)

var (
	JWTKey []byte
)

func InitConfig() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("ERROR: JWT_SECRET is not set in environment variables")
	}
	JWTKey = []byte(secret)

}
