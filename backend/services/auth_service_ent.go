package services

import (
	"context"
	"fmt"

	"backend-gin/database"
	"backend-gin/ent"
)

type EntAuthService struct {
	client *ent.Client
}

// Dummy hash to compare against when user is not found.
// This normalizes response timing to prevent user enumeration.
// Generated from: bcrypt.GenerateFromPassword([]byte("timing-normalization-dummy"), bcrypt.DefaultCost)
var dummyHash = []byte("$2a$10$r78az4KdysLrrksJR97TWOKm4mi.bgybysZwFrDFGBLfhYRvvZxGa")

func NewEntAuthService() *EntAuthService {
	return &EntAuthService{client: database.GetEntClient()}
}

type VerificationRequestResult struct {
	Sent              bool
	RetryAfterSeconds int
}

func strVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// WithTx runs a function in a transaction
func WithTx(ctx context.Context, client *ent.Client, fn func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()
	if err := fn(tx); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("%w: rolling back transaction: %v", err, rerr)
		}
		return err
	}
	return tx.Commit()
}

// entUserToModel converts Ent User to models.User for compatibility
func entUserToModel(u *ent.User) *User {
	modelUser := &User{
		Email:         u.Email,
		PasswordHash:  u.PasswordHash,
		EmailVerified: u.EmailVerified,
		AvatarURL:     u.AvatarURL,
		Username:      u.Username,
		FullName:      u.FullName,
	}
	modelUser.ID = uint(u.ID)
	modelUser.CreatedAt = u.CreatedAt
	modelUser.UpdatedAt = u.UpdatedAt

	if u.TotpSecret != nil {
		modelUser.TOTPSecret = *u.TotpSecret
	}
	if u.LockedUntil != nil {
		modelUser.LockedUntil = u.LockedUntil
	}
	modelUser.LockReason = u.LockReason

	return modelUser
}
