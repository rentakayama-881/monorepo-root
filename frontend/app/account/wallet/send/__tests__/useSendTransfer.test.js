import React from "react";
import { render, act } from "@testing-library/react";
import useSendTransfer from "../useSendTransfer";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: {
    WALLETS: { ME: "/api/v1/wallets/me" },
    TRANSFERS: {
      SEARCH_USER: "/api/v1/transfers/search",
      CREATE: "/api/v1/transfers",
    },
  },
  unwrapFeatureData: jest.fn((d) => d),
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

jest.mock("@/lib/format", () => ({
  formatCurrencyInput: jest.fn((v) => v),
}));

const { fetchFeatureAuth } = require("@/lib/featureApi");

describe("useSendTransfer", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useSendTransfer());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    jest.useFakeTimers();
    fetchFeatureAuth.mockResolvedValue({
      balance: 500000,
      pinSet: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at step 1", async () => {
    await act(async () => {
      render(<TestComponent />);
    });
    await act(async () => {
      jest.runAllTimers();
    });

    expect(result.step).toBe(1);
    expect(result.loading).toBe(false);
    expect(result.wallet).toEqual(expect.objectContaining({ balance: expect.any(Number) }));
  });

  it("handleSelectUser sets user and advances to step 2", async () => {
    await act(async () => {
      render(<TestComponent />);
    });
    await act(async () => {
      jest.runAllTimers();
    });

    act(() => {
      result.handleSelectUser({ id: 1, username: "bob", avatar_url: "" });
    });

    expect(result.selectedUser).toEqual({ id: 1, username: "bob", avatar_url: "" });
    expect(result.step).toBe(2);
  });

  it("handleAmountNext validates minimum amount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });
    await act(async () => {
      jest.runAllTimers();
    });

    act(() => {
      result.setAmount("5.000");
    });

    act(() => {
      result.handleAmountNext();
    });

    expect(result.error).toBe("Minimum transfer is IDR 10,000");
    expect(result.step).toBe(1);
  });

  it("handleAmountNext validates insufficient balance", async () => {
    fetchFeatureAuth.mockResolvedValue({ balance: 5000, pinSet: true });

    await act(async () => {
      render(<TestComponent />);
    });
    await act(async () => {
      jest.runAllTimers();
    });

    act(() => {
      result.setAmount("50000");
    });

    act(() => {
      result.handleAmountNext();
    });

    expect(result.error).toBe("Insufficient balance");
  });

  it("handleChangeUser resets to step 1", async () => {
    await act(async () => {
      render(<TestComponent />);
    });
    await act(async () => {
      jest.runAllTimers();
    });

    act(() => {
      result.handleSelectUser({ id: 1, username: "bob" });
    });

    act(() => {
      result.handleChangeUser();
    });

    expect(result.step).toBe(1);
    expect(result.selectedUser).toBeNull();
    expect(result.searchQuery).toBe("");
  });
});
