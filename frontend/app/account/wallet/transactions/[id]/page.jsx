"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transferId = params.id;

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch current user from API
      try {
        const userRes = await fetch(`${getApiBase()}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setCurrentUser(userData);
        }
      } catch (e) {
        logger.error("Failed to load user:", e);
      }

      try {
        const res = await fetch(`${getApiBase()}/api/transfers/${transferId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setTransfer(await res.json());
        } else {
          setError("Transfer tidak ditemukan");
        }
      } catch (e) {
        setError("Gagal memuat data");
      }
      setLoading(false);
    }

    loadData();
  }, [router, transferId]);

  const handleAction = (action) => {
    setPendingAction(action);
    setShowPinModal(true);
    setPin("");
    setError("");
  };

  const confirmAction = async () => {
    if (pin.length !== 6) {
      setError("PIN harus 6 digit");
      return;
    }

    const token = getToken();
    setProcessing(true);
    setError("");

    try {
      let url = "";
      let method = "POST";
      let body = { pin };

      if (pendingAction === "release") {
        url = `${getApiBase()}/api/transfers/${transferId}/release`;
      } else if (pendingAction === "cancel") {
        url = `${getApiBase()}/api/transfers/${transferId}/cancel`;
      } else if (pendingAction === "dispute") {
        url = `${getApiBase()}/api/disputes`;
        body = { transfer_id: transferId, reason: "Memerlukan penyelesaian" };
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowPinModal(false);
        // Reload transfer
        const refreshRes = await fetch(`${getApiBase()}/api/transfers/${transferId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refreshRes.ok) {
          setTransfer(await refreshRes.json());
        }
        if (pendingAction === "dispute") {
          router.push("/account/wallet/disputes");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Gagal memproses");
      }
    } catch (e) {
      setError("Terjadi kesalahan");
    }
    setProcessing(false);
  };

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
      <span className={`rounded-full border px-3 py-1 text-sm font-medium ${styles[status] || styles.held}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center text-muted-foreground">
          Memuat...
        </div>
      </main>
    );
  }

  if (!transfer) {
    return (
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center">
          <div className="text-destructive mb-4">{error || "Transfer tidak ditemukan"}</div>
          <Link href="/account/wallet/transactions" className="text-primary hover:underline">
            ← Kembali
          </Link>
        </div>
      </main>
    );
  }

  const isSender = currentUser?.id === transfer.sender_id;
  const isReceiver = currentUser?.id === transfer.receiver_id;

  return (
    <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link
            href="/account/wallet/transactions"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </Link>

          <div className="rounded-lg border border-border bg-card">
            {/* Header */}
            <div className="border-b border-border p-6 text-center">
              <div className="text-sm text-muted-foreground mb-1">
                {isSender ? "Anda mengirim" : "Anda menerima"}
              </div>
              <div className="text-3xl font-bold text-foreground mb-3">
                Rp {transfer.amount.toLocaleString("id-ID")}
              </div>
              {getStatusBadge(transfer.status)}
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Dari</span>
                <span className="font-medium text-foreground">
                  {transfer.sender?.username || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Kepada</span>
                <span className="font-medium text-foreground">
                  {transfer.receiver?.username || "Unknown"}
                </span>
              </div>
              {transfer.description && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Deskripsi</span>
                  <span className="font-medium text-foreground text-right max-w-xs">
                    {transfer.description}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Dibuat</span>
                <span className="font-medium text-foreground">
                  {formatDate(transfer.created_at)}
                </span>
              </div>
              {transfer.status === "held" && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Auto-release</span>
                  <span className="font-medium text-foreground">
                    {formatDate(transfer.hold_until)}
                  </span>
                </div>
              )}
              {transfer.released_at && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Dirilis</span>
                  <span className="font-medium text-primary">
                    {formatDate(transfer.released_at)}
                  </span>
                </div>
              )}
            </div>

            {/* Status Explanation */}
            {transfer.status === "held" && (
              <div className="mx-6 mb-6 rounded-lg bg-amber-600/10 border border-amber-600/30 p-4">
                <div className="flex gap-3">
                  <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-amber-600 mb-1">Dana Ditahan</div>
                    <div className="text-sm text-muted-foreground">
                      {isSender
                        ? "Dana sedang ditahan. Anda dapat membatalkan untuk mengembalikan dana, atau menunggu penerima merilisnya."
                        : "Dana ditahan untuk keamanan. Anda dapat merilisnya sekarang atau tunggu sampai auto-release."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions for held transfers */}
            {transfer.status === "held" && (
              <div className="p-6 border-t border-border space-y-3">
                {isReceiver && (
                  <button
                    onClick={() => handleAction("release")}
                    className="w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90"
                  >
                    Terima Dana
                  </button>
                )}
                {isSender && (
                  <button
                    onClick={() => handleAction("cancel")}
                    className="w-full rounded-lg border border-border py-3 font-semibold text-foreground transition hover:bg-card"
                  >
                    Batalkan & Kembalikan Dana
                  </button>
                )}
                <button
                  onClick={() => handleAction("dispute")}
                  className="w-full rounded-lg border border-destructive/30 py-3 font-semibold text-destructive transition hover:bg-destructive/10"
                >
                  Ajukan Dispute
                </button>
              </div>
            )}

            {/* Link to dispute if disputed */}
            {transfer.status === "disputed" && transfer.dispute_id && (
              <div className="p-6 border-t border-border">
                <Link
                  href={`/account/wallet/disputes/${transfer.dispute_id}`}
                  className="block w-full rounded-lg bg-destructive/10 border border-destructive/30 py-3 text-center font-semibold text-destructive transition hover:opacity-80"
                >
                  Lihat Detail Dispute
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* PIN Modal */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-card p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Konfirmasi dengan PIN
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {pendingAction === "release" && "Masukkan PIN untuk menerima dana"}
                {pendingAction === "cancel" && "Masukkan PIN untuk membatalkan transfer"}
                {pendingAction === "dispute" && "Masukkan PIN untuk mengajukan dispute"}
              </p>

              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-primary"
              />

              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowPinModal(false)}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Batal
                </button>
                <button
                  onClick={confirmAction}
                  disabled={processing || pin.length !== 6}
                  className="flex-1 rounded-lg bg-primary py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Memproses..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
