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

function normalizeDisputeMessage(message) {
  return {
    id: message?.id ?? message?.Id ?? "",
    senderId: Number(message?.senderId ?? message?.SenderId ?? 0) || 0,
    senderUsername: message?.senderUsername ?? message?.SenderUsername ?? "User",
    isAdmin: Boolean(message?.isAdmin ?? message?.IsAdmin ?? false),
    content: message?.content ?? message?.Content ?? message?.message ?? "",
    createdAt:
      message?.createdAt ?? message?.CreatedAt ?? message?.created_at ?? null,
  };
}

function normalizeDisputeEvidence(evidence) {
  return {
    id: evidence?.id ?? evidence?.Id ?? "",
    description: evidence?.description ?? evidence?.Description ?? "",
    fileUrl: evidence?.fileUrl ?? evidence?.FileUrl ?? evidence?.file_url ?? "",
    createdAt:
      evidence?.createdAt ?? evidence?.CreatedAt ?? evidence?.created_at ?? null,
    username:
      evidence?.user?.username ??
      evidence?.user?.Username ??
      evidence?.username ??
      evidence?.Username ??
      "User",
  };
}

function normalizeDispute(payload) {
  const data = unwrapFeatureData(payload) || {};
  const statusRaw = data?.status ?? data?.Status ?? "open";
  const phaseRaw = data?.phase ?? data?.Phase ?? "negotiation";
  const resolutionRaw = data?.resolution ?? data?.Resolution ?? null;
  const normalizedResolution =
    typeof resolutionRaw === "string"
      ? resolutionRaw.toLowerCase()
      : String(
          resolutionRaw?.type ??
            resolutionRaw?.Type ??
            resolutionRaw?.decision ??
            resolutionRaw?.Decision ??
            ""
        ).toLowerCase();

  const phaseMap = {
    negotiation: "negotiation",
    evidence: "evidence",
    adminreview: "admin_review",
    admin_review: "admin_review",
    underreview: "admin_review",
    under_review: "admin_review",
  };

  return {
    id: data?.id ?? data?.Id ?? "",
    status: String(statusRaw).toLowerCase(),
    phase: phaseMap[String(phaseRaw).replace(/\s+/g, "").toLowerCase()] ?? "negotiation",
    phaseDeadline:
      data?.phaseDeadline ?? data?.PhaseDeadline ?? data?.phase_deadline ?? null,
    amount: Number(data?.amount ?? data?.Amount ?? 0) || 0,
    senderId: Number(data?.senderId ?? data?.SenderId ?? 0) || 0,
    receiverId: Number(data?.receiverId ?? data?.ReceiverId ?? 0) || 0,
    senderUsername: data?.senderUsername ?? data?.SenderUsername ?? "Unknown",
    receiverUsername: data?.receiverUsername ?? data?.ReceiverUsername ?? "Unknown",
    resolution: normalizedResolution,
    adminNotes:
      data?.adminNotes ?? data?.AdminNotes ?? data?.admin_notes ?? data?.Admin_Note ?? "",
    admin_notes:
      data?.adminNotes ?? data?.AdminNotes ?? data?.admin_notes ?? data?.Admin_Note ?? "",
    messages: extractFeatureItems(data?.messages ?? data?.Messages).map(normalizeDisputeMessage),
    evidence: extractFeatureItems(data?.evidence ?? data?.Evidence).map(normalizeDisputeEvidence),
  };
}

