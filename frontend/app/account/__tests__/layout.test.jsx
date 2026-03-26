import { render, screen } from "@testing-library/react";
import AccountLayout, { metadata } from "../layout";

describe("AccountLayout", () => {
  it("renders children as-is", () => {
    render(
      <AccountLayout>
        <p>child content</p>
      </AccountLayout>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata.title).toBe("Akun Saya");
    expect(metadata.description).toContain("profil");
  });
});
