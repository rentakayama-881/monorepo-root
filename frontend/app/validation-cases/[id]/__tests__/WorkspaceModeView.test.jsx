import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("@/components/ui/TagPill", () => ({
  TagList: (props) => <div data-testid="tag-list" />,
}));

jest.mock("@/lib/format", () => ({
  formatIDR: jest.fn((v) => `Rp ${v}`),
}));

jest.mock("../components/validationCaseDetailUtils", () => ({
  looksLikeMarkdownText: jest.fn(() => false),
}));

jest.mock("../components/CaseSharedComponents", () => ({
  StatusBadge: (props) => <span data-testid="status-badge" />,
}));

jest.mock("../repo/RepoWorkflowClient", () => ({
  __esModule: true,
  default: () => <div data-testid="repo-workflow-client" />,
}));

import WorkspaceModeView from "../WorkspaceModeView";

describe("WorkspaceModeView", () => {
  const defaultProps = {
    id: "123",
    vc: {
      id: 123,
      title: "Test Case",
      bountyAmount: 500000,
      tags: ["tag1"],
      sensitivity: "S1",
      caseCategory: "workspace",
    },
    me: { id: 1, username: "testuser" },
    error: null,
    status: "open",
    sensitivity: { level: "S1", label: "Terbatas" },
    ownerHandle: "@testowner",
    filedAtLabel: "01 Jan 2024",
    caseReadmeMarkdown: "",
    owner: { id: 2, username: "testowner" },
  };

  it("renders without crashing", () => {
    const { container } = render(<WorkspaceModeView {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders the case title", () => {
    render(<WorkspaceModeView {...defaultProps} />);
    expect(screen.getByText("Test Case")).toBeInTheDocument();
  });
});
