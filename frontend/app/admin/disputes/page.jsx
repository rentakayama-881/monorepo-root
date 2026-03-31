"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import logger from "@/lib/logger";
import { getAdminToken } from "@/lib/adminAuth";
import { unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";
import {
  formatDate,
  formatAmount,
  normalizeStatus,
  getStatusColor,
  getStatusLabel,
  getCategoryLabel,
} from "@/lib/disputes/helpers";

const API_BASE = process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.aivalid.id";

function normalizeDispute(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    status: item?.status ?? item?.Status ?? "Open",
    category: item?.category ?? item?.Category ?? "Other",
    amount: Number(item?.amount ?? item?.Amount ?? 0) || 0,
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    initiatorUsername:
      item?.initiatorUsername ??
      item?.InitiatorUsername ??
      item?.senderUsername ??
      item?.SenderUsername ??
      "Tidak diketahui",
    respondentUsername:
      item?.respondentUsername ??
      item?.RespondentUsername ??
      item?.receiverUsername ??
      item?.ReceiverUsername ??
      "Tidak diketahui",
  };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Open");

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      if (!token) {
        setDisputes([]);
      } else {
        const status = filter === "all" ? "" : `?status=${filter}`;
        const res = await fetch(`${API_BASE}/api/v1/admin/disputes${status}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error("Gagal memuat daftar sengketa");

        const data = await res.json();
        const payload = unwrapFeatureData(data);
        const items = extractFeatureItems(payload).map(normalizeDispute);
        setDisputes(items);
      }
    } catch (e) {
      logger.error("Failed to load disputes:", e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Kelola Sengketa</h1>
        <p className="text-muted-foreground">Tinjau dan selesaikan sengketa transaksi</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: getStatusLabel("Open"),
            value: disputes.filter((d) => normalizeStatus(d.status) === "open").length,
          },
          {
            label: getStatusLabel("UnderReview"),
            value: disputes.filter((d) => normalizeStatus(d.status) === "underreview").length,
          },
          {
            label: getStatusLabel("WaitingForEvidence"),
            value: disputes.filter((d) => normalizeStatus(d.status) === "waitingforevidence")
              .length,
          },
          {
            label: "Total Aktif",
            value: disputes.filter(
              (d) => !["resolved", "cancelled"].includes(normalizeStatus(d.status))
            ).length,
          },
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
          { value: "Open", label: getStatusLabel("Open") },
          { value: "UnderReview", label: getStatusLabel("UnderReview") },
          { value: "WaitingForEvidence", label: getStatusLabel("WaitingForEvidence") },
          { value: "Resolved", label: getStatusLabel("Resolved") },
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
          <h2 className="text-xl font-bold text-foreground mb-2">Tidak Ada Sengketa</h2>
          <p className="text-muted-foreground">
            {filter === "all"
              ? "Belum ada sengketa yang dibuat."
              : `Tidak ada sengketa dengan status "${getStatusLabel(filter)}".`}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full" aria-label="Daftar sengketa">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Kategori
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Pihak
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  Jumlah
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                  Aksi
                </th>
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
                      {formatAmount(dispute.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-sm border px-2 py-1 text-xs font-medium ${getStatusColor(dispute.status)}`}
                    >
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
                      className="inline-flex items-center px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition min-h-[44px]"
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
