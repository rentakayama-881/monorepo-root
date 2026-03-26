import { render } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
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
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/tokenRefresh", () => ({
  getValidToken: jest.fn(() => Promise.resolve("mock-token")),
}));

jest.mock("@/lib/errorMessage", () => ({
  getErrorMessage: jest.fn((e) => e?.message || "Error"),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("lucide-react", () => ({
  ChevronLeft: (props) => <span data-testid="chevron-left" />,
  Lock: (props) => <span data-testid="lock-icon" />,
  AlertTriangle: (props) => <span data-testid="alert-triangle" />,
  ShieldCheck: (props) => <span data-testid="shield-check" />,
}));

import SetPinContent from "../SetPinContent";

describe("SetPinContent", () => {
  it("renders without crashing", () => {
    const { container } = render(<SetPinContent />);
    expect(container).toBeTruthy();
  });
});
