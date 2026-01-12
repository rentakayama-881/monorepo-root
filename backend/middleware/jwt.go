package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"backend-gin/config"

	"github.com/golang-jwt/jwt/v4"
)

// TokenType represents the type of JWT token
type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

// Claims represents JWT claims with enhanced security fields
type Claims struct {
	UserID      uint      `json:"user_id"`
	Email       string    `json:"email"`
	Username    string    `json:"username,omitempty"`
	TotpEnabled bool      `json:"totp_enabled"`
	TokenType   TokenType `json:"type"`
	JTI         string    `json:"jti"` // Unique token ID
	jwt.RegisteredClaims
}

// generateJTI creates a unique token identifier
func generateJTI() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// GenerateAccessToken creates a short-lived access token (5 minutes)
func GenerateAccessToken(userID uint, email string, username string, totpEnabled bool) (string, string, error) {
	jti := generateJTI()
	claims := &Claims{
		UserID:      userID,
		Email:       email,
		Username:    username,
		TotpEnabled: totpEnabled,
		TokenType:   TokenTypeAccess,
		JTI:         jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(config.JWTKey)
	return signed, jti, err
}

// GenerateRefreshToken creates a long-lived refresh token (7 days)
func GenerateRefreshToken(userID uint, email string, username string, totpEnabled bool) (string, string, error) {
	jti := generateJTI()
	claims := &Claims{
		UserID:      userID,
		Email:       email,
		Username:    username,
		TotpEnabled: totpEnabled,
		TokenType:   TokenTypeRefresh,
		JTI:         jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(config.JWTKey)
	return signed, jti, err
}

// GenerateJWT creates a JWT token (legacy - for backward compatibility during migration)
func GenerateJWT(email string, duration time.Duration) (string, error) {
	claims := &Claims{
		Email:     email,
		TokenType: TokenTypeAccess,
		JTI:       generateJTI(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(config.JWTKey)
}

// ParseJWT parses and validates a JWT token string, returning the Claims if valid.
func ParseJWT(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return config.JWTKey, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token")
}
