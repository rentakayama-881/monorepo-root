export const dynamic = "force-static";

export const metadata = { 
  title: "Kebijakan Privasi - AlephDraad",
  description: "Kebijakan privasi dan perlindungan data pribadi pengguna AlephDraad"
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Kebijakan Privasi</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Terakhir diperbarui: 3 Januari 2026
        </p>
      </div>

      <article className="prose-doc">
        {/* Intro */}
        <section className="mb-8">
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            PT AlephDraad Utility Stack ("Kami") berkomitmen untuk melindungi privasi dan data pribadi Anda. 
            Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi 
            informasi Anda saat menggunakan platform AlephDraad.
          </p>
        </section>

        {/* Data yang Dikumpulkan */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">1. Data yang Kami Kumpulkan</h2>
          
          <h3 className="mb-2 text-sm font-medium text-[rgb(var(--fg))]">1.1 Data yang Anda Berikan</h3>
          <ul className="mb-4 space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Informasi akun: nama, alamat email, nama pengguna, kata sandi (terenkripsi)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Informasi profil: foto profil, bio, tautan media sosial</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Konten yang Anda unggah: thread, komentar, pesan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Informasi transaksi: untuk keperluan escrow dan pembayaran</span>
            </li>
          </ul>

          <h3 className="mb-2 text-sm font-medium text-[rgb(var(--fg))]">1.2 Data yang Dikumpulkan Otomatis</h3>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Alamat IP dan informasi perangkat</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Jenis browser dan sistem operasi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Log aktivitas dan waktu akses</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Cookie dan teknologi pelacakan serupa</span>
            </li>
          </ul>
        </section>

        {/* Penggunaan Data */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">2. Penggunaan Data</h2>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">Kami menggunakan data Anda untuk:</p>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Menyediakan, mengoperasikan, dan memelihara layanan Platform</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Memproses transaksi dan mengelola escrow</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Mengirimkan notifikasi terkait akun dan transaksi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Mendeteksi dan mencegah penipuan serta aktivitas berbahaya</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Meningkatkan kualitas layanan berdasarkan analisis penggunaan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Mematuhi kewajiban hukum dan regulasi yang berlaku</span>
            </li>
          </ul>
        </section>

        {/* Penyimpanan Data */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">3. Penyimpanan dan Keamanan Data</h2>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Data disimpan di server yang berlokasi di Indonesia dan/atau Singapura</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Enkripsi end-to-end untuk data sensitif (kata sandi, informasi pembayaran)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Akses data dibatasi hanya untuk personel yang berwenang</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Audit keamanan berkala untuk mendeteksi kerentanan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Data disimpan selama akun aktif atau sesuai kewajiban hukum</span>
            </li>
          </ul>
        </section>

        {/* Pembagian Data */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">4. Pembagian Data dengan Pihak Ketiga</h2>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">Kami tidak menjual data pribadi Anda. Data dapat dibagikan hanya kepada:</p>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Penyedia layanan pembayaran:</strong> untuk memproses transaksi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Penyedia infrastruktur:</strong> hosting, CDN, dan layanan cloud</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Pihak berwenang:</strong> jika diwajibkan oleh hukum atau perintah pengadilan</span>
            </li>
          </ul>
        </section>

        {/* Hak Pengguna */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">5. Hak Anda sebagai Subjek Data</h2>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">Sesuai dengan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda memiliki hak untuk:</p>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Mengakses</strong> data pribadi yang kami simpan tentang Anda</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Memperbaiki</strong> data yang tidak akurat atau tidak lengkap</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Menghapus</strong> data pribadi Anda (dengan batasan tertentu)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Menarik persetujuan</strong> atas pemrosesan data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Memindahkan</strong> data ke platform lain (portabilitas data)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Mengajukan keberatan</strong> atas pemrosesan data tertentu</span>
            </li>
          </ul>
        </section>

        {/* Cookie */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">6. Cookie dan Teknologi Pelacakan</h2>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">Kami menggunakan cookie untuk:</p>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Cookie esensial:</strong> diperlukan untuk fungsi dasar Platform</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Cookie autentikasi:</strong> menjaga sesi login Anda</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span><strong className="text-[rgb(var(--fg))]">Cookie preferensi:</strong> menyimpan pengaturan tampilan</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-[rgb(var(--muted))]">
            Anda dapat mengelola preferensi cookie melalui pengaturan browser Anda.
          </p>
        </section>

        {/* Perubahan Kebijakan */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">7. Perubahan Kebijakan Privasi</h2>
          <p className="text-sm text-[rgb(var(--muted))]">
            Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan material akan 
            diberitahukan melalui email atau notifikasi di Platform. Penggunaan Platform setelah perubahan 
            berlaku dianggap sebagai persetujuan atas kebijakan yang diperbarui.
          </p>
        </section>

        {/* Kontak */}
        <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[rgb(var(--fg))]">Hubungi Kami</h2>
          <p className="text-sm text-[rgb(var(--muted))]">
            Untuk pertanyaan terkait privasi dan data pribadi, silakan hubungi:{" "}
            <a href="mailto:ops@alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">
              ops@alephdraad.fun
            </a>
          </p>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            Dasar hukum: Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi
          </p>
        </section>
      </article>
    </main>
  );
}
