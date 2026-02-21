# Frontend Reference Patterns (High-End Product Bar)

Last updated: February 21, 2026

Dokumen ini adalah pattern benchmark. Tujuannya meniru kualitas pengalaman produk kelas atas, bukan copy visual 1:1.

## Layout & Information Density

1. Fokus pada readability dan scanning cepat.
2. Pakai whitespace untuk prioritas, bukan hanya dekorasi.
3. Informasi penting harus terlihat tanpa scroll berlebihan di desktop.

## Typography & Hierarchy

1. Heading, body, metadata punya kontras hierarki yang jelas.
2. Hindari "semua teks terlihat sama".
3. Panjang line body text dijaga nyaman dibaca.

## Interaction Quality

1. State transisi tidak abrupt (loading/skeleton/disabled).
2. Feedback aksi penting harus eksplisit (submit, retry, error recovery).
3. Keyboard path untuk alur utama tetap nyaman.

## Error & Recovery Design

1. Error message actionable (jelas apa masalah + next step).
2. Retry/cancel/back tersedia saat relevan.
3. Partial failure tidak memblokir seluruh halaman jika bisa diisolasi.

## Enterprise Trust Signals

1. Timestamp, status, dan data source jelas pada data sensitif.
2. Untuk financial/auth: tampilkan state transaksi secara deterministik.
3. Jangan sembunyikan failure state; tampilkan dengan aman dan jelas.

## Anti-Patterns (Harus Dihindari)

1. UI "cantik" tapi tidak jelas alur tindakan utama.
2. Komponen besar campur data-fetch + rendering + business rules sekaligus.
3. Warna/status tidak konsisten antar halaman.
4. Loader tanpa timeout/fallback.
