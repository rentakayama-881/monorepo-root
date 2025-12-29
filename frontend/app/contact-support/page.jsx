export const dynamic = "force-static";

export const metadata = { 
  title: "Contact Support",
  description: "Hubungi tim support Alephdraad untuk bantuan akun, transaksi, dan aktivitas komunitas"
};

export default function ContactSupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">
          Contact Support
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Kami siap membantu Anda
        </p>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
          <p className="text-sm leading-relaxed text-[rgb(var(--fg))]">
            Butuh bantuan? Tim support Alephdraad siap membantu Anda menyelesaikan kendala seputar akun, transaksi, maupun aktivitas komunitas.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Email Card */}
          <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))]">
              <svg className="h-4 w-4 text-[rgb(var(--brand))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Email</h3>
            <a 
              href="mailto:support@alephisme.cc" 
              className="text-sm font-medium text-[rgb(var(--brand))] hover:underline"
            >
              support@alephisme.cc
            </a>
          </div>

          {/* Telegram Card */}
          <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))]">
              <svg className="h-4 w-4 text-[rgb(var(--brand))]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
            </div>
            <h3 className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Telegram</h3>
            <a 
              href="https://t.me/alephisme_support" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-[rgb(var(--brand))] hover:underline"
            >
              @alephisme_support
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
          <div className="flex items-start gap-3">
            <svg className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-[rgb(var(--fg))]">Jam Operasional</h3>
              <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">Senin - Jumat, 18.00 - 24.00 WIB</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[rgb(var(--brand))] border-opacity-20 bg-[rgb(var(--brand))] bg-opacity-5 p-4">
          <p className="text-sm text-[rgb(var(--fg))]">
            <strong>Tips:</strong> Kirimkan detail permasalahan Anda secara lengkap agar kami dapat memberikan solusi yang tepat dan cepat.
          </p>
        </div>
      </div>
    </main>
  );
}
