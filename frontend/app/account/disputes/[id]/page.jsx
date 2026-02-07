"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
  extractFeatureItems,
} from "@/lib/featureApi";
import { fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

function normalizeCurrentUser(payload) {
  return {
    id: Number(payload?.id ?? payload?.user_id ?? payload?.userId ?? 0) || 0,
    username: payload?.username ?? payload?.Username ?? "",
  };
}

function normalizeResolution(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    const normalized = payload.toLowerCase();
    if (normalized === "refund") {
      return { type: "FullRefundToSender", refundToSender: 0, releaseToReceiver: 0, note: "" };
    }
    if (normalized === "release") {
      return { type: "FullReleaseToReceiver", refundToSender: 0, releaseToReceiver: 0, note: "" };
    }
    return { type: payload, refundToSender: 0, releaseToReceiver: 0, note: "" };
  }
  return {
    type: payload?.type ?? payload?.Type ?? "",
    refundToSender: Number(payload?.refundToSender ?? payload?.RefundToSender ?? 0) || 0,
    releaseToReceiver:
      Number(payload?.releaseToReceiver ?? payload?.ReleaseToReceiver ?? 0) || 0,
    note: payload?.note ?? payload?.Note ?? "",
  };
}

function normalizeDisputeMessage(message) {
  return {
    id: message?.id ?? message?.Id ?? "",
    senderId: Number(message?.senderId ?? message?.SenderId ?? 0) || 0,
    senderUsername: message?.senderUsername ?? message?.SenderUsername ?? "User",
    isAdmin: Boolean(message?.isAdmin ?? message?.IsAdmin ?? false),
    content: message?.content ?? message?.Content ?? message?.message ?? "",
    sentAt:
      message?.sentAt ??
      message?.SentAt ??
      message?.createdAt ??
      message?.CreatedAt ??
      message?.sent_at ??
      null,
  };
}

function normalizeDisputeEvidence(evidence) {
  const typeRaw = evidence?.type ?? evidence?.Type ?? "other";
  return {
    id: evidence?.id ?? evidence?.Id ?? "",
    url: evidence?.url ?? evidence?.Url ?? evidence?.fileUrl ?? evidence?.FileUrl ?? "",
    type: String(typeRaw).toLowerCase(),
    description: evidence?.description ?? evidence?.Description ?? "",
    uploadedAt:
      evidence?.uploadedAt ??
      evidence?.UploadedAt ??
      evidence?.createdAt ??
      evidence?.CreatedAt ??
      null,
  };
}

function normalizeDispute(payload) {
  const data = unwrapFeatureData(payload) || {};
  return {
    id: data?.id ?? data?.Id ?? "",
    status: data?.status ?? data?.Status ?? "Open",
    category: data?.category ?? data?.Category ?? "Other",
    reason: data?.reason ?? data?.Reason ?? "",
    amount: Number(data?.amount ?? data?.Amount ?? 0) || 0,
    initiatorId: Number(data?.initiatorId ?? data?.InitiatorId ?? 0) || 0,
    respondentId: Number(data?.respondentId ?? data?.RespondentId ?? 0) || 0,
    initiatorUsername: data?.initiatorUsername ?? data?.InitiatorUsername ?? "Unknown",
    respondentUsername: data?.respondentUsername ?? data?.RespondentUsername ?? "Unknown",
    resolution: normalizeResolution(data?.resolution ?? data?.Resolution ?? null),
    messages: extractFeatureItems(data?.messages ?? data?.Messages).map(normalizeDisputeMessage),
    evidence: extractFeatureItems(data?.evidence ?? data?.Evidence).map(normalizeDisputeEvidence),
  };
}

