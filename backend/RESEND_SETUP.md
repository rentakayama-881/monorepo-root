# Integrasi Resend untuk Email Verification

## Setup Resend

### 1. Buat Akun Resend
- Daftar di https://resend.com/signup
- Free tier: 100 email/hari, 3,000 email/bulan

### 2. Dapatkan API Key
- Login ke dashboard Resend
- Buka https://resend.com/api-keys
- Klik "Create API Key"
- Copy API key (format: `re_xxxxxxxxxxxxx`)

### 3. Verifikasi Domain (Opsional untuk Production)

**Untuk Testing (pakai onboarding email):**
```bash
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Untuk Production (domain sendiri):**
- Di Resend dashboard, buka "Domains"
- Klik "Add Domain" 
- Masukkan domain Anda (contoh: `yourdomain.com`)
- Tambahkan DNS records yang diberikan:
  - SPF record
  - DKIM records (3 records)
  - DMARC record (opsional tapi recommended)
- Tunggu verifikasi (biasanya 5-10 menit)
- Setelah verified, gunakan email seperti: `noreply@yourdomain.com`

### 4. Update Environment Variables

Edit file `.env` di folder `backend/`:

```bash
# Resend Configuration
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev  # untuk testing
# atau
RESEND_FROM_EMAIL=noreply@yourdomain.com  # untuk production
```

### 5. Testing

**Development Mode (tanpa API key):**
- Jika `RESEND_API_KEY` kosong, email akan di-log ke console saja
- Bagus untuk local development

**Production Mode (dengan API key):**
- Email akan dikirim via Resend
- Check logs untuk error handling

## Fitur

✅ **Template HTML yang bagus** - Professional design dengan styling modern
✅ **Link verification** - Clickable button + fallback copy-paste link  
✅ **Expiry info** - Menampilkan bahwa link expire dalam 24 jam
✅ **Fallback mode** - Tetap bisa development tanpa API key
✅ **Error handling** - Registrasi tetap berhasil meski email gagal dikirim
✅ **Rate limiting** - Sudah ada di auth handlers

## Testing Email Locally

```bash
# Set environment variables
export RESEND_API_KEY=re_your_api_key
export RESEND_FROM_EMAIL=onboarding@resend.dev

# Start backend
cd backend
go run main.go

# Test register endpoint
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Troubleshooting

**Email tidak terkirim:**
1. Check API key valid
2. Check logs untuk error message
3. Verify sender email address
4. Check Resend dashboard untuk delivery status

**Testing dengan real email:**
```bash
# Gunakan email asli Anda untuk testing
RESEND_FROM_EMAIL=onboarding@resend.dev
# Register dengan email asli Anda
# Check inbox (jangan lupa spam folder)
```

## Resend Dashboard

Monitor email delivery di:
- https://resend.com/emails - Lihat semua email yang dikirim
- https://resend.com/logs - Debug email delivery issues
- https://resend.com/api-keys - Manage API keys

## Pricing

**Free Tier:**
- 100 email/hari
- 3,000 email/bulan
- Semua fitur
- Cukup untuk early stage

**Paid Plans:** Start dari $20/bulan untuk 50k email
