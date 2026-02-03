import { useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '../types/order';

const STORAGE_KEY = 'pf_blotter_auth';

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  error: string | null;
  isLoading: boolean;
}

// Mock user storage (in production, this would be a real backend)
const MOCK_USERS_KEY = 'pf_blotter_users';

function getMockUsers(): Record<string, { password: string; user: User }> {
  try {
    const data = localStorage.getItem(MOCK_USERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveMockUsers(users: Record<string, { password: string; user: User }>) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load persisted auth state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user) {
          setUser(parsed.user);
        }
      }
    } catch (err) {
      console.error('Failed to load auth state:', err);
    }
    setIsLoading(false);
  }, []);

  // Persist auth state changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
    }
  }, [user, isLoading]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const users = getMockUsers();
      const userData = users[email.toLowerCase()];

      if (!userData) {
        setError('No account found with this email');
        setIsLoading(false);
        return false;
      }

      if (userData.password !== password) {
        setError('Invalid password');
        setIsLoading(false);
        return false;
      }

      setUser(userData.user);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError('Login failed. Please try again.');
      setIsLoading(false);
      return false;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const users = getMockUsers();
      const emailLower = email.toLowerCase();

      if (users[emailLower]) {
        setError('An account with this email already exists');
        setIsLoading(false);
        return false;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setIsLoading(false);
        return false;
      }

      const newUser: User = {
        id: crypto.randomUUID(),
        email: emailLower,
        name,
      };

      users[emailLower] = { password, user: newUser };
      saveMockUsers(users);
      setUser(newUser);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError('Signup failed. Please try again.');
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    error,
    isLoading,
  };
}
