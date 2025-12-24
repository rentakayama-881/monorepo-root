package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateNoXSS(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "Valid text",
			input:    "Hello World",
			expected: true,
		},
		{
			name:     "Text with special chars",
			input:    "Test @#$%^&*()",
			expected: true,
		},
		{
			name:     "Script tag lowercase",
			input:    "<script>alert('XSS')</script>",
			expected: false,
		},
		{
			name:     "Script tag uppercase",
			input:    "<SCRIPT>alert('XSS')</SCRIPT>",
			expected: false,
		},
		{
			name:     "onclick handler",
			input:    "<img src=x onclick='alert(1)'>",
			expected: false,
		},
		{
			name:     "onerror handler",
			input:    "<img src=x onerror='alert(1)'>",
			expected: false,
		},
		{
			name:     "javascript protocol",
			input:    "<a href='javascript:alert(1)'>Click</a>",
			expected: false,
		},
		{
			name:     "data protocol with script",
			input:    "<a href='data:text/html,<script>alert(1)</script>'>Click</a>",
			expected: false,
		},
		{
			name:     "Normal URL",
			input:    "https://example.com/page",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateNoXSS(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeText(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Plain text",
			input:    "Hello World",
			expected: "Hello World",
		},
		{
			name:     "HTML entities",
			input:    "<script>alert('XSS')</script>",
			expected: "&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;",
		},
		{
			name:     "Quotes and special chars",
			input:    "Test \"quotes\" & 'apostrophes'",
			expected: "Test &#34;quotes&#34; &amp; &#39;apostrophes&#39;",
		},
		{
			name:     "With whitespace",
			input:    "  Hello World  ",
			expected: "Hello World",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeText(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeUsername(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Valid username",
			input:    "john_doe",
			expected: "john_doe",
		},
		{
			name:     "Username with special chars",
			input:    "user-123",
			expected: "user-123",
		},
		{
			name:     "Username with invalid chars",
			input:    "user<script>",
			expected: "userscript",
		},
		{
			name:     "Username with spaces",
			input:    "john doe",
			expected: "johndoe",
		},
		{
			name:     "Username with @ symbol",
			input:    "user@test",
			expected: "usertest",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeUsername(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeEmail(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Valid email",
			input:    "test@example.com",
			expected: "test@example.com",
		},
		{
			name:     "Email with uppercase",
			input:    "Test@Example.COM",
			expected: "test@example.com",
		},
		{
			name:     "Email with whitespace",
			input:    "  test@example.com  ",
			expected: "test@example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeEmail(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRemoveScriptTags(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Script tag removal",
			input:    "Hello <script>alert('XSS')</script> World",
			expected: "Hello  World",
		},
		{
			name:     "Multiple script tags",
			input:    "<script>alert(1)</script>Text<script>alert(2)</script>",
			expected: "Text",
		},
		{
			name:     "onclick handler removal",
			input:    "<div onclick='alert(1)'>Click me</div>",
			expected: "<div>Click me</div>",
		},
		{
			name:     "javascript protocol removal",
			input:    "<a href='javascript:alert(1)'>Link</a>",
			expected: "<a href='alert(1)'>Link</a>",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := RemoveScriptTags(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
