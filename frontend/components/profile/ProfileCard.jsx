import Avatar from "@/components/ui/Avatar";
import { maskEmail } from "@/lib/email";
import { X } from "lucide-react";

export default function ProfileCard({ user, displayName, onClose }) {
  return (
    <div className="shrink-0 p-3 pb-0">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative shrink-0">
            <Avatar src={user.avatar_url} name={displayName} size="sm" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success ring-2 ring-card" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground" title={displayName}>
              {displayName}
            </div>
            {user.email && (
              <div className="truncate text-xs text-muted-foreground" title={maskEmail(user.email)}>
                {maskEmail(user.email)}
              </div>
            )}
            <div className="truncate text-xs text-muted-foreground">
              Kelola aktivitas dan pengaturan profil
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          type="button"
        >
          <span className="sr-only">Close profile menu</span>
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
