import Link from "next/link";
import SearchInput from "@/components/ui/SearchInput";

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
      <div className="text-center max-w-2xl">
        {/* Creative 404 illustration */}
        <div className="mb-8 animate-slide-up">
          <div className="relative inline-block">
            {/* Animated 404 text */}
            <div className="text-[120px] sm:text-[180px] font-bold bg-gradient-to-br from-primary to-primary/40 bg-clip-text text-transparent leading-none">
              404
            </div>
            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-primary/20 animate-ping" />
            <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-primary/30 animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Halaman Tidak Ditemukan
        </h1>

        <p className="text-lg text-muted-foreground mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Ups! Sepertinya halaman yang Anda cari telah berpindah ke dimensi lain atau mungkin tidak pernah ada. 🚀
        </p>

        {/* Search suggestion */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="max-w-md mx-auto">
            <SearchInput placeholder="Coba cari halaman yang Anda butuhkan..." />
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Kembali ke Beranda
          </Link>
          <Link
            href="/contact-support"
            className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-primary"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Hubungi Kami
          </Link>
        </div>

        {/* Popular links */}
        <div className="pt-8 border-t border-border animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <p className="text-sm font-semibold text-muted-foreground mb-4">Mungkin Anda mencari:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Link href="/threads" className="group rounded-lg border border-border p-3 transition-all hover:border-primary hover:bg-primary/5">
              <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span>Threads</span>
              </div>
            </Link>
            <Link href="/ai-search" className="group rounded-lg border border-border p-3 transition-all hover:border-primary hover:bg-primary/5">
              <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span>AI Search</span>
              </div>
            </Link>
            <Link href="/about-content" className="group rounded-lg border border-border p-3 transition-all hover:border-primary hover:bg-primary/5">
              <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tentang</span>
              </div>
            </Link>
            <Link href="/rules-content" className="group rounded-lg border border-border p-3 transition-all hover:border-primary hover:bg-primary/5">
              <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Aturan</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