export default function DisputeCenterPage() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesContainerRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const lastMessageSignatureRef = useRef("");

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(0);

  const getLastMessageSignature = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return "";
    const lastMessage = messages[messages.length - 1];
    return `${lastMessage?.id ?? ""}-${lastMessage?.sentAt ?? ""}-${messages.length}`;
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= 96;
  };

  // Scroll only inside the message container to prevent viewport jump.
  const scrollToBottom = (behavior = "auto") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const handleMessagesScroll = () => {
    autoScrollEnabledRef.current = isNearBottom();
  };

  // Load dispute data
  const loadDispute = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.DETAIL(disputeId));
      setDispute(normalizeDispute(response));
    } catch (e) {
      logger.error("Failed to load dispute:", e);
      setError("Dispute tidak ditemukan atau Anda tidak memiliki akses");
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let interval;

    async function initialize() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const user = normalizeCurrentUser(await fetchJsonAuth("/api/user/me"));
        if (isMounted) {
          setCurrentUserId(user.id);
        }
      } catch (e) {
        logger.error("Failed to load current user:", e);
      }

      await loadDispute(true);

      interval = setInterval(() => {
        loadDispute(false);
      }, 5000);
    }

    initialize();

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [router, disputeId]);

  useEffect(() => {
    const messages = dispute?.messages ?? [];
    const signature = getLastMessageSignature(messages);

    if (!signature) {
      lastMessageSignatureRef.current = "";
      return;
    }

    const isInitialBatch = !lastMessageSignatureRef.current;
    const hasNewMessages = signature !== lastMessageSignatureRef.current;

    if (!hasNewMessages) {
      return;
    }

    lastMessageSignatureRef.current = signature;

    if (isInitialBatch || autoScrollEnabledRef.current) {
      scrollToBottom(isInitialBatch ? "auto" : "smooth");
    }
  }, [dispute?.messages]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError("");
    autoScrollEnabledRef.current = true;

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.MESSAGES(disputeId), {
        method: "POST",
        body: JSON.stringify({ content: message.trim() }),
      });
      setMessage("");
      await loadDispute(false);
    } catch (e) {
      logger.error("Failed to send message:", e);
      setError("Gagal mengirim pesan");
    }
    setSending(false);
  };

  // Format date
  const formatDate = (dateStr) => {
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
  };

  // Format amount
  const formatAmount = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount);
  };

  // Get status color
  const normalizeStatus = (status) => String(status || "").replace(/\s+/g, "").toLowerCase();

  const getStatusColor = (status) => {
    switch (normalizeStatus(status)) {
      case "open":
        return "border-warning/20 bg-warning/10 text-warning";
      case "underreview":
        return "border-primary/20 bg-primary/10 text-primary";
      case "waitingforevidence":
        return "border-border bg-accent text-accent-foreground";
      case "resolved":
        return "border-success/20 bg-success/10 text-success";
      case "cancelled":
        return "border-border bg-muted/60 text-muted-foreground";
      default:
        return "border-border bg-muted/60 text-muted-foreground";
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (normalizeStatus(status)) {
      case "open":
        return "Menunggu Review";
      case "underreview":
        return "Sedang Ditinjau";
      case "waitingforevidence":
        return "Butuh Bukti Tambahan";
      case "resolved":
        return "Selesai";
      case "cancelled":
        return "Dibatalkan";
      default:
        return status;
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

  const isInitiator = Number(dispute?.initiatorId) === Number(currentUserId);
  const status = normalizeStatus(dispute?.status);
  const isClosed = status === "resolved" || status === "cancelled";

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
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(dispute?.status)}`}>
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
              <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                <div className="flex items-center gap-2 text-success font-medium mb-2">
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
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="h-96 overflow-y-auto p-4 space-y-4 bg-background/50"
          >
            {dispute?.messages?.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">💬</div>
                <p>Belum ada pesan. Mulai diskusi untuk menyelesaikan masalah.</p>
              </div>
            )}

            {dispute?.messages?.map((msg) => {
              const isMe = Number(msg.senderId) === Number(currentUserId);
              const isAdmin = msg.isAdmin;

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${
                    isAdmin 
                      ? "bg-warning/10 border border-warning/20" 
                      : isMe 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-card border border-border"
                  } rounded-lg px-4 py-2`}>
                    <div className={`text-xs font-medium mb-1 ${
                      isAdmin ? "text-warning" : isMe ? "text-primary-foreground/80" : "text-muted-foreground"
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
