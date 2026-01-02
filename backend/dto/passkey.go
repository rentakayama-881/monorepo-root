package dto

import "time"

// PasskeyResponse represents a passkey in API responses
type PasskeyResponse struct {
	ID          uint       `json:"id"`
	Name        string     `json:"name"`
	CreatedAt   time.Time  `json:"created_at"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	Transports  []string   `json:"transports,omitempty"`
}

// PasskeyListResponse is the response for listing passkeys
type PasskeyListResponse struct {
	Passkeys []PasskeyResponse `json:"passkeys"`
	Count    int               `json:"count"`
}

// PasskeyStatusResponse indicates if user has passkeys
type PasskeyStatusResponse struct {
	HasPasskeys bool `json:"has_passkeys"`
	Count       int  `json:"count"`
}

// PasskeyRegisterBeginResponse is sent to client to start registration
type PasskeyRegisterBeginResponse struct {
	Options interface{} `json:"options"`
}

// PasskeyRegisterFinishRequest is sent from client to complete registration
type PasskeyRegisterFinishRequest struct {
	Name       string      `json:"name"`
	Credential interface{} `json:"credential"`
}

// PasskeyLoginBeginRequest starts login with email
type PasskeyLoginBeginRequest struct {
	Email string `json:"email,omitempty"` // Optional for discoverable login
}

// PasskeyLoginBeginResponse is sent to client to start login
type PasskeyLoginBeginResponse struct {
	Options   interface{} `json:"options"`
	SessionID string      `json:"session_id,omitempty"` // For discoverable login
}

// PasskeyLoginFinishRequest is sent from client to complete login
type PasskeyLoginFinishRequest struct {
	Email      string      `json:"email,omitempty"`      // For non-discoverable login
	SessionID  string      `json:"session_id,omitempty"` // For discoverable login
	Credential interface{} `json:"credential"`
}

// PasskeyRenameRequest is for renaming a passkey
type PasskeyRenameRequest struct {
	Name string `json:"name" binding:"required,min=1,max=50"`
}

// PasskeyCheckRequest checks if email has passkeys (for login UI)
type PasskeyCheckRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// PasskeyCheckResponse returns passkey availability
type PasskeyCheckResponse struct {
	HasPasskeys bool `json:"has_passkeys"`
}
