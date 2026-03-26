import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "../error";

jest.mock("@/lib/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock("@/components/ui/Button", () => {
  return function MockButton({ children, onClick, href, ...props }) {
    if (href)
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    return (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    );
  };
});

describe("RootError", () => {
  const mockError = { message: "Root app error", digest: "" };
  const mockReset = jest.fn();

  it("renders error heading and action buttons", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Coba Lagi")).toBeInTheDocument();
    expect(screen.getByText("Ke Beranda")).toBeInTheDocument();
  });

  it("calls reset on retry click", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Coba Lagi"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
