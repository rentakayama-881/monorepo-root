import { render } from "@testing-library/react";
import RegisterLoading from "../loading";

jest.mock(
  "@/components/auth/AuthPageLoading",
  () =>
    function MockAuthLoading() {
      return <div data-testid="auth-loading" />;
    }
);

describe("RegisterLoading", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<RegisterLoading />);
    expect(getByTestId("auth-loading")).toBeInTheDocument();
  });
});
