export const dynamic = "force-static";

export const metadata = { 
  title: "Pengajuan Badge - Alephdraad",
  description: "Ajukan badge untuk mendapatkan pengakuan atas kontribusi Anda di komunitas Alephisme"
};

export default function PengajuanBadgePage() {
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
              Pengajuan Badge
            </h1>
            <p className="mt-2 text-base text-[rgb(var(--muted))]">
              Dapatkan pengakuan atas kontribusi Anda
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6">
            <p className="text-lg leading-relaxed text-[rgb(var(--fg))]">
              Ingin mendapatkan pengakuan atas kontribusi Anda? Ajukan badge dengan mengikuti langkah berikut:
            </p>

            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--fg))]">Langkah Pengajuan</h2>
              <ol className="ml-6 space-y-4 text-[rgb(var(--muted))]">
                <li className="leading-relaxed">
                  <span className="font-medium text-[rgb(var(--fg))]">Lengkapi Profil</span><br />
                  Pastikan profil Anda telah dilengkapi dengan informasi terbaru dan valid.
                </li>
                <li className="leading-relaxed">
                  <span className="font-medium text-[rgb(var(--fg))]">Siapkan Bukti</span><br />
                  Siapkan bukti kontribusi atau portofolio yang relevan dalam bentuk tautan atau dokumen.
                </li>
                <li className="leading-relaxed">
                  <span className="font-medium text-[rgb(var(--fg))]">Kirim Pengajuan</span><br />
                  Kirimkan pengajuan melalui email{' '}
                  <a 
                    href="mailto:badge@alephisme.cc" 
                    className="text-[rgb(var(--brand))] hover:underline font-medium"
                  >
                    badge@alephisme.cc
                  </a>
                  {' '}atau formulir resmi komunitas.
                </li>
              </ol>
            </div>

            <div className="rounded-xl bg-[rgb(var(--brand)/0.1)] p-6 border border-[rgb(var(--brand)/0.2)]">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-[rgb(var(--brand))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="leading-relaxed text-[rgb(var(--fg))]">
                  <strong>Waktu Peninjauan:</strong> Tim kurator kami akan meninjau pengajuan Anda maksimal dalam 5 hari kerja. Kami akan menghubungi Anda jika diperlukan informasi tambahan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
