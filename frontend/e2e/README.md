# Frontend E2E (Playwright)

## Prasyarat

- Jalankan backend + frontend lokal, atau set `E2E_BASE_URL` ke environment test.
- Untuk test authenticated, siapkan storage state di:
  - `playwright/.auth/user.json`
  - `playwright/.auth/sender.json`
  - `playwright/.auth/receiver.json`

## Menjalankan test

```bash
cd frontend
npm run e2e
```

## Menjalankan dengan UI

```bash
cd frontend
npm run e2e:ui
```

## Variabel environment opsional

- `E2E_BASE_URL` (default `http://localhost:3000`)
- `E2E_REGISTER_EMAIL`
- `E2E_REGISTER_PASSWORD`
- `E2E_REGISTER_VERIFY_URL`
- `E2E_2FA_EMAIL`
- `E2E_2FA_PASSWORD`
- `E2E_TEST_PIN`
- `E2E_RUN_PIN_LOCKOUT=true`
- `E2E_RECEIVER_IDENTIFIER`
- `E2E_TRANSFER_AMOUNT`
- `E2E_PENDING_TRANSFER_ID`
- `E2E_CANCEL_TRANSFER_ID`

## Catatan

- Test saat ini bersifat skeleton/template.
- Selector menggunakan `data-testid` yang sudah tersedia di komponen UI. Untuk action button di halaman detail transaksi, digunakan role-based selector.
