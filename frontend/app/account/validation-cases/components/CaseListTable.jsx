import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { TagList } from "@/components/ui/TagPill";
import { formatIDR } from "@/lib/format";

function formatDate(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
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
      return "border-status-success-border bg-status-success-bg text-status-success-text";
    case "disputed":
      return "border-status-danger-border bg-status-danger-bg text-status-danger-text";
    case "on_hold_owner_inactive":
      return "border-status-orange-border bg-status-orange-bg text-status-orange-text";
    case "waiting_owner_response":
      return "border-status-info-border bg-status-info-bg text-status-info-text";
    case "funds_locked":
      return "border-status-amber-border bg-status-amber-bg text-status-amber-text";
    case "artifact_submitted":
      return "border-status-sky-border bg-status-sky-bg text-status-sky-text";
    case "offer_accepted":
      return "border-status-violet-border bg-status-violet-bg text-status-violet-text";
    case "open":
    default:
      return "border-border bg-card text-foreground";
  }
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${statusStyle(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function isCaseDeletable(statusRaw) {
  return (
    String(statusRaw || "")
      .trim()
      .toLowerCase() === "open"
  );
}

function deleteStatusHint(statusRaw) {
  const s = String(statusRaw || "")
    .trim()
    .toLowerCase();
  if (!s || s === "open") return "";
  if (s === "funds_locked") return "Case terkunci karena escrow aktif.";
  if (s === "artifact_submitted") return "Case sedang review owner.";
  if (s === "completed") return "Case sudah selesai.";
  if (s === "disputed") return "Case sedang dalam dispute.";
  return `Case status "${s}" tidak dapat dihapus.`;
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

function MobileCard({ vc, deletingId, onDeleteClick }) {
  const id = vc?.id;
  const href = `/validation-cases/${encodeURIComponent(String(id))}`;
  const owner = vc?.owner || {};
  const badge = owner?.primary_badge || null;
  const canDelete = isCaseDeletable(vc?.status);
  const deleteHint = deleteStatusHint(vc?.status);
  const ownerHref = owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "";

  return (
    <article
      className="rounded-none border border-border bg-background px-4 py-3"
      aria-label={`Case #${id}: ${vc?.title || "untitled"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-muted-foreground">Case #{String(id)}</div>
          <Link
            href={href}
            prefetch={false}
            className="mt-1 block text-sm font-semibold leading-5 text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            {vc?.title || "(untitled)"}
          </Link>
        </div>
        <StatusPill status={vc?.status} />
      </div>

      {vc?.summary ? (
        <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{vc.summary}</div>
      ) : null}
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
          <dd className="mt-0.5 font-mono text-foreground">
            {sensitivityText(vc?.sensitivity_level)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-secondary/20 px-2.5 py-2">
        <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="xs" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {ownerHref ? (
              <Link
                href={ownerHref}
                prefetch={false}
                className="truncate text-xs font-semibold text-foreground hover:underline"
              >
                @{owner?.username || "-"}
              </Link>
            ) : (
              <span className="truncate text-xs font-semibold text-foreground">
                @{owner?.username || "-"}
              </span>
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
          className="rounded-[var(--radius)] border border-status-danger-border bg-status-danger-bg px-3 py-1.5 text-xs font-semibold text-status-danger-text hover:bg-destructive/10 disabled:opacity-60"
          disabled={String(deletingId) === String(id) || !canDelete}
          onClick={() => {
            if (!canDelete) return;
            onDeleteClick(vc);
          }}
          type="button"
          title={canDelete ? "Delete case" : deleteHint}
        >
          {String(deletingId) === String(id) ? "Deleting..." : canDelete ? "Delete" : "Locked"}
        </button>
      </div>
      {!canDelete ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{deleteHint}</div>
      ) : null}
    </article>
  );
}

function DesktopRow({ vc, deletingId, onDeleteClick }) {
  const id = vc?.id;
  const href = `/validation-cases/${encodeURIComponent(String(id))}`;
  const owner = vc?.owner || {};
  const badge = owner?.primary_badge || null;
  const canDelete = isCaseDeletable(vc?.status);
  const deleteHint = deleteStatusHint(vc?.status);

  return (
    <tr className="hover:bg-secondary/40">
      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground whitespace-nowrap">
        <Link href={href} prefetch={false} className="hover:underline">
          #{String(id)}
        </Link>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="min-w-0">
          <Link
            href={href}
            prefetch={false}
            className="block font-semibold text-foreground hover:underline"
          >
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
            className="rounded-[var(--radius)] border border-status-danger-border bg-status-danger-bg px-3 py-1.5 text-xs font-semibold text-status-danger-text hover:bg-destructive/10 disabled:opacity-60"
            disabled={String(deletingId) === String(id) || !canDelete}
            onClick={() => {
              if (!canDelete) return;
              onDeleteClick(vc);
            }}
            type="button"
            title={canDelete ? "Delete case" : deleteHint}
          >
            {String(deletingId) === String(id) ? "Deleting..." : canDelete ? "Delete" : "Locked"}
          </button>
        </div>
        {!canDelete ? (
          <div className="mt-1 text-[11px] text-muted-foreground">{deleteHint}</div>
        ) : null}

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="xs" />
          <span className="font-semibold text-foreground">@{owner?.username || "-"}</span>
          {badge ? <Badge badge={badge} size="xs" /> : null}
        </div>
      </td>
    </tr>
  );
}

export default function CaseListTable({ items, deletingId, onDeleteClick }) {
  return (
    <div className="space-y-3">
      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {items.map((vc) => (
          <MobileCard
            key={String(vc?.id)}
            vc={vc}
            deletingId={deletingId}
            onDeleteClick={onDeleteClick}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-hidden rounded-none border border-border bg-background">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm" aria-label="Daftar kasus validasi saya">
            <thead className="bg-secondary/60 text-muted-foreground [&_th]:whitespace-nowrap">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Case
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Title
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Sensitivity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Bounty
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Filed
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((vc) => (
                <DesktopRow
                  key={String(vc?.id)}
                  vc={vc}
                  deletingId={deletingId}
                  onDeleteClick={onDeleteClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
