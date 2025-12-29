export const dynamic = "force-static";

export const metadata = { 
  title: "Tentang Kami",
  description: "Alephdraad adalah ekosistem komunitas digital untuk forum, marketplace, dan edukasi"
};

export default function AboutContentPage() {
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
              Tentang Kami
            </h1>
            <p className="mt-2 text-base text-[rgb(var(--muted))]">
              Mengenal lebih dekat ekosistem Alephisme
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-neutral max-w-none dark:prose-invert">
            <p className="text-lg leading-relaxed text-[rgb(var(--fg))]">
              Selamat datang di <strong>Alephisme</strong>, tempat di mana ide dan inovasi bertemu dengan komunitas. Kami bukan sekadar platform; kami adalah sebuah ekosistem yang dibangun di atas tiga pilar utama:
            </p>

            <div className="mt-8 space-y-8">
              {/* Pilar 1 */}
              <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
                <h2 className="mb-3 text-xl font-semibold text-[rgb(var(--fg))]">
                  Forum: Ruang Berdiskusi & Berbagi
                </h2>
                <p className="leading-relaxed text-[rgb(var(--muted))]">
                  Alephisme adalah ruang digital yang hidup, tempat para anggota dapat saling berinteraksi, berdiskusi tentang berbagai topik, dan berbagi pengalaman. Kami percaya bahwa setiap orang memiliki cerita dan pengetahuan unik yang layak didengar.
                </p>
              </div>

              {/* Pilar 2 */}
              <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
                <h2 className="mb-3 text-xl font-semibold text-[rgb(var(--fg))]">
                  Marketplace: Jual Beli Terpercaya
                </h2>
                <p className="leading-relaxed text-[rgb(var(--muted))]">
                  Di Alephisme, Anda tidak hanya menemukan informasi, tetapi juga produk dan jasa berkualitas dari sesama anggota. Kami menyediakan platform jual beli yang aman dan mudah, menghubungkan pembeli dan penjual dalam satu komunitas yang saling percaya.
                </p>
              </div>

              {/* Pilar 3 */}
              <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
                <h2 className="mb-3 text-xl font-semibold text-[rgb(var(--fg))]">
                  Edukasi: Sumber Ilmu Pengetahuan
                </h2>
                <p className="leading-relaxed text-[rgb(var(--muted))]">
                  Kami berkomitmen untuk menjadi sumber ilmu yang bermanfaat. Melalui berbagai diskusi, artikel, dan kontribusi dari anggota, kami memfasilitasi pertukaran pengetahuan yang tak terbatas, membantu setiap orang untuk terus belajar dan berkembang.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-[rgb(var(--brand)/0.1)] p-6 border border-[rgb(var(--brand)/0.2)]">
              <p className="leading-relaxed text-[rgb(var(--fg))]">
                Alephisme diciptakan untuk menjadi tempat Anda menemukan inspirasi, membangun koneksi, dan meraih peluang baru. <strong>Bergabunglah dengan kami</strong> dan jadilah bagian dari komunitas yang tumbuh bersama.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
