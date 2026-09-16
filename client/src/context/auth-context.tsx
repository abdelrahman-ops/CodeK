import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, LoginResponse, RegisterStudentInput, RegisterResponse } from '../types/api.js';
import { api } from '../lib/api/client.js';
import { isDev, saveTokens, clearAuthStorage } from '../lib/auth-storage.js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (data: RegisterStudentInput) => Promise<RegisterResponse>;
  login: (loginId: string, password: string) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, otpCode: string) => Promise<{ mustChangePassword: boolean; role: string }>;
  resend2FA: (tempToken: string) => Promise<{ tempToken: string; emailMasked: string }>;
  verifyEmail: (userId: string, otpCode: string) => Promise<{ user: User; mustChangePassword: boolean; learningModeSelected: boolean }>;
  resendVerification: (userId: string) => Promise<{ success: boolean; resendCooldownSeconds: number; emailMasked: string; devOtp?: string }>;
  selectLearningMode: (mode: 'ONLINE' | 'HYBRID') => Promise<{ success: boolean; mode: string; learningModeSelected: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('academy_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('academy_access_token');

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

      // Always attempt silent refresh via HttpOnly cookie (or local fallback in dev)
      try {
        const refreshRes = await api.auth.refresh();
        const { user: userData, accessToken: newAccess, refreshToken: newRefresh } = refreshRes.data.data;
        saveTokens(newAccess, newRefresh);
        if (userData) {
          setUser(userData);
          localStorage.setItem('academy_user', JSON.stringify(userData));
        }
      } catch {
        clearAuthStorage();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
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

    // If Email verification is required, return verification payload without setting authenticated session
    if (data.requiresVerification) {
      return data;
    }

    // Student / Parent direct authenticated session
    if (data.accessToken && data.user) {
      saveTokens(data.accessToken, data.refreshToken);
      localStorage.setItem('academy_user', JSON.stringify(data.user));
      setUser(data.user);
    }

    return data;
  };

  const register = async (inputData: RegisterStudentInput): Promise<RegisterResponse> => {
    const res = await api.auth.register(inputData);
    const result = res.data.data;

    if (result.accessToken && result.user) {
      saveTokens(result.accessToken, result.refreshToken);
      localStorage.setItem('academy_user', JSON.stringify(result.user));
      setUser(result.user);
    }

    return result;
  };

  const verify2FA = async (tempToken: string, otpCode: string) => {
    const res = await api.auth.verify2FA({ tempToken, otpCode });
    const { user: userData, accessToken, refreshToken, mustChangePassword } = res.data.data;

    saveTokens(accessToken, refreshToken);
    localStorage.setItem('academy_user', JSON.stringify(userData));
    setUser(userData);

    return { mustChangePassword, role: userData.role };
  };

  const resend2FA = async (tempToken: string) => {
    const res = await api.auth.resend2FA({ tempToken });
    return res.data.data;
  };

  const verifyEmail = async (userId: string, otpCode: string) => {
    const res = await api.auth.verifyEmail({ userId, otpCode });
    const { user: userData, accessToken, refreshToken, mustChangePassword, learningModeSelected } = res.data.data;

    saveTokens(accessToken, refreshToken);
    localStorage.setItem('academy_user', JSON.stringify(userData));
    setUser(userData);

    return { user: userData, mustChangePassword, learningModeSelected };
  };

  const resendVerification = async (userId: string) => {
    const res = await api.auth.resendVerification({ userId });
    return res.data.data;
  };

  const selectLearningMode = async (mode: 'ONLINE' | 'HYBRID') => {
    const res = await api.auth.selectLearningMode({ mode });
    const data = res.data.data;

    if (user && user.student) {
      const updatedUser: User = {
        ...user,
        student: {
          ...user.student,
          attendanceRequired: mode === 'HYBRID',
          learningModeSelected: true
        }
      };
      setUser(updatedUser);
      localStorage.setItem('academy_user', JSON.stringify(updatedUser));
    } else {
      await refreshUser();
    }

    return data;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout request error
    } finally {
      clearAuthStorage();
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
        register,
        login,
        verify2FA,
        resend2FA,
        verifyEmail,
        resendVerification,
        selectLearningMode,
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
