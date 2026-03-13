import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/format";
import { CaseSection } from "./CaseSharedComponents";
import { caseLogEventLabel } from "./validationCaseDetailUtils";

export default function CaseLogPanel({ isAuthed, caseLog, caseLogLoading, caseLogError }) {
  return (
    <CaseSection title="Log Case" subtitle="Jejak Audit">
      {!isAuthed ? (
        <div className="text-sm text-muted-foreground">
          Case Log tersedia untuk pemilik kasus dan validator yang telah disetujui.
        </div>
      ) : caseLogLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`case-log-${i}`} className="relative border-l border-border pl-5">
              <span
                className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-border"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : caseLogError ? (
        <div className="rounded-[var(--radius)] border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          {caseLogError}
        </div>
      ) : Array.isArray(caseLog) && caseLog.length > 0 ? (
        <ol className="relative space-y-5 border-l border-border pl-6">
          {caseLog.map((ev) => (
            <li key={String(ev.id)} className="relative">
              <span
                className="absolute -left-[9px] top-2 h-3 w-3 rounded-full bg-border"
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">
                  {caseLogEventLabel(ev?.event_type)}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {formatDateTime(ev.created_at)}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                {ev?.actor?.username ? (
                  <>
                    <Avatar
                      src={ev?.actor?.avatar_url}
                      name={ev?.actor?.username || ""}
                      size="xs"
                    />
                    <Link
                      href={`/user/${encodeURIComponent(ev.actor.username)}`}
                      prefetch={false}
                      className="font-semibold text-foreground hover:underline hover:text-primary"
                    >
                      @{ev.actor.username}
                    </Link>
                    <span>melakukan pembaruan ini.</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Pembaruan otomatis oleh sistem.
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-sm text-muted-foreground">
          Case Log tidak tersedia untuk role ini, atau belum ada event yang tercatat.
        </div>
      )}
    </CaseSection>
  );
}
