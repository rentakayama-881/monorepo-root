package services

import (
	"context"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// EntUserService handles user business logic using Ent ORM
type EntUserService struct {
	client *ent.Client
}

// NewEntUserService creates a new user service with Ent
func NewEntUserService() *EntUserService {
	return &EntUserService{client: database.GetEntClient()}
}

// GetUserByID retrieves a user by ID
func (s *EntUserService) GetUserByID(ctx context.Context, userID int) (*ent.User, error) {
	u, err := s.client.User.
		Query().
		Where(user.IDEQ(userID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		logger.Error("Failed to get user by ID", zap.Error(err), zap.Int("user_id", userID))
		return nil, apperrors.ErrDatabase
	}
	return u, nil
}

// GetUserByUsername retrieves a user by username
func (s *EntUserService) GetUserByUsername(ctx context.Context, username string) (*ent.User, error) {
	u, err := s.client.User.
		Query().
		Where(user.UsernameEQ(username)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		logger.Error("Failed to get user by username", zap.Error(err), zap.String("username", username))
		return nil, apperrors.ErrDatabase
	}
	return u, nil
}

// GetUserByEmail retrieves a user by email
func (s *EntUserService) GetUserByEmail(ctx context.Context, email string) (*ent.User, error) {
	u, err := s.client.User.
		Query().
		Where(user.EmailEQ(email)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		logger.Error("Failed to get user by email", zap.Error(err), zap.String("email", email))
		return nil, apperrors.ErrDatabase
	}
	return u, nil
}

// UpdateUsername updates user's username
func (s *EntUserService) UpdateUsername(ctx context.Context, userID int, username string) error {
	_, err := s.client.User.
		UpdateOneID(userID).
		SetUsername(username).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrUserNotFound
		}
		// Check for unique constraint violation
		if ent.IsConstraintError(err) {
			return apperrors.ErrUsernameAlreadyExists
		}
		logger.Error("Failed to update username", zap.Error(err), zap.Int("user_id", userID))
		return apperrors.ErrDatabase
	}
	return nil
}

// UpdateAvatarURL updates user's avatar URL
func (s *EntUserService) UpdateAvatarURL(ctx context.Context, userID int, avatarURL string) error {
	_, err := s.client.User.
		UpdateOneID(userID).
		SetAvatarURL(avatarURL).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrUserNotFound
		}
		logger.Error("Failed to update avatar URL", zap.Error(err), zap.Int("user_id", userID))
		return apperrors.ErrDatabase
	}
	return nil
}

// IsEmailVerified checks if user's email is verified
func (s *EntUserService) IsEmailVerified(ctx context.Context, userID int) (bool, error) {
	u, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return u.EmailVerified, nil
}

// CheckUsernameAvailable checks if a username is available
func (s *EntUserService) CheckUsernameAvailable(ctx context.Context, username string) (bool, error) {
	exists, err := s.client.User.
		Query().
		Where(user.UsernameEQ(username)).
		Exist(ctx)
	if err != nil {
		logger.Error("Failed to check username availability", zap.Error(err))
		return false, apperrors.ErrDatabase
	}
	return !exists, nil
}

// GetUserWithBadges retrieves user with their badges
func (s *EntUserService) GetUserWithBadges(ctx context.Context, userID int) (*ent.User, error) {
	u, err := s.client.User.
		Query().
		Where(user.IDEQ(userID)).
		WithUserBadges(func(q *ent.UserBadgeQuery) {
			q.WithBadge()
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		logger.Error("Failed to get user with badges", zap.Error(err), zap.Int("user_id", userID))
		return nil, apperrors.ErrDatabase
	}
	return u, nil
}
