import { Card } from "../ui/Card";

const STEPS = [
  {
    title: "Buat Case",
    description:
      "Owner susun case, tetapkan bounty — saldo otomatis terpotong. Klasifikasi menggunakan tags untuk audit.",
    icon: (
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
    ),
  },
  {
    title: "Validator Mengerjakan",
    description:
      "Validator ajukan request, disetujui owner, lalu kerjakan. Maks 3 validator per case.",
    icon: (
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
    ),
  },
  {
    title: "Penilaian & Payout",
    description: "Owner finalisasi. Confidence tertinggi dapat bounty. Imbang = dibagi rata.",
    icon: (
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
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Cara kerja
        </h2>
        <p className="text-sm text-muted-foreground">
          Cocok untuk yang butuh validasi, dan untuk profesional yang ingin menawarkan keahliannya.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.title} className="p-4 gradient-border">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {step.icon}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{step.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 sm:flex-row sm:items-center sm:justify-between gradient-border">
        <div>
          <div className="font-semibold text-foreground">Mulai sekarang</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat Validation Case dengan bounty dan acceptance criteria. Validator akan mengajukan
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
