package middleware

import "time"

// Common rate limiters used across the application
// All use the same configuration: 5 attempts per 15 minutes

var (
	// PINVerificationLimiter limits PIN verification attempts to prevent brute-force attacks
	// Used for: wallet PIN verification, transfer PIN, withdrawal PIN
	PINVerificationLimiter = NewRateLimiter(5, 15*time.Minute)

	// AdminLoginLimiter limits admin login attempts
	AdminLoginLimiter = NewRateLimiter(5, 15*time.Minute)
)
