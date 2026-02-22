"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { TagList } from "@/components/ui/TagPill";
import Skeleton from "@/components/ui/Skeleton";
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

function statusLabel(statusRaw) {
  const s = String(statusRaw || "").toLowerCase().trim();
  if (!s) return "Unknown";
  const map = {
    open: "Open",
    waiting_owner_response: "Waiting Owner Response",
    on_hold_owner_inactive: "On Hold (Owner Inactive)",
    offer_accepted: "Offer Accepted",
    funds_locked: "Funds Locked",
    artifact_submitted: "Under Owner Review",
    completed: "Concluded",
    disputed: "Disputed",
  };
  return map[s] || s.replace(/_/g, " ");
}

function statusStyle(statusRaw) {
  const s = String(statusRaw || "").toLowerCase().trim();
  switch (s) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "disputed":
      return "border-red-200 bg-red-50 text-red-900";
    case "on_hold_owner_inactive":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "waiting_owner_response":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "funds_locked":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "artifact_submitted":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "offer_accepted":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "open":
    default:
      return "border-border bg-card text-foreground";
  }
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${statusStyle(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function formatDeleteCaseError(err, fallback = "Gagal menghapus Validation Case") {
  const message = String(err?.message || fallback).trim();
  const details = String(err?.details || "").trim();
  if (!details) return message || fallback;
  const generic = new Set(["input tidak valid", "kesalahan database", "terjadi kesalahan internal"]);
  if (generic.has(message.toLowerCase())) {
    return details;
  }
  return `${message}: ${details}`;
}

function isCaseDeletable(statusRaw) {
  return String(statusRaw || "").trim().toLowerCase() === "open";
}

function deleteStatusHint(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  if (!s || s === "open") return "";
  if (s === "funds_locked") return "Case terkunci karena escrow aktif.";
  if (s === "artifact_submitted") return "Case sedang review owner.";
  if (s === "completed") return "Case sudah selesai.";
  if (s === "disputed") return "Case sedang dalam dispute.";
  return `Case status "${s}" tidak dapat dihapus.`;
}

function sensitivityText(levelRaw) {
  const level = String(levelRaw || "S1").toUpperCase().trim() || "S1";
  const labels = {
    S0: "Public",
    S1: "Restricted",
    S2: "Confidential",
    S3: "Critical",
  };
  if (labels[level]) return `${level} ${labels[level]}`;
  return level;
}

function MyValidationCasesLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="space-y-3 sm:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`mobile-${i}`} className="rounded-[var(--radius)] border border-border bg-card p-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <div className="p-4">
          <div className="grid grid-cols-7 gap-3 border-b border-border pb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`head-${i}`} className="h-3.5 w-16" />
            ))}
          </div>
          <div className="space-y-3 pt-3">
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={`row-${row}`} className="grid grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((__, col) => (
                  <Skeleton key={`cell-${row}-${col}`} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
      setError(formatDeleteCaseError(e));
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
        <MyValidationCasesLoading />
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          Belum ada Validation Case.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3 sm:hidden">
            {items.map((vc) => {
              const id = vc?.id;
              const href = `/validation-cases/${encodeURIComponent(String(id))}`;
              const owner = vc?.owner || {};
              const badge = owner?.primary_badge || null;
              const canDelete = isCaseDeletable(vc?.status);
              const deleteHint = deleteStatusHint(vc?.status);
              const ownerHref = owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "";
              return (
                <article key={String(id)} className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground">Case #{String(id)}</div>
                      <Link
                        href={href}
                        prefetch={false}
                        className="mt-1 block text-sm font-semibold leading-5 text-foreground hover:underline"
                      >
                        {vc?.title || "(untitled)"}
                      </Link>
                    </div>
                    <StatusPill status={vc?.status} />
                  </div>

                  {vc?.summary ? <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{vc.summary}</div> : null}
                  {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                    <div className="mt-2">
                      <TagList tags={vc.tags} size="xs" />
                    </div>
                  ) : null}

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Bounty</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{formatIDR(vc?.bounty_amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Filed</dt>
                      <dd className="mt-0.5 font-mono text-muted-foreground">{formatDate(vc?.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Sensitivity</dt>
                      <dd className="mt-0.5 font-mono text-foreground">{sensitivityText(vc?.sensitivity_level)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center gap-2 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-secondary/20 px-2.5 py-2">
                    <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="xs" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {ownerHref ? (
                          <Link href={ownerHref} prefetch={false} className="truncate text-xs font-semibold text-foreground hover:underline">
                            @{owner?.username || "-"}
                          </Link>
                        ) : (
                          <span className="truncate text-xs font-semibold text-foreground">@{owner?.username || "-"}</span>
                        )}
                        {badge ? <Badge badge={badge} size="xs" /> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={href}
                      prefetch={false}
                      className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                    >
                      Open Record
                    </Link>
                    <button
                      className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-60"
                      disabled={String(deletingId) === String(id) || !canDelete}
                      onClick={() => {
                        if (!canDelete) return;
                        deleteCase(id);
                      }}
                      type="button"
                      title={canDelete ? "Delete case" : deleteHint}
                    >
                      {String(deletingId) === String(id) ? "Deleting..." : canDelete ? "Delete" : "Locked"}
                    </button>
                  </div>
                  {!canDelete ? <div className="mt-1 text-[11px] text-muted-foreground">{deleteHint}</div> : null}
                </article>
              );
            })}
          </div>

          <div className="hidden sm:block overflow-hidden rounded-[var(--radius)] border border-border bg-card">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-secondary/60 text-muted-foreground [&_th]:whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Case</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Title</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Sensitivity</th>
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
                    const canDelete = isCaseDeletable(vc?.status);
                    const deleteHint = deleteStatusHint(vc?.status);
                    return (
                      <tr key={String(id)} className="hover:bg-secondary/40">
                        <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                          <Link href={href} prefetch={false} className="hover:underline">
                            #{String(id)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="min-w-0">
                            <Link href={href} prefetch={false} className="block font-semibold text-foreground hover:underline">
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
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <StatusPill status={vc?.status} />
                        </td>
                        <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {sensitivityText(vc?.sensitivity_level)}
                        </td>
                        <td className="px-4 py-3 align-top font-semibold text-foreground whitespace-nowrap">
                          {formatIDR(vc?.bounty_amount)}
                        </td>
                        <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(vc?.created_at)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={href}
                              prefetch={false}
                              className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                            >
                              Open Record
                            </Link>
                            <button
                              className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-60"
                              disabled={String(deletingId) === String(id) || !canDelete}
                              onClick={() => {
                                if (!canDelete) return;
                                deleteCase(id);
                              }}
                              type="button"
                              title={canDelete ? "Delete case" : deleteHint}
                            >
                              {String(deletingId) === String(id) ? "Deleting..." : canDelete ? "Delete" : "Locked"}
                            </button>
                          </div>
                          {!canDelete ? <div className="mt-1 text-[11px] text-muted-foreground">{deleteHint}</div> : null}

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
          </div>
        </div>
      )}
    </main>
  );
}
