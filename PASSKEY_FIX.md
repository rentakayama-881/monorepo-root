# Passkey Login Internal Server Error - Solusi

## Masalah
Saat login menggunakan passkey, muncul error "Internal Server Error" dari backend.

## Penyebab Umum

### 1. **Origin Mismatch** (Paling Sering)
WebAuthn sangat strict dengan origin. Jika origin yang dikirim dari frontend tidak match dengan `WEBAUTHN_RP_ORIGIN` di backend, akan muncul error.

**Contoh masalah:**
- Frontend: `https://monorepo-root-dun.vercel.app`
- Backend: `http://localhost:3000` ❌ SALAH!

### 2. **Session Expired**
Session WebAuthn yang disimpan di memory hanya bertahan 5 menit. Jika user terlalu lama antara BeginLogin dan FinishLogin, session akan hilang.

### 3. **RP ID Tidak Sesuai**
`WEBAUTHN_RP_ID` harus match dengan domain (tanpa protocol dan path).

## Cara Mengecek Error

### 1. Cek Log Backend
```bash
cd /workspaces/root/backend
# Jika backend running dengan docker
docker logs backend-container-name

# Jika running langsung
tail -f app.log
```

Cari log dengan prefix `[PASSKEY-HANDLER]` atau `[PASSKEY-SVC]` untuk melihat error detail.

### 2. Cek Browser Console
Buka Developer Tools → Console, lihat error dari frontend saat memanggil passkey.

### 3. Cek Network Tab
- Request ke `/api/auth/passkeys/login/begin` - Harus return 200 dengan options
- Request ke `/api/auth/passkeys/login/finish` - Ini yang error

## Solusi

### Solusi 1: Fix Environment Variables (WAJIB!)

Buat/edit file `.env` di folder `backend/`:

```env
# WebAuthn Configuration
WEBAUTHN_RP_ID=monorepo-root-dun.vercel.app
WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app
WEBAUTHN_RP_NAME=Alephdraad

# Frontend URL (harus sama dengan RP_ORIGIN)
FRONTEND_BASE_URL=https://monorepo-root-dun.vercel.app

# CORS (tambahkan semua domain yang boleh akses)
CORS_ALLOWED_ORIGINS=https://monorepo-root-dun.vercel.app,http://localhost:3000
```

**PENTING:**
- `WEBAUTHN_RP_ID` = Domain tanpa `https://` dan path
- `WEBAUTHN_RP_ORIGIN` = URL lengkap dengan `https://`
- Jika development di localhost, gunakan: `http://localhost:3000`
- Jika production di Vercel, gunakan URL Vercel lengkap

### Solusi 2: Untuk Development Localhost

Jika testing di localhost:

```env
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:3000
WEBAUTHN_RP_NAME=Alephdraad
FRONTEND_BASE_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Solusi 3: Untuk Production + Development

Gunakan environment variable yang berbeda per environment:

**.env.local** (Development):
```env
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:3000
```

**.env.production** (Production):
```env
WEBAUTHN_RP_ID=monorepo-root-dun.vercel.app
WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app
```

### Solusi 4: Fix Frontend Origin

Pastikan di frontend, saat memanggil WebAuthn, origin yang terkirim benar.

Cek file frontend yang handle passkey login, pastikan:
```javascript
// Harus match dengan WEBAUTHN_RP_ORIGIN
const credential = await navigator.credentials.get({
  publicKey: options
});
```

### Solusi 5: Increase Session Timeout (Opsional)

Jika user sering timeout, edit `backend/services/passkey_service.go`:

```go
// Line ~25
return &PasskeyService{
    db:           db,
    logger:       logger,
    webauthn:     w,
    sessionStore: make(map[string]*webauthn.SessionData),
    sessionTTL:   time.Minute * 10,  // Ganti dari 5 menit ke 10 menit
}, nil
```

## Testing

### 1. Restart Backend
```bash
cd /workspaces/root/backend
# Stop backend jika running
pkill -f "go run main.go"

# Start ulang
go run main.go
```

### 2. Clear Browser Data
- Hapus cache browser
- Atau gunakan Incognito/Private mode

### 3. Test Flow
1. Buka frontend
2. Klik "Login with Passkey"
3. Pilih passkey dari device
4. Check console log untuk error

## Debugging Lanjutan

Jika masih error, tambahkan log detail:

Edit `backend/handlers/passkey_handler.go`, tambah log di function `FinishLogin`:

```go
func (h *PasskeyHandler) FinishLogin(c *gin.Context) {
    h.logger.Info("[DEBUG] Request Headers", 
        zap.String("origin", c.GetHeader("Origin")),
        zap.String("referer", c.GetHeader("Referer")))
    
    // ... kode lainnya
}
```

Kemudian cek log untuk melihat origin yang sebenarnya dikirim dari frontend.

## Checklist

- [ ] File `.env` sudah dibuat dengan config yang benar
- [ ] `WEBAUTHN_RP_ORIGIN` match dengan URL frontend
- [ ] `WEBAUTHN_RP_ID` match dengan domain (tanpa protocol)
- [ ] CORS sudah include origin frontend
- [ ] Backend sudah di-restart setelah ubah .env
- [ ] Browser cache sudah di-clear
- [ ] Test di Incognito mode

## Jika Masih Bermasalah

Jalankan command ini dan share outputnya:

```bash
cd /workspaces/root/backend

# Cek config yang ter-load
go run main.go 2>&1 | grep -i "webauthn\|passkey" | head -20

# Cek error detail
tail -100 app.log | grep -i "passkey\|error"
```

---

## Kontak
Jika masih ada masalah, dokumentasikan:
1. Error message lengkap dari console
2. Network request/response (screenshot)
3. Backend log (5-10 baris terakhir)
