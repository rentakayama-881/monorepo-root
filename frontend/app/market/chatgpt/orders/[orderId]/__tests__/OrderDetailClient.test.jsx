import { render } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("@/components/ui/LoadingState", () => ({
  SectionLoadingBlock: () => <div data-testid="loading-block" />,
}));

jest.mock("../useOrderDetail", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    order: null,
    loading: true,
    error: null,
    refresh: jest.fn(),
    refreshing: false,
  })),
}));

jest.mock("../components/OrderStatus", () => ({
  __esModule: true,
  default: () => <div data-testid="order-status" />,
}));

jest.mock("../components/OrderCredentials", () => ({
  __esModule: true,
  default: () => <div data-testid="order-credentials" />,
}));

jest.mock("../components/OrderTimeline", () => ({
  __esModule: true,
  default: () => <div data-testid="order-timeline" />,
}));

import OrderDetailClient from "../OrderDetailClient";

describe("OrderDetailClient", () => {
  it("renders without crashing", () => {
    const { container } = render(<OrderDetailClient />);
    expect(container).toBeTruthy();
  });

  it("shows loading state when loading", () => {
    const { getByTestId } = render(<OrderDetailClient />);
    expect(getByTestId("loading-block")).toBeInTheDocument();
  });
});
