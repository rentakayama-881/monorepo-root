package utils

import (
	"testing"
)

func TestInputSecurityValidator_SQLInjection(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name     string
		input    string
		wantSafe bool
	}{
		{"Normal text", "Hello world", true},
		{"Normal email", "user@example.com", true},
		{"Simple OR injection", "1 OR 1=1", false},
		{"Single quote OR", "' OR '1'='1", false},
		{"UNION SELECT", "1 UNION SELECT * FROM users", false},
		{"DROP TABLE", "'; DROP TABLE users; --", false},
		{"SQL comment with terminator", "admin';--", false},
		{"WAITFOR DELAY", "'; WAITFOR DELAY '0:0:10'", false},
		{"SLEEP function", "1; SLEEP(5)", false},
		{"BENCHMARK", "1; BENCHMARK(1000000,SHA1('test'))", false},
		{"LOAD_FILE", "LOAD_FILE('/etc/passwd')", false},
		{"Information schema", "SELECT * FROM INFORMATION_SCHEMA.TABLES", false},
		{"Normal SQL-like text", "Select your favorite option", true},
		{"Normal text with SELECT word", "Please select an item", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSafe := v.IsSafeFromSQLInjection(tt.input)
			if gotSafe != tt.wantSafe {
				t.Errorf("IsSafeFromSQLInjection(%q) = %v, want %v", tt.input, gotSafe, tt.wantSafe)
			}
		})
	}
}

func TestInputSecurityValidator_XSS(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name     string
		input    string
		wantSafe bool
	}{
		{"Normal text", "Hello world", true},
		{"HTML entities", "&amp; &lt; &gt;", true},
		{"Script tag", "<script>alert('xss')</script>", false},
		{"Script tag uppercase", "<SCRIPT>alert('xss')</SCRIPT>", false},
		{"Img onerror", "<img src=x onerror=alert('xss')>", false},
		{"onclick handler", "<div onclick=\"alert('xss')\">click</div>", false},
		{"javascript: protocol", "<a href=\"javascript:alert('xss')\">link</a>", false},
		{"SVG onload", "<svg onload=alert('xss')>", false},
		{"URL encoded script", "%3Cscript%3Ealert('xss')%3C/script%3E", false},
		{"Double encoded", "%253Cscript%253E", false},
		{"Null byte", "test\x00<script>", false},
		{"iframe", "<iframe src=\"evil.com\">", false},
		{"data: base64", "data:text/html;base64,PHNjcmlwdD4=", false},
		{"CSS expression", "expression(alert('xss'))", false},
		{"Normal URL", "https://example.com/page?id=123", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSafe := v.IsSafeFromXSS(tt.input)
			if gotSafe != tt.wantSafe {
				t.Errorf("IsSafeFromXSS(%q) = %v, want %v", tt.input, gotSafe, tt.wantSafe)
			}
		})
	}
}

func TestInputSecurityValidator_PathTraversal(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name     string
		input    string
		wantSafe bool
	}{
		{"Normal path", "/images/avatar.png", true},
		{"Normal filename", "document.pdf", true},
		{"Dot dot slash", "../../../etc/passwd", false},
		{"URL encoded", "..%2f..%2f..%2fetc%2fpasswd", false},
		{"Backslash", "..\\..\\..\\windows\\system32", false},
		{"etc passwd", "/etc/passwd", false},
		{"etc shadow", "/etc/shadow", false},
		{"Windows system", "c:\\windows\\system32", false},
		{".htaccess", ".htaccess", false},
		{".env", ".env", false},
		{".git", ".git/config", false},
		{"id_rsa", "/home/user/.ssh/id_rsa", false},
		{"proc self", "/proc/self/environ", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSafe := v.IsSafeFromPathTraversal(tt.input)
			if gotSafe != tt.wantSafe {
				t.Errorf("IsSafeFromPathTraversal(%q) = %v, want %v", tt.input, gotSafe, tt.wantSafe)
			}
		})
	}
}

func TestInputSecurityValidator_CommandInjection(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name     string
		input    string
		wantSafe bool
	}{
		{"Normal text", "Hello world", true},
		{"Normal filename", "document.txt", true},
		{"Pipe to cat", "file.txt | cat /etc/passwd", false},
		{"Semicolon ls", "file.txt; ls -la", false},
		{"Command substitution $", "$(whoami)", false},
		{"Backtick command", "`id`", false},
		{"eval function", "eval(malicious)", false},
		{"system function", "system('rm -rf /')", false},
		{"Double ampersand", "file && rm -rf /", false},
		{"Double pipe", "file || rm -rf /", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSafe := v.IsSafeFromCommandInjection(tt.input)
			if gotSafe != tt.wantSafe {
				t.Errorf("IsSafeFromCommandInjection(%q) = %v, want %v", tt.input, gotSafe, tt.wantSafe)
			}
		})
	}
}

