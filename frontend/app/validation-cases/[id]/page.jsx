"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import { TagList } from "@/components/ui/TagPill";
import { fetchJson, fetchJsonAuth, getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { useUploadDocument } from "@/lib/useDocuments";

function formatDateTime(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIDR(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "-";
  return `Rp ${Math.max(0, Math.trunc(n)).toLocaleString("id-ID")}`;
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().trim();
}

function contentAsText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content);
}

function CaseSection({ title, subtitle, children }) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {subtitle || "Section"}
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function ValidationCaseRecordPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const isAuthed = useMemo(() => {
    try {
      return !!getToken();
    } catch {
      return false;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vc, setVc] = useState(null);
  const [me, setMe] = useState(null);

  // Workflow state
  const [consultationRequests, setConsultationRequests] = useState([]);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationMsg, setConsultationMsg] = useState("");

  const [contactTelegram, setContactTelegram] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const [finalOffers, setFinalOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersMsg, setOffersMsg] = useState("");
  const [offerForm, setOfferForm] = useState({ amount: "", hold_days: 7, terms: "" });

  const [escrowDraft, setEscrowDraft] = useState(null);
  const [lockFundsPin, setLockFundsPin] = useState("");
  const [lockFundsLoading, setLockFundsLoading] = useState(false);
  const [lockFundsMsg, setLockFundsMsg] = useState("");

  const { uploadDocument, loading: uploadLoading } = useUploadDocument();
  const [artifactFile, setArtifactFile] = useState(null);
  const [artifactMsg, setArtifactMsg] = useState("");

  const [releasePin, setReleasePin] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState("");

  const [disputeForm, setDisputeForm] = useState({ category: "ItemNotAsDescribed", reason: "" });
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState("");

  const [caseLog, setCaseLog] = useState([]);
  const [caseLogLoading, setCaseLogLoading] = useState(false);

  const isOwner = Boolean(me?.id && vc?.owner?.id && Number(me.id) === Number(vc.owner.id));

  async function reloadCase() {
    setError("");
    setLoading(true);
    try {
      const data = await fetchJson(`/api/validation-cases/${encodeURIComponent(String(id))}/public`, {
        method: "GET",
        cache: "no-store",
      });
      setVc(data);
    } catch (e) {
      setError(e?.message || "Gagal memuat Validation Case Record");
      setVc(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMeIfAuthed() {
    if (!isAuthed) {
      setMe(null);
      return;
    }
    try {
      const data = await fetchJsonAuth("/api/user/me", { method: "GET" });
      setMe(data);
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    if (!id || id === "undefined") return;
    loadMeIfAuthed();
    reloadCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadOwnerWorkflow() {
    if (!isAuthed || !id) return;
    if (!isOwner) return;

    setConsultationLoading(true);
    setOffersLoading(true);
    setCaseLogLoading(true);
    setConsultationMsg("");
    setOffersMsg("");
    setLockFundsMsg("");

    try {
      const [reqs, offers, log] = await Promise.all([
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests`, { method: "GET" }),
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, { method: "GET" }),
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/case-log`, { method: "GET" }),
      ]);

      setConsultationRequests(Array.isArray(reqs?.consultation_requests) ? reqs.consultation_requests : []);
      setFinalOffers(Array.isArray(offers?.final_offers) ? offers.final_offers : []);
      setCaseLog(Array.isArray(log?.case_log) ? log.case_log : []);

      // Re-derive draft if the page is reloaded after accept.
      const acceptedId = vc?.accepted_final_offer_id ?? vc?.acceptedFinalOfferId ?? null;
      const resolvedAcceptedId = acceptedId != null ? Number(acceptedId) : null;
      const resolvedOffers = Array.isArray(offers?.final_offers) ? offers.final_offers : [];
      if (!escrowDraft && resolvedAcceptedId && resolvedOffers.length > 0) {
        const accepted = resolvedOffers.find((o) => Number(o?.id) === resolvedAcceptedId) || null;
        if (accepted?.validator?.username && accepted?.amount) {
          setEscrowDraft({
            receiver_username: accepted.validator.username,
            amount: accepted.amount,
            hold_hours: Number(accepted.hold_hours) || 168,
            message: `Lock Funds: Validation Case #${String(id)}`,
          });
        }
      }
    } catch (e) {
      // Individual fetch errors are surfaced via actions; keep the page readable.
    } finally {
      setConsultationLoading(false);
      setOffersLoading(false);
      setCaseLogLoading(false);
    }
  }

  async function loadNonOwnerWorkflow() {
    if (!isAuthed || !id) return;
    if (isOwner) return;

    setOffersLoading(true);
    setCaseLogLoading(true);
    setOffersMsg("");

    try {
      const [offers, log] = await Promise.all([
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, { method: "GET" }),
        // Case Log is only visible to owner or approved validators; best-effort.
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/case-log`, { method: "GET" }).catch(() => null),
      ]);
      setFinalOffers(Array.isArray(offers?.final_offers) ? offers.final_offers : []);
      setCaseLog(Array.isArray(log?.case_log) ? log.case_log : []);
    } finally {
      setOffersLoading(false);
      setCaseLogLoading(false);
    }
  }

  useEffect(() => {
    if (!vc || !me) return;
    if (!isAuthed) return;
    if (isOwner) {
      loadOwnerWorkflow();
    } else {
      loadNonOwnerWorkflow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vc?.id, me?.id, isAuthed, isOwner]);

  async function requestConsultation() {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    setConsultationMsg("");
    try {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setConsultationMsg("Request Consultation tercatat. Menunggu persetujuan pemilik kasus.");
    } catch (e) {
      setConsultationMsg(e?.message || "Gagal Request Consultation");
    }
  }

  async function approveConsultation(requestId) {
    setConsultationMsg("");
    try {
      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests/${encodeURIComponent(String(requestId))}/approve`,
        { method: "POST" }
      );
      setConsultationMsg("Permintaan konsultasi disetujui.");
      await loadOwnerWorkflow();
    } catch (e) {
      setConsultationMsg(e?.message || "Gagal menyetujui");
    }
  }

  async function rejectConsultation(requestId) {
    const reason = window.prompt("Reason (min 5 karakter):", "");
    if (reason == null) return;
    setConsultationMsg("");
    try {
      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests/${encodeURIComponent(String(requestId))}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      setConsultationMsg("Permintaan konsultasi ditolak.");
      await loadOwnerWorkflow();
    } catch (e) {
      setConsultationMsg(e?.message || "Gagal menolak");
    }
  }

  async function revealContact() {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    setContactMsg("");
    setContactLoading(true);
    try {
      const data = await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/contact`, { method: "GET" });
      const telegram = String(data?.telegram || "").trim();
      if (!telegram) {
        setContactMsg("Kontak tidak tersedia.");
        return;
      }
      setContactTelegram(telegram);
      setContactMsg("Kontak dibuka secara privat dan dicatat pada Case Log.");
    } catch (e) {
      setContactMsg(e?.message || "Gagal membuka kontak");
    } finally {
      setContactLoading(false);
    }
  }

  async function submitFinalOffer() {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    setOffersMsg("");
    const amountNum = Number(String(offerForm.amount).replace(/[^\d]/g, ""));
    const holdDaysNum = Number(offerForm.hold_days || 7);
    const holdHours = Math.max(1, Math.min(30 * 24, Math.trunc(holdDaysNum * 24)));

    if (!amountNum || amountNum < 10000) {
      setOffersMsg("Amount minimal Rp 10.000.");
      return;
    }

    try {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          hold_hours: holdHours,
          terms: offerForm.terms || "",
        }),
      });
      setOffersMsg("Final Offer disubmit.");
      setOfferForm((f) => ({ ...f, terms: "" }));
      await loadNonOwnerWorkflow();
    } catch (e) {
      setOffersMsg(e?.message || "Gagal submit Final Offer");
    }
  }

  async function acceptFinalOffer(offerId) {
    setOffersMsg("");
    try {
      const data = await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/final-offers/${encodeURIComponent(String(offerId))}/accept`,
        { method: "POST" }
      );
      const draft = data?.escrow_draft || null;
      if (draft && typeof draft === "object") {
        setEscrowDraft({
          receiver_username: draft.receiver_username,
          amount: draft.amount,
          hold_hours: draft.hold_hours,
          message: draft.message,
        });
      }
      setOffersMsg("Final Offer diterima. Lanjutkan: Lock Funds.");
      await reloadCase();
      await loadOwnerWorkflow();
    } catch (e) {
      setOffersMsg(e?.message || "Gagal menerima Final Offer");
    }
  }

  async function lockFunds() {
    if (!escrowDraft || !escrowDraft.receiver_username) {
      setLockFundsMsg("Escrow draft tidak tersedia.");
      return;
    }
    if (!lockFundsPin || String(lockFundsPin).trim().length < 6) {
      setLockFundsMsg("PIN wallet wajib diisi (6 digit).");
      return;
    }

    setLockFundsLoading(true);
    setLockFundsMsg("");
    try {
      const created = await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.CREATE, {
        method: "POST",
        body: JSON.stringify({
          receiverUsername: escrowDraft.receiver_username,
          amount: Number(escrowDraft.amount) || 0,
          holdHours: Number(escrowDraft.hold_hours) || 168,
          message: escrowDraft.message || `Lock Funds: Validation Case #${String(id)}`,
          pin: String(lockFundsPin).trim(),
        }),
      });

      const createdData = unwrapFeatureData(created) || {};
      const transferId = createdData.transferId || createdData.TransferId || createdData.id || createdData.Id || "";
      if (!transferId) {
        throw new Error("TransferId tidak ditemukan pada response escrow.");
      }

      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/lock-funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfer_id: transferId }),
      });

      setLockFundsMsg("Lock Funds berhasil. Escrow terpasang pada Validation Case.");
      setLockFundsPin("");
      await reloadCase();
      await loadOwnerWorkflow();
    } catch (e) {
      setLockFundsMsg(e?.message || "Gagal Lock Funds");
    } finally {
      setLockFundsLoading(false);
    }
  }

  async function submitArtifact() {
    if (!artifactFile) {
      setArtifactMsg("Pilih file terlebih dahulu (PDF/DOCX).");
      return;
    }
    setArtifactMsg("");
    try {
      const uploaded = await uploadDocument(artifactFile, {
        title: `Artifact Submission - Validation Case #${String(id)}`,
        description: "Artifact Submission (full work, no watermark).",
        category: "other",
        visibility: "private",
        tags: ["artifact_submission"],
      });

      const documentId = uploaded?.id || uploaded?.Id || uploaded?.documentId || uploaded?.DocumentId || "";
      if (!documentId) {
        throw new Error("Document ID tidak ditemukan dari hasil upload.");
      }

      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/artifact-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });

      setArtifactMsg("Artifact Submission tercatat dan dibagikan ke pemilik kasus.");
      setArtifactFile(null);
      await reloadCase();
      await loadNonOwnerWorkflow();
    } catch (e) {
      setArtifactMsg(e?.message || "Gagal submit Artifact Submission");
    }
  }

  async function approveAndRelease() {
    const transferId = vc?.escrow_transfer_id || vc?.escrowTransferId || "";
    if (!transferId) {
      setReleaseMsg("escrow_transfer_id belum ada.");
      return;
    }
    if (!releasePin || String(releasePin).trim().length < 6) {
      setReleaseMsg("PIN wallet wajib diisi (6 digit).");
      return;
    }

    setReleaseLoading(true);
    setReleaseMsg("");
    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.TRANSFERS.RELEASE(String(transferId)), {
        method: "POST",
        body: JSON.stringify({ pin: String(releasePin).trim() }),
      });

      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/escrow/released`, { method: "POST" });

      setReleaseMsg("Escrow release dikonfirmasi. Certified Artifact diterbitkan.");
      setReleasePin("");
      await reloadCase();
      await loadOwnerWorkflow();
    } catch (e) {
      setReleaseMsg(e?.message || "Gagal release escrow");
    } finally {
      setReleaseLoading(false);
    }
  }

  async function initiateDispute() {
    const transferId = vc?.escrow_transfer_id || vc?.escrowTransferId || "";
    if (!transferId) {
      setDisputeMsg("escrow_transfer_id belum ada.");
      return;
    }
    if (!disputeForm.reason || String(disputeForm.reason).trim().length < 20) {
      setDisputeMsg("Reason minimal 20 karakter.");
      return;
    }

    setDisputeLoading(true);
    setDisputeMsg("");
    try {
      const created = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.CREATE, {
        method: "POST",
        body: JSON.stringify({
          transferId: String(transferId),
          reason: String(disputeForm.reason).trim(),
          category: String(disputeForm.category),
        }),
      });

      const createdData = unwrapFeatureData(created) || {};
      const disputeId = createdData.disputeId || createdData.DisputeId || createdData.dispute_id || "";
      const success = createdData.success ?? createdData.Success;

      if (!disputeId && success === false) {
        throw new Error(createdData.error || createdData.Error || "Gagal membuat dispute");
      }
      if (!disputeId) {
        // Some deployments return { id: ... } instead.
        if (createdData.id) {
          // eslint-disable-next-line no-unused-vars
          const _ = createdData.id;
        } else {
          throw new Error("DisputeId tidak ditemukan pada response.");
        }
      }

      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/dispute/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispute_id: disputeId || createdData.id }),
      });

      setDisputeMsg("Dispute tercatat dan melekat pada Validation Case.");
      setDisputeForm((f) => ({ ...f, reason: "" }));
      await reloadCase();
      await loadOwnerWorkflow();
    } catch (e) {
      setDisputeMsg(e?.message || "Gagal membuat dispute");
    } finally {
      setDisputeLoading(false);
    }
  }

  if (!id || id === "undefined") return null;

  if (loading) {
    return (
      <main className="container py-10">
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          Memuat Validation Case Record...
        </div>
      </main>
    );
  }

  const status = normalizeStatus(vc?.status);
  const owner = vc?.owner || {};
  const ownerBadge = owner?.primary_badge || null;
  const transferId = vc?.escrow_transfer_id || "";
  const disputeId = vc?.dispute_id || "";
  const artifactId = vc?.artifact_document_id || "";
  const certifiedId = vc?.certified_artifact_document_id || "";

  const featureBase = (process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id").replace(/\/+$/, "");
  const artifactDownloadHref = artifactId ? `${featureBase}${FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD(String(artifactId))}` : "";
  const certifiedDownloadHref = certifiedId ? `${featureBase}${FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD(String(certifiedId))}` : "";

  return (
    <main className="container py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/validation-cases" className="hover:underline">
          Validation Case Index
        </Link>
        <span>/</span>
        <span className="font-mono text-xs text-foreground">#{String(id)}</span>
      </nav>

      {error ? (
        <div className="mb-6 rounded-[var(--radius)] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {vc ? (
        <article className="space-y-5">
          <header className="rounded-[var(--radius)] border border-border bg-card px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Validation Case Record
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{vc?.title || "(untitled)"}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground">
                Status: {status || "unknown"}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground">
                Type: {vc?.category?.name || vc?.category?.slug || "-"}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground">
                Bounty: {formatIDR(vc?.bounty_amount)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground">
                <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="xs" />
                <Link href={owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "#"} className="hover:underline">
                  @{owner?.username || "-"}
                </Link>
                {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
              </span>
              <span className="font-mono text-xs">{formatDateTime(vc?.created_at)}</span>
            </div>

            {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
              <div className="mt-4">
                <TagList tags={vc.tags} size="sm" />
              </div>
            ) : null}

            {vc?.summary ? (
              <div className="mt-4 rounded-[var(--radius)] border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
                {vc.summary}
              </div>
            ) : null}
          </header>

          <CaseSection title="Overview" subtitle="Record">
            <div className="prose prose-neutral max-w-none">
              {vc?.content_type === "text" ? (
                <MarkdownPreview content={contentAsText(vc?.content)} />
              ) : (
                <ContentTable content={vc?.content} />
              )}
            </div>
          </CaseSection>

          <CaseSection title="Request Consultation" subtitle="Protocol">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">Rules</div>
                <ul className="mt-2 list-disc pl-5">
                  <li>Request Consultation hanya untuk validator dengan Credibility Stake yang memenuhi syarat.</li>
                  <li>Kontak Telegram dibuka privat setelah persetujuan pemilik kasus dan dicatat pada Case Log.</li>
                  <li>Negosiasi harus ditutup dengan Final Offer di platform sebelum Lock Funds.</li>
                </ul>
              </div>
              <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4">
                {!isAuthed ? (
                  <div className="text-sm text-muted-foreground">
                    Login diperlukan untuk Request Consultation.
                    <div className="mt-3">
                      <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
                        Sign in
                      </Link>
                    </div>
                  </div>
                ) : isOwner ? (
                  <div className="text-sm text-muted-foreground">
                    Anda adalah pemilik Validation Case. Kelola permintaan konsultasi pada section berikutnya.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button onClick={requestConsultation} variant="gradient">
                      Request Consultation
                    </Button>
                    {consultationMsg ? <div className="text-xs text-muted-foreground">{consultationMsg}</div> : null}

                    <div className="h-px bg-border" />

                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Private Contact
                    </div>
                    <Button onClick={revealContact} variant="outline" disabled={contactLoading}>
                      {contactLoading ? "Opening..." : "Reveal Telegram (Private)"}
                    </Button>
                    {contactTelegram ? (
                      <div className="text-sm">
                        <a
                          href={`https://t.me/${String(contactTelegram).replace(/^@/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          {contactTelegram}
                        </a>
                      </div>
                    ) : null}
                    {contactMsg ? <div className="text-xs text-muted-foreground">{contactMsg}</div> : null}
                  </div>
                )}
              </div>
            </div>
          </CaseSection>

          {isAuthed && isOwner ? (
            <CaseSection title="Consultation Requests" subtitle="Owner Review">
              {consultationLoading ? (
                <div className="text-sm text-muted-foreground">Memuat Consultation Requests...</div>
              ) : consultationRequests.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada Request Consultation.</div>
              ) : (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="bg-secondary/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Validator</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Status</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Filed</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {consultationRequests.map((r) => (
                        <tr key={String(r.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar src={r?.validator?.avatar_url} name={r?.validator?.username || ""} size="xs" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={r?.validator?.username ? `/user/${encodeURIComponent(r.validator.username)}` : "#"}
                                    className="truncate font-semibold text-foreground hover:underline"
                                  >
                                    @{r?.validator?.username || "-"}
                                  </Link>
                                  {r?.validator?.primary_badge ? <Badge badge={r.validator.primary_badge} size="xs" /> : null}
                                </div>
                                {Number(r?.validator?.guarantee_amount || 0) > 0 ? (
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    Stake: {formatIDR(r.validator.guarantee_amount)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{String(r.status || "")}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(r.created_at)}</td>
                          <td className="px-4 py-3">
                            {normalizeStatus(r.status) === "pending" ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                  onClick={() => approveConsultation(r.id)}
                                >
                                  Approve
                                </button>
                                <button
                                  className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                  onClick={() => rejectConsultation(r.id)}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {consultationMsg ? <div className="mt-3 text-xs text-muted-foreground">{consultationMsg}</div> : null}
            </CaseSection>
          ) : null}

          <CaseSection title="Final Offer" subtitle="Contract">
            {isAuthed && !isOwner ? (
              <div className="mb-4 rounded-[var(--radius)] border border-border bg-secondary/40 p-4">
                <div className="text-sm font-semibold text-foreground">Submit Final Offer</div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Amount (IDR)</label>
                    <input
                      value={offerForm.amount}
                      onChange={(e) => setOfferForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="e.g. 250000"
                      className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Hold (days)</label>
                    <input
                      value={offerForm.hold_days}
                      onChange={(e) => setOfferForm((f) => ({ ...f, hold_days: e.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      inputMode="numeric"
                    />
                    <div className="mt-1 text-[11px] text-muted-foreground">Max 30 days.</div>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={submitFinalOffer}
                      className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      type="button"
                    >
                      Submit
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold text-muted-foreground">Terms</label>
                  <textarea
                    value={offerForm.terms}
                    onChange={(e) => setOfferForm((f) => ({ ...f, terms: e.target.value }))}
                    rows={4}
                    placeholder="Scope, acceptance criteria, assumptions, excluded items."
                    className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                  />
                </div>
                {offersMsg ? <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div> : null}
              </div>
            ) : null}

            {offersLoading ? (
              <div className="text-sm text-muted-foreground">Memuat Final Offers...</div>
            ) : finalOffers.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada Final Offer.</div>
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
                <table className="min-w-[860px] w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Validator</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Hold</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Status</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Terms</th>
                      {isAuthed && isOwner ? (
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Action</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {finalOffers.map((o) => (
                      <tr key={String(o.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar src={o?.validator?.avatar_url} name={o?.validator?.username || ""} size="xs" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={o?.validator?.username ? `/user/${encodeURIComponent(o.validator.username)}` : "#"}
                                  className="truncate font-semibold text-foreground hover:underline"
                                >
                                  @{o?.validator?.username || "-"}
                                </Link>
                                {o?.validator?.primary_badge ? <Badge badge={o.validator.primary_badge} size="xs" /> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{formatIDR(o.amount)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{Math.round((Number(o.hold_hours) || 0) / 24)} days</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{String(o.status || "")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {o?.terms ? <div className="line-clamp-3 whitespace-pre-wrap">{o.terms}</div> : "-"}
                        </td>
                        {isAuthed && isOwner ? (
                          <td className="px-4 py-3">
                            {normalizeStatus(o.status) === "submitted" && !transferId && !disputeId ? (
                              <button
                                onClick={() => acceptFinalOffer(o.id)}
                                className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                type="button"
                              >
                                Accept
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAuthed && isOwner && offersMsg ? <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div> : null}
          </CaseSection>

          <CaseSection title="Lock Funds" subtitle="Escrow">
            {transferId ? (
              <div className="text-sm text-muted-foreground">
                Escrow terpasang.
                <div className="mt-2 font-mono text-xs text-foreground">transfer_id: {String(transferId)}</div>
              </div>
            ) : !isAuthed ? (
              <div className="text-sm text-muted-foreground">Login diperlukan untuk Lock Funds.</div>
            ) : !isOwner ? (
              <div className="text-sm text-muted-foreground">
                Lock Funds dilakukan oleh pemilik Validation Case setelah menerima Final Offer.
              </div>
            ) : escrowDraft ? (
              <div className="space-y-3">
                <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4 text-sm">
                  <div className="font-semibold text-foreground">Escrow Draft</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="text-muted-foreground">
                      Receiver: <span className="font-semibold text-foreground">@{escrowDraft.receiver_username}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Amount: <span className="font-semibold text-foreground">{formatIDR(escrowDraft.amount)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Hold: <span className="font-semibold text-foreground">{Math.round((Number(escrowDraft.hold_hours) || 0) / 24)} days</span>
                    </div>
                    <div className="text-muted-foreground">
                      Message: <span className="font-mono text-xs text-foreground">{escrowDraft.message}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground">Wallet PIN</label>
                    <input
                      value={lockFundsPin}
                      onChange={(e) => setLockFundsPin(e.target.value)}
                      placeholder="6 digit"
                      className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      inputMode="numeric"
                      type="password"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={lockFunds}
                      className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      disabled={lockFundsLoading}
                      type="button"
                    >
                      {lockFundsLoading ? "Locking..." : "Lock Funds"}
                    </button>
                  </div>
                </div>

                {lockFundsMsg ? <div className="text-xs text-muted-foreground">{lockFundsMsg}</div> : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Tidak ada escrow draft. Langkah ini aktif setelah Final Offer diterima.
              </div>
            )}
          </CaseSection>

          <CaseSection title="Artifact Submission" subtitle="Deliverable">
            {artifactId ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  Artifact Submission tersimpan sebagai dokumen.
                  <div className="mt-2 font-mono text-xs text-foreground">document_id: {String(artifactId)}</div>
                </div>
                {artifactDownloadHref ? (
                  <a href={artifactDownloadHref} className="text-sm font-semibold text-primary hover:underline">
                    Download Artifact Submission
                  </a>
                ) : null}
              </div>
            ) : !isAuthed ? (
              <div className="text-sm text-muted-foreground">Login diperlukan untuk Artifact Submission.</div>
            ) : isOwner ? (
              <div className="text-sm text-muted-foreground">
                Menunggu Artifact Submission dari validator setelah Lock Funds.
              </div>
            ) : transferId ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Upload work product penuh (tanpa watermark). Dokumen akan dibagikan secara privat kepada pemilik kasus.
                </div>
                <input
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setArtifactFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm"
                />
                <button
                  onClick={submitArtifact}
                  className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  disabled={uploadLoading}
                  type="button"
                >
                  {uploadLoading ? "Uploading..." : "Submit Artifact Submission"}
                </button>
                {artifactMsg ? <div className="text-xs text-muted-foreground">{artifactMsg}</div> : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Artifact Submission aktif setelah Lock Funds.
              </div>
            )}
          </CaseSection>

          <CaseSection title="Decision / Dispute" subtitle="Arbitration">
            {certifiedId ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">Certified Artifact</div>
                <div className="font-mono text-xs text-foreground">document_id: {String(certifiedId)}</div>
                {certifiedDownloadHref ? (
                  <a href={certifiedDownloadHref} className="text-sm font-semibold text-primary hover:underline">
                    Download Certified Artifact
                  </a>
                ) : null}
              </div>
            ) : disputeId ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">Dispute</div>
                <div className="font-mono text-xs text-foreground">dispute_id: {String(disputeId)}</div>
                <Link href="/account/wallet/disputes" className="text-sm font-semibold text-primary hover:underline">
                  Open Dispute Center
                </Link>
              </div>
            ) : !isAuthed ? (
              <div className="text-sm text-muted-foreground">Login diperlukan untuk aksi Decision/Dispute.</div>
            ) : !isOwner ? (
              <div className="text-sm text-muted-foreground">
                Decision/Dispute dipicu oleh pemilik Validation Case. Admin arbitration menyelesaikan dispute, bukan voting.
              </div>
            ) : !artifactId ? (
              <div className="text-sm text-muted-foreground">Decision/Dispute aktif setelah Artifact Submission.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4">
                  <div className="text-sm font-semibold text-foreground">Approve</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Jika work product memenuhi Final Offer, lakukan release escrow. Aksi ini memiliki konsekuensi finansial dan dicatat.
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">Wallet PIN</label>
                      <input
                        value={releasePin}
                        onChange={(e) => setReleasePin(e.target.value)}
                        placeholder="6 digit"
                        className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                        inputMode="numeric"
                        type="password"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={approveAndRelease}
                        className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                        disabled={releaseLoading}
                        type="button"
                      >
                        {releaseLoading ? "Releasing..." : "Release Escrow"}
                      </button>
                    </div>
                  </div>
                  {releaseMsg ? <div className="mt-3 text-xs text-muted-foreground">{releaseMsg}</div> : null}
                </div>

                <div className="rounded-[var(--radius)] border border-border bg-card p-4">
                  <div className="text-sm font-semibold text-foreground">Dispute</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Jika Anda menolak Artifact Submission, ajukan Dispute. Admin akan meninjau Final Offer dan Artifact Submission.
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Type</label>
                      <select
                        value={disputeForm.category}
                        onChange={(e) => setDisputeForm((f) => ({ ...f, category: e.target.value }))}
                        className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      >
                        <option value="ItemNotAsDescribed">Artifact tidak sesuai terms</option>
                        <option value="ItemNotReceived">Artifact tidak diterima</option>
                        <option value="Fraud">Fraud / misrepresentation</option>
                        <option value="SellerNotResponding">Validator tidak responsif</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">Reason</label>
                      <textarea
                        value={disputeForm.reason}
                        onChange={(e) => setDisputeForm((f) => ({ ...f, reason: e.target.value }))}
                        rows={4}
                        placeholder="Minimal 20 karakter. Cantumkan poin sengketa yang dapat diverifikasi."
                        className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={initiateDispute}
                      className="rounded-[var(--radius)] border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60 disabled:opacity-60"
                      disabled={disputeLoading}
                      type="button"
                    >
                      {disputeLoading ? "Submitting..." : "Attach Dispute"}
                    </button>
                  </div>
                  {disputeMsg ? <div className="mt-3 text-xs text-muted-foreground">{disputeMsg}</div> : null}
                </div>
              </div>
            )}
          </CaseSection>

          <CaseSection title="Case Log" subtitle="Audit Trail">
            {!isAuthed ? (
              <div className="text-sm text-muted-foreground">
                Case Log tersedia untuk pemilik kasus dan validator yang telah disetujui.
              </div>
            ) : caseLogLoading ? (
              <div className="text-sm text-muted-foreground">Memuat Case Log...</div>
            ) : Array.isArray(caseLog) && caseLog.length > 0 ? (
              <ol className="space-y-3">
                {caseLog.map((ev) => (
                  <li key={String(ev.id)} className="rounded-[var(--radius)] border border-border bg-secondary/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {String(ev.event_type || "").replace(/_/g, " ")}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{formatDateTime(ev.created_at)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      {ev?.actor?.username ? (
                        <>
                          <Avatar src={ev?.actor?.avatar_url} name={ev?.actor?.username || ""} size="xs" />
                          <span className="font-semibold text-foreground">@{ev.actor.username}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">system</span>
                      )}
                    </div>
                    {ev?.detail ? (
                      <pre className="mt-2 overflow-x-auto rounded-[var(--radius)] border border-border bg-card p-3 text-xs text-muted-foreground">
                        {safeJson(ev.detail)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-muted-foreground">
                Case Log tidak tersedia untuk role ini, atau belum ada event yang tercatat.
              </div>
            )}
          </CaseSection>
        </article>
      ) : null}
    </main>
  );
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ContentTable({ content }) {
  if (!content) return <div className="text-sm text-muted-foreground">Tidak ada konten.</div>;

  if (typeof content === "string") {
    return <pre className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">{content}</pre>;
  }

  let rows = [];
  if (Array.isArray(content?.rows)) rows = content.rows;
  else if (Array.isArray(content?.sections)) {
    return (
      <div className="space-y-6">
        {content.sections.map((sec, idx) => (
          <div key={idx}>
            {sec.title && <h3 className="mb-3 text-base font-semibold text-foreground">{sec.title}</h3>}
            <Table rows={sec.rows || []} />
          </div>
        ))}
      </div>
    );
  } else if (typeof content === "object") {
    rows = Object.entries(content).map(([label, value]) => ({ label, value }));
  }

  if (!rows.length) return <div className="text-sm text-muted-foreground">Tidak ada konten.</div>;
  return <Table rows={rows} />;
}

function Table({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-secondary/40"}>
              <td className="w-52 px-4 py-3 align-top font-semibold text-foreground">{r.label}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{renderValue(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderValue(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v))
    return (
      <ul className="list-disc pl-4 space-y-1">
        {v.map((x, i) => (
          <li key={i}>{String(x)}</li>
        ))}
      </ul>
    );
  try {
    return (
      <pre className="whitespace-pre-wrap break-words rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-xs">
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  } catch {
    return String(v);
  }
}

