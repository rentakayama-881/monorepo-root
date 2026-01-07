# 📖 Glosarium (Daftar Istilah)

> Dokumen ini berisi penjelasan istilah-istilah teknis yang digunakan dalam proyek Alephdraad. Ditulis untuk orang yang baru belajar programming.

---

## A

### API (Application Programming Interface)
**Penjelasan Sederhana**: Cara program komputer berbicara satu sama lain.

**Analogi**: Seperti pelayan restoran. Anda (frontend) memesan makanan melalui pelayan (API), dan dapur (backend) menyiapkan pesanan.

**Contoh di Alephdraad**:
```
Frontend memanggil: GET /api/threads
Backend menjawab: [{ id: 1, title: "Hello World" }]
```

---

### Authentication (Autentikasi)
**Penjelasan Sederhana**: Proses membuktikan bahwa Anda adalah siapa yang Anda klaim.

**Analogi**: Seperti menunjukkan KTP saat masuk gedung.

**Di Alephdraad**: Login dengan email + password = autentikasi.

---

### Authorization (Otorisasi)
**Penjelasan Sederhana**: Proses memeriksa apa yang boleh Anda lakukan setelah login.

**Analogi**: Setelah masuk gedung (autentikasi), tidak semua ruangan boleh dimasuki (otorisasi).

**Di Alephdraad**: User biasa tidak bisa akses halaman admin.

---

## B

### Backend
**Penjelasan Sederhana**: Bagian sistem yang tidak terlihat pengguna, tempat logika bisnis dan database berada.

**Analogi**: Dapur restoran - pelanggan tidak lihat, tapi di sinilah makanan disiapkan.

**Di Alephdraad**: Go/Gin dan ASP.NET Core.

---

### Bearer Token
**Penjelasan Sederhana**: Tiket masuk digital yang dikirim di setiap request.

**Contoh**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## C

### CDN (Content Delivery Network)
**Penjelasan Sederhana**: Jaringan server di seluruh dunia yang menyimpan salinan website agar loading lebih cepat.

**Analogi**: Seperti cabang minimarket di setiap kota, jadi tidak perlu ke pusat.

**Di Alephdraad**: Vercel menyediakan CDN untuk frontend.

---

### CORS (Cross-Origin Resource Sharing)
**Penjelasan Sederhana**: Aturan keamanan browser yang mengontrol website mana yang boleh memanggil API.

**Analogi**: Seperti daftar tamu undangan - hanya yang ada di daftar yang boleh masuk.

**Di Alephdraad**: Hanya `alephdraad.fun` yang boleh memanggil API.

---

### CRUD
**Penjelasan Sederhana**: Empat operasi dasar database:
- **C**reate - Buat data baru
- **R**ead - Baca data
- **U**pdate - Ubah data
- **D**elete - Hapus data

---

### Cursor Pagination
**Penjelasan Sederhana**: Cara mengambil data sedikit demi sedikit berdasarkan posisi terakhir.

**Analogi**: Seperti membaca buku - Anda taruh bookmark untuk lanjut besok.

**Keuntungan**: Lebih efisien daripada page number untuk data besar.

---

## D

### Database
**Penjelasan Sederhana**: Tempat menyimpan data secara terstruktur.

**Analogi**: Lemari arsip digital.

**Di Alephdraad**:
- PostgreSQL untuk data user, thread
- MongoDB untuk reply, reaction, chat

---

### DTO (Data Transfer Object)
**Penjelasan Sederhana**: Wadah khusus untuk mengirim data antar bagian sistem.

**Analogi**: Kotak kemasan untuk pengiriman barang.

---

### Docker
**Penjelasan Sederhana**: Teknologi untuk "membungkus" aplikasi beserta semua yang dibutuhkan agar bisa jalan di mana saja.

**Analogi**: Seperti container pengiriman barang - isinya sama di mana saja.

---

## E

### Endpoint
**Penjelasan Sederhana**: Alamat URL spesifik di API untuk melakukan suatu aksi.

