import { render, screen } from "@testing-library/react";

jest.mock("@/lib/api", () => ({
  getApiBase: jest.fn(() => "http://localhost:3000"),
}));

jest.mock("@/components/ui/LoadingState", () => ({
  SectionLoadingBlock: () => <div data-testid="loading-block" />,
}));

jest.mock("@/lib/format", () => ({
  formatDate: jest.fn((d) => d || ""),
}));

// Mock React.use() for async params
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    use: jest.fn((promise) => {
      if (promise && typeof promise.then === "function") {
        return { id: "test-badge-id" };
      }
      return promise;
    }),
  };
});

import BadgeDetailClient from "../BadgeDetailClient";

describe("BadgeDetailClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            platform: "GitHub",
            description: "Test badge",
            createdAt: "2024-01-01",
          }),
      })
    );
  });

  it("renders without crashing", () => {
    const params = Promise.resolve({ id: "test-badge-id" });
    const { container } = render(<BadgeDetailClient params={params} />);
    expect(container).toBeTruthy();
  });

  it("shows loading state initially", () => {
    const params = Promise.resolve({ id: "test-badge-id" });
    render(<BadgeDetailClient params={params} />);
    expect(screen.getByTestId("loading-block")).toBeInTheDocument();
  });
});