func TestInputSecurityValidator_URL(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name      string
		input     string
		wantValid bool
	}{
		{"Empty URL", "", true},
		{"HTTP URL", "http://example.com", true},
		{"HTTPS URL", "https://example.com/path", true},
		{"javascript: URL", "javascript:alert('xss')", false},
		{"data: URL", "data:text/html,<script>alert('xss')</script>", false},
		{"file: URL", "file:///etc/passwd", false},
		{"Localhost", "http://localhost/admin", false},
		{"127.0.0.1", "http://127.0.0.1/admin", false},
		{"Internal IP 10.x", "http://10.0.0.1/admin", false},
		{"Internal IP 192.168.x", "http://192.168.1.1/admin", false},
		{"Internal IP 172.16.x", "http://172.16.0.1/admin", false},
		{"URL with XSS", "https://example.com/<script>alert(1)</script>", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotValid := v.IsValidURL(tt.input)
			if gotValid != tt.wantValid {
				t.Errorf("IsValidURL(%q) = %v, want %v", tt.input, gotValid, tt.wantValid)
			}
		})
	}
}

func TestInputSecurityValidator_Email(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name      string
		input     string
		wantValid bool
	}{
		{"Valid email", "user@example.com", true},
		{"Email with plus", "user+tag@example.com", true},
		{"Email with dots", "user.name@example.com", true},
		{"Empty email", "", false},
		{"No at sign", "userexample.com", false},
		{"No domain", "user@", false},
		{"Disposable email", "user@tempmail.com", false},
		{"Disposable mailinator", "user@mailinator.com", false},
		{"Email too long", "user@" + string(make([]byte, 300)), false},
		{"Email with XSS", "<script>@example.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotValid := v.IsValidEmail(tt.input)
			if gotValid != tt.wantValid {
				t.Errorf("IsValidEmail(%q) = %v, want %v", tt.input, gotValid, tt.wantValid)
			}
		})
	}
}

func TestInputSecurityValidator_Username(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name      string
		input     string
		wantValid bool
	}{
		{"Valid username", "johndoe123", true},
		{"With underscore", "john_doe_123", true},
		{"Uppercase becomes valid", "JohnDoe123", true}, // Converted to lowercase, becomes valid
		{"Too short", "abc", false},
		{"Too long", "this_username_is_way_too_long_for_validation", false},
		{"With dash", "john-doe", false},
		{"Reserved admin", "admin", false},
		{"Reserved root", "root", false},
		{"Reserved support", "support", false},
		{"Consecutive underscores", "john__doe", false},
		{"Starts with underscore", "_johndoe", false},
		{"Ends with underscore", "johndoe_", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotValid := v.IsValidUsername(tt.input)
			if gotValid != tt.wantValid {
				t.Errorf("IsValidUsername(%q) = %v, want %v", tt.input, gotValid, tt.wantValid)
			}
		})
	}
}

func TestInputSecurityValidator_Password(t *testing.T) {
	v := NewInputSecurityValidator()

	tests := []struct {
		name      string
		input     string
		wantValid bool
	}{
		{"Strong password", "MyP@ssw0rd123!", true},
		{"With upper lower number special", "Password123!", true},
		{"Too short", "Pass1!", false},
		{"Common password", "password", false},
		{"Common 123456", "123456", false},
		{"All lowercase", "password", false},
		{"No variety", "aaaaaaaaa", false},
		{"Upper lower number only", "Password123", false}, // Needs 3 of 4 types including special
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotValid := v.IsValidPassword(tt.input)
			if gotValid != tt.wantValid {
				t.Errorf("IsValidPassword(%q) = %v, want %v", tt.input, gotValid, tt.wantValid)
			}
		})
	}
}

func TestInputSecurityValidator_ValidateInput(t *testing.T) {
	v := NewInputSecurityValidator()

	// Test comprehensive validation
	result := v.ValidateInput("Hello, this is normal text!")
	if !result.IsValid {
		t.Errorf("ValidateInput failed for normal text: %v", result.Threats)
	}

	// Test with SQL injection
	result = v.ValidateInput("'; DROP TABLE users; --")
	if result.IsValid {
		t.Errorf("ValidateInput should detect SQL injection")
	}
	if len(result.Threats) == 0 {
		t.Errorf("ValidateInput should report SQL injection threat")
	}

	// Test with XSS
	result = v.ValidateInput("<script>alert('xss')</script>")
	if result.IsValid {
		t.Errorf("ValidateInput should detect XSS")
	}

	// Test with multiple threats
	result = v.ValidateInput("'; <script>alert(1)</script> ../../../etc/passwd")
	if result.IsValid {
		t.Errorf("ValidateInput should detect multiple threats")
	}
	if len(result.Threats) < 2 {
		t.Errorf("ValidateInput should report multiple threats, got %d", len(result.Threats))
	}
}
