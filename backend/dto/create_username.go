package dto

type CreateUsernameRequest struct {
	Username   string `json:"username" binding:"required"`
}
