import Button from "../ui/Button";
import { Card } from "../ui/Card";

const STEPS = [
  {
    title: "File Validation Case",
    description:
      "Susun Case Record yang formal: konteks, klaim, input/output AI, constraints, dan acceptance criteria. Tetapkan bounty.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Request Consultation",
    description:
      "Validator mengajukan Request Consultation (stake-gated). Setelah disetujui, kontak dibuka privat dan dicatat pada Case Log.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    title: "Final Offer + Escrow",
    description:
      "Validator mengajukan Final Offer. Pemilik kasus menerima lalu Lock Funds ke escrow. Validator submit Artifact Submission. Approve menghasilkan Certified Artifact; Dispute diselesaikan admin.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          <Card key={step.title} className="p-4">
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

      <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-foreground">Mulai intake</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat Validation Case dengan bounty dan acceptance criteria. Klasifikasi menggunakan Tags (audit meaningful).
          </p>
        </div>
        <Button href="/validation-cases/new" variant="gradient">
          Mulai Sekarang
        </Button>
      </div>
    </section>
  );
}
