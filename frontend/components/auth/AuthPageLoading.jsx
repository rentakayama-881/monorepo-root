import { cn } from "@/lib/utils";
import { CenteredSpinner, SectionLoadingBlock } from "@/components/ui/LoadingState";

export default function AuthPageLoading({ message = "Loading...", fullPage = true, className = "" }) {
  return (
    <div className={cn(fullPage && "min-h-screen bg-background", className)}>
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="space-y-4">
          <CenteredSpinner srLabel={message} />
          <SectionLoadingBlock lines={3} compact srLabel={message} />
        </div>
      </div>
    </div>
  );
}
