import { render, screen } from "@testing-library/react";

jest.mock("@/components/ui/Portal", () => {
  return function MockPortal({ children }) {
    return <div data-testid="portal">{children}</div>;
  };
});

jest.mock("@/lib/utils", () => ({
  cn: (...args) => args.filter(Boolean).join(" "),
}));

import {
  CheckoutConfirmModal,
  CheckoutBlockingModal,
  CheckoutFeedbackModal,
} from "../MarketModals";

describe("CheckoutConfirmModal", () => {
  const defaultProps = {
    item: { email: "test@example.com", price: 100000 },
    countdown: 30,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    disabled: false,
  };

  it("renders without crashing", () => {
    const { container } = render(<CheckoutConfirmModal {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("displays item content", () => {
    const { container } = render(<CheckoutConfirmModal {...defaultProps} />);
    expect(container.textContent).toContain("Konfirmasi");
  });
});

describe("CheckoutBlockingModal", () => {
  it("renders without crashing", () => {
    const { container } = render(<CheckoutBlockingModal message="Processing..." />);
    expect(container).toBeTruthy();
  });

  it("displays message", () => {
    render(<CheckoutBlockingModal message="Processing..." />);
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });
});

describe("CheckoutFeedbackModal", () => {
  it("renders without crashing with success feedback", () => {
    const { container } = render(
      <CheckoutFeedbackModal
        feedback={{ ok: true, message: "Success!" }}
        onClose={jest.fn()}
        onRefresh={jest.fn()}
        refreshing={false}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders without crashing with error feedback", () => {
    const { container } = render(
      <CheckoutFeedbackModal
        feedback={{ ok: false, message: "Error occurred" }}
        onClose={jest.fn()}
        onRefresh={jest.fn()}
        refreshing={false}
      />
    );
    expect(container).toBeTruthy();
  });
});
