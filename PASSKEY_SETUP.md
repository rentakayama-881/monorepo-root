# 🔐 Passkey Implementation Guide

## Cara Cek dan Fix Error "Internal Server Error" Passkey Login

### 📋 Langkah Cepat (Quick Fix)

1. **Jalankan Debug Script**
   ```bash
   cd /workspaces/root
   ./debug-passkey.sh
   ```

2. **Edit file `.env` di folder `backend/`**
   
   Untuk **Production** (Vercel):
   ```env
   WEBAUTHN_RP_ID=monorepo-root-dun.vercel.app
   WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app
   WEBAUTHN_RP_NAME=Alephdraad
   FRONTEND_BASE_URL=https://monorepo-root-dun.vercel.app
   CORS_ALLOWED_ORIGINS=https://monorepo-root-dun.vercel.app
   ```

   Untuk **Development** (Localhost):
   ```env
   WEBAUTHN_RP_ID=localhost
   WEBAUTHN_RP_ORIGIN=http://localhost:3000
   WEBAUTHN_RP_NAME=Alephdraad
   FRONTEND_BASE_URL=http://localhost:3000
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Restart Backend**
   ```bash
   cd backend
   pkill -f "go run main.go"  # Stop backend
   go run main.go              # Start ulang
   ```

4. **Test di Browser Incognito** (untuk avoid cache issues)

---

## 🔍 Cara Mengecek Masalahnya

### Opsi 1: Menggunakan Script (RECOMMENDED)

```bash
cd /workspaces/root
./debug-passkey.sh
```

Script ini akan:
- ✅ Check apakah `.env` sudah ada
- ✅ Validasi config WebAuthn
- ✅ Check log error terbaru
- ✅ Memberikan rekomendasi

### Opsi 2: Manual Check

1. **Cek Backend Log**
   ```bash
   cd /workspaces/root/backend
   
   # Jika ada file log
   tail -50 app.log | grep -i "passkey\|error"
   
   # Atau jalankan backend dan lihat output
   go run main.go
   ```

2. **Cek Browser Console**
   - Buka Developer Tools (F12)
   - Tab Console
   - Coba login dengan passkey
   - Lihat error yang muncul

3. **Cek Network Tab**
   - F12 → Network
   - Coba login
   - Lihat request `/api/auth/passkeys/login/finish`
   - Klik request → Response → Lihat error message

---

## 🐛 Error Umum & Solusinya

### 1. "Origin mismatch" atau "RP ID mismatch"

**Penyebab:**
- URL frontend tidak match dengan `WEBAUTHN_RP_ORIGIN`

**Solusi:**
```env
# Pastikan ini SAMA PERSIS dengan URL frontend
WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app

# Bukan:
# ❌ WEBAUTHN_RP_ORIGIN=http://monorepo-root-dun.vercel.app  (http bukan https)
# ❌ WEBAUTHN_RP_ORIGIN=monorepo-root-dun.vercel.app         (tanpa https://)
# ❌ WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app/ (ada trailing slash)
```

### 2. "Session expired or not found"

**Penyebab:**
- Terlalu lama antara klik "Login with Passkey" dan verifikasi biometric
- Session di backend sudah expired (default: 5 menit)

**Solusi:**
- Coba lagi dengan lebih cepat
- Atau increase timeout (edit `backend/services/passkey_service.go` line ~25):
  ```go
  sessionTTL: time.Minute * 10,  // Dari 5 menit jadi 10 menit
  ```

### 3. "User not found" atau "No passkeys registered"

**Penyebab:**
- Email salah
- Passkey belum terdaftar untuk email tersebut

**Solusi:**
1. Cek database: Apakah ada passkey untuk email tersebut?
   ```sql
   SELECT * FROM passkeys WHERE user_id = (
     SELECT id FROM users WHERE email = 'your@email.com'
   );
   ```

2. Jika belum ada, register passkey dulu:
   - Login dengan password
   - Pergi ke Account Settings
   - Add New Passkey

### 4. "Internal Server Error" tanpa detail

**Penyebab:**
- Ada panic/error di backend yang tidak ter-catch

**Cara Debug:**
1. Jalankan backend di terminal:
   ```bash
   cd backend
   go run main.go
   ```

2. Coba login dengan passkey lagi

3. Lihat stack trace error di terminal

4. Share error tersebut untuk analisis lebih lanjut

---

## 🧪 Testing

### Test Checklist

Sebelum deploy, pastikan:

- [ ] File `.env` sudah dibuat dengan benar
- [ ] `WEBAUTHN_RP_ORIGIN` match dengan URL frontend
- [ ] `WEBAUTHN_RP_ID` adalah domain tanpa `https://`
- [ ] Backend sudah restart setelah ubah `.env`
- [ ] Browser cache sudah di-clear
- [ ] Test di Incognito mode
- [ ] Test register passkey berhasil
- [ ] Test login dengan passkey berhasil
- [ ] Test di berbagai browser (Chrome, Safari, Edge)
- [ ] Test di mobile device

