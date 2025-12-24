export const dynamic = "force-static";

export const metadata = { 
  title: "Aturan Komunitas - Alephdraad",
  description: "Pedoman dan aturan komunitas Alephisme untuk menciptakan lingkungan yang aman dan produktif"
};

export default function RulesContentPage() {
  return (
    <div className="relative">
      {/* Background accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-80px] h-[280px] blur-3xl"
        style={{
          background: 'radial-gradient(500px circle at 50% 0%, rgb(var(--brand) / 0.12), transparent 60%)'
        }}
      />

      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm sm:p-8 lg:p-12">
          {/* Header */}
          <div className="mb-8 border-b border-[rgb(var(--border))] pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--fg))] sm:text-4xl">
              Aturan Komunitas
            </h1>
            <p className="mt-2 text-base text-[rgb(var(--muted))]">
              Pedoman untuk menciptakan lingkungan yang aman dan produktif
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-neutral max-w-none dark:prose-invert space-y-6">
            <div className="rounded-xl bg-[rgb(var(--brand)/0.1)] p-6 border border-[rgb(var(--brand)/0.2)]">
              <h3 className="mb-2 text-lg font-semibold text-[rgb(var(--fg))]">Prinsip Utama</h3>
              <p className="leading-relaxed text-[rgb(var(--fg))]">
                Platform ini didirikan untuk memfasilitasi pertukaran pengetahuan, pengalaman, serta mengatasi kesenjangan sosial. Kami menjunjung tinggi ilmu dan pengalaman, memberikan penghargaan tertinggi untuk setiap upaya, sekecil apa pun, yang telah Anda lakukan. Kami menyingkirkan sebutan "teori" karena di sini setiap pengguna didorong untuk merealisasikan ide mereka dalam berbagai bentuk tindakan, teknik, dan inovasi.
              </p>
            </div>

            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
              <h2 className="mb-4 text-xl font-semibold text-[rgb(var(--fg))]">I. Pendaftaran & Akun</h2>
              <ol className="ml-6 space-y-3 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">Gunakan nama pengguna yang layak dan pantas. Hindari penggunaan kata-kata yang kasar atau melecehkan.</li>
                <li className="leading-relaxed">Jaga keamanan akun Anda. Jika terjadi peretasan, segera laporkan agar akun tidak disalahgunakan.</li>
                <li className="leading-relaxed">Kami sengaja hanya menyediakan opsi pendaftaran/masuk melalui akun GitHub untuk mencegah penyalahgunaan akun secara masif.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
              <h2 className="mb-4 text-xl font-semibold text-[rgb(var(--fg))]">II. Etika & Perilaku</h2>
              <ol className="ml-6 space-y-3 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">Dilarang melakukan serangan pribadi, termasuk menghina, merendahkan, atau mengancam pengguna lain.</li>
                <li className="leading-relaxed">Kritik diperbolehkan, namun harus berfokus pada argumen atau gagasan, bukan pada individu.</li>
                <li className="leading-relaxed">Dilarang melakukan diskriminasi berdasarkan ras, agama, gender, orientasi, atau latar belakang sosial.</li>
                <li className="leading-relaxed">
                  Dilarang menyebarkan konten yang merusak kemanusiaan, termasuk:
                  <ol className="ml-4 mt-2 space-y-1">
                    <li>Kekerasan brutal, pelecehan seksual, eksploitasi anak, terorisme, perdagangan manusia, atau promosi bunuh diri.</li>
                  </ol>
                </li>
                <li className="leading-relaxed">
                  <strong className="text-[rgb(var(--fg))]">Diskusi tentang topik sensitif</strong>, seperti peretasan, eksploitasi, perangkat perusak (malware), rekayasa sosial (social engineering), serangan DDoS, Injeksi SQL, XSS, pembobolan, dan serangan bruteforce diperbolehkan, <strong className="text-[rgb(var(--fg))]">sebatas untuk tujuan edukasi, penelitian, atau simulasi</strong>. Dengan ketentuan:
                  <ol className="ml-4 mt-2 space-y-2">
                    <li>Tidak diperbolehkan memublikasikan data pribadi (doxing), akses ilegal yang masih aktif, atau metode yang dapat merugikan individu secara langsung.</li>
                    <li>Tidak diperbolehkan mencuri data pribadi (misalnya, alamat surel) milik orang lain.</li>
                    <li>Setiap pengguna bertanggung jawab secara pribadi atau kelompok atas segala konsekuensi hukum tanpa melibatkan pihak platform.</li>
                  </ol>
                </li>
                <li className="leading-relaxed">Humor, meme, atau percakapan ringan tidak dilarang selama tidak merendahkan atau melukai martabat orang lain.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
              <h2 className="mb-4 text-xl font-semibold text-[rgb(var(--fg))]">III. Konten & Diskusi</h2>
              <ol className="ml-6 space-y-3 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">Unggah konten pada kategori yang sesuai.</li>
                <li className="leading-relaxed">Hindari pengiriman konten berulang (flood) dan spam.</li>
                <li className="leading-relaxed">Judul thread harus jelas dan deskriptif, bukan hanya "Tolong!!!" atau "Help".</li>
                <li className="leading-relaxed">Berbagi data atau alat uji diizinkan selama tidak digunakan untuk merugikan pihak nyata (misalnya, menyebarluaskan data sensitif yang masih aktif).</li>
              </ol>
            </div>

            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
              <h2 className="mb-4 text-xl font-semibold text-[rgb(var(--fg))]">IV. Transaksi & Komunitas</h2>
              <ol className="ml-6 space-y-3 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">Apabila terjadi transaksi, disarankan untuk menggunakan sistem penjaminan dana (escrow) hingga batas waktu kesepakatan tercapai.</li>
                <li className="leading-relaxed">Dilarang menipu, memeras, atau menyalahgunakan kepercayaan pengguna lain.</li>
                <li className="leading-relaxed">Di sini, <strong className="text-[rgb(var(--fg))]">pengetahuan jauh lebih berharga daripada keuntungan semata</strong>.</li>
                <li className="leading-relaxed">Pengguna yang memiliki portofolio atau reputasi dari platform lain, seperti pengguna A yang telah menjual ribuan akun, atau pengguna B yang memiliki reputasi di platform lain, dapat menerima penghargaan berupa lencana. Kami tidak membatasi pengguna untuk memperoleh penghargaan dari berbagai platform. Kami memiliki pedoman selektif untuk mengidentifikasi kelayakan pengguna sebelum memutuskan untuk memberikan penghargaan.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
              <h2 className="mb-4 text-xl font-semibold text-[rgb(var(--fg))]">V. Penegakan Aturan</h2>
              <ol className="ml-6 space-y-3 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">Moderator dan arbitrator akan bertindak sebagai mediator untuk menyelesaikan konflik, bukan untuk membela salah satu pihak atau mengintervensi satu sama lain.</li>
                <li className="leading-relaxed">Pelanggaran ringan akan dikenai teguran.</li>
                <li className="leading-relaxed">Pelanggaran serius, seperti merugikan individu secara langsung, eksploitasi manusia, atau penipuan, akan berujung pada sanksi larangan permanen (ban).</li>
                <li className="leading-relaxed">Diskusi mengenai keputusan moderator atau arbitrator diperbolehkan.</li>
              </ol>
            </div>

            <div className="rounded-xl border-2 border-[rgb(var(--brand)/0.3)] bg-[rgb(var(--brand)/0.05)] p-6">
              <h2 className="mb-4 text-xl font-semibold text-[rgb(var(--fg))]">VI. Nilai Dasar Komunitas</h2>
              <ul className="ml-6 space-y-2 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">✦ Kemanusiaan di atas segalanya.</li>
                <li className="leading-relaxed">✦ Ilmu untuk berkembang, bukan untuk menindas.</li>
                <li className="leading-relaxed">✦ Kebebasan berpendapat harus dibarengi dengan tanggung jawab.</li>
                <li className="leading-relaxed">✦ Bertindak dengan rasionalitas dan kesadaran penuh.</li>
                <li className="leading-relaxed">✦ Saling menghargai, meskipun berbeda pandangan.</li>
                <li className="leading-relaxed">✦ Memiliki simpati, empati, dan kepedulian terhadap sesama.</li>
              </ul>
              <p className="mt-4 italic leading-relaxed text-[rgb(var(--fg))]">
                Di sini, kebebasan dan etika berpadu menjadi satu. Ketika Anda melanggar aturan, Anda akan menerima konsekuensinya, begitu pun sebaliknya. Anda tidak perlu membongkar seluruh rumah hanya untuk mengeluarkan mobil; ada banyak cara yang lebih baik, misalnya merusak garasi. <span className="font-semibold">Salam.</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

