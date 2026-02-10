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
	ErrInvalidCredentials    = NewAppError("AUTH001", "Email atau password yang Anda masukkan salah", http.StatusUnauthorized)
	ErrEmailNotVerified      = NewAppError("AUTH002", "Email belum terverifikasi. Silakan cek inbox email Anda.", http.StatusForbidden)
	ErrEmailAlreadyExists    = NewAppError("AUTH003", "Email ini sudah terdaftar dan terverifikasi. Silakan login.", http.StatusBadRequest)
	ErrUsernameAlreadyExists = NewAppError("AUTH004", "Username sudah digunakan. Silakan pilih username lain.", http.StatusConflict)
	ErrInvalidToken          = NewAppError("AUTH005", "Token tidak valid atau sudah kedaluwarsa", http.StatusUnauthorized)
	ErrTokenExpired          = NewAppError("AUTH006", "Token sudah kedaluwarsa", http.StatusUnauthorized)
	ErrWeakPassword          = NewAppError("AUTH007", "Password terlalu lemah. Gunakan minimal 8 karakter.", http.StatusBadRequest)
	ErrInvalidEmail          = NewAppError("AUTH008", "Format email tidak valid", http.StatusBadRequest)
	ErrAccountLocked         = NewAppError("AUTH009", "Akun terkunci karena aktivitas mencurigakan", http.StatusForbidden)
	ErrSessionInvalid        = NewAppError("AUTH010", "Session tidak valid atau sudah dicabut", http.StatusUnauthorized)
	ErrSessionExpired        = NewAppError("AUTH011", "Session sudah berakhir, silakan login kembali", http.StatusUnauthorized)

	// Brute force protection errors
	ErrAccountLockedBruteForce = NewAppError("AUTH012", "Akun dikunci sementara karena terlalu banyak percobaan login gagal", http.StatusForbidden)
	ErrLoginAttemptDelayed     = NewAppError("AUTH013", "Mohon tunggu sebelum mencoba login kembali", http.StatusTooManyRequests)
	ErrTOTPMaxAttempts         = NewAppError("AUTH014", "Terlalu banyak percobaan verifikasi. Silakan coba lagi nanti.", http.StatusTooManyRequests)
	ErrIPBlocked               = NewAppError("AUTH015", "Akses dari IP Anda diblokir sementara", http.StatusForbidden)

	// Email rate limiting errors
	ErrVerificationLimitReached  = NewAppError("AUTH016", "Batas pengiriman email verifikasi tercapai. Coba lagi dalam 24 jam.", http.StatusTooManyRequests)
	ErrPasswordResetLimitReached = NewAppError("AUTH017", "Batas pengiriman email reset password tercapai. Coba lagi dalam 24 jam.", http.StatusTooManyRequests)
	ErrIPEmailLimitReached       = NewAppError("AUTH018", "Terlalu banyak permintaan email dari IP ini. Coba lagi nanti.", http.StatusTooManyRequests)

	// Device tracking errors
	ErrDeviceLimitReached = NewAppError("AUTH019", "Perangkat ini sudah digunakan untuk maksimal akun yang diizinkan", http.StatusForbidden)
	ErrDeviceBlocked      = NewAppError("AUTH020", "Perangkat ini diblokir karena aktivitas mencurigakan", http.StatusForbidden)

	// User errors
	ErrUserNotFound     = NewAppError("USER001", "Pengguna tidak ditemukan", http.StatusNotFound)
	ErrUnauthorized     = NewAppError("USER002", "Tidak memiliki akses", http.StatusUnauthorized)
	ErrInvalidUserInput = NewAppError("USER003", "Username harus menggunakan huruf kecil, tanpa spasi, dan minimal 7 character", http.StatusBadRequest)

	// Validation Case errors (domain replacement for legacy "Thread")
	ErrValidationCaseNotFound    = NewAppError("CASE001", "Validation Case tidak ditemukan", http.StatusNotFound)
	ErrCategoryNotFound          = NewAppError("CASE002", "Kategori tidak ditemukan", http.StatusNotFound)
	ErrInvalidValidationCaseData = NewAppError("CASE003", "Data Validation Case tidak valid", http.StatusBadRequest)
	ErrValidationCaseOwnership   = NewAppError("CASE004", "Anda tidak memiliki akses ke Validation Case ini", http.StatusForbidden)

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
	ErrTooManyRequests   = NewAppError("RATE001", "Terlalu banyak percobaan. Coba lagi nanti.", http.StatusTooManyRequests)
	ErrRateLimitExceeded = NewAppError("RATE002", "Batas permintaan tercapai. Coba lagi nanti.", http.StatusTooManyRequests)
)
