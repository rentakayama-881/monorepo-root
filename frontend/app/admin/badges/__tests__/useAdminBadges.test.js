import React from "react";
import { render, act } from "@testing-library/react";
import useAdminBadges from "../useAdminBadges";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  getApiBase: jest.fn(() => "https://api.test"),
}));

jest.mock("@/lib/adminAuth", () => ({
  getAdminToken: jest.fn(() => "admin-token"),
  clearAdminSession: jest.fn(),
}));

jest.mock("@/lib/featureApi", () => ({
  unwrapFeatureData: jest.fn((d) => d),
}));

describe("useAdminBadges", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useAdminBadges());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          badges: [
            {
              id: 1,
              name: "Pro",
              slug: "pro",
              description: "",
              icon_type: "verified",
              color: "#3b82f6",
            },
          ],
        })
      ),
    });
  });

  it("loads badges on mount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.loading).toBe(false);
    expect(result.badges).toHaveLength(1);
    expect(result.badges[0].name).toBe("Pro");
  });

  it("openCreateModal resets form and shows modal", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openCreateModal();
    });

    expect(result.showModal).toBe(true);
    expect(result.editingBadge).toBeNull();
    expect(result.formData.name).toBe("");
  });

  it("openEditModal populates form with badge data", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openEditModal({
        id: 1,
        name: "Pro",
        slug: "pro",
        description: "Pro badge",
        icon_type: "star",
        color: "#ff0000",
      });
    });

    expect(result.showModal).toBe(true);
    expect(result.editingBadge).toBeTruthy();
    expect(result.formData.name).toBe("Pro");
    expect(result.formData.slug).toBe("pro");
  });

  it("handleSubmit validates name", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openCreateModal();
    });

    // Set empty name, some slug
    act(() => {
      result.setFormData({ ...result.formData, name: "", slug: "test" });
    });

    await act(async () => {
      await result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(result.error).toBe("Nama badge wajib diisi");
  });

  it("handleSubmit validates slug", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openCreateModal();
    });

    act(() => {
      result.setFormData({ ...result.formData, name: "Test", slug: "" });
    });

    await act(async () => {
      await result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(result.error).toBe("Slug badge wajib diisi");
  });

  it("handles auth expired on 401", async () => {
    const { clearAdminSession } = require("@/lib/adminAuth");
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue("{}"),
    });

    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.authError).toBe("Sesi admin berakhir. Silakan login kembali.");
    expect(clearAdminSession).toHaveBeenCalled();
  });
});
