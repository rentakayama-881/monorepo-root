import { getStatusLabel, normalizeNetworkName } from "../deposit-utils";

export default function DepositHistory({ history }) {
  if (history.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Riwayat Deposit</h3>
      <div className="space-y-2">
        {history.map((d) => {
          const statusInfo = getStatusLabel(d.status);
          return (
            <div key={d.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Rp{d.amount.toLocaleString("id-ID")}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.payCurrency}
                    {d.payAmount ? ` • ${d.payAmount}` : ""}
                    {d.network ? ` • ${normalizeNetworkName(d.network)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                  {d.createdAt && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(
                        typeof d.createdAt === "number" && d.createdAt < 1e12
                          ? d.createdAt * 1000
                          : d.createdAt
                      ).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
