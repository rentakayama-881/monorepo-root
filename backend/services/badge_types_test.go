package services

import (
"testing"
"time"
)

func TestBadgeType_Fields(t *testing.T) {
now := time.Now()
b := Badge{
ID:          1,
Name:        "Test Badge",
Slug:        "test-badge",
Description: "A test badge",
IconType:    "emoji",
Color:       "#ff0000",
CreatedAt:   now,
UpdatedAt:   now,
}
if b.ID != 1 {
t.Errorf("ID = %d", b.ID)
}
if b.Slug != "test-badge" {
t.Errorf("Slug = %q", b.Slug)
}
if b.IconType != "emoji" {
t.Errorf("IconType = %q", b.IconType)
}
if b.Color != "#ff0000" {
t.Errorf("Color = %q", b.Color)
}
}
