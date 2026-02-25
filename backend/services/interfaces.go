// Package services provides business logic for the application.
// This file defines service interfaces for clean architecture abstraction.
// Handlers depend on interfaces, not concrete implementations.
package services

import (
	"context"

	"backend-gin/validators"
)

// ValidationCaseServiceInterface defines the contract for Validation Case operations.
// EntValidationCaseService (Ent) implements this interface.
type ValidationCaseServiceInterface interface {
	CreateValidationCase(ctx context.Context, ownerUserID uint, input validators.CreateValidationCaseInput, authHeader string) (*ValidationCaseDetailResponse, error)
	UpdateValidationCase(ctx context.Context, ownerUserID uint, input validators.UpdateValidationCaseInput) error
	DeleteValidationCase(ctx context.Context, ownerUserID uint, validationCaseID uint) error
	GetValidationCaseByID(ctx context.Context, validationCaseID uint, viewerUserID uint) (*ValidationCaseDetailResponse, error)

	GetCategories(ctx context.Context) ([]CategoryResponse, error)

	ListLatestValidationCases(ctx context.Context, categorySlug string, limit int) ([]ValidationCaseListItem, error)
	ListValidationCasesByCategory(ctx context.Context, categorySlug string, limit int) (*CategoryWithValidationCasesResponse, error)
	ListUserValidationCases(ctx context.Context, ownerUserID uint) ([]ValidationCaseListItem, error)
	ListValidationCasesByUsername(ctx context.Context, username string) ([]ValidationCaseListItem, error)
}

// Ensure EntValidationCaseService satisfies interface (compile-time check)
var _ ValidationCaseServiceInterface = (*EntValidationCaseService)(nil)
