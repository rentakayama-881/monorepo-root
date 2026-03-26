import { renderHook, act } from "@testing-library/react";
import useProfileSidebar from "../useProfileSidebar";

// Modules already mocked in jest.setup.js: next/navigation, fetch, localStorage

jest.mock("@/lib/api", () => ({
  getApiBase: () => "https://api.test",
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "test-token"),
  clearToken: jest.fn(),
}));

jest.mock("@/lib/tokenRefresh", () => ({
  fetchWithAuth: jest.fn(),
}));

describe("useProfileSidebar", () => {
  const mockOnClose = jest.fn();
  const mockTriggerRef = { current: document.createElement("button") };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user endpoint returns ok data
    const { fetchWithAuth } = require("@/lib/tokenRefresh");
    fetchWithAuth.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          username: "testuser",
          avatar_url: "https://img.test/a.png",
          email: "test@test.com",
        }),
    });
  });

  it("returns expected shape of state and handlers", () => {
    const { result } = renderHook(() =>
      useProfileSidebar({ onClose: mockOnClose, triggerRef: mockTriggerRef })
    );

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("wallet");
    expect(result.current).toHaveProperty("guarantee");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("isSigningOut");
    expect(result.current).toHaveProperty("loadError");
    expect(result.current).toHaveProperty("panelRef");
    expect(result.current).toHaveProperty("displayName");
    expect(typeof result.current.handlePanelNavigation).toBe("function");
    expect(typeof result.current.handleLogout).toBe("function");
    expect(typeof result.current.handleRetry).toBe("function");
  });

  it("initializes with loading true", () => {
    const { result } = renderHook(() =>
      useProfileSidebar({ onClose: mockOnClose, triggerRef: mockTriggerRef })
    );
    // isLoading is true initially before the fetch resolves
    expect(result.current.isLoading).toBe(true);
  });

  it("sets body overflow to hidden on mount", () => {
    renderHook(() => useProfileSidebar({ onClose: mockOnClose, triggerRef: mockTriggerRef }));
    expect(document.body.style.overflow).toBe("hidden");
  });
});
