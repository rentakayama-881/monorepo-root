package middleware

import (
"testing"
)

func TestDefaultRequestSizeLimits(t *testing.T) {
limits := DefaultRequestSizeLimits()

if limits.DefaultMaxSize <= 0 {
t.Error("DefaultMaxSize should be positive")
}
if limits.JSONMaxSize <= 0 {
t.Error("JSONMaxSize should be positive")
}
if limits.FileUploadMaxSize <= 0 {
t.Error("FileUploadMaxSize should be positive")
}
if limits.AvatarMaxSize <= 0 {
t.Error("AvatarMaxSize should be positive")
}

// Relationships
if limits.JSONMaxSize < limits.DefaultMaxSize {
t.Error("JSONMaxSize should be >= DefaultMaxSize")
}
if limits.FileUploadMaxSize < limits.JSONMaxSize {
t.Error("FileUploadMaxSize should be >= JSONMaxSize")
}
if limits.AvatarMaxSize < limits.DefaultMaxSize {
t.Error("AvatarMaxSize should be >= DefaultMaxSize")
}
}

func TestDefaultRequestSizeLimits_Values(t *testing.T) {
limits := DefaultRequestSizeLimits()

if limits.DefaultMaxSize != 1*1024*1024 {
t.Errorf("DefaultMaxSize = %d, want 1MB", limits.DefaultMaxSize)
}
if limits.JSONMaxSize != 5*1024*1024 {
t.Errorf("JSONMaxSize = %d, want 5MB", limits.JSONMaxSize)
}
if limits.FileUploadMaxSize != 50*1024*1024 {
t.Errorf("FileUploadMaxSize = %d, want 50MB", limits.FileUploadMaxSize)
}
if limits.AvatarMaxSize != 2*1024*1024 {
t.Errorf("AvatarMaxSize = %d, want 2MB", limits.AvatarMaxSize)
}
}
