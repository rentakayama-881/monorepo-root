import Button from "../ui/Button";
import { Card } from "../ui/Card";

const STEPS = [
  {
    title: "Tulis konteks & kriteria",
    description:
      "Cantumkan tujuan, constraint, output AI, dan apa yang dianggap “benar/selesai”.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Terima review dari ahli",
    description:
      "Validator memberi feedback yang terstruktur: temuan, risiko, dan rekomendasi perbaikan.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h6" />
      </svg>
    ),
  },
  {
    title: "Iterasi sampai rapi",
    description:
      "Revisi cepat berdasarkan catatan, lalu kunci hasil final yang paling aman dan jelas.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h.01M3 12h.01M3 17h.01" />
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
          <div className="font-semibold text-foreground">Mulai dari kategori yang tepat</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih bidangnya dulu, lalu buat thread dengan kebutuhan validasi Anda.
          </p>
        </div>
        <Button href="#categories" variant="gradient">
          Mulai Sekarang
        </Button>
      </div>
    </section>
  );
}

