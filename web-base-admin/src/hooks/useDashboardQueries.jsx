import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ADMIN_ROLES,
  INVENTORY_MANAGER_ROLES,
  hasAllowedRole,
  getUserRoles,
} from '../utils/roleRoutes';

const unwrap = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback;

export const EMPTY_DASHBOARD_DATA = {
  stats: {},
  charts: {},
  inventoryReport: {},
  inventoryDashboard: {},
  financialReport: {},
  financial: {},
  events: {},
  payroll: {},
  reports: {},
  warning: '',
};

const settleDashboardRequests = async (period, access) => {
  const requestMap = {
    stats: api.get('/dashboard/stats'),
    charts: api.get('/dashboard/charts', { params: { period } }),
  };

  if (access.canViewAllReports) {
    requestMap.inventoryReport = api.get('/reports/inventory');
    requestMap.inventoryDashboard = api.get('/inventory/dashboard-stats');
    requestMap.financial = api.get('/reports/financial');
    requestMap.events = api.get('/reports/events', {
      params: {
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
      },
    });
  } else if (access.canViewInventory) {
    requestMap.inventoryReport = api.get('/reports/inventory');
    requestMap.inventoryDashboard = api.get('/inventory/dashboard-stats');
  }

  const entries = Object.entries(requestMap);
  const results = await Promise.allSettled(entries.map(([, request]) => request));
  const settled = {};
  let failedCount = 0;

  results.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') settled[key] = unwrap(result.value, {});
    else {
      settled[key] = {};
      failedCount += 1;
    }
  });

  if (failedCount === results.length) {
    throw new Error('Unable to load dashboard records from the backend. Please check the API connection and your login session.');
  }

  const stats = settled.stats || {};
  const charts = settled.charts || {};
  const inventoryReport = settled.inventoryReport || {};
  const inventoryDashboard = settled.inventoryDashboard || {};
  const financial = settled.financial || {};
  const eventReport = settled.events || {};

  return {
    stats,
    charts,
    inventoryReport,
    inventoryDashboard,
    financialReport: financial,
    financial,
    events: {
      ...eventReport,
      trends: eventReport.trends || charts.booking_trends || [],
      total_bookings: eventReport.total_bookings || stats.total_bookings || 0,
      completed_events: eventReport.completed_events || stats.completed_events || 0,
      upcoming_events_data: stats.upcoming_event_rows || [],
    },
    payroll: { active_staff: stats.active_staff || 0 },
    reports: { financial, events: eventReport, inventory: inventoryReport },
    warning: failedCount > 0
      ? 'Some permitted dashboard sections could not be loaded, but available database records are shown.'
      : '',
  };
};

export const useDashboardData = (period = 'week') => {
  const { user } = useAuth();
  const roles = getUserRoles(user);
  const access = {
    canViewAllReports: hasAllowedRole(user, ADMIN_ROLES),
    canViewInventory: hasAllowedRole(user, INVENTORY_MANAGER_ROLES),
  };

  return useQuery({
    queryKey: ['dashboard', 'database', period, roles],
    queryFn: () => settleDashboardRequests(period, access),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });
};

// Backward-compatible hook name used by older components.
export const useDashboardStats = () => {
  const { user } = useAuth();
  const roles = getUserRoles(user);

  return useQuery({
    queryKey: ['dashboard', 'stats', roles],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats');
      return unwrap(response, {});
    },
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
};
