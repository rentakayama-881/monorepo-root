import {
  getPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthTone,
} from "../passwordStrength";

describe("passwordStrength", () => {
  it("returns 0 for empty password", () => {
    expect(getPasswordStrength("")).toBe(0);
  });

  it("returns weak strength for basic password", () => {
    expect(getPasswordStrength("password")).toBe(1);
    expect(getPasswordStrengthLabel(1)).toBe("Weak password");
    expect(getPasswordStrengthTone(1)).toBe("weak");
  });

  it("returns moderate strength for mixed password", () => {
    expect(getPasswordStrength("password123")).toBe(2);
    expect(getPasswordStrengthLabel(2)).toBe("Moderate password");
    expect(getPasswordStrengthTone(2)).toBe("medium");
  });

  it("caps strong strength at 3", () => {
    expect(getPasswordStrength("StrongPassword123!")).toBe(3);
    expect(getPasswordStrengthLabel(3)).toBe("Strong password");
    expect(getPasswordStrengthTone(3)).toBe("strong");
  });
});
