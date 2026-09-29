// src/hooks/useDashboardQueries.js
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ADMIN_ROLES,
  INVENTORY_MANAGER_ROLES,
  hasAllowedRole,
  getUserRoles,
} from '../utils/roleRoutes';

// ⭐ FIX #2 — shorter staleTime so changing the period/anchor triggers an
// immediate background refetch instead of serving 30-minute-old data.
const DASHBOARD_STALE_TIME = 60 * 1000;        // ⭐ 1 min — refetch quickly after period change
const DASHBOARD_GC_TIME = 24 * 60 * 60 * 1000; // 24 h

const unwrap = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback;

export const EMPTY_DASHBOARD_DATA = {
  stats: {},
  charts: {},
  cards: {},
  range: null,
  period: 'monthly',
  inventoryReport: {},
  inventoryDashboard: {},
  financialReport: {},
  financial: {},
  events: {},
  payroll: {},
  reports: {},
  warning: '',
};

const settleDashboardRequests = async (period, anchor, access) => {
  const params = { period, anchor };

  const requestMap = {
    stats: api.get('/dashboard/stats', { params }),
    charts: api.get('/dashboard/charts', { params }),
  };

  if (access.canViewAllReports) {
    requestMap.inventoryReport = api.get('/reports/inventory', { params });
    requestMap.inventoryDashboard = api.get('/inventory/dashboard-stats');
    requestMap.financial = api.get('/reports/financial', {
      params: { year: new Date().getFullYear() },
    });
    requestMap.events = api.get('/reports/events', { params });
  } else if (access.canViewInventory) {
    requestMap.inventoryReport = api.get('/reports/inventory', { params });
    requestMap.inventoryDashboard = api.get('/inventory/dashboard-stats');
  }

  const entries = Object.entries(requestMap);
  const results = await Promise.allSettled(entries.map(([, request]) => request));
  const settled = {};
  let failedCount = 0;

  results.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') {
      settled[key] = unwrap(result.value, {});
    } else {
      const status = result.reason?.response?.status;
      settled[key] = {};
      if (status !== 403) failedCount += 1;
    }
  });

  if (failedCount === results.length) {
    throw new Error(
      'Unable to load dashboard records from the backend. Please check the API connection and your login session.'
    );
  }

  const statsPayload = settled.stats || {};
  const chartsPayload = settled.charts || {};
  const inventoryReport = settled.inventoryReport || {};
  const inventoryDashboard = settled.inventoryDashboard || {};
  const financial = settled.financial || {};
  const eventReport = settled.events || {};

  const flatStats = statsPayload.stats || statsPayload;
  const cards = statsPayload.cards || {};

  return {
    period: statsPayload.period || period,
    range: statsPayload.range || null,
    stats: flatStats,
    cards,
    charts: chartsPayload,
    inventoryReport,
    inventoryDashboard,
    financialReport: financial,
    financial,
    events: {
      ...eventReport,
      trends: eventReport.trends || chartsPayload.booking_trends || [],
      total_bookings: eventReport.total_bookings || flatStats.total_bookings || 0,
      completed_events: eventReport.completed_events || flatStats.completed_events || 0,
      upcoming_events_data: statsPayload.upcoming_event_rows || [],
    },
    payroll: {
      active_staff: flatStats.active_staff || 0,
      summary: eventReport?.payroll || [],
    },
    reports: { financial, events: eventReport, inventory: inventoryReport },
    warning: failedCount > 0
      ? 'Some permitted dashboard sections could not be loaded, but available database records are shown.'
      : '',
  };
};

export const useDashboardData = (period = 'monthly', anchor = null) => {
  const { user } = useAuth();
  const roles = getUserRoles(user);
  const userId = user?.id ?? 'anon';
  const access = {
    canViewAllReports: hasAllowedRole(user, ADMIN_ROLES),
    canViewInventory: hasAllowedRole(user, INVENTORY_MANAGER_ROLES),
  };

  const hasToken = typeof window !== 'undefined'
    ? Boolean(localStorage.getItem('auth_token'))
    : false;

  return useQuery({
    queryKey: ['dashboard', 'database', userId, period, anchor, roles],
    queryFn: () => settleDashboardRequests(period, anchor, access),
    enabled: hasToken || Boolean(user),
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,

    // ⭐ AUTO-UPDATE
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,

    placeholderData: (previousData) => previousData,
  });
};

export const prefetchDashboard = async (queryClient, user, period = 'monthly', anchor = null) => {
  if (!user) return;
  const roles = getUserRoles(user);
  const userId = user?.id ?? 'anon';
  const access = {
    canViewAllReports: hasAllowedRole(user, ADMIN_ROLES),
    canViewInventory: hasAllowedRole(user, INVENTORY_MANAGER_ROLES),
  };

  await queryClient.prefetchQuery({
    queryKey: ['dashboard', 'database', userId, period, anchor, roles],
    queryFn: () => settleDashboardRequests(period, anchor, access),
    staleTime: DASHBOARD_STALE_TIME,
  });
};

export const useDashboardStats = (period = 'monthly', anchor = null) => {
  const { user } = useAuth();
  const roles = getUserRoles(user);
  const userId = user?.id ?? 'anon';
  const access = {
    canViewAllReports: hasAllowedRole(user, ADMIN_ROLES),
    canViewInventory: hasAllowedRole(user, INVENTORY_MANAGER_ROLES),
  };

  const hasToken = typeof window !== 'undefined'
    ? Boolean(localStorage.getItem('auth_token'))
    : false;

  return useQuery({
    queryKey: ['dashboard', 'database', userId, period, anchor, roles],
    queryFn: () => settleDashboardRequests(period, anchor, access),
    enabled: hasToken || Boolean(user),
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
};

export const useDashboardDetail = (card, period = 'monthly', anchor = null) => {
  return useQuery({
    queryKey: ['dashboard', 'detail', card, period, anchor],
    queryFn: async () => {
      const res = await api.get(`/dashboard/detail/${card}`, { params: { period, anchor } });
      return res?.data?.data || {};
    },
    enabled: Boolean(card),
    staleTime: 60 * 1000,
  });
};