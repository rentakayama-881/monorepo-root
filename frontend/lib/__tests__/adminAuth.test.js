import { setAdminSession, getAdminToken, getAdminInfo, clearAdminSession } from '../adminAuth';

// Mock the auth module
jest.mock('../auth', () => ({
  getToken: jest.fn(),
}));

const { getToken } = require('../auth');

describe('adminAuth.js', () => {
  let mockSessionStorage;

  beforeEach(() => {
    mockSessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
    getToken.mockReset();
  });

  describe('setAdminSession', () => {
    it('should save token to sessionStorage', () => {
      setAdminSession('admin-token-123', { id: 1, name: 'Admin' });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('admin_token', 'admin-token-123');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'admin_info',
        JSON.stringify({ id: 1, name: 'Admin' })
      );
    });

    it('should not save empty token', () => {
      setAdminSession('', null);

      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should trim token', () => {
      setAdminSession('  token-with-spaces  ', null);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('admin_token', 'token-with-spaces');
    });

    it('should remove admin_info when adminInfo is null', () => {
      setAdminSession('valid-token', null);

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('admin_info');
    });
  });

  describe('getAdminToken', () => {
    it('should return main token if user has admin role', () => {
      // JWT with admin role: header.payload.signature
      // Payload: { "role": "admin", "exp": 9999999999 }
      const payload = btoa(JSON.stringify({ role: 'admin', exp: 9999999999 }));
      const mockJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
      getToken.mockReturnValue(mockJwt);

      const result = getAdminToken();

      expect(result).toBe(mockJwt);
    });

    it('should return main token if user has is_admin claim', () => {
      const payload = btoa(JSON.stringify({ is_admin: true, exp: 9999999999 }));
      const mockJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
      getToken.mockReturnValue(mockJwt);

      const result = getAdminToken();

      expect(result).toBe(mockJwt);
    });

    it('should fallback to session token if main token is not admin', () => {
      const payload = btoa(JSON.stringify({ role: 'user', exp: 9999999999 }));
      const mockJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
      getToken.mockReturnValue(mockJwt);

      // Legacy admin token in session storage
      const adminPayload = btoa(JSON.stringify({ exp: 9999999999 }));
      const adminJwt = `eyJhbGciOiJIUzI1NiJ9.${adminPayload}.sig`;
      mockSessionStorage.getItem.mockReturnValue(adminJwt);

      const result = getAdminToken();

      expect(result).toBe(adminJwt);
    });

    it('should return null if no admin token exists', () => {
      getToken.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = getAdminToken();

      expect(result).toBeNull();
    });
  });

  describe('getAdminInfo', () => {
    it('should return parsed admin info from sessionStorage', () => {
      const info = { id: 1, name: 'Admin User' };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(info));

      const result = getAdminInfo();

      expect(result).toEqual(info);
    });

    it('should return null if no admin info', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = getAdminInfo();

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-json');

      const result = getAdminInfo();

      expect(result).toBeNull();
    });
  });

  describe('clearAdminSession', () => {
    it('should remove admin token and info from sessionStorage', () => {
      clearAdminSession();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('admin_token');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('admin_info');
    });
  });
});
