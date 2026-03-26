import { render } from "@testing-library/react";

jest.mock("@/components/ui/Skeleton", () => {
  const Skeleton = (props) => <div data-testid="skeleton" />;
  const SkeletonCircle = (props) => <div data-testid="skeleton-circle" />;
  const SkeletonText = (props) => <div data-testid="skeleton-text" />;
  return {
    __esModule: true,
    default: Skeleton,
    SkeletonCircle,
    SkeletonText,
  };
});

jest.mock("../WorkspaceWorkflowSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="workspace-workflow-skeleton" />,
}));

import ValidationCaseRecordSkeleton from "../ValidationCaseRecordSkeleton";

describe("ValidationCaseRecordSkeleton", () => {
  it("renders without crashing with default variant", () => {
    const { container } = render(<ValidationCaseRecordSkeleton />);
    expect(container).toBeTruthy();
  });

  it("renders standard variant", () => {
    const { container } = render(<ValidationCaseRecordSkeleton variant="standard" />);
    expect(container).toBeTruthy();
  });

  it("renders workspace variant", () => {
    const { container } = render(<ValidationCaseRecordSkeleton variant="workspace" />);
    expect(container).toBeTruthy();
  });

  it("renders generic variant", () => {
    const { container } = render(<ValidationCaseRecordSkeleton variant="generic" />);
    expect(container).toBeTruthy();
  });
});
