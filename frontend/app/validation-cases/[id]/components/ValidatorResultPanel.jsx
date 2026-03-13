import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { CaseSection } from "./CaseSharedComponents";

export default function ValidatorResultPanel({
  artifactId,
  assignedValidator,
  certifiedId,
  certifiedDownloadHref,
}) {
  if (!artifactId || !assignedValidator) return null;

  return (
    <CaseSection title="Validator Terpilih" subtitle="Hasil Terkirim">
      <div className="flex items-center gap-3 rounded-[6px] border border-border/70 bg-secondary/20 px-3 py-3">
        <Avatar
          src={assignedValidator?.avatar_url}
          name={assignedValidator?.username || ""}
          size="sm"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={
                assignedValidator?.username
                  ? `/user/${encodeURIComponent(assignedValidator.username)}`
                  : "#"
              }
              prefetch={false}
              className="truncate text-sm font-semibold text-foreground hover:underline"
            >
              @{assignedValidator?.username || "-"}
            </Link>
            {assignedValidator?.primary_badge ? (
              <Badge badge={assignedValidator.primary_badge} size="xs" />
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">Hasil kerja dikirim</div>
        </div>
      </div>
    </CaseSection>
  );
}
