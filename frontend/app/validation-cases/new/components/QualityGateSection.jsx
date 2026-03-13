import TagSelector from "@/components/ui/TagSelector";
import Skeleton from "@/components/ui/Skeleton";
import { checklistItems } from "./newCaseUtils";

export default function QualityGateSection({
  checklist,
  formDisabled,
  onSetChecklist,
  availableTags,
  selectedTags,
  onTagsChange,
  tagsAvailable,
  tagsLoading,
}) {
  return (
    <>
      <div id="quality-gate">
        <label className="text-xs font-semibold text-muted-foreground">
          Checklist Protokol (Wajib)
        </label>
        <div className="mt-2 space-y-2 rounded-[var(--radius)] bg-secondary/10 p-2.5 md:p-3">
          {checklistItems.map((item) => (
            <label key={item.key} className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(checklist?.[item.key])}
                onChange={(e) => onSetChecklist(item.key, e.target.checked)}
                disabled={formDisabled}
                className="mt-0.5"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 relative z-[120]">
        <label className="text-xs font-semibold text-muted-foreground">Tags (Wajib)</label>
        {tagsAvailable ? (
          <TagSelector
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={onTagsChange}
            maxTags={4}
            placeholder="Pilih minimal 2 tags..."
            enableSearch={true}
            singlePerGroup={true}
            disabled={formDisabled}
          />
        ) : tagsLoading ? (
          <div className="mt-1">
            <Skeleton className="h-[120px] w-full" />
          </div>
        ) : (
          <div className="mt-1 text-sm text-muted-foreground">Tags tidak tersedia.</div>
        )}
      </div>
    </>
  );
}
