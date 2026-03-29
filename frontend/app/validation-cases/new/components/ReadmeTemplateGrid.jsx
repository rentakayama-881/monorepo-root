import { useState } from "react";
import { cn } from "@/lib/utils";
import { VALIDATION_CASE_README_TEMPLATES } from "@/lib/validationCaseReadmeTemplates";
import { ChevronDown, ChevronUp } from "lucide-react";

const COLLAPSED_COUNT = 3;

export default function ReadmeTemplateGrid({
  activeReadmeTemplateId,
  formDisabled,
  onInsertTemplate,
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleTemplates = expanded
    ? VALIDATION_CASE_README_TEMPLATES
    : VALIDATION_CASE_README_TEMPLATES.slice(0, COLLAPSED_COUNT);
  const hasMore = VALIDATION_CASE_README_TEMPLATES.length > COLLAPSED_COUNT;

  return (
    <div id="readme-design">
      <label className="text-xs font-semibold text-muted-foreground">README Design Templates</label>
      <p className="mt-1 text-xs text-muted-foreground">
        Pilih template, klik insert. Isi tetap custom dari kamu.
      </p>
      <div className="mt-2 space-y-1.5">
        {visibleTemplates.map((template) => {
          const selected = activeReadmeTemplateId === template.id;
          return (
            <div
              key={template.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition",
                "border border-transparent hover:bg-accent/50",
                selected && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{template.name}</span>
                  <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {template.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {template.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInsertTemplate(template)}
                disabled={formDisabled}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1 text-xs font-medium transition",
                  selected
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  "disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {selected ? "Inserted ✓" : "Insert"}
              </button>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex w-full items-center justify-center gap-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          {expanded ? (
            <>
              Sembunyikan <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              {VALIDATION_CASE_README_TEMPLATES.length - COLLAPSED_COUNT} template lainnya{" "}
              <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
