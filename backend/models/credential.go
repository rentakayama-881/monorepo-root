package models

import "gorm.io/gorm"

type Credential struct {
	gorm.Model
	UserID      uint   `json:"user_id"`
	Platform    string `json:"platform"`
	Description string `json:"description"`
}
