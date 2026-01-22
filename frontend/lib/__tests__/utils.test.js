/**
 * Unit tests for lib/utils.js
 * Tests utility functions
 */

import { cn, formatDate, truncate } from '../utils';

describe('utils.js', () => {
  describe('cn (className merger)', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'active', false && 'hidden');
      expect(result).toBe('base active');
    });

    it('should handle undefined values', () => {
      const result = cn('foo', undefined, 'bar');
      expect(result).toBe('foo bar');
    });

    it('should merge Tailwind classes correctly', () => {
      const result = cn('p-4', 'p-8');
      expect(result).toBe('p-8');
    });

    it('should handle arrays', () => {
      const result = cn(['foo', 'bar']);
      expect(result).toBe('foo bar');
    });
  });
});
