import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PasskeySettings from "../PasskeySettings";

const pushMock = jest.fn();
const mockRequireValidTokenOrThrow = jest.fn();
const mockReadJsonSafe = jest.fn();
const mockThrowApiError = jest.fn();
const mockFetchFeatureAuth = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/lib/api", () => ({
  getApiBase: () => "http://localhost:8080",
}));

jest.mock("@/lib/authRequest", () => ({
  requireValidTokenOrThrow: (...args) => mockRequireValidTokenOrThrow(...args),
  readJsonSafe: (...args) => mockReadJsonSafe(...args),
  throwApiError: (...args) => mockThrowApiError(...args),
}));

jest.mock("@/lib/featureApi", () => ({
  FEATURE_ENDPOINTS: {
    WALLETS: {
      PIN_STATUS: "/api/v1/wallets/pin/status",
    },
  },
  fetchFeatureAuth: (...args) => mockFetchFeatureAuth(...args),
  unwrapFeatureData: (payload) => payload?.data ?? payload,
}));

function createResponse({ ok = true, jsonData = {} } = {}) {
  return {
    ok,
    json: jest.fn().mockResolvedValue(jsonData),
  };
}

describe("PasskeySettings", () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockRequireValidTokenOrThrow.mockReset();
    mockReadJsonSafe.mockReset();
    mockThrowApiError.mockReset();
    mockFetchFeatureAuth.mockReset();
    global.fetch.mockReset();

    window.PublicKeyCredential = function PublicKeyCredential() {};
    Object.defineProperty(window.navigator, "credentials", {
      value: {
        create: jest.fn(),
      },
      configurable: true,
    });

    mockRequireValidTokenOrThrow.mockResolvedValue("token-123");
    mockReadJsonSafe.mockImplementation(async (res) => {
      if (!res || typeof res.json !== "function") return null;
      return res.json();
    });
    mockThrowApiError.mockImplementation(async (res, fallbackMessage) => {
      const data = await mockReadJsonSafe(res);
      const error = new Error(data?.message || fallbackMessage);
      error.code = data?.code;
      error.details = data?.details;
      throw error;
    });
  });

  it("redirects to set-pin flow when PIN is not configured", async () => {
    global.fetch.mockResolvedValueOnce(
      createResponse({ ok: true, jsonData: { passkeys: [] } })
    );
    mockFetchFeatureAuth.mockResolvedValue({ pinSet: false });

    render(<PasskeySettings />);

    const addButton = await screen.findByRole("button", { name: /Tambah Passkey/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockFetchFeatureAuth).toHaveBeenCalledWith("/api/v1/wallets/pin/status");
      expect(pushMock).toHaveBeenCalledWith("/account/wallet/set-pin?redirect=passkey");
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("opens PIN modal before starting passkey registration", async () => {
    global.fetch.mockResolvedValueOnce(
      createResponse({ ok: true, jsonData: { passkeys: [] } })
    );
    mockFetchFeatureAuth.mockResolvedValue({ pinSet: true });

    render(<PasskeySettings />);

    const addButton = await screen.findByRole("button", { name: /Tambah Passkey/i });
    fireEvent.click(addButton);

    expect(await screen.findByText(/Konfirmasi PIN/i)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("sends PIN to begin registration and redirects to set-pin when backend enforces PIN_REQUIRED", async () => {
    global.fetch
      .mockResolvedValueOnce(
        createResponse({ ok: true, jsonData: { passkeys: [] } })
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          jsonData: {
            code: "PIN_REQUIRED",
            message: "PIN wajib diatur sebelum menambah passkey",
          },
        })
      );
    mockFetchFeatureAuth.mockResolvedValue({ pinSet: true });

    render(<PasskeySettings />);

    const addButton = await screen.findByRole("button", { name: /Tambah Passkey/i });
    fireEvent.click(addButton);

    const pinInput = await screen.findByPlaceholderText("••••••");
    fireEvent.change(pinInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verifikasi PIN/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/account/wallet/set-pin?redirect=passkey");
    });

    const beginCall = global.fetch.mock.calls[1];
    expect(beginCall[1]?.body).toBe(JSON.stringify({ pin: "123456" }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("shows invalid PIN error in modal when backend returns INVALID_PIN", async () => {
    global.fetch
      .mockResolvedValueOnce(
        createResponse({ ok: true, jsonData: { passkeys: [] } })
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          jsonData: {
            code: "INVALID_PIN",
            message: "PIN salah. Sisa percobaan: 2",
          },
        })
      );
    mockFetchFeatureAuth.mockResolvedValue({ pinSet: true });

    render(<PasskeySettings />);

    const addButton = await screen.findByRole("button", { name: /Tambah Passkey/i });
    fireEvent.click(addButton);

    const pinInput = await screen.findByPlaceholderText("••••••");
    fireEvent.change(pinInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verifikasi PIN/i }));

    expect(await screen.findByText(/PIN salah\. Sisa percobaan: 2/i)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("redirects to 2FA setup when wallet check returns TWO_FACTOR_REQUIRED", async () => {
    global.fetch.mockResolvedValueOnce(
      createResponse({ ok: true, jsonData: { passkeys: [] } })
    );
    const twoFactorError = new Error("Two-factor required");
    twoFactorError.code = "TWO_FACTOR_REQUIRED";
    mockFetchFeatureAuth.mockRejectedValue(twoFactorError);

    render(<PasskeySettings />);

    const addButton = await screen.findByRole("button", { name: /Tambah Passkey/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/account/security?setup2fa=true&redirect=%2Faccount%2Fwallet%2Fset-pin%3Fredirect%3Dpasskey"
      );
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("redirects to 2FA setup when backend enforces TWO_FACTOR_REQUIRED on begin registration", async () => {
    global.fetch
      .mockResolvedValueOnce(
        createResponse({ ok: true, jsonData: { passkeys: [] } })
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          jsonData: {
            code: "TWO_FACTOR_REQUIRED",
            message: "Two-factor authentication required",
          },
        })
      );
    mockFetchFeatureAuth.mockResolvedValue({ pinSet: true });

    render(<PasskeySettings />);

    const addButton = await screen.findByRole("button", { name: /Tambah Passkey/i });
    fireEvent.click(addButton);

    const pinInput = await screen.findByPlaceholderText("••••••");
    fireEvent.change(pinInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verifikasi PIN/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/account/security?setup2fa=true&redirect=%2Faccount%2Fwallet%2Fset-pin%3Fredirect%3Dpasskey"
      );
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
