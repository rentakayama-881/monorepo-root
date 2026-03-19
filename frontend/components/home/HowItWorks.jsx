import { STEPS } from "./homeConstants";

export default function HowItWorks() {
  return (
    <section style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}>
      <div className="mb-8 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Cara kerja
        </h2>
        <p className="text-sm text-muted-foreground">
          Cocok untuk yang butuh validasi, dan untuk profesional yang ingin menawarkan keahliannya.
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Rainbow vertical line */}
        <div className="absolute left-4 md:left-5 top-1 bottom-1 rainbow-line-v" />

        <div className="space-y-8">
          {STEPS.map((step, i) => (
            <div key={step.fullTitle} className="flex items-start gap-4 md:gap-5">
              {/* Number circle */}
              <div
                className="relative z-10 flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full rainbow-border bg-card font-mono text-xs md:text-sm font-bold text-foreground"
                aria-label={`Langkah ${i + 1}: ${step.fullTitle}`}
              >
                {i + 1}
              </div>

              {/* Content */}
              <div className="pt-0.5 md:pt-1.5">
                <h3 className="font-semibold text-foreground">{step.fullTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA banner */}
      <div className="mt-8 flex flex-col gap-3 rounded-[var(--radius)] p-4 sm:flex-row sm:items-center sm:justify-between rainbow-border bg-card">
        <div>
          <div className="font-semibold text-foreground">Mulai sekarang</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat case validasi dengan bounty dan acceptance criteria. Validator akan mengajukan
            request.
          </p>
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          Gunakan tombol <span className="font-mono text-foreground">+</span> di header untuk
          membuat kasus.
        </div>
      </div>
    </section>
  );
}
