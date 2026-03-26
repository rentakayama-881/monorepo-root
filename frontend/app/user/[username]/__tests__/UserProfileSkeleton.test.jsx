import { render } from "@testing-library/react";

jest.mock("@/components/ui/Skeleton", () => {
  const Skeleton = (props) => <div data-testid="skeleton" />;
  Skeleton.displayName = "Skeleton";
  const SkeletonCircle = (props) => <div data-testid="skeleton-circle" />;
  const SkeletonText = (props) => <div data-testid="skeleton-text" />;
  Skeleton.SkeletonCircle = SkeletonCircle;
  Skeleton.SkeletonText = SkeletonText;
  return {
    __esModule: true,
    default: Skeleton,
    SkeletonCircle,
    SkeletonText,
  };
});

import UserProfileSkeleton from "../UserProfileSkeleton";

describe("UserProfileSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<UserProfileSkeleton />);
    expect(container).toBeTruthy();
  });

  it("renders skeleton elements", () => {
    const { getAllByTestId } = render(<UserProfileSkeleton />);
    const skeletons = getAllByTestId(/skeleton/);
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
