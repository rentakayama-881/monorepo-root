import { render } from "@testing-library/react";

jest.mock("@/components/ui/Skeleton", () => {
  const Skeleton = (props) => <div data-testid="skeleton" />;
  const SkeletonText = (props) => <div data-testid="skeleton-text" />;
  return {
    __esModule: true,
    default: Skeleton,
    SkeletonText,
  };
});

import WorkspaceWorkflowSkeleton from "../WorkspaceWorkflowSkeleton";

describe("WorkspaceWorkflowSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<WorkspaceWorkflowSkeleton />);
    expect(container).toBeTruthy();
  });

  it("renders with custom className", () => {
    const { container } = render(<WorkspaceWorkflowSkeleton className="custom-class" />);
    expect(container).toBeTruthy();
  });
});
