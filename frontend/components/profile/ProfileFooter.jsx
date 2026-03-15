import { LogOut } from "lucide-react";

export default function ProfileFooter({ isSigningOut, onLogout }) {
  return (
    <button
      data-testid="logout-button"
      onClick={onLogout}
      disabled={isSigningOut}
      className="rainbow-card-glass flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-medium text-destructive transition-colors hover:!bg-destructive/10"
      type="button"
    >
      {isSigningOut ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : (
        <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      )}
      <span className="truncate">{isSigningOut ? "Keluar..." : "Keluar"}</span>
    </button>
  );
}
