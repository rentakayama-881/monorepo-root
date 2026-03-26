import { render } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("next/dynamic", () => {
  return function mockDynamic(loader, options) {
    const MockComp = (props) => <div data-testid="dynamic-component" />;
    if (options?.loading) {
      MockComp.loading = options.loading;
    }
    return MockComp;
  };
});

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ id: "123" })),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
}));

jest.mock("@/components/ui/Skeleton", () => ({
  __esModule: true,
  default: (props) => <div data-testid="skeleton" />,
}));

jest.mock("@/lib/format", () => ({
  formatIDR: jest.fn((v) => `Rp ${v}`),
}));

jest.mock("../../WorkspaceWorkflowSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="workspace-workflow-skeleton" />,
}));

jest.mock("../components/useRepoWorkflow", () => ({
  useRepoWorkflow: jest.fn(() => ({
    loading: true,
    error: null,
    repoFiles: [],
    validators: [],
    payout: null,
    canAttach: false,
    canFinalize: false,
    attachFile: jest.fn(),
    removeFile: jest.fn(),
    finalize: jest.fn(),
    refresh: jest.fn(),
  })),
}));

jest.mock("../components/RepoFileTable", () => ({
  __esModule: true,
  default: () => <div data-testid="repo-file-table" />,
}));

jest.mock("../components/RepoAttachForm", () => ({
  __esModule: true,
  default: () => <div data-testid="repo-attach-form" />,
}));

jest.mock("../components/RepoValidatorsPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="repo-validators-panel" />,
}));

import RepoWorkflowClient from "../RepoWorkflowClient";

describe("RepoWorkflowClient", () => {
  it("renders without crashing", () => {
    const { container } = render(<RepoWorkflowClient />);
    expect(container).toBeTruthy();
  });

  it("renders in embedded mode", () => {
    const { container } = render(
      <RepoWorkflowClient
        embedded={true}
        caseReadmeMarkdown="# Test"
        caseTitle="Test Case"
        ownerUserId={1}
        viewerUserId={2}
      />
    );
    expect(container).toBeTruthy();
  });
});
