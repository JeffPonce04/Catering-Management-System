import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

const unwrap = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback;

export const EMPTY_REPORTS_DATA = {
  sales: {},
  inventory: {},
  payroll: {},
  events: {},
  customers: {},
  financial: {},
  additional: {},
  dashboardCharts: {},
  inventoryDashboard: {},
  warning: '',
};

const normalizeReportsData = (entries, settled) => {
  const nextReports = { ...EMPTY_REPORTS_DATA };

  settled.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') {
      nextReports[key] = unwrap(result.value, {});
    }
  });

  const failed = settled.filter((result) => result.status === 'rejected');

  if (failed.length === settled.length) {
    throw new Error('Unable to load reports from the backend. Please check the API connection and your login session.');
  }

  nextReports.warning = failed.length > 0
    ? 'Some report sections could not be loaded, but available database records are shown.'
    : '';

  return nextReports;
};

export const useReportsData = (params = {}, options = {}) => useQuery({
  queryKey: ['reports', 'database', params, { salesOnly: Boolean(options.salesOnly) }],
  queryFn: async () => {
    const entries = options.salesOnly
      ? [['sales', api.get('/reports/sales', { params })]]
      : [
          ['sales', api.get('/reports/sales', { params })],
          ['inventory', api.get('/reports/inventory')],
          ['payroll', api.get('/reports/payroll', { params })],
          ['events', api.get('/reports/events', { params })],
          ['customers', api.get('/reports/customers')],
          ['financial', api.get('/reports/financial', { params: { year: params.year } })],
          ['additional', api.get('/reports/additional', { params })],
          ['dashboardCharts', api.get('/dashboard/charts', { params: { period: 'year' } })],
          ['inventoryDashboard', api.get('/inventory/dashboard-stats')],
        ];

    const settled = await Promise.allSettled(entries.map(([, request]) => request));
    return normalizeReportsData(entries, settled);
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  placeholderData: (previousData) => previousData,
});

export const useSalesReport = (params = {}) => useQuery({
  queryKey: ['reports', 'sales', params],
  queryFn: async () => unwrap(await api.get('/reports/sales', { params }), {}),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  placeholderData: (previousData) => previousData,
});

export const useInventoryReport = () => useQuery({
  queryKey: ['reports', 'inventory'],
  queryFn: async () => unwrap(await api.get('/reports/inventory'), {}),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  placeholderData: (previousData) => previousData,
});

export const usePayrollReport = (params = {}) => useQuery({
  queryKey: ['reports', 'payroll', params],
  queryFn: async () => unwrap(await api.get('/reports/payroll', { params }), {}),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  placeholderData: (previousData) => previousData,
});

export const useBookingReport = (params = {}) => useQuery({
  queryKey: ['reports', 'events', params],
  queryFn: async () => unwrap(await api.get('/reports/events', { params }), {}),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  placeholderData: (previousData) => previousData,
});

export const useFinancialReport = (params = {}) => useQuery({
  queryKey: ['reports', 'financial', params],
  queryFn: async () => unwrap(await api.get('/reports/financial', { params }), {}),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  placeholderData: (previousData) => previousData,
});
