import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { authAPI, clearAuth, handleApiError } from '../services/api';

const AuthContext = createContext(null);

const getStoredToken = () => (
  localStorage.getItem('auth_token') ||
  localStorage.getItem('authToken') ||
  localStorage.getItem('token')
);

const getStoredUser = () => {
  const storedUser = localStorage.getItem('user') || localStorage.getItem('userData');

  if (!storedUser) return null;

  try {
    const parsed = JSON.parse(storedUser);
    return normalizeUserPayload(parsed);
  } catch (error) {
    console.error('Unable to read the stored user:', error);
    clearAuth();
    return null;
  }
};

export const normalizeUserPayload = (payload) => {
  if (!payload) return null;

  // Backend responses in this project may return either:
  // { user: {...} }, { data: { user: {...} } }, {...actualUser}
  const candidate =
    payload?.data?.user ||
    payload?.user ||
    payload?.employee ||
    payload?.admin ||
    payload;

  if (!candidate || typeof candidate !== 'object') return null;

  return candidate;
};

const extractLoginData = (response) => {
  const payload = response?.data?.data || response?.data || {};
  const user = normalizeUserPayload(payload);

  return {
    token: payload?.token || payload?.access_token || payload?.auth_token,
    user,
    requires_otp: Boolean(payload?.requires_otp),
    message: response?.data?.message || payload?.message,
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      const token = getStoredToken();
      const storedUser = getStoredUser();

      if (!token || !storedUser) {
        clearAuth();
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      // Use cached user immediately so protected pages do not go blank while /auth/user validates.
      if (!cancelled) {
        setUser(storedUser);
        setIsAuthenticated(true);
      }

      try {
        const response = await authAPI.getUser();
        const freshUser = normalizeUserPayload(response?.data?.data || response?.data);

        if (!freshUser) {
          throw new Error('The backend /auth/user response did not include a valid user object.');
        }

        localStorage.setItem('user', JSON.stringify(freshUser));

        if (!cancelled) {
          setUser(freshUser);
          setIsAuthenticated(true);
        }
      } catch (error) {
        if (error?.response?.status === 401) {
          clearAuth();
          if (!cancelled) {
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          // Keep the cached session on temporary network/API failures.
          console.warn('Auth validation failed, using cached login state:', error?.message || error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials) => {
    const userId = credentials?.userId?.trim?.() || credentials?.username?.trim?.() || credentials?.email?.trim?.() || '';
    const password = credentials?.password || '';

    if (!userId || !password) {
      throw new Error('User ID and password are required.');
    }

    setLoading(true);

    try {
      const response = await authAPI.login({
        userId,
        password,
        role: credentials?.role,
        otp_code: credentials?.otp_code,
        require_otp: credentials?.require_otp,
        remember_me: credentials?.remember_me ?? credentials?.rememberMe ?? false,
      });

      const loginData = extractLoginData(response);

      if (loginData.requires_otp) {
        setLoading(false);
        return loginData;
      }

      if (!loginData.token || !loginData.user) {
        throw new Error('The backend login response is missing the authentication token or user data.');
      }

      localStorage.setItem('auth_token', loginData.token);
      localStorage.setItem('user', JSON.stringify(loginData.user));
      setUser(loginData.user);
      setIsAuthenticated(true);
      message.success('Login successful.');

      return loginData;
    } catch (error) {
      clearAuth();
      setUser(null);
      setIsAuthenticated(false);
      message.error(handleApiError(error, 'Login failed. Please check your credentials.'));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const token = getStoredToken();

    try {
      if (token) await authAPI.logout();
    } catch (error) {
      console.warn('Logout API request failed:', error?.response?.data || error?.message);
    } finally {
      clearAuth();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    loading,
    login,
    logout,
  }), [user, isAuthenticated, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
