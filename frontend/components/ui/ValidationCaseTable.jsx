"use client";

import Link from "next/link";
import Avatar from "./Avatar";
import Badge from "./Badge";
import { TagList } from "./TagPill";

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
    offer_accepted: "Offer Accepted",
    funds_locked: "Funds Locked",
    artifact_submitted: "Artifact Submitted",
    completed: "Completed",
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

export default function ValidationCaseTable({ cases, baseHref = "/validation-cases", showCategory = true }) {
  const items = Array.isArray(cases) ? cases : [];

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
      <table className="min-w-[860px] w-full text-sm">
        <thead className="bg-secondary/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Case</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Title</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Status</th>
            {showCategory && (
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Type</th>
            )}
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Bounty</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Owner</th>
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Filed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={showCategory ? 7 : 6} className="px-4 py-10 text-center text-muted-foreground">
                Tidak ada Validation Case pada indeks ini.
              </td>
            </tr>
          ) : (
            items.map((vc) => {
              const id = vc?.id;
              const href = `${baseHref}/${encodeURIComponent(String(id ?? ""))}`;
              const owner = vc?.owner || vc?.user || {};
              const ownerName = owner?.username ? `@${owner.username}` : "-";
              const ownerBadge = owner?.primary_badge || owner?.primaryBadge || null;

              return (
                <tr key={String(id)} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
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
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyle(vc?.status)}`}>
                      {statusLabel(vc?.status)}
                    </span>
                  </td>
                  {showCategory && (
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {vc?.category?.name || vc?.category?.slug || "-"}
                    </td>
                  )}
                  <td className="px-4 py-3 align-top font-semibold text-foreground">{formatIDR(vc?.bounty_amount)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <Avatar src={owner?.avatar_url || owner?.avatarUrl} name={owner?.username || ""} size="xs" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "#"}
                            prefetch={false}
                            className="truncate font-semibold text-foreground hover:underline"
                          >
                            {ownerName}
                          </Link>
                          {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
                        </div>
                        {Number(owner?.guarantee_amount || owner?.guaranteeAmount || 0) > 0 ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Stake: {formatIDR(owner?.guarantee_amount || owner?.guaranteeAmount)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">{formatDate(vc?.created_at)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
