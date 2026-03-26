import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
}));

jest.mock("@/lib/api", () => ({
  fetchJson: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/components/ui/Button", () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button data-testid="button">{children}</button>,
}));

jest.mock("@/components/ui/Input", () => ({
  __esModule: true,
  default: (props) => <input data-testid="input" />,
}));

import VerifyEmailClient from "../VerifyEmailClient";

describe("VerifyEmailClient", () => {
  it("renders without crashing", () => {
    const { container } = render(<VerifyEmailClient />);
    expect(container).toBeTruthy();
  });
});
