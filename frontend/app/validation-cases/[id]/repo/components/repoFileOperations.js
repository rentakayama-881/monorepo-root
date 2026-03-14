/**
 * File operations for repo workspace.
 * Extracted from useRepoWorkflow.js for modularity.
 */

import { getToken } from "@/lib/auth";
import { FEATURE_ENDPOINTS, getFeatureApiBase } from "@/lib/featureApi";
import {
  normalizeErr,
  parseFilenameFromContentDisposition,
  fallbackDownloadFileName,
  inferMimeTypeFromFilename,
} from "./repoWorkflowUtils";

/**
 * Open or download a workspace file via Feature Service.
 * Returns { ok, msg, redirectToLogin } on success or throws on error.
 */
export async function performOpenWorkspaceFile(file, { download = false } = {}) {
  const documentId = String(file?.document_id || "").trim();
  if (!documentId) {
    throw new Error("Document ID tidak ditemukan.");
  }

  const token = getToken();
  if (!token) {
    return { ok: false, redirectToLogin: true };
  }

  const endpointPath = download
    ? FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD(encodeURIComponent(documentId))
    : FEATURE_ENDPOINTS.DOCUMENTS.VIEW(encodeURIComponent(documentId));
  const endpoint = `${getFeatureApiBase()}${endpointPath}`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let detail = "";
    try {
      const payload = await res.clone().json();
      detail = String(payload?.error || payload?.message || "").trim();
    } catch {
      detail = "";
    }
    if (res.status === 403) {
      throw new Error("Akses file ditolak. Pastikan owner sudah memberi akses sesuai sensitivity.");
    }
    throw new Error(detail || `Gagal membuka file (status ${res.status}).`);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition");
  const filename =
    parseFilenameFromContentDisposition(contentDisposition) || fallbackDownloadFileName(file);

  if (download) {
    const objectURL = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectURL;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectURL);
    return { ok: true, msg: `File "${file?.label || documentId}" berhasil diunduh.` };
  }

  const contentType = String(res.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const inferredType =
    !contentType || contentType === "application/octet-stream"
      ? inferMimeTypeFromFilename(filename)
      : "";

  const previewBlob = inferredType ? blob.slice(0, blob.size, inferredType) : blob;
  const objectURL = window.URL.createObjectURL(previewBlob);

  const win = window.open(objectURL, "_blank", "noopener,noreferrer");
  if (!win) {
    window.location.assign(objectURL);
  }
  window.setTimeout(() => window.URL.revokeObjectURL(objectURL), 60_000);
  return { ok: true, msg: `File "${file?.label || documentId}" berhasil dibuka.` };
}
