import {
  formatHoldWindow,
  isSyntheticArtifactMarker,
  normalizeStatus,
  statusBadgeClass,
  statusLabel,
  workflowSummaryLabel,
  consultationStatusLabel,
  sensitivityMeta,
  contentAsText,
  stripLeadingRecordLabel,
  looksLikeMarkdownText,
  formatCaseLogLoadError,
  resolveTelegramContactHref,
  formatTelegramContactLabel,
  caseLogEventLabel,
  sensitivityStakeRequirement,
} from "../validationCaseDetailUtils";

jest.mock("@/lib/format", () => ({
  formatIDR: jest.fn((v) => `Rp ${v}`),
}));

describe("validationCaseDetailUtils", () => {
  describe("formatHoldWindow", () => {
    it("returns '-' for invalid input", () => {
      expect(formatHoldWindow(0)).toBe("-");
      expect(formatHoldWindow(null)).toBe("-");
    });

    it("formats hours correctly", () => {
      expect(formatHoldWindow(32)).toBe("1 hari 8 jam");
      expect(formatHoldWindow(48)).toBe("2 hari");
      expect(formatHoldWindow(5)).toBe("5 jam");
      expect(formatHoldWindow(50)).toBe("2 hari 2 jam");
    });
  });

  describe("isSyntheticArtifactMarker", () => {
    it("returns true for synthetic markers", () => {
      expect(isSyntheticArtifactMarker("artifact-submission-auto-123")).toBe(true);
    });

    it("returns false for normal ids", () => {
      expect(isSyntheticArtifactMarker("doc-123")).toBe(false);
      expect(isSyntheticArtifactMarker("")).toBe(false);
    });
  });

  describe("normalizeStatus", () => {
    it("normalizes to lowercase trimmed", () => {
      expect(normalizeStatus("  Open ")).toBe("open");
      expect(normalizeStatus(null)).toBe("");
    });
  });

  describe("statusBadgeClass", () => {
    it("returns correct class for known statuses", () => {
      expect(statusBadgeClass("open")).toContain("border-border");
      expect(statusBadgeClass("completed")).toContain("success");
    });

    it("returns default for unknown status", () => {
      expect(statusBadgeClass("xyz")).toContain("bg-secondary");
    });
  });

  describe("statusLabel", () => {
    it("returns correct label", () => {
      expect(statusLabel("open")).toBe("Open");
      expect(statusLabel("completed")).toBe("Completed");
    });

    it("falls back to replacing underscores", () => {
      expect(statusLabel("some_custom_status")).toBe("some custom status");
    });
  });

  describe("workflowSummaryLabel", () => {
    it("returns correct summary based on status and params", () => {
      expect(workflowSummaryLabel("completed")).toBe("Completed");
      expect(workflowSummaryLabel("open", { artifactId: "a1" })).toBe("Artifact Submitted");
      expect(workflowSummaryLabel("open")).toBe("Open");
    });
  });

  describe("consultationStatusLabel", () => {
    it("maps known statuses", () => {
      expect(consultationStatusLabel("pending")).toBe("Pending Owner Review");
      expect(consultationStatusLabel("approved")).toBe("Approved");
    });
  });

  describe("sensitivityMeta", () => {
    it("returns correct meta for each level", () => {
      expect(sensitivityMeta("S0").label).toBe("Publik");
      expect(sensitivityMeta("S3").label).toBe("Kritis");
      expect(sensitivityMeta("S99").label).toBe("Tidak diketahui");
    });
  });

  describe("contentAsText", () => {
    it("handles string, object, and null", () => {
      expect(contentAsText("hello")).toBe("hello");
      expect(contentAsText({ text: "hi" })).toBe("hi");
      expect(contentAsText(null)).toBe("");
    });
  });

  describe("stripLeadingRecordLabel", () => {
    it("strips leading record label", () => {
      expect(stripLeadingRecordLabel("# Record:\n\nContent")).toBe("Content");
    });

    it("returns content as-is when no label", () => {
      expect(stripLeadingRecordLabel("Just content")).toBe("Just content");
    });
  });

  describe("looksLikeMarkdownText", () => {
    it("returns true for markdown-like text", () => {
      expect(looksLikeMarkdownText("# Heading")).toBe(true);
      expect(looksLikeMarkdownText("- item")).toBe(true);
    });

    it("returns false for plain text", () => {
      expect(looksLikeMarkdownText("plain text")).toBe(false);
      expect(looksLikeMarkdownText("")).toBe(false);
    });
  });

  describe("resolveTelegramContactHref", () => {
    it("resolves username to t.me link", () => {
      expect(resolveTelegramContactHref("@user123")).toBe("https://t.me/user123");
    });

    it("passes through existing urls", () => {
      expect(resolveTelegramContactHref("https://t.me/user")).toBe("https://t.me/user");
    });
  });

  describe("formatTelegramContactLabel", () => {
    it("formats tg:// id links", () => {
      expect(formatTelegramContactLabel("tg://user?id=12345")).toBe(
        "Buka Aplikasi Telegram (ID: 12345)"
      );
    });

    it("returns value as-is for regular usernames", () => {
      expect(formatTelegramContactLabel("@user123")).toBe("@user123");
    });
  });

  describe("caseLogEventLabel", () => {
    it("maps known event types", () => {
      expect(caseLogEventLabel("funds_locked")).toBe("Dana berhasil dikunci di escrow.");
    });

    it("returns default for unknown events", () => {
      expect(caseLogEventLabel("unknown_event")).toBe("Aktivitas kasus diperbarui.");
    });
  });

  describe("sensitivityStakeRequirement", () => {
    it("returns correct requirement for each level", () => {
      expect(sensitivityStakeRequirement("S0", 0)).toContain("S0");
      expect(sensitivityStakeRequirement("S1", 0)).toContain("Rp 100.000");
      expect(sensitivityStakeRequirement("S3", 50000)).toContain("Rp 50000");
    });
  });
});
