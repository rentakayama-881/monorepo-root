import { Card } from "../ui/Card";

const AREAS = [
  {
    title: "C# / .NET",
    description: "Review kode, arsitektur, bug async, performa, dan best practice.",
    icon: <span className="font-mono text-sm font-bold">C#</span>,
  },
  {
    title: "JavaScript / Next.js",
    description: "Validasi UI, state management, SEO, dan performa aplikasi web.",
    icon: <span className="font-mono text-sm font-bold">JS</span>,
  },
  {
    title: "Python / Data",
    description: "Analisis data, notebook, evaluasi model, dan pipeline yang rapi.",
    icon: <span className="font-mono text-sm font-bold">PY</span>,
  },
  {
    title: "UI/UX",
    description: "Audit flow, hierarchy, aksesibilitas, dan konsistensi design system.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    title: "Dokumentasi",
    description: "Perbaiki struktur, kejelasan, SOP, dan copywriting yang mudah dipahami.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h8" />
      </svg>
    ),
  },
  {
    title: "Keamanan",
    description: "Threat modeling, security review, dan hardening rekomendasi mitigasi.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
];

export default function FocusAreas() {
  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Bidang yang bisa divalidasi
        </h2>
        <p className="text-sm text-muted-foreground">
          Tidak hanya coding—pilih bidang yang paling sesuai dengan kebutuhan Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((area) => (
          <Card key={area.title} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {area.icon}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{area.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{area.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Tip: Semakin jelas kriteria dan konteksnya, semakin cepat validator bisa membantu.
      </p>
    </section>
  );
}

