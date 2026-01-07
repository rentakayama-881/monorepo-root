package services

import (
	"context"
)

// SudoValidatorAdapter adapts EntSudoService to middleware.SudoValidator interface
// by providing a context-less ValidateToken method.
// This avoids circular imports by keeping it in services package.
type SudoValidatorAdapter struct {
	svc *EntSudoService
}

func NewSudoValidatorAdapter(svc *EntSudoService) *SudoValidatorAdapter {
	return &SudoValidatorAdapter{svc: svc}
}

func (a *SudoValidatorAdapter) ValidateToken(userID uint, token string) (bool, error) {
	return a.svc.ValidateToken(context.Background(), int(userID), token)
}
