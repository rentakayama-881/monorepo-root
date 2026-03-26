import { render, screen } from "@testing-library/react";
import SecurityLayout, { metadata } from "../layout";

describe("SecurityLayout", () => {
  it("renders children as-is", () => {
    render(
      <SecurityLayout>
        <span>sec content</span>
      </SecurityLayout>
    );
    expect(screen.getByText("sec content")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata.title).toBe("Keamanan Akun");
    expect(metadata.description).toContain("kata sandi");
  });
});
