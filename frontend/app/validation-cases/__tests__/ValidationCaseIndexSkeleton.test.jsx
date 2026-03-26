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

import ValidationCaseIndexSkeleton, {
  ValidationCaseIndexContentSkeleton,
} from "../ValidationCaseIndexSkeleton";

describe("ValidationCaseIndexSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<ValidationCaseIndexSkeleton />);
    expect(container).toBeTruthy();
  });
});

describe("ValidationCaseIndexContentSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<ValidationCaseIndexContentSkeleton />);
    expect(container).toBeTruthy();
  });

  it("renders with fullHeight prop", () => {
    const { container } = render(<ValidationCaseIndexContentSkeleton fullHeight={true} />);
    expect(container).toBeTruthy();
  });
});
