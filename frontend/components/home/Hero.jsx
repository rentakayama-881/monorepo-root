import Button from "../ui/Button";

const STEPS = [
  {
    num: "01",
    title: "Buat Case & Bounty",
    desc: "Owner susun case, tetapkan bounty. Saldo otomatis terpotong sebagai jaminan.",
  },
  {
    num: "02",
    title: "Validator Mengerjakan",
    desc: "Validator ajukan request, disetujui owner, lalu kerjakan. Maks 3 validator per case.",
  },
  {
    num: "03",
    title: "Confidence & Payout",
    desc: "Validator terbaik berdasarkan confidence mendapat bounty. Imbang? Dibagi rata.",
  },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      {/* Mesh gradient background */}
      <div className="hero-mesh-bg absolute inset-0 pointer-events-none" />

      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="container relative z-10 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          {/* Badge */}
          <div className="flex justify-center animate-slide-up">
            <span className="rainbow-border inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground">
              Platform Validasi AI oleh Ahli Manusia
            </span>
          </div>

          {/* Heading */}
          <h1
            className="mt-8 text-center text-balance animate-slide-up text-4xl font-bold tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: "0.08s" }}
          >
            Validation Case untuk
            <br className="hidden sm:block" /> hasil kerja berbasis AI,
            <br />
            <span className="rainbow-text">dapat dipertanggungjawabkan</span>.
          </h1>

          {/* Rainbow divider */}
          <div
            className="mx-auto mt-6 rainbow-line-h w-24 rounded-full animate-slide-up"
            style={{ animationDelay: "0.14s" }}
          />

          {/* Description */}
          <p
            className="mx-auto mt-6 max-w-2xl text-center text-base text-muted-foreground sm:text-lg animate-slide-up"
            style={{ animationDelay: "0.18s" }}
          >
            Owner buat case dan tetapkan bounty — otomatis potong saldo. Validator ajukan request,
            disetujui, lalu kerjakan. Tiga validator mengerjakan, confidence tertinggi dapat bounty.
          </p>

          {/* CTA */}
          <div
            className="mt-10 flex justify-center animate-slide-up"
            style={{ animationDelay: "0.22s" }}
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

          {/* Flow Steps — numbered circles connected by rainbow line */}
          <div
            className="mt-16 animate-slide-up"
            style={{ animationDelay: "0.3s", animationDuration: "0.8s" }}
          >
            <div className="relative">
              {/* Connecting line (desktop only) */}
              <div className="absolute top-6 left-[16.67%] right-[16.67%] rainbow-line-h hidden md:block" />

              <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
                {STEPS.map((step) => (
                  <div key={step.num} className="relative text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full rainbow-border bg-card font-mono text-sm font-bold text-foreground rainbow-glow">
                      {step.num}
                    </div>
                    <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
