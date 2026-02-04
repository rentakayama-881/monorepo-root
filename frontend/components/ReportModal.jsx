"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useSubmitReport, REPORT_REASONS, REPORT_TARGET_TYPES } from "@/lib/useReport";
import { useToast } from "@/components/ui/Toast";

/**
 * ReportModal component - modal for reporting content
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close callback
 * @param {string} props.targetType - Type of target (thread, reply, user)
 * @param {string} props.targetId - ID of the target
 * @param {string} props.targetTitle - Optional title/name for display
 */
export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  threadId,
  targetTitle = "",
}) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const { submitReport, loading, error, success, reset } = useSubmitReport();
  const { toast } = useToast();

  const targetTypeLabels = {
    [REPORT_TARGET_TYPES.THREAD]: "Thread",
    [REPORT_TARGET_TYPES.REPLY]: "Balasan",
    [REPORT_TARGET_TYPES.USER]: "Pengguna",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason) {
      toast.warning("Pilih Alasan", "Silakan pilih alasan laporan");
      return;
    }

    try {
      const effectiveThreadId =
        threadId ?? (targetType === REPORT_TARGET_TYPES.THREAD ? targetId : null);

      await submitReport({
        targetType,
        targetId,
        threadId: effectiveThreadId,
        reason,
        description,
      });
      toast.success("Laporan Terkirim", "Terima kasih atas laporan Anda. Tim kami akan meninjau.");
      handleClose();
    } catch (err) {
      // Error already shown via toast in hook, but we can show additional feedback
    }
  };

  const handleClose = () => {
    setReason("");
    setDescription("");
    reset();
    onClose?.();
  };

  // Success state
  if (success) {
    return (
      <Modal open={open} onClose={handleClose} title="Laporan Terkirim" size="sm">
        <div className="p-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-600/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Terima Kasih!
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Laporan Anda telah diterima dan akan ditinjau oleh tim moderasi kami.
          </p>
          <Button variant="primary" onClick={handleClose}>
            Tutup
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Laporkan ${targetTypeLabels[targetType] || "Konten"}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Target info */}
        {targetTitle && (
          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">
              {targetTypeLabels[targetType]} yang dilaporkan:
            </p>
            <p className="text-sm text-foreground font-medium truncate">
              {targetTitle}
            </p>
          </div>
        )}

        {/* Reason select */}
        <Select
          label="Alasan Laporan *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REPORT_REASONS}
          placeholder="Pilih alasan..."
          error={!reason && error ? "Silakan pilih alasan" : ""}
        />

        {/* Description */}
        <Textarea
          label="Detail Tambahan (opsional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Jelaskan lebih detail mengapa Anda melaporkan konten ini..."
          rows={4}
          maxLength={1000}
        />

        {/* Character count */}
        <div className="text-xs text-muted-foreground text-right">
          {description.length}/1000 karakter
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Guidelines */}
        <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Panduan Pelaporan:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Pastikan konten benar-benar melanggar aturan komunitas</li>
            <li>Laporan palsu dapat mengakibatkan sanksi pada akun Anda</li>
            <li>Tim moderasi akan meninjau laporan dalam 24-48 jam</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={loading}
            disabled={!reason || loading}
          >
            {loading ? "Mengirim..." : "Kirim Laporan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
