// src/contexts/AppDataContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import {
  employeeAPI,
  departmentAPI,
  positionAPI,
  salaryGradeAPI,
} from '../services/api';

const AppDataContext = createContext(null);

export const useAppData = () => useContext(AppDataContext);

// ⭐ Shared query keys — other hooks can reuse these to dedupe requests
export const appDataKeys = {
  employees:    ['app-data', 'employees'],
  departments:  ['app-data', 'departments'],
  positions:    ['app-data', 'positions'],
  salaryGrades: ['app-data', 'salary-grades'],
  stats:        ['app-data', 'stats'],
};

const STALE_TIME = 30 * 60 * 1000;      // 30 min
const GC_TIME    = 24 * 60 * 60 * 1000; // 24 h — survives logout/login

export const AppDataProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // ⭐ Lazy gate — nothing fetches until a consumer calls ensureLoaded().
  //    The dashboard never calls it, so it pays ZERO cost.
  const [shouldLoad, setShouldLoad] = useState(false);

  const ensureLoaded = useCallback(() => {
    setShouldLoad(true);
  }, []);

  // Reset the gate when the user logs out — next login must re-trigger
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setShouldLoad(false);
    }
  }, [authLoading, isAuthenticated]);

  const enabled = shouldLoad && !authLoading && isAuthenticated;

  // ── Shared query options ──────────────────────────────────────────
  const sharedOptions = {
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };

  // ── Queries (all gated) ───────────────────────────────────────────
  const employeesQuery = useQuery({
    queryKey: appDataKeys.employees,
    queryFn: async () => {
      const res = await employeeAPI.getAll({ per_page: 1000 });
      return res?.data?.data ?? res?.data ?? [];
    },
    ...sharedOptions,
  });

  const departmentsQuery = useQuery({
    queryKey: appDataKeys.departments,
    queryFn: async () => {
      const res = await departmentAPI.getAll({ all: true });
      return res?.data?.data ?? res?.data ?? [];
    },
    ...sharedOptions,
  });

  const positionsQuery = useQuery({
    queryKey: appDataKeys.positions,
    queryFn: async () => {
      const res = await positionAPI.getAll({ all: true });
      return res?.data?.data ?? res?.data ?? [];
    },
    ...sharedOptions,
  });

  const salaryGradesQuery = useQuery({
    queryKey: appDataKeys.salaryGrades,
    queryFn: async () => {
      const res = await salaryGradeAPI.getAll({ all: true });
      return res?.data?.data ?? res?.data ?? [];
    },
    ...sharedOptions,
  });

  const statsQuery = useQuery({
    queryKey: appDataKeys.stats,
    queryFn: async () => {
      const res = await employeeAPI.getStats();
      return res?.data?.data ?? res?.data ?? {};
    },
    ...sharedOptions,
  });

  const loading =
    shouldLoad &&
    (employeesQuery.isLoading ||
      departmentsQuery.isLoading ||
      positionsQuery.isLoading ||
      salaryGradesQuery.isLoading ||
      statsQuery.isLoading);

  const value = useMemo(
    () => ({
      // ── Data (empty until loaded — same shape as before) ────────
      employees:    employeesQuery.data    ?? [],
      departments:  departmentsQuery.data  ?? [],
      positions:    positionsQuery.data    ?? [],
      salaryGrades: salaryGradesQuery.data ?? [],
      stats:        statsQuery.data        ?? {},

      // ── Status ──────────────────────────────────────────────────
      loading,
      isLoaded: shouldLoad && !loading,

      // ⭐ New: pages that need this data call ensureLoaded() on mount
      ensureLoaded,

      // Backwards-compat alias for any old code calling `reload`
      reload: ensureLoaded,

      // Force-refresh the cached data
      refresh: async () => {
        setShouldLoad(true);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: appDataKeys.employees }),
          queryClient.invalidateQueries({ queryKey: appDataKeys.departments }),
          queryClient.invalidateQueries({ queryKey: appDataKeys.positions }),
          queryClient.invalidateQueries({ queryKey: appDataKeys.salaryGrades }),
          queryClient.invalidateQueries({ queryKey: appDataKeys.stats }),
        ]);
      },
    }),
    [
      employeesQuery.data,
      departmentsQuery.data,
      positionsQuery.data,
      salaryGradesQuery.data,
      statsQuery.data,
      loading,
      shouldLoad,
      ensureLoaded,
      queryClient,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};