export const dynamic = "force-static";

export const metadata = { 
  title: "Tentang Kami - AlephDraad",
  description: "PT AlephDraad Utility Stack - Platform komunitas digital untuk forum, marketplace, dan pertukaran pengetahuan"
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--fg))]">Tentang AlephDraad</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Platform komunitas digital Indonesia
        </p>
      </div>

      {/* Company Info */}
      <article className="prose-doc">
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Perusahaan</h2>
          <p className="mb-4 text-sm leading-relaxed text-[rgb(var(--muted))]">
            <strong className="text-[rgb(var(--fg))]">PT ALEPHDRAAD UTILITY STACK</strong> adalah perusahaan teknologi 
            yang berfokus pada pengembangan platform komunitas digital. Kami berkomitmen untuk menyediakan 
            ruang yang aman, terpercaya, dan bermanfaat bagi seluruh pengguna di Indonesia.
          </p>
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            Didirikan dengan visi untuk mendemokratisasi akses terhadap pengetahuan dan peluang ekonomi digital, 
            AlephDraad hadir sebagai jembatan antara komunitas, edukasi, dan transaksi yang transparan.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Visi</h2>
          <p className="text-sm leading-relaxed text-[rgb(var(--muted))]">
            Menjadi platform komunitas digital terdepan di Indonesia yang menghubungkan pengetahuan, 
            inovasi, dan peluang ekonomi secara inklusif dan berkelanjutan.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Misi</h2>
          <ul className="space-y-2 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--brand))]" />
              <span>Menyediakan platform diskusi yang berkualitas dan bebas dari konten berbahaya</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--brand))]" />
              <span>Memfasilitasi transaksi digital yang aman dengan sistem escrow terpercaya</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--brand))]" />
              <span>Mendorong pertukaran pengetahuan dan pengalaman antar anggota komunitas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--brand))]" />
              <span>Memberikan penghargaan kepada kontributor yang berdedikasi</span>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Layanan Kami</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-medium text-[rgb(var(--fg))]">Forum Diskusi</h3>
              <p className="text-sm text-[rgb(var(--muted))]">
                Ruang interaksi untuk berbagi ide, pengalaman, dan pengetahuan dengan sesama anggota komunitas.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-[rgb(var(--fg))]">Marketplace</h3>
              <p className="text-sm text-[rgb(var(--muted))]">
                Platform jual beli produk dan jasa digital dengan sistem escrow untuk keamanan transaksi.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-[rgb(var(--fg))]">Sistem Reputasi</h3>
              <p className="text-sm text-[rgb(var(--muted))]">
                Penghargaan berupa lencana dan level untuk anggota yang berkontribusi positif.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Landasan Hukum</h2>
          <p className="mb-3 text-sm leading-relaxed text-[rgb(var(--muted))]">
            PT AlephDraad Utility Stack beroperasi sesuai dengan peraturan perundang-undangan Republik Indonesia, termasuk namun tidak terbatas pada:
          </p>
          <ul className="space-y-1.5 text-sm text-[rgb(var(--muted))]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik (UU ITE) sebagaimana diubah dengan UU No. 19 Tahun 2016</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted))]" />
              <span>Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[rgb(var(--fg))]">Kontak Perusahaan</h2>
          <div className="space-y-2 text-sm text-[rgb(var(--muted))]">
            <p>
              <span className="text-[rgb(var(--fg))]">Email:</span>{" "}
              <a href="mailto:ops@alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">
                ops@alephdraad.fun
              </a>
            </p>
            <p>
              <span className="text-[rgb(var(--fg))]">Website:</span>{" "}
              <a href="https://www.alephdraad.fun" className="text-[rgb(var(--brand))] hover:underline">
                www.alephdraad.fun
              </a>
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
