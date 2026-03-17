/**
 * Shared dispute normalizers.
 * Used by both wallet dispute detail and admin dispute detail.
 */

import { unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";

export function normalizeCurrentUser(payload) {
  return {
    id: Number(payload?.id ?? payload?.user_id ?? payload?.userId ?? 0) || 0,
    username: payload?.username ?? payload?.Username ?? "",
  };
}

export function normalizeDisputeMessage(message) {
  return {
    id: message?.id ?? message?.Id ?? "",
    senderId: Number(message?.senderId ?? message?.SenderId ?? 0) || 0,
    senderUsername: message?.senderUsername ?? message?.SenderUsername ?? "User",
    isAdmin: Boolean(message?.isAdmin ?? message?.IsAdmin ?? false),
    content: message?.content ?? message?.Content ?? message?.message ?? "",
    createdAt: message?.createdAt ?? message?.CreatedAt ?? message?.created_at ?? null,
  };
}

export function normalizeDisputeEvidence(evidence) {
  return {
    id: evidence?.id ?? evidence?.Id ?? "",
    description: evidence?.description ?? evidence?.Description ?? "",
    fileUrl: evidence?.fileUrl ?? evidence?.FileUrl ?? evidence?.file_url ?? "",
    createdAt: evidence?.createdAt ?? evidence?.CreatedAt ?? evidence?.created_at ?? null,
    username:
      evidence?.user?.username ??
      evidence?.user?.Username ??
      evidence?.username ??
      evidence?.Username ??
      "User",
  };
}

export function normalizeDispute(payload) {
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
    phaseDeadline: data?.phaseDeadline ?? data?.PhaseDeadline ?? data?.phase_deadline ?? null,
    amount: Number(data?.amount ?? data?.Amount ?? 0) || 0,
    senderId: Number(data?.senderId ?? data?.SenderId ?? 0) || 0,
    receiverId: Number(data?.receiverId ?? data?.ReceiverId ?? 0) || 0,
    senderUsername: data?.senderUsername ?? data?.SenderUsername ?? "Unknown",
    receiverUsername: data?.receiverUsername ?? data?.ReceiverUsername ?? "Unknown",
    resolution: normalizedResolution,
    adminNotes: data?.adminNotes ?? data?.AdminNotes ?? data?.admin_notes ?? data?.Admin_Note ?? "",
    admin_notes:
      data?.adminNotes ?? data?.AdminNotes ?? data?.admin_notes ?? data?.Admin_Note ?? "",
    messages: extractFeatureItems(data?.messages ?? data?.Messages).map(normalizeDisputeMessage),
    evidence: extractFeatureItems(data?.evidence ?? data?.Evidence).map(normalizeDisputeEvidence),
  };
}
