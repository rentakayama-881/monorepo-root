import React from "react";
import { render, act } from "@testing-library/react";
import useOrderDetail, {
  normalizeSubscription,
  normalizeFailure,
  getStepLabel,
} from "../useOrderDetail";

jest.mock("next/navigation", () => ({
  useParams: () => ({ orderId: "order-1" }),
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));

const { fetchJsonAuth } = require("@/lib/api");

describe("normalizeSubscription", () => {
  it("extracts subscription from delivery", () => {
    const order = { delivery: { account: { subscription: "Plus Plan" } } };
    expect(normalizeSubscription(order)).toBe("Plus ");
  });

  it("strips plan suffix", () => {
    const order = { delivery: { account: { subscription: "TeamPlan" } } };
    expect(normalizeSubscription(order)).toBe("Team");
  });

  it("returns dash for missing", () => {
    expect(normalizeSubscription({})).toBe("-");
  });

  it("uses title as fallback", () => {
    expect(normalizeSubscription({ title: "Pro" })).toBe("Pro");
  });
});

describe("normalizeFailure", () => {
  it("normalizes timeout errors", () => {
    expect(normalizeFailure("request timed out")).toContain("batas waktu");
  });

  it("normalizes insufficient balance", () => {
    expect(normalizeFailure("Saldo kamu tidak mencukupi")).toContain("Saldo wallet");
  });

  it("passes through akun messages", () => {
    expect(normalizeFailure("Akun sudah tidak tersedia")).toBe("Akun sudah tidak tersedia");
  });

  it("normalizes checker errors", () => {
    expect(normalizeFailure("checker busy retry_request")).toContain("verifikasi sedang sibuk");
  });

  it("returns generic message for unknown errors", () => {
    expect(normalizeFailure("xyz")).toContain("kendala sementara");
  });
});

describe("getStepLabel", () => {
  it("maps INIT", () => {
    expect(getStepLabel({ code: "INIT" })).toBe("Pesanan dibuat");
  });

  it("maps PROCESSING", () => {
    expect(getStepLabel({ code: "PROCESSING" })).toBe("Memulai proses pembelian");
  });

  it("maps USER_BALANCE_CHECK", () => {
    expect(getStepLabel({ code: "USER_BALANCE_CHECK" })).toBe("Memeriksa saldo wallet");
  });

  it("maps PURCHASE_EXECUTION", () => {
    expect(getStepLabel({ code: "PURCHASE_EXECUTION" })).toBe("Menjalankan pembelian");
  });

  it("maps DELIVERY_READY", () => {
    expect(getStepLabel({ code: "DELIVERY_READY" })).toBe("Data akun siap diberikan");
  });

  it("uses label fallback for unknown code", () => {
    expect(getStepLabel({ code: "UNKNOWN", label: "Custom" })).toBe("Custom");
  });

  it("returns Memproses for empty step", () => {
    expect(getStepLabel({})).toBe("Memproses");
  });
});

describe("useOrderDetail", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useOrderDetail());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    fetchJsonAuth.mockResolvedValue({
      order: {
        id: "order-1",
        status: "fulfilled",
        steps: [{ code: "DELIVERY_READY", label: "Done" }],
        delivery: { account: { subscription: "Plus" } },
      },
    });
  });

  it("loads order on mount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    // Wait for loading to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.loading).toBe(false);
    expect(result.order).toBeTruthy();
    expect(result.order.id).toBe("order-1");
  });

  it("computes statusText for fulfilled", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.statusText).toBe("Selesai");
    expect(result.isProcessing).toBe(false);
  });

  it("computes isProcessing for pending orders", async () => {
    fetchJsonAuth.mockResolvedValue({
      order: {
        id: "order-2",
        status: "processing",
        steps: [{ code: "PROCESSING" }],
      },
    });

    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.isProcessing).toBe(true);
    expect(result.statusText).toBe("Diproses");
  });

  it("sets error on API failure", async () => {
    fetchJsonAuth.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.error).toBe("Network error");
  });

  it("handleRefresh triggers reload", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      result.handleRefresh();
    });

    expect(result.manualRefresh).toBe(true);
  });
});
