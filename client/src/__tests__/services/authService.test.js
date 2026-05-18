import { describe, it, expect, vi, beforeEach } from 'vitest';
import authService from '../../services/authService';
import api from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
  });

  describe('register', () => {
    it('should call api.post with correct data', async () => {
      const userData = { username: 'testuser', email: 'test@test.com', password: 'password123' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: { id: 1, username: 'testuser', email: 'test@test.com' },
            token: 'jwt-token-123'
          }
        }
      };

      api.post.mockResolvedValueOnce(mockResponse);

      const result = await authService.register(userData);

      expect(api.post).toHaveBeenCalledWith('/auth/register', userData);
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'jwt-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.data.data.user));
      expect(result).toEqual(mockResponse.data);
    });

    it('should not store token if not in response', async () => {
      const userData = { username: 'testuser', email: 'test@test.com', password: 'password123' };
      const mockResponse = {
        data: {
          success: false,
          message: 'Error'
        }
      };

      api.post.mockResolvedValueOnce(mockResponse);

      await authService.register(userData);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should call api.post and store token on success', async () => {
      const credentials = { username: 'testuser', password: 'password123' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: { id: 1, username: 'testuser', role: 'Operator' },
            token: 'jwt-token-456'
          }
        }
      };

      api.post.mockResolvedValueOnce(mockResponse);

      const result = await authService.login(credentials);

      expect(api.post).toHaveBeenCalledWith('/auth/login', credentials);
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'jwt-token-456');
      expect(result).toEqual(mockResponse.data);
    });

    it('should not store token on failed login', async () => {
      const credentials = { username: 'testuser', password: 'wrong' };
      const mockResponse = {
        data: {
          success: false,
          message: 'Invalid credentials'
        }
      };

      api.post.mockResolvedValueOnce(mockResponse);

      await authService.login(credentials);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should call api.post and clear localStorage', async () => {
      api.post.mockResolvedValueOnce({ data: { success: true } });

      await authService.logout();

      expect(api.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should clear localStorage even if api call fails', async () => {
      api.post.mockRejectedValueOnce(new Error('Network error'));

      // Even if API fails, localStorage should be cleared (via finally block)
      try {
        await authService.logout();
      } catch (e) {
        // Error may be thrown, but localStorage should still be cleared
      }

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('getProfile', () => {
    it('should call api.get and return profile data', async () => {
      const mockProfile = {
        data: {
          success: true,
          data: { id: 1, username: 'testuser', email: 'test@test.com' }
        }
      };

      api.get.mockResolvedValueOnce(mockProfile);

      const result = await authService.getProfile();

      expect(api.get).toHaveBeenCalledWith('/auth/profile');
      expect(result).toEqual(mockProfile.data);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if token exists', () => {
      localStorage.getItem.mockReturnValueOnce('some-token');

      const result = authService.isAuthenticated();

      expect(localStorage.getItem).toHaveBeenCalledWith('token');
      expect(result).toBe(true);
    });

    it('should return false if token does not exist', () => {
      localStorage.getItem.mockReturnValueOnce(null);

      const result = authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return parsed user from localStorage', () => {
      const user = { id: 1, username: 'testuser' };
      localStorage.getItem.mockReturnValueOnce(JSON.stringify(user));

      const result = authService.getCurrentUser();

      expect(localStorage.getItem).toHaveBeenCalledWith('user');
      expect(result).toEqual(user);
    });

    it('should return null if no user in localStorage', () => {
      localStorage.getItem.mockReturnValueOnce(null);

      const result = authService.getCurrentUser();

      expect(result).toBeNull();
    });
  });
});
