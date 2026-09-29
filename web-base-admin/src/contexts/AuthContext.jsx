import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authAPI, clearAuth, handleApiError } from '../services/api';
import { useCurrentUser, userQueryKeys } from '../hooks/useCurrentUser';
import api from '../services/api';
import { ADMIN_ROLES, SETTINGS_ADMIN_ROLES, hasAllowedRole } from '../utils/roleRoutes';
const AuthContext = createContext(null);

// Shared business-settings cache key. Any page that needs company name,
// address, phone, or logo reads from this slot instead of firing its own
// /settings/business request. Populated once for admins only.
export const businessSettingsQueryKey = ['settings', 'business'];

export const DEFAULT_BUSINESS_SETTINGS = {
  company_name: "Dear Bab's Fastfood and Catering Services",
  company_address: 'Zone 3 Amoros, El Salvador City',
  company_phone: '09708986628',
  company_email: "dearbab's@gmail.com",
  logo_url: null,
};

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

  const queryClient = useQueryClient();

  // ⭐ React Query owns the /auth/user call now. Navigation, Header, Profile,
  //    and AuthContext all read from the same cache → ONE network request.
  const {
    data: freshUser,
    isLoading: userLoading,
    isError: userError,
    error: userErr,
  } = useCurrentUser();

  // ── Business settings — shared across all pages ──
  // Fetched ONCE for admins. Non-admins get the hardcoded fallback, and
  // the network call never fires (the backend 403s them at role.access).
  // Settings endpoints are gated by the backend's `role.access` middleware,
  // which uses a stricter list than the general admin roles. Match it here
  // so the frontend never fires a request that's guaranteed to 403.
  // Uses the (now broadened) SETTINGS_ADMIN_ROLES constant, which includes
  // operational admins. If you reverted roleRoutes.js to super-admin-only,
  // this automatically narrows back too — no change needed here.
  const isSettingsAdmin = hasAllowedRole(freshUser || user, SETTINGS_ADMIN_ROLES);

  const businessSettingsQuery = useQuery({
    queryKey: businessSettingsQueryKey,
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res?.data?.data || res?.data || {};
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
     enabled: Boolean(freshUser) && hasAllowedRole(freshUser || user, ADMIN_ROLES),
    retry: 0,
  });

  const businessSettings = useMemo(() => {
    const resolved = businessSettingsQuery.data || {};
    return {
      ...DEFAULT_BUSINESS_SETTINGS,
      ...(resolved.business || resolved.company || resolved.general || resolved),
    };
  }, [businessSettingsQuery.data]);

  // ── Bootstrap: hydrate from localStorage, then let React Query validate ──
  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (!token || !storedUser) {
      clearAuth();
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    // Instant UI — no blank screen while /auth/user is in-flight
    setUser(storedUser);
    setIsAuthenticated(true);
    setLoading(false);
  }, []);

  // ── Sync React Query result into local state ──
  useEffect(() => {
    if (freshUser) {
      localStorage.setItem('user', JSON.stringify(freshUser));
      setUser(freshUser);
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // Only react to errors AFTER React Query has settled
    if (!userLoading && userError) {
      if (userErr?.response?.status === 401) {
        clearAuth();
        queryClient.removeQueries({ queryKey: userQueryKeys.all });
        setUser(null);
        setIsAuthenticated(false);
      } else {
        // Network failure — keep cached session
        console.warn(
          'Auth validation failed, using cached login state:',
          userErr?.message || userErr
        );
      }
      setLoading(false);
    }
  }, [freshUser, userLoading, userError, userErr, queryClient]);

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

      // ⭐ Seed React Query cache so useCurrentUser returns instantly
      //    (no duplicate /auth/user call right after login).
      queryClient.setQueryData(userQueryKeys.current(), loginData.user);

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
      // Drop user-scoped caches only — do NOT queryClient.clear()
      queryClient.removeQueries({ queryKey: userQueryKeys.all });
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
    businessSettings,
    isAdmin: hasAllowedRole(freshUser || user, ADMIN_ROLES),
    isSettingsAdmin,
    refreshBusinessSettings: businessSettingsQuery.refetch,
  }), [user, isAuthenticated, loading, businessSettings, isSettingsAdmin, freshUser, businessSettingsQuery.refetch]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};