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
    <div className="space-y-5">
      <div id="quality-gate">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Checklist Protokol (Wajib)
        </div>
        <div className="mt-3 space-y-2.5">
          {checklistItems.map((item) => (
            <label key={item.key} className="flex items-start gap-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(checklist?.[item.key])}
                onChange={(e) => onSetChecklist(item.key, e.target.checked)}
                disabled={formDisabled}
                className="mt-0.5 size-4 rounded border-border"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="relative z-[120]">
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Tags (Wajib)
        </label>
        {tagsAvailable ? (
          <div className="mt-2">
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
          </div>
        ) : tagsLoading ? (
          <div className="mt-2">
            <Skeleton className="h-[120px] w-full" />
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">Tags tidak tersedia.</div>
        )}
      </div>
    </div>
  );
}