**Contoh**:
```
POST /api/auth/login     → Untuk login
GET /api/threads         → Untuk ambil daftar thread
POST /api/threads        → Untuk buat thread baru
```

---

### Environment Variable
**Penjelasan Sederhana**: Pengaturan yang disimpan di luar kode, biasanya rahasia.

**Contoh**:
```
JWT_SECRET=rahasia-super-aman
DATABASE_URL=postgres://...
```

**Mengapa penting**: Agar rahasia tidak ter-commit ke Git.

---

## F

### Frontend
**Penjelasan Sederhana**: Bagian sistem yang dilihat dan diinteraksi pengguna.

**Analogi**: Ruang makan restoran - tempat pelanggan duduk dan memesan.

**Di Alephdraad**: Aplikasi Next.js di `alephdraad.fun`.

---

### Framework
**Penjelasan Sederhana**: Kerangka kerja yang menyediakan struktur dan fitur dasar untuk membangun aplikasi.

**Analogi**: Seperti kit LEGO dengan instruksi - bukan dari nol.

**Contoh**: Next.js, Gin, ASP.NET Core.

---

## G

### Git
**Penjelasan Sederhana**: Sistem untuk melacak perubahan kode dan berkolaborasi.

**Analogi**: Seperti Google Docs untuk kode - bisa lihat history dan kerja bareng.

---

## H

### Handler
**Penjelasan Sederhana**: Fungsi yang menangani request dari client.

**Di Alephdraad**:
```go
// Go handler
func GetThread(c *gin.Context) {
    id := c.Param("id")
    thread := db.FindThread(id)
    c.JSON(200, thread)
}
```

---

### Hash
**Penjelasan Sederhana**: Hasil enkripsi satu arah - tidak bisa dikembalikan ke bentuk asal.

**Kegunaan**: Menyimpan password dengan aman.

```
Password: "rahasia123"
Hash: "$2a$10$X5KYxQJ..."
```

---

### Hook (React Hook)
**Penjelasan Sederhana**: Fungsi khusus React untuk menambah fitur ke komponen.

**Contoh di Alephdraad**:
```javascript
const { balance, loading } = useTokenBalance();
```

---

## J

### JSON (JavaScript Object Notation)
**Penjelasan Sederhana**: Format data yang mudah dibaca manusia dan mesin.

**Contoh**:
```json
{
  "id": 1,
  "username": "john",
  "email": "john@example.com"
}
```

---

### JWT (JSON Web Token)
**Penjelasan Sederhana**: Token terenkripsi yang berisi informasi user untuk autentikasi.

**Analogi**: Seperti gelang VIP di konser - bukti Anda sudah bayar tiket.

**Struktur**: `header.payload.signature`

---

## L

### LLM (Large Language Model)
**Penjelasan Sederhana**: AI yang dilatih dengan banyak teks untuk memahami dan menghasilkan bahasa manusia.

**Contoh**: GPT-4, Claude, Llama, Gemini.

**Di Alephdraad**: Aleph Assistant menggunakan berbagai LLM.

---

## M

### Microservice
**Penjelasan Sederhana**: Arsitektur di mana aplikasi dipecah menjadi layanan-layanan kecil yang independen.

**Analogi**: Seperti food court - setiap kios fokus pada satu jenis makanan.

**Di Alephdraad**: Feature Service adalah microservice terpisah.

---

### Middleware
**Penjelasan Sederhana**: Kode yang berjalan di antara request masuk dan handler.

**Analogi**: Seperti satpam yang memeriksa sebelum Anda masuk gedung.

**Contoh**: Auth middleware, rate limit middleware.

---

### MongoDB
**Penjelasan Sederhana**: Database NoSQL yang menyimpan data dalam format dokumen (JSON-like).

**Keuntungan**: Fleksibel, cocok untuk data yang strukturnya sering berubah.

---

### Monorepo
**Penjelasan Sederhana**: Satu repository Git yang berisi banyak proyek terkait.

**Keuntungan**: Mudah sharing kode, sinkronisasi, dan deployment.

---

## N

### Next.js
**Penjelasan Sederhana**: Framework React untuk membuat website dengan fitur lengkap (routing, SSR, API routes).

