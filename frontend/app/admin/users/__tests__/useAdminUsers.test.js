import React from "react";
import { render, act } from "@testing-library/react";
import useAdminUsers from "../useAdminUsers";

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

describe("useAdminUsers", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useAdminUsers());
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();

    // Mock for both users and badges fetch
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          users: [
            { id: 1, email: "alice@test.com", username: "alice", badges: [] },
            { id: 2, email: "bob@test.com", username: "bob", badges: [] },
          ],
          total: 2,
          badges: [],
        })
      ),
    });
  });

  it("loads users on mount", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.loading).toBe(false);
    expect(result.users).toHaveLength(2);
    expect(result.users[0].username).toBe("alice");
  });

  it("handleSearch triggers fetch with search query", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.setSearch("alice");
    });

    await act(async () => {
      result.handleSearch({ preventDefault: jest.fn() });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("search=alice"),
      expect.any(Object)
    );
  });

  it("openAssignModal sets selected user", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openAssignModal({ id: 1, username: "alice" });
    });

    expect(result.showAssignModal).toBe(true);
    expect(result.selectedUser).toEqual({ id: 1, username: "alice" });
  });

  it("handleAssign validates badge selection", async () => {
    await act(async () => {
      render(<TestComponent />);
    });

    act(() => {
      result.openAssignModal({ id: 1, username: "alice" });
    });

    // No badge selected
    await act(async () => {
      result.handleAssign({ preventDefault: jest.fn() });
    });

    expect(result.assignError).toBe("Pilih badge");
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

  it("loadMore increments page", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          users: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            username: `user${i + 1}`,
            email: `user${i + 1}@test.com`,
            badges: [],
          })),
          total: 40,
        })
      ),
    });

    await act(async () => {
      render(<TestComponent />);
    });

    expect(result.hasMore).toBe(true);

    await act(async () => {
      result.loadMore();
    });

    // After loadMore, fetch should be called with page 2
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      expect.any(Object)
    );
  });
});