### Test Flow

1. **Register Passkey**
   ```
   Login → Account → Add Passkey → Verify Biometric → Success
   ```

2. **Login dengan Passkey**
   ```
   Login Page → "Login with Passkey" → Pilih passkey → Verify Biometric → Success
   ```

---

## 🚀 Deployment

### Setup untuk Production (Vercel)

1. **Di Vercel Dashboard** → Project Settings → Environment Variables

   Tambahkan:
   ```
   WEBAUTHN_RP_ID = monorepo-root-dun.vercel.app
   WEBAUTHN_RP_ORIGIN = https://monorepo-root-dun.vercel.app
   WEBAUTHN_RP_NAME = Alephdraad
   ```

2. **Di Backend Server** (jika backend terpisah)
   
   Edit `.env` atau environment variables:
   ```env
   WEBAUTHN_RP_ID=monorepo-root-dun.vercel.app
   WEBAUTHN_RP_ORIGIN=https://monorepo-root-dun.vercel.app
   FRONTEND_BASE_URL=https://monorepo-root-dun.vercel.app
   CORS_ALLOWED_ORIGINS=https://monorepo-root-dun.vercel.app
   ```

3. **Restart/Redeploy**

---

## 📝 Monitoring

### Enable Detailed Logging

Untuk debugging lebih detail, sudah ada log di:
- `backend/handlers/passkey_handler.go` - Prefix: `[PASSKEY-HANDLER]`
- `backend/services/passkey_service.go` - Prefix: `[PASSKEY-SVC]`

Contoh log yang muncul saat login:
```
[PASSKEY-HANDLER] FinishLogin started
[PASSKEY-HANDLER] Request parsed, email=user@example.com
[PASSKEY-HANDLER] Credential parsed successfully
[PASSKEY-HANDLER] Using email-based login
[PASSKEY-SVC] FinishLogin started, email=user@example.com
[PASSKEY-SVC] User found, user_id=123
[PASSKEY-SVC] Session found
[PASSKEY-SVC] ValidateLogin success
[PASSKEY-HANDLER] Login successful
```

Jika ada error, akan terlihat di bagian mana yang fail.

---

## 🔧 Advanced Configuration

### Custom Domain dengan Subdomain

Jika menggunakan subdomain:
```env
# Main domain
WEBAUTHN_RP_ID=example.com

# Subdomain yang digunakan
WEBAUTHN_RP_ORIGIN=https://app.example.com
```

**Note:** `RP_ID` harus parent domain atau exact match.

### Multiple Origins (Multi-tenant)

Jika ada beberapa domain:
```env
WEBAUTHN_RP_ID=example.com
WEBAUTHN_RP_ORIGIN=https://app1.example.com,https://app2.example.com
CORS_ALLOWED_ORIGINS=https://app1.example.com,https://app2.example.com
```

---

## 📚 Resources

- [WebAuthn Guide](https://webauthn.guide/)
- [go-webauthn Documentation](https://github.com/go-webauthn/webauthn)
- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)

---

## ❓ Masih Ada Masalah?

1. Jalankan debug script:
   ```bash
   ./debug-passkey.sh
   ```

2. Dokumentasikan error:
   - Screenshot console error
   - Backend log (5-10 baris)
   - Network tab (request/response)
   - Config `.env` (tanpa credentials!)

3. File dokumentasi tambahan:
   - [PASSKEY_FIX.md](./PASSKEY_FIX.md) - Troubleshooting detail
   - [debug-passkey.sh](./debug-passkey.sh) - Debug script

---

**Last Updated:** 2 January 2026
