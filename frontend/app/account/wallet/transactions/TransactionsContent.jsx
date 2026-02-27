"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
  extractFeatureItems,
} from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

function normalizeWallet(payload) {
  const data = unwrapFeatureData(payload) || {};
  return {
    balance: Number(data?.balance ?? data?.Balance ?? 0) || 0,
    userId: Number(data?.userId ?? data?.UserId ?? 0) || 0,
  };
}

function normalizeWalletTransaction(item) {
  const type = String(item?.type ?? item?.Type ?? "").trim();
  const amount = Number(item?.amount ?? item?.Amount ?? 0) || 0;
  return {
    kind: "wallet",
    id: String(item?.id ?? item?.Id ?? ""),
    type,
    amount,
    description: String(item?.description ?? item?.Description ?? "").trim(),
    referenceId: String(item?.referenceId ?? item?.ReferenceId ?? "").trim(),
    referenceType: String(item?.referenceType ?? item?.ReferenceType ?? "").trim(),
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
  };
}

function normalizeTransfer(item, currentUserId) {
  const senderId = Number(item?.senderId ?? item?.SenderId ?? 0) || 0;
  const receiverId = Number(item?.receiverId ?? item?.ReceiverId ?? 0) || 0;
  const amount = Number(item?.amount ?? item?.Amount ?? 0) || 0;
  const isSender = currentUserId > 0 && senderId === currentUserId;

  return {
    kind: "transfer",
    id: String(item?.id ?? item?.Id ?? ""),
    type: String(item?.status ?? item?.Status ?? "Transfer"),
    amount: isSender ? -Math.abs(amount) : Math.abs(amount),
    description: isSender
      ? `Transfer ke @${item?.receiverUsername ?? item?.ReceiverUsername ?? "Unknown"}`
      : `Transfer dari @${item?.senderUsername ?? item?.SenderUsername ?? "Unknown"}`,
    referenceId: "",
    referenceType: "transfer",
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
  };
}

function mapWalletTypeLabel(type, description) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "marketpurchasereserve") return "Pembelian market";
  if (normalized === "marketpurchaserelease") return "Refund pembelian market";
  if (normalized === "deposit") return "Deposit";
  if (normalized === "withdrawal") return "Withdraw";
  if (normalized === "transferin") return "Transfer masuk";
  if (normalized === "transferout") return "Transfer keluar";
  if (normalized === "fee") return "Biaya";
  return description || type || "Transaksi wallet";
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount) {
  const abs = Math.abs(Number(amount) || 0);
  return `Rp ${abs.toLocaleString("id-ID")}`;
}

export default function TransactionsContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [wallet, setWallet] = useState({ balance: 0, userId: 0 });
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      setLoading(true);
      try {
        const walletData = normalizeWallet(await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME));
        setWallet(walletData);

        const walletTxPayload = unwrapFeatureData(
          await fetchFeatureAuth(`${FEATURE_ENDPOINTS.WALLETS.TRANSACTIONS}?page=1&pageSize=100`)
        );
        const walletTxItems = extractFeatureItems(walletTxPayload).map(normalizeWalletTransaction);
        setWalletTransactions(walletTxItems.filter((item) => item.id));

        const transferPayload = unwrapFeatureData(await fetchFeatureAuth(`${FEATURE_ENDPOINTS.TRANSFERS.LIST}?limit=50`));
        const transferItems = extractFeatureItems(transferPayload).map((item) => normalizeTransfer(item, walletData.userId));
        setTransfers(transferItems.filter((item) => item.id));
      } catch (error) {
        logger.error("Failed to load wallet transactions", error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const rows = useMemo(() => {
    if (activeTab === "wallet") {
      return [...walletTransactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    if (activeTab === "transfer") {
      return [...transfers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return [...walletTransactions, ...transfers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [activeTab, walletTransactions, transfers]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Riwayat Transaksi</h1>
            <p className="text-sm text-muted-foreground">Mutasi wallet, transfer, dan pembelian market.</p>
          </div>
          <Link
            href="/account/wallet/send"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            + Kirim Dana
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Saldo Wallet</div>
          <div className="text-2xl font-bold text-foreground">Rp {wallet.balance.toLocaleString("id-ID")}</div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-border">
          {[
            { key: "all", label: "Semua" },
            { key: "wallet", label: "Wallet" },
            { key: "transfer", label: "Transfer" },
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

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 rounded-lg bg-border" />
            <div className="h-20 rounded-lg bg-border" />
            <div className="h-20 rounded-lg bg-border" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Belum ada transaksi.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isDebit = Number(row.amount) < 0;
              const amountClass = isDebit ? "text-destructive" : "text-emerald-600";
              const title = row.kind === "wallet" ? mapWalletTypeLabel(row.type, row.description) : row.description;
              const content = (
                <div className="rounded-lg border border-border bg-card p-4 transition hover:border-muted-foreground/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-foreground">{title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</div>
                      {row.referenceId ? (
                        <div className="text-[11px] text-muted-foreground">
                          Ref: <span className="font-mono">{row.referenceId}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className={`text-sm font-semibold ${amountClass}`}>
                      {isDebit ? "-" : "+"}
                      {formatCurrency(row.amount)}
                    </div>
                  </div>
                </div>
              );

              if (row.kind === "transfer") {
                return (
                  <Link key={`${row.kind}-${row.id}`} href={`/account/wallet/transactions/${row.id}`} className="block">
                    {content}
                  </Link>
                );
              }

              return <div key={`${row.kind}-${row.id}`}>{content}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
