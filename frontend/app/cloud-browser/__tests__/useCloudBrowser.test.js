import React from "react";
import { render, act } from "@testing-library/react";
import { useProfiles, usePricing } from "../useCloudBrowser";

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
  AUTH_CHANGED_EVENT: "auth-changed",
}));

jest.mock("@/lib/swr", () => ({
  swrConfig: {},
  authFetcher: jest.fn(),
}));

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({
  __esModule: true,
  default: (...args) => mockUseSWR(...args),
}));

describe("useCloudBrowser hooks", () => {
  let result;

  function TestProfiles() {
    Object.assign(result, useProfiles());
    return null;
  }

  function TestPricing() {
    Object.assign(result, usePricing());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
  });

  it("useProfiles returns expected structure", async () => {
    mockUseSWR.mockReturnValue({
      data: { profiles: [{ id: "p1", name: "Profile 1" }] },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    await act(async () => {
      render(<TestProfiles />);
    });

    expect(result.profiles).toEqual([{ id: "p1", name: "Profile 1" }]);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(typeof result.mutate).toBe("function");
  });

  it("usePricing returns pricing data", async () => {
    mockUseSWR.mockReturnValue({
      data: { price_per_hour: 15000, price_per_minute: 250 },
      error: null,
      isLoading: false,
    });

    await act(async () => {
      render(<TestPricing />);
    });

    expect(result.pricing).toEqual({ price_per_hour: 15000, price_per_minute: 250 });
    expect(result.pricePerHour).toBe(15000);
    expect(result.pricePerMinute).toBe(250);
  });
});
