// src/hooks/useCurrentUser.js  (NEW FILE)
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';



export const userQueryKeys = {
  all: ['user'],
  current: () => ['user', 'current'],
};

const STALE_TIME = 30 * 60 * 1000;      // 30 min — user profile barely changes
const GC_TIME = 24 * 60 * 60 * 1000;    // 24 h — survives logout/login

export const useCurrentUser = () =>
  useQuery({
    queryKey: userQueryKeys.current(),
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      const response = await api.get('/auth/user');
      return (
        response?.data?.data?.user ||
        response?.data?.user ||
        response?.data?.data ||
        null
      );
    },
    enabled: typeof window !== 'undefined'
      ? Boolean(localStorage.getItem('auth_token'))
      : false,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });