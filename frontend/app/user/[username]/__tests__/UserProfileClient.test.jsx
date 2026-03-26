import { render } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ username: "testuser" })),
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

jest.mock("@/lib/api", () => ({
  getApiBase: jest.fn(() => "http://localhost:3000"),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("@/components/ui/Avatar", () => ({
  __esModule: true,
  default: (props) => <div data-testid="avatar" />,
}));

jest.mock("@/components/ui/Badge", () => ({
  Badge: (props) => <div data-testid="badge" />,
  BadgeChip: (props) => <span data-testid="badge-chip" />,
}));

jest.mock("@/components/ui/ValidationCaseTable", () => ({
  __esModule: true,
  default: () => <div data-testid="validation-case-table" />,
}));

jest.mock("@/components/ui/Skeleton", () => ({
  __esModule: true,
  default: (props) => <div data-testid="skeleton" />,
}));

jest.mock("../UserProfileSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="user-profile-skeleton" />,
}));

jest.mock("lucide-react", () => ({
  Link: (props) => <span data-testid="link-icon" />,
  UserRound: (props) => <span data-testid="user-icon" />,
  Building2: (props) => <span data-testid="building-icon" />,
}));

import UserProfilePage from "../UserProfileClient";

describe("UserProfileClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );
  });

  it("renders without crashing", () => {
    const { container } = render(<UserProfilePage />);
    expect(container).toBeTruthy();
  });
});
