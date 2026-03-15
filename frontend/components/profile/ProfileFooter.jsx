import { LogOut } from "lucide-react";

export default function ProfileFooter({ isSigningOut, onLogout }) {
  return (
    <button
      data-testid="logout-button"
      onClick={onLogout}
      disabled={isSigningOut}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
      type="button"
    >
      {isSigningOut ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : (
        <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      )}
      <span className="truncate">{isSigningOut ? "Signing out..." : "Sign Out"}</span>
    </button>
  );
}
