# Changelog - 18 Januari 2026

## Dispute Center & Financial Security Improvements

### Overview
Implementasi sistem dispute/mediasi lengkap dengan 3-party chat (Admin, Pembeli, Penjual) dan perbaikan keamanan sistem keuangan.

---

## 🔧 Backend Changes

### Go Backend (`backend/`)

#### 1. User API Response Fix
**File**: `handlers/user_handler.go`
- **Masalah**: `/api/user/me` tidak mengembalikan `id` user
- **Fix**: Tambah `"id": user.ID` ke response JSON
- **Impact**: Frontend bisa identify sender/receiver dengan benar

```go
// Sebelum
c.JSON(http.StatusOK, gin.H{
    "email":      user.Email,
    "name":       name,
    "username":   name,
    "avatar_url": user.AvatarURL,
})

// Sesudah
c.JSON(http.StatusOK, gin.H{
    "id":         user.ID,  // ← DITAMBAHKAN
    "email":      user.Email,
    "name":       name,
    "username":   name,
    "avatar_url": user.AvatarURL,
})
```

---

### Feature Service (`feature-service/`)

#### 1. Dispute System - Sender/Receiver Logic Fix
**Files**: 
- `DTOs/DisputeDtos.cs`
- `Models/Entities/Dispute.cs`
- `Services/DisputeService.cs`

**Masalah**: Logic dispute menggunakan `initiatorId/respondentId` (siapa yang buka dispute) bukan `senderId/receiverId` (siapa yang kirim/terima uang). Ini menyebabkan:
- Tombol refund muncul di pihak yang salah
- Label "Pembeli/Penjual" tertukar

**Fix**:
1. Tambah field `SenderId`, `SenderUsername`, `ReceiverId`, `ReceiverUsername` ke `DisputeDto` dan `Dispute` entity
2. Hanya **SENDER (pembeli)** yang boleh buka dispute
3. Gunakan `ReceiverId` untuk validasi mutual refund, bukan `RespondentId`

```csharp
// Validasi: Hanya sender boleh buka dispute
if (transfer.SenderId != userId)
    return new CreateDisputeResponse(false, null, "Hanya pengirim dana yang dapat membuka mediasi");

// Validasi: Hanya receiver boleh setuju refund
if (dispute.ReceiverId != userId)
    return (false, "Hanya penerima yang dapat menyetujui refund");
```

#### 2. Hold Time Cap Fix
**File**: `Services/TransferService.cs`
- **Masalah**: Hold time di-cap maksimal 72 jam (3 hari)
- **Fix**: Cap dinaikkan ke 720 jam (30 hari)

---

## 🎨 Frontend Changes

### Transaction Detail Page
**File**: `app/account/wallet/transactions/[id]/page.jsx`

#### 1. isSender/isReceiver Comparison Fix
**Masalah**: Perbandingan `currentUser.id === transfer.senderId` gagal karena:
- `currentUser.id` awalnya undefined (tidak dikirim dari backend)
- Type mismatch (string vs number)

**Fix**:
```javascript
// Sebelum
const isSender = currentUser?.id === transfer.senderId;

// Sesudah  
const isSender = Number(currentUser?.id) === Number(transfer.senderId);
```

#### 2. Remove Cancel Button (Security Fix)
**Masalah**: Sender bisa cancel sendiri → celah penipuan (penjual sudah kasih jasa, uang di-cancel)

**Fix**: Hapus tombol "Batalkan & Kembalikan Dana" dari sisi sender
- Sender hanya bisa: Lepaskan Dana Lebih Awal, Minta Bantuan Mediasi
- Receiver bisa: Tolak Transfer & Kembalikan

#### 3. Hide Mediation Button from Receiver
**Masalah**: Receiver bisa buka mediasi → logika terbalik

**Fix**: Tombol "Minta Bantuan Tim Mediasi" hanya muncul untuk sender

---

### Dispute Detail Page
**File**: `app/account/wallet/disputes/[id]/page.jsx`

