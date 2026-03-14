import { useRef, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";

/**
 * Sub-hook: Consultation request workflow (both owner and non-owner sides).
 *
 * The orchestrator calls loadOwnerWorkflow / loadNonOwnerWorkflow which set
 * consultation state via the exposed setters. The action functions
 * (requestConsultation, approveConsultation, etc.) are self-contained here.
 */
export function useWorkflowConsultation({ id, isAuthed, isOwner, router, loadOwnerWorkflow }) {
  const [consultationRequests, setConsultationRequests] = useState([]);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationMsg, setConsultationMsg] = useState("");
  const [myConsultationRequest, setMyConsultationRequest] = useState(null);
  const [myConsultationLoading, setMyConsultationLoading] = useState(false);
  const [requestConsultationLoading, setRequestConsultationLoading] = useState(false);

  // Inline form states for reject consultation
  const [rejectForms, setRejectForms] = useState({});
  const [rejectOpen, setRejectOpen] = useState({});

  // --- Internal helpers ---

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

  // --- Public action functions ---

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
      setConsultationRequests(prevRequests);
      setConsultationMsg(e?.message || "Gagal menolak");
    }
  }

  return {
    // State (read)
    consultationRequests,
    consultationLoading,
    consultationMsg,
    myConsultationRequest,
    myConsultationLoading,
    requestConsultationLoading,
    rejectForms,
    rejectOpen,

    // Setters (for orchestrator bulk-loading)
    setConsultationRequests,
    setConsultationLoading,
    setConsultationMsg,
    setMyConsultationRequest,
    setMyConsultationLoading,
    setRejectForms,

    // Actions
    requestConsultation,
    approveConsultation,
    toggleRejectForm,
    submitRejectConsultation,
    loadMyConsultationRequest,
  };
}
