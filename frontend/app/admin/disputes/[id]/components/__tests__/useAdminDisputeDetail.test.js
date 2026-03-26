import React from "react";
import { render, act } from "@testing-library/react";
import useAdminDisputeDetail from "../useAdminDisputeDetail";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: "dispute-1" }),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
}));

jest.mock("@/lib/adminAuth", () => ({
  getAdminToken: jest.fn(() => "admin-token"),
}));

jest.mock("@/lib/featureApi", () => ({
  unwrapFeatureData: jest.fn((d) => d),
  extractFeatureItems: jest.fn((d) => (Array.isArray(d) ? d : [])),
}));

jest.mock("../disputeHelpers", () => ({
  normalizeStatus: jest.fn((s) =>
    String(s || "")
      .replace(/\s+/g, "")
      .toLowerCase()
  ),
}));

describe("useAdminDisputeDetail", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useAdminDisputeDetail());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock fetch for the fetchWithAuth internal calls
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: jest.fn().mockResolvedValue({
        id: "dispute-1",
        status: "Open",
        category: "Fraud",
        reason: "Scam attempt",
        amount: 100000,
        senderUsername: "alice",
        receiverUsername: "bob",
        messages: [],
        evidence: [],
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("loads dispute on mount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(result.loading).toBe(false);
    expect(result.dispute).toBeTruthy();
    expect(result.dispute.id).toBe("dispute-1");
    expect(result.disputeId).toBe("dispute-1");
  });

  it("computes isClosed=false for open dispute", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(result.isClosed).toBe(false);
  });

  it("computes isClosed=true for resolved dispute", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: jest.fn().mockResolvedValue({
        id: "dispute-1",
        status: "resolved",
        messages: [],
        evidence: [],
      }),
    });

    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(result.isClosed).toBe(true);
  });

  it("handleAction sets pendingAction and shows modal", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    act(() => {
      result.handleAction("refund");
    });

    expect(result.showConfirmModal).toBe(true);
    expect(result.pendingAction).toBe("refund");
  });

  it("redirects to login when no admin token", async () => {
    const { getAdminToken } = require("@/lib/adminAuth");
    getAdminToken.mockReturnValue(null);

    await act(async () => {
      render(<TestComponent />);
    });

    expect(mockPush).toHaveBeenCalledWith("/admin/login");
  });
});
