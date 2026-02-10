"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { TagList } from "@/components/ui/TagPill";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";

function formatDate(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatIDR(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "-";
  return `Rp ${Math.max(0, Math.trunc(n)).toLocaleString("id-ID")}`;
}

export default function MyValidationCasesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await fetchJsonAuth("/api/validation-cases/me", { method: "GET" });
      setItems(Array.isArray(data?.validation_cases) ? data.validation_cases : []);
    } catch (e) {
      setError(e?.message || "Gagal memuat My Validation Cases");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteCase(id) {
    if (!id) return;
    const ok = window.confirm("PERINGATAN: Validation Case akan dihapus permanen. Lanjutkan?");
    if (!ok) return;

    setDeletingId(String(id));
    setError("");
    try {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e?.message || "Gagal menghapus Validation Case");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Personal Docket
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">My Validation Cases</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Daftar resmi kasus milik Anda. Setiap aktivitas protokol tercatat pada Case Log.
          </p>
        </div>
      </header>

      {error ? (
        <div className="mb-5 rounded-[var(--radius)] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          Memuat...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          Belum ada Validation Case.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Case</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Title</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Status</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Bounty</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Filed</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((vc) => {
                const id = vc?.id;
                const href = `/validation-cases/${encodeURIComponent(String(id))}`;
                const owner = vc?.owner || {};
                const badge = owner?.primary_badge || null;
                return (
                  <tr key={String(id)} className="hover:bg-secondary/40">
                    <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                      <Link href={href} className="hover:underline">
                        #{String(id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="min-w-0">
                        <Link href={href} className="block font-semibold text-foreground hover:underline">
                          {vc?.title || "(untitled)"}
                        </Link>
                        {vc?.summary ? (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{vc.summary}</div>
                        ) : null}
                        {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                          <div className="mt-2">
                            <TagList tags={vc.tags} size="xs" />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">{String(vc?.status || "")}</td>
                    <td className="px-4 py-3 align-top font-semibold text-foreground">{formatIDR(vc?.bounty_amount)}</td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">{formatDate(vc?.created_at)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={href}
                          className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                        >
                          Open Record
                        </Link>
                        <button
                          className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-60"
                          disabled={String(deletingId) === String(id)}
                          onClick={() => deleteCase(id)}
                          type="button"
                        >
                          {String(deletingId) === String(id) ? "Deleting..." : "Delete"}
                        </button>
                      </div>

                      {/* Keep owner snapshot in-row for quick audit context */}
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="xs" />
                        <span className="font-semibold text-foreground">@{owner?.username || "-"}</span>
                        {badge ? <Badge badge={badge} size="xs" /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
