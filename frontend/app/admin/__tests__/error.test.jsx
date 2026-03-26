import { render, screen, fireEvent } from "@testing-library/react";
import AdminError from "../error";

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

describe("AdminError", () => {
  const mockError = new Error("Admin failure");
  const mockReset = jest.fn();

  it("renders admin error heading and buttons", () => {
    render(<AdminError error={mockError} reset={mockReset} />);
    expect(screen.getByText("Error di Admin Panel")).toBeInTheDocument();
    expect(screen.getByText("Coba Lagi")).toBeInTheDocument();
    expect(screen.getByText("Login Ulang")).toBeInTheDocument();
  });

  it("calls reset when Coba Lagi is clicked", () => {
    render(<AdminError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Coba Lagi"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
