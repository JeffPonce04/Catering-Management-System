import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      // ⬆️ Bumped to 24h so data survives logout/login & page reloads
      gcTime: TWENTY_FOUR_HOURS,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      placeholderData: (previousData) => previousData,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── Persist only successful dashboard queries to localStorage ──
// This is what makes logout → login feel instant.
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'catering-dashboard-cache',
  throttleTime: 1000,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: TWENTY_FOUR_HOURS, // discard cache older than 24h
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      if (query.state.status !== 'success') return false;
      const root = query.queryKey[0];
          return (
        root === 'dashboard' ||
        root === 'bookings' ||
        root === 'quotations' ||
        root === 'event-types' ||
        root === 'booking-calendar-availability' ||
        root === 'orders' ||
        root === 'kitchen-orders' ||
        root === 'delivery-orders' ||
        root === 'shopping-list' ||
        root === 'events' ||
        root === 'upcoming-events' ||
        root === 'upcoming-bookings' ||
        root === 'menu-management' ||
        root === 'promotions' ||
        root === 'promotion-analytics' ||
        root === 'promotion-redemptions' ||
        // Billing & Invoicing module — every query under it is cached
        // here so F5 feels instant, exactly like Booking / Orders / Menu.
        root === 'billing'
      );
    },
  },
});

export const QueryProvider = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
    {import.meta.env.DEV && (
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom-right"
        buttonPosition="bottom-right"
      />
    )}
  </QueryClientProvider>
);
