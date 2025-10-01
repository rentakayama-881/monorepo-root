package utils

import "unicode/utf8"

// Simple chunker berbasis panjang karakter (≈ 500–800 char/chunk)
// Bisa kamu ganti ke token-based nanti.
func SplitToChunks(s string, max int) []string {
	if max <= 0 {
		max = 800
	}
	out := []string{}
	for len(s) > 0 {
		if utf8.RuneCountInString(s) <= max {
			out = append(out, s)
			break
		}
		// cari batas kalimat/paragraf biar nggak “motong”
		cut := max
		if cut < len(s) {
			// coba mundur ke spasi/titik/baris baru
			for cut > max-200 && cut > 0 && s[cut] != ' ' && s[cut] != '\n' && s[cut] != '.' {
				cut--
			}
			if cut <= 0 {
				cut = max
			}
		}
		out = append(out, s[:cut])
		s = s[cut:]
	}
	return out
}
