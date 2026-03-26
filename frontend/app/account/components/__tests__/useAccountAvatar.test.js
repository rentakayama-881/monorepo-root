import React from "react";
import { render, act } from "@testing-library/react";
import { useAccountAvatar } from "../useAccountAvatar";

jest.mock("@/lib/tokenRefresh", () => ({
  fetchWithAuth: jest.fn(),
}));

const { fetchWithAuth } = require("@/lib/tokenRefresh");

describe("useAccountAvatar", () => {
  let result;
  const setError = jest.fn();
  const setOk = jest.fn();

  function TestComponent({ apiBase }) {
    Object.assign(result, useAccountAvatar({ apiBase, setError, setOk }));
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
  });

  it("returns initial state", () => {
    render(<TestComponent apiBase="/api" />);

    expect(result.avatarUrl).toBe("");
    expect(result.avatarFile).toBeNull();
    expect(result.avatarPreview).toBe("");
    expect(result.avatarUploading).toBe(false);
    expect(result.avatarDeleting).toBe(false);
  });

  it("populate sets avatarUrl from data", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.populate({ avatar_url: "https://cdn.example.com/avatar.jpg" });
    });

    expect(result.avatarUrl).toBe("https://cdn.example.com/avatar.jpg");
  });

  it("onAvatarFileChange rejects non-jpg/png files", () => {
    render(<TestComponent apiBase="/api" />);

    const event = {
      target: {
        files: [{ name: "doc.gif" }],
        value: "",
      },
    };

    act(() => {
      result.onAvatarFileChange(event);
    });

    expect(setError).toHaveBeenCalledWith("Format gambar harus JPG atau PNG");
    expect(result.avatarFile).toBeNull();
  });

  it("cancelAvatarPreview clears file and preview", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.cancelAvatarPreview();
    });

    expect(result.avatarFile).toBeNull();
    expect(result.avatarPreview).toBe("");
  });

  it("deleteAvatar calls API and clears avatar on success", async () => {
    fetchWithAuth.mockResolvedValue({ ok: true });

    render(<TestComponent apiBase="/api" />);

    await act(async () => {
      await result.deleteAvatar();
    });

    expect(fetchWithAuth).toHaveBeenCalledWith("/api/account/avatar", {
      method: "DELETE",
    });
    expect(result.avatarUrl).toBe("");
    expect(setOk).toHaveBeenCalledWith("Foto profil dihapus.");
  });

  it("deleteAvatar sets error on failure", async () => {
    fetchWithAuth.mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue("Server error"),
    });

    render(<TestComponent apiBase="/api" />);

    await act(async () => {
      await result.deleteAvatar();
    });

    expect(setError).toHaveBeenCalledWith("Server error");
  });
});
