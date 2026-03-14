import { render } from "@testing-library/react";
import Skeleton, {
  SkeletonText,
  SkeletonCircle,
  SkeletonCard,
  SkeletonListItem,
  SkeletonPage,
} from "../Skeleton";

describe("Skeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("accepts className prop", () => {
    const { container } = render(<Skeleton className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});

describe("SkeletonText", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonText />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("SkeletonCircle", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonCircle />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("SkeletonCard", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("SkeletonListItem", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonListItem />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("SkeletonPage", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
