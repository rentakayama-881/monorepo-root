import React from "react";
import { render, act } from "@testing-library/react";
import useValidationCasesList from "../useValidationCasesList";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
}));

const { fetchJsonAuth } = require("@/lib/api");

describe("useValidationCasesList", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useValidationCasesList());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    fetchJsonAuth.mockResolvedValue({ validation_cases: [] });
  });

  it("returns initial loading state", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    // After load completes
    expect(result.loading).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.error).toBe("");
  });

  it("loads items from API", async () => {
    const mockItems = [
      { id: "1", title: "Case 1" },
      { id: "2", title: "Case 2" },
    ];
    fetchJsonAuth.mockResolvedValue({ validation_cases: mockItems });

    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.items).toEqual(mockItems);
    expect(fetchJsonAuth).toHaveBeenCalledWith("/api/validation-cases/me", {
      method: "GET",
    });
  });

  it("sets error on API failure", async () => {
    fetchJsonAuth.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.error).toBe("Network error");
    expect(result.items).toEqual([]);
  });

  it("openDeleteDialog sets deleteTarget", async () => {
    fetchJsonAuth.mockResolvedValue({ validation_cases: [] });

    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openDeleteDialog({ id: "abc", title: "Test Case" });
    });

    expect(result.deleteTarget).toEqual({
      id: "abc",
      title: "Test Case",
    });
  });

  it("openDeleteDialog ignores if no id", async () => {
    fetchJsonAuth.mockResolvedValue({ validation_cases: [] });

    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openDeleteDialog({});
    });

    expect(result.deleteTarget).toBeNull();
  });

  it("confirmDeleteCase calls API and reloads", async () => {
    fetchJsonAuth
      .mockResolvedValueOnce({ validation_cases: [{ id: "1", title: "A" }] })
      .mockResolvedValueOnce({}) // delete call
      .mockResolvedValueOnce({ validation_cases: [] }); // reload

    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openDeleteDialog({ id: "1", title: "A" });
    });

    await act(async () => {
      await result.confirmDeleteCase();
    });

    expect(fetchJsonAuth).toHaveBeenCalledWith("/api/validation-cases/1", { method: "DELETE" });
  });
});
