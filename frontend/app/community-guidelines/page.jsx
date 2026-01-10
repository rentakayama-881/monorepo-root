export const dynamic = "force-static";

export const metadata = { 
  title: "Pedoman Komunitas - AlephDraad",
  description: "Pedoman perilaku dan etika komunitas AlephDraad untuk menciptakan lingkungan yang aman dan produktif"
};

export default function CommunityGuidelinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-[rgb(var(--border))] pb-4">
        <h1 className="text-lg font-semibold text-[rgb(var(--fg))]">Pedoman Komunitas</h1>
        <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
          Panduan untuk menciptakan lingkungan yang aman, inklusif, dan produktif
        </p>
      </div>

      <article>
        {/* Prinsip */}
        <section className="mb-4 rounded-lg border border-[rgb(var(--brand))]/20 bg-[rgb(var(--brand))]/5 p-3">
          <h2 className="mb-1.5 text-sm font-semibold text-[rgb(var(--fg))]">Prinsip Dasar</h2>
          <p className="text-xs text-[rgb(var(--muted))] leading-relaxed">
            AlephDraad didirikan untuk memfasilitasi pertukaran pengetahuan dan pengalaman. Kami menjunjung 
            tinggi ilmu dan memberikan penghargaan tertinggi untuk setiap upaya, sekecil apapun. Di sini, 
            setiap pengguna didorong untuk merealisasikan ide mereka dalam berbagai bentuk tindakan, teknik, dan inovasi.
          </p>
        </section>

        {/* Perilaku yang Diharapkan */}
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-[rgb(var(--fg))]">Perilaku yang Diharapkan</h2>
          <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--success))]">✓</span>
              <span>Bersikap sopan, hormat, dan profesional dalam setiap interaksi</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--success))]">✓</span>
              <span>Memberikan kritik yang konstruktif berfokus pada argumen, bukan individu</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--success))]">✓</span>
              <span>Menghargai perbedaan pendapat, latar belakang, dan pengalaman</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--success))]">✓</span>
              <span>Berkontribusi dengan konten yang bermanfaat dan berkualitas</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--success))]">✓</span>
              <span>Melaporkan konten atau perilaku yang melanggar pedoman</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--success))]">✓</span>
              <span>Bertransaksi dengan jujur dan memenuhi kesepakatan</span>
            </li>
          </ul>
        </section>

        {/* Perilaku yang Dilarang */}
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-[rgb(var(--fg))]">Perilaku yang Dilarang</h2>
          
          <h3 className="mb-1.5 mt-3 text-xs font-medium text-[rgb(var(--fg))]">Pelecehan dan Kekerasan</h3>
          <ul className="mb-3 space-y-0.5 text-xs text-[rgb(var(--muted))]">
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Serangan pribadi, penghinaan, atau ancaman terhadap pengguna lain</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Diskriminasi berdasarkan ras, agama, gender, orientasi seksual, atau latar belakang sosial</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Doxxing (mempublikasikan informasi pribadi tanpa izin)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Stalking atau pelecehan berkelanjutan</span>
            </li>
          </ul>

          <h3 className="mb-1.5 mt-3 text-xs font-medium text-[rgb(var(--fg))]">Konten Berbahaya</h3>
          <ul className="mb-3 space-y-0.5 text-xs text-[rgb(var(--muted))]">
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Pornografi, terutama yang melibatkan anak di bawah umur</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Konten kekerasan grafis atau gore</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Propaganda terorisme atau ekstremisme</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Promosi bunuh diri atau menyakiti diri sendiri</span>
            </li>
          </ul>

          <h3 className="mb-2 mt-4 text-sm font-medium text-[rgb(var(--fg))]">Penipuan dan Penyalahgunaan</h3>
          <ul className="mb-4 space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Penipuan dalam transaksi atau janji palsu</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Pemerasan atau blackmail</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Phishing atau upaya mencuri kredensial</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Spam dan flooding</span>
            </li>
          </ul>

          <h3 className="mb-2 mt-4 text-sm font-medium text-[rgb(var(--fg))]">Pelanggaran Platform</h3>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Membuat akun ganda untuk menghindari sanksi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Manipulasi sistem reputasi atau voting</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--error))]">✗</span>
              <span>Eksploitasi bug atau kerentanan platform</span>
            </li>
          </ul>
        </section>

        {/* Diskusi Teknis */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Diskusi Keamanan Siber</h2>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">
            Diskusi tentang topik keamanan siber (penetration testing, malware analysis, social engineering, dll) 
            <strong className="text-[rgb(var(--fg))]"> diperbolehkan untuk tujuan edukasi dan penelitian</strong>, dengan ketentuan:
          </p>
          <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--warning))]">!</span>
              <span>Tidak mempublikasikan data pribadi aktif atau akses ilegal yang masih berlaku</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--warning))]">!</span>
              <span>Tidak membagikan metode yang dapat merugikan individu secara langsung</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[rgb(var(--warning))]">!</span>
              <span>Pengguna bertanggung jawab penuh atas konsekuensi hukum dari tindakan mereka</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            Platform tidak bertanggung jawab atas penyalahgunaan informasi yang dibagikan.
          </p>
        </section>

        {/* Konten dan Posting */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Panduan Konten</h2>
          <ul className="space-y-2 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Unggah konten pada kategori yang sesuai</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Gunakan judul yang jelas dan deskriptif</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Hindari posting berulang (flood) dan konten duplikat</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Sertakan sumber jika mengutip karya orang lain</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Humor dan meme diperbolehkan selama tidak merendahkan orang lain</span>
            </li>
          </ul>
        </section>

        {/* Penegakan */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Penegakan dan Sanksi</h2>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">
            Pelanggaran pedoman akan ditangani secara proporsional:
          </p>
          <div className="space-y-3">
            <div className="rounded-lg border border-[rgb(var(--border))] p-3">
              <h4 className="text-sm font-medium text-[rgb(var(--fg))]">Pelanggaran Ringan</h4>
              <p className="text-xs text-[rgb(var(--muted))]">Teguran tertulis, penghapusan konten</p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--warning))/0.3] bg-[rgb(var(--warning))/0.05] p-3">
              <h4 className="text-sm font-medium text-[rgb(var(--fg))]">Pelanggaran Sedang</h4>
              <p className="text-xs text-[rgb(var(--muted))]">Pembatasan fitur, penangguhan sementara (1-30 hari)</p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--error))/0.3] bg-[rgb(var(--error))/0.05] p-3">
              <h4 className="text-sm font-medium text-[rgb(var(--fg))]">Pelanggaran Berat</h4>
              <p className="text-xs text-[rgb(var(--muted))]">Pemutusan akun permanen, pelaporan ke pihak berwajib jika melanggar hukum</p>
            </div>
          </div>
        </section>

        {/* Nilai Komunitas */}
        <section className="mb-8 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
          <h2 className="mb-3 text-base font-semibold text-[rgb(var(--fg))]">Nilai-Nilai Komunitas</h2>
          <ul className="space-y-2 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="text-[rgb(var(--brand))]">✦</span>
              <span>Kemanusiaan di atas segalanya</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[rgb(var(--brand))]">✦</span>
              <span>Ilmu untuk berkembang, bukan untuk menindas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[rgb(var(--brand))]">✦</span>
              <span>Kebebasan berpendapat dibarengi tanggung jawab</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[rgb(var(--brand))]">✦</span>
              <span>Bertindak dengan rasionalitas dan kesadaran penuh</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[rgb(var(--brand))]">✦</span>
              <span>Saling menghargai meskipun berbeda pandangan</span>
            </li>
          </ul>
        </section>

        {/* Kontak */}
        <section>
          <p className="text-sm text-[rgb(var(--muted))]">
            Untuk melaporkan pelanggaran atau pertanyaan terkait pedoman komunitas, hubungi:{" "}
            <a href="mailto:ops@alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">
              ops@alephdraad.fun
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
