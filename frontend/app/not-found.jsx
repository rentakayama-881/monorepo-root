import Link from "next/link";

export const metadata = {
  title: "Halaman Tidak Ditemukan",
  description: "Halaman yang Anda cari tidak ditemukan.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Icon */}
        <div className="mx-auto w-24 h-24 rounded-full bg-[rgb(var(--surface-2))] flex items-center justify-center mb-6">
          <span className="text-4xl font-bold text-[rgb(var(--muted))]">404</span>
        </div>

        <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-3">
          Halaman Tidak Ditemukan
        </h1>

        <p className="text-[rgb(var(--muted))] mb-8">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex justify-center items-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/contact-support"
            className="inline-flex justify-center items-center rounded-lg border border-[rgb(var(--border))] px-6 py-3 text-sm font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface))] transition"
          >
            Hubungi Kami
          </Link>
        </div>

        {/* Helpful links */}
        <div className="mt-10 pt-6 border-t border-[rgb(var(--border))]">
          <p className="text-sm text-[rgb(var(--muted))] mb-4">Mungkin Anda mencari:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/threads" className="text-emerald-600 hover:underline">
              Thread Terbaru
            </Link>
            <Link href="/about-content" className="text-emerald-600 hover:underline">
              Tentang Kami
            </Link>
            <Link href="/rules-content" className="text-emerald-600 hover:underline">
              Aturan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
