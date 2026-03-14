import { render } from "@testing-library/react";
import { Logo } from "../Logo";

jest.mock("next/image", () => {
  return function MockImage({ src, alt, ...props }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock("@/lib/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

describe("Logo", () => {
  it("renders without crashing", () => {
    const { container } = render(<Logo />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders icon variant", () => {
    const { container } = render(<Logo variant="icon" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("accepts className prop", () => {
    const { container } = render(<Logo className="custom" />);
    expect(container.firstChild).toBeTruthy();
  });
});
