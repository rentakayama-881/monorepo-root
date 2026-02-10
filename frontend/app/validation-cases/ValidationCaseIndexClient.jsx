"use client";

import { useMemo, useState } from "react";
import ValidationCaseTable from "@/components/ui/ValidationCaseTable";

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function parseMinIDR(value) {
  const n = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function ValidationCaseIndexClient({ cases }) {
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
        const matchesTag = tags.some((t) => norm(t?.slug).includes(tn) || norm(t?.name).includes(tn));
        if (!matchesTag) return false;
      }

      if (!qn) return true;

      const owner = vc?.owner || vc?.user || {};
      const hay = [
        String(vc?.id ?? ""),
        vc?.title,
        vc?.summary,
        owner?.username,
        owner?.full_name,
      ]
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
      <section className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <div className={fieldLabel}>Search</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
            placeholder="Case id, title, owner, tag"
            inputMode="search"
            aria-label="Search validation cases"
          />
        </div>

        <div className="md:col-span-3">
          <div className={fieldLabel}>Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
            aria-label="Filter by status"
          >
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <div className={fieldLabel}>Min Bounty (IDR)</div>
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

      <ValidationCaseTable cases={filtered} showCategory={false} />
    </div>
  );
}

