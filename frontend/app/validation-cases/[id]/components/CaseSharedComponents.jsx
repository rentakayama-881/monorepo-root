import { statusBadgeClass, statusLabel } from "./validationCaseDetailUtils";

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(
        status
      )}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function CaseSection({ title, subtitle, children }) {
  return (
    <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
      <header className="flex flex-col gap-1.5">
        {subtitle ? (
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}
