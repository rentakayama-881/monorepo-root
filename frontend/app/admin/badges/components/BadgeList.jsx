import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { BadgePresets, hexToRgba } from "@/components/ui/badgeVariants";

const DEFAULT_BADGE_COLOR = BadgePresets.verified.color;

const BadgeIconPreview = ({ type, color, size = "h-6 w-6" }) => {
  const icons = {
    verified: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    admin: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path
          fillRule="evenodd"
          d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
          clipRule="evenodd"
        />
      </svg>
    ),
    moderator: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path
          fillRule="evenodd"
          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
          clipRule="evenodd"
        />
      </svg>
    ),
    contributor: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path
          fillRule="evenodd"
          d="M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
    premium: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    trusted: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path
          fillRule="evenodd"
          d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
          clipRule="evenodd"
        />
      </svg>
    ),
    checkmark: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
        <path
          fillRule="evenodd"
          d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
          clipRule="evenodd"
        />
      </svg>
    ),
  };

  return <span style={{ color }}>{icons[type] || icons.verified}</span>;
};

export { BadgeIconPreview };

export default function BadgeList({ badges, onEdit, onDelete, onCreateClick }) {
  if (badges.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Belum ada badge</p>
        <Button variant="primary" onClick={onCreateClick} className="mt-4">
          Buat Badge Pertama
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((badge) => (
        <Card key={badge.id} className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor:
                  hexToRgba(badge.color || DEFAULT_BADGE_COLOR, 0.12) || "var(--secondary)",
              }}
            >
              <BadgeIconPreview
                type={badge.icon_type || "verified"}
                color={badge.color || DEFAULT_BADGE_COLOR}
                size="h-7 w-7"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{badge.name}</h3>
              <p className="text-xs text-muted-foreground">
                {badge.slug} • {badge.icon_type || "verified"}
              </p>
              {badge.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {badge.description}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onEdit(badge)}>
              Ubah
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDelete(badge)}
              className="text-destructive hover:bg-destructive/10"
            >
              Hapus
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
