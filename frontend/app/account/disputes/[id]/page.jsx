"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

export default function DisputeCenterPage() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesEndRef = useRef(null);

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load dispute data
  const loadDispute = async () => {
    try {
      const data = await fetchFeatureAuth(`/api/v1/disputes/${disputeId}`);
      setDispute(data.data || data);
    } catch (e) {
      logger.error("Failed to load dispute:", e);
      setError("Dispute tidak ditemukan atau Anda tidak memiliki akses");
    }
    setLoading(false);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    // Get user ID from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserId(payload.user_id);
    } catch (e) {
      logger.error("Failed to parse token:", e);
    }

    loadDispute();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadDispute, 5000);
    return () => clearInterval(interval);
  }, [router, disputeId]);

  useEffect(() => {
    scrollToBottom();
  }, [dispute?.messages]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError("");

    try {
      await fetchFeatureAuth(`/api/v1/disputes/${disputeId}/messages`, {
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

  // Format date
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

  // Format amount
  const formatAmount = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "bg-yellow-500/10 text-yellow-600";
      case "UnderReview": return "bg-blue-500/10 text-blue-600";
      case "WaitingForEvidence": return "bg-orange-500/10 text-orange-600";
      case "Resolved": return "bg-green-500/10 text-green-600";
      case "Cancelled": return "bg-gray-500/10 text-gray-600";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case "Open": return "Menunggu Review";
      case "UnderReview": return "Sedang Ditinjau";
      case "WaitingForEvidence": return "Butuh Bukti Tambahan";
      case "Resolved": return "Selesai";
      case "Cancelled": return "Dibatalkan";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !dispute) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-card rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-foreground mb-2">Tidak Dapat Mengakses Dispute</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link href="/account/wallet/transactions" className="text-primary hover:underline">
              ← Kembali ke Transaksi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isInitiator = dispute?.initiatorId === parseInt(currentUserId);
  const isClosed = dispute?.status === "Resolved" || dispute?.status === "Cancelled";

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link href="/account/wallet/transactions" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Transaksi
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">Pusat Mediasi</h1>
          <p className="text-muted-foreground">Selesaikan masalah transaksi Anda bersama tim mediasi</p>
        </div>

        {/* Dispute Info Card */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dispute?.status)}`}>
                  {getStatusLabel(dispute?.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  #{disputeId?.slice(-8)}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Masalah: {dispute?.category === "ItemNotReceived" ? "Barang Tidak Diterima" :
                         dispute?.category === "ItemNotAsDescribed" ? "Tidak Sesuai Deskripsi" :
                         dispute?.category === "Fraud" ? "Dugaan Penipuan" :
                         dispute?.category === "SellerNotResponding" ? "Penjual Tidak Merespons" : "Lainnya"}
              </h2>
              <p className="text-sm text-muted-foreground">{dispute?.reason}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                Rp {formatAmount(dispute?.amount || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Dana dalam escrow
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Pembeli (Pengirim Dana)</div>
              <div className="font-medium text-foreground">
                @{isInitiator ? dispute?.initiatorUsername : dispute?.respondentUsername}
                {isInitiator ? " (Anda)" : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1">Penjual (Penerima Dana)</div>
              <div className="font-medium text-foreground">
                @{isInitiator ? dispute?.respondentUsername : dispute?.initiatorUsername}
                {!isInitiator ? " (Anda)" : ""}
              </div>
            </div>
          </div>

          {/* Resolution */}
          {dispute?.resolution && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="bg-green-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 font-medium mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Keputusan Admin
                </div>
                <p className="text-sm text-foreground">
                  {dispute.resolution.type === "FullRefundToSender" && `Dana Rp ${formatAmount(dispute.resolution.refundToSender)} dikembalikan ke pembeli.`}
                  {dispute.resolution.type === "FullReleaseToReceiver" && `Dana Rp ${formatAmount(dispute.resolution.releaseToReceiver)} dilepaskan ke penjual.`}
                  {dispute.resolution.type === "Split" && `Dana dibagi: Rp ${formatAmount(dispute.resolution.refundToSender)} ke pembeli, Rp ${formatAmount(dispute.resolution.releaseToReceiver)} ke penjual.`}
                  {dispute.resolution.type === "NoAction" && "Transaksi dilanjutkan mengikuti hold time normal."}
                </p>
                {dispute.resolution.note && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Catatan: {dispute.resolution.note}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Diskusi Mediasi</h3>
            <p className="text-xs text-muted-foreground">Komunikasikan masalah Anda dengan pihak lain dan tim admin</p>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-background/50">
            {dispute?.messages?.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">💬</div>
                <p>Belum ada pesan. Mulai diskusi untuk menyelesaikan masalah.</p>
              </div>
            )}

            {dispute?.messages?.map((msg) => {
              const isMe = msg.senderId === parseInt(currentUserId);
              const isAdmin = msg.isAdmin;

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${
                    isAdmin 
                      ? "bg-amber-500/10 border border-amber-500/20" 
                      : isMe 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-card border border-border"
                  } rounded-lg px-4 py-2`}>
                    <div className={`text-xs font-medium mb-1 ${
                      isAdmin ? "text-amber-600" : isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      {isAdmin && "👑 "}
                      @{msg.senderUsername}
                      {isAdmin && " (Admin)"}
                    </div>
                    <p className={`text-sm ${isMe && !isAdmin ? "text-primary-foreground" : "text-foreground"}`}>
                      {msg.content}
                    </p>
                    <div className={`text-xs mt-1 ${
                      isMe && !isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}>
                      {formatDate(msg.sentAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {!isClosed ? (
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
              {error && <p className="text-sm text-destructive mb-2">{error}</p>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ketik pesan Anda..."
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium transition hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? "..." : "Kirim"}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 border-t border-border bg-muted/30 text-center text-sm text-muted-foreground">
              Dispute ini sudah ditutup. Tidak bisa mengirim pesan lagi.
            </div>
          )}
        </div>

        {/* Evidence Section */}
        {dispute?.evidence?.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 mt-6">
            <h3 className="font-semibold text-foreground mb-4">Bukti yang Dilampirkan</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>
    </div>
  );
}
