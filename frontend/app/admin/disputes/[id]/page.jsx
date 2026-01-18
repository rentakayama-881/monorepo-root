"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import logger from "@/lib/logger";

const API_BASE = process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.alephdraad.fun";

export default function AdminDisputeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesEndRef = useRef(null);

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionNote, setActionNote] = useState("");

  const getAdminToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_token");
    }
    return null;
  };

  const fetchWithAuth = async (endpoint, options = {}) => {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || "Request failed");
    }
    return res.json();
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load dispute
  const loadDispute = async () => {
    try {
      const data = await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}`);
      setDispute(data.data || data);
    } catch (e) {
      logger.error("Failed to load dispute:", e);
      setError("Dispute tidak ditemukan");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDispute();
    const interval = setInterval(loadDispute, 5000);
    return () => clearInterval(interval);
  }, [disputeId]);

  useEffect(() => {
    scrollToBottom();
  }, [dispute?.messages]);

  // Send admin message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError("");

    try {
      await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message.trim() }),
      });
      setMessage("");
      await loadDispute();
    } catch (e) {
      logger.error("Failed to send message:", e);
      setError("Gagal mengirim pesan");
    }
    setSending(false);
  };

  // Handle action click
  const handleAction = (action) => {
    setPendingAction(action);
    setActionNote("");
    setShowConfirmModal(true);
  };

  // Confirm action
  const confirmAction = async () => {
    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = `/api/v1/admin/disputes/${disputeId}/${pendingAction}`;
      await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({ note: actionNote }),
      });

      setShowConfirmModal(false);
      setSuccess(
        pendingAction === "refund" ? "Dana berhasil dikembalikan ke pembeli" :
        pendingAction === "force-release" ? "Dana berhasil dilepaskan ke penjual" :
        "Transaksi dilanjutkan mengikuti hold time"
      );
      await loadDispute();
    } catch (e) {
      logger.error("Action failed:", e);
      setError(e.message || "Gagal memproses aksi");
    }
    setProcessing(false);
  };

  // Update status
  const handleStatusUpdate = async (newStatus) => {
    try {
      await fetchWithAuth(`/api/v1/admin/disputes/${disputeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadDispute();
    } catch (e) {
      logger.error("Status update failed:", e);
      setError("Gagal mengubah status");
    }
  };

  // Format helpers
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

  const formatAmount = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "bg-yellow-500 text-white";
      case "UnderReview": return "bg-blue-500 text-white";
      case "WaitingForEvidence": return "bg-orange-500 text-white";
      case "Resolved": return "bg-green-500 text-white";
      case "Cancelled": return "bg-gray-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "Open": return "Menunggu Review";
      case "UnderReview": return "Sedang Ditinjau";
      case "WaitingForEvidence": return "Butuh Bukti";
      case "Resolved": return "Selesai";
      case "Cancelled": return "Dibatalkan";
      default: return status;
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case "ItemNotReceived": return "Barang Tidak Diterima";
      case "ItemNotAsDescribed": return "Tidak Sesuai Deskripsi";
      case "Fraud": return "Dugaan Penipuan";
      case "SellerNotResponding": return "Penjual Tidak Merespons";
      case "Other": return "Lainnya";
      default: return category;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Dispute Tidak Ditemukan</h1>
          <Link href="/admin/disputes" className="text-primary hover:underline">
            ← Kembali
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = dispute.status === "Resolved" || dispute.status === "Cancelled";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/disputes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Disputes
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-foreground">Dispute #{disputeId?.slice(-6)}</h1>
          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(dispute.status)}`}>
            {getStatusLabel(dispute.status)}
          </span>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 text-green-600 border border-green-500/20">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Dispute Info & Actions */}
        <div className="col-span-1 space-y-6">
          {/* Dispute Info */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Detail Dispute</h2>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Kategori:</span>
                <div className="font-medium text-foreground">{getCategoryLabel(dispute.category)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Jumlah:</span>
                <div className="font-bold text-primary text-lg">Rp {formatAmount(dispute.amount)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Dibuat:</span>
                <div className="text-foreground">{formatDate(dispute.createdAt)}</div>
              </div>
            </div>

            <hr className="my-4 border-border" />

            <h3 className="font-medium text-foreground mb-2">Pihak Terlibat</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pembeli:</span>
                <span className="font-medium text-foreground">@{dispute.initiatorUsername}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penjual:</span>
                <span className="font-medium text-foreground">@{dispute.respondentUsername}</span>
              </div>
            </div>

            <hr className="my-4 border-border" />

            <h3 className="font-medium text-foreground mb-2">Alasan Dispute</h3>
            <p className="text-sm text-muted-foreground">{dispute.reason}</p>
          </div>

          {/* Status Update */}
          {!isClosed && (
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="font-semibold text-foreground mb-4">Ubah Status</h2>
              <div className="space-y-2">
                {["UnderReview", "WaitingForEvidence"].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={dispute.status === status}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition ${
                      dispute.status === status
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-card border border-border hover:border-primary"
                    }`}
                  >
                    {getStatusLabel(status)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Admin Actions */}
          {!isClosed && (
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="font-semibold text-foreground mb-4">Keputusan Admin</h2>
              <div className="space-y-3">
                <button
                  onClick={() => handleAction("continue")}
                  className="w-full py-3 px-4 rounded-lg bg-blue-600 text-white font-medium hover:opacity-90 transition"
                >
                  🔄 Lanjutkan Transaksi
                </button>
                <button
                  onClick={() => handleAction("force-release")}
                  className="w-full py-3 px-4 rounded-lg bg-green-600 text-white font-medium hover:opacity-90 transition"
                >
                  💰 Lepaskan ke Penjual
                </button>
                <button
                  onClick={() => handleAction("refund")}
                  className="w-full py-3 px-4 rounded-lg bg-amber-600 text-white font-medium hover:opacity-90 transition"
                >
                  ↩️ Kembalikan ke Pembeli
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                ⚠️ Keputusan tidak dapat dibatalkan. Pastikan Anda telah meninjau semua bukti.
              </p>
            </div>
          )}

          {/* Resolution */}
          {dispute.resolution && (
            <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-6">
              <h2 className="font-semibold text-green-600 mb-4">✅ Keputusan</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipe:</span>
                  <div className="font-medium text-foreground">
                    {dispute.resolution.type === "FullRefundToSender" && "Refund ke Pembeli"}
                    {dispute.resolution.type === "FullReleaseToReceiver" && "Release ke Penjual"}
                    {dispute.resolution.type === "Split" && "Dibagi"}
                    {dispute.resolution.type === "NoAction" && "Transaksi Dilanjutkan"}
                  </div>
                </div>
                {dispute.resolution.refundToSender > 0 && (
                  <div>
                    <span className="text-muted-foreground">Ke Pembeli:</span>
                    <div className="font-medium text-foreground">Rp {formatAmount(dispute.resolution.refundToSender)}</div>
                  </div>
                )}
                {dispute.resolution.releaseToReceiver > 0 && (
                  <div>
                    <span className="text-muted-foreground">Ke Penjual:</span>
                    <div className="font-medium text-foreground">Rp {formatAmount(dispute.resolution.releaseToReceiver)}</div>
                  </div>
                )}
                {dispute.resolution.note && (
                  <div>
                    <span className="text-muted-foreground">Catatan:</span>
                    <div className="text-foreground">{dispute.resolution.note}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="col-span-2">
          <div className="bg-card rounded-lg border border-border overflow-hidden h-full flex flex-col">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Diskusi Mediasi</h3>
              <p className="text-xs text-muted-foreground">Chat antara pembeli, penjual, dan admin</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50" style={{ minHeight: "400px", maxHeight: "500px" }}>
              {dispute.messages?.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="text-4xl mb-2">💬</div>
                  <p>Belum ada pesan dalam dispute ini.</p>
                </div>
              )}

              {dispute.messages?.map((msg) => {
                const isAdmin = msg.isAdmin;
                const isBuyer = msg.senderUsername === dispute.initiatorUsername;

                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-center" : isBuyer ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] ${
                      isAdmin 
                        ? "bg-amber-500/10 border border-amber-500/20 w-full" 
                        : isBuyer 
                          ? "bg-blue-500/10 border border-blue-500/20" 
                          : "bg-green-500/10 border border-green-500/20"
                    } rounded-lg px-4 py-2`}>
                      <div className={`text-xs font-medium mb-1 ${
                        isAdmin ? "text-amber-600" : isBuyer ? "text-blue-600" : "text-green-600"
                      }`}>
                        {isAdmin && "👑 "}
                        @{msg.senderUsername}
                        {isAdmin ? " (Admin)" : isBuyer ? " (Pembeli)" : " (Penjual)"}
                      </div>
                      <p className="text-sm text-foreground">{msg.content}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(msg.sentAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin Message Input */}
            {!isClosed && (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Kirim pesan sebagai admin..."
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="px-6 py-2 rounded-lg bg-amber-600 text-white font-medium transition hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? "..." : "👑 Kirim"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Evidence */}
      {dispute.evidence?.length > 0 && (
        <div className="mt-6 bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold text-foreground mb-4">Bukti yang Dilampirkan</h3>
          <div className="grid grid-cols-4 gap-4">
            {dispute.evidence.map((ev, idx) => (
              <a key={idx} href={ev.url} target="_blank" rel="noopener noreferrer" 
                 className="block rounded-lg border border-border p-3 hover:border-primary transition">
                <div className="text-3xl mb-2">
                  {ev.type === "image" ? "🖼️" : ev.type === "document" ? "📄" : "📸"}
                </div>
                <div className="text-sm font-medium text-foreground truncate">
                  {ev.description || `Bukti ${idx + 1}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(ev.uploadedAt)}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-card p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {pendingAction === "continue" && "🔄 Lanjutkan Transaksi"}
              {pendingAction === "force-release" && "💰 Lepaskan ke Penjual"}
              {pendingAction === "refund" && "↩️ Kembalikan ke Pembeli"}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-4">
              {pendingAction === "continue" && "Transaksi akan dilanjutkan dan mengikuti hold time normal. Dispute akan ditutup."}
              {pendingAction === "force-release" && `Dana Rp ${formatAmount(dispute.amount)} akan langsung dikirim ke penjual @${dispute.respondentUsername}.`}
              {pendingAction === "refund" && `Dana Rp ${formatAmount(dispute.amount)} akan dikembalikan ke pembeli @${dispute.initiatorUsername}.`}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Catatan (opsional)
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Tulis alasan keputusan..."
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={processing}
                className="flex-1 py-2 rounded-lg border border-border font-medium hover:bg-muted transition"
              >
                Batal
              </button>
              <button
                onClick={confirmAction}
                disabled={processing}
                className={`flex-1 py-2 rounded-lg text-white font-medium transition ${
                  pendingAction === "refund" ? "bg-amber-600" :
                  pendingAction === "force-release" ? "bg-green-600" : "bg-blue-600"
                } hover:opacity-90 disabled:opacity-50`}
              >
                {processing ? "Memproses..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
