import React from "react";
import { render, act } from "@testing-library/react";
import { useAccountGuarantee } from "../useAccountGuarantee";

jest.mock("@/lib/tokenRefresh", () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock("../accountUtils", () => ({
  generateIdempotencyKey: jest.fn(() => "test-key-123"),
}));

const { fetchWithAuth } = require("@/lib/tokenRefresh");

describe("useAccountGuarantee", () => {
  let result;
  const setError = jest.fn();
  const setOk = jest.fn();

  function TestComponent({ featureBase, authed }) {
    Object.assign(result, useAccountGuarantee({ featureBase, authed, setError, setOk }));
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
  });

  it("returns initial state", () => {
    render(<TestComponent featureBase="https://api.example.com" authed={false} />);

    expect(result.walletBalance).toBeNull();
    expect(result.guaranteeAmount).toBe(0);
    expect(result.guaranteeLoading).toBe(false);
    expect(result.guaranteeSubmitting).toBe(false);
    expect(result.guaranteeReleasing).toBe(false);
  });

  it("populate sets wallet balance and guarantee amount", () => {
    render(<TestComponent featureBase="https://api.example.com" authed={true} />);

    act(() => {
      result.populate({ balance: 500000 }, { amount: 100000 });
    });

    expect(result.walletBalance).toBe(500000);
    expect(result.guaranteeAmount).toBe(100000);
  });

  it("submitSetGuarantee validates minimum amount", async () => {
    render(<TestComponent featureBase="https://api.example.com" authed={true} />);

    act(() => {
      result.setSetGuaranteeAmountInput("50000");
      result.setSetGuaranteePin("123456");
    });

    await act(async () => {
      await result.submitSetGuarantee({ preventDefault: jest.fn() });
    });

    expect(setError).toHaveBeenCalledWith("Minimal jaminan adalah Rp 100.000");
  });

  it("submitSetGuarantee validates PIN length", async () => {
    render(<TestComponent featureBase="https://api.example.com" authed={true} />);

    act(() => {
      result.setSetGuaranteeAmountInput("200000");
      result.setSetGuaranteePin("123");
    });

    await act(async () => {
      await result.submitSetGuarantee({ preventDefault: jest.fn() });
    });

    expect(setError).toHaveBeenCalledWith("PIN harus 6 digit");
  });

  it("submitReleaseGuarantee validates PIN length", async () => {
    render(<TestComponent featureBase="https://api.example.com" authed={true} />);

    act(() => {
      result.setReleaseGuaranteePin("12");
    });

    await act(async () => {
      await result.submitReleaseGuarantee({ preventDefault: jest.fn() });
    });

    expect(setError).toHaveBeenCalledWith("PIN harus 6 digit");
  });

  it("submitReleaseGuarantee calls API and resets on success", async () => {
    fetchWithAuth
      .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue("{}") })
      // loadWalletAndGuarantee calls
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ balance: 500000 }) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ amount: 0 }) });

    render(<TestComponent featureBase="https://feat.example.com" authed={true} />);

    act(() => {
      result.setReleaseGuaranteePin("654321");
    });

    await act(async () => {
      await result.submitReleaseGuarantee({ preventDefault: jest.fn() });
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      "https://feat.example.com/api/v1/guarantees/release",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Idempotency-Key": "test-key-123",
        }),
      })
    );
    expect(setOk).toHaveBeenCalledWith("Jaminan berhasil dilepaskan.");
  });
});
