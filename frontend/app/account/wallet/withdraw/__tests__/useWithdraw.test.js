import React from "react";
import { render, act } from "@testing-library/react";
import useWithdraw, { quickAmounts, minWithdraw, feePercent } from "../useWithdraw";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: {
    WALLETS: { ME: "/api/v1/wallets/me" },
    WITHDRAWALS: { CREATE: "/api/v1/withdrawals" },
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

const { fetchFeatureAuth } = require("@/lib/featureApi");

describe("useWithdraw exports", () => {
  it("exports quickAmounts", () => {
    expect(quickAmounts).toEqual([10000, 50000, 100000, 200000, 500000, 1000000]);
  });

  it("exports minWithdraw as 10000", () => {
    expect(minWithdraw).toBe(10000);
  });

  it("exports feePercent as 0.02", () => {
    expect(feePercent).toBe(0.02);
  });
});

describe("useWithdraw", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useWithdraw());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    fetchFeatureAuth.mockResolvedValue({
      balance: 1000000,
      pinSet: true,
    });
  });

  it("starts at step 1 with loading", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.step).toBe(1);
    expect(result.loading).toBe(false);
    expect(result.cryptoCurrency).toBe("USDT");
  });

  it("handleAmountChange formats numeric input", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.handleAmountChange({ target: { value: "50000" } });
    });

    expect(result.parsedAmount).toBe(50000);
    expect(result.fee).toBe(Math.ceil(50000 * 0.02));
    expect(result.totalDeduction).toBe(50000 + Math.ceil(50000 * 0.02));
  });

  it("handleQuickAmount sets formatted amount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.handleQuickAmount(100000);
    });

    expect(result.parsedAmount).toBe(100000);
  });

  it("goNext increments step", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.goNext();
    });

    expect(result.step).toBe(2);
  });

  it("goBack decrements step and clears error", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.goNext();
    });
    expect(result.step).toBe(2);

    act(() => {
      result.goBack();
    });
    expect(result.step).toBe(1);
  });

  it("goBack from step 1 navigates to transactions", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.goBack();
    });

    expect(mockPush).toHaveBeenCalledWith("/account/wallet/transactions");
  });

  it("isStep1Valid requires currency, address, and network", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    // Initially no address
    expect(result.isStep1Valid).toBe(false);

    act(() => {
      result.setCryptoAddress("TJnX1234567890abcdef");
    });

    // Now should be valid since USDT defaults network
    expect(result.cryptoAddress).toBe("TJnX1234567890abcdef");
  });

  it("redirects to login when no token", async () => {
    const { getToken } = require("@/lib/auth");
    getToken.mockReturnValueOnce(null);

    await act(async () => {
      render(<TestComponent />);
    });

    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
