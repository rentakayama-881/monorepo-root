"use client";

import Link from "next/link";
import { isValidElement, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import { TagList } from "@/components/ui/TagPill";
import ValidationCaseRecordSkeleton from "./ValidationCaseRecordSkeleton";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
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

function formatHoldWindow(hours) {
  const h = Number(hours || 0);
  if (!Number.isFinite(h) || h <= 0) return "-";
  if (h === 32) return "1 hari 8 jam";
  if (h % 24 === 0) return `${h / 24} hari`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  if (d > 0) return `${d} hari ${rem} jam`;
  return `${h} jam`;
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase().trim();
}

function statusLabel(statusRaw) {
  const s = normalizeStatus(statusRaw);
  if (!s) return "unknown";
  const map = {
    open: "Open",
    waiting_owner_response: "Waiting Owner Response",
    on_hold_owner_inactive: "On Hold Owner Inactive",
    offer_accepted: "Offer Accepted",
    funds_locked: "Funds Locked",
    artifact_submitted: "Artifact Submitted",
    completed: "Completed",
    disputed: "Disputed",
  };
  return map[s] || s.replace(/_/g, " ");
}

function sensitivityMeta(levelRaw) {
  const level = String(levelRaw || "S1").toUpperCase();
  switch (level) {
    case "S0":
      return { level: "S0", label: "Public", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-900" };
    case "S1":
      return { level: "S1", label: "Restricted", badgeClass: "border-blue-200 bg-blue-50 text-blue-900" };
    case "S2":
      return { level: "S2", label: "Confidential", badgeClass: "border-amber-200 bg-amber-50 text-amber-900" };
    case "S3":
      return { level: "S3", label: "Critical", badgeClass: "border-red-200 bg-red-50 text-red-900" };
    default:
      return { level: level || "-", label: "Unknown", badgeClass: "border-border bg-card text-foreground" };
  }
}

function clarificationStateLabel(stateRaw) {
  const s = normalizeStatus(stateRaw);
  const map = {
    none: "None",
    waiting_owner_response: "Waiting Owner Response",
    assumption_pending_owner_decision: "Assumption Pending Owner Decision",
    owner_responded: "Owner Responded",
    assumption_approved: "Assumption Approved",
    assumption_rejected: "Assumption Rejected",
    owner_inactive_sla_expired: "Owner Inactive SLA Expired",
  };
  return map[s] || (s ? s.replace(/_/g, " ") : "-");
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
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {subtitle || "Section"}
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function WorkflowProgressBanner({ status, isOwner, transferId, artifactId, certifiedId }) {
  const caseStatus = normalizeStatus(status);

  // Determine owner step
  let ownerStep = 1;
  if (caseStatus === "open" || caseStatus === "waiting_owner_response") ownerStep = 2;
  if (transferId) ownerStep = 4;
  if (artifactId) ownerStep = 5;
  if (certifiedId || caseStatus === "completed") ownerStep = 5;

  // Determine validator step
  let validatorStep = 1;
  if (caseStatus === "open" || caseStatus === "waiting_owner_response") validatorStep = 2;
  if (transferId) validatorStep = 3;
  if (artifactId) validatorStep = 4;
  if (certifiedId || caseStatus === "completed") validatorStep = 4;

  const ownerSteps = [
    { num: 1, label: "Buka Kasus" },
    { num: 2, label: "Review Validator" },
    { num: 3, label: "Terima Offer" },
    { num: 4, label: "Lock Funds" },
    { num: 5, label: "Decision" },
  ];

  const validatorSteps = [
    { num: 1, label: "Request Konsultasi" },
    { num: 2, label: "Kirim Final Offer" },
    { num: 3, label: "Submit Artifact" },
    { num: 4, label: "Selesai" },
  ];

  const roleSteps = isOwner ? ownerSteps : validatorSteps;
  const currentStep = isOwner ? ownerStep : validatorStep;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 md:p-6 shadow-sm">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workflow Progress
        </div>
        <div className="mt-1 text-sm font-semibold text-foreground">
          {isOwner ? "Owner" : "Validator"}: Step {currentStep}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {roleSteps.map((step, idx) => {
          const isActive = step.num <= currentStep;
          const isCurrent = step.num === currentStep;
          return (
            <div key={step.num} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary/30 text-primary"
                      : "bg-secondary/60 text-muted-foreground"
                }`}
              >
                {step.num}
              </div>
              <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
              {idx < roleSteps.length - 1 && (
                <div className={`ml-1 h-px w-4 ${isActive ? "bg-primary/30" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  const [clarificationMsg, setClarificationMsg] = useState("");
  const [clarificationSubmitting, setClarificationSubmitting] = useState(false);
  const [clarificationForm, setClarificationForm] = useState({
    mode: "question",
    message: "",
    assumptions: "",
  });

  // Inline form states for reject consultation
  const [rejectForms, setRejectForms] = useState({});
  const [rejectOpen, setRejectOpen] = useState({});

  // Inline form states for respond to clarification
  const [clarifyForms, setClarifyForms] = useState({});
  const [clarifyOpen, setClarifyOpen] = useState({});

  const [contactTelegram, setContactTelegram] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const [finalOffers, setFinalOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersMsg, setOffersMsg] = useState("");
  const [offerForm, setOfferForm] = useState({ hold_hours: 168, terms: "" });

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
      const data = await fetchJsonAuth("/api/user/me", { method: "GET", clearSessionOn401: false });
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
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests`, { method: "GET", clearSessionOn401: false }),
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, { method: "GET", clearSessionOn401: false }),
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/case-log`, { method: "GET", clearSessionOn401: false }),
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
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, { method: "GET", clearSessionOn401: false }),
        // Case Log is only visible to owner or approved validators; best-effort.
        fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/case-log`, { method: "GET", clearSessionOn401: false }).catch(() => null),
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
      if (e?.status === 401) {
        setConsultationMsg("Sesi berakhir. Silakan login kembali.");
        router.push("/login?session=expired");
        return;
      }
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

  function toggleRejectForm(requestId) {
    setRejectOpen((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
    if (!rejectOpen[requestId]) {
      setRejectForms((prev) => ({
        ...prev,
        [requestId]: "",
      }));
    }
  }

  async function submitRejectConsultation(requestId) {
    const reason = String(rejectForms[requestId] || "").trim();
    if (!reason || reason.length < 5) {
      setConsultationMsg("Alasan ditolak minimal 5 karakter.");
      return;
    }
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
      setRejectForms((prev) => ({ ...prev, [requestId]: "" }));
      setRejectOpen((prev) => ({ ...prev, [requestId]: false }));
      await loadOwnerWorkflow();
    } catch (e) {
      setConsultationMsg(e?.message || "Gagal menolak");
    }
  }

  async function requestOwnerClarification() {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    const mode = String(clarificationForm.mode || "question").toLowerCase();
    const message = String(clarificationForm.message || "").trim();
    if (message.length < 8) {
      setClarificationMsg("Message klarifikasi minimal 8 karakter.");
      return;
    }

    let assumptions = [];
    if (mode === "assumption") {
      assumptions = String(clarificationForm.assumptions || "")
        .split("\n")
        .map((line) => String(line || "").trim())
        .filter(Boolean)
        .map((line) => ({ item: line }));
      if (assumptions.length === 0) {
        setClarificationMsg("Mode assumption memerlukan minimal 1 asumsi.");
        return;
      }
    }

    setClarificationMsg("");
    setClarificationSubmitting(true);
    try {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/clarification/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message,
          assumptions,
        }),
      });
      setClarificationMsg("Permintaan klarifikasi dikirim. Status kasus beralih ke WAITING_OWNER_RESPONSE.");
      setClarificationForm((prev) => ({ ...prev, message: "", assumptions: "" }));
      await reloadCase();
      await loadNonOwnerWorkflow();
    } catch (e) {
      setClarificationMsg(e?.message || "Gagal mengirim klarifikasi");
    } finally {
      setClarificationSubmitting(false);
    }
  }

  function toggleClarifyForm(requestId, action) {
    const key = `${requestId}-${action}`;
    setClarifyOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    if (!clarifyOpen[key]) {
      setClarifyForms((prev) => ({
        ...prev,
        [requestId]: { action, text: "" },
      }));
    }
  }

  async function submitClarifyResponse(requestId, action) {
    const form = clarifyForms[requestId] || {};
    let clarification = "";

    if (action === "clarify" || action === "reject") {
      clarification = String(form.text || "").trim();
      if (!clarification || clarification.length < 8) {
        setConsultationMsg("Klarifikasi minimal 8 karakter.");
        return;
      }
    }

    setConsultationMsg("");
    try {
      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests/${encodeURIComponent(String(requestId))}/clarification/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, clarification }),
        }
      );
      if (action === "approve") {
        setConsultationMsg("Assumption disetujui. Kasus kembali ke status open.");
      } else if (action === "reject") {
        setConsultationMsg("Assumption ditolak dengan klarifikasi owner.");
      } else {
        setConsultationMsg("Klarifikasi owner terkirim. Kasus kembali ke status open.");
      }
      setClarifyForms((prev) => ({ ...prev, [requestId]: {} }));
      setClarifyOpen({});
      await reloadCase();
      await loadOwnerWorkflow();
    } catch (e) {
      setConsultationMsg(e?.message || "Gagal merespons klarifikasi");
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
    const amountNum = Number(vc?.bounty_amount || 0);
    const holdHours = Number(offerForm.hold_hours || 168);
    const allowedHoldHours = new Set([32, 168, 720]);
    const caseStatus = normalizeStatus(vc?.status);

    if (!amountNum || amountNum < 10000) {
      setOffersMsg("Bounty belum valid (minimal Rp 10.000).");
      return;
    }
    if (caseStatus !== "open") {
      setOffersMsg("Final Offer hanya dapat diajukan saat status kasus open.");
      return;
    }
    if (!allowedHoldHours.has(holdHours)) {
      setOffersMsg("Hold window tidak valid. Pilih: 1 hari 8 jam, 7 hari, atau 30 hari.");
      return;
    }

    try {
      await fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    return <ValidationCaseRecordSkeleton />;
  }

  const status = normalizeStatus(vc?.status);
  const consultationBlocked = status === "waiting_owner_response" || status === "on_hold_owner_inactive";
  const sensitivity = sensitivityMeta(vc?.sensitivity_level);
  const contactRestricted = sensitivity.level === "S2" || sensitivity.level === "S3";
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
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
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
        <article className="space-y-10 lg:grid lg:grid-cols-12 lg:gap-10 lg:space-y-0">
          <div className="lg:col-span-8 space-y-10">
            <header className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Validation Case Record
              </div>
              <h1 className="text-2xl font-semibold text-foreground">{vc?.title || "(untitled)"}</h1>

              {vc?.summary ? <p className="text-sm text-muted-foreground">{vc.summary}</p> : null}

              {Array.isArray(vc?.tags) && vc.tags.length > 0 ? <TagList tags={vc.tags} size="sm" /> : null}
            </header>

            {isAuthed && (
              <WorkflowProgressBanner
                status={status}
                isOwner={isOwner}
                transferId={transferId}
                artifactId={artifactId}
                certifiedId={certifiedId}
              />
            )}

          <CaseSection title="Overview" subtitle="Record">
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border/80 bg-secondary/35 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Case Record
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Ringkasan terstruktur agar konteks mudah dibaca sebelum masuk workflow.
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="max-h-[420px] overflow-auto md:max-h-[560px]">
                  <div className="prose prose-neutral max-w-none">
                    {vc?.content_type === "text" ? (
                      <MarkdownPreview content={contentAsText(vc?.content)} />
                    ) : (
                      <ContentTable content={vc?.content} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CaseSection>

          <CaseSection title="Request Consultation" subtitle="Protocol">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">Rules</div>
                <ul className="mt-2 list-disc pl-5">
                  <li>Request Consultation hanya untuk validator dengan Credibility Stake yang memenuhi syarat.</li>
                  <li>Kontak Telegram dibuka privat setelah persetujuan pemilik kasus dan dicatat pada Case Log.</li>
                  <li>Jika validator meminta klarifikasi, status menjadi WAITING_OWNER_RESPONSE dengan SLA owner 12 jam.</li>
                  <li>Jika owner tidak merespons sampai SLA habis, kasus auto ON_HOLD_OWNER_INACTIVE tanpa reassignment validator.</li>
                </ul>
              </div>
              <div className="md:border-l md:border-border md:pl-6">
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
                  <div className="space-y-4">
                    <Button onClick={requestConsultation} variant="gradient" disabled={consultationBlocked}>
                      Request Consultation
                    </Button>
                    {consultationBlocked ? (
                      <div className="text-xs text-muted-foreground">
                        Consultation baru diblokir karena kasus menunggu respons owner atau sedang on-hold owner inactive.
                      </div>
                    ) : null}
                    {consultationMsg ? <div className="text-xs text-muted-foreground">{consultationMsg}</div> : null}

                    <div className="h-px bg-border" />

                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Private Contact
                    </div>
                    {contactRestricted ? (
                      <div className="text-xs text-muted-foreground">
                        Telegram private contact dinonaktifkan untuk tier {sensitivity.level} ({sensitivity.label}).
                      </div>
                    ) : null}
                    <Button onClick={revealContact} variant="outline" disabled={contactLoading || contactRestricted}>
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

          {isAuthed && isOwner && (status === "open" || status === "waiting_owner_response") ? (
            <CaseSection title="Consultation Requests" subtitle="Owner Review">
              {consultationLoading ? (
                <div className="text-sm text-muted-foreground">Memuat Consultation Requests...</div>
              ) : consultationRequests.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada Request Consultation.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[920px] w-full text-sm">
                    <thead className="bg-secondary/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Validator</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Match Score</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Status</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">Filed</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">SLA Due</th>
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
                          <td className="px-4 py-3">
                            {r?.matching_score ? (
                              <div>
                                <div className="font-mono text-xs font-semibold text-foreground">
                                  {Number(r.matching_score.total || 0)}/100
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  D:{Number(r.matching_score.domain_fit || 0)} E:{Number(r.matching_score.evidence_fit || 0)} H:{Number(r.matching_score.history_dispute || 0)} R:{Number(r.matching_score.responsiveness_sla || 0)} S:{Number(r.matching_score.stake_guarantee || 0)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{String(r.status || "")}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(r.created_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {r?.owner_response_due_at ? formatDateTime(r.owner_response_due_at) : "-"}
                            {Number(r?.reminder_count || 0) > 0 ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">reminder: {Number(r.reminder_count)}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {normalizeStatus(r.status) === "pending" ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                    onClick={() => approveConsultation(r.id)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                    onClick={() => toggleRejectForm(r.id)}
                                  >
                                    Reject
                                  </button>
                                </div>
                                {rejectOpen[r.id] ? (
                                  <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-2">
                                    <textarea
                                      value={rejectForms[r.id] || ""}
                                      onChange={(e) => setRejectForms((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                      placeholder="Alasan penolakan (min 5 karakter)"
                                      rows={3}
                                      className="w-full rounded-[var(--radius)] border border-input bg-card px-2 py-1.5 text-xs text-foreground"
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => submitRejectConsultation(r.id)}
                                        className="rounded-[var(--radius)] bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                      >
                                        Submit
                                      </button>
                                      <button
                                        onClick={() => toggleRejectForm(r.id)}
                                        className="rounded-[var(--radius)] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : normalizeStatus(r.status) === "waiting_owner_response" || normalizeStatus(r.status) === "owner_timeout" ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                    onClick={() => submitClarifyResponse(r.id, "approve")}
                                  >
                                    Approve Assumption
                                  </button>
                                  <button
                                    className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                    onClick={() => toggleClarifyForm(r.id, "clarify")}
                                  >
                                    Clarify
                                  </button>
                                  <button
                                    className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                    onClick={() => toggleClarifyForm(r.id, "reject")}
                                  >
                                    Reject Assumption
                                  </button>
                                </div>
                                {clarifyOpen[`${r.id}-clarify`] || clarifyOpen[`${r.id}-reject`] ? (
                                  <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-2">
                                    <textarea
                                      value={(clarifyForms[r.id] || {}).text || ""}
                                      onChange={(e) =>
                                        setClarifyForms((prev) => ({
                                          ...prev,
                                          [r.id]: { ...(prev[r.id] || {}), text: e.target.value },
                                        }))
                                      }
                                      placeholder="Klarifikasi/Alasan (min 8 karakter)"
                                      rows={3}
                                      className="w-full rounded-[var(--radius)] border border-input bg-card px-2 py-1.5 text-xs text-foreground"
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => {
                                          const action = clarifyOpen[`${r.id}-clarify`] ? "clarify" : "reject";
                                          submitClarifyResponse(r.id, action);
                                        }}
                                        className="rounded-[var(--radius)] bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                                      >
                                        Submit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setClarifyOpen({});
                                          setClarifyForms((prev) => ({ ...prev, [r.id]: {} }));
                                        }}
                                        className="rounded-[var(--radius)] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary/60"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
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

          {isAuthed && !isOwner && status === "waiting_owner_response" ? (
            <CaseSection title="Klarifikasi ke Owner" subtitle="Validator">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">Status Kasus</div>
                  <p className="mt-2">
                    Kasus ini sedang menunggu respons dari pemilik kasus atas pertanyaan atau asumsi yang Anda kirimkan. Silakan tunggu sampai pemilik memberikan klarifikasi.
                  </p>
                </div>
                <div className="md:border-l md:border-border md:pl-6">
                  <div className="text-sm font-semibold text-foreground mb-3">Kirim Klarifikasi / Asumsi Baru</div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Mode</label>
                      <select
                        value={clarificationForm.mode}
                        onChange={(e) => setClarificationForm((f) => ({ ...f, mode: e.target.value }))}
                        className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      >
                        <option value="question">Question</option>
                        <option value="assumption">Assumption</option>
                      </select>
                    </div>
                    <textarea
                      value={clarificationForm.message}
                      onChange={(e) => setClarificationForm((f) => ({ ...f, message: e.target.value }))}
                      rows={3}
                      placeholder="Jelaskan kebutuhan klarifikasi secara terstruktur."
                      className="w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                    />
                    {String(clarificationForm.mode) === "assumption" ? (
                      <textarea
                        value={clarificationForm.assumptions}
                        onChange={(e) => setClarificationForm((f) => ({ ...f, assumptions: e.target.value }))}
                        rows={4}
                        placeholder="Satu asumsi per baris."
                        className="w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                      />
                    ) : null}
                    <button
                      onClick={requestOwnerClarification}
                      disabled={clarificationSubmitting}
                      className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60 disabled:opacity-60"
                      type="button"
                    >
                      {clarificationSubmitting ? "Submitting..." : "Submit Clarification"}
                    </button>
                    {clarificationMsg ? <div className="text-xs text-muted-foreground">{clarificationMsg}</div> : null}
                  </div>
                </div>
              </div>
            </CaseSection>
          ) : null}

          <CaseSection title="Final Offer" subtitle="Contract">
            {isAuthed && !isOwner && status === "open" ? (
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">Submission Notes</div>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Amount Final Offer mengikuti bounty_amount pada Validation Case (fixed).</li>
                    <li>Validator memilih hold window (auto-release) dan terms yang dapat diaudit.</li>
                    <li>Pemilik kasus akan melakukan Lock Funds setelah menerima Final Offer.</li>
                    <li>Hindari menyertakan info kontak di Terms.</li>
                  </ul>
                </div>

                <div className="md:border-l md:border-border md:pl-6">
                  <div className="text-sm font-semibold text-foreground">Submit Final Offer</div>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-[var(--radius)] border border-border bg-secondary/30 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Amount (locked funds)
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{formatIDR(vc?.bounty_amount)}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Sesuai bounty_amount (tidak dapat diubah di Final Offer).</div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Hold window</label>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => setOfferForm((f) => ({ ...f, hold_hours: 32 }))}
                          className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                            Number(offerForm.hold_hours) === 32
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground hover:border-primary"
                          }`}
                        >
                          <div className="text-sm font-semibold">1 hari 8 jam</div>
                          <div className="text-[11px] opacity-70">Tugas ringan</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferForm((f) => ({ ...f, hold_hours: 168 }))}
                          className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                            Number(offerForm.hold_hours) === 168
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground hover:border-primary"
                          }`}
                        >
                          <div className="text-sm font-semibold">7 hari</div>
                          <div className="text-[11px] opacity-70">Standar</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferForm((f) => ({ ...f, hold_hours: 720 }))}
                          className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                            Number(offerForm.hold_hours) === 720
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground hover:border-primary"
                          }`}
                        >
                          <div className="text-sm font-semibold">30 hari</div>
                          <div className="text-[11px] opacity-70">Kasus kompleks</div>
                        </button>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Dana auto-release ketika hold berakhir jika tidak ada Dispute.</div>
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
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={submitFinalOffer}
                      className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      type="button"
                    >
                      Submit
                    </button>
                  </div>
                  {offersMsg ? <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div> : null}
                </div>
              </div>
            ) : null}

            {offersLoading ? (
              <div className="text-sm text-muted-foreground">Memuat Final Offers...</div>
            ) : finalOffers.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada Final Offer.</div>
            ) : (
              <div className="overflow-x-auto">
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
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatHoldWindow(o.hold_hours)}</td>
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

          {isAuthed && isOwner && (escrowDraft || vc?.accepted_final_offer_id) ? (
            <CaseSection title="Lock Funds" subtitle="Escrow">
              {transferId ? (
                <div className="text-sm text-muted-foreground">
                  Escrow terpasang.
                  <div className="mt-2 font-mono text-xs text-foreground">transfer_id: {String(transferId)}</div>
                </div>
              ) : escrowDraft ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">Escrow Draft</div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-border">
                        <tr>
                          <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Receiver
                          </th>
                          <td className="px-4 py-3 font-semibold text-foreground">@{escrowDraft.receiver_username}</td>
                        </tr>
                        <tr>
                          <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Amount
                          </th>
                          <td className="px-4 py-3 font-semibold text-foreground">{formatIDR(escrowDraft.amount)}</td>
                        </tr>
                        <tr>
                          <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Hold
                          </th>
                          <td className="px-4 py-3 text-muted-foreground">
                            {Math.round((Number(escrowDraft.hold_hours) || 0) / 24)} days
                          </td>
                        </tr>
                        <tr>
                          <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Message
                          </th>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{escrowDraft.message}</td>
                        </tr>
                      </tbody>
                    </table>
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
          ) : null}

          {isAuthed && !isOwner && transferId ? (
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
              ) : (
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
              )}
            </CaseSection>
          ) : null}

          {isAuthed && isOwner && artifactId ? (
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
              ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
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

                <div>
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
          ) : null}

          <CaseSection title="Case Log" subtitle="Audit Trail">
            {!isAuthed ? (
              <div className="text-sm text-muted-foreground">
                Case Log tersedia untuk pemilik kasus dan validator yang telah disetujui.
              </div>
            ) : caseLogLoading ? (
              <div className="text-sm text-muted-foreground">Memuat Case Log...</div>
            ) : Array.isArray(caseLog) && caseLog.length > 0 ? (
              <ol className="relative space-y-5 border-l border-border pl-6">
                {caseLog.map((ev) => (
                  <li key={String(ev.id)} className="relative">
                    <span
                      className="absolute -left-[9px] top-2 h-3 w-3 rounded-full bg-border"
                      aria-hidden="true"
                    />
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
                      <pre className="mt-2 overflow-x-auto rounded-[var(--radius)] bg-secondary/20 p-3 text-xs text-muted-foreground">
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
          </div>

          <aside className="lg:col-span-4 lg:sticky lg:top-24 h-fit space-y-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Case File</div>

              <div className="mt-3 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar src={owner?.avatar_url} name={owner?.username || ""} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={owner?.username ? `/user/${encodeURIComponent(owner.username)}` : "#"}
                        prefetch={false}
                        className="truncate text-sm font-semibold text-foreground hover:underline"
                      >
                        @{owner?.username || "-"}
                      </Link>
                      {ownerBadge ? <Badge badge={ownerBadge} size="xs" /> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">Case Owner</div>
                  </div>
                </div>

                <dl className="divide-y divide-border text-sm">
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Case</dt>
                    <dd className="font-mono text-xs text-foreground">#{String(id)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</dt>
                    <dd className="font-semibold text-foreground">{statusLabel(status)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sensitivity</dt>
                    <dd className="text-right">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${sensitivity.badgeClass}`}>
                        {sensitivity.level}
                      </span>
                      <div className="mt-1 text-xs text-muted-foreground">{sensitivity.label}</div>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Clarification</dt>
                    <dd className="font-mono text-xs text-muted-foreground">{clarificationStateLabel(vc?.clarification_state)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workflow</dt>
                    <dd className="text-right text-muted-foreground">
                      {status === "on_hold_owner_inactive"
                        ? "On Hold: Owner Inactive (SLA Expired)"
                        : status === "waiting_owner_response"
                          ? "Waiting Owner Response (SLA Running)"
                          : certifiedId
                        ? "Certified Artifact Issued"
                        : disputeId
                          ? "Dispute Attached"
                          : artifactId
                            ? "Artifact Submitted"
                            : transferId
                              ? "Funds Locked (Escrow)"
                              : vc?.accepted_final_offer_id ?? vc?.acceptedFinalOfferId
                                ? "Final Offer Accepted"
                                : "Open"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bounty</dt>
                    <dd className="font-semibold text-foreground">{formatIDR(vc?.bounty_amount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filed</dt>
                    <dd className="text-right text-muted-foreground">{formatDateTime(vc?.created_at)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Dossier-only: tidak ada komentar, reaksi, atau voting. Setiap aksi yang tersedia memiliki konsekuensi audit/finansial.
            </div>
          </aside>
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

const CONTENT_LABEL_MAP = {
  objective: "Fokus Validasi",
  expected_output_type: "Hasil Akhir yang Diharapkan",
  evidence_scope: "Materi yang Diperiksa",
  pass_gate: "Standar Dinyatakan Selesai",
  constraints: "Batasan",
  sensitivity: "Tingkat Kerahasiaan",
  owner_response_sla: "SLA Respons Owner",
  validation_goal: "Masalah yang Ingin Diselesaikan",
  output_type: "Hasil Akhir yang Dibutuhkan",
  evidence_input: "Materi Awal yang Tersedia",
  pass_criteria: "Kriteria Diterima",
  case_record_text: "Catatan Tambahan",
  sensitivity_policy: "Kebijakan Sensitivitas",
  schema_version: "Versi Intake",
  max_hours: "Batas Waktu (Jam)",
  reminder_hours: "Pengingat (Jam)",
  timeout_outcome: "Status Saat Timeout",
  reassignment: "Reassignment Validator",
  validator_penalty: "Penalti Validator",
  visibility: "Akses Visibilitas",
  telegram_allowed: "Telegram Diizinkan",
  requires_admin_gate: "Perlu Admin Gate",
  requires_pre_moderation: "Perlu Pre-Moderasi",
};

function prettifyKey(keyRaw) {
  const key = String(keyRaw || "").trim();
  if (!key) return "-";
  if (CONTENT_LABEL_MAP[key]) return CONTENT_LABEL_MAP[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderInlineValue(v) {
  if (v == null || v === "") return "-";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => renderInlineValue(x)).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function ContentTable({ content }) {
  if (!content) return <div className="text-sm text-muted-foreground">Tidak ada konten.</div>;

  if (typeof content === "string") {
    return <pre className="rounded-[var(--radius)] bg-secondary/30 p-4 text-xs text-muted-foreground">{content}</pre>;
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

function Table({ rows, headerLeft = "Kolom", headerRight = "Detail", compact = false }) {
  const tdClass = compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm";
  const thClass = compact ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-[11px]";
  const mobileValueClass = compact ? "mt-1 text-xs text-foreground" : "mt-2 text-sm text-foreground";

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="md:hidden">
        <div className="border-b border-border/80 bg-secondary/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {headerLeft} / {headerRight}
        </div>
        <div className={compact ? "space-y-2 p-2.5" : "space-y-2.5 p-3"}>
          {rows.map((r, idx) => (
            <article
              key={idx}
              className="rounded-lg border border-border/70 bg-secondary/[0.18] p-3"
            >
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {prettifyKey(r.label)}
              </h4>
              <div className={mobileValueClass}>{renderValue(r.value)}</div>
            </article>
          ))}
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-secondary/40">
            <tr>
              <th className={`w-56 text-left font-semibold uppercase tracking-[0.14em] text-muted-foreground ${thClass}`}>
                {headerLeft}
              </th>
              <th className={`text-left font-semibold uppercase tracking-[0.14em] text-muted-foreground ${thClass}`}>
                {headerRight}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((r, idx) => (
              <tr key={idx} className="align-top transition-colors hover:bg-secondary/15">
                <td className={`${tdClass} font-semibold text-foreground`}>{prettifyKey(r.label)}</td>
                <td className={`${tdClass} text-muted-foreground`}>{renderValue(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderValue(v) {
  if (v == null) return "";
  if (isValidElement(v)) return v;
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
  if (typeof v === "object") {
    const entries = Object.entries(v);
    if (!entries.length) return "-";
    return (
      <div className="mt-1">
        <Table
          rows={entries.map(([key, value]) => ({
            label: key,
            value:
              typeof value === "object" && value !== null && !Array.isArray(value) ? (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-secondary/30 p-2 text-[11px]">
                  {safeJson(value)}
                </pre>
              ) : (
                renderInlineValue(value)
              ),
          }))}
          headerLeft="Atribut"
          headerRight="Nilai"
          compact={true}
        />
      </div>
    );
  }
  try {
    return (
      <pre className="whitespace-pre-wrap break-words rounded-[var(--radius)] bg-secondary/30 p-3 text-xs">
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  } catch {
    return String(v);
  }
}
