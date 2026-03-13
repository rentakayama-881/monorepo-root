import { cn } from "@/lib/utils";
import { VALIDATION_CASE_README_TEMPLATES } from "@/lib/validationCaseReadmeTemplates";

export default function ReadmeTemplateGrid({
  activeReadmeTemplateId,
  formDisabled,
  onInsertTemplate,
}) {
  return (
    <div id="readme-design">
      <label className="text-xs font-semibold text-muted-foreground">README Design Templates</label>
      <div className="mt-2 rounded-[var(--radius)] border border-border/60 gradient-subtle p-3 md:p-4">
        <div className="text-sm font-semibold text-foreground">GitHub-style template siap edit</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Pilih template visual, lalu klik insert. Isi tetap custom dari kamu sendiri. Tag protocol
          tetap wajib.
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3">
          {VALIDATION_CASE_README_TEMPLATES.map((template) => {
            const selected = activeReadmeTemplateId === template.id;
            return (
              <article
                key={template.id}
                className={cn(
                  "rounded-[var(--radius)] border p-2.5 md:p-3 transition",
                  template.palette?.tplClass,
                  template.palette?.cardClass || "border-border bg-card",
                  selected && "ring-2 ring-primary/60"
                )}
              >
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(template.previewBadges)
                    ? template.previewBadges.map((badgeLabel) => (
                        <span
                          key={`${template.id}-${badgeLabel}`}
                          className={cn(
                            "rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                            template.palette?.badgeClass ||
                              "border-border bg-secondary/40 text-foreground"
                          )}
                        >
                          {badgeLabel}
                        </span>
                      ))
                    : null}
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">{template.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{template.description}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {template.category}
                </div>
                <button
                  type="button"
                  onClick={() => onInsertTemplate(template)}
                  disabled={formDisabled}
                  className={cn(
                    "mt-3 inline-flex w-full items-center justify-center rounded-[var(--radius)] border px-3 py-1.5 text-xs font-semibold transition",
                    template.palette?.buttonClass ||
                      "border-border text-foreground hover:bg-secondary",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  Insert Template
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
