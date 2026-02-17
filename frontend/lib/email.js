// "john@example.com" -> "john***@example.com", "a@test.com" -> "a***@test.com"
export function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  if (localPart.length <= 3) {
    return localPart.charAt(0) + '***' + domain;
  }
  return localPart.substring(0, 4) + '***' + domain;
}
