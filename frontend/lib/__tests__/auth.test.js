/**
 * Unit tests for lib/auth.js
 * Tests token management functions
 */

import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  setTokens,
  clearToken,
  isTokenExpired,
  setTokenExpiry,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRES_KEY,
} from '../auth';

describe('auth.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
  });

  describe('getToken', () => {
    it('should return token from localStorage', () => {
      localStorage.getItem.mockReturnValue('test-token');

      const token = getToken();

      expect(localStorage.getItem).toHaveBeenCalledWith(TOKEN_KEY);
      expect(token).toBe('test-token');
    });

    it('should return null if no token exists', () => {
      localStorage.getItem.mockReturnValue(null);

      const token = getToken();

      expect(token).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return refresh token from localStorage', () => {
      localStorage.getItem.mockReturnValue('test-refresh-token');

      const token = getRefreshToken();

      expect(localStorage.getItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
      expect(token).toBe('test-refresh-token');
    });
  });

  describe('setToken', () => {
    it('should save token to localStorage', () => {
      setToken('new-token');

      expect(localStorage.setItem).toHaveBeenCalledWith(TOKEN_KEY, 'new-token');
    });
  });

  describe('setRefreshToken', () => {
    it('should save refresh token to localStorage', () => {
      setRefreshToken('new-refresh-token');

      expect(localStorage.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'new-refresh-token');
    });
  });

  describe('setTokens', () => {
    it('should save both tokens and expiry', () => {
      setTokens('access', 'refresh', 900);

      expect(localStorage.setItem).toHaveBeenCalledWith(TOKEN_KEY, 'access');
      expect(localStorage.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'refresh');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        TOKEN_EXPIRES_KEY,
        expect.any(String)
      );
    });
  });

  describe('clearToken', () => {
    it('should remove all tokens from localStorage', () => {
      clearToken();

      expect(localStorage.removeItem).toHaveBeenCalledWith(TOKEN_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(TOKEN_EXPIRES_KEY);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true if no expiry exists', () => {
      localStorage.getItem.mockReturnValue(null);

      const expired = isTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return true if token is expired', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      localStorage.getItem.mockReturnValue(pastDate);

      const expired = isTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return false if token is not expired', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      localStorage.getItem.mockReturnValue(futureDate);

      const expired = isTokenExpired();

      expect(expired).toBe(false);
    });

    it('should return true within 30 second buffer', () => {
      // Token expires in 20 seconds (within 30 second buffer)
      const nearFutureDate = new Date(Date.now() + 20000).toISOString();
      localStorage.getItem.mockReturnValue(nearFutureDate);

      const expired = isTokenExpired();

      expect(expired).toBe(true);
    });
  });
});
