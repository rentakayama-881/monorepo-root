"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchFeatureAuth } from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

export default function DisputesListPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    loadDisputes();
  }, [router]);

  const loadDisputes = async () => {
    try {
      const data = await fetchFeatureAuth("/api/v1/disputes");
      setDisputes(data.data || []);
    } catch (e) {
      logger.error("Failed to load disputes:", e);
    }
    setLoading(false);
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Format amount
  const formatAmount = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "bg-yellow-500/10 text-yellow-600";
      case "UnderReview": return "bg-blue-500/10 text-blue-600";
      case "WaitingForEvidence": return "bg-orange-500/10 text-orange-600";
      case "Resolved": return "bg-green-500/10 text-green-600";
      case "Cancelled": return "bg-gray-500/10 text-gray-600";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case "Open": return "Menunggu";
      case "UnderReview": return "Ditinjau";
      case "WaitingForEvidence": return "Butuh Bukti";
      case "Resolved": return "Selesai";
      case "Cancelled": return "Dibatalkan";
      default: return status;
    }
  };

  // Filter disputes
  const filteredDisputes = disputes.filter(d => {
    if (filter === "all") return true;
    if (filter === "active") return !["Resolved", "Cancelled"].includes(d.status);
    if (filter === "resolved") return d.status === "Resolved";
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link href="/account/wallet" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Wallet
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">Dispute Saya</h1>
          <p className="text-muted-foreground">Daftar permasalahan transaksi yang Anda ajukan</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {[
            { value: "all", label: "Semua" },
            { value: "active", label: "Aktif" },
            { value: "resolved", label: "Selesai" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Disputes List */}
        {filteredDisputes.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {filter === "all" ? "Tidak Ada Dispute" : "Tidak Ada Hasil"}
            </h2>
            <p className="text-muted-foreground">
              {filter === "all" 
                ? "Semua transaksi Anda berjalan lancar tanpa masalah."
                : "Tidak ada dispute dengan filter ini."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes.map((dispute) => (
              <Link
                key={dispute.id}
                href={`/account/disputes/${dispute.id}`}
                className="block bg-card rounded-lg border border-border p-4 hover:border-primary transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
                        {getStatusLabel(dispute.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        #{dispute.id?.slice(-6)}
                      </span>
                    </div>
                    <div className="font-medium text-foreground mb-1">
                      {dispute.category === "ItemNotReceived" ? "Barang Tidak Diterima" :
                       dispute.category === "ItemNotAsDescribed" ? "Tidak Sesuai Deskripsi" :
                       dispute.category === "Fraud" ? "Dugaan Penipuan" :
                       dispute.category === "SellerNotResponding" ? "Penjual Tidak Merespons" : "Lainnya"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      vs @{dispute.respondentUsername}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">
                      Rp {formatAmount(dispute.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(dispute.createdAt)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
