import { getApiBase, fetchJson, fetchJsonAuth } from '../api';

// Mock dependencies
jest.mock('../tokenRefresh', () => ({
  getValidToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

jest.mock('../auth', () => ({
  clearToken: jest.fn(),
}));

const { getValidToken, refreshAccessToken } = require('../tokenRefresh');
const { clearToken } = require('../auth');

describe('api.js', () => {
  describe('getApiBase', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      delete process.env.NEXT_PUBLIC_BACKEND_API_URL;
      delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return NEXT_PUBLIC_API_BASE_URL when set', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
      expect(getApiBase()).toBe('https://api.example.com');
    });

    it('should fallback to NEXT_PUBLIC_BACKEND_URL', () => {
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend.example.com';
      expect(getApiBase()).toBe('https://backend.example.com');
    });

    it('should strip trailing slashes', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com/';
      expect(getApiBase()).toBe('https://api.example.com');
    });

    it('should default to localhost:8080 when no env set', () => {
      // jsdom window.location.hostname is "localhost" by default
      expect(getApiBase()).toBe('http://localhost:8080');
    });
  });

  describe('fetchJson', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test.com';
    });

    it('should call fetch with correct URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        clone: () => ({
          json: () => Promise.resolve({ data: 'test' }),
        }),
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await fetchJson('/api/health');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should throw error for non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        clone: () => ({
          json: () => Promise.resolve({ message: 'Invalid input' }),
        }),
      });

      await expect(fetchJson('/api/test')).rejects.toThrow('Invalid input');
    });

    it('should include status code in error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        clone: () => ({
          json: () => Promise.resolve({ error: 'Not found' }),
        }),
      });

      try {
        await fetchJson('/api/test');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });

    it('should handle network errors', async () => {
      const typeError = new TypeError('Failed to fetch');
      global.fetch.mockRejectedValue(typeError);

      await expect(fetchJson('/api/test')).rejects.toThrow('Unable to connect to server');
    });

    it('should pass through additional options', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        clone: () => ({
          json: () => Promise.resolve({}),
        }),
        json: () => Promise.resolve({}),
      });

      await fetchJson('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'value' }),
        })
      );
    });
  });

  describe('fetchJsonAuth', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test.com';
      getValidToken.mockReset();
      refreshAccessToken.mockReset();
      clearToken.mockReset();
    });

    it('should include Authorization header', async () => {
      getValidToken.mockResolvedValue('valid-token');
      global.fetch.mockResolvedValue({
        ok: true,
        clone: () => ({
          json: () => Promise.resolve({ data: 'authenticated' }),
        }),
        json: () => Promise.resolve({ data: 'authenticated' }),
      });

      await fetchJsonAuth('/api/me');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
    });

    it('should throw session expired error when no token', async () => {
      getValidToken.mockResolvedValue(null);

      try {
        await fetchJsonAuth('/api/me');
        fail('Should have thrown');
      } catch (err) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('session_expired');
      }
    });

    it('should clear token on 401 response', async () => {
      getValidToken.mockResolvedValue('expired-token');
      refreshAccessToken.mockResolvedValue(null);
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        clone: () => ({
          json: () => Promise.resolve({ message: 'Unauthorized' }),
        }),
      });

      try {
        await fetchJsonAuth('/api/me');
      } catch (err) {
        expect(clearToken).toHaveBeenCalled();
        expect(err.status).toBe(401);
      }
    });

    it('should retry once after refresh when first request returns 401', async () => {
      getValidToken.mockResolvedValue('old-token');
      refreshAccessToken.mockResolvedValue('new-token');
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          clone: () => ({
            json: () => Promise.resolve({ message: 'Unauthorized' }),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          clone: () => ({
            json: () => Promise.resolve({ data: 'ok-after-refresh' }),
          }),
          json: () => Promise.resolve({ data: 'ok-after-refresh' }),
        });

      const result = await fetchJsonAuth('/api/me');

      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token');
      expect(clearToken).not.toHaveBeenCalled();
      expect(result).toEqual({ data: 'ok-after-refresh' });
    });

    it('should not clear token on 401 when clearSessionOn401=false', async () => {
      getValidToken.mockResolvedValue('some-token');
      refreshAccessToken.mockResolvedValue(null);
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        clone: () => ({
          json: () => Promise.resolve({ message: 'Unauthorized' }),
        }),
      });

      try {
        await fetchJsonAuth('/api/me', { clearSessionOn401: false });
      } catch (err) {
        expect(clearToken).not.toHaveBeenCalled();
      }
    });

    it('should handle 403 account locked errors', async () => {
      getValidToken.mockResolvedValue('valid-token');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        clone: () => ({
          json: () => Promise.resolve({
            code: 'AUTH009',
            message: 'Akun terkunci',
          }),
        }),
      });

      try {
        await fetchJsonAuth('/api/me');
      } catch (err) {
        expect(err.status).toBe(403);
        expect(err.code).toBe('AUTH009');
      }
    });

    it('should handle 403 permission denied', async () => {
      getValidToken.mockResolvedValue('valid-token');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        clone: () => ({
          json: () => Promise.resolve({
            message: 'Forbidden',
          }),
        }),
      });

      try {
        await fetchJsonAuth('/api/admin');
      } catch (err) {
        expect(err.status).toBe(403);
        expect(err.code).toBe('forbidden');
      }
    });
  });
});
