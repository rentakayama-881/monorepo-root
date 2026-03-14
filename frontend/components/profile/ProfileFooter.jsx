import { LogOut } from "lucide-react";

export default function ProfileFooter({ isSigningOut, onLogout }) {
  return (
    <div className="shrink-0 border-t p-3">
      <button
        data-testid="logout-button"
        onClick={onLogout}
        disabled={isSigningOut}
        className="w-full rounded-lg border border-destructive/25 bg-destructive/[0.03] px-3 py-2 text-left text-sm font-semibold text-destructive transition-colors hover:border-destructive/40 hover:bg-destructive/10"
        type="button"
      >
        <span className="flex items-center gap-2">
          {isSigningOut ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogOut className="h-4 w-4" strokeWidth={2} />
          )}
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </span>
      </button>
    </div>
  );
}
