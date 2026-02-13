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

export default function ValidationCaseTable({ cases, baseHref = "/validation-cases", showCategory = true }) {
  const items = Array.isArray(cases) ? cases : [];

  return (
    <div className="space-y-3">
      <div className="space-y-3 sm:hidden">
        {items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-9 text-center text-sm text-muted-foreground">
            Tidak ada Validation Case pada indeks ini.
          </div>
        ) : (
          items.map((vc) => {
            const id = vc?.id;
            const href = `${baseHref}/${encodeURIComponent(String(id ?? ""))}`;
            const owner = vc?.owner || vc?.user || {};
            const ownerName = owner?.username ? `@${owner.username}` : "-";
            const ownerBadge = owner?.primary_badge || owner?.primaryBadge || null;
            const ownerProfileHref = owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "";
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

                {vc?.summary ? <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{vc.summary}</div> : null}
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
                  {showCategory ? (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="mt-0.5 text-foreground">{vc?.category?.name || vc?.category?.slug || "-"}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-3 flex items-center gap-2 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-secondary/20 px-2.5 py-2">
                  <Avatar src={owner?.avatar_url || owner?.avatarUrl} name={owner?.username || ""} size="xs" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {ownerProfileHref ? (
                        <Link href={ownerProfileHref} prefetch={false} className="truncate text-xs font-semibold text-foreground hover:underline">
                          {ownerName}
                        </Link>
                      ) : (
                        <span className="truncate text-xs font-semibold text-foreground">{ownerName}</span>
                      )}
                      {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
                    </div>
                    {Number(owner?.guarantee_amount || owner?.guaranteeAmount || 0) > 0 ? (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Stake: {formatIDR(owner?.guarantee_amount || owner?.guaranteeAmount)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden sm:block overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-secondary/60 text-muted-foreground [&_th]:whitespace-nowrap">
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
                  const ownerProfileHref = owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "";

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
                      {showCategory && (
                        <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                          {vc?.category?.name || vc?.category?.slug || "-"}
                        </td>
                      )}
                      <td className="px-4 py-3 align-top font-semibold text-foreground whitespace-nowrap">
                        {formatIDR(vc?.bounty_amount)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <Avatar src={owner?.avatar_url || owner?.avatarUrl} name={owner?.username || ""} size="xs" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {ownerProfileHref ? (
                                <Link href={ownerProfileHref} prefetch={false} className="truncate font-semibold text-foreground hover:underline">
                                  {ownerName}
                                </Link>
                              ) : (
                                <span className="truncate font-semibold text-foreground">{ownerName}</span>
                              )}
                              {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
                            </div>
                            {Number(owner?.guarantee_amount || owner?.guaranteeAmount || 0) > 0 ? (
                              <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                                Stake: {formatIDR(owner?.guarantee_amount || owner?.guaranteeAmount)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(vc?.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
