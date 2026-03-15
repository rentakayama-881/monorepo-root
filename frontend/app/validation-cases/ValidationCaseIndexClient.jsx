"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import NativeSelect from "@/components/ui/NativeSelect";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { TagList } from "@/components/ui/TagPill";
import EmptyState from "@/components/ui/EmptyState";
import { formatIDR } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { DATE_FORMATS } from "@/lib/constants";

const PAGE_SIZE = 24;

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

function parseMinIDR(value) {
  const n = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function statusLabel(statusRaw) {
  const s = String(statusRaw || "")
    .toLowerCase()
    .trim();
  if (!s) return "Unknown";
  const map = {
    open: "Open",
    waiting_owner_response: "Waiting Owner Response",
    on_hold_owner_inactive: "On Hold (Owner Inactive)",
    offer_accepted: "Offer Accepted",
    funds_locked: "Funds Locked",
    artifact_submitted: "Artifact Submitted",
    completed: "Completed",
    disputed: "Disputed",
  };
  return map[s] || s.replace(/_/g, " ");
}

function statusStyle(statusRaw) {
  const s = String(statusRaw || "")
    .toLowerCase()
    .trim();
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

function sensitivityText(levelRaw) {
  const level =
    String(levelRaw || "S1")
      .toUpperCase()
      .trim() || "S1";
  const labels = {
    S0: "Public",
    S1: "Restricted",
    S2: "Confidential",
    S3: "Critical",
  };
  if (labels[level]) return `${level} ${labels[level]}`;
  return level;
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${statusStyle(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export default function ValidationCaseIndexClient({ cases, fetchError = "" }) {
  const items = Array.isArray(cases) ? cases : [];

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [minBounty, setMinBounty] = useState("");
  const [loadMoreClicks, setLoadMoreClicks] = useState(0);

  const gridRef = useRef(null);

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

  // visibleCount derives from loadMoreClicks — resets automatically when filters change
  // because loadMoreClicks is reset in the "Reset" button handler
  const visibleCount = PAGE_SIZE * (loadMoreClicks + 1);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const handleLoadMore = useCallback(() => {
    setLoadMoreClicks((prev) => prev + 1);
  }, []);

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
              setLoadMoreClicks(0);
            }}
            className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60"
          >
            Reset
          </button>
        </div>
      </section>

      <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
        Menampilkan <span className="font-semibold text-foreground">{visible.length}</span> dari{" "}
        <span className="font-semibold text-foreground">{filtered.length}</span> case
        {filtered.length !== items.length ? <span> (total {items.length})</span> : null}
      </div>

      {filtered.length > 0 ? (
        <>
          <div ref={gridRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((vc) => {
              const owner = vc?.owner || vc?.user || {};
              const ownerBadge = owner?.primary_badge || owner?.primaryBadge || null;
              const ownerProfileHref = owner?.username
                ? `/user/${encodeURIComponent(owner.username)}`
                : "";
              return (
                <Link
                  key={String(vc.id)}
                  href={`/validation-cases/${encodeURIComponent(String(vc.id))}`}
                  prefetch={false}
                  className="group block rounded-none border border-border/60 bg-background p-4 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Case #{String(vc.id)}
                      </div>
                      <span className="mt-1 block text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {vc.title || "(untitled)"}
                      </span>
                    </div>
                    <StatusPill status={vc.status} />
                  </div>

                  {vc.summary ? (
                    <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {vc.summary}
                    </div>
                  ) : null}

                  {Array.isArray(vc.tags) && vc.tags.length > 0 ? (
                    <div className="mt-2">
                      <TagList tags={vc.tags} size="xs" />
                    </div>
                  ) : null}

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Bounty</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">
                        {formatIDR(vc.bounty_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Filed</dt>
                      <dd className="mt-0.5 font-mono text-muted-foreground">
                        {formatDate(vc.created_at, DATE_FORMATS.SHORT)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Sensitivity</dt>
                      <dd className="mt-0.5 font-mono text-foreground">
                        {sensitivityText(vc.sensitivity_level)}
                      </dd>
                    </div>
                  </dl>

                  {owner.username ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-2">
                      <Avatar
                        src={owner.avatar_url || owner.avatarUrl}
                        name={owner.username || owner.full_name}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/user/${owner.username}`}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            @{owner.username}
                          </Link>
                          {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
                        </div>
                        {Number(owner.guarantee_amount || owner.guaranteeAmount || 0) > 0 ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Stake: {formatIDR(owner.guarantee_amount || owner.guaranteeAmount)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`Muat ${PAGE_SIZE} case berikutnya`}
              >
                <ChevronDown className="size-4" aria-hidden="true" />
                Muat lebih banyak
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="Tidak ada case ditemukan"
          description="Coba ubah filter atau kata kunci pencarian Anda."
        />
      )}
    </div>
  );
}
