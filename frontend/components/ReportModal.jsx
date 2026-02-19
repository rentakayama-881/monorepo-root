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
 * @param {string} props.targetType - Type of target (validation_case)
 * @param {string} props.targetId - ID of the target
 * @param {string} props.targetTitle - Optional title/name for display
 */
export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  validationCaseId,
  targetTitle = "",
}) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const { submitReport, loading, error, success, reset } = useSubmitReport();
  const { toast } = useToast();

  const targetTypeLabels = {
    [REPORT_TARGET_TYPES.VALIDATION_CASE]: "Validation Case",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason) {
      toast.warning("Select Reason", "Please select a report reason.");
      return;
    }

    try {
      const effectiveValidationCaseId =
        validationCaseId ??
        (targetType === REPORT_TARGET_TYPES.VALIDATION_CASE ? targetId : null);

      await submitReport({
        targetType,
        targetId,
        validationCaseId: effectiveValidationCaseId,
        reason,
        description,
      });
      toast.success("Report Submitted", "Thank you for your report. Our team will review it.");
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
      <Modal open={open} onClose={handleClose} title="Report Submitted" size="sm">
        <div className="p-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-success"
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
            Your report has been received and will be reviewed by our moderation team.
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
              Reported {targetTypeLabels[targetType]}:
            </p>
            <p className="text-sm text-foreground font-medium truncate">
              {targetTitle}
            </p>
          </div>
        )}

        {/* Reason select */}
        <Select
          label="Report Reason *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REPORT_REASONS}
          placeholder="Select a reason..."
          error={!reason && error ? "Please select a reason." : ""}
        />

        {/* Description */}
        <Textarea
          label="Additional Details (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain why you are reporting this content..."
          rows={4}
          maxLength={1000}
        />

        {/* Character count */}
        <div className="text-xs text-muted-foreground text-right">
          {description.length}/1000 characters
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Guidelines */}
        <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Reporting Guidelines:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Ensure the content clearly violates community guidelines</li>
            <li>Fraudulent reports may result in account penalties.</li>
            <li>The moderation team reviews reports within 24-48 hours</li>
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
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={loading}
            disabled={!reason || loading}
          >
            {loading ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
