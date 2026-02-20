import { fireEvent, render, screen } from "@testing-library/react";
import LoginTotpForm from "../LoginTotpForm";

function renderForm(overrides = {}) {
  const props = {
    useBackupCode: false,
    totpCode: "",
    loading: false,
    error: null,
    onSubmit: jest.fn((event) => event.preventDefault()),
    onBackToLogin: jest.fn(),
    onToggleCodeType: jest.fn(),
    onTotpCodeChange: jest.fn(),
    ...overrides,
  };

  render(<LoginTotpForm {...props} />);
  return props;
}

describe("LoginTotpForm", () => {
  it("sanitizes non-digit input when using authenticator code", () => {
    const props = renderForm();

    fireEvent.change(screen.getByLabelText("6-Digit Code"), {
      target: { value: "12ab34" },
    });

    expect(props.onTotpCodeChange).toHaveBeenCalledWith("1234");
  });

  it("passes raw input in backup code mode", () => {
    const props = renderForm({ useBackupCode: true });

    fireEvent.change(screen.getByLabelText("Backup Code"), {
      target: { value: "ABCD-1234" },
    });

    expect(props.onTotpCodeChange).toHaveBeenCalledWith("ABCD-1234");
  });

  it("disables verify action when code length is incomplete", () => {
    renderForm({ totpCode: "123" });

    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });
});
