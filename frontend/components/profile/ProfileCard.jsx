import Avatar from "@/components/ui/Avatar";
import { maskEmail } from "@/lib/email";
import { X } from "lucide-react";

export default function ProfileCard({ user, displayName, onClose }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="relative shrink-0">
          <Avatar src={user.avatar_url} name={displayName} size="sm" />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground" title={displayName}>
            {displayName}
          </div>
          {user.email && (
            <div className="truncate text-xs text-muted-foreground" title={maskEmail(user.email)}>
              {maskEmail(user.email)}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        type="button"
      >
        <span className="sr-only">Close profile menu</span>
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
