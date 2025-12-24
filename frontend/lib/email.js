/**
 * Masks an email address for privacy
 * @param {string} email - The email address to mask
 * @returns {string} - The masked email address
 * 
 * Examples:
 * - john@example.com -> john***@example.com
 * - a@test.com -> a***@test.com
 * - johndoe@example.com -> john***@example.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const atIndex = email.indexOf('@');
  if (atIndex === -1) {
    return email; // Invalid email, return as is
  }

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  // If local part is 3 chars or less, show only first char
  if (localPart.length <= 3) {
    return localPart.charAt(0) + '***' + domain;
  }

  // Otherwise show first 4 chars
  return localPart.substring(0, 4) + '***' + domain;
}
