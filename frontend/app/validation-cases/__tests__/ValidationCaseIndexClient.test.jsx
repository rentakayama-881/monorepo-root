import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <div data-href={props.href}>{children}</div>;
  };
});

jest.mock("lucide-react", () => ({
  ChevronDown: (props) => <span data-testid="chevron-down" />,
}));

jest.mock("@/components/ui/NativeSelect", () => ({
  __esModule: true,
  default: (props) => <select data-testid="native-select" />,
}));

jest.mock("@/components/ui/Avatar", () => ({
  __esModule: true,
  default: (props) => <div data-testid="avatar" />,
}));

jest.mock("@/components/ui/Badge", () => ({
  __esModule: true,
  default: (props) => <span data-testid="badge" />,
}));

jest.mock("@/components/ui/TagPill", () => ({
  TagList: (props) => <div data-testid="tag-list" />,
}));

jest.mock("@/components/ui/EmptyState", () => ({
  __esModule: true,
  default: (props) => <div data-testid="empty-state" />,
}));

jest.mock("@/lib/format", () => ({
  formatIDR: jest.fn((v) => `Rp ${v}`),
  formatDate: jest.fn(() => "01 Jan 2024"),
}));

jest.mock("@/lib/constants", () => ({
  DATE_FORMATS: { short: "dd MMM yyyy" },
}));

import ValidationCaseIndexClient from "../ValidationCaseIndexClient";

describe("ValidationCaseIndexClient", () => {
  it("renders without crashing with empty cases", () => {
    const { container } = render(<ValidationCaseIndexClient cases={[]} fetchError="" />);
    expect(container).toBeTruthy();
  });

  it("renders without crashing with null cases", () => {
    const { container } = render(<ValidationCaseIndexClient />);
    expect(container).toBeTruthy();
  });

  it("renders with cases data", () => {
    const cases = [
      {
        id: 1,
        caseId: "VC-001",
        title: "Test Case",
        status: "open",
        bountyAmount: 500000,
        sensitivity: "S1",
        tags: [],
        createdAt: "2024-01-01",
        owner: { username: "user1", avatarUrl: "" },
      },
    ];
    const { container } = render(<ValidationCaseIndexClient cases={cases} fetchError="" />);
    expect(container).toBeTruthy();
  });
});
