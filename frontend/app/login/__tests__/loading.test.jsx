import { render } from "@testing-library/react";
import LoginLoading from "../loading";

jest.mock(
  "@/components/auth/AuthPageLoading",
  () =>
    function MockAuthLoading() {
      return <div data-testid="auth-loading" />;
    }
);

describe("LoginLoading", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<LoginLoading />);
    expect(getByTestId("auth-loading")).toBeInTheDocument();
  });
});
