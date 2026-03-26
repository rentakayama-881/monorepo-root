import React from "react";
import { render, act } from "@testing-library/react";
import useDeposit from "../useDeposit";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: {
    WALLETS: {
      ME: "/api/v1/wallets/me",
      DEPOSITS: "/api/v1/wallets/deposits",
      DEPOSITS_PENDING: "/api/v1/wallets/deposits/pending",
      DEPOSIT_STATUS: (id) => `/api/v1/wallets/deposits/${id}/status`,
      DEPOSIT_CANCEL: (id) => `/api/v1/wallets/deposits/${id}/cancel`,
    },
  },
  unwrapFeatureData: jest.fn((d) => d),
  extractFeatureItems: jest.fn(() => []),
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
}));

jest.mock("@/lib/errorMessage", () => ({
  getErrorMessage: jest.fn((e, fallback) => e?.message || fallback),
}));

jest.mock("@/lib/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../deposit-utils", () => ({
  CRYPTO_OPTIONS: [
    { value: "USDT", label: "Tether", symbol: "USDT", networks: ["TRC20", "TON"] },
    { value: "TON", label: "Toncoin", symbol: "TON", networks: ["TON"] },
  ],
  minDeposit: 2000,
  normalizeWallet: jest.fn(() => ({ balance: 100000, has_pin: true })),
  normalizeDeposit: jest.fn((item) => item),
  normalizeNetworkName: jest.fn((n) => n),
}));

const { fetchFeatureAuth } = require("@/lib/featureApi");
const { unwrapFeatureData } = require("@/lib/featureApi");

describe("useDeposit", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useDeposit());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    // Default: no pending deposit, successful wallet load
    fetchFeatureAuth.mockResolvedValue({});
    unwrapFeatureData.mockImplementation((d) => d);
  });

  it("returns initial state with step=1", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.step).toBe(1);
    expect(result.payCurrency).toBe("USDT");
    expect(result.parsedAmount).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.totalCharge).toBe(0);
  });

  it("onAmountChange formats input", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.onAmountChange({ target: { value: "50000" } });
    });

    expect(result.parsedAmount).toBe(50000);
  });

  it("onQuickAmount sets formatted amount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.onQuickAmount(10000);
    });

    expect(result.parsedAmount).toBe(10000);
  });

  it("onPayCurrencyChange updates currency", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.onPayCurrencyChange("TON");
    });

    expect(result.payCurrency).toBe("TON");
  });

  it("onCreateDeposit shows error when amount below minimum", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.onAmountChange({ target: { value: "1000" } });
    });

    await act(async () => {
      await result.onCreateDeposit();
    });

    expect(result.error).toContain("Minimal deposit");
  });

  it("onResetToStep1 resets to initial state", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.onResetToStep1();
    });

    expect(result.step).toBe(1);
    expect(result.error).toBe("");
  });
});
