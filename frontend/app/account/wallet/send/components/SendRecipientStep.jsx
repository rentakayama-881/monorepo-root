import { Loader2, Frown } from "lucide-react";

export default function SendRecipientStep({
  searchQuery,
  onSearchChange,
  searching,
  searchResults,
  onSelectUser,
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Find Recipient</label>
        <input
          type="text"
          data-testid="transfer-recipient-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Ketik username (min 3 karakter)"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {searching && (
        <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground">
          <Loader2 className="animate-spin h-5 w-5 mx-auto mb-2 text-primary" />
          Mencari...
        </div>
      )}

      {!searching && searchQuery.length >= 3 && searchResults.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground">
          <Frown className="h-8 w-8 mx-auto mb-2 text-muted-foreground" strokeWidth={1.5} />
          <p>User not found</p>
          <p className="text-xs mt-1">Username minimal 7 karakter</p>
        </div>
      )}

      {!searching && searchResults.length > 0 && (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {searchResults.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-foreground">{user.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
