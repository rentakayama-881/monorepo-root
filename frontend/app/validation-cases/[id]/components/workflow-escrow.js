import { useRef, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { normalizeStatus } from "./validationCaseDetailUtils";

/**
 * Sub-hook: Escrow-related workflow — final offers, lock funds, artifact,
 * release, and dispute.
 *
 * The orchestrator populates offer/escrow state during bulk-loading via
 * the exposed setters.
 */
export function useWorkflowEscrow({
  id,
  isAuthed,
  router,
  vc,
  reloadCase,
  loadOwnerWorkflow,
  loadNonOwnerWorkflow,
}) {
  // --- Final offers ---
  const [finalOffers, setFinalOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersMsg, setOffersMsg] = useState("");
  const [finalOfferSubmitting, setFinalOfferSubmitting] = useState(false);
  const [offerForm, setOfferForm] = useState({ hold_hours: 168, terms: "" });
  const finalOfferSubmitRef = useRef(false);
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);
  const acceptFinalOfferRef = useRef(false);

  // --- Escrow ---
  const [escrowDraft, setEscrowDraft] = useState(null);
  const [lockFundsPin, setLockFundsPin] = useState("");
  const [lockFundsLoading, setLockFundsLoading] = useState(false);
  const [lockFundsMsg, setLockFundsMsg] = useState("");
  const lockFundsSubmitRef = useRef(false);

  // --- Artifact ---
  const [artifactSubmitting, setArtifactSubmitting] = useState(false);
  const [artifactMsg, setArtifactMsg] = useState("");

  // --- Release ---
  const [releasePin, setReleasePin] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState("");

  // --- Dispute ---
  const [disputeForm, setDisputeForm] = useState({ category: "ItemNotAsDescribed", reason: "" });
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState("");

  // ── Action functions ──────────────────────────────────────────────────

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
    // Final offers (read)
    finalOffers,
    offersLoading,
    offersMsg,
    finalOfferSubmitting,
    offerForm,
    acceptingOfferId,

    // Final offers (setters for orchestrator)
    setFinalOffers,
    setOffersLoading,
    setOffersMsg,
    setOfferForm,

    // Escrow (read)
    escrowDraft,
    lockFundsPin,
    lockFundsLoading,
    lockFundsMsg,

    // Escrow (setters for orchestrator)
    setEscrowDraft,
    setLockFundsPin,
    setLockFundsMsg,

    // Artifact (read)
    artifactSubmitting,
    artifactMsg,

    // Release (read + setters)
    releasePin,
    setReleasePin,
    releaseLoading,
    releaseMsg,

    // Dispute (read + setters)
    disputeForm,
    setDisputeForm,
    disputeLoading,
    disputeMsg,

    // Actions
    submitFinalOffer,
    acceptFinalOffer,
    lockFunds,
    submitArtifact,
    approveAndRelease,
    initiateDispute,
  };
}
