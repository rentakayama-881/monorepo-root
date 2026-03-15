import Avatar from "@/components/ui/Avatar";
import { maskEmail } from "@/lib/email";
import { X } from "lucide-react";

export default function ProfileCard({ user, displayName, onClose }) {
  return (
    <div className="rainbow-card-glass px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="relative shrink-0">
            <Avatar src={user.avatar_url} name={displayName} size="sm" />
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-[1.5px] border-card bg-success" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground" title={displayName}>
              {displayName}
            </div>
            {user.email && (
              <div
                className="truncate text-[11px] leading-tight text-muted-foreground"
                title={maskEmail(user.email)}
              >
                {maskEmail(user.email)}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground"
          type="button"
        >
          <span className="sr-only">Close profile menu</span>
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
