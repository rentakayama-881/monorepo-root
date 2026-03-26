import React from "react";
import { render, act } from "@testing-library/react";
import useWalletDisputeDetail from "../useWalletDisputeDetail";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: "dispute-1" }),
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: {
    DISPUTES: {
      DETAIL: (id) => `/api/v1/disputes/${id}`,
      MESSAGES: (id) => `/api/v1/disputes/${id}/messages`,
      EVIDENCE: (id) => `/api/v1/disputes/${id}/evidence`,
    },
  },
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
}));

jest.mock("../normalizers", () => ({
  normalizeCurrentUser: jest.fn((d) => ({
    id: d?.id || 0,
    username: d?.username || "",
  })),
  normalizeDispute: jest.fn((d) => ({
    id: d?.id || "",
    status: (d?.status || "open").toLowerCase(),
    senderId: d?.senderId || 0,
    receiverId: d?.receiverId || 0,
    senderUsername: d?.senderUsername || "",
    receiverUsername: d?.receiverUsername || "",
    messages: d?.messages || [],
    evidence: d?.evidence || [],
  })),
}));

const { fetchFeatureAuth } = require("@/lib/featureApi");
const { fetchJsonAuth } = require("@/lib/api");

describe("useWalletDisputeDetail", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useWalletDisputeDetail());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    fetchJsonAuth.mockResolvedValue({ id: 1, username: "alice" });
    fetchFeatureAuth.mockResolvedValue({
      id: "dispute-1",
      status: "open",
      senderId: 1,
      receiverId: 2,
      senderUsername: "alice",
      receiverUsername: "bob",
      messages: [],
      evidence: [],
    });
  });

  it("loads dispute on mount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.loading).toBe(false);
    expect(result.dispute).toBeTruthy();
    expect(result.dispute.id).toBe("dispute-1");
    expect(result.currentUser).toBeTruthy();
  });

  it("computes isSender correctly", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.isSender).toBe(true);
    expect(result.isReceiver).toBe(false);
  });

  it("computes isOpen correctly", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.isOpen).toBe(true);
  });

  it("sets error when dispute fetch fails", async () => {
    fetchFeatureAuth.mockRejectedValue(new Error("Not found"));

    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.error).toBe("Dispute not found");
  });

  it("sendMessage calls API with content", async () => {
    fetchFeatureAuth
      .mockResolvedValueOnce({
        id: "dispute-1",
        status: "open",
        senderId: 1,
        receiverId: 2,
        messages: [],
        evidence: [],
      })
      .mockResolvedValueOnce({}) // send message
      .mockResolvedValueOnce({
        id: "dispute-1",
        status: "open",
        messages: [{ id: "m1", content: "Hi" }],
        evidence: [],
      });

    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.setMessage("Hi");
    });

    await act(async () => {
      await result.onSendMessage({ preventDefault: jest.fn() });
    });

    expect(fetchFeatureAuth).toHaveBeenCalledWith(
      "/api/v1/disputes/dispute-1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Hi" }),
      })
    );
  });
});
