import { render, screen } from "@testing-library/react";
import ValidationCaseTable from "../ValidationCaseTable";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock("@/lib/avatar", () => ({
  resolveAvatarSrc: () => null,
  getInitials: (name) => (name ? name[0] : "?"),
  getAvatarColor: () => "bg-gray-200",
}));

jest.mock("@/lib/format", () => ({
  formatIDR: (amount) => `Rp ${amount}`,
}));

describe("ValidationCaseTable", () => {
  it("renders without crashing with empty cases", () => {
    render(<ValidationCaseTable cases={[]} />);
  });

  it("renders with cases", () => {
    const cases = [
      {
        id: "1",
        title: "Test Case",
        status: "open",
        budget: 100000,
        owner: { username: "user1", display_name: "User One" },
        tags: [],
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    render(<ValidationCaseTable cases={cases} />);
    expect(screen.getAllByText("Test Case").length).toBeGreaterThan(0);
  });
});
