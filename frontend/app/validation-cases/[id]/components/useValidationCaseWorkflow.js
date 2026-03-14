import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, fetchJsonAuth } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { isWorkspaceValidationCase } from "@/lib/validationCaseWorkflow";
import { formatCaseLogLoadError } from "./validationCaseDetailUtils";

import { useWorkflowCaseLog } from "./workflow-caselog";
import { useWorkflowContact } from "./workflow-contact";
import { useWorkflowConsultation } from "./workflow-consultation";
import { useWorkflowEscrow } from "./workflow-escrow";

export function useValidationCaseWorkflow({ id, initialCaseData, router }) {
  // ── Core state ──────────────────────────────────────────────────────

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

  const isOwner = Boolean(me?.id && vc?.owner?.id && Number(me.id) === Number(vc.owner.id));

  // ── Core helpers (used by sub-hooks) ────────────────────────────────

  const reloadCase = useCallback(
    async ({ showSkeleton = true } = {}) => {
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
    },
    [id]
  );

  const loadMeIfAuthed = useCallback(async () => {
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
  }, [isAuthed]);

  // ── Case log sub-hook ───────────────────────────────────────────────

  const caseLogHook = useWorkflowCaseLog();

  // ── Contact sub-hook ────────────────────────────────────────────────

  const contactHook = useWorkflowContact({ id, isAuthed, router });

  // ── Orchestrated loaders (declared before sub-hooks that depend on them) ──
  // We use refs so that sub-hook closures always call the latest version.

  const loadOwnerWorkflowRef = useRef(null);
  const loadNonOwnerWorkflowRef = useRef(null);

  // Stable wrappers that sub-hooks receive — they delegate through the ref.
  const loadOwnerWorkflow = useMemo(
    () =>
      async function loadOwnerWorkflow() {
        if (loadOwnerWorkflowRef.current) {
          return loadOwnerWorkflowRef.current();
        }
      },
    []
  );
  const loadNonOwnerWorkflow = useMemo(
    () =>
      async function loadNonOwnerWorkflow() {
        if (loadNonOwnerWorkflowRef.current) {
          return loadNonOwnerWorkflowRef.current();
        }
      },
    []
  );

  // ── Consultation sub-hook ───────────────────────────────────────────

  const consultationHook = useWorkflowConsultation({
    id,
    isAuthed,
    isOwner,
    router,
    loadOwnerWorkflow,
  });

  // ── Escrow sub-hook ─────────────────────────────────────────────────

  const escrowHook = useWorkflowEscrow({
    id,
    isAuthed,
    router,
    vc,
    reloadCase,
    loadOwnerWorkflow,
    loadNonOwnerWorkflow,
  });

  // ── Orchestrated bulk-loading functions ─────────────────────────────

  loadOwnerWorkflowRef.current = async function _loadOwnerWorkflow() {
    if (!isAuthed || !id) return;
    if (!isOwner) return;

    consultationHook.setConsultationLoading(true);
    escrowHook.setOffersLoading(true);
    caseLogHook.setCaseLogLoading(true);
    caseLogHook.setCaseLogError("");
    consultationHook.setConsultationMsg("");
    escrowHook.setOffersMsg("");
    escrowHook.setLockFundsMsg("");
    consultationHook.setMyConsultationRequest(null);

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
      consultationHook.setConsultationRequests(
        Array.isArray(reqsResult.value?.consultation_requests)
          ? reqsResult.value.consultation_requests
          : []
      );
    } else {
      consultationHook.setConsultationRequests([]);
    }

    if (offersResult.status === "fulfilled") {
      const offers = offersResult.value;
      escrowHook.setFinalOffers(Array.isArray(offers?.final_offers) ? offers.final_offers : []);

      const acceptedId = vc?.accepted_final_offer_id ?? vc?.acceptedFinalOfferId ?? null;
      const resolvedAcceptedId = acceptedId != null ? Number(acceptedId) : null;
      const resolvedOffers = Array.isArray(offers?.final_offers) ? offers.final_offers : [];
      if (!escrowHook.escrowDraft && resolvedAcceptedId && resolvedOffers.length > 0) {
        const accepted = resolvedOffers.find((o) => Number(o?.id) === resolvedAcceptedId) || null;
        if (accepted?.validator?.username && accepted?.amount) {
          escrowHook.setEscrowDraft({
            receiver_username: accepted.validator.username,
            amount: accepted.amount,
            hold_hours: Number(accepted.hold_hours) || 168,
            message: `Lock Funds: Validation Case #${String(id)}`,
          });
        }
      }
    } else {
      escrowHook.setFinalOffers([]);
    }

    if (logResult.status === "fulfilled") {
      caseLogHook.setCaseLog(
        Array.isArray(logResult.value?.case_log) ? logResult.value.case_log : []
      );
      caseLogHook.setCaseLogError("");
    } else {
      caseLogHook.setCaseLog([]);
      caseLogHook.setCaseLogError(formatCaseLogLoadError(logResult.reason, true));
    }

    consultationHook.setConsultationLoading(false);
    escrowHook.setOffersLoading(false);
    caseLogHook.setCaseLogLoading(false);
  };

  loadNonOwnerWorkflowRef.current = async function _loadNonOwnerWorkflow() {
    if (!isAuthed || !id) return;
    if (isOwner) return;

    escrowHook.setOffersLoading(true);
    caseLogHook.setCaseLogLoading(true);
    consultationHook.setMyConsultationLoading(true);
    caseLogHook.setCaseLogError("");
    escrowHook.setOffersMsg("");

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
      escrowHook.setFinalOffers(
        Array.isArray(offersResult.value?.final_offers) ? offersResult.value.final_offers : []
      );
    } else {
      escrowHook.setFinalOffers([]);
    }

    if (logResult.status === "fulfilled") {
      caseLogHook.setCaseLog(
        Array.isArray(logResult.value?.case_log) ? logResult.value.case_log : []
      );
      caseLogHook.setCaseLogError("");
    } else {
      caseLogHook.setCaseLog([]);
      caseLogHook.setCaseLogError(formatCaseLogLoadError(logResult.reason, false));
    }

    if (myReqResult.status === "fulfilled") {
      consultationHook.setMyConsultationRequest(myReqResult.value?.consultation_request || null);
    } else {
      consultationHook.setMyConsultationRequest(null);
    }

    escrowHook.setOffersLoading(false);
    caseLogHook.setCaseLogLoading(false);
    consultationHook.setMyConsultationLoading(false);
  };

  // ── Effects ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || id === "undefined") return;
    loadMeIfAuthed();
    if (hasHydratedInitialCase.current) {
      hasHydratedInitialCase.current = false;
      reloadCase({ showSkeleton: false });
      return;
    }
    reloadCase({ showSkeleton: true });
  }, [id, reloadCase, loadMeIfAuthed]);

  const vcId = vc?.id;
  const vcMeta = vc?.meta;
  const meId = me?.id;

  useEffect(() => {
    if (!vcId || !meId) return;
    if (!isAuthed) return;
    if (isWorkspaceValidationCase(vcMeta)) {
      return;
    }
    if (isOwner) {
      loadOwnerWorkflowRef.current?.();
    } else {
      loadNonOwnerWorkflowRef.current?.();
    }
  }, [vcId, vcMeta, meId, isAuthed, isOwner]);

  // ── Return identical shape ──────────────────────────────────────────

  return {
    // Core data
    loading,
    error,
    vc,
    me,
    isAuthed,
    isOwner,

    // Consultation
    consultationRequests: consultationHook.consultationRequests,
    consultationLoading: consultationHook.consultationLoading,
    consultationMsg: consultationHook.consultationMsg,
    myConsultationRequest: consultationHook.myConsultationRequest,
    myConsultationLoading: consultationHook.myConsultationLoading,
    requestConsultationLoading: consultationHook.requestConsultationLoading,
    rejectForms: consultationHook.rejectForms,
    setRejectForms: consultationHook.setRejectForms,
    rejectOpen: consultationHook.rejectOpen,
    requestConsultation: consultationHook.requestConsultation,
    approveConsultation: consultationHook.approveConsultation,
    toggleRejectForm: consultationHook.toggleRejectForm,
    submitRejectConsultation: consultationHook.submitRejectConsultation,

    // Contact
    contactTelegram: contactHook.contactTelegram,
    contactMsg: contactHook.contactMsg,
    contactLoading: contactHook.contactLoading,
    contactTelegramHref: contactHook.contactTelegramHref,
    contactTelegramLabel: contactHook.contactTelegramLabel,
    revealContact: contactHook.revealContact,

    // Final offers
    finalOffers: escrowHook.finalOffers,
    offersLoading: escrowHook.offersLoading,
    offersMsg: escrowHook.offersMsg,
    finalOfferSubmitting: escrowHook.finalOfferSubmitting,
    offerForm: escrowHook.offerForm,
    setOfferForm: escrowHook.setOfferForm,
    acceptingOfferId: escrowHook.acceptingOfferId,
    submitFinalOffer: escrowHook.submitFinalOffer,
    acceptFinalOffer: escrowHook.acceptFinalOffer,

    // Escrow
    escrowDraft: escrowHook.escrowDraft,
    lockFundsPin: escrowHook.lockFundsPin,
    setLockFundsPin: escrowHook.setLockFundsPin,
    lockFundsLoading: escrowHook.lockFundsLoading,
    lockFundsMsg: escrowHook.lockFundsMsg,
    lockFunds: escrowHook.lockFunds,

    // Artifact
    artifactSubmitting: escrowHook.artifactSubmitting,
    artifactMsg: escrowHook.artifactMsg,
    submitArtifact: escrowHook.submitArtifact,

    // Release & dispute
    releasePin: escrowHook.releasePin,
    setReleasePin: escrowHook.setReleasePin,
    releaseLoading: escrowHook.releaseLoading,
    releaseMsg: escrowHook.releaseMsg,
    disputeForm: escrowHook.disputeForm,
    setDisputeForm: escrowHook.setDisputeForm,
    disputeLoading: escrowHook.disputeLoading,
    disputeMsg: escrowHook.disputeMsg,
    approveAndRelease: escrowHook.approveAndRelease,
    initiateDispute: escrowHook.initiateDispute,

    // Case log
    caseLog: caseLogHook.caseLog,
    caseLogLoading: caseLogHook.caseLogLoading,
    caseLogError: caseLogHook.caseLogError,
  };
}
