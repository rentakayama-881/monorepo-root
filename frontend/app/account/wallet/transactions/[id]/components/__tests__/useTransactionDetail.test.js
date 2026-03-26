import React from "react";
import { render, act } from "@testing-library/react";
import useTransactionDetail, { normalizeStatus } from "../useTransactionDetail";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: "txn-1" }),
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: {
    WALLETS: { ME: "/api/v1/wallets/me" },
    TRANSFERS: {
      DETAIL: (id) => `/api/v1/transfers/${id}`,
      RELEASE: (id) => `/api/v1/transfers/${id}/release`,
      CANCEL: (id) => `/api/v1/transfers/${id}/cancel`,
      REJECT: (id) => `/api/v1/transfers/${id}/reject`,
    },
    DISPUTES: {
      CREATE: "/api/v1/disputes",
    },
  },
  unwrapFeatureData: jest.fn((d) => d),
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
}));

jest.mock("@/lib/errorMessage", () => ({
  getErrorMessage: jest.fn((e, fallback) => e?.message || fallback),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
}));

const { fetchFeatureAuth } = require("@/lib/featureApi");
const { fetchJsonAuth } = require("@/lib/api");

describe("normalizeStatus", () => {
  it("maps Pending to held", () => {
    expect(normalizeStatus("Pending")).toBe("held");
  });

  it("maps Released to released", () => {
    expect(normalizeStatus("Released")).toBe("released");
  });

  it("maps Cancelled to cancelled", () => {
    expect(normalizeStatus("Cancelled")).toBe("cancelled");
  });

  it("maps Rejected to rejected", () => {
    expect(normalizeStatus("Rejected")).toBe("rejected");
  });

  it("maps Disputed to disputed", () => {
    expect(normalizeStatus("Disputed")).toBe("disputed");
  });

  it("maps Expired to released", () => {
    expect(normalizeStatus("Expired")).toBe("released");
  });

  it("lowercases unknown statuses", () => {
    expect(normalizeStatus("CustomStatus")).toBe("customstatus");
  });
});

describe("useTransactionDetail", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useTransactionDetail());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    fetchJsonAuth.mockResolvedValue({ id: 1, username: "alice" });
    fetchFeatureAuth
      .mockResolvedValueOnce({ pinSet: true }) // wallet
      .mockResolvedValueOnce({
        id: "txn-1",
        senderId: 1,
        receiverId: 2,
        senderUsername: "alice",
        receiverUsername: "bob",
        amount: 50000,
        status: "Pending",
        holdUntil: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      });
  });

  it("loads transfer on mount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.loading).toBe(false);
    expect(result.transfer).toBeTruthy();
    expect(result.transfer.senderUsername).toBe("alice");
  });

  it("computes isSender based on currentUser", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.isSender).toBe(true);
    expect(result.isReceiver).toBe(false);
  });

  it("computes status via normalizeStatus", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.status).toBe("held");
  });

  it("handleAction opens pin modal for release", async () => {
    fetchFeatureAuth.mockReset().mockResolvedValueOnce({ pinSet: true }).mockResolvedValueOnce({
      id: "txn-1",
      senderId: 1,
      receiverId: 2,
      amount: 50000,
      status: "Pending",
    });

    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.handleAction("release");
    });

    expect(result.showPinModal).toBe(true);
    expect(result.pendingAction).toBe("release");
  });

  it("handleAction opens confirm modal for dispute", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.handleAction("dispute");
    });

    expect(result.showConfirmModal).toBe(true);
    expect(result.pendingAction).toBe("dispute");
  });
});
