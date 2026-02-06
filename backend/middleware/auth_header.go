package middleware

import "strings"

// parseBearerToken extracts a JWT token from Authorization header.
// Accepts case-insensitive "Bearer" scheme and tolerates extra whitespace.
func parseBearerToken(authHeader string) (string, bool) {
	fields := strings.Fields(authHeader)
	if len(fields) != 2 {
		return "", false
	}

	if !strings.EqualFold(fields[0], "Bearer") {
		return "", false
	}

	token := strings.TrimSpace(fields[1])
	if token == "" {
		return "", false
	}

	return token, true
}
