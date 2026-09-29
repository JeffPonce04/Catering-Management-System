import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: TWENTY_FOUR_HOURS,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      placeholderData: (prev) => prev,
    },
    mutations: { retry: 0 },
  },
});

// ⭐ Only persist dashboard-related queries to keep localStorage small
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'catering-dashboard-cache',   // ← same key your Dashboard.jsx checks!
  throttleTime: 1000,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: TWENTY_FOUR_HOURS,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' &&
      (query.queryKey[0] === 'dashboard' ||
        query.queryKey[0] === 'user' ||
        query.queryKey[0] === 'notifications'),
  },
});