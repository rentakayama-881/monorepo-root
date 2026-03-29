import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { formatIDR } from "@/lib/format";
import { StatusBadge } from "./CaseSharedComponents";

export default function CaseMetadataSidebar({
  id,
  owner,
  ownerBadge,
  bountyAmount,
  status,
  sensitivity,
  workflowSummary,
  filedAtLabel,
}) {
  return (
    <aside className="lg:col-span-4 lg:sticky lg:top-24 h-fit space-y-6">
      <section className="space-y-5 rounded-[var(--radius)] border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          File Case
        </div>

        <div className="flex items-center gap-3">
          <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "#"}
                prefetch={false}
                className="truncate text-sm font-semibold text-foreground hover:underline"
              >
                @{owner?.username || "-"}
              </Link>
              {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
            </div>
            <div className="text-xs text-muted-foreground">Pemilik Case</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Stake: {formatIDR(owner?.guarantee_amount ?? owner?.guaranteeAmount ?? 0)}
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-border/70 bg-background px-4 py-4">
          <div className="text-xs text-muted-foreground">Bounty</div>
          <div className="mt-1 text-xl font-bold text-foreground">{formatIDR(bountyAmount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Hadiah untuk validator dengan hasil terbaik.
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Case
            </dt>
            <dd className="font-mono text-xs text-foreground">#{String(id)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </dt>
            <dd className="text-right">
              <StatusBadge status={status} />
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sensitivitas
            </dt>
            <dd className="text-right">
              <span
                className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold ${sensitivity.badgeClass}`}
              >
                {sensitivity.level}
              </span>
              <div className="mt-1 text-xs text-muted-foreground">{sensitivity.label}</div>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workflow
            </dt>
            <dd className="max-w-[14rem] text-right text-muted-foreground">{workflowSummary}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dibuat
            </dt>
            <dd className="text-right text-muted-foreground">{filedAtLabel}</dd>
          </div>
        </dl>
      </section>

      <div className="rounded-[var(--radius)] border bg-card p-5 text-xs text-muted-foreground">
        Mode dossier: tidak ada komentar, reaksi, atau voting. Setiap aksi yang tersedia memiliki
        konsekuensi audit atau finansial.
      </div>
    </aside>
  );
}
