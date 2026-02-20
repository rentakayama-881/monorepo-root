export function getPasswordStrength(password = "") {
  if (!password) return 0;

  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;
  if (/\d/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;

  return Math.min(strength, 3);
}

export function getPasswordStrengthLabel(strength) {
  if (strength <= 1) return "Weak password";
  if (strength === 2) return "Moderate password";
  return "Strong password";
}

export function getPasswordStrengthTone(strength) {
  if (strength <= 1) return "weak";
  if (strength === 2) return "medium";
  return "strong";
}
