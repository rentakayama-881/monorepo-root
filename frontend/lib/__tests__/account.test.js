import { describe, expect, it } from "vitest";
import { buildSocialAccountsPayload, normalizeSocialAccounts } from "../account";

describe("normalizeSocialAccounts", () => {
  it("returns array as-is", () => {
    const input = [{ label: "Twitter", url: "https://x.com/user" }];
    expect(normalizeSocialAccounts(input)).toEqual(input);
  });

  it("converts object map to list", () => {
    const input = { Twitter: "https://x.com/user", GitHub: "https://github.com/user" };
    expect(normalizeSocialAccounts(input)).toEqual([
      { label: "Twitter", url: "https://x.com/user" },
      { label: "GitHub", url: "https://github.com/user" },
    ]);
  });

  it("returns empty array for invalid input", () => {
    expect(normalizeSocialAccounts(null)).toEqual([]);
    expect(normalizeSocialAccounts("invalid")).toEqual([]);
  });
});

describe("buildSocialAccountsPayload", () => {
  it("builds map and trims values", () => {
    const input = [
      { label: "  Twitter ", url: " https://x.com/user " },
      { label: " ", url: "https://example.com" },
      { label: "GitHub", url: "" },
    ];

    expect(buildSocialAccountsPayload(input)).toEqual({
      Twitter: "https://x.com/user",
    });
  });
});
