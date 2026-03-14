import { render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

describe("ToastProvider", () => {
  it("renders children without crashing", () => {
    render(
      <ToastProvider>
        <p>App content</p>
      </ToastProvider>
    );
    expect(screen.getByText("App content")).toBeInTheDocument();
  });
});

describe("useToast", () => {
  it("returns context object inside provider", () => {
    function Consumer() {
      const ctx = useToast();
      // Verify the context is available and has expected shape
      expect(ctx).toBeTruthy();
      expect(typeof ctx).toBe("object");
      return <p>consumer</p>;
    }
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );
    expect(screen.getByText("consumer")).toBeInTheDocument();
  });
});
