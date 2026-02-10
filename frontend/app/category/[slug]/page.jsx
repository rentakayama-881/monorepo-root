import Link from "next/link";
import ValidationCaseTable from "@/components/ui/ValidationCaseTable";
import { fetchJson } from "@/lib/api";
import { LOCKED_CATEGORIES } from "@/lib/constants";

export async function generateMetadata({ params }) {
  const slug = params?.slug ? String(params.slug) : "";
  return {
    title: `Validation Case Index - ${slug}`,
  };
}

async function fetchByCategory(slug) {
  try {
    const data = await fetchJson(`/api/validation-cases/category/${encodeURIComponent(slug)}`, {
      method: "GET",
      next: { revalidate: 30 },
    });
    const category = data?.category || null;
    const cases = Array.isArray(data?.validation_cases) ? data.validation_cases : [];
    return { category, cases };
  } catch {
    return { category: null, cases: [] };
  }
}

export default async function CategoryValidationCasesPage({ params }) {
  const slug = params?.slug ? String(params.slug) : "";
  const locked = LOCKED_CATEGORIES.includes(slug);
  const { category, cases } = await fetchByCategory(slug);

  return (
    <main className="container py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/validation-cases" className="hover:underline">
          Validation Case Index
        </Link>
        <span>/</span>
        <span className="text-foreground">{category?.name || slug}</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Type Index
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {category?.name || slug}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Dossier-style listing untuk tipe ini. Tidak ada komentar, reaksi, atau voting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {locked ? (
            <span className="inline-flex items-center rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-2 text-sm font-semibold text-muted-foreground">
              Intake closed
            </span>
          ) : (
            <Link
              href={`/category/${encodeURIComponent(slug)}/new`}
              className="inline-flex items-center rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Create Validation Case
            </Link>
          )}
        </div>
      </header>

      <ValidationCaseTable cases={cases} showCategory={false} />
    </main>
  );
}

