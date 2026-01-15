package services

import "time"

// Badge represents a badge/achievement in the system
type Badge struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	IconType    string    `json:"icon_type"`
	Color       string    `json:"color"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}
