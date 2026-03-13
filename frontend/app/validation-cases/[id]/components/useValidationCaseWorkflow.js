import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { isWorkspaceValidationCase } from "@/lib/validationCaseWorkflow";
import {
  normalizeStatus,
  formatCaseLogLoadError,
  resolveTelegramContactHref,
  formatTelegramContactLabel,
} from "./validationCaseDetailUtils";

export function useValidationCaseWorkflow({ id, initialCaseData, router }) {
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

  return {
    // Core data
    loading,
    error,
    vc,
    me,
    isAuthed,
    isOwner,

    // Consultation
    consultationRequests,
    consultationLoading,
    consultationMsg,
    myConsultationRequest,
    myConsultationLoading,
    requestConsultationLoading,
    rejectForms,
    setRejectForms,
    rejectOpen,
    requestConsultation,
    approveConsultation,
    toggleRejectForm,
    submitRejectConsultation,

    // Contact
    contactTelegram,
    contactMsg,
    contactLoading,
    contactTelegramHref,
    contactTelegramLabel,
    revealContact,

    // Final offers
    finalOffers,
    offersLoading,
    offersMsg,
    finalOfferSubmitting,
    offerForm,
    setOfferForm,
    acceptingOfferId,
    submitFinalOffer,
    acceptFinalOffer,

    // Escrow
    escrowDraft,
    lockFundsPin,
    setLockFundsPin,
    lockFundsLoading,
    lockFundsMsg,
    lockFunds,

    // Artifact
    artifactSubmitting,
    artifactMsg,
    submitArtifact,

    // Release & dispute
    releasePin,
    setReleasePin,
    releaseLoading,
    releaseMsg,
    disputeForm,
    setDisputeForm,
    disputeLoading,
    disputeMsg,
    approveAndRelease,
    initiateDispute,

    // Case log
    caseLog,
    caseLogLoading,
    caseLogError,
  };
}
