import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole } from '../types/creators.ts';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async (activeToken?: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/auth/me', {
        headers,
        credentials: 'include', // Send HttpOnly session cookie
      });

      if (!res.ok) {
        throw new Error('Session inactive or expired');
      }

      const json = await res.json();
      if (json.success && json.data?.user) {
        setUser(json.data.user);
      } else {
        throw new Error('Invalid user data');
      }
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Purge any legacy token from localStorage to eliminate XSS surface
    try {
      localStorage.removeItem('libertadgo_auth_token');
    } catch {
      // ignore
    }

    // Verify session using HttpOnly cookie or volatile memory token
    fetchCurrentUser(token);
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Receive and store HttpOnly cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Credenciales inválidas' };
      }

      const receivedToken = data.data.token;
      const receivedUser = data.data.user;

      // Keep token in volatile React memory only for Bearer authorization header backwards compatibility
      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error de conexión con el servidor',
      };
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      }).catch(() => {});
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser(token);
  };

  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean(user && user.role === 'ADMIN');

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
