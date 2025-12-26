"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Header from "@/components/Header";

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
        const res = await fetch(`${getApiBase()}/api/disputes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDisputes(data.disputes || []);
        }
      } catch (e) {
        console.error("Failed to load disputes:", e);
      }
      setLoading(false);
    }

    loadData();
  }, [router]);

  const getStatusBadge = (status, phase) => {
    const phaseStyles = {
      negotiation: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      evidence: "bg-orange-500/10 text-orange-600 border-orange-500/30",
      admin_review: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    };
    const statusStyles = {
      open: phaseStyles[phase] || phaseStyles.negotiation,
      resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      closed: "bg-gray-500/10 text-gray-600 border-gray-500/30",
    };
    const phaseLabels = {
      negotiation: "Negosiasi",
      evidence: "Bukti",
      admin_review: "Admin Review",
    };
    const label = status === "open" ? phaseLabels[phase] || "Open" : status === "resolved" ? "Selesai" : "Ditutup";
    return (
      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[status] || statusStyles.open}`}>
        {label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const activeDisputes = disputes.filter((d) => d.status === "open");
  const resolvedDisputes = disputes.filter((d) => d.status !== "open");

  const displayDisputes = activeTab === "active" ? activeDisputes : resolvedDisputes;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[rgb(var(--bg))] pt-16">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Dispute Center</h1>
            <p className="text-sm text-[rgb(var(--muted))]">
              Kelola sengketa transaksi Anda
            </p>
          </div>

          {/* Info Card */}
          <div className="mb-6 rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-[rgb(var(--muted))]">
                <p className="font-medium text-blue-600 mb-1">Proses Dispute</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><strong>Negosiasi</strong> - Diskusi dengan pihak lain (24 jam)</li>
                  <li><strong>Bukti</strong> - Upload bukti pendukung (48 jam)</li>
                  <li><strong>Admin Review</strong> - Tim kami akan memutuskan</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2 border-b border-[rgb(var(--border))]">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "active"
                  ? "border-b-2 border-emerald-600 text-emerald-600"
                  : "text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
              }`}
            >
              Aktif ({activeDisputes.length})
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "resolved"
                  ? "border-b-2 border-emerald-600 text-emerald-600"
                  : "text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
              }`}
            >
              Selesai ({resolvedDisputes.length})
            </button>
          </div>

          {/* Disputes List */}
          {loading ? (
            <div className="text-center py-12 text-[rgb(var(--muted))]">Memuat...</div>
          ) : displayDisputes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎉</div>
              <div className="text-[rgb(var(--muted))]">
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
                  className="block rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition hover:border-[rgb(var(--muted))]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[rgb(var(--fg))]">
                          Dispute #{dispute.id.slice(0, 8)}
                        </span>
                        {getStatusBadge(dispute.status, dispute.phase)}
                      </div>
                      <div className="text-sm text-[rgb(var(--muted))] mb-2">
                        {dispute.reason}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[rgb(var(--muted))]">
                        <span>
                          Rp {dispute.transfer?.amount?.toLocaleString("id-ID") || 0}
                        </span>
                        <span>•</span>
                        <span>{formatDate(dispute.created_at)}</span>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* Deadline warning */}
                  {dispute.status === "open" && dispute.phase_deadline && (
                    <div className="mt-3 flex items-center gap-2 border-t border-[rgb(var(--border))] pt-3">
                      <svg className="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-yellow-600">
                        Batas waktu: {formatDate(dispute.phase_deadline)}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
