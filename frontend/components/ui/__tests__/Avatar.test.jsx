import { render } from "@testing-library/react";
import Avatar from "../Avatar";
import { AvatarGroup } from "../Avatar";

jest.mock("@/lib/avatar", () => ({
  resolveAvatarSrc: () => null,
  getInitials: (name) => (name ? name[0] : "?"),
  getAvatarColor: () => "bg-gray-200",
}));

describe("Avatar", () => {
  it("renders without crashing", () => {
    const { container } = render(<Avatar />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with name", () => {
    const { container } = render(<Avatar name="John" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("accepts className prop", () => {
    const { container } = render(<Avatar className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});

describe("AvatarGroup", () => {
  it("renders without crashing", () => {
    const avatars = [{ name: "Alice" }, { name: "Bob" }];
    const { container } = render(<AvatarGroup avatars={avatars} />);
    expect(container.firstChild).toBeTruthy();
  });
});
