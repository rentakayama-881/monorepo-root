"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

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
        const res = await fetch(`${getApiBase()}/api/disputes/${disputeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setDispute(await res.json());
        } else {
          setError("Dispute tidak ditemukan");
        }
      } catch (e) {
        setError("Gagal memuat data");
      }
      setLoading(false);
    }

    loadData();
  }, [router, disputeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dispute?.messages]);

  const refreshDispute = async () => {
    const token = getToken();
    const res = await fetch(`${getApiBase()}/api/disputes/${disputeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setDispute(await res.json());
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSendingMessage(true);
    const token = getToken();

    try {
      const res = await fetch(`${getApiBase()}/api/disputes/${disputeId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (res.ok) {
        setMessage("");
        await refreshDispute();
      }
    } catch (e) {
      logger.error("Failed to send message:", e);
    }
    setSendingMessage(false);
  };

  const addEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceDescription.trim()) return;

    setProcessing(true);
    const token = getToken();

    try {
      const res = await fetch(`${getApiBase()}/api/disputes/${disputeId}/evidence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: evidenceDescription.trim(),
          file_url: evidenceUrl.trim() || null,
        }),
      });

      if (res.ok) {
        setEvidenceDescription("");
        setEvidenceUrl("");
        setShowEvidenceForm(false);
        await refreshDispute();
      }
    } catch (e) {
      logger.error("Failed to add evidence:", e);
    }
    setProcessing(false);
  };

  const handleMutualAction = async (action) => {
    setProcessing(true);
    const token = getToken();

    try {
      const url =
        action === "release"
          ? `${getApiBase()}/api/disputes/${disputeId}/mutual-release`
          : `${getApiBase()}/api/disputes/${disputeId}/mutual-refund`;

      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await refreshDispute();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal memproses");
      }
    } catch (e) {
      setError("Terjadi kesalahan");
    }
    setProcessing(false);
  };

  const escalateDispute = async () => {
    setProcessing(true);
    const token = getToken();

    try {
      const url =
        dispute.phase === "negotiation"
          ? `${getApiBase()}/api/disputes/${disputeId}/escalate-evidence`
          : `${getApiBase()}/api/disputes/${disputeId}/escalate-admin`;

      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await refreshDispute();
      }
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
        color: "yellow",
      },
      evidence: {
        title: "Fase Bukti",
        description: "Upload bukti-bukti pendukung klaim Anda.",
        color: "orange",
      },
      admin_review: {
        title: "Review Admin",
        description: "Tim kami sedang meninjau kasus ini.",
        color: "purple",
      },
    };
    return info[phase] || info.negotiation;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
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
  const isSender = currentUser?.id === dispute.transfer?.sender_id;
  const isOpen = dispute.status === "open";

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
                <div className={`rounded-lg bg-${phaseInfo.color}-500/10 border border-${phaseInfo.color}-500/30 p-4`}>
                  <div className={`font-medium text-${phaseInfo.color}-600 mb-1`}>
                    {phaseInfo.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {phaseInfo.description}
                  </div>
                  {dispute.phase_deadline && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Batas waktu: {formatDate(dispute.phase_deadline)}
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
                        className={`flex ${msg.user_id === currentUser?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs rounded-lg p-3 ${
                            msg.is_admin
                              ? "bg-purple-500/10 border border-purple-500/30"
                              : msg.user_id === currentUser?.id
                              ? "bg-primary text-white"
                              : "bg-background border border-border"
                          }`}
                        >
                          <div className="text-xs font-medium mb-1">
                            {msg.is_admin ? "Admin" : msg.user?.username || "User"}
                          </div>
                          <div className="text-sm">{msg.message}</div>
                          <div className={`text-xs mt-1 ${msg.user_id === currentUser?.id ? "text-white/70" : "text-muted-foreground"}`}>
                            {formatDate(msg.created_at)}
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
                              {ev.user?.username || "User"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(ev.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{ev.description}</p>
                          {ev.file_url && (
                            <a
                              href={ev.file_url}
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
                      Rp {dispute.transfer?.amount?.toLocaleString("id-ID") || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pengirim</span>
                    <span className="font-medium text-foreground">
                      {dispute.transfer?.sender?.username || "User"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Penerima</span>
                    <span className="font-medium text-foreground">
                      {dispute.transfer?.receiver?.username || "User"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isOpen && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold text-foreground mb-4">Aksi</h3>
                  <div className="space-y-3">
                    {/* Mutual Resolution */}
                    <button
                      onClick={() => handleMutualAction("release")}
                      disabled={processing}
                      className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isSender ? "Setuju Rilis ke Penerima" : "Terima Dana"}
                    </button>
                    <button
                      onClick={() => handleMutualAction("refund")}
                      disabled={processing}
                      className="w-full rounded-lg border border-border py-2 text-sm font-medium transition hover:bg-background disabled:opacity-50"
                    >
                      {isSender ? "Tarik Kembali Dana" : "Setuju Refund ke Pengirim"}
                    </button>

                    {/* Escalate */}
                    {dispute.phase !== "admin_review" && (
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
                      {dispute.resolution === "refund" ? "Refund ke Pengirim" : "Rilis ke Penerima"}
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
