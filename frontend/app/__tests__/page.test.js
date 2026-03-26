import { render, screen } from "@testing-library/react";
import Home, { metadata } from "../page";

jest.mock("@/components/home/Hero", () => {
  return function MockHero() {
    return <div data-testid="hero">Hero</div>;
  };
});
jest.mock("@/components/home/HowItWorks", () => {
  return function MockHowItWorks() {
    return <div data-testid="how-it-works">HowItWorks</div>;
  };
});
jest.mock("@/components/home/FocusAreas", () => {
  return function MockFocusAreas() {
    return <div data-testid="focus-areas">FocusAreas</div>;
  };
});
jest.mock("@/components/home/LatestValidationCases", () => {
  return function MockLatestValidationCases() {
    return <div data-testid="latest">LatestValidationCases</div>;
  };
});
jest.mock("@/components/ui/Skeleton", () => {
  return function MockSkeleton({ className }) {
    return <div data-testid="skeleton" className={className} />;
  };
});

describe("Home page", () => {
  it("renders Hero and HowItWorks sections", () => {
    render(<Home />);
    expect(screen.getByTestId("hero")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works")).toBeInTheDocument();
    expect(screen.getByTestId("focus-areas")).toBeInTheDocument();
  });

  it("exports SEO metadata", () => {
    expect(metadata.title).toContain("Validasi");
    expect(metadata.alternates.canonical).toBe("https://aivalid.id");
  });
});
