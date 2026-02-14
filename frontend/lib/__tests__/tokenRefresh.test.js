import { refreshAccessToken, getValidToken, fetchWithAuth } from '../tokenRefresh';

jest.mock('../api', () => ({
  getApiBase: jest.fn(() => 'https://api.test.com'),
}));

jest.mock('../auth', () => ({
  getToken: jest.fn(),
  getRefreshToken: jest.fn(),
  isTokenExpired: jest.fn(),
  setTokens: jest.fn(),
  clearToken: jest.fn(),
}));

const { getToken, getRefreshToken, isTokenExpired, setTokens, clearToken } = require('../auth');

describe('tokenRefresh.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('refreshAccessToken', () => {
    it('should still attempt refresh using cookie when no refresh token in storage', async () => {
      getRefreshToken.mockReturnValue(null);
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Missing refresh token' }),
      });

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should call refresh endpoint and return new token', async () => {
      getRefreshToken.mockReturnValue('refresh-token-123');
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 900,
        }),
      });

      const result = await refreshAccessToken();

      expect(result).toBe('new-access-token');
      expect(setTokens).toHaveBeenCalledWith('new-access-token', 'new-refresh-token', 900);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ refresh_token: 'refresh-token-123' }),
        })
      );
    });

    it('should return null on refresh failure', async () => {
      getRefreshToken.mockReturnValue('refresh-token');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid refresh token' }),
      });

      const result = await refreshAccessToken();

      expect(result).toBeNull();
    });

    it('should handle account locked (AUTH009)', async () => {
      getRefreshToken.mockReturnValue('refresh-token');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ code: 'AUTH009', message: 'Akun terkunci' }),
      });

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(clearToken).toHaveBeenCalled();
    });

    it('should return null on network error', async () => {
      getRefreshToken.mockReturnValue('refresh-token');
      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await refreshAccessToken();

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should deduplicate concurrent refresh calls', async () => {
      getRefreshToken.mockReturnValue('refresh-token');
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'deduped-token',
          refresh_token: 'new-refresh',
          expires_in: 900,
        }),
      });

      // Call twice simultaneously
      const [result1, result2] = await Promise.all([
        refreshAccessToken(),
        refreshAccessToken(),
      ]);

      expect(result1).toBe('deduped-token');
      expect(result2).toBe('deduped-token');
      // Only one fetch call should be made
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getValidToken', () => {
    it('should return null if no token', async () => {
      getToken.mockReturnValue(null);

      const result = await getValidToken();

      expect(result).toBeNull();
    });

    it('should return current token if not expired', async () => {
      getToken.mockReturnValue('valid-token');
      isTokenExpired.mockReturnValue(false);

      const result = await getValidToken();

      expect(result).toBe('valid-token');
    });

    it('should refresh token if expired', async () => {
      getToken.mockReturnValue('expired-token');
      isTokenExpired.mockReturnValue(true);
      getRefreshToken.mockReturnValue('refresh-token');
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh',
          expires_in: 900,
        }),
      });

      const result = await getValidToken();

      expect(result).toBe('refreshed-token');
    });

    it('should fallback to current token if refresh fails', async () => {
      getToken.mockReturnValue('maybe-valid-token');
      isTokenExpired.mockReturnValue(true);
      getRefreshToken.mockReturnValue(null);
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await getValidToken();

      expect(result).toBe('maybe-valid-token');
    });
  });

  describe('fetchWithAuth', () => {
    it('should add Authorization header', async () => {
      getToken.mockReturnValue('auth-token');
      isTokenExpired.mockReturnValue(false);
      global.fetch.mockResolvedValue({ status: 200, ok: true });

      await fetchWithAuth('https://api.test.com/api/me');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/me',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token',
          }),
        })
      );
    });

    it('should throw if not authenticated', async () => {
      getToken.mockReturnValue(null);

      await expect(fetchWithAuth('https://api.test.com/api/me'))
        .rejects.toThrow('Not authenticated');
    });

    it('should retry with refreshed token on 401', async () => {
      getToken.mockReturnValue('old-token');
      isTokenExpired.mockReturnValue(false);
      getRefreshToken.mockReturnValue('refresh-token');

      // First call returns 401
      global.fetch
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            expires_in: 900,
          }),
        })
        // Retry with new token
        .mockResolvedValueOnce({ status: 200, ok: true });

      const result = await fetchWithAuth('https://api.test.com/api/me');

      expect(result.status).toBe(200);
      // fetch called: 1st attempt, refresh endpoint, retry
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