export default function DisputeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const disputeId = params.id;
  const messagesEndRef = useRef(null);

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");

  // Message form
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Evidence form
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch current user from API
      try {
        const userData = await fetchJsonAuth("/api/user/me");
        setCurrentUser(normalizeCurrentUser(userData));
      } catch (e) {
        logger.error("Failed to load user:", e);
      }

      try {
        const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.DETAIL(disputeId));
        setDispute(normalizeDispute(response));
      } catch (e) {
        logger.error("Failed to load dispute:", e);
        setError("Dispute tidak ditemukan");
      }
      setLoading(false);
    }

    loadData();
  }, [router, disputeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dispute?.messages]);

  const refreshDispute = async () => {
    try {
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.DETAIL(disputeId));
      setDispute(normalizeDispute(response));
    } catch (e) {
      logger.error("Failed to refresh dispute:", e);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSendingMessage(true);

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.MESSAGES(disputeId), {
        method: "POST",
        body: JSON.stringify({ content: message.trim() }),
      });

      setMessage("");
      await refreshDispute();
    } catch (e) {
      logger.error("Failed to send message:", e);
    }
    setSendingMessage(false);
  };

  const addEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceDescription.trim()) return;

    setProcessing(true);

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.EVIDENCE(disputeId), {
        method: "POST",
        body: JSON.stringify({
          description: evidenceDescription.trim(),
          fileUrl: evidenceUrl.trim() || null,
        }),
      });

      setEvidenceDescription("");
      setEvidenceUrl("");
      setShowEvidenceForm(false);
      await refreshDispute();
    } catch (e) {
      logger.error("Failed to add evidence:", e);
    }
    setProcessing(false);
  };

  const handleMutualAction = async (action) => {
    setProcessing(true);

    try {
      const endpoint = action === "release"
        ? `/api/v1/disputes/${disputeId}/mutual-release`
        : `/api/v1/disputes/${disputeId}/mutual-refund`;

      await fetchFeatureAuth(endpoint, { method: "POST" });
      await refreshDispute();
    } catch (e) {
      setError(e.message || "Terjadi kesalahan");
    }
    setProcessing(false);
  };

  const escalateDispute = async () => {
    setProcessing(true);

    try {
      const endpoint = dispute.phase === "negotiation"
        ? `/api/v1/disputes/${disputeId}/escalate-evidence`
        : `/api/v1/disputes/${disputeId}/escalate-admin`;

      await fetchFeatureAuth(endpoint, { method: "POST" });
      await refreshDispute();
    } catch (e) {
      logger.error("Failed to escalate:", e);
    }
    setProcessing(false);
  };

  const getPhaseInfo = (phase) => {
    const info = {
      negotiation: {
        title: "Fase Negosiasi",
        description: "Diskusikan dengan pihak lain untuk menemukan solusi.",
        containerClass: "bg-yellow-500/10 border border-yellow-500/30",
        titleClass: "text-yellow-600",
      },
      evidence: {
        title: "Fase Bukti",
        description: "Upload bukti-bukti pendukung klaim Anda.",
        containerClass: "bg-orange-500/10 border border-orange-500/30",
        titleClass: "text-orange-600",
      },
      admin_review: {
        title: "Review Admin",
        description: "Tim kami sedang meninjau kasus ini.",
        containerClass: "bg-purple-500/10 border border-purple-500/30",
        titleClass: "text-purple-600",
      },
    };
    return info[phase] || info.negotiation;
  };

  const getResolutionLabel = (resolution) => {
    const value = String(resolution || "").replace(/\s+/g, "").toLowerCase();
    if (!value) return "Selesai";
    if (value.includes("split")) return "Dana Dibagi";
    if (value.includes("refund")) return "Refund ke Pengirim";
    if (value.includes("release")) return "Rilis ke Penerima";
    if (value.includes("noaction")) return "Tidak Ada Aksi";
    return resolution;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center text-muted-foreground">
          Memuat...
        </div>
      </main>
    );
  }

  if (!dispute) {
    return (
      <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="text-destructive mb-4">{error || "Dispute tidak ditemukan"}</div>
          <Link href="/account/wallet/disputes" className="text-primary hover:underline">
            ← Kembali
          </Link>
        </div>
      </main>
    );
  }

  const phaseInfo = getPhaseInfo(dispute.phase);
  // Use senderId/receiverId from transfer, NOT initiatorId
  // This ensures logic is based on who SENT money, not who opened dispute
  const isSender = currentUser?.id === dispute.senderId || currentUser?.username === dispute.senderUsername;
  const isReceiver = currentUser?.id === dispute.receiverId || currentUser?.username === dispute.receiverUsername;
  const isOpen = dispute.status?.toLowerCase() === "open";

  return (
    <main className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link
            href="/account/wallet/disputes"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </Link>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Phase Info */}
              {isOpen && (
                <div className={`rounded-lg p-4 ${phaseInfo.containerClass}`}>
                  <div className={`font-medium mb-1 ${phaseInfo.titleClass}`}>
                    {phaseInfo.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {phaseInfo.description}
                  </div>
                  {dispute.phaseDeadline && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Batas waktu: {formatDate(dispute.phaseDeadline)}
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold text-foreground">Diskusi</h3>
                </div>
                <div className="h-80 overflow-y-auto p-4 space-y-4">
                  {dispute.messages?.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Belum ada pesan
                    </div>
                  ) : (
                    dispute.messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderId === currentUser?.id ||
                          msg.senderUsername === currentUser?.username
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs rounded-lg p-3 ${
                            msg.isAdmin
                              ? "bg-purple-500/10 border border-purple-500/30"
                              : msg.senderId === currentUser?.id || msg.senderUsername === currentUser?.username
                              ? "bg-primary text-white"
                              : "bg-background border border-border"
                          }`}
                        >
                          <div className="text-xs font-medium mb-1">
                            {msg.isAdmin ? "Admin" : msg.senderUsername || "User"}
                          </div>
                          <div className="text-sm">{msg.content}</div>
                          <div
                            className={`text-xs mt-1 ${
                              msg.senderId === currentUser?.id ||
                              msg.senderUsername === currentUser?.username
                                ? "text-white/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatDate(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                {isOpen && (
                  <form onSubmit={sendMessage} className="border-t border-border p-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tulis pesan..."
                        className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 focus:outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !message.trim()}
                        className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        Kirim
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Evidence Section */}
              {(dispute.phase === "evidence" || dispute.phase === "admin_review") && (
                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border p-4 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Bukti</h3>
                    {isOpen && dispute.phase === "evidence" && (
                      <button
                        onClick={() => setShowEvidenceForm(!showEvidenceForm)}
                        className="text-sm text-primary hover:underline"
                      >
                        + Tambah Bukti
                      </button>
                    )}
                  </div>

                  {/* Add Evidence Form */}
                  {showEvidenceForm && (
                    <form onSubmit={addEvidence} className="border-b border-border p-4 space-y-3">
                      <textarea
                        value={evidenceDescription}
                        onChange={(e) => setEvidenceDescription(e.target.value)}
                        placeholder="Jelaskan bukti Anda..."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-transparent px-4 py-2 focus:outline-none focus:border-primary"
                      />
                      <input
                        type="url"
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        placeholder="URL file bukti (opsional)"
                        className="w-full rounded-lg border border-border bg-transparent px-4 py-2 focus:outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowEvidenceForm(false)}
                          className="px-4 py-2 text-sm"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={processing || !evidenceDescription.trim()}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Kirim Bukti
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="p-4 space-y-3">
                    {dispute.evidence?.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                        Belum ada bukti
                      </div>
                    ) : (
                      dispute.evidence?.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-lg bg-background border border-border p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-foreground">
                              {ev.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(ev.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{ev.description}</p>
                          {ev.fileUrl && (
                            <a
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              Lihat Lampiran
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Transfer Info */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground mb-4">Detail Transfer</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jumlah</span>
                    <span className="font-medium text-foreground">
                      Rp {dispute.amount?.toLocaleString("id-ID") || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pembeli (Pengirim Dana)</span>
                    <span className="font-medium text-foreground">
                      @{dispute.senderUsername}{isSender && " (Anda)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Penjual (Penerima Dana)</span>
                    <span className="font-medium text-foreground">
                      @{dispute.receiverUsername}{isReceiver && " (Anda)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isOpen && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold text-foreground mb-4">Aksi</h3>
                  <div className="space-y-3">
                    {/* Refund - Only receiver (penjual) can agree to refund */}
                    {isReceiver ? (
                      <button
                        onClick={() => handleMutualAction("refund")}
                        disabled={processing}
                        className="w-full rounded-lg border border-border py-2 text-sm font-medium transition hover:bg-background disabled:opacity-50"
                      >
                        Setuju Refund ke Pengirim
                      </button>
                    ) : (
                      <div className="text-xs text-muted-foreground bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                        <p className="font-medium text-yellow-600 mb-1">Menunggu Respon</p>
                        <p>Anda telah membuka dispute. Tunggu respon dari penerima atau eskalasi ke admin jika diperlukan.</p>
                      </div>
                    )}

                    {/* Info for receiver about defense */}
                    {isReceiver && (
                      <div className="text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                        <p className="font-medium text-blue-600 mb-1">Info</p>
                        <p>Jika Anda ingin melanjutkan transaksi, sampaikan pembelaan Anda di chat. Admin akan memutuskan berdasarkan diskusi.</p>
                      </div>
                    )}

                    {/* Escalate - only for sender (who opened dispute) */}
                    {isSender && dispute.phase !== "admin_review" && (
                      <button
                        onClick={escalateDispute}
                        disabled={processing}
                        className="w-full rounded-lg border border-orange-500/30 py-2 text-sm font-medium text-orange-600 transition hover:bg-orange-500/10 disabled:opacity-50"
                      >
                        {dispute.phase === "negotiation"
                          ? "Eskalasi ke Fase Bukti"
                          : "Eskalasi ke Admin"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Resolution Result */}
              {dispute.status === "resolved" && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h3 className="font-semibold text-emerald-600 mb-2">Dispute Selesai</h3>
                  <p className="text-sm text-muted-foreground">
                    Hasil: <strong className="text-foreground">
                      {getResolutionLabel(dispute.resolution)}
                    </strong>
                  </p>
                  {dispute.admin_notes && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Catatan: {dispute.admin_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
  );
}
