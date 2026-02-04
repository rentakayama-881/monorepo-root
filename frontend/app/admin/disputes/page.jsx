"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import logger from "@/lib/logger";

const API_BASE = process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.aivalid.id";

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Open");

  const getAdminToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_token");
    }
    return null;
  };

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const status = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`${API_BASE}/api/v1/admin/disputes${status}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch disputes");

      const data = await res.json();
      setDisputes(data.data || []);
    } catch (e) {
      logger.error("Failed to load disputes:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDisputes();
  }, [filter]);

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format amount
  const formatAmount = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "bg-yellow-500 text-white";
      case "UnderReview": return "bg-blue-500 text-white";
      case "WaitingForEvidence": return "bg-orange-500 text-white";
      case "Resolved": return "bg-green-500 text-white";
      case "Cancelled": return "bg-gray-500 text-white";
      default: return "bg-gray-500 text-white";
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

  // Get category label
  const getCategoryLabel = (category) => {
    switch (category) {
      case "ItemNotReceived": return "Barang Tidak Diterima";
      case "ItemNotAsDescribed": return "Tidak Sesuai Deskripsi";
      case "Fraud": return "Dugaan Penipuan";
      case "SellerNotResponding": return "Penjual Tidak Merespons";
      case "Other": return "Lainnya";
      default: return category;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">⚖️ Dispute Management</h1>
        <p className="text-muted-foreground">Kelola dan selesaikan permasalahan transaksi</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Menunggu", value: disputes.filter(d => d.status === "Open").length, color: "bg-yellow-500" },
          { label: "Ditinjau", value: disputes.filter(d => d.status === "UnderReview").length, color: "bg-blue-500" },
          { label: "Butuh Bukti", value: disputes.filter(d => d.status === "WaitingForEvidence").length, color: "bg-orange-500" },
          { label: "Total Aktif", value: disputes.filter(d => !["Resolved", "Cancelled"].includes(d.status)).length, color: "bg-primary" },
        ].map((stat, idx) => (
          <div key={idx} className="bg-card rounded-lg border border-border p-4">
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: "Open", label: "Menunggu" },
          { value: "UnderReview", label: "Ditinjau" },
          { value: "WaitingForEvidence", label: "Butuh Bukti" },
          { value: "Resolved", label: "Selesai" },
          { value: "all", label: "Semua" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Disputes Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Tidak Ada Dispute</h2>
          <p className="text-muted-foreground">
            {filter === "all" ? "Belum ada dispute yang dibuat." : `Tidak ada dispute dengan status "${getStatusLabel(filter)}".`}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Kategori</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pihak</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Jumlah</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tanggal</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{dispute.id?.slice(-6)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-foreground">
                      {getCategoryLabel(dispute.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="text-foreground">@{dispute.initiatorUsername}</span>
                      <span className="text-muted-foreground"> vs </span>
                      <span className="text-foreground">@{dispute.respondentUsername}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-foreground">
                      Rp {formatAmount(dispute.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(dispute.status)}`}>
                      {getStatusLabel(dispute.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(dispute.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/disputes/${dispute.id}`}
                      className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                    >
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
