import React from "react";
import { render, act } from "@testing-library/react";
import { useAccountProfile } from "../useAccountProfile";

jest.mock("@/lib/tokenRefresh", () => ({
  fetchWithAuth: jest.fn(),
}));

const { fetchWithAuth } = require("@/lib/tokenRefresh");

describe("useAccountProfile", () => {
  let result;
  const setError = jest.fn();
  const setOk = jest.fn();

  function TestComponent({ apiBase }) {
    Object.assign(result, useAccountProfile({ apiBase, setError, setOk }));
    return null;
  }

  beforeEach(() => {
    result = {};
    setError.mockClear();
    setOk.mockClear();
    jest.clearAllMocks();
  });

  it("returns initial state", () => {
    render(<TestComponent apiBase="/api" />);

    expect(result.username).toBe("");
    expect(result.form).toEqual({
      full_name: "",
      bio: "",
      pronouns: "",
      company: "",
    });
    expect(result.socials).toEqual([{ label: "", url: "" }]);
    expect(result.profileDirty).toBe(false);
    expect(result.profileSaving).toBe(false);
  });

  it("populate fills form data and marks profile as clean", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.populate({
        username: "alice",
        full_name: "Alice Smith",
        bio: "Developer",
        pronouns: "she/her",
        company: "Acme",
        social_accounts: [{ label: "GitHub", url: "https://github.com/alice" }],
        telegram_auth: { connected: true, username: "alice_tg" },
      });
    });

    expect(result.username).toBe("alice");
    expect(result.form.full_name).toBe("Alice Smith");
    expect(result.socials).toEqual([{ label: "GitHub", url: "https://github.com/alice" }]);
    expect(result.profileDirty).toBe(false);
    expect(result.telegramAuth.connected).toBe(true);
  });

  it("updateSocial modifies a social entry", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.updateSocial(0, "label", "Twitter");
    });

    expect(result.socials[0].label).toBe("Twitter");
  });

  it("addSocial appends a new empty entry", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.addSocial();
    });

    expect(result.socials).toHaveLength(2);
  });

  it("removeSocial removes the specified index", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.addSocial();
    });
    expect(result.socials).toHaveLength(2);

    act(() => {
      result.removeSocial(0);
    });

    expect(result.socials).toHaveLength(1);
  });

  it("saveAccount calls API when profile is dirty", async () => {
    fetchWithAuth.mockResolvedValue({ ok: true });

    render(<TestComponent apiBase="/api" />);

    // Populate to set savedProfileSignature
    act(() => {
      result.populate({
        username: "alice",
        full_name: "Alice",
        bio: "",
        pronouns: "",
        company: "",
        social_accounts: [],
      });
    });

    // Make dirty
    act(() => {
      result.setForm({ full_name: "Alice Updated", bio: "", pronouns: "", company: "" });
    });

    expect(result.profileDirty).toBe(true);

    await act(async () => {
      await result.saveAccount({ preventDefault: jest.fn() });
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/account",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
