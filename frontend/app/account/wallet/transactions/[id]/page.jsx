"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

// Dispute categories matching backend
const DISPUTE_CATEGORIES = [
  { value: "ItemNotReceived", label: "Barang/Jasa Tidak Diterima" },
  { value: "ItemNotAsDescribed", label: "Barang/Jasa Tidak Sesuai Deskripsi" },
  { value: "Fraud", label: "Dugaan Penipuan" },
  { value: "SellerNotResponding", label: "Penjual Tidak Merespons" },
  { value: "Other", label: "Alasan Lainnya" },
];

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transferId = params.id;

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNoPinModal, setShowNoPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [disputeCategory, setDisputeCategory] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch current user from Go backend
      try {
        const userData = await fetchJsonAuth("/api/user/me");
        setCurrentUser(userData);
      } catch (e) {
        logger.error("Failed to load user:", e);
      }

      // Fetch wallet to check PIN status
      try {
        const walletData = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
        setWallet(walletData);
      } catch (e) {
        logger.error("Failed to load wallet:", e);
      }

      // Fetch transfer from Feature Service
      try {
        const transferData = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.DETAIL(transferId));
        setTransfer(transferData.data || transferData);
      } catch (e) {
        logger.error("Failed to load transfer:", e);
        setError("Transfer tidak ditemukan");
      }
      setLoading(false);
    }

    loadData();
  }, [router, transferId]);

  // Check if user has PIN set
  const hasPinSet = wallet?.pinSet || wallet?.pin_set || false;

  // Handle action - check PIN requirement
  const handleAction = (action) => {
    setPendingAction(action);
    setError("");
    setActionSuccess("");

    // Dispute doesn't require PIN but needs category and reason
    if (action === "dispute") {
      setDisputeCategory("");
      setDisputeReason("");
      setShowConfirmModal(true);
      return;
    }

    // Release and Cancel require PIN
    if (!hasPinSet) {
      setShowNoPinModal(true);
      return;
    }

    setShowPinModal(true);
    setPin("");
  };

  // Confirm action without PIN (dispute)
  const confirmActionWithoutPin = async () => {
    // Validate dispute form
    if (!disputeCategory) {
      setError("Pilih kategori masalah");
      return;
    }
    if (!disputeReason || disputeReason.length < 20) {
      setError("Jelaskan masalah minimal 20 karakter");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const endpoint = FEATURE_ENDPOINTS.DISPUTES.CREATE;
      const body = { 
        transferId: transferId, 
        reason: disputeReason,
        category: disputeCategory
      };

      await fetchFeatureAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setShowConfirmModal(false);
      setActionSuccess("Permintaan mediasi berhasil dikirim. Tim kami akan menghubungi Anda.");
      
      // Reload transfer
      const transferData = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.DETAIL(transferId));
      setTransfer(transferData.data || transferData);
    } catch (e) {
      logger.error("Dispute action failed:", e);
      setError(e.message || "Gagal membuat permintaan mediasi");
    }
    setProcessing(false);
  };

  // Confirm action with PIN (release/cancel)
  const confirmActionWithPin = async () => {
    if (pin.length !== 6) {
      setError("PIN harus 6 digit");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      let endpoint = "";
      let body = { pin };

      if (pendingAction === "release") {
        endpoint = FEATURE_ENDPOINTS.TRANSFERS.RELEASE(transferId);
      } else if (pendingAction === "cancel") {
        endpoint = FEATURE_ENDPOINTS.TRANSFERS.CANCEL(transferId);
        body.reason = "Dibatalkan oleh pengirim";
      }

      await fetchFeatureAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setShowPinModal(false);
      setActionSuccess(
        pendingAction === "release" 
          ? "Dana berhasil dilepaskan ke penerima!" 
          : "Transaksi berhasil dibatalkan, dana dikembalikan."
      );
      
      // Reload transfer
      const transferData = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.DETAIL(transferId));
      setTransfer(transferData.data || transferData);
    } catch (e) {
      logger.error("Action failed:", e);
      setError(e.message || "Gagal memproses. Pastikan PIN benar.");
    }
    setProcessing(false);
  };

  // Normalize backend status to frontend expected status
  const normalizeStatus = (status) => {
    const statusMap = {
      "Pending": "held",
      "Released": "released",
      "Cancelled": "cancelled",
      "Disputed": "disputed",
      "Expired": "released",
    };
    return statusMap[status] || status?.toLowerCase() || "held";
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeStatus(status);
    const styles = {
      held: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      released: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      refunded: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      disputed: "bg-red-500/10 text-red-600 border-red-500/30",
      cancelled: "bg-gray-500/10 text-gray-600 border-gray-500/30",
    };
    const labels = {
      held: "Dana Ditahan",
      released: "Selesai",
      refunded: "Dikembalikan",
      disputed: "Dalam Mediasi",
      cancelled: "Dibatalkan",
    };
    return (
      <span className={`rounded-full border px-3 py-1 text-sm font-medium ${styles[normalized] || styles.held}`}>
        {labels[normalized] || status}
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

  const isSender = currentUser?.id === transfer.senderId;
  const isReceiver = currentUser?.id === transfer.receiverId;
  const status = normalizeStatus(transfer.status);
  
  // Calculate hold period info
  const getHoldInfo = () => {
    if (!transfer.holdUntil) return null;
    const holdUntil = new Date(transfer.holdUntil);
    const createdAt = new Date(transfer.createdAt);
    const now = new Date();
    const daysRemaining = Math.ceil((holdUntil - now) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((holdUntil - createdAt) / (1000 * 60 * 60 * 24));
    return { daysRemaining: Math.max(0, daysRemaining), totalDays, holdUntil };
  };
  const holdInfo = getHoldInfo();

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
                {isSender ? "Anda mengirim ke" : "Anda menerima dari"}
                <span className="font-medium text-foreground ml-1">
                  @{isSender ? transfer.receiverUsername : transfer.senderUsername}
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground mb-3">
                Rp {transfer.amount?.toLocaleString("id-ID") || 0}
              </div>
              {getStatusBadge(transfer.status)}
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Pengirim</span>
                <span className="font-medium text-foreground">
                  @{transfer.senderUsername || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Penerima</span>
                <span className="font-medium text-foreground">
                  @{transfer.receiverUsername || "Unknown"}
                </span>
              </div>
              {transfer.message && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Catatan</span>
                  <span className="font-medium text-foreground text-right max-w-xs">
                    {transfer.message}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Kode Transfer</span>
                <span className="font-mono text-foreground">
                  {transfer.code}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Tanggal Dibuat</span>
                <span className="font-medium text-foreground">
                  {formatDate(transfer.createdAt)}
                </span>
              </div>
              {status === "held" && holdInfo && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Pelepasan Otomatis</span>
                  <span className="font-medium text-foreground">
                    {formatDate(transfer.holdUntil)}
                  </span>
                </div>
              )}
              {transfer.releasedAt && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Tanggal Selesai</span>
                  <span className="font-medium text-primary">
                    {formatDate(transfer.releasedAt)}
                  </span>
                </div>
              )}
              {transfer.cancelledAt && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Tanggal Dibatalkan</span>
                  <span className="font-medium text-red-500">
                    {formatDate(transfer.cancelledAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Status Explanation for Held */}
            {status === "held" && holdInfo && (
              <div className="mx-6 mb-6 rounded-lg bg-amber-600/10 border border-amber-600/30 p-4">
                <div className="flex gap-3">
                  <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-amber-600 mb-1">Dana Dalam Perlindungan Escrow</div>
                    <div className="text-sm text-muted-foreground">
                      {isSender ? (
                        <>
                          Dana Anda ditahan sementara untuk melindungi transaksi. 
                          {holdInfo.daysRemaining > 0 
                            ? ` Dana akan otomatis dikirim ke penerima dalam ${holdInfo.daysRemaining} hari.`
                            : " Dana akan segera dikirim ke penerima."
                          }
                          <br /><br />
                          <strong>Sudah menerima barang/jasa?</strong> Anda dapat melepaskan dana lebih awal.
                          <br />
                          <strong>Ada masalah?</strong> Anda dapat membatalkan transaksi atau meminta bantuan tim kami.
                        </>
                      ) : (
                        <>
                          Dana sedang ditahan dalam sistem escrow untuk keamanan kedua belah pihak.
                          {holdInfo.daysRemaining > 0 
                            ? ` Dana akan otomatis masuk ke saldo Anda dalam ${holdInfo.daysRemaining} hari.`
                            : " Dana akan segera masuk ke saldo Anda."
                          }
                          <br /><br />
                          <strong>Ada kendala dalam transaksi?</strong> Anda dapat meminta bantuan tim mediasi kami.
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {actionSuccess && (
              <div className="mx-6 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{actionSuccess}</span>
                </div>
              </div>
            )}

            {/* Actions for held transfers */}
            {status === "held" && (
              <div className="p-6 border-t border-border space-y-3">
                {isSender && (
                  <>
                    <button
                      onClick={() => handleAction("release")}
                      className="w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:opacity-90"
                    >
                      Lepaskan Dana Lebih Awal
                    </button>
                    <button
                      onClick={() => handleAction("cancel")}
                      className="w-full rounded-lg border border-border py-3 font-semibold text-foreground transition hover:bg-card"
                    >
                      Batalkan & Kembalikan Dana
                    </button>
                  </>
                )}
                {isReceiver && (
                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong className="text-foreground">Info untuk Penerima:</strong>
                    </p>
                    <p>
                      Sebagai penerima, dana akan otomatis masuk ke saldo Anda setelah periode penahanan berakhir. 
                      Jika ada kendala dengan transaksi ini, Anda dapat meminta bantuan tim mediasi.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleAction("dispute")}
                  className="w-full rounded-lg border border-blue-500/30 py-3 font-semibold text-blue-600 transition hover:bg-blue-500/10"
                >
                  Minta Bantuan Tim Mediasi
                </button>
              </div>
            )}

            {/* Link to dispute if disputed */}
            {status === "disputed" && transfer.disputeId && (
              <div className="p-6 border-t border-border">
                <Link
                  href={`/account/wallet/disputes/${transfer.disputeId}`}
                  className="block w-full rounded-lg bg-blue-500/10 border border-blue-500/30 py-3 text-center font-semibold text-blue-600 transition hover:opacity-80"
                >
                  Lihat Detail Mediasi
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* PIN Modal for release/cancel */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-card p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Konfirmasi dengan PIN
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {pendingAction === "release" && "Masukkan PIN untuk melepaskan dana ke penerima"}
                {pendingAction === "cancel" && "Masukkan PIN untuk membatalkan dan mengembalikan dana"}
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
                  onClick={() => { setShowPinModal(false); setError(""); }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Batal
                </button>
                <button
                  onClick={confirmActionWithPin}
                  disabled={processing || pin.length !== 6}
                  className="flex-1 rounded-lg bg-primary py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Memproses..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Modal for dispute (no PIN required) */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="w-full max-w-md rounded-lg bg-card p-6 my-8">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Minta Bantuan Tim Mediasi
              </h3>
              <div className="text-sm text-muted-foreground mb-4">
                <p>
                  Jelaskan masalah yang Anda alami agar tim kami dapat membantu menyelesaikannya.
                </p>
              </div>

              {/* Category Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Kategori Masalah <span className="text-destructive">*</span>
                </label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {DISPUTE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason Textarea */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Jelaskan Masalah <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Jelaskan masalah yang Anda alami secara detail (minimal 20 karakter)..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-foreground focus:outline-none focus:border-primary resize-none"
                />
                <div className={`text-xs mt-1 ${disputeReason.length >= 20 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {disputeReason.length}/20 karakter minimum {disputeReason.length >= 20 ? '✓' : ''}
                </div>
              </div>

              {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setError(""); }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Batal
                </button>
                <button
                  onClick={confirmActionWithoutPin}
                  disabled={processing || !disputeCategory || disputeReason.length < 20}
                  className="flex-1 rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {processing ? "Memproses..." : "Kirim Permintaan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No PIN Setup Modal */}
        {showNoPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-card p-6">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-amber-500/10 p-3">
                  <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 text-center">
                PIN Belum Diatur
              </h3>
              <div className="text-sm text-muted-foreground mb-6 text-center space-y-2">
                <p>
                  Untuk melakukan aksi ini, Anda harus membuat PIN keamanan terlebih dahulu.
                </p>
                <p className="text-xs">
                  Silakan buat PIN dengan cara:
                </p>
                <ol className="text-xs text-left list-decimal list-inside space-y-1">
                  <li>Aktifkan autentikasi keamanan (2FA) di halaman pengaturan akun</li>
                  <li>Kemudian klik tombol <strong>Kirim Uang</strong> atau <strong>Tarik Saldo</strong> untuk mengatur PIN</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNoPinModal(false)}
                  className="flex-1 rounded-lg border border-border py-2 font-medium transition hover:bg-card"
                >
                  Tutup
                </button>
                <Link
                  href="/account?setup2fa=true"
                  className="flex-1 rounded-lg bg-primary py-2 font-semibold text-white text-center transition hover:opacity-90"
                >
                  Atur Keamanan
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
