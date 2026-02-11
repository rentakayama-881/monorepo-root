import {
  formatCurrency,
  parseCurrencyInput,
  formatCurrencyInput,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDeadline,
  truncateText,
  formatUsername,
  getInitials,
} from '../format';

describe('format.js', () => {
  describe('formatCurrency', () => {
    it('should format number as IDR with symbol', () => {
      const result = formatCurrency(100000);
      expect(result).toMatch(/Rp\s*100/);
    });

    it('should format without symbol when showSymbol=false', () => {
      const result = formatCurrency(100000, false);
      expect(result).not.toContain('Rp');
    });

    it('should return "-" for null', () => {
      expect(formatCurrency(null)).toBe('-');
    });

    it('should return "-" for undefined', () => {
      expect(formatCurrency(undefined)).toBe('-');
    });

    it('should handle zero', () => {
      const result = formatCurrency(0);
      expect(result).toMatch(/Rp\s*0/);
    });

    it('should handle large numbers', () => {
      const result = formatCurrency(1000000000);
      expect(result).toContain('Rp');
    });
  });

  describe('parseCurrencyInput', () => {
    it('should parse clean number string', () => {
      expect(parseCurrencyInput('100000')).toBe(100000);
    });

    it('should remove non-digit characters', () => {
      expect(parseCurrencyInput('Rp 100.000')).toBe(100000);
    });

    it('should return 0 for empty string', () => {
      expect(parseCurrencyInput('')).toBe(0);
    });

    it('should return 0 for non-numeric string', () => {
      expect(parseCurrencyInput('abc')).toBe(0);
    });
  });

  describe('formatCurrencyInput', () => {
    it('should format number with separators', () => {
      const result = formatCurrencyInput('100000');
      expect(result).toBeTruthy();
    });

    it('should return empty string for zero', () => {
      expect(formatCurrencyInput('0')).toBe('');
    });

    it('should return empty string for empty input', () => {
      expect(formatCurrencyInput('')).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should format a valid date string', () => {
      const result = formatDate('2025-01-15');
      expect(result).not.toBe('-');
      expect(typeof result).toBe('string');
    });

    it('should return "-" for null', () => {
      expect(formatDate(null)).toBe('-');
    });

    it('should return "-" for undefined', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('should return "-" for empty string', () => {
      expect(formatDate('')).toBe('-');
    });

    it('should handle Date objects', () => {
      const result = formatDate(new Date('2025-06-15'));
      expect(result).not.toBe('-');
    });
  });

  describe('formatDateTime', () => {
    it('should format date with time', () => {
      const result = formatDateTime('2025-01-15T14:30:00Z');
      expect(result).not.toBe('-');
    });

    it('should return "-" for null', () => {
      expect(formatDateTime(null)).toBe('-');
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "-" for null', () => {
      expect(formatRelativeTime(null)).toBe('-');
    });

    it('should return "Baru saja" for recent dates', () => {
      const now = new Date();
      const result = formatRelativeTime(now.toISOString());
      expect(result).toBe('Baru saja');
    });

    it('should return minutes ago for dates within an hour', () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const result = formatRelativeTime(tenMinAgo.toISOString());
      expect(result).toMatch(/\d+ menit yang lalu/);
    });

    it('should return hours ago for dates within a day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeHoursAgo.toISOString());
      expect(result).toMatch(/\d+ jam yang lalu/);
    });

    it('should return days ago for dates within a week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoDaysAgo.toISOString());
      expect(result).toMatch(/\d+ hari yang lalu/);
    });

    it('should return formatted date for older dates', () => {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(monthAgo.toISOString());
      expect(result).not.toContain('yang lalu');
    });
  });

  describe('formatDeadline', () => {
    it('should return default for null', () => {
      const result = formatDeadline(null);
      expect(result).toEqual({ text: '-', isExpired: false, isUrgent: false });
    });

    it('should show expired for past dates', () => {
      const past = new Date(Date.now() - 60000);
      const result = formatDeadline(past.toISOString());
      expect(result.isExpired).toBe(true);
      expect(result.text).toBe('Kedaluwarsa');
    });

    it('should show urgent for dates within 24 hours', () => {
      const soon = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const result = formatDeadline(soon.toISOString());
      expect(result.isUrgent).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it('should show days for dates further out', () => {
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const result = formatDeadline(future.toISOString());
      expect(result.isExpired).toBe(false);
      expect(result.isUrgent).toBe(false);
      expect(result.text).toMatch(/\d+ hari/);
    });

    it('should show minutes for very close deadlines', () => {
      const soon = new Date(Date.now() + 30 * 60 * 1000);
      const result = formatDeadline(soon.toISOString());
      expect(result.text).toMatch(/\d+ menit/);
    });
  });

  describe('truncateText', () => {
    it('should return empty string for null', () => {
      expect(truncateText(null)).toBe('');
    });

    it('should not truncate short text', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate long text with ellipsis', () => {
      const result = truncateText('This is a very long text', 10);
      expect(result).toHaveLength(10);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should use default maxLength of 50', () => {
      const longText = 'a'.repeat(100);
      const result = truncateText(longText);
      expect(result).toHaveLength(50);
    });
  });

  describe('formatUsername', () => {
    it('should return username if present', () => {
      expect(formatUsername('john')).toBe('john');
    });

    it('should return "Anonymous" for null', () => {
      expect(formatUsername(null)).toBe('Anonymous');
    });

    it('should return custom fallback', () => {
      expect(formatUsername(null, 'Unknown')).toBe('Unknown');
    });
  });

  describe('getInitials', () => {
    it('should return first 2 characters uppercased', () => {
      expect(getInitials('john')).toBe('JO');
    });

    it('should return "?" for null', () => {
      expect(getInitials(null)).toBe('?');
    });

    it('should handle single character', () => {
      expect(getInitials('j')).toBe('J');
    });
  });
});
