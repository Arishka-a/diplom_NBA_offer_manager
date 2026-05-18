import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';

// Mock authService
vi.mock('../../services/authService', () => ({
  default: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn()
  }
}));

// Test component to consume AuthContext
const TestConsumer = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
      <span data-testid="username">{user?.username || 'none'}</span>
    </div>
  );
};

// Component that triggers login
const LoginComponent = ({ credentials }) => {
  const { login, user, isAuthenticated } = useAuth();

  return (
    <div>
      <button onClick={() => login(credentials)}>Login</button>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
      <span data-testid="username">{user?.username || 'none'}</span>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthProvider', () => {
    it('should provide loading state initially', async () => {
      authService.getCurrentUser.mockReturnValue(null);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should load user from authService on mount', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'Operator' };
      authService.getCurrentUser.mockReturnValue(mockUser);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });
    });

    it('should set isAuthenticated to false when no user', async () => {
      authService.getCurrentUser.mockReturnValue(null);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('username')).toHaveTextContent('none');
      });
    });
  });

  describe('login', () => {
    it('should update user state after successful login', async () => {
      authService.getCurrentUser.mockReturnValue(null);

      const mockUser = { id: 1, username: 'newuser', role: 'Admin' };
      authService.login.mockResolvedValue({
        success: true,
        data: { user: mockUser, token: 'token-123' }
      });

      render(
        <AuthProvider>
          <LoginComponent credentials={{ username: 'newuser', password: 'pass' }} />
        </AuthProvider>
      );

      // Initially not authenticated
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      // Click login button
      await act(async () => {
        screen.getByText('Login').click();
      });

      // Should be authenticated after login
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('username')).toHaveTextContent('newuser');
      });
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ComponentOutsideProvider = () => {
        useAuth();
        return null;
      };

      expect(() => render(<ComponentOutsideProvider />)).toThrow(
        'useAuth must be used within AuthProvider'
      );

      consoleSpy.mockRestore();
    });
  });
});
