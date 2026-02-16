"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchFeatureAuth,
  unwrapFeatureData,
  extractFeatureItems,
} from "@/lib/featureApi";
import { getToken } from "@/lib/auth";
import logger from "@/lib/logger";

function normalizeDispute(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    status: item?.status ?? item?.Status ?? "Open",
    category: item?.category ?? item?.Category ?? "Other",
    amount: Number(item?.amount ?? item?.Amount ?? 0) || 0,
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    respondentUsername:
      item?.respondentUsername ?? item?.RespondentUsername ?? "Unknown",
  };
}

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
      const response = await fetchFeatureAuth("/api/v1/disputes");
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
    const normalized = String(status || "").toLowerCase();
    switch (normalized) {
      case "open":
        return "border-warning/20 bg-warning/10 text-warning";
      case "underreview":
      case "under_review":
      case "admin_review":
        return "border-primary/20 bg-primary/10 text-primary";
      case "waitingforevidence":
      case "waiting_for_evidence":
      case "evidence":
        return "border-border bg-accent text-accent-foreground";
      case "resolved":
        return "border-success/20 bg-success/10 text-success";
      case "cancelled":
      case "closed":
        return "border-border bg-muted/60 text-muted-foreground";
      default:
        return "border-border bg-muted/60 text-muted-foreground";
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    const normalized = String(status || "").toLowerCase();
    switch (normalized) {
      case "open":
        return "Menunggu";
      case "underreview":
      case "under_review":
      case "admin_review":
        return "Ditinjau";
      case "waitingforevidence":
      case "waiting_for_evidence":
      case "evidence":
        return "Butuh Bukti";
      case "resolved":
        return "Selesai";
      case "cancelled":
      case "closed":
        return "Dibatalkan";
      default: return status;
    }
  };

  // Filter disputes
  const filteredDisputes = disputes.filter(d => {
    const status = String(d.status || "").toLowerCase();
    if (filter === "all") return true;
    if (filter === "active") return !["resolved", "cancelled", "closed"].includes(status);
    if (filter === "resolved") return ["resolved", "closed"].includes(status);
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
          <Link href="/account/wallet/transactions" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Riwayat Transaksi
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
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(dispute.status)}`}>
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
