/**
 * Custom hooks for Documents API (Feature Service)
 * Handles document storage, stats, and CRUD operations
 */
import { useState, useEffect, useCallback } from "react";
import { fetchFeature, fetchFeatureAuth, FEATURE_ENDPOINTS, getFeatureApiBase } from "./featureApi";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Document categories
 */
export const DOCUMENT_CATEGORIES = [
  { value: "whitepaper", label: "Whitepaper" },
  { value: "article", label: "Artikel" },
  { value: "research", label: "Riset" },
  { value: "other", label: "Lainnya" },
];

/**
 * Document visibility options
 */
export const DOCUMENT_VISIBILITY = [
  { value: "public", label: "Publik" },
  { value: "private", label: "Privat" },
];

/**
 * Hook for fetching document stats (storage usage)
 * @param {object} options
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ stats, loading, error, refetch }}
 */
export function useDocumentStats(options = {}) {
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalSize: 0,
    maxSize: 104857600, // 100MB default
    usedPercentage: 0,
  });
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.DOCUMENTS.STATS);

      if (result.success) {
        const data = result.data || {};
        setStats({
          totalDocuments: data.totalDocuments || 0,
          totalSize: data.totalSize || 0,
          maxSize: data.maxSize || 104857600,
          usedPercentage: data.maxSize ? Math.round((data.totalSize / data.maxSize) * 100) : 0,
        });
      } else {
        throw new Error(result.message || "Failed to load document statistics");
      }
    } catch (err) {
      logger.error("Document Stats Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!options.skip) {
      fetchStats();
    }
  }, [options.skip, fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook for fetching user's documents
 * @param {object} options
 * @param {string} options.category - Filter by category
 * @param {string} options.visibility - Filter by visibility
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ documents, loading, error, refetch }}
 */
export function useDocuments(options = {}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (options.category) queryParams.set("category", options.category);
      if (options.visibility) queryParams.set("visibility", options.visibility);

      const endpoint = `${FEATURE_ENDPOINTS.DOCUMENTS.LIST}?${queryParams}`;
      const result = await fetchFeatureAuth(endpoint);

      if (result.success) {
        setDocuments(result.data || []);
      } else {
        throw new Error(result.message || "Failed to load documents");
      }
    } catch (err) {
      logger.error("Documents Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.category, options.visibility]);

  useEffect(() => {
    if (!options.skip) {
      fetchDocuments();
    }
  }, [options.skip, fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}

/**
 * Hook for uploading a document
 * @returns {{ uploadDocument, loading, error, progress }}
 */
export function useUploadDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const uploadDocument = useCallback(
    async (file, { title, description = "", category = "other", visibility = "private", tags = [] }) => {
      const token = getToken();
      if (!token) {
        throw new Error("Authentication required to upload document");
      }

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Hanya file PDF dan DOCX yang diizinkan");
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("Ukuran file maks 10MB");
      }

      setLoading(true);
      setError(null);
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("visibility", visibility);
        if (tags.length > 0) {
          formData.append("tags", tags.join(","));
        }

        // Use XMLHttpRequest for progress tracking
        const result = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setProgress(percent);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                resolve({ success: true });
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.message || `Upload failed: ${xhr.status}`));
              } catch {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Failed to upload document"));
          });

          xhr.open("POST", `${getFeatureApiBase()}${FEATURE_ENDPOINTS.DOCUMENTS.UPLOAD}`);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.send(formData);
        });

        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.message || "Failed to upload document");
        }
      } catch (err) {
        logger.error("Upload Document Error:", err.message);
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
        setProgress(0);
      }
    },
    []
  );

  return { uploadDocument, loading, error, progress };
}

/**
 * Hook for deleting a document
 * @returns {{ deleteDocument, loading, error }}
 */
export function useDeleteDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteDocument = useCallback(async (documentId) => {
    const token = getToken();
    if (!token) {
      throw new Error("Authentication required to delete document");
    }

    setLoading(true);
    setError(null);

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.DOCUMENTS.DELETE(documentId), {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      logger.error("Delete Document Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteDocument, loading, error };
}

/**
 * Format file size to human readable
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
