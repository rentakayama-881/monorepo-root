"use client";

import { useMemo, useState } from "react";
import NativeSelect from "@/components/ui/NativeSelect";
import Avatar from "@/components/ui/Avatar";
import { formatIDR } from "@/lib/format";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

function parseMinIDR(value) {
  const n = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function statusColor(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  switch (s) {
    case "open":
      return "bg-success/15 text-success border-success/30";
    case "completed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "disputed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
}

function formatDate(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ValidationCaseIndexClient({ cases, fetchError = "" }) {
  const items = Array.isArray(cases) ? cases : [];

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [minBounty, setMinBounty] = useState("");

  const statusOptions = useMemo(() => {
    const set = new Set();
    for (const vc of items) {
      const s = norm(vc?.status);
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const qn = norm(q);
    const sn = norm(status);
    const tn = norm(tag);
    const min = parseMinIDR(minBounty);

    return items.filter((vc) => {
      if (sn && norm(vc?.status) !== sn) return false;

      if (min > 0) {
        const bounty = Number(vc?.bounty_amount || 0);
        if (!Number.isFinite(bounty) || bounty < min) return false;
      }

      if (tn) {
        const tags = Array.isArray(vc?.tags) ? vc.tags : [];
        const matchesTag = tags.some(
          (t) => norm(t?.slug).includes(tn) || norm(t?.name).includes(tn)
        );
        if (!matchesTag) return false;
      }

      if (!qn) return true;

      const owner = vc?.owner || vc?.user || {};
      const hay = [String(vc?.id ?? ""), vc?.title, vc?.summary, owner?.username, owner?.full_name]
        .map((x) => norm(x))
        .filter(Boolean)
        .join(" ");

      if (hay.includes(qn)) return true;

      const tags = Array.isArray(vc?.tags) ? vc.tags : [];
      return tags.some((t) => norm(t?.slug).includes(qn) || norm(t?.name).includes(qn));
    });
  }, [items, q, status, tag, minBounty]);

  const fieldLabel = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

  return (
    <div className="space-y-4">
      {fetchError ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {fetchError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <div className={fieldLabel}>Cari</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
            placeholder="ID, judul, owner, atau tag"
            inputMode="search"
            aria-label="Cari case validasi"
          />
        </div>

        <div className="md:col-span-3">
          <div className={fieldLabel}>Status</div>
          <NativeSelect
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 h-10"
            aria-label="Filter by status"
          >
            <option value="">Semua</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="md:col-span-3">
          <div className={fieldLabel}>Min Bounty</div>
          <input
            value={minBounty}
            onChange={(e) => setMinBounty(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
            placeholder="100000"
            inputMode="numeric"
            aria-label="Filter by minimum bounty"
          />
        </div>

        <div className="md:col-span-9">
          <div className={fieldLabel}>Tag</div>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
            placeholder="domain-*, artifact-*, stage-*, evidence-*"
            aria-label="Filter by tag"
          />
        </div>

        <div className="md:col-span-3 flex items-end">
          <button
            type="button"
            onClick={() => {
              setQ("");
              setStatus("");
              setTag("");
              setMinBounty("");
            }}
            className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60"
          >
            Reset
          </button>
        </div>
      </section>

      <div className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
        <span className="font-semibold text-foreground">{items.length}</span> cases.
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((vc) => {
            const owner = vc?.owner || vc?.user || {};
            return (
              <a
                key={String(vc.id)}
                href={`/validation-cases/${encodeURIComponent(String(vc.id))}`}
                className="group block rounded-[var(--radius)] border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {vc.title}
                  </span>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor(vc.status)}`}
                  >
                    {String(vc.status || "unknown")}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">
                    {formatIDR(vc.bounty_amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(vc.created_at)}</span>
                </div>

                {Array.isArray(vc.tags) && vc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vc.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.slug || tag.name}
                        className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {tag.name || tag.slug}
                      </span>
                    ))}
                    {vc.tags.length > 3 && (
                      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        +{vc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {owner.username && (
                  <div className="mt-3 flex items-center gap-2 border-t pt-2">
                    <Avatar
                      src={owner.avatar_url}
                      name={owner.username || owner.full_name}
                      size="xs"
                    />
                    <span className="text-xs text-muted-foreground truncate">
                      @{owner.username}
                    </span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada case yang cocok dengan filter.</p>
        </div>
      )}
    </div>
  );
}