**Keuntungan**: SEO-friendly, performa tinggi, developer experience bagus.

---

## O

### ORM (Object-Relational Mapping)
**Penjelasan Sederhana**: Library yang memudahkan interaksi dengan database menggunakan objek, bukan SQL mentah.

**Contoh**:
```go
// Tanpa ORM
db.Query("SELECT * FROM users WHERE id = 1")

// Dengan ORM
db.First(&user, 1)
```

---

## P

### Passkey
**Penjelasan Sederhana**: Metode login tanpa password menggunakan biometrik (fingerprint, face) atau security key.

**Keuntungan**: Lebih aman dan nyaman dari password.

---

### PostgreSQL
**Penjelasan Sederhana**: Database relasional open-source yang sangat populer dan powerful.

**Cocok untuk**: Data terstruktur dengan relasi kompleks.

---

## R

### RAG (Retrieval-Augmented Generation)
**Penjelasan Sederhana**: Teknik AI yang mencari informasi relevan dulu sebelum menjawab.

**Di Alephdraad**: AI Search mencari thread yang relevan dengan pertanyaan user.

---

### Rate Limiting
**Penjelasan Sederhana**: Membatasi jumlah request yang bisa dilakukan dalam waktu tertentu.

**Tujuan**: Mencegah spam dan serangan.

**Contoh**: Maksimal 100 request per menit.

---

### REST API
**Penjelasan Sederhana**: Gaya arsitektur API yang menggunakan HTTP methods (GET, POST, PUT, DELETE).

**Contoh**:
```
GET    /api/threads      → Ambil semua thread
POST   /api/threads      → Buat thread baru
GET    /api/threads/1    → Ambil thread ID 1
PUT    /api/threads/1    → Update thread ID 1
DELETE /api/threads/1    → Hapus thread ID 1
```

---

## S

### SSR (Server-Side Rendering)
**Penjelasan Sederhana**: Website di-render di server sebelum dikirim ke browser.

**Keuntungan**: SEO lebih baik, loading awal lebih cepat.

---

### Sudo Mode
**Penjelasan Sederhana**: Mode keamanan tambahan yang meminta autentikasi ulang untuk aksi sensitif.

**Analogi**: Seperti memasukkan PIN lagi saat transfer bank besar.

---

## T

### Token (AI Token)
**Penjelasan Sederhana**: Satuan pengukuran untuk input/output AI, kira-kira 4 karakter = 1 token.

**Contoh**:
```
"Hello, world!" = sekitar 4 tokens
```

**Di Alephdraad**: User membeli token untuk menggunakan Aleph Assistant.

---

### TOTP (Time-based One-Time Password)
**Penjelasan Sederhana**: Kode 6 digit yang berubah setiap 30 detik untuk 2FA.

**Aplikasi**: Google Authenticator, Authy.

---

## U

### ULID (Universally Unique Lexicographically Sortable Identifier)
**Penjelasan Sederhana**: ID unik yang bisa diurutkan berdasarkan waktu pembuatan.

**Contoh**: `rpl_01HN5ZYAQT8XKQVFPQM2XJWK9T`

**Keuntungan**: Unik + sortable by time.

---

## V

### Vercel
**Penjelasan Sederhana**: Platform hosting untuk frontend modern, khususnya Next.js.

**Fitur**: Deploy otomatis, preview deployments, edge functions.

---

## W

### WebAuthn
**Penjelasan Sederhana**: Standar web untuk autentikasi tanpa password (passkey).

**Support**: Browser modern, biometrik, security key.

---

### Webhook
**Penjelasan Sederhana**: URL yang dipanggil otomatis saat event tertentu terjadi.

**Analogi**: Seperti notifikasi - "Kalau ada order baru, kasih tahu saya."

---

## ▶️ Selanjutnya

- [02_TECH_STACK.md](./02_TECH_STACK.md) - Detail teknologi yang dipakai
- [03_HOW_SYSTEMS_CONNECT.md](./03_HOW_SYSTEMS_CONNECT.md) - Cara sistem terhubung
