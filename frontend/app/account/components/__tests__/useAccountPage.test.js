import React from "react";
import { render, act } from "@testing-library/react";
import { useAccountPage } from "../useAccountPage";

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
}));

jest.mock("@/lib/api", () => ({
  getApiBase: jest.fn(() => "https://api.test"),
}));

jest.mock("@/lib/tokenRefresh", () => ({
  fetchWithAuth: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          username: "testuser",
          full_name: "Test User",
          bio: "",
          pronouns: "",
          company: "",
          social_accounts: [],
          avatar_url: "",
        }),
    })
  ),
}));

jest.mock("../useAccountProfile", () => ({
  useAccountProfile: jest.fn(() => ({
    username: "testuser",
    form: { full_name: "", bio: "", pronouns: "", company: "" },
    setForm: jest.fn(),
    socials: [{ label: "", url: "" }],
    telegramAuth: { connected: false },
    setTelegramAuth: jest.fn(),
    profileDirty: false,
    profileSaving: false,
    profileSaveMessage: "",
    updateSocial: jest.fn(),
    addSocial: jest.fn(),
    removeSocial: jest.fn(),
    saveAccount: jest.fn(),
    populate: jest.fn(),
  })),
}));

jest.mock("../useAccountAvatar", () => ({
  useAccountAvatar: jest.fn(() => ({
    avatarUrl: "",
    avatarFile: null,
    avatarPreview: "",
    avatarUploading: false,
    avatarDeleting: false,
    onAvatarFileChange: jest.fn(),
    cancelAvatarPreview: jest.fn(),
    uploadAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
    populate: jest.fn(),
  })),
}));

jest.mock("../useAccountBadges", () => ({
  useAccountBadges: jest.fn(() => ({
    badges: [],
    primaryBadgeId: null,
    savingBadge: false,
    savePrimaryBadge: jest.fn(),
    populate: jest.fn(),
  })),
}));

jest.mock("../useAccountGuarantee", () => ({
  useAccountGuarantee: jest.fn(() => ({
    walletBalance: null,
    guaranteeAmount: 0,
    guaranteeLoading: false,
    setGuaranteeAmountInput: "",
    setSetGuaranteeAmountInput: jest.fn(),
    setGuaranteePin: "",
    setSetGuaranteePin: jest.fn(),
    releaseGuaranteePin: "",
    setReleaseGuaranteePin: jest.fn(),
    guaranteeSubmitting: false,
    guaranteeReleasing: false,
    submitSetGuarantee: jest.fn(),
    submitReleaseGuarantee: jest.fn(),
    populate: jest.fn(),
  })),
}));

describe("useAccountPage", () => {
  let result;

  function TestComponent() {
    Object.assign(result, useAccountPage());
    return null;
  }

  beforeEach(() => {
    result = {};
  });

  it("returns authed=true when token exists", () => {
    render(<TestComponent />);
    expect(result.authed).toBe(true);
  });

  it("returns expected shape", () => {
    render(<TestComponent />);

    expect(result).toHaveProperty("loading");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("username");
    expect(result).toHaveProperty("avatarUrl");
    expect(result).toHaveProperty("badges");
    expect(result).toHaveProperty("guaranteeAmount");
    expect(result).toHaveProperty("apiBase");
    expect(result.apiBase).toBe("https://api.test/api");
  });

  it("returns passkeySectionRef as a ref object", () => {
    render(<TestComponent />);
    expect(result.passkeySectionRef).toHaveProperty("current");
  });
});
