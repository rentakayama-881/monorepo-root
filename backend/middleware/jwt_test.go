package middleware

import (
"testing"
)

func TestTokenTypeConstants(t *testing.T) {
if TokenTypeAccess == "" {
t.Error("TokenTypeAccess should not be empty")
}
if TokenTypeRefresh == "" {
t.Error("TokenTypeRefresh should not be empty")
}
if TokenTypeAccess == TokenTypeRefresh {
t.Error("access and refresh types should differ")
}
}

func TestGenerateJTI(t *testing.T) {
jti := generateJTI()
if jti == "" {
t.Error("JTI should not be empty")
}
if len(jti) != 32 { // 16 bytes = 32 hex chars
t.Errorf("JTI length = %d, want 32", len(jti))
}

// Uniqueness
jti2 := generateJTI()
if jti == jti2 {
t.Error("two JTIs should be different")
}
}

func TestClaimsType(t *testing.T) {
c := Claims{
UserID:    1,
Email:     "test@example.com",
Username:  "testuser",
TokenType: TokenTypeAccess,
JTI:       "test-jti",
}
if c.UserID != 1 {
t.Errorf("UserID = %d, want 1", c.UserID)
}
if c.TokenType != TokenTypeAccess {
t.Errorf("TokenType = %q, want %q", c.TokenType, TokenTypeAccess)
}
}
