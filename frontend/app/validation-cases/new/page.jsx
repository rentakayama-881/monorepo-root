import Link from "next/link";
import { fetchCategories } from "@/lib/categories";
import { LOCKED_CATEGORIES } from "@/lib/constants";

export const metadata = {
  title: "Create Validation Case",
  description: "Pilih tipe kasus lalu susun Validation Case Record dengan bounty dan kriteria yang dapat diaudit.",
};

export default async function NewValidationCasePage() {
  const categories = await fetchCategories({ next: { revalidate: 300 } });

  return (
    <main className="container py-10">
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Intake
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Create Validation Case</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Select a case type. Anda akan menyusun Case Record, menetapkan bounty, dan memulai alur escrow-backed validation.
        </p>
      </header>

      <section className="rounded-[var(--radius)] border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
          Available Case Types
        </div>

        {Array.isArray(categories) && categories.length > 0 ? (
          <ul className="divide-y divide-border">
            {categories.map((cat) => {
              const locked = LOCKED_CATEGORIES.includes(cat.slug);
              return (
                <li key={cat.slug} className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{cat.name || cat.slug}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Slug: {cat.slug}</div>
                    </div>
                    {locked ? (
                      <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Intake closed
                      </span>
                    ) : (
                      <Link
                        href={`/category/${encodeURIComponent(cat.slug)}/new`}
                        className="inline-flex items-center rounded-[var(--radius)] border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60"
                      >
                        Proceed
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada kategori tersedia.</div>
        )}
      </section>
    </main>
  );
}

