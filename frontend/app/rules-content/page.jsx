export const dynamic = "force-static";

export const metadata = { 
  title: "Syarat dan Ketentuan - AlephDraad",
  description: "Syarat dan ketentuan penggunaan platform AlephDraad serta pedoman komunitas"
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Syarat dan Ketentuan</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Terakhir diperbarui: 3 Januari 2026
        </p>
      </div>

      <article className="prose-doc">
        {/* Intro */}
        <section className="mb-8">
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            Dengan mengakses dan menggunakan platform AlephDraad (<a href="https://www.alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">www.alephdraad.fun</a>), 
            Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat dengan syarat dan ketentuan ini. 
            Dokumen ini merupakan perjanjian yang sah secara hukum antara Anda ("Pengguna") dan PT AlephDraad Utility Stack ("Kami").
          </p>
        </section>

        {/* Pasal 1 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 1 — Definisi</h2>
          <ul className="space-y-2 text-sm text-[rgb(var(--muted))]">
            <li><strong className="text-[rgb(var(--fg))]">Platform</strong> adalah situs web AlephDraad beserta seluruh layanan yang disediakan.</li>
            <li><strong className="text-[rgb(var(--fg))]">Pengguna</strong> adalah setiap individu yang mengakses atau menggunakan Platform.</li>
            <li><strong className="text-[rgb(var(--fg))]">Konten</strong> adalah segala informasi, teks, gambar, atau materi lain yang diunggah ke Platform.</li>
            <li><strong className="text-[rgb(var(--fg))]">Escrow</strong> adalah sistem penjaminan dana yang dikelola Platform untuk keamanan transaksi.</li>
            <li><strong className="text-[rgb(var(--fg))]">Lencana</strong> adalah penghargaan digital yang diberikan kepada Pengguna berdasarkan kontribusi.</li>
          </ul>
        </section>

        {/* Pasal 2 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 2 — Pendaftaran dan Akun</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Pengguna wajib berusia minimal 17 (tujuh belas) tahun atau didampingi orang tua/wali untuk mendaftar.</li>
            <li>Pengguna wajib memberikan informasi yang akurat dan terkini saat pendaftaran.</li>
            <li>Setiap Pengguna hanya diperbolehkan memiliki satu akun aktif.</li>
            <li>Pengguna bertanggung jawab penuh atas keamanan kredensial akun (kata sandi, passkey, kode 2FA).</li>
            <li>Pengguna wajib segera melaporkan jika terjadi akses tidak sah terhadap akunnya.</li>
            <li>Nama pengguna tidak boleh mengandung kata-kata kasar, menyinggung, atau menyerupai nama resmi pihak lain.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            Dasar hukum: Pasal 26 ayat (1) UU No. 19 Tahun 2016 tentang Perubahan UU ITE
          </p>
        </section>

        {/* Pasal 3 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 3 — Konten dan Perilaku</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Pengguna dilarang mengunggah konten yang melanggar hukum Republik Indonesia.</li>
            <li>
              <span>Konten yang dilarang meliputi namun tidak terbatas pada:</span>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Pornografi, terutama yang melibatkan anak di bawah umur</li>
                <li>Ujaran kebencian berbasis SARA (Suku, Agama, Ras, Antargolongan)</li>
                <li>Ancaman kekerasan atau terorisme</li>
                <li>Penipuan dan pemerasan</li>
                <li>Pelanggaran hak kekayaan intelektual</li>
                <li>Data pribadi pihak lain tanpa persetujuan (doxing)</li>
              </ul>
            </li>
            <li>Diskusi teknis tentang keamanan siber diperbolehkan untuk tujuan edukasi dengan batasan tidak merugikan pihak nyata.</li>
            <li>Kritik konstruktif diperbolehkan; serangan personal dilarang.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            Dasar hukum: Pasal 27-29 UU No. 11 Tahun 2008 jo. UU No. 19 Tahun 2016 tentang ITE
          </p>
        </section>

        {/* Pasal 4 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 4 — Transaksi dan Escrow</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Platform menyediakan sistem escrow untuk memfasilitasi transaksi antar Pengguna.</li>
            <li>Dana pembeli akan ditahan oleh Platform hingga kedua belah pihak mengkonfirmasi penyelesaian transaksi.</li>
            <li>Penjual wajib menyerahkan produk/jasa sesuai deskripsi yang tercantum.</li>
            <li>Pembeli memiliki waktu yang ditentukan untuk melakukan inspeksi dan mengajukan klaim jika ada ketidaksesuaian.</li>
            <li>Platform berhak memotong biaya layanan dari setiap transaksi sesuai ketentuan yang berlaku.</li>
            <li>Sengketa transaksi akan diselesaikan melalui mekanisme arbitrase internal Platform.</li>
            <li>Keputusan arbitrase bersifat final dan mengikat kedua belah pihak.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            Dasar hukum: Pasal 17 PP No. 71 Tahun 2019 tentang PSTE; UU No. 8 Tahun 1999 tentang Perlindungan Konsumen
          </p>
        </section>

        {/* Pasal 5 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 5 — Hak Kekayaan Intelektual</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Pengguna mempertahankan hak atas konten yang diunggah ke Platform.</li>
            <li>Dengan mengunggah konten, Pengguna memberikan lisensi non-eksklusif kepada Platform untuk menampilkan konten tersebut.</li>
            <li>Platform berhak menghapus konten yang diduga melanggar hak kekayaan intelektual pihak lain.</li>
            <li>Merek dagang "AlephDraad" dan logo terkait adalah milik PT AlephDraad Utility Stack.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            Dasar hukum: UU No. 28 Tahun 2014 tentang Hak Cipta; UU No. 20 Tahun 2016 tentang Merek dan Indikasi Geografis
          </p>
        </section>

        {/* Pasal 6 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 6 — Privasi dan Data Pribadi</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Platform mengumpulkan dan memproses data pribadi sesuai dengan Kebijakan Privasi yang merupakan bagian tidak terpisahkan dari Syarat dan Ketentuan ini.</li>
            <li>Pengguna menyetujui pengumpulan data yang diperlukan untuk operasional Platform.</li>
            <li>Platform tidak akan menjual data pribadi Pengguna kepada pihak ketiga.</li>
            <li>Pengguna berhak mengakses, memperbaiki, dan menghapus data pribadinya.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            Dasar hukum: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi
          </p>
        </section>

        {/* Pasal 7 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 7 — Sanksi Pelanggaran</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li><strong className="text-[rgb(var(--fg))]">Teguran:</strong> Pelanggaran ringan akan dikenai peringatan tertulis.</li>
            <li><strong className="text-[rgb(var(--fg))]">Pembatasan fitur:</strong> Pelanggaran berulang dapat mengakibatkan pembatasan akses fitur tertentu.</li>
            <li><strong className="text-[rgb(var(--fg))]">Penangguhan sementara:</strong> Pelanggaran serius dapat mengakibatkan penangguhan akun sementara.</li>
            <li><strong className="text-[rgb(var(--fg))]">Pemutusan permanen:</strong> Pelanggaran berat akan mengakibatkan pemutusan akun secara permanen tanpa pengembalian dana.</li>
            <li>Platform berhak melaporkan pelanggaran pidana kepada pihak berwajib.</li>
          </ol>
        </section>

        {/* Pasal 8 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 8 — Batasan Tanggung Jawab</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Platform disediakan "sebagaimana adanya" tanpa jaminan apapun.</li>
            <li>Platform tidak bertanggung jawab atas kerugian yang timbul dari penggunaan Platform.</li>
            <li>Platform tidak bertanggung jawab atas konten yang diunggah oleh Pengguna.</li>
            <li>Platform tidak menjamin ketersediaan layanan tanpa gangguan.</li>
          </ol>
        </section>

        {/* Pasal 9 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 9 — Perubahan Ketentuan</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Platform berhak mengubah Syarat dan Ketentuan ini sewaktu-waktu.</li>
            <li>Perubahan akan diberitahukan melalui Platform atau email terdaftar.</li>
            <li>Penggunaan Platform setelah perubahan berlaku dianggap sebagai persetujuan atas perubahan tersebut.</li>
          </ol>
        </section>

        {/* Pasal 10 */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Pasal 10 — Hukum yang Berlaku</h2>
          <ol className="list-decimal ml-5 space-y-2 text-sm text-[rgb(var(--muted))]">
            <li>Syarat dan Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia.</li>
            <li>Segala sengketa yang timbul akan diselesaikan melalui musyawarah untuk mufakat.</li>
            <li>Apabila musyawarah tidak mencapai kesepakatan, sengketa akan diselesaikan melalui Pengadilan Negeri Jakarta Selatan.</li>
          </ol>
        </section>

        {/* Contact */}
        <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[rgb(var(--fg))]">Kontak</h2>
          <p className="text-sm text-[rgb(var(--muted))]">
            Untuk pertanyaan terkait Syarat dan Ketentuan ini, silakan hubungi:{" "}
            <a href="mailto:ops@alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">
              ops@alephdraad.fun
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
