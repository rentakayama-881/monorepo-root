"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

export default function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("all");
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "transfer") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      setLoading(true);
      try {
        // Load wallet
        const walletRes = await fetch(`${getApiBase()}/api/wallet/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (walletRes.ok) {
          setWallet(await walletRes.json());
        }

        // Load transfers
        let url = `${getApiBase()}/api/transfers?limit=50`;
        if (activeTab === "sent") url += "&role=sender";
        if (activeTab === "received") url += "&role=receiver";

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTransfers(data.transfers || []);
        }
      } catch (e) {
        logger.error("Failed to load data:", e);
      }
      setLoading(false);
    }

    loadData();
  }, [router, activeTab]);

  const getStatusBadge = (status) => {
    const styles = {
      held: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      released: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      refunded: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      disputed: "bg-red-500/10 text-red-600 border-red-500/30",
      cancelled: "bg-gray-500/10 text-gray-600 border-gray-500/30",
    };
    const labels = {
      held: "Ditahan",
      released: "Terkirim",
      refunded: "Dikembalikan",
      disputed: "Dispute",
      cancelled: "Dibatalkan",
    };
    return (
      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] || styles.held}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Success Message */}
        {showSuccess && (
          <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-600">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Transfer berhasil dibuat!</span>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transaksi Saya</h1>
            <p className="text-sm text-muted-foreground">
              Riwayat transfer dan escrow
            </p>
          </div>
          <Link
            href="/account/wallet/send"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Kirim Uang
          </Link>
        </div>

        {/* Balance Card */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Saldo Tersedia</div>
          <div className="text-2xl font-bold text-foreground">
            Rp {wallet.balance.toLocaleString("id-ID")}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b border-border">
          {[
            { key: "all", label: "Semua" },
            { key: "sent", label: "Terkirim" },
            { key: "received", label: "Diterima" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transfers List */}
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-24 bg-border rounded-lg" />
            <div className="h-24 bg-border rounded-lg" />
            <div className="h-24 bg-border rounded-lg" />
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">Belum ada transaksi</div>
            <Link
              href="/account/wallet/send"
              className="text-primary hover:underline"
            >
              Mulai kirim uang
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <Link
                key={transfer.id}
                href={`/account/wallet/transactions/${transfer.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition hover:border-muted-foreground"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                        transfer.sender?.id === transfer.sender_id
                          ? "bg-red-500/10 text-red-600"
                          : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {transfer.receiver?.username?.slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {transfer.sender?.username === transfer.receiver?.username
                          ? transfer.receiver?.username
                          : transfer.sender?.id === transfer.sender_id
                          ? `Ke ${transfer.receiver?.username || "User"}`
                          : `Dari ${transfer.sender?.username || "User"}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(transfer.created_at)}
                      </div>
                      {transfer.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-48">
                          {transfer.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground">
                      Rp {transfer.amount.toLocaleString("id-ID")}
                    </div>
                    <div className="mt-1">{getStatusBadge(transfer.status)}</div>
                  </div>
                </div>

                {/* Action hint for held transfers */}
                {transfer.status === "held" && (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <div className="text-xs text-muted-foreground">
                      Auto-release: {formatDate(transfer.hold_until)}
                    </div>
                    <span className="text-xs text-primary">
                      Lihat detail →
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
