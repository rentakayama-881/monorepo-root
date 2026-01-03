export const dynamic = "force-static";

export const metadata = { 
  title: "Bantuan - AlephDraad",
  description: "Pusat bantuan dan dukungan pelanggan AlephDraad"
};

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Pusat Bantuan</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Temukan jawaban atau hubungi tim kami
        </p>
      </div>

      {/* Contact Section */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Hubungi Kami</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[rgb(var(--border))] p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-[rgb(var(--brand))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-[rgb(var(--fg))]">Email</span>
            </div>
            <a href="mailto:ops@alephdraad.fun" className="text-sm text-[rgb(var(--brand))] hover:underline">
              ops@alephdraad.fun
            </a>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">Respons dalam 1-2 hari kerja</p>
          </div>
          <div className="rounded-lg border border-[rgb(var(--border))] p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-[rgb(var(--brand))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-[rgb(var(--fg))]">Jam Operasional</span>
            </div>
            <p className="text-sm text-[rgb(var(--muted))]">Senin - Jumat</p>
            <p className="text-sm text-[rgb(var(--muted))]">09.00 - 18.00 WIB</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Pertanyaan Umum (FAQ)</h2>
        <div className="space-y-4">
          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana cara mendaftar akun?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p>Untuk mendaftar akun AlephDraad:</p>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>Klik tombol "Daftar" di pojok kanan atas</li>
                <li>Masukkan alamat email yang valid</li>
                <li>Buat kata sandi yang kuat (minimal 8 karakter)</li>
                <li>Verifikasi email Anda melalui tautan yang dikirim</li>
                <li>Lengkapi profil Anda</li>
              </ol>
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana sistem escrow bekerja?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p className="mb-3">Sistem escrow melindungi pembeli dan penjual dalam transaksi:</p>
              <ol className="ml-5 list-decimal space-y-2">
                <li><strong className="text-[rgb(var(--fg))]">Pembeli memulai transaksi</strong> — Dana ditransfer ke rekening escrow AlephDraad</li>
                <li><strong className="text-[rgb(var(--fg))]">Penjual menerima notifikasi</strong> — Penjual mengirimkan produk/jasa sesuai kesepakatan</li>
                <li><strong className="text-[rgb(var(--fg))]">Pembeli melakukan inspeksi</strong> — Pembeli memiliki waktu untuk memeriksa produk/jasa</li>
                <li><strong className="text-[rgb(var(--fg))]">Konfirmasi penyelesaian</strong> — Jika sesuai, pembeli mengkonfirmasi dan dana diteruskan ke penjual</li>
                <li><strong className="text-[rgb(var(--fg))]">Penyelesaian sengketa</strong> — Jika ada masalah, tim arbitrase akan membantu menyelesaikan</li>
              </ol>
              <p className="mt-3 text-xs">Biaya layanan escrow: 2.5% dari nilai transaksi</p>
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana cara mengaktifkan keamanan dua faktor (2FA)?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p>Untuk mengaktifkan 2FA:</p>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>Buka Pengaturan Akun → Keamanan</li>
                <li>Pilih "Aktifkan Autentikasi Dua Faktor"</li>
                <li>Pindai kode QR dengan aplikasi authenticator (Google Authenticator, Authy, dll)</li>
                <li>Masukkan kode verifikasi 6 digit</li>
                <li>Simpan kode pemulihan di tempat aman</li>
              </ol>
              <p className="mt-3">Kami juga mendukung Passkey untuk keamanan yang lebih tinggi.</p>
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana cara mendapatkan lencana?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p>Lencana diberikan berdasarkan kontribusi dan reputasi:</p>
              <ul className="mt-2 ml-5 list-disc space-y-1">
                <li><strong className="text-[rgb(var(--fg))]">Kontributor Aktif</strong> — Membuat konten berkualitas secara konsisten</li>
                <li><strong className="text-[rgb(var(--fg))]">Penjual Terpercaya</strong> — Menyelesaikan transaksi dengan rating tinggi</li>
                <li><strong className="text-[rgb(var(--fg))]">Verified</strong> — Identitas telah diverifikasi oleh tim</li>
                <li><strong className="text-[rgb(var(--fg))]">Expert</strong> — Memiliki keahlian khusus yang diakui komunitas</li>
              </ul>
              <p className="mt-3">Lencana juga dapat diberikan berdasarkan reputasi dari platform lain yang dapat diverifikasi.</p>
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana cara melaporkan konten yang melanggar?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p>Untuk melaporkan konten yang melanggar:</p>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>Klik ikon titik tiga (⋯) pada konten yang ingin dilaporkan</li>
                <li>Pilih "Laporkan"</li>
                <li>Pilih kategori pelanggaran</li>
                <li>Berikan penjelasan tambahan jika diperlukan</li>
                <li>Kirim laporan</li>
              </ol>
              <p className="mt-3">Tim moderasi akan meninjau laporan dalam 24-48 jam.</p>
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Bagaimana cara menghapus akun?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p>Untuk menghapus akun secara permanen:</p>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>Pastikan tidak ada transaksi yang sedang berjalan</li>
                <li>Buka Pengaturan Akun → Akun</li>
                <li>Scroll ke bagian "Zona Bahaya"</li>
                <li>Klik "Hapus Akun"</li>
                <li>Konfirmasi dengan memasukkan kata sandi atau kode 2FA</li>
              </ol>
              <p className="mt-3 text-xs text-[rgb(var(--error))]">Perhatian: Penghapusan akun bersifat permanen dan tidak dapat dibatalkan.</p>
            </div>
          </details>

          <details className="group rounded-lg border border-[rgb(var(--border))]">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-[rgb(var(--fg))]">
              Metode pembayaran apa yang didukung?
              <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              <p>AlephDraad mendukung berbagai metode pembayaran:</p>
              <ul className="mt-2 ml-5 list-disc space-y-1">
                <li><strong className="text-[rgb(var(--fg))]">Transfer Bank</strong> — BCA, Mandiri, BNI, BRI, dan bank lainnya</li>
                <li><strong className="text-[rgb(var(--fg))]">E-Wallet</strong> — OVO, GoPay, DANA, ShopeePay</li>
                <li><strong className="text-[rgb(var(--fg))]">QRIS</strong> — Scan QR untuk pembayaran instan</li>
                <li><strong className="text-[rgb(var(--fg))]">Virtual Account</strong> — Tersedia untuk semua bank utama</li>
              </ul>
              <p className="mt-3">Pembayaran diproses melalui payment gateway berlisensi OJK.</p>
            </div>
          </details>
        </div>
      </section>

      {/* Guidelines */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Panduan Pengguna</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/rules-content" className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] p-4 transition-colors hover:border-[rgb(var(--brand))]">
            <svg className="h-5 w-5 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[rgb(var(--fg))]">Syarat dan Ketentuan</p>
              <p className="text-xs text-[rgb(var(--muted))]">Aturan penggunaan platform</p>
            </div>
          </a>
          <a href="/privacy" className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] p-4 transition-colors hover:border-[rgb(var(--brand))]">
            <svg className="h-5 w-5 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[rgb(var(--fg))]">Kebijakan Privasi</p>
              <p className="text-xs text-[rgb(var(--muted))]">Cara kami melindungi data Anda</p>
            </div>
          </a>
          <a href="/community-guidelines" className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] p-4 transition-colors hover:border-[rgb(var(--brand))]">
            <svg className="h-5 w-5 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[rgb(var(--fg))]">Pedoman Komunitas</p>
              <p className="text-xs text-[rgb(var(--muted))]">Etika dan perilaku di platform</p>
            </div>
          </a>
          <a href="/changelog" className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] p-4 transition-colors hover:border-[rgb(var(--brand))]">
            <svg className="h-5 w-5 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[rgb(var(--fg))]">Catatan Perubahan</p>
              <p className="text-xs text-[rgb(var(--muted))]">Pembaruan dan fitur baru</p>
            </div>
          </a>
        </div>
      </section>

      {/* Tips Box */}
      <section className="rounded-lg border border-[rgb(var(--brand))/0.2] bg-[rgb(var(--brand))/0.05] p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 shrink-0 text-[rgb(var(--brand))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[rgb(var(--fg))]">Tips untuk respons cepat</p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Sertakan detail lengkap dalam pertanyaan Anda: ID akun, tangkapan layar error, dan langkah-langkah yang sudah dicoba.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
