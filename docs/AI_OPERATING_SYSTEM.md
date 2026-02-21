# AI Operating System (Strict, Session-Proof)

Last updated: February 21, 2026

Dokumen ini adalah single source of truth agar AI tetap konsisten walaupun pindah sesi/chat.

## Objective

1. Semua perubahan diproses dengan workflow engineer-grade.
2. Tidak ada klaim "sudah live" tanpa bukti runtime.
3. Kode yang jalan di VPS wajib sama dengan commit terbaru yang sudah dipilih.

## Non-Negotiable Rules

1. Semua perubahan kode harus lewat full gate lintas monorepo.
2. Setelah perubahan valid, wajib commit + push branch kerja.
3. Frontend deploy dilakukan via Vercel (trigger dari push GitHub).
4. Backend deploy harus sinkron ke SHA target dan diverifikasi via endpoint versi.
5. Dilarang menyebut deploy sukses tanpa health + SHA evidence.

## Command Contracts (Mandatory)

1. Full quality gate:
```bash
./ops/preflight-full.sh
```

2. Commit + push (otomatis jalankan preflight):
```bash
./ops/commit-push.sh "type(scope): message"
```

Catatan:

- Jika command dijalankan dari branch `main`, script akan otomatis menjalankan deploy VPS ke SHA terbaru setelah push.
- Gunakan `--skip-deploy` jika ingin push tanpa deploy.
- Gunakan `--deploy-vps` untuk memaksa deploy walau bukan mode default.

3. VPS sync deploy ke commit tertentu:
```bash
./ops/vps-sync-deploy.sh --env prod --ref <git_sha>
```

4. Verifikasi service live:
```bash
./ops/verify-live.sh --env prod --expect-sha <git_sha>
```

5. Rollback:
```bash
./ops/vps-rollback.sh --env prod --backup-dir <backup_path>
```

## Standard Workflow

1. Ambil latest `main`.
2. Buat branch terpisah sesuai scope.
3. Implement perubahan.
4. Jalankan `./ops/preflight-full.sh`.
5. Commit + push via `./ops/commit-push.sh`.
6. Buka PR, tunggu CI + review, merge.
7. Deploy backend ke SHA merge dengan `./ops/vps-sync-deploy.sh`.
8. Verifikasi runtime SHA dengan `./ops/verify-live.sh`.
9. Simpan evidence (SHA, health payload, waktu deploy, backup path).

## Evidence Checklist (Definition of Done)

Sebuah task baru dianggap selesai jika semua ini ada:

1. SHA commit dan branch jelas.
2. Full gate lokal lulus (atau CI equivalent lulus).
3. PR merged ke `main`.
4. Deploy command sukses dan backup path tercatat.
5. `/health` dan `/health/version` (Go), `/api/v1/health` dan `/api/v1/health/version` (.NET) valid.
6. `git_sha` live sama dengan target SHA.

## Failure Handling

1. Jika full gate gagal: jangan commit/push, perbaiki dulu.
2. Jika deploy gagal restart/health: rollback dari backup terakhir.
3. Jika SHA live mismatch: anggap deploy gagal walaupun service "up".

## Notes for Non-Coding Operator

1. Fokus ke 2 hal: `target SHA` dan `live SHA`.
2. Kalau dua nilai ini beda, berarti backend belum update benar.
3. Simpan `backup_dir` dari output deploy untuk jaga-jaga rollback cepat.
