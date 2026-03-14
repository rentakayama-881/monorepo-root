import { render, screen } from "@testing-library/react";
import Portal from "../Portal";

jest.mock("@/lib/useIsClient", () => ({
  __esModule: true,
  default: () => true,
}));

describe("Portal", () => {
  it("renders children into document body", () => {
    render(
      <Portal>
        <p>Portal content</p>
      </Portal>
    );
    expect(screen.getByText("Portal content")).toBeInTheDocument();
  });
});
