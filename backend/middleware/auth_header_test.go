package middleware

import "testing"

func TestParseBearerToken(t *testing.T) {
	tests := []struct {
		name       string
		header     string
		wantToken  string
		wantParsed bool
	}{
		{
			name:       "standard bearer",
			header:     "Bearer abc.def.ghi",
			wantToken:  "abc.def.ghi",
			wantParsed: true,
		},
		{
			name:       "case-insensitive scheme",
			header:     "bearer abc.def.ghi",
			wantToken:  "abc.def.ghi",
			wantParsed: true,
		},
		{
			name:       "extra spaces",
			header:     "  Bearer    abc.def.ghi   ",
			wantToken:  "abc.def.ghi",
			wantParsed: true,
		},
		{
			name:       "missing scheme",
			header:     "abc.def.ghi",
			wantToken:  "",
			wantParsed: false,
		},
		{
			name:       "empty token",
			header:     "Bearer   ",
			wantToken:  "",
			wantParsed: false,
		},
		{
			name:       "too many parts",
			header:     "Bearer abc def",
			wantToken:  "",
			wantParsed: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotToken, gotParsed := parseBearerToken(tc.header)
			if gotParsed != tc.wantParsed {
				t.Fatalf("parsed mismatch: got %v want %v", gotParsed, tc.wantParsed)
			}
			if gotToken != tc.wantToken {
				t.Fatalf("token mismatch: got %q want %q", gotToken, tc.wantToken)
			}
		})
	}
}
