export const dynamic = "force-static";

export const metadata = { 
  title: "Pedoman Komunitas - AIvalid",
  description: "Pedoman perilaku dan etika komunitas AIvalid untuk menciptakan lingkungan yang aman dan produktif"
};

export default function CommunityGuidelinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">Pedoman Komunitas</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Panduan untuk menciptakan lingkungan yang aman, inklusif, dan produktif
        </p>
      </div>

      <article>
        {/* Prinsip */}
        <section className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <h2 className="mb-1.5 text-sm font-semibold text-foreground">Prinsip Dasar</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AIvalid didirikan untuk memfasilitasi pertukaran pengetahuan dan pengalaman. Kami menjunjung 
            tinggi ilmu dan memberikan penghargaan tertinggi untuk setiap upaya, sekecil apapun. Di sini, 
            setiap pengguna didorong untuk merealisasikan ide mereka dalam berbagai bentuk tindakan, teknik, dan inovasi.
          </p>
        </section>

        {/* Perilaku yang Diharapkan */}
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Perilaku yang Diharapkan</h2>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Bersikap sopan, hormat, dan profesional dalam setiap interaksi</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Memberikan kritik yang konstruktif berfokus pada argumen, bukan individu</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Menghargai perbedaan pendapat, latar belakang, dan pengalaman</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Berkontribusi dengan konten yang bermanfaat dan berkualitas</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Melaporkan konten atau perilaku yang melanggar pedoman</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Bertransaksi dengan jujur dan memenuhi kesepakatan</span>
            </li>
          </ul>
        </section>

        {/* Perilaku yang Dilarang */}
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Perilaku yang Dilarang</h2>
          
          <h3 className="mb-1.5 mt-3 text-xs font-medium text-foreground">Pelecehan dan Kekerasan</h3>
          <ul className="mb-3 space-y-0.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Serangan pribadi, penghinaan, atau ancaman terhadap pengguna lain</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Diskriminasi berdasarkan ras, agama, gender, orientasi seksual, atau latar belakang sosial</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Doxxing (mempublikasikan informasi pribadi tanpa izin)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Stalking atau pelecehan berkelanjutan</span>
            </li>
          </ul>

          <h3 className="mb-1.5 mt-3 text-xs font-medium text-foreground">Konten Berbahaya</h3>
          <ul className="mb-3 space-y-0.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Pornografi, terutama yang melibatkan anak di bawah umur</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Konten kekerasan grafis atau gore</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Propaganda terorisme atau ekstremisme</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Promosi bunuh diri atau menyakiti diri sendiri</span>
            </li>
          </ul>

          <h3 className="mb-2 mt-4 text-sm font-medium text-foreground">Penipuan dan Penyalahgunaan</h3>
          <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Penipuan dalam transaksi atau janji palsu</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Pemerasan atau blackmail</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Phishing atau upaya mencuri kredensial</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Spam dan flooding</span>
            </li>
          </ul>

          <h3 className="mb-2 mt-4 text-sm font-medium text-foreground">Pelanggaran Platform</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Membuat akun ganda untuk menghindari sanksi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Manipulasi sistem reputasi atau voting</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">✗</span>
              <span>Eksploitasi bug atau kerentanan platform</span>
            </li>
          </ul>
        </section>

        {/* Diskusi Teknis */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Diskusi Keamanan Siber</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Diskusi tentang topik keamanan siber (penetration testing, malware analysis, social engineering, dll) 
            <strong className="text-foreground"> diperbolehkan untuk tujuan edukasi dan penelitian</strong>, dengan ketentuan:
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-600">!</span>
              <span>Tidak mempublikasikan data pribadi aktif atau akses ilegal yang masih berlaku</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-600">!</span>
              <span>Tidak membagikan metode yang dapat merugikan individu secara langsung</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-600">!</span>
              <span>Pengguna bertanggung jawab penuh atas konsekuensi hukum dari tindakan mereka</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Platform tidak bertanggung jawab atas penyalahgunaan informasi yang dibagikan.
          </p>
        </section>

        {/* Konten dan Posting */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Panduan Konten</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>Unggah konten pada kategori yang sesuai</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>Gunakan judul yang jelas dan deskriptif</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>Hindari posting berulang (flood) dan konten duplikat</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>Sertakan sumber jika mengutip karya orang lain</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>Humor dan meme diperbolehkan selama tidak merendahkan orang lain</span>
            </li>
          </ul>
        </section>

        {/* Penegakan */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Penegakan dan Sanksi</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Pelanggaran pedoman akan ditangani secara proporsional:
          </p>
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <h4 className="text-sm font-medium text-foreground">Pelanggaran Ringan</h4>
              <p className="text-xs text-muted-foreground">Teguran tertulis, penghapusan konten</p>
            </div>
            <div className="rounded-lg border border-amber-600/30 bg-amber-600/5 p-3">
              <h4 className="text-sm font-medium text-foreground">Pelanggaran Sedang</h4>
              <p className="text-xs text-muted-foreground">Pembatasan fitur, penangguhan sementara (1-30 hari)</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <h4 className="text-sm font-medium text-foreground">Pelanggaran Berat</h4>
              <p className="text-xs text-muted-foreground">Pemutusan akun permanen, pelaporan ke pihak berwajib jika melanggar hukum</p>
            </div>
          </div>
        </section>

        {/* Nilai Komunitas */}
        <section className="mb-8 rounded-lg border border-border bg-muted/50 p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">Nilai-Nilai Komunitas</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">✦</span>
              <span>Kemanusiaan di atas segalanya</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✦</span>
              <span>Ilmu untuk berkembang, bukan untuk menindas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✦</span>
              <span>Kebebasan berpendapat dibarengi tanggung jawab</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✦</span>
              <span>Bertindak dengan rasionalitas dan kesadaran penuh</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✦</span>
              <span>Saling menghargai meskipun berbeda pandangan</span>
            </li>
          </ul>
        </section>

        {/* Kontak */}
        <section>
          <p className="text-sm text-muted-foreground">
            Untuk melaporkan pelanggaran atau pertanyaan terkait pedoman komunitas, hubungi:{" "}
            <a href="mailto:ops@aivalid.id" className="text-primary hover:underline">
              ops@aivalid.id
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
