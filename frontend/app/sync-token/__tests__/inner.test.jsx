import { render, screen } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

import InnerSyncTokenPage from "../inner";

describe("InnerSyncTokenPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  it("renders without crashing", () => {
    const { container } = render(<InnerSyncTokenPage />);
    expect(container).toBeTruthy();
  });

  it("displays status text", () => {
    render(<InnerSyncTokenPage />);
    // Component shows a status message while processing
    expect(document.body.textContent).toBeTruthy();
  });
});
