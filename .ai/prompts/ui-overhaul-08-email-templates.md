# Follow-Up #8: Email Template Design System

> Panduan design untuk email transaksional agar konsisten dengan web brand identity.
> Email yang terlihat profesional = trust signal kuat.

---

## PRINSIP EMAIL DESIGN

1. **Brand consistency**: Email harus terasa "dari AIValid" — sama font, warna, tone
2. **Mobile-first**: 70%+ email dibuka di mobile — design untuk mobile dulu
3. **Simplicity**: Email bukan website. Minimal layout, fokus pada pesan
4. **Actionable**: Setiap email punya 1 CTA yang jelas

---

## EMAIL ANATOMY

```
┌─────────────────────────────────────┐
│                                     │
│  [AIValid Logo]                     │  ← Header
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Halo, [Nama]                       │  ← Greeting
│                                     │
│  [Konten email — 2-3 paragraf       │  ← Body
│   pendek atau list]                 │
│                                     │
│  ┌─────────────────────┐            │
│  │    [CTA Button]     │            │  ← Primary action
│  └─────────────────────┘            │
│                                     │
│  [Informasi tambahan jika ada]      │  ← Secondary info
│                                     │
├─────────────────────────────────────┤
│                                     │
│  AIValid · aivalid.id               │  ← Footer
│  [Unsubscribe] · [Settings]         │
│                                     │
└─────────────────────────────────────┘
```

---

## STYLING SPECIFICATION

### Layout

```
Container width: 600px max
Padding: 32px horizontal, 24px vertical
Background: #fafafa (light gray, bukan pure white)
Content bg: #ffffff (white card)
Border radius: 12px pada content card
```

### Typography

```
Font stack: "IBM Plex Sans", -apple-system, "Segoe UI", sans-serif
(email clients tidak support custom @font-face reliably, tapi IBM Plex 
 bisa di-load via Google Fonts link di <head>)

Heading: 24px, font-weight: 700, color: #1a1a2e
Body: 16px, line-height: 1.6, color: #374151
Secondary text: 14px, color: #6b7280
Footer: 12px, color: #9ca3af
Link: color: #4f46e5 (primary), text-decoration: underline
```

### Colors (Email-safe — hex values, bukan CSS vars)

```
Primary: #4f46e5 (indigo — brand)
Background: #fafafa
Card: #ffffff
Text primary: #1a1a2e
Text secondary: #374151
Text muted: #6b7280
Border: #e5e7eb
Success: #10b981
Danger: #ef4444
Warning: #f59e0b
```

### CTA Button

```html
<table role="presentation" style="margin: 24px 0;">
  <tr>
    <td style="
      background-color: #4f46e5;
      border-radius: 8px;
      padding: 12px 32px;
      text-align: center;
    ">
      <a href="{{action_url}}" style="
        color: #ffffff;
        text-decoration: none;
        font-size: 16px;
        font-weight: 600;
        font-family: 'IBM Plex Sans', sans-serif;
      ">
        {{button_text}}
      </a>
    </td>
  </tr>
</table>
```

---

## EMAIL TYPES & TEMPLATES

### 1. Verifikasi Email

```
Subject: Verifikasi alamat email Anda — AIValid
Greeting: Halo, [Nama]
Body: 
  Terima kasih telah mendaftar di AIValid. 
  Klik tombol di bawah untuk memverifikasi alamat email Anda.
CTA: "Verifikasi Email"
Footer note: Link ini berlaku selama 24 jam.
  Jika Anda tidak mendaftar di AIValid, abaikan email ini.
```

### 2. Reset Password

```
Subject: Reset password AIValid Anda
Greeting: Halo, [Nama]
Body:
  Kami menerima permintaan reset password untuk akun Anda.
  Klik tombol di bawah untuk membuat password baru.
CTA: "Reset Password"
Footer note: Link ini berlaku selama 1 jam.
  Jika Anda tidak meminta reset password, abaikan email ini 
  atau hubungi dukungan jika ada kekhawatiran.
```

### 3. Case Mendapat Validasi

```
Subject: Case Anda "[Case Title]" mendapat validasi baru
Greeting: Halo, [Nama]
Body:
  Case "[Case Title]" telah menerima validasi baru 
  dari [Validator Username].
  
  Confidence: [X]%
  Komentar: "[preview komentar, max 100 karakter]..."
CTA: "Lihat Validasi"
```

### 4. Bounty Diterima

```
Subject: Anda menerima bounty Rp [Amount] — AIValid
Greeting: Halo, [Nama]
Body:
  Selamat! Anda telah menerima bounty untuk validasi pada case 
  "[Case Title]".
  
  ┌────────────────────────────┐
  │ Bounty: Rp [Amount]       │
  │ Case: [Case Title]        │
  │ Status: Selesai ✓         │
  └────────────────────────────┘
  
  Dana sudah masuk ke dompet AIValid Anda.
CTA: "Lihat Dompet"
```

### 5. Security Alert

```
Subject: ⚠️ Login baru terdeteksi — AIValid
Greeting: Halo, [Nama]
Body:
  Kami mendeteksi login baru ke akun Anda.
  
  Perangkat: [Browser/OS]
  Lokasi: [City, Country]
  Waktu: [DateTime]
  IP: [IP Address]
  
  Jika ini bukan Anda, segera amankan akun Anda.
CTA: "Amankan Akun"
Secondary: "Ini saya" (link biasa)
```

### 6. Dispute Notification

```
Subject: Dispute dibuka pada transaksi Anda — AIValid
(ikuti pattern yang sama: greeting → context → CTA)
```

---

## RESPONSIVE EMAIL

```html
<style>
  @media only screen and (max-width: 600px) {
    .email-container {
      width: 100% !important;
      padding: 16px !important;
    }
    .content-card {
      padding: 24px 16px !important;
    }
    h1 {
      font-size: 20px !important;
    }
    .cta-button {
      display: block !important;
      width: 100% !important;
      text-align: center !important;
    }
  }
</style>
```

---

## EMAIL TESTING CHECKLIST

```
□ Render correctly di:
  - Gmail (web + mobile)
  - Outlook (web + desktop)
  - Apple Mail (macOS + iOS)
  - Yahoo Mail
  
□ Dark mode email clients:
  - Warna masih readable
  - Logo visible (gunakan logo yang work di light + dark)
  - CTA button contrast sufficient
  
□ Mobile rendering:
  - Text readable tanpa zoom
  - Button cukup besar (min 44px height)
  - Padding memadai
  
□ Content:
  - Subject line < 50 karakter
  - Preheader text yang informatif
  - Semua links functional
  - Unsubscribe link ada
  - Plain text version tersedia
```

---

## ANTI-PATTERNS EMAIL

```
❌ Image-heavy emails (banyak client block images by default)
❌ Terlalu banyak CTA (max 1 primary + 1 secondary per email)
❌ Wall of text (max 3 paragraf pendek)
❌ Generic "Dear User" (gunakan nama asli)
❌ ALL CAPS di subject line
❌ Emoji berlebihan di subject (max 1, di awal)
❌ Noreply@ sebagai sender (gunakan hello@ atau support@)
❌ Missing unsubscribe link (legal requirement)
❌ Inline CSS yang terlalu complex (email clients strip banyak)
```

---

*Email adalah touchpoint brand. Setiap email yang terlihat profesional = trust point.
Setiap email yang terlihat spam = trust loss.*
