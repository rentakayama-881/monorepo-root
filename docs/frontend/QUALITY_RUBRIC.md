# Frontend Quality Rubric (Objective)

Last updated: February 21, 2026

Skor total: 100. Tiap dimensi harus >= 90 untuk fitur kritis.

## 1) Accessibility (20)

1. Semua control punya label/nama aksesibel.
2. Fokus keyboard jelas dan tidak terjebak.
3. Kontras memenuhi WCAG AA.
4. Error form terbaca screen reader.
5. Semantik heading dan landmark valid.

## 2) Performance (20)

1. No obvious render thrash.
2. Bundle route kritis tidak bengkak.
3. Loading strategy jelas (lazy/split).
4. Tidak ada blocking script yang tidak perlu.
5. Core Web Vitals tidak regress signifikan.

## 3) Responsive & Device Behavior (20)

1. Mobile-first layout valid.
2. Tidak ada overflow horizontal di viewport kecil.
3. Tap targets aman di mobile.
4. Empty/loading/error state tetap usable di mobile.
5. Breakpoint behavior konsisten.

## 4) UX Consistency (20)

1. State loading/success/error seragam.
2. Copywriting konsisten (Bahasa Indonesia untuk user-facing).
3. Navigasi tidak membingungkan.
4. CTA utama dan sekunder jelas.
5. Visual hierarchy tegas (bukan flat/noisy).

## 5) Engineering Readiness (20)

1. Lint/typecheck/test pass.
2. Komponen tidak menjadi god component tanpa alasan.
3. API error mapping konsisten.
4. Tidak ada dead code baru.
5. Regression tests ditambah untuk flow kritis yang berubah.

## Pass/Fail Policy

1. Perubahan frontend critical path gagal jika ada dimensi < 90.
2. Gagal test/lint/typecheck = auto fail.
3. Komponen baru harus menyertakan minimal satu bukti test behavior jika ada logic non-trivial.
