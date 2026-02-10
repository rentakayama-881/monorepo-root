import Link from "next/link";
import ValidationCaseTable from "@/components/ui/ValidationCaseTable";
import { fetchJson } from "@/lib/api";

export const metadata = {
  title: "Validation Case Index",
  description: "Indeks resmi Validation Case (dossier): status, bounty, dan pihak terkait.",
};

async function fetchLatestValidationCases() {
  const params = new URLSearchParams();
  params.set("limit", "50");

  try {
    const data = await fetchJson(`/api/validation-cases/latest?${params.toString()}`, {
      method: "GET",
      next: { revalidate: 30 },
    });
    return Array.isArray(data?.validation_cases) ? data.validation_cases : [];
  } catch {
    return [];
  }
}

export default async function ValidationCaseIndexPage() {
  const cases = await fetchLatestValidationCases();

  return (
    <main className="container py-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Registry
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Validation Case Index</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Dossier-style listing. Tidak ada komentar, reaksi, atau voting. Setiap perubahan tercatat sebagai audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/validation-cases/new"
              className="inline-flex items-center rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Create Validation Case
            </Link>
          </div>
        </div>
      </header>

      <ValidationCaseTable cases={cases} showCategory={false} />
    </main>
  );
}
