import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoles } from '../utils/roleRoutes';

const unwrap = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback;

const settleRequests = async (requestMap) => {
  const entries = Object.entries(requestMap);
  const results = await Promise.allSettled(entries.map(([, request]) => request));
  const data = {};
  const failed = [];

  results.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') {
      data[key] = unwrap(result.value, {});
    } else {
      data[key] = {};
      failed.push(key);
    }
  });

  if (failed.length === entries.length) {
    throw new Error('Unable to load dashboard records from the backend. Please check the API connection and your login session.');
  }

  return {
    ...data,
    warning: failed.length > 0
      ? 'Some permitted dashboard sections could not be loaded, but available database records are shown.'
      : '',
  };
};

const getRoleRequests = (role) => {
  if (role === 'inventory') {
    return {
      inventory: api.get('/inventory/dashboard-stats'),
      movements: api.get('/inventory/movements', { params: { per_page: 8 } }),
      purchaseRequests: api.get('/inventory/purchase-requests', { params: { per_page: 8 } }),
      reservations: api.get('/equipment/reservations', { params: { per_page: 8 } }),
      waste: api.get('/inventory/waste', { params: { per_page: 8 } }),
    };
  }

  if (role === 'staff') {
    return {
      employees: api.get('/employees/stats'),
      attendanceSummary: api.get('/attendance/summary'),
      attendanceStatistics: api.get('/attendance/statistics'),
      attendanceToday: api.get('/attendance/today', { params: { per_page: 8 } }),
      scheduleStats: api.get('/schedules/stats'),
      leaveRequests: api.get('/employee-requests', { params: { status: 'pending', per_page: 8 } }),
      payrollStats: api.get('/payroll/stats'),
    };
  }

  return {
    bookingStats: api.get('/bookings-statistics'),
    bookings: api.get('/bookings', { params: { per_page: 8, page: 1 } }),
    quotations: api.get('/quotations', { params: { status_in: 'pending,sent,draft', per_page: 8 } }),
    payments: api.get('/payments', { params: { per_page: 8 } }),
    invoices: api.get('/invoices', { params: { per_page: 8 } }),
    customers: api.get('/customers/stats'),
  };
};

export const useRoleDashboardData = (role) => {
  const { user } = useAuth();
  const roles = getUserRoles(user);

  return useQuery({
    queryKey: ['dashboard', 'role-focused', role, roles],
    queryFn: () => settleRequests(getRoleRequests(role)),
    enabled: Boolean(user && role),
    staleTime: 3 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });
};
