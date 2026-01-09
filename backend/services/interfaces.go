// Package services provides business logic for the application.
// This file defines service interfaces for clean architecture abstraction.
// Handlers depend on interfaces, not concrete implementations.
package services

import (
	"context"

	"backend-gin/validators"
)

// ThreadServiceInterface defines the contract for thread operations.
// EntThreadService (Ent) implements this interface.
type ThreadServiceInterface interface {
	CreateThread(ctx context.Context, userID uint, input validators.CreateThreadInput) (*ThreadDetailResponse, error)
	UpdateThread(ctx context.Context, userID uint, input validators.UpdateThreadInput) error
	GetThreadByID(ctx context.Context, threadID uint) (*ThreadDetailResponse, error)
	GetCategories(ctx context.Context) ([]CategoryResponse, error)
	ListLatestThreads(ctx context.Context, categorySlug string, limit int) ([]ThreadListItem, error)
	ListThreadsByCategory(ctx context.Context, categorySlug string, limit int) (*CategoryWithThreadsResponse, error)
	ListUserThreads(ctx context.Context, userID uint) ([]ThreadListItem, error)
	ListThreadsByUsername(ctx context.Context, username string) ([]ThreadListItem, error)
}

// Ensure EntThreadService satisfies interface (compile-time check)
var _ ThreadServiceInterface = (*EntThreadService)(nil)
