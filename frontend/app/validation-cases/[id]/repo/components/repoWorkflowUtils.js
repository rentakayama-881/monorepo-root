/**
 * Pure utility functions for the Repo Workflow feature.
 * No React, no side effects.
 */

export function normalizeErr(err, fallback) {
  const message = String(err?.message || fallback || "Terjadi kesalahan").trim();
  const details = String(err?.details || "").trim();
  if (!details) return message;
  return `${message}: ${details}`;
}

export function parseFilenameFromContentDisposition(contentDisposition) {
  const raw = String(contentDisposition || "").trim();
  if (!raw) return "";
  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return String(utf8Match[1]).trim();
    }
  }
  const asciiMatch = raw.match(/filename="?([^"]+)"?/i);
  if (asciiMatch?.[1]) return String(asciiMatch[1]).trim();
  return "";
}

export function fallbackDownloadFileName(file) {
  const label = String(file?.label || "").trim();
  const documentId = String(file?.document_id || "").trim();
  const safeLabel = label
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (safeLabel) return safeLabel;
  if (documentId) return `workspace-file-${documentId}`;
  return "workspace-file";
}

export function fileExtensionFromName(name) {
  const value = String(name || "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  const idx = value.lastIndexOf(".");
  if (idx <= 0 || idx >= value.length - 1) return "";
  return value.slice(idx + 1);
}

export function inferMimeTypeFromFilename(name) {
  const ext = fileExtensionFromName(name);
  if (!ext) return "";

  const map = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    xml: "application/xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };

  return map[ext] || "";
}

export function extractDocumentId(uploadResult) {
  if (!uploadResult || typeof uploadResult !== "object") return "";
  const candidates = [
    uploadResult.document_id,
    uploadResult.documentId,
    uploadResult.id,
    uploadResult.DocumentId,
    uploadResult.DocumentID,
    uploadResult.ID,
    uploadResult?.data?.document_id,
    uploadResult?.data?.documentId,
    uploadResult?.data?.id,
    uploadResult?.data?.DocumentId,
    uploadResult?.data?.DocumentID,
    uploadResult?.data?.ID,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
}

export function legacyWorkspacePath(path) {
  switch (path) {
    case "files":
      return "repo/files";
    case "validators/assign":
      return "validators/assign";
    case "confidence/vote":
      return "confidence/vote";
    case "finalize":
      return "finalize";
    default:
      return path;
  }
}

export function extractRepoTree(payload) {
  if (payload && typeof payload === "object") {
    if (payload.repo_tree && typeof payload.repo_tree === "object") {
      return payload.repo_tree;
    }
    if (payload.case_id && payload.files) {
      return payload;
    }
  }
  return null;
}
