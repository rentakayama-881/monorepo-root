import { renderHook, act } from "@testing-library/react";
import usePasskeySettings from "../usePasskeySettings";

jest.mock("@/lib/api", () => ({
  getApiBase: () => "https://api.test",
}));

jest.mock("@/lib/authRequest", () => ({
  requireValidTokenOrThrow: jest.fn(() => Promise.resolve("mock-token")),
  readJsonSafe: jest.fn((res) => res.json()),
  throwApiError: jest.fn((res, msg) => Promise.reject(new Error(msg))),
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: { WALLETS: { PIN_STATUS: "/api/v1/wallets/pin-status" } },
  unwrapFeatureData: jest.fn((payload) => payload?.data || payload),
}));

jest.mock("@/lib/webauthn", () => ({
  base64URLToBuffer: jest.fn((v) => v),
  serializePublicKeyCredential: jest.fn((v) => v),
}));

describe("usePasskeySettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns expected initial state", () => {
    const { result } = renderHook(() => usePasskeySettings());

    expect(result.current.loading).toBe(true);
    expect(result.current.passkeys).toEqual([]);
    expect(result.current.error).toBe("");
    expect(result.current.success).toBe("");
    expect(result.current.registering).toBe(false);
    expect(result.current.showPinModal).toBe(false);
    expect(result.current.pin).toBe("");
    expect(result.current.pinError).toBe("");
    expect(result.current.deleting).toBeNull();
    expect(result.current.webAuthnSupported).toBe(true);
  });

  it("exposes all expected functions", () => {
    const { result } = renderHook(() => usePasskeySettings());

    expect(typeof result.current.fetchPasskeys).toBe("function");
    expect(typeof result.current.initWebAuthnCheck).toBe("function");
    expect(typeof result.current.registerPasskey).toBe("function");
    expect(typeof result.current.confirmRegisterPasskey).toBe("function");
    expect(typeof result.current.deletePasskey).toBe("function");
    expect(typeof result.current.renamePasskey).toBe("function");
    expect(typeof result.current.closePinModal).toBe("function");
    expect(typeof result.current.setPin).toBe("function");
    expect(typeof result.current.setPinError).toBe("function");
  });

  it("fetchPasskeys loads passkeys from API", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          passkeys: [{ id: "pk1", name: "My Passkey" }],
        }),
    });

    const { result } = renderHook(() => usePasskeySettings());

    await act(async () => {
      await result.current.fetchPasskeys();
    });

    expect(result.current.passkeys).toEqual([{ id: "pk1", name: "My Passkey" }]);
    expect(result.current.loading).toBe(false);
  });

  it("fetchPasskeys sets error on API failure", async () => {
    const { requireValidTokenOrThrow } = require("@/lib/authRequest");
    requireValidTokenOrThrow.mockRejectedValueOnce(new Error("Auth failed"));

    const { result } = renderHook(() => usePasskeySettings());

    await act(async () => {
      await result.current.fetchPasskeys();
    });

    expect(result.current.error).toBe("Auth failed");
    expect(result.current.loading).toBe(false);
  });

  it("closePinModal resets pin state", () => {
    const { result } = renderHook(() => usePasskeySettings());

    act(() => {
      result.current.setPin("123456");
      result.current.setPinError("some error");
    });

    act(() => {
      result.current.closePinModal();
    });

    expect(result.current.pin).toBe("");
    expect(result.current.pinError).toBe("");
    expect(result.current.showPinModal).toBe(false);
  });
});
