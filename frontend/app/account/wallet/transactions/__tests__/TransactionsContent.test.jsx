import { render } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
}));

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(() => Promise.resolve({})),
  FEATURE_ENDPOINTS: {},
  unwrapFeatureData: jest.fn((d) => d),
  extractFeatureItems: jest.fn(() => []),
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
  getUser: jest.fn(() => ({ id: 1, username: "test" })),
  isLoggedIn: jest.fn(() => true),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

import TransactionsContent from "../TransactionsContent";

describe("TransactionsContent", () => {
  it("renders without crashing", () => {
    const { container } = render(<TransactionsContent />);
    expect(container).toBeTruthy();
  });
});
