import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnixDate, boolText } from "./marketChatGPTUtils";

export function ChatGPTIcon({ className }) {
  return (
    <svg
      viewBox="0 0 41 41"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-5 shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813ZM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496ZM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744ZM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24Zm27.658 6.437-9.724-5.615 3.367-1.943a.12.12 0 0 1 .113-.012l8.051 4.649a7.497 7.497 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.649-1.131Zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763Zm-21.063 6.929-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225Zm1.829-3.943 4.33-2.501 4.332 2.5v5l-4.331 2.5-4.331-2.5V18Z"
        fill="#10a37f"
      />
    </svg>
  );
}

function SubscriptionBadge({ label }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      {label}
    </span>
  );
}

function InfoPill({ children }) {
  if (!children) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

export function MarketAccountCard({ item, checkingOut, onDetail, onBuy }) {
  return (
    <article
      className={cn(
        "group relative rounded-[var(--radius)] bg-card p-3 transition-all",
        "hover:bg-accent/40 hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
    >
      <div className="flex gap-2">
        <ChatGPTIcon className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold leading-snug text-foreground break-words">
            {item.title}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            <SubscriptionBadge label={item.subscription} />
            {item.country ? <InfoPill>{item.country}</InfoPill> : null}
            {item.tier ? <InfoPill>Tier {item.tier}</InfoPill> : null}
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-foreground">{item.displayPriceIDR}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {item.seller !== "-" ? `${item.seller}` : ""}
                {item.seller !== "-" && item.uploadedAtLabel !== "-" ? " · " : ""}
                {item.uploadedAtLabel !== "-" ? item.uploadedAtLabel : ""}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onDetail}
                className="rounded-[var(--radius)] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Detail
              </button>
              <button
                type="button"
                onClick={onBuy}
                disabled={Boolean(checkingOut) || !item.canBuy}
                className="rounded-[var(--radius)] bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {checkingOut === item.id ? "Memproses..." : item.canBuy ? "Beli" : "Belum siap"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!item.idValid ? (
        <div className="mt-1.5 rounded-[var(--radius)] bg-warning/10 px-2.5 py-1 text-xs text-foreground">
          ID akun belum valid. Silakan muat ulang daftar.
        </div>
      ) : null}
    </article>
  );
}

export function MarketAccountCardSkeleton() {
  return (
    <div className="rounded-[var(--radius)] bg-card p-3" aria-hidden="true">
      <div className="flex gap-2">
        <div className="size-5 shrink-0 animate-pulse rounded bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="flex gap-1">
            <div className="h-4 w-14 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex gap-1">
              <div className="h-6 w-14 animate-pulse rounded-[var(--radius)] bg-muted" />
              <div className="h-6 w-12 animate-pulse rounded-[var(--radius)] bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpecDrawer({ item, onClose }) {
  if (!item) return null;

  const specs = [
    ["Langganan", item?.raw?.chatgpt_subscription],
    ["Akhir Langganan", formatUnixDate(item?.raw?.chatgpt_subscription_ends)],
    ["Perpanjangan Otomatis", boolText(item?.raw?.chatgpt_subscription_auto_renew)],
    ["Negara", item?.raw?.chatgpt_country],
    ["Tanggal Registrasi", formatUnixDate(item?.raw?.chatgpt_register_date)],
    ["Nomor Telepon Tersambung", boolText(item?.raw?.chatgpt_phone)],
    ["Jenis Email", item?.raw?.email_type],
    ["Tier OpenAI", item?.raw?.openai_tier],
    ["Saldo OpenAI", item?.raw?.openai_balance],
    ["Total Akun Terjual Penjual", item?.raw?.seller?.sold_items_count],
    ["Waktu Upload", item?.uploadedAtLabel],
  ].filter((row) => row?.[1] !== null && row?.[1] !== undefined && String(row?.[1]).trim() !== "");

  return (
    <>
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detail akun"
        className="fixed z-[110] w-full bg-card shadow-2xl animate-slide-up md:top-0 md:right-0 md:h-full md:w-96 md:animate-slide-in-from-right bottom-0 left-0 max-h-[82vh] md:max-h-none rounded-t-2xl md:rounded-none"
      >
        <div className="flex items-start justify-between px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <ChatGPTIcon className="size-4" />
              <h2 className="truncate text-xs font-semibold text-foreground">{item.title}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">{item.displayPriceIDR}</span>
              {item.seller !== "-" ? (
                <span className="text-xs text-muted-foreground">· {item.seller}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        <div className="h-[calc(82vh-68px)] md:h-[calc(100vh-68px)] overflow-auto p-3">
          <div className="space-y-0.5">
            {specs.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 rounded-[var(--radius)] px-2.5 py-2 transition-colors hover:bg-muted/30"
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-foreground text-right break-all">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
