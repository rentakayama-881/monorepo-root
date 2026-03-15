package errors

import (
	"net/http"
	"testing"
)

func TestNewAppError(t *testing.T) {
	err := NewAppError("TEST001", "test message", http.StatusBadRequest)
	if err == nil {
		t.Fatal("NewAppError returned nil")
	}
	if err.Code != "TEST001" {
		t.Errorf("Code = %q, want TEST001", err.Code)
	}
	if err.Message != "test message" {
		t.Errorf("Message = %q, want 'test message'", err.Message)
	}
	if err.StatusCode != http.StatusBadRequest {
		t.Errorf("StatusCode = %d, want %d", err.StatusCode, http.StatusBadRequest)
	}
	if err.Details != "" {
		t.Errorf("Details should be empty, got %q", err.Details)
	}
}

func TestAppError_Error(t *testing.T) {
	err := NewAppError("E1", "msg", 400)
	if got := err.Error(); got != "msg" {
		t.Errorf("Error() = %q, want 'msg'", got)
	}

	errWithDetails := err.WithDetails("some detail")
	if got := errWithDetails.Error(); got != "msg: some detail" {
		t.Errorf("Error() with details = %q, want 'msg: some detail'", got)
	}
}

func TestAppError_WithDetails(t *testing.T) {
	original := NewAppError("E2", "original", http.StatusNotFound)
	detailed := original.WithDetails("extra info")

	// Should not mutate original
	if original.Details != "" {
		t.Errorf("Original should not be mutated, got Details=%q", original.Details)
	}

	// Detailed should have the details
	if detailed.Details != "extra info" {
		t.Errorf("Detailed.Details = %q, want 'extra info'", detailed.Details)
	}
	if detailed.Code != original.Code {
		t.Errorf("Code should be preserved: got %q, want %q", detailed.Code, original.Code)
	}
	if detailed.Message != original.Message {
		t.Errorf("Message should be preserved: got %q, want %q", detailed.Message, original.Message)
	}
	if detailed.StatusCode != original.StatusCode {
		t.Errorf("StatusCode should be preserved: got %d, want %d", detailed.StatusCode, original.StatusCode)
	}
}

func TestErrorResponse(t *testing.T) {
	err := NewAppError("E3", "resp msg", 500)
	resp := ErrorResponse(err)

	if resp["code"] != "E3" {
		t.Errorf("response code = %v, want E3", resp["code"])
	}
	if resp["message"] != "resp msg" {
		t.Errorf("response message = %v, want 'resp msg'", resp["message"])
	}
	if _, exists := resp["details"]; exists {
		t.Error("details should not be present when empty")
	}
}

func TestErrorResponse_WithDetails(t *testing.T) {
	err := NewAppError("E4", "msg", 400).WithDetails("detail here")
	resp := ErrorResponse(err)

	if resp["details"] != "detail here" {
		t.Errorf("response details = %v, want 'detail here'", resp["details"])
	}
}

func TestPredefinedErrors_HaveValidHTTPCodes(t *testing.T) {
	errors := []*AppError{
		ErrInvalidCredentials,
		ErrEmailNotVerified,
		ErrEmailAlreadyExists,
		ErrUsernameAlreadyExists,
		ErrInvalidToken,
		ErrTokenExpired,
		ErrWeakPassword,
		ErrInvalidEmail,
		ErrAccountLocked,
		ErrSessionInvalid,
		ErrSessionExpired,
		ErrUserNotFound,
		ErrUnauthorized,
		ErrValidationCaseNotFound,
		ErrCategoryNotFound,
		ErrOrderNotFound,
		ErrValidationFailed,
		ErrInvalidInput,
		ErrMissingField,
		ErrInvalidRequestBody,
		ErrInternalServer,
		ErrDatabase,
		ErrEmailService,
		ErrTooManyRequests,
		ErrRateLimitExceeded,
	}
	for _, e := range errors {
		if e.StatusCode < 100 || e.StatusCode >= 600 {
			t.Errorf("Error %s has invalid HTTP status code: %d", e.Code, e.StatusCode)
		}
		if e.Code == "" {
			t.Error("Error has empty code")
		}
		if e.Message == "" {
			t.Error("Error has empty message")
		}
	}
}

func TestPredefinedErrors_CodeUniqueness(t *testing.T) {
	errors := []*AppError{
		ErrInvalidCredentials,
		ErrEmailNotVerified,
		ErrEmailAlreadyExists,
		ErrUsernameAlreadyExists,
		ErrInvalidToken,
		ErrTokenExpired,
		ErrWeakPassword,
		ErrInvalidEmail,
		ErrAccountLocked,
		ErrSessionInvalid,
		ErrSessionExpired,
		ErrAccountLockedBruteForce,
		ErrLoginAttemptDelayed,
		ErrTOTPMaxAttempts,
		ErrIPBlocked,
		ErrVerificationLimitReached,
		ErrPasswordResetLimitReached,
		ErrIPEmailLimitReached,
		ErrDeviceLimitReached,
		ErrDeviceBlocked,
		ErrTelegramAuthInvalid,
		ErrUserNotFound,
		ErrUnauthorized,
		ErrInvalidUserInput,
		ErrTelegramAlreadyLinked,
		ErrValidationCaseNotFound,
		ErrCategoryNotFound,
		ErrInvalidValidationCaseData,
		ErrValidationCaseOwnership,
		ErrCaseLogAccessDenied,
		ErrConsultationNotApproved,
		ErrFinalOfferRequiresApproval,
		ErrArtifactSubmissionAccessDenied,
		ErrTelegramVerificationRequired,
		ErrOrderNotFound,
		ErrInvalidOrderData,
		ErrOrderAlreadyExists,
		ErrValidationFailed,
		ErrInvalidInput,
		ErrMissingField,
		ErrInvalidRequestBody,
		ErrInternalServer,
		ErrDatabase,
		ErrEmailService,
		ErrTooManyRequests,
		ErrRateLimitExceeded,
	}
	seen := make(map[string]bool)
	for _, e := range errors {
		if seen[e.Code] {
			t.Errorf("Duplicate error code: %s", e.Code)
		}
		seen[e.Code] = true
	}
}
