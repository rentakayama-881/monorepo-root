const AREAS = [
  {
    title: "C# / .NET",
    description: "Review kode, arsitektur, bug async, performa, dan best practice.",
  },
  {
    title: "JavaScript / Next.js",
    description: "Validasi UI, state management, SEO, dan performa aplikasi web.",
  },
  {
    title: "Python / Data",
    description: "Analisis data, notebook, evaluasi model, dan pipeline yang rapi.",
  },
  {
    title: "UI/UX",
    description: "Audit flow, hierarchy, aksesibilitas, dan konsistensi design system.",
  },
  {
    title: "Dokumentasi",
    description: "Perbaiki struktur, kejelasan, SOP, dan copywriting yang mudah dipahami.",
  },
  {
    title: "Keamanan",
    description: "Threat modeling, security review, dan hardening rekomendasi mitigasi.",
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
          <div
            key={area.title}
            className="rainbow-left-accent rounded-[var(--radius)] bg-card pl-5 pr-4 py-4 transition-shadow hover:shadow-sm"
          >
            <div className="font-semibold text-foreground">{area.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{area.description}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Tip: Semakin jelas kriteria dan konteksnya, semakin cepat validator bisa membantu.
      </p>
    </section>
  );
}
