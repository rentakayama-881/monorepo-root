import { Suspense } from "react";
import { fetchJson } from "@/lib/api";
import ValidationCaseIndexClient from "./ValidationCaseIndexClient";

export const revalidate = 30;

export const metadata = {
  title: "Daftar Kasus Validasi AI Terbaru",
  description:
    "Lihat daftar kasus validasi AI terbaru di AIValid. Pantau status, hasil review, dan temuan validator untuk berbagai jenis output AI.",
  alternates: {
    canonical: "https://aivalid.id/validation-cases",
  },
};

function CaseListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-4 w-16 rounded-full bg-muted" />
          </div>
          <div className="mt-2 h-3 w-72 rounded bg-muted" />
          <div className="mt-2 flex gap-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function CaseList() {
  const params = new URLSearchParams();
  params.set("limit", "50");

  const data = await fetchLatestCases(params);
  const cases = Array.isArray(data?.validation_cases) ? data.validation_cases : [];

  return <ValidationCaseIndexClient cases={cases} />;
}

async function fetchLatestCases(params) {
  const maxAttempts = 3;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchJson(`/api/validation-cases/latest?${params.toString()}`, {
        method: "GET",
        next: { revalidate: 30 },
        timeout: 12000,
      });
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      await waitBeforeRetry(attempt * 300);
    }
  }

  throw lastErr || new Error("Gagal memuat daftar kasus validasi.");
}

function waitBeforeRetry(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ValidationCaseIndexPage() {
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
        </div>
      </header>

      <Suspense fallback={<CaseListSkeleton />}>
        <CaseList />
      </Suspense>
    </main>
  );
}
