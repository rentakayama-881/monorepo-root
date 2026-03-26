import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("../Avatar", () => ({
  __esModule: true,
  default: (props) => <div data-testid="avatar" />,
}));

jest.mock("../Badge", () => ({
  __esModule: true,
  default: (props) => <span data-testid="badge" />,
}));

jest.mock("../TagPill", () => ({
  TagList: (props) => <div data-testid="tag-list" />,
}));

jest.mock("@/lib/format", () => ({
  formatIDR: jest.fn((v) => `Rp ${v}`),
}));

jest.mock("../validationCaseTableUtils", () => ({
  formatDate: jest.fn(() => "01 Jan 2024"),
  sensitivityText: jest.fn(() => "S1 Terbatas"),
  StatusPill: ({ status }) => <span data-testid="status-pill">{status}</span>,
}));

import ValidationCaseMobileList from "../ValidationCaseMobileList";

describe("ValidationCaseMobileList", () => {
  const mockItems = [
    {
      id: 1,
      caseId: "VC-001",
      title: "Test Validation Case",
      status: "open",
      bountyAmount: 500000,
      sensitivity: "S1",
      tags: ["test"],
      createdAt: "2024-01-01",
      owner: { username: "user1", avatarUrl: "" },
      totalStake: 100000,
    },
  ];

  it("renders without crashing", () => {
    const { container } = render(
      <ValidationCaseMobileList
        items={mockItems}
        baseHref="/validation-cases"
        showCategory={false}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders items", () => {
    render(
      <ValidationCaseMobileList
        items={mockItems}
        baseHref="/validation-cases"
        showCategory={false}
      />
    );
    expect(screen.getByText("Test Validation Case")).toBeInTheDocument();
  });

  it("renders empty when no items", () => {
    const { container } = render(
      <ValidationCaseMobileList items={[]} baseHref="/validation-cases" showCategory={false} />
    );
    expect(container).toBeTruthy();
  });
});
