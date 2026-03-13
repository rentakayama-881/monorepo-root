"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TagList } from "@/components/ui/TagPill";
import ValidationCaseRecordSkeleton from "./ValidationCaseRecordSkeleton";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { formatIDR, formatDateTime } from "@/lib/format";
import { isWorkspaceValidationCase } from "@/lib/validationCaseWorkflow";
import RepoWorkflowClient from "./repo/RepoWorkflowClient";
import {
  isSyntheticArtifactMarker,
  normalizeStatus,
  workflowSummaryLabel,
  consultationStatusLabel,
  sensitivityMeta,
  contentAsText,
  stripLeadingRecordLabel,
  looksLikeMarkdownText,
  formatCaseLogLoadError,
  resolveTelegramContactHref,
  formatTelegramContactLabel,
  sensitivityStakeRequirement,
} from "./components/validationCaseDetailUtils";
import { StatusBadge, CaseSection } from "./components/CaseSharedComponents";
import CaseLogPanel from "./components/CaseLogPanel";
import CaseMetadataSidebar from "./components/CaseMetadataSidebar";
import ContentTable, { extractCaseRecordText, hasOverviewContent } from "./components/ContentTable";
import ConsultationPanel from "./components/ConsultationPanel";
import FinalOffersPanel from "./components/FinalOffersPanel";
import EscrowPanel from "./components/EscrowPanel";
import ValidatorResultPanel from "./components/ValidatorResultPanel";
import DisputeAndReleasePanel from "./components/DisputeAndReleasePanel";

