"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import {
  useDocuments,
  useDocumentStats,
  useUploadDocument,
  useDeleteDocument,
  formatFileSize,
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITY,
} from "@/lib/useDocuments";
import NativeSelect from "@/components/ui/NativeSelect";

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Handle upload=true query param
  useEffect(() => {
    if (searchParams.get("upload") === "true") {
      setShowUploadModal(true);
      // Remove query param
      router.replace("/documents");
    }
  }, [searchParams, router]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [uploadForm, setUploadForm] = useState({
    file: null,
    title: "",
    description: "",
    category: "other",
    visibility: "private",
  });

  const fileInputRef = useRef(null);

  // Hooks
  const { documents, loading: docsLoading, error: docsError, refetch: refetchDocs } = useDocuments({
    category: selectedCategory || undefined,
  });
  const { stats, loading: statsLoading, refetch: refetchStats } = useDocumentStats();
  const { uploadDocument, loading: uploading, progress } = useUploadDocument();
  const { deleteDocument, loading: deleting } = useDeleteDocument();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login?redirect=/documents");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadForm((prev) => ({
        ...prev,
        file,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title) return;

    try {
      await uploadDocument(uploadForm.file, {
        title: uploadForm.title,
        description: uploadForm.description,
        category: uploadForm.category,
        visibility: uploadForm.visibility,
      });
      
      setShowUploadModal(false);
      setUploadForm({
        file: null,
        title: "",
        description: "",
        category: "other",
        visibility: "private",
      });
      refetchDocs();
      refetchStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Hapus "${doc.title}"?`)) return;
    
    try {
      await deleteDocument(doc.id);
      refetchDocs();
      refetchStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes("pdf")) {
      return (
        <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 8V3l5 5h-5zm-2 4v6h-2v-6h2zm-4 2v4H6v-4h2zm8 2v2h-2v-2h2z"/>
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 8V3l5 5h-5zm-5 4h6v2H9v-2zm0 4h6v2H9v-2z"/>
      </svg>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
                <p className="text-sm text-muted-foreground">Simpan dan kelola dokumen Anda</p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Storage Stats */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Storage Usage</span>
            <span className="text-sm text-muted-foreground">
              {statsLoading ? "..." : `${formatFileSize(stats.totalSize)} / ${formatFileSize(stats.maxSize)}`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${statsLoading ? 0 : stats.usedPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {statsLoading ? "..." : `${stats.totalDocuments} documents`}
            </span>
            <span className="text-xs text-muted-foreground">
              {statsLoading ? "..." : `${stats.usedPercentage}% used`}
            </span>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === ""
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Semua
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Documents Grid */}
        {docsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : docsError ? (
          <div className="text-center py-12">
            <p className="text-destructive">{docsError}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Belum ada dokumen</h3>
            <p className="text-muted-foreground mb-4">Upload dokumen pertama Anda</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Dokumen
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {getFileIcon(doc.mimeType)}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.size)} • {new Date(doc.createdAt).toLocaleDateString("id-ID")}
                    </p>
                    {doc.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      doc.visibility === "public" 
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {doc.visibility === "public" ? "Publik" : "Privat"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deleting}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Hapus"
                    >
                      <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Upload Dokumen</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Input */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {uploadForm.file ? (
                  <div className="flex items-center justify-center gap-3">
                    {getFileIcon(uploadForm.file.type)}
                    <div className="text-left">
                      <p className="font-medium text-foreground">{uploadForm.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(uploadForm.file.size)}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 mx-auto text-muted-foreground mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-muted-foreground">Klik untuk memilih file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX (maks 10MB)</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Judul</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Judul dokumen"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Deskripsi</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi singkat (opsional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Category & Visibility */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Kategori</label>
                  <NativeSelect
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="h-10 rounded-lg bg-background"
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Visibilitas</label>
                  <NativeSelect
                    value={uploadForm.visibility}
                    onChange={(e) => setUploadForm((prev) => ({ ...prev, visibility: e.target.value }))}
                    className="h-10 rounded-lg bg-background"
                  >
                    {DOCUMENT_VISIBILITY.map((vis) => (
                      <option key={vis.value} value={vis.value}>{vis.label}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Progress */}
              {uploading && (
                <div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1">Uploading... {progress}%</p>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!uploadForm.file || !uploadForm.title || uploading}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
