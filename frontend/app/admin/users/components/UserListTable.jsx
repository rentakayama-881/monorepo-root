import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

function getUserBadges(user) {
  return Array.isArray(user?.badges) ? user.badges : [];
}

export default function UserListTable({
  users,
  search,
  loading,
  hasMore,
  onAssign,
  onRevoke,
  onLoadMore,
}) {
  if (users.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          {search ? "User tidak ditemukan" : "Belum ada user"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((user) => {
        const userBadges = getUserBadges(user);
        return (
          <Card key={user.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username || user.email || "User"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl text-muted-foreground">
                      {(user.username || user.email)?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {user.username || "No username"}
                    </span>
                    {user.primary_badge && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs"
                        style={{
                          backgroundColor: (user.primary_badge.color || "#6366f1") + "20",
                          color: user.primary_badge.color || "#6366f1",
                        }}
                      >
                        {user.primary_badge.icon_url && (
                          <img src={user.primary_badge.icon_url} alt="" className="w-3 h-3" />
                        )}
                        {user.primary_badge.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>

                  {userBadges.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {userBadges.map((badge) => (
                        <span
                          key={badge.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted/50 text-muted-foreground"
                        >
                          {badge.icon_url && (
                            <img src={badge.icon_url} alt="" className="w-3 h-3" />
                          )}
                          {badge.name}
                          <button
                            type="button"
                            onClick={() => onRevoke(user, badge)}
                            className="ml-1 text-destructive hover:opacity-80"
                            title="Cabut badge"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button variant="secondary" size="sm" onClick={() => onAssign(user)}>
                + Badge
              </Button>
            </div>
          </Card>
        );
      })}

      {hasMore && (
        <div className="text-center">
          <Button variant="secondary" onClick={onLoadMore} disabled={loading}>
            Muat Lebih Banyak
          </Button>
        </div>
      )}
    </div>
  );
}
