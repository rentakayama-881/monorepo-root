"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
  extractFeatureItems,
} from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

function normalizeDispute(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    status: item?.status ?? item?.Status ?? "open",
    phase: item?.phase ?? item?.Phase ?? "negotiation",
    reason: item?.reason ?? item?.Reason ?? "",
    amount: Number(item?.amount ?? item?.Amount ?? 0) || 0,
    createdAt: item?.createdAt ?? item?.CreatedAt ?? item?.created_at ?? null,
    phaseDeadline:
      item?.phaseDeadline ?? item?.PhaseDeadline ?? item?.phase_deadline ?? null,
  };
}

export default function DisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      setLoading(true);
      try {
        const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.DISPUTES.LIST);
        const disputeData = unwrapFeatureData(response);
        const items = extractFeatureItems(disputeData)
          .map(normalizeDispute)
          .filter((d) => d.id);
        setDisputes(items);
      } catch (e) {
        logger.error("Failed to load disputes:", e);
        setDisputes([]);
      }
      setLoading(false);
    }

    loadData();
  }, [router]);

  const getStatusBadge = (status, phase) => {
    const normalizedStatus = status?.toLowerCase() || "open";
    const phaseStyles = {
      negotiation: "bg-warning/10 text-warning border-warning/30",
      evidence: "bg-accent text-accent-foreground border-border",
      admin_review: "bg-primary/10 text-primary border-primary/30",
    };
    const statusStyles = {
      open: phaseStyles[phase] || phaseStyles.negotiation,
      resolved: "bg-success/10 text-success border-success/30",
      closed: "bg-muted/60 text-muted-foreground border-border",
    };
    const phaseLabels = {
      negotiation: "Negosiasi",
      evidence: "Bukti",
      admin_review: "Admin Review",
    };
    const label = normalizedStatus === "open" ? phaseLabels[phase] || "Aktif" : normalizedStatus === "resolved" ? "Selesai" : "Ditutup";
    return (
      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[normalizedStatus] || statusStyles.open}`}>
        {label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Tanggal tidak tersedia";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Tanggal tidak valid";
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filter uses case-insensitive comparison
  const activeDisputes = disputes.filter((d) => d.status?.toLowerCase() === "open");
  const resolvedDisputes = disputes.filter((d) => d.status?.toLowerCase() !== "open");

  const displayDisputes = activeTab === "active" ? activeDisputes : resolvedDisputes;

  return (
    <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Dispute Center</h1>
            <p className="text-sm text-muted-foreground">
              Kelola sengketa transaksi Anda
            </p>
          </div>

          {/* Info Card */}
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-primary mb-1">Proses Dispute</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><strong>Negosiasi</strong> - Diskusi dengan pihak lain (24 jam)</li>
                  <li><strong>Bukti</strong> - Upload bukti pendukung (48 jam)</li>
                  <li><strong>Admin Review</strong> - Tim kami akan memutuskan</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "active"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Aktif ({activeDisputes.length})
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "resolved"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Selesai ({resolvedDisputes.length})
            </button>
          </div>

          {/* Disputes List */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Memuat...</div>
          ) : displayDisputes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎉</div>
              <div className="text-muted-foreground">
                {activeTab === "active"
                  ? "Tidak ada dispute aktif"
                  : "Belum ada riwayat dispute"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayDisputes.map((dispute) => (
                <Link
                  key={dispute.id}
                  href={`/account/wallet/disputes/${dispute.id}`}
                  className="block rounded-lg border border-border bg-card p-4 transition hover:border-muted-foreground"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          Dispute #{dispute.id.slice(0, 8)}
                        </span>
                        {getStatusBadge(dispute.status, dispute.phase)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {dispute.reason}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Rp {dispute.amount?.toLocaleString("id-ID") || 0}
                        </span>
                        <span>•</span>
                        <span>{formatDate(dispute.createdAt)}</span>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* Deadline warning */}
                  {dispute.status?.toLowerCase() === "open" && dispute.phaseDeadline && (
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                      <svg className="h-4 w-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-warning">
                        Batas waktu: {formatDate(dispute.phaseDeadline)}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
