"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import NativeSelect from "@/components/ui/NativeSelect";
import Skeleton from "@/components/ui/Skeleton";
import { TagList } from "@/components/ui/TagPill";
import ValidationCaseRecordSkeleton from "./ValidationCaseRecordSkeleton";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { formatIDR, formatDateTime } from "@/lib/format";
import { isWorkspaceValidationCase } from "@/lib/validationCaseWorkflow";
import RepoWorkflowClient from "./repo/RepoWorkflowClient";
import {
  formatHoldWindow,
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

            <CaseSection title="Permintaan Konsultasi" subtitle="Protokol">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">Aturan</div>
                  <ul className="mt-2 list-disc pl-5">
                    <li>
                      Stake rule: S0 tanpa minimum stake, S1 minimal Rp 100.000, S2 minimal Rp
                      500.000, S3 minimal sama dengan bounty case.
                    </li>
                    <li>
                      Kontak Telegram dibuka privat setelah persetujuan pemilik kasus dan dicatat
                      pada Case Log.
                    </li>
                    <li>
                      Jika validator meminta klarifikasi, status menjadi WAITING_OWNER_RESPONSE
                      dengan SLA owner 12 jam.
                    </li>
                    <li>
                      Jika owner tidak merespons sampai SLA habis, kasus auto ON_HOLD_OWNER_INACTIVE
                      tanpa reassignment validator.
                    </li>
                  </ul>
                </div>
                <div className="md:border-l md:border-border md:pl-6">
                  {!isAuthed ? (
                    <div className="text-sm text-muted-foreground">
                      Login diperlukan untuk mengajukan konsultasi.
                      <div className="mt-3">
                        <Link
                          href="/login"
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          Masuk
                        </Link>
                      </div>
                    </div>
                  ) : isOwner ? (
                    <div className="text-sm text-muted-foreground">
                      Anda adalah pemilik case ini. Kelola permintaan konsultasi pada bagian
                      berikutnya.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Button
                        onClick={requestConsultation}
                        variant={consultationRequested ? "secondary" : "gradient"}
                        loading={requestConsultationLoading}
                        disabled={consultationButtonDisabled}
                        className={
                          consultationRequested
                            ? "border border-primary/30 bg-primary/10 text-primary disabled:opacity-100"
                            : ""
                        }
                      >
                        {consultationRequested ? "Permintaan Terkirim" : "Ajukan Konsultasi"}
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {consultationStakeRequirement}
                      </div>
                      {consultationRequested ? (
                        <div className="text-xs text-primary">
                          Status request Anda: {consultationRequestStatus}.
                        </div>
                      ) : null}
                      {consultationBlocked ? (
                        <div className="text-xs text-muted-foreground">
                          Permintaan baru ditutup sementara karena kasus menunggu respons owner atau
                          sedang on-hold owner inactive.
                        </div>
                      ) : null}
                      {myConsultationLoading ? (
                        <div className="w-44">
                          <Skeleton className="h-3.5 w-44" />
                        </div>
                      ) : null}
                      {consultationMsg ? (
                        <div className="text-xs text-muted-foreground">{consultationMsg}</div>
                      ) : null}

                      <div className="h-px bg-border" />

                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Kontak Privat
                      </div>
                      {contactRestricted ? (
                        <div className="text-xs text-muted-foreground">
                          Telegram private contact dinonaktifkan untuk tier {sensitivity.level} (
                          {sensitivity.label}).
                        </div>
                      ) : null}
                      <Button
                        onClick={revealContact}
                        variant="outline"
                        disabled={contactLoading || contactRestricted}
                      >
                        {contactLoading ? "Membuka..." : "Buka Telegram (Privat)"}
                      </Button>
                      {contactTelegram ? (
                        <div className="text-sm">
                          <a
                            href={contactTelegramHref || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary hover:underline"
                          >
                            {contactTelegramLabel}
                          </a>
                        </div>
                      ) : null}
                      {contactMsg ? (
                        <div className="text-xs text-muted-foreground">{contactMsg}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </CaseSection>

            {isAuthed && isOwner && (status === "open" || status === "waiting_owner_response") ? (
              <CaseSection title="Daftar Permintaan Konsultasi" subtitle="Tinjauan Owner">
                {consultationLoading ? (
                  <div
                    className="rounded-[var(--radius)] border border-border/70 bg-background p-4"
                    aria-busy="true"
                    aria-live="polite"
                  >
                    <div className="grid grid-cols-6 gap-3 border-b border-border pb-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={`consult-head-${i}`} className="h-3.5 w-16" />
                      ))}
                    </div>
                    <div className="space-y-3 pt-3">
                      {Array.from({ length: 3 }).map((_, row) => (
                        <div key={`consult-row-${row}`} className="grid grid-cols-6 gap-3">
                          {Array.from({ length: 6 }).map((__, col) => (
                            <Skeleton key={`consult-cell-${row}-${col}`} className="h-4 w-full" />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : consultationRequests.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Belum ada Request Consultation.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-sm">
                      <thead className="bg-secondary/60 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            Validator
                          </th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            Match Score
                          </th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            Filed
                          </th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            SLA Due
                          </th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {consultationRequests.map((r) => (
                          <tr key={String(r.id)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar
                                  src={r?.validator?.avatar_url}
                                  name={r?.validator?.username || ""}
                                  size="xs"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      href={
                                        r?.validator?.username
                                          ? `/user/${encodeURIComponent(r.validator.username)}`
                                          : "#"
                                      }
                                      className="truncate font-semibold text-foreground hover:underline"
                                    >
                                      @{r?.validator?.username || "-"}
                                    </Link>
                                    {r?.validator?.primary_badge ? (
                                      <Badge badge={r.validator.primary_badge} size="xs" />
                                    ) : null}
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
                                    D:{Number(r.matching_score.domain_fit || 0)} E:
                                    {Number(r.matching_score.evidence_fit || 0)} H:
                                    {Number(r.matching_score.history_dispute || 0)} R:
                                    {Number(r.matching_score.responsiveness_sla || 0)} S:
                                    {Number(r.matching_score.stake_guarantee || 0)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {String(r.status || "")}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {formatDateTime(r.created_at)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {r?.owner_response_due_at
                                ? formatDateTime(r.owner_response_due_at)
                                : "-"}
                              {Number(r?.reminder_count || 0) > 0 ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  reminder: {Number(r.reminder_count)}
                                </div>
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
                                        onChange={(e) =>
                                          setRejectForms((prev) => ({
                                            ...prev,
                                            [r.id]: e.target.value,
                                          }))
                                        }
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
                {consultationMsg ? (
                  <div className="mt-3 text-xs text-muted-foreground">{consultationMsg}</div>
                ) : null}
              </CaseSection>
            ) : null}

            <CaseSection title="Penawaran Final" subtitle="Kontrak">
              {isAuthed && !isOwner && status === "open" ? (
                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground">Submission Notes</div>
                    <ul className="mt-2 list-disc pl-5">
                      <li>
                        Amount Final Offer mengikuti bounty_amount pada Validation Case (fixed).
                      </li>
                      <li>
                        Validator memilih hold window (auto-release) dan terms yang dapat diaudit.
                      </li>
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
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {formatIDR(vc?.bounty_amount)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Sesuai bounty_amount (tidak dapat diubah di Final Offer).
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Hold window
                        </label>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => setOfferForm((f) => ({ ...f, hold_hours: 32 }))}
                            disabled={disableSubmitFinalOffer}
                            className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                              Number(offerForm.hold_hours) === 32
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-foreground hover:border-primary"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="text-sm font-semibold">1 hari 8 jam</div>
                            <div className="text-[11px] opacity-70">Tugas ringan</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfferForm((f) => ({ ...f, hold_hours: 168 }))}
                            disabled={disableSubmitFinalOffer}
                            className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                              Number(offerForm.hold_hours) === 168
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-foreground hover:border-primary"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="text-sm font-semibold">7 hari</div>
                            <div className="text-[11px] opacity-70">Standar</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfferForm((f) => ({ ...f, hold_hours: 720 }))}
                            disabled={disableSubmitFinalOffer}
                            className={`rounded-[var(--radius)] border px-3 py-2 text-left transition ${
                              Number(offerForm.hold_hours) === 720
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-foreground hover:border-primary"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="text-sm font-semibold">30 hari</div>
                            <div className="text-[11px] opacity-70">Kasus kompleks</div>
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Dana auto-release ketika hold berakhir jika tidak ada Dispute.
                        </div>
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
                        disabled={disableSubmitFinalOffer}
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={submitFinalOffer}
                        disabled={disableSubmitFinalOffer}
                        className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                      >
                        {hasSubmittedFinalOffer
                          ? "Sudah Dikirim"
                          : finalOfferSubmitting
                            ? "Mengirim..."
                            : "Kirim"}
                      </button>
                    </div>
                    {offersMsg ? (
                      <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {offersLoading ? (
                <div
                  className="rounded-[var(--radius)] border border-border/70 bg-background p-4"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="grid grid-cols-6 gap-3 border-b border-border pb-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={`offer-head-${i}`} className="h-3.5 w-16" />
                    ))}
                  </div>
                  <div className="space-y-3 pt-3">
                    {Array.from({ length: 3 }).map((_, row) => (
                      <div key={`offer-row-${row}`} className="grid grid-cols-6 gap-3">
                        {Array.from({ length: 6 }).map((__, col) => (
                          <Skeleton key={`offer-cell-${row}-${col}`} className="h-4 w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : finalOffers.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada Final Offer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full text-sm">
                    <thead className="bg-secondary/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                          Validator
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                          Hold
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                          Terms
                        </th>
                        {isAuthed && isOwner ? (
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-[11px]">
                            Action
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {finalOffers.map((o) => (
                        <tr key={String(o.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={o?.validator?.avatar_url}
                                name={o?.validator?.username || ""}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={
                                      o?.validator?.username
                                        ? `/user/${encodeURIComponent(o.validator.username)}`
                                        : "#"
                                    }
                                    className="truncate font-semibold text-foreground hover:underline"
                                  >
                                    @{o?.validator?.username || "-"}
                                  </Link>
                                  {o?.validator?.primary_badge ? (
                                    <Badge badge={o.validator.primary_badge} size="xs" />
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {formatIDR(o.amount)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {formatHoldWindow(o.hold_hours)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {String(o.status || "")}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {o?.terms ? (
                              <div className="line-clamp-3 whitespace-pre-wrap">{o.terms}</div>
                            ) : (
                              "-"
                            )}
                          </td>
                          {isAuthed && isOwner ? (
                            <td className="px-4 py-3">
                              {normalizeStatus(o.status) === "submitted" &&
                              !transferId &&
                              !disputeId ? (
                                <button
                                  onClick={() => acceptFinalOffer(o.id)}
                                  className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={acceptingOfferId !== null}
                                  type="button"
                                >
                                  {Number(acceptingOfferId) === Number(o.id)
                                    ? "Memproses..."
                                    : "Terima"}
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

              {isAuthed && isOwner && offersMsg ? (
                <div className="mt-3 text-xs text-muted-foreground">{offersMsg}</div>
              ) : null}
            </CaseSection>

            {isAuthed && isOwner && (escrowDraft || vc?.accepted_final_offer_id) ? (
              <CaseSection title="Kunci Dana" subtitle="Escrow">
                {transferId ? (
                  <div className="text-sm text-muted-foreground">
                    Escrow terpasang.
                    <div className="mt-2 font-mono text-xs text-foreground">
                      transfer_id: {String(transferId)}
                    </div>
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
                              <td className="px-4 py-3 font-semibold text-foreground">
                                <Link
                                  href={`/user/${encodeURIComponent(escrowDraft.receiver_username)}`}
                                  prefetch={false}
                                  className="hover:underline hover:text-primary"
                                >
                                  @{escrowDraft.receiver_username}
                                </Link>
                              </td>
                            </tr>
                            <tr>
                              <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Jumlah
                              </th>
                              <td className="px-4 py-3 font-semibold text-foreground">
                                {formatIDR(escrowDraft.amount)}
                              </td>
                            </tr>
                            <tr>
                              <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Hold
                              </th>
                              <td className="px-4 py-3 text-muted-foreground">
                                {Math.round((Number(escrowDraft.hold_hours) || 0) / 24)} hari
                              </td>
                            </tr>
                            <tr>
                              <th className="w-40 bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Pesan
                              </th>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {escrowDraft.message}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Wallet PIN
                        </label>
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
                          {lockFundsLoading ? "Mengunci..." : "Kunci Dana"}
                        </button>
                      </div>
                    </div>

                    {lockFundsMsg ? (
                      <div className="text-xs text-muted-foreground">{lockFundsMsg}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Tidak ada escrow draft. Langkah ini aktif setelah Final Offer diterima.
                  </div>
                )}
              </CaseSection>
            ) : null}

            {isAuthed && !isOwner && transferId && isAssignedValidator ? (
              <CaseSection title="Konfirmasi Pengiriman" subtitle="Penyerahan">
                {artifactId ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    Artifact submission sudah tercatat dan menunggu keputusan owner.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Tidak perlu upload file. Klik konfirmasi ini setelah deliverable selesai
                      dikirim via Telegram.
                    </div>
                    <button
                      onClick={submitArtifact}
                      className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      disabled={artifactSubmitting}
                      type="button"
                    >
                      {artifactSubmitting ? "Submitting..." : "Confirm Delivery"}
                    </button>
                    {artifactMsg ? (
                      <div className="text-xs text-muted-foreground">{artifactMsg}</div>
                    ) : null}
                  </div>
                )}
              </CaseSection>
            ) : null}

            {artifactId && assignedValidator ? (
              <CaseSection title="Validator Terpilih" subtitle="Hasil Terkirim">
                <div className="flex items-center gap-3 rounded-[6px] border border-border/70 bg-secondary/20 px-3 py-3">
                  <Avatar
                    src={assignedValidator?.avatar_url}
                    name={assignedValidator?.username || ""}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={
                          assignedValidator?.username
                            ? `/user/${encodeURIComponent(assignedValidator.username)}`
                            : "#"
                        }
                        prefetch={false}
                        className="truncate text-sm font-semibold text-foreground hover:underline"
                      >
                        @{assignedValidator?.username || "-"}
                      </Link>
                      {assignedValidator?.primary_badge ? (
                        <Badge badge={assignedValidator.primary_badge} size="xs" />
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">Hasil kerja dikirim</div>
                  </div>
                </div>
              </CaseSection>
            ) : null}

            {isAuthed && isOwner && artifactId ? (
              <CaseSection title="Keputusan / Dispute" subtitle="Arbitrase">
                {certifiedId ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground">Certified Artifact</div>
                    <div className="font-mono text-xs text-foreground">
                      document_id: {String(certifiedId)}
                    </div>
                    {certifiedDownloadHref ? (
                      <a
                        href={certifiedDownloadHref}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Unduh Artifact Tersertifikasi
                      </a>
                    ) : null}
                  </div>
                ) : disputeId ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground">Dispute</div>
                    <div className="font-mono text-xs text-foreground">
                      dispute_id: {String(disputeId)}
                    </div>
                    <Link
                      href="/account/wallet/disputes"
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Buka Pusat Sengketa
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Approve</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Jika deliverable memenuhi Final Offer, lakukan release escrow. Jika tidak
                        ditekan manual, dana tetap auto-release saat hold window berakhir.
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Wallet PIN
                          </label>
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
                            {releaseLoading ? "Melepas..." : "Lepas Escrow"}
                          </button>
                        </div>
                      </div>
                      {releaseMsg ? (
                        <div className="mt-3 text-xs text-muted-foreground">{releaseMsg}</div>
                      ) : null}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-foreground">Dispute</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Jika Anda menolak Artifact Submission, ajukan Dispute. Admin akan meninjau
                        Final Offer dan Artifact Submission.
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Type
                          </label>
                          <NativeSelect
                            value={disputeForm.category}
                            onChange={(e) =>
                              setDisputeForm((f) => ({ ...f, category: e.target.value }))
                            }
                            className="mt-1 h-10"
                          >
                            <option value="ItemNotAsDescribed">Artifact tidak sesuai terms</option>
                            <option value="ItemNotReceived">Artifact tidak diterima</option>
                            <option value="Fraud">Fraud / misrepresentation</option>
                            <option value="SellerNotResponding">Validator tidak responsif</option>
                            <option value="Other">Other</option>
                          </NativeSelect>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Reason
                          </label>
                          <textarea
                            value={disputeForm.reason}
                            onChange={(e) =>
                              setDisputeForm((f) => ({ ...f, reason: e.target.value }))
                            }
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
                          {disputeLoading ? "Mengirim..." : "Ajukan Dispute"}
                        </button>
                      </div>
                      {disputeMsg ? (
                        <div className="mt-3 text-xs text-muted-foreground">{disputeMsg}</div>
                      ) : null}
                    </div>
                  </div>
                )}
              </CaseSection>
            ) : null}

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
