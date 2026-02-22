import { PageLoadingBlock } from "@/components/ui/LoadingState";

/**
 * Global loading component for route transitions.
 */
export default function Loading() {
  return <PageLoadingBlock className="min-h-[60vh]" maxWidthClass="max-w-2xl" lines={5} />;
}
