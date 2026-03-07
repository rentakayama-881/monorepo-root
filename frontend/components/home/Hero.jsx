import Button from "../ui/Button";
import { Card } from "../ui/Card";

export default function Hero() {
  return (
    <section className="relative border-b overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/40 pointer-events-none" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="container relative z-20 py-12 md:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            Platform Validasi AI oleh Ahli Manusia
          </div>

          <h1 className="mt-5 text-balance animate-slide-up text-3xl font-bold tracking-tighter text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            Validation Case untuk hasil kerja berbasis AI,
            <span className="text-primary"> dapat dipertanggungjawabkan</span>.
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl animate-slide-up text-base text-muted-foreground sm:text-lg"
            style={{ animationDelay: "0.1s" }}
          >
            Owner buat case dan tetapkan bounty — otomatis potong saldo. Validator ajukan request,
            disetujui, lalu kerjakan. Tiga validator mengerjakan, confidence tertinggi dapat bounty.
          </p>

          {/* CTA Buttons */}
          <div
            className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Button
              href="/validation-cases"
              prefetch={false}
              size="lg"
              variant="gradient"
              iconRight={
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              }
            >
              Lihat Daftar Case
            </Button>
          </div>

          {/* Highlight cards */}
          <div
            className="mt-10 grid grid-cols-1 gap-3 text-left sm:grid-cols-3 animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Card className="p-4 gradient-border">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">Buat Case & Bounty</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Owner susun case, tetapkan bounty. Saldo otomatis terpotong sebagai jaminan.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 gradient-border">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">Validator Mengerjakan</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Validator ajukan request, disetujui owner, lalu kerjakan case. Maks 3 validator
                    per case.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 gradient-border">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">Confidence & Payout</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Validator terbaik berdasarkan confidence mendapat bounty. Imbang? Dibagi rata.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
