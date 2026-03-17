import { render } from "@testing-library/react";
import { Logo } from "../Logo";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe("Logo", () => {
  it("renders without crashing", () => {
    const { container } = render(<Logo />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders text content", () => {
    const { getByText } = render(<Logo text="aivalid.id" />);
    expect(getByText("aivalid.id")).toBeTruthy();
  });

  it("accepts className prop", () => {
    const { container } = render(<Logo className="custom" />);
    expect(container.firstChild).toBeTruthy();
  });
});