#### 1. Use senderId/receiverId instead of initiatorId
```javascript
// Sebelum (salah)
const isSender = currentUser?.id === dispute.initiatorId;

// Sesudah (benar)
const isSender = Number(currentUser?.id) === Number(dispute.senderId);
```

#### 2. Correct Labels
- "Pembeli (Pengirim Dana)" - dengan indikator "(Anda)" jika current user
- "Penjual (Penerima Dana)" - dengan indikator "(Anda)" jika current user

#### 3. Refund Button Only for Receiver
- Receiver melihat tombol "Setuju Refund ke Pengirim"
- Sender melihat info "Menunggu Respon"

#### 4. Escalate Button Only for Sender
- Hanya sender yang bisa eskalasi ke fase bukti/admin

---

### Admin Dispute Page
**File**: `app/admin/disputes/[id]/page.jsx`

#### 1. Correct Party Labels
- Gunakan `senderUsername` dan `receiverUsername` bukan `initiatorUsername`
- Chat menampilkan role: "(Pembeli)" atau "(Penjual)" dengan benar

---

### Environment Variables
**File**: `.env.example`

**Fix**: Update variable names agar konsisten dengan code:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_FEATURE_API_URL=http://localhost:5000
```

---

## 🔒 Security Improvements

| Issue | Risk | Fix |
|-------|------|-----|
| Sender bisa cancel sendiri | Penipuan - penjual sudah kasih jasa, uang di-cancel | Hapus tombol cancel dari sender |
| Receiver bisa buka mediasi | Logic terbalik | Hanya sender yang bisa buka mediasi |
| Refund button di kedua pihak | Sender bisa abuse | Hanya receiver yang bisa setuju refund |
| User ID tidak di-return API | Frontend gagal identify role | Tambah `id` ke `/api/user/me` |

---

## 📋 Flow Transaksi yang Benar

### Sender (Pembeli)
1. ✅ Lepaskan Dana Lebih Awal - jika puas dengan jasa/barang
2. ✅ Minta Bantuan Tim Mediasi - jika ada masalah
3. ❌ ~~Batalkan & Kembalikan Dana~~ - DIHAPUS (celah penipuan)

### Receiver (Penjual)
1. ✅ Tolak Transfer & Kembalikan - jika tidak mau terima pekerjaan
2. ✅ Dana otomatis masuk setelah hold period
3. ❌ Tidak bisa buka mediasi (hanya defend jika sender buka)

### Dispute Flow
1. **Sender** buka mediasi dengan alasan
2. **Receiver** bisa: Setuju refund ATAU sampaikan pembelaan di chat
3. **Admin** bisa: Lanjutkan transaksi, Refund ke pembeli, Rilis ke penjual, Split

---

## 🚀 Deployment

### Go Backend (72.62.124.23)
```bash
cd ~/monorepo-root/backend
/usr/local/go/bin/go build -o app .
sudo systemctl restart backend
```

### Feature Service (203.175.11.84)
```bash
cd ~/monorepo-root/feature-service/src/FeatureService.Api
dotnet publish -c Release -o /home/asp/feature-service-app
sudo systemctl restart featureservice
```

### Frontend
- Auto-deploy via Vercel on push to `main`

---

## 📝 Commits

1. `fix: dispute system logic - only sender can open dispute, use sender/receiver roles`
2. `fix: isSender/isReceiver comparison with Number() conversion`
3. `fix: add id to /api/user/me response`
4. `fix: remove cancel button for sender - security vulnerability`
5. `fix: update .env.example to match actual variable names`

---

## ⚠️ Known Issues Fixed

1. ✅ Tombol mediasi hilang → Fixed (user ID tidak di-return)
2. ✅ "Anda menerima dari" salah untuk sender → Fixed (senderId/receiverId logic)
3. ✅ Tombol refund muncul di kedua pihak → Fixed (hanya receiver)
4. ✅ Sender bisa cancel sendiri → Fixed (tombol dihapus)
5. ✅ Receiver bisa buka mediasi → Fixed (hanya sender)

---

*Dokumentasi dibuat: 18 Januari 2026*
