import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, LoginResponse } from '../types/api.js';
import { api } from '../lib/api/client.js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (loginId: string, password: string) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, otpCode: string) => Promise<{ mustChangePassword: boolean; role: string }>;
  resend2FA: (tempToken: string) => Promise<{ tempToken: string; emailMasked: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('academy_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('academy_access_token');
      const refreshToken = localStorage.getItem('academy_refresh_token');

      if (accessToken) {
        try {
          const res = await api.auth.getMe();
          setUser(res.data.data);
          localStorage.setItem('academy_user', JSON.stringify(res.data.data));
          setIsLoading(false);
          return;
        } catch {
          // Token expired or invalid, fall through to refresh attempt
        }
      }

      // If we have a refresh token (or potentially an HttpOnly cookie session), try silent refresh
      if (refreshToken || document.cookie.includes('refreshToken')) {
        try {
          const refreshRes = await api.auth.refresh();
          const { user: userData, accessToken: newAccess, refreshToken: newRefresh } = refreshRes.data.data;
          if (newAccess) localStorage.setItem('academy_access_token', newAccess);
          if (newRefresh) localStorage.setItem('academy_refresh_token', newRefresh);
          if (userData) {
            setUser(userData);
            localStorage.setItem('academy_user', JSON.stringify(userData));
          }
        } catch {
          localStorage.removeItem('academy_access_token');
          localStorage.removeItem('academy_refresh_token');
          localStorage.removeItem('academy_user');
          setUser(null);
        }
      } else {
        localStorage.removeItem('academy_access_token');
        localStorage.removeItem('academy_refresh_token');
        localStorage.removeItem('academy_user');
        setUser(null);
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (loginId: string, password: string): Promise<LoginResponse> => {
    const res = await api.auth.login({ loginId, password });
    const data = res.data.data;

    // If Admin 2FA is required, return 2FA payload to component without setting authenticated session
    if (data.requires2FA) {
      return data;
    }

    // Student / Parent direct authenticated session
    if (data.accessToken && data.user) {
      localStorage.setItem('academy_access_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('academy_refresh_token', data.refreshToken);
      }
      localStorage.setItem('academy_user', JSON.stringify(data.user));
      setUser(data.user);
    }

    return data;
  };

  const verify2FA = async (tempToken: string, otpCode: string) => {
    const res = await api.auth.verify2FA({ tempToken, otpCode });
    const { user: userData, accessToken, refreshToken, mustChangePassword } = res.data.data;

    localStorage.setItem('academy_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('academy_refresh_token', refreshToken);
    }
    localStorage.setItem('academy_user', JSON.stringify(userData));
    setUser(userData);

    return { mustChangePassword, role: userData.role };
  };

  const resend2FA = async (tempToken: string) => {
    const res = await api.auth.resend2FA({ tempToken });
    return res.data.data;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout request error
    } finally {
      localStorage.removeItem('academy_access_token');
      localStorage.removeItem('academy_refresh_token');
      localStorage.removeItem('academy_user');
      setUser(null);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.auth.getMe();
      setUser(res.data.data);
      localStorage.setItem('academy_user', JSON.stringify(res.data.data));
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('academy_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        verify2FA,
        resend2FA,
        logout,
        refreshUser,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
