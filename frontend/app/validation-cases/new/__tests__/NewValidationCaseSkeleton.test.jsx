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

import NewValidationCaseSkeleton from "../NewValidationCaseSkeleton";

describe("NewValidationCaseSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<NewValidationCaseSkeleton />);
    expect(container).toBeTruthy();
  });

  it("renders skeleton elements", () => {
    const { getAllByTestId } = render(<NewValidationCaseSkeleton />);
    const skeletons = getAllByTestId(/skeleton/);
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
