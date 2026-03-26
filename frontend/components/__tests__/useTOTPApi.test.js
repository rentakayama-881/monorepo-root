import { renderHook, act } from "@testing-library/react";
import { useTOTPApi } from "../useTOTPApi";

jest.mock("@/lib/api", () => ({
  getApiBase: () => "https://api.test",
}));

jest.mock("@/lib/authRequest", () => ({
  requireValidTokenOrThrow: jest.fn(() => Promise.resolve("mock-token")),
  readJsonSafe: jest.fn((res) => res.json()),
  throwApiError: jest.fn((res, msg) => Promise.reject(new Error(msg))),
}));

describe("useTOTPApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns expected initial state", () => {
    const { result } = renderHook(() => useTOTPApi());

    expect(result.current.status).toEqual({ enabled: false, verified_at: null });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe("");
    expect(result.current.success).toBe("");
    expect(result.current.setupData).toBeNull();
    expect(result.current.setupCode).toBe("");
    expect(result.current.setupLoading).toBe(false);
    expect(result.current.showDisable).toBe(false);
    expect(result.current.disablePassword).toBe("");
    expect(result.current.disableCode).toBe("");
    expect(result.current.disableLoading).toBe(false);
    expect(result.current.backupCodes).toBeNull();
    expect(result.current.backupCount).toBe(0);
  });

  it("exposes all expected functions and setters", () => {
    const { result } = renderHook(() => useTOTPApi());

    expect(typeof result.current.fetchStatus).toBe("function");
    expect(typeof result.current.startSetup).toBe("function");
    expect(typeof result.current.verifyAndEnable).toBe("function");
    expect(typeof result.current.disableTOTP).toBe("function");
    expect(typeof result.current.copyBackupCodes).toBe("function");
    expect(typeof result.current.setError).toBe("function");
    expect(typeof result.current.setSuccess).toBe("function");
    expect(typeof result.current.setSetupData).toBe("function");
    expect(typeof result.current.setSetupCode).toBe("function");
    expect(typeof result.current.setShowDisable).toBe("function");
    expect(typeof result.current.setDisablePassword).toBe("function");
    expect(typeof result.current.setDisableCode).toBe("function");
  });

  it("fetchStatus loads TOTP status from API", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true, verified_at: "2024-01-01" }),
    });
    // backup codes count fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 5 }),
    });

    const { result } = renderHook(() => useTOTPApi());

    await act(async () => {
      await result.current.fetchStatus();
    });

    expect(result.current.status).toEqual({ enabled: true, verified_at: "2024-01-01" });
    expect(result.current.backupCount).toBe(5);
    expect(result.current.loading).toBe(false);
  });

  it("fetchStatus sets error on failure", async () => {
    const { requireValidTokenOrThrow } = require("@/lib/authRequest");
    requireValidTokenOrThrow.mockRejectedValueOnce(new Error("Token invalid"));

    const { result } = renderHook(() => useTOTPApi());

    await act(async () => {
      await result.current.fetchStatus();
    });

    expect(result.current.error).toBe("Token invalid");
    expect(result.current.loading).toBe(false);
  });

  it("startSetup fetches setup data from API", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          secret: "ABCDEF",
          qr_code: "data:image/png;base64,...",
        }),
    });

    const { result } = renderHook(() => useTOTPApi());

    await act(async () => {
      await result.current.startSetup();
    });

    expect(result.current.setupData).toEqual({
      secret: "ABCDEF",
      qr_code: "data:image/png;base64,...",
    });
  });

  it("verifyAndEnable rejects if code is not 6 digits", async () => {
    const { result } = renderHook(() => useTOTPApi());

    act(() => {
      result.current.setSetupCode("123"); // too short
    });

    const mockEvent = { preventDefault: jest.fn() };
    await act(async () => {
      await result.current.verifyAndEnable(mockEvent);
    });

    expect(result.current.error).toContain("6 digit");
  });
});
