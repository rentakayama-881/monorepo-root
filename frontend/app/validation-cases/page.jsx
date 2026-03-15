import { Suspense } from "react";
import { fetchJson } from "@/lib/api";
import logger from "@/lib/logger";
import ValidationCaseIndexClient from "./ValidationCaseIndexClient";
import { ValidationCaseIndexContentSkeleton } from "./ValidationCaseIndexSkeleton";

export const revalidate = 30;

export const metadata = {
  title: "Daftar Case Validasi",
  description: "Lihat semua case validasi di AIValid. Filter berdasarkan status, bounty, dan tag.",
  alternates: {
    canonical: "https://aivalid.id/validation-cases",
  },
};

function CaseListSkeleton() {
  return <ValidationCaseIndexContentSkeleton fullHeight />;
}

async function CaseList() {
  const params = new URLSearchParams();
  params.set("limit", "200");

  let cases = [];
  let fetchError = "";

  try {
    const data = await fetchLatestCases(params);
    cases = Array.isArray(data?.validation_cases) ? data.validation_cases : [];
  } catch (err) {
    fetchError = "Data sementara belum tersedia. Silakan muat ulang beberapa saat lagi.";
    const reason = err instanceof Error ? err.message : String(err);
    logger.error("[validation-cases] Failed to fetch latest cases during render:", reason);
  }

  return <ValidationCaseIndexClient cases={cases} fetchError={fetchError} />;
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
            <h1 className="text-2xl font-semibold text-foreground">Daftar Case Validasi</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Lihat semua case validasi yang tersedia. Filter berdasarkan status, bounty, atau tag.
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
