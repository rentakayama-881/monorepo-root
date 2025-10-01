package utils

import "fmt"

// Ubah []float32 jadi literal "[v1,v2,...]" yang bisa di-cast ke ::vector di Postgres.
func VectorLiteral(vec []float32) string {
	if len(vec) == 0 {
		return "[]"
	}
	out := make([]byte, 0, 16*len(vec))
	out = append(out, '[')
	for i, f := range vec {
		out = append(out, []byte(fmt.Sprintf("%.6f", f))...) // presisi cukup
		if i != len(vec)-1 {
			out = append(out, ',')
		}
	}
	out = append(out, ']')
	return string(out)
}
