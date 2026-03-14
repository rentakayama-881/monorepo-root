import { normalizeSubscription } from "../useOrderDetail";

function CredentialBlock({ title, rows }) {
  const hasValue = rows.some((row) => String(row?.[1] || "").trim() !== "");
  if (!hasValue) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[160px,1fr]">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm text-foreground break-all">{value || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkBlock({ title, rows }) {
  const validRows = rows.filter((row) => {
    const url = String(row?.[1] || "").trim();
    return /^https?:\/\//i.test(url);
  });

  if (validRows.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {validRows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[160px,1fr]">
            <div className="text-xs text-muted-foreground">{label}</div>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-sm break-all text-primary underline underline-offset-2"
            >
              {value}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderCredentials({ order, statusNormalized }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Data Akun
      </div>
      {statusNormalized === "fulfilled" ? (
        <div className="mt-3 space-y-3">
          <CredentialBlock
            title="Ringkasan Akun"
            rows={[
              ["Subscription", normalizeSubscription(order)],
              ["Status", order?.delivery?.account?.status],
              ["Tier", order?.delivery?.account?.openai_tier],
              ["Negara", order?.delivery?.account?.country],
              ["Domain Email", order?.delivery?.account?.email_domain],
              ["Penjual", order?.seller || order?.delivery?.account?.seller],
            ]}
          />

          <CredentialBlock
            title="Login Akun"
            rows={[
              ["Email/Username", order?.delivery?.credentials?.account_login],
              ["Password", order?.delivery?.credentials?.account_password],
            ]}
          />

          <CredentialBlock
            title="Login Email"
            rows={[
              ["Email", order?.delivery?.credentials?.email_login],
              ["Password", order?.delivery?.credentials?.email_password],
            ]}
          />

          <LinkBlock
            title="Tautan Login"
            rows={[
              ["Login Akun", order?.delivery?.account?.account_login_url],
              ["Login Email", order?.delivery?.account?.email_login_url],
            ]}
          />

          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            Demi keamanan, segera ubah password akun utama dan email pemulihan setelah
            pembelian selesai.
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Data akun akan ditampilkan setelah transaksi selesai.
        </p>
      )}
    </div>
  );
}
