package errors

import "net/http"

// AppError represents a structured application error
type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	StatusCode int    `json:"-"`
	Details    string `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	if e.Details != "" {
		return e.Message + ": " + e.Details
	}
	return e.Message
}

// NewAppError creates a new application error
func NewAppError(code, message string, statusCode int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
	}
}

// WithDetails adds details to an error
func (e *AppError) WithDetails(details string) *AppError {
	return &AppError{
		Code:       e.Code,
		Message:    e.Message,
		StatusCode: e.StatusCode,
		Details:    details,
	}
}

// Common error definitions
var (
	// Auth errors
	ErrInvalidCredentials    = NewAppError("AUTH001", "Kredensial tidak valid", http.StatusUnauthorized)
	ErrEmailNotVerified      = NewAppError("AUTH002", "Email belum terverifikasi", http.StatusForbidden)
	ErrEmailAlreadyExists    = NewAppError("AUTH003", "Email sudah terdaftar", http.StatusBadRequest)
	ErrUsernameAlreadyExists = NewAppError("AUTH004", "Username sudah digunakan", http.StatusConflict)
	ErrInvalidToken          = NewAppError("AUTH005", "Token tidak valid atau sudah kedaluwarsa", http.StatusBadRequest)
	ErrTokenExpired          = NewAppError("AUTH006", "Token sudah kedaluwarsa", http.StatusBadRequest)
	ErrWeakPassword          = NewAppError("AUTH007", "Password terlalu lemah", http.StatusBadRequest)
	ErrInvalidEmail          = NewAppError("AUTH008", "Format email tidak valid", http.StatusBadRequest)

	// User errors
	ErrUserNotFound     = NewAppError("USER001", "Pengguna tidak ditemukan", http.StatusNotFound)
	ErrUnauthorized     = NewAppError("USER002", "Tidak memiliki akses", http.StatusUnauthorized)
	ErrInvalidUserInput = NewAppError("USER003", "Input pengguna tidak valid", http.StatusBadRequest)

	// Thread errors
	ErrThreadNotFound    = NewAppError("THREAD001", "Thread tidak ditemukan", http.StatusNotFound)
	ErrCategoryNotFound  = NewAppError("THREAD002", "Kategori tidak ditemukan", http.StatusNotFound)
	ErrInvalidThreadData = NewAppError("THREAD003", "Data thread tidak valid", http.StatusBadRequest)
	ErrThreadOwnership   = NewAppError("THREAD004", "Anda tidak memiliki akses ke thread ini", http.StatusForbidden)

	// Order errors
	ErrOrderNotFound      = NewAppError("ORDER001", "Order tidak ditemukan", http.StatusNotFound)
	ErrInvalidOrderData   = NewAppError("ORDER002", "Data order tidak valid", http.StatusBadRequest)
	ErrOrderAlreadyExists = NewAppError("ORDER003", "Order sudah ada", http.StatusConflict)

	// Validation errors
	ErrValidationFailed   = NewAppError("VAL001", "Validasi gagal", http.StatusBadRequest)
	ErrInvalidInput       = NewAppError("VAL002", "Input tidak valid", http.StatusBadRequest)
	ErrMissingField       = NewAppError("VAL003", "Field wajib tidak ada", http.StatusBadRequest)
	ErrInvalidRequestBody = NewAppError("VAL004", "Request body tidak valid", http.StatusBadRequest)

	// Internal errors
	ErrInternalServer = NewAppError("SRV001", "Terjadi kesalahan internal", http.StatusInternalServerError)
	ErrDatabase       = NewAppError("SRV002", "Kesalahan database", http.StatusInternalServerError)
	ErrEmailService   = NewAppError("SRV003", "Gagal mengirim email", http.StatusInternalServerError)

	// Rate limiting
	ErrTooManyRequests = NewAppError("RATE001", "Terlalu banyak percobaan. Coba lagi nanti.", http.StatusTooManyRequests)
)