export default function ValidationCaseRecordPage({ initialCaseData = null }) {
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

  const [loading, setLoading] = useState(() => !initialCaseData);
  const [error, setError] = useState("");
  const [vc, setVc] = useState(() => initialCaseData);
  const [me, setMe] = useState(null);
  const hasHydratedInitialCase = useRef(Boolean(initialCaseData));

  // Workflow state
  const [consultationRequests, setConsultationRequests] = useState([]);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationMsg, setConsultationMsg] = useState("");
  const [myConsultationRequest, setMyConsultationRequest] = useState(null);
  const [myConsultationLoading, setMyConsultationLoading] = useState(false);
  const [requestConsultationLoading, setRequestConsultationLoading] = useState(false);

  // Inline form states for reject consultation
  const [rejectForms, setRejectForms] = useState({});
  const [rejectOpen, setRejectOpen] = useState({});

  const [contactTelegram, setContactTelegram] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const [finalOffers, setFinalOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersMsg, setOffersMsg] = useState("");
  const [finalOfferSubmitting, setFinalOfferSubmitting] = useState(false);
  const [offerForm, setOfferForm] = useState({ hold_hours: 168, terms: "" });
  const finalOfferSubmitRef = useRef(false);
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);
  const acceptFinalOfferRef = useRef(false);

  const [escrowDraft, setEscrowDraft] = useState(null);
  const [lockFundsPin, setLockFundsPin] = useState("");
  const [lockFundsLoading, setLockFundsLoading] = useState(false);
  const [lockFundsMsg, setLockFundsMsg] = useState("");
  const lockFundsSubmitRef = useRef(false);

  const [artifactSubmitting, setArtifactSubmitting] = useState(false);
  const [artifactMsg, setArtifactMsg] = useState("");

  const [releasePin, setReleasePin] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState("");

  const [disputeForm, setDisputeForm] = useState({ category: "ItemNotAsDescribed", reason: "" });
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState("");

  const [caseLog, setCaseLog] = useState([]);
  const [caseLogLoading, setCaseLogLoading] = useState(false);
  const [caseLogError, setCaseLogError] = useState("");

  const contactTelegramHref = useMemo(
    () => resolveTelegramContactHref(contactTelegram),
    [contactTelegram]
  );
  const contactTelegramLabel = useMemo(
    () => formatTelegramContactLabel(contactTelegram),
    [contactTelegram]
  );

  const isOwner = Boolean(me?.id && vc?.owner?.id && Number(me.id) === Number(vc.owner.id));

  async function reloadCase({ showSkeleton = true } = {}) {
    if (showSkeleton) {
      setError("");
      setLoading(true);
    }
    try {
      const data = await fetchJson(
        `/api/validation-cases/${encodeURIComponent(String(id))}/public`,
        {
          method: "GET",
          cache: "no-store",
        }
      );
      setVc(data);
    } catch (e) {
      if (showSkeleton) {
        setError(e?.message || "Gagal memuat Validation Case Record");
        setVc(null);
      }
    } finally {
      if (showSkeleton) {
        setLoading(false);
      }
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
    if (hasHydratedInitialCase.current) {
      hasHydratedInitialCase.current = false;
      reloadCase({ showSkeleton: false });
      return;
    }
    reloadCase({ showSkeleton: true });
    // Omit reloadCase — stable by intent, re-runs only when case id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadOwnerWorkflow() {
    if (!isAuthed || !id) return;
    if (!isOwner) return;

    setConsultationLoading(true);
    setOffersLoading(true);
    setCaseLogLoading(true);
    setCaseLogError("");
    setConsultationMsg("");
    setOffersMsg("");
    setLockFundsMsg("");
    setMyConsultationRequest(null);

    const [reqsResult, offersResult, logResult] = await Promise.allSettled([
      fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests`,
        { method: "GET", clearSessionOn401: false }
      ),
      fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, {
        method: "GET",
        clearSessionOn401: false,
      }),
      fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/case-log`, {
        method: "GET",
        clearSessionOn401: false,
      }),
    ]);

    if (reqsResult.status === "fulfilled") {
      setConsultationRequests(
        Array.isArray(reqsResult.value?.consultation_requests)
          ? reqsResult.value.consultation_requests
          : []
      );
    } else {
      setConsultationRequests([]);
    }

    if (offersResult.status === "fulfilled") {
      const offers = offersResult.value;
      setFinalOffers(Array.isArray(offers?.final_offers) ? offers.final_offers : []);

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
    } else {
      setFinalOffers([]);
    }

    if (logResult.status === "fulfilled") {
      setCaseLog(Array.isArray(logResult.value?.case_log) ? logResult.value.case_log : []);
      setCaseLogError("");
    } else {
      setCaseLog([]);
      setCaseLogError(formatCaseLogLoadError(logResult.reason, true));
    }

    setConsultationLoading(false);
    setOffersLoading(false);
    setCaseLogLoading(false);
  }

  async function loadMyConsultationRequest() {
    if (!isAuthed || !id || isOwner) return;
    setMyConsultationLoading(true);
    try {
      const data = await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests/me`,
        { method: "GET", clearSessionOn401: false }
      );
      setMyConsultationRequest(data?.consultation_request || null);
    } catch {
      setMyConsultationRequest(null);
    } finally {
      setMyConsultationLoading(false);
    }
  }

  async function loadNonOwnerWorkflow() {
    if (!isAuthed || !id) return;
    if (isOwner) return;

    setOffersLoading(true);
    setCaseLogLoading(true);
    setMyConsultationLoading(true);
    setCaseLogError("");
    setOffersMsg("");

    const [offersResult, logResult, myReqResult] = await Promise.allSettled([
      fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/final-offers`, {
        method: "GET",
        clearSessionOn401: false,
      }),
      fetchJsonAuth(`/api/validation-cases/${encodeURIComponent(String(id))}/case-log`, {
        method: "GET",
        clearSessionOn401: false,
      }),
      fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests/me`,
        { method: "GET", clearSessionOn401: false }
      ),
    ]);

    if (offersResult.status === "fulfilled") {
      setFinalOffers(
        Array.isArray(offersResult.value?.final_offers) ? offersResult.value.final_offers : []
      );
    } else {
      setFinalOffers([]);
    }

    if (logResult.status === "fulfilled") {
      setCaseLog(Array.isArray(logResult.value?.case_log) ? logResult.value.case_log : []);
      setCaseLogError("");
    } else {
      setCaseLog([]);
      setCaseLogError(formatCaseLogLoadError(logResult.reason, false));
    }

    if (myReqResult.status === "fulfilled") {
      setMyConsultationRequest(myReqResult.value?.consultation_request || null);
    } else {
      setMyConsultationRequest(null);
    }

    setOffersLoading(false);
    setCaseLogLoading(false);
    setMyConsultationLoading(false);
  }

  useEffect(() => {
    if (!vc || !me) return;
    if (!isAuthed) return;
    if (isWorkspaceValidationCase(vc?.meta)) {
      return;
    }
    if (isOwner) {
      loadOwnerWorkflow();
    } else {
      loadNonOwnerWorkflow();
    }
    // Omit load functions — stable by intent, re-runs on identity/ownership change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vc?.id, vc?.meta, me?.id, isAuthed, isOwner]);

  async function requestConsultation() {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    if (myConsultationRequest?.id) {
      setConsultationMsg("Request Consultation untuk kasus ini sudah diajukan.");
      return;
    }
    setConsultationMsg("");
    setRequestConsultationLoading(true);
    try {
      const created = await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const createdId = Number(created?.id || 0);
      setMyConsultationRequest({
        id: createdId > 0 ? createdId : Date.now(),
        status: "pending",
        created_at: Math.floor(Date.now() / 1000),
      });
      setConsultationMsg("Request Consultation tercatat. Menunggu persetujuan pemilik kasus.");
    } catch (e) {
      if (e?.status === 401) {
        setConsultationMsg("Sesi berakhir. Silakan login kembali.");
        router.push("/login?session=expired");
        return;
      }
      if (
        String(e?.message || "")
          .toLowerCase()
          .includes("sudah pernah diajukan")
      ) {
        await loadMyConsultationRequest();
      }
      setConsultationMsg(e?.message || "Gagal Request Consultation");
    } finally {
      setRequestConsultationLoading(false);
    }
  }

  async function approveConsultation(requestId) {
    setConsultationMsg("");
    // Optimistic update: immediately reflect approval in UI
    const prevRequests = consultationRequests;
    setConsultationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "approved" } : r))
    );
    try {
      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/consultation-requests/${encodeURIComponent(String(requestId))}/approve`,
        { method: "POST" }
      );
      setConsultationMsg("Permintaan konsultasi disetujui.");
      await loadOwnerWorkflow();
    } catch (e) {
      // Rollback on error
      setConsultationRequests(prevRequests);
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
    // Optimistic update: immediately reflect rejection in UI
    const prevRequests = consultationRequests;
    setConsultationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" } : r))
    );
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
      // Rollback on error
      setConsultationRequests(prevRequests);
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
      const data = await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/contact`,
        { method: "GET" }
      );
      const telegram = String(data?.telegram || "").trim();
      if (!telegram) {
        setContactMsg("Kontak tidak tersedia.");
        return;
      }
      setContactTelegram(telegram);
      if (/^tg:\/\/user\?id=/i.test(telegram)) {
        setContactMsg(
          "Akun Telegram pemilik belum memiliki username publik. Gunakan tombol untuk membuka Telegram app."
        );
      } else {
        setContactMsg("Kontak dibuka secara privat dan dicatat pada Case Log.");
      }
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
    if (finalOfferSubmitting) {
      return;
    }
    if (finalOfferSubmitRef.current) {
      return;
    }
    setOffersMsg("");
    const amountNum = Number(vc?.bounty_amount || 0);
    const holdHours = Number(offerForm.hold_hours || 168);
    const allowedHoldHours = new Set([32, 168, 720]);
    const caseStatus = normalizeStatus(vc?.status);
    const alreadySubmitted = Array.isArray(finalOffers) && finalOffers.length > 0;

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
    if (alreadySubmitted) {
      setOffersMsg("Final Offer untuk case ini sudah pernah Anda submit.");
      return;
    }

    finalOfferSubmitRef.current = true;
    setFinalOfferSubmitting(true);
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
    } finally {
      finalOfferSubmitRef.current = false;
      setFinalOfferSubmitting(false);
    }
  }

  async function acceptFinalOffer(offerId) {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    const targetOfferId = Number(offerId || 0);
    if (!Number.isFinite(targetOfferId) || targetOfferId <= 0) {
      setOffersMsg("Final Offer tidak valid.");
      return;
    }
    if (acceptFinalOfferRef.current) {
      return;
    }

    acceptFinalOfferRef.current = true;
    setAcceptingOfferId(targetOfferId);
    setOffersMsg("");
    try {
      const data = await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/final-offers/${encodeURIComponent(String(targetOfferId))}/accept`,
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
    } finally {
      setAcceptingOfferId(null);
      acceptFinalOfferRef.current = false;
    }
  }

  async function lockFunds() {
    if (lockFundsSubmitRef.current) {
      return;
    }
    if (!escrowDraft || !escrowDraft.receiver_username) {
      setLockFundsMsg("Escrow draft tidak tersedia.");
      return;
    }
    if (!lockFundsPin || String(lockFundsPin).trim().length < 6) {
      setLockFundsMsg("PIN wallet wajib diisi (6 digit).");
      return;
    }

    lockFundsSubmitRef.current = true;
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
      const transferId =
        createdData.transferId || createdData.TransferId || createdData.id || createdData.Id || "";
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
      lockFundsSubmitRef.current = false;
      setLockFundsLoading(false);
    }
  }

  async function submitArtifact() {
    setArtifactMsg("");
    setArtifactSubmitting(true);
    try {
      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/artifact-submission`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      setArtifactMsg("Konfirmasi delivery berhasil dicatat.");
      await reloadCase();
      await loadNonOwnerWorkflow();
    } catch (e) {
      setArtifactMsg(e?.message || "Gagal mengirim konfirmasi delivery");
    } finally {
      setArtifactSubmitting(false);
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

      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/escrow/released`,
        { method: "POST" }
      );

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
      const disputeId =
        createdData.disputeId || createdData.DisputeId || createdData.dispute_id || "";
      const success = createdData.success ?? createdData.Success;

      if (!disputeId && success === false) {
        throw new Error(createdData.error || createdData.Error || "Gagal membuat dispute");
      }
      if (!disputeId && !createdData.id) {
        throw new Error("DisputeId tidak ditemukan pada response.");
      }

      await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/dispute/attach`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dispute_id: disputeId || createdData.id }),
        }
      );

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

  const loadingCaseMatchesRoute = String(vc?.id || "") === String(id || "");
  const loadingVariant = loadingCaseMatchesRoute
    ? isWorkspaceValidationCase(vc?.meta)
      ? "workspace"
      : "standard"
    : "generic";

  if (loading) {
    return <ValidationCaseRecordSkeleton variant={loadingVariant} />;
  }

  const status = normalizeStatus(vc?.status);
  const isWorkspaceMode = isWorkspaceValidationCase(vc?.meta);
  const consultationBlocked =
    status === "waiting_owner_response" || status === "on_hold_owner_inactive";
  const sensitivity = sensitivityMeta(vc?.sensitivity_level);
  const consultationStakeRequirement = sensitivityStakeRequirement(
    sensitivity.level,
    vc?.bounty_amount
  );
  const consultationRequested = Boolean(myConsultationRequest?.id);
  const consultationRequestStatus = consultationStatusLabel(myConsultationRequest?.status);
  const consultationButtonDisabled =
    consultationBlocked ||
    consultationRequested ||
    requestConsultationLoading ||
    myConsultationLoading;
  const contactRestricted = sensitivity.level === "S2" || sensitivity.level === "S3";
  const owner = vc?.owner || {};
  const ownerHandle = owner?.username ? `@${owner.username}` : `#${owner?.id || "-"}`;
  const ownerBadge = owner?.primary_badge || null;
  const transferId = vc?.escrow_transfer_id || "";
  const disputeId = vc?.dispute_id || "";
  const artifactId = vc?.artifact_document_id || "";
  const certifiedId = vc?.certified_artifact_document_id || "";
  const acceptedOfferId = Number(vc?.accepted_final_offer_id ?? vc?.acceptedFinalOfferId ?? 0);
  const acceptedOffer = acceptedOfferId
    ? finalOffers.find((offer) => Number(offer?.id) === acceptedOfferId) || null
    : null;
  const assignedValidator =
    (vc?.assigned_validator && vc.assigned_validator.id
      ? vc.assigned_validator
      : acceptedOffer?.validator) || null;
  const isAssignedValidator = Boolean(
    isAuthed &&
    !isOwner &&
    me?.id &&
    assignedValidator?.id &&
    Number(me.id) === Number(assignedValidator.id)
  );
  const hasSubmittedFinalOffer = !isOwner && Array.isArray(finalOffers) && finalOffers.length > 0;
  const disableSubmitFinalOffer = finalOfferSubmitting || offersLoading || hasSubmittedFinalOffer;

  const featureBase = (
    process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id"
  ).replace(/\/+$/, "");
  const certifiedDownloadHref =
    certifiedId && !isSyntheticArtifactMarker(certifiedId)
      ? `${featureBase}${FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD(String(certifiedId))}`
      : "";
  const recordContent = vc?.content_type === "text" ? contentAsText(vc?.content) : vc?.content;
  const caseReadmeMarkdown = (() => {
    const fromStructured = stripLeadingRecordLabel(extractCaseRecordText(recordContent));
    if (fromStructured) return fromStructured;
    if (typeof recordContent === "string") return stripLeadingRecordLabel(recordContent);
    return "";
  })();
  const showSummaryFallback = Boolean(vc?.summary) && !hasOverviewContent(recordContent);
  const filedAtLabel = formatDateTime(vc?.created_at);
  const workflowSummary = workflowSummaryLabel(status, {
    artifactId,
    transferId,
    acceptedFinalOfferId: acceptedOfferId,
  });

  if (vc && isWorkspaceMode) {
    return (
      <main className="container py-10 space-y-6">
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/validation-cases" prefetch={false} className="hover:underline">
            Daftar Case
          </Link>
          <span>/</span>
          <span className="font-mono text-xs text-foreground">#{String(id)}</span>
        </nav>

        {error ? (
          <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detail Case
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="font-mono text-xs text-foreground">#{String(id)}</span>
                  <span className="text-xs text-muted-foreground">Dibuat {filedAtLabel}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {vc?.title || "(tanpa judul)"}
                </h1>
                {vc?.summary && !looksLikeMarkdownText(vc?.summary) ? (
                  <p className="text-sm text-muted-foreground">{vc.summary}</p>
                ) : null}
              </div>

              {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                <TagList tags={vc.tags} size="sm" />
              ) : null}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{ownerHandle}</span>
                <span aria-hidden="true">•</span>
                <span>Sensitivitas {sensitivity.level}</span>
              </div>
            </div>

            <div className="w-full rounded-[var(--radius)] border border-border/70 bg-background px-4 py-4 lg:max-w-xs">
              <div className="text-xs text-muted-foreground">Bounty</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {formatIDR(vc?.bounty_amount)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Nilai hadiah untuk validator terpilih.
              </div>
            </div>
          </div>
        </section>

        <RepoWorkflowClient
          embedded
          caseReadmeMarkdown={caseReadmeMarkdown}
          caseTitle={vc?.title || ""}
          ownerUserId={owner?.id || 0}
          viewerUserId={Number(me?.id || 0)}
        />
      </main>
    );
  }

  return (
    <main className="container py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>/</span>
        <Link href="/validation-cases" prefetch={false} className="hover:underline">
          Daftar Case
        </Link>
        <span>/</span>
        <span className="font-mono text-xs text-foreground">#{String(id)}</span>
      </nav>

      {error ? (
        <div className="mb-6 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {vc ? (
        <article className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
          <div className="lg:col-span-8 space-y-6">
            <header className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detail Case
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="font-mono text-xs text-foreground">#{String(id)}</span>
                  <span className="text-xs text-muted-foreground">Dibuat {filedAtLabel}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {vc?.title || "(tanpa judul)"}
                </h1>
                {showSummaryFallback ? (
                  <p className="text-sm text-muted-foreground">{vc.summary}</p>
                ) : null}
              </div>

              {Array.isArray(vc?.tags) && vc.tags.length > 0 ? (
                <TagList tags={vc.tags} size="sm" />
              ) : null}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{ownerHandle}</span>
                <span aria-hidden="true">•</span>
                <span>Sensitivitas {sensitivity.level}</span>
              </div>
            </header>

            <CaseSection title="Ringkasan Case">
              <ContentTable content={recordContent} />
            </CaseSection>

            <ConsultationPanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              status={status}
              sensitivity={sensitivity}
              consultationBlocked={consultationBlocked}
              consultationStakeRequirement={consultationStakeRequirement}
              consultationRequested={consultationRequested}
              consultationRequestStatus={consultationRequestStatus}
              consultationButtonDisabled={consultationButtonDisabled}
              requestConsultationLoading={requestConsultationLoading}
              myConsultationLoading={myConsultationLoading}
              consultationMsg={consultationMsg}
              contactRestricted={contactRestricted}
              contactLoading={contactLoading}
              contactTelegram={contactTelegram}
              contactTelegramHref={contactTelegramHref}
              contactTelegramLabel={contactTelegramLabel}
              contactMsg={contactMsg}
              onRequestConsultation={requestConsultation}
              onRevealContact={revealContact}
              consultationLoading={consultationLoading}
              consultationRequests={consultationRequests}
              rejectOpen={rejectOpen}
              rejectForms={rejectForms}
              onApproveConsultation={approveConsultation}
              onToggleRejectForm={toggleRejectForm}
              onRejectFormChange={(requestId, value) =>
                setRejectForms((prev) => ({ ...prev, [requestId]: value }))
              }
              onSubmitReject={submitRejectConsultation}
            />

            <FinalOffersPanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              status={status}
              bountyAmount={vc?.bounty_amount}
              offerForm={offerForm}
              finalOfferSubmitting={finalOfferSubmitting}
              disableSubmitFinalOffer={disableSubmitFinalOffer}
              offersLoading={offersLoading}
              offersMsg={offersMsg}
              finalOffers={finalOffers}
              acceptingOfferId={acceptingOfferId}
              hasSubmittedFinalOffer={hasSubmittedFinalOffer}
              transferId={transferId}
              disputeId={disputeId}
              onOfferFormChange={setOfferForm}
              onSubmitFinalOffer={submitFinalOffer}
              onAcceptFinalOffer={acceptFinalOffer}
            />

            <EscrowPanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              isAssignedValidator={isAssignedValidator}
              escrowDraft={escrowDraft}
              transferId={transferId}
              lockFundsPin={lockFundsPin}
              lockFundsLoading={lockFundsLoading}
              lockFundsMsg={lockFundsMsg}
              artifactId={artifactId}
              artifactSubmitting={artifactSubmitting}
              artifactMsg={artifactMsg}
              acceptedFinalOfferId={vc?.accepted_final_offer_id}
              onLockFundsPinChange={setLockFundsPin}
              onLockFunds={lockFunds}
              onSubmitArtifact={submitArtifact}
            />

            <ValidatorResultPanel
              artifactId={artifactId}
              assignedValidator={assignedValidator}
              certifiedId={certifiedId}
              certifiedDownloadHref={certifiedDownloadHref}
            />

            <DisputeAndReleasePanel
              isAuthed={isAuthed}
              isOwner={isOwner}
              artifactId={artifactId}
              certifiedId={certifiedId}
              certifiedDownloadHref={certifiedDownloadHref}
              disputeId={disputeId}
              releasePin={releasePin}
              releaseLoading={releaseLoading}
              releaseMsg={releaseMsg}
              disputeForm={disputeForm}
              disputeLoading={disputeLoading}
              disputeMsg={disputeMsg}
              onReleasePinChange={setReleasePin}
              onApproveAndRelease={approveAndRelease}
              onDisputeFormChange={setDisputeForm}
              onInitiateDispute={initiateDispute}
            />

            <CaseLogPanel
              isAuthed={isAuthed}
              caseLog={caseLog}
              caseLogLoading={caseLogLoading}
              caseLogError={caseLogError}
            />
          </div>

          <CaseMetadataSidebar
            id={id}
            owner={owner}
            ownerBadge={ownerBadge}
            bountyAmount={vc?.bounty_amount}
            status={status}
            sensitivity={sensitivity}
            workflowSummary={workflowSummary}
            filedAtLabel={filedAtLabel}
          />
        </article>
      ) : null}
    </main>
  );
}
