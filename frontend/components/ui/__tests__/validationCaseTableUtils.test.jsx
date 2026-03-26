import { render, screen } from "@testing-library/react";
import {
  formatDate,
  statusLabel,
  statusStyle,
  sensitivityText,
  StatusPill,
} from "../validationCaseTableUtils";

describe("formatDate", () => {
  it("returns empty string for falsy input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("formats unix timestamp (seconds)", () => {
    const result = formatDate(1704067200); // 2024-01-01 in epoch seconds
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats ISO date string", () => {
    const result = formatDate("2024-01-01T00:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("statusLabel", () => {
  it("returns 'Tidak diketahui' for empty/null input", () => {
    expect(statusLabel("")).toBe("Tidak diketahui");
    expect(statusLabel(null)).toBe("Tidak diketahui");
    expect(statusLabel(undefined)).toBe("Tidak diketahui");
  });

  it("returns correct label for known statuses", () => {
    expect(statusLabel("open")).toBe("Terbuka");
    expect(statusLabel("completed")).toBe("Selesai");
    expect(statusLabel("disputed")).toBe("Disengketakan");
    expect(statusLabel("funds_locked")).toBe("Dana Dikunci");
    expect(statusLabel("offer_accepted")).toBe("Penawaran Diterima");
    expect(statusLabel("artifact_submitted")).toBe("Artefak Dikirim");
  });

  it("handles case insensitivity", () => {
    expect(statusLabel("OPEN")).toBe("Terbuka");
    expect(statusLabel("Completed")).toBe("Selesai");
  });

  it("returns formatted string for unknown statuses", () => {
    expect(statusLabel("some_unknown_status")).toBe("some unknown status");
  });
});

describe("statusStyle", () => {
  it("returns correct style for completed", () => {
    expect(statusStyle("completed")).toContain("success");
  });

  it("returns correct style for disputed", () => {
    expect(statusStyle("disputed")).toContain("danger");
  });

  it("returns default style for open", () => {
    expect(statusStyle("open")).toContain("border-border");
  });

  it("returns default style for unknown status", () => {
    expect(statusStyle("unknown_xyz")).toContain("border-border");
  });
});

describe("sensitivityText", () => {
  it("returns correct text for known levels", () => {
    expect(sensitivityText("S0")).toBe("S0 Publik");
    expect(sensitivityText("S1")).toBe("S1 Terbatas");
    expect(sensitivityText("S2")).toBe("S2 Rahasia");
    expect(sensitivityText("S3")).toBe("S3 Kritis");
  });

  it("handles lowercase input", () => {
    expect(sensitivityText("s1")).toBe("S1 Terbatas");
  });

  it("defaults to S1 for empty input", () => {
    expect(sensitivityText("")).toBe("S1 Terbatas");
    expect(sensitivityText(null)).toBe("S1 Terbatas");
  });

  it("returns raw level for unknown levels", () => {
    expect(sensitivityText("S9")).toBe("S9");
  });
});

describe("StatusPill", () => {
  it("renders without crashing", () => {
    const { container } = render(<StatusPill status="open" />);
    expect(container).toBeTruthy();
  });

  it("renders status label text", () => {
    render(<StatusPill status="open" />);
    expect(screen.getByText("Terbuka")).toBeInTheDocument();
  });

  it("has role=status", () => {
    render(<StatusPill status="completed" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has correct aria-label", () => {
    render(<StatusPill status="completed" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Status: Selesai");
  });
});
