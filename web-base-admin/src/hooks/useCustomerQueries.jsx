// src/hooks/useCustomerQueries.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../services/api';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;
const extractList = (response) => {
  const data = unwrap(response);
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
};

const normalizeReview = (review) => {
  const customer = review.booking?.service_event?.customer || review.booking?.serviceEvent?.customer || review.customer;
  const person = customer?.person;
  const customerName = review.customer_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim();
  const rating = Number(review.overall_rating || review.rating || 0);

  return {
    ...review,
    customer_id: review.customer_id || customer?.customer_id,
    customer_name: customerName || 'Customer',
    sentiment: review.sentiment || (rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral'),
  };
};

// ============================================================
// QUERY KEYS
// ============================================================

export const customerKeys = {
  all: ['customers'],
  lists: () => [...customerKeys.all, 'list'],
  list: (filters) => [...customerKeys.lists(), filters],
  details: () => [...customerKeys.all, 'detail'],
  detail: (id) => [...customerKeys.details(), id],
  bookings: (customerId) => [...customerKeys.all, 'bookings', customerId],
  payments: (customerId) => [...customerKeys.all, 'payments', customerId],
  reviews: (customerId) => [...customerKeys.all, 'reviews', customerId],
  feedback: () => [...customerKeys.all, 'feedback'],
  messages: () => [...customerKeys.all, 'messages'],
  stats: () => [...customerKeys.all, 'stats'],
  loyalty: (customerId) => [...customerKeys.all, 'loyalty', customerId],
};

// ============================================================
// CUSTOMER QUERIES
// ============================================================

/**
 * Get all customers with pagination and filters
 */
export const useCustomers = (filters = {}) => {
    return useQuery({
        queryKey: customerKeys.list(filters),
        queryFn: () => api.get('/customers', { params: filters }),
        select: (response) => {
            const data = response?.data?.data;
            const pagination = response?.data?.pagination;

            // ⭐ REQUEST 1.5 — Guarantee loyalty_points + total_bookings exist
            //    on every row so the table never renders `undefined`.
            const normalizeRow = (row) => ({
                ...row,
                loyalty_points: Number(row?.loyalty_points ?? 0),
                total_bookings: Number(row?.total_bookings ?? 0),
                total_spent: Number(row?.total_spent ?? 0),
            });

            if (data?.data && Array.isArray(data.data)) {
                return {
                    data: data.data.map(normalizeRow),
                    total: data.total || 0,
                    current_page: data.current_page || 1,
                    last_page: data.last_page || 1,
                    per_page: data.per_page || 15,
                };
            }
                   if (Array.isArray(data)) {
                return {
                    data: data.map(normalizeRow),
                    total: pagination?.total || data.length,
                    current_page: pagination?.current_page || 1,
                    last_page: pagination?.last_page || 1,
                    per_page: pagination?.per_page || data.length || 15,
                };
            }
            return { data: [], total: 0, current_page: 1, last_page: 1, per_page: 15 };
        },
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Get a single customer by ID
 */
export const useCustomer = (id) => {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => api.get(`/customers/${id}`),
    select: (response) => unwrap(response),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Get customer statistics (total, active, revenue, etc.)
 */
export const useCustomerStats = () => {
  return useQuery({
    queryKey: customerKeys.stats(),
    queryFn: () => api.get('/customers/stats'),
    select: (response) => unwrap(response) || {
      total_customers: 0,
      active_customers: 0,
      total_revenue: 0,
      avg_rating: 0,
      new_this_month: 0,
      loyal_customers: 0,
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Get all bookings for a specific customer
 */
export const useCustomerBookings = (customerId, params = {}) => {
    // ⭐ Guard: `enabled: !!customerId` is TRUE for `0`, which would fire
    //    `GET /customers/0/bookings` and return a 500. Only fire when the
    //    id is a real positive integer.
    const numericId = Number(customerId);
    const validId = Number.isFinite(numericId) && numericId > 0;

    return useQuery({
        queryKey: customerKeys.bookings(customerId),
        queryFn: () => api.get(`/customers/${customerId}/bookings`, { params }),
        select: (response) => {
            const data = response?.data?.data;
            if (Array.isArray(data)) return data;
            if (data?.bookings && Array.isArray(data.bookings)) return data.bookings;
            if (data?.data && Array.isArray(data.data)) return data.data;
            return [];
        },
        enabled: validId,
        staleTime: 3 * 60 * 1000,
    });
};

/**
 * Get all payments for a specific customer
 */
export const useCustomerPayments = (customerId, params = {}) => {
  return useQuery({
    queryKey: customerKeys.payments(customerId),
    queryFn: () => api.get(`/customers/${customerId}/payments`, { params }),
    select: (response) => extractList(response),
    enabled: !!customerId,
    staleTime: 3 * 60 * 1000,
  });
};

/**
 * Get all reviews for a specific customer
 */
export const useCustomerReviews = (params = {}, options = {}) => {
    return useQuery({
        queryKey: customerKeys.reviews(params),
        queryFn: () => api.get('/reviews', { params }),
        select: (response) => {
            const data = response?.data?.data;
            if (Array.isArray(data)) return data.map(normalizeReview);
            if (data?.data && Array.isArray(data.data)) return data.data.map(normalizeReview);
            return [];
        },
        staleTime: 3 * 60 * 1000,
        enabled: options.enabled ?? true,
    });
};
/**
 * Get all customer feedback (reviews with ratings)
 */
export const useCustomerFeedback = (params = {}, options = {}) => {
    return useQuery({
        queryKey: customerKeys.feedback(),
        queryFn: () => api.get('/customers-feedback', { params }),
        select: (response) => {
            const data = response?.data?.data;
            if (Array.isArray(data)) return data.map(normalizeReview);
            if (data?.data && Array.isArray(data.data)) return data.data.map(normalizeReview);
            return [];
        },
        staleTime: 3 * 60 * 1000,
        enabled: options.enabled ?? true,
    });
};
/**
 * Get all customer messages/chat threads
 */
export const useCustomerMessages = (params = {}) => {
    return useQuery({
        queryKey: customerKeys.messages(),
        queryFn: () => api.get('/customer-messages', { params }),

        // ⭐ REQUEST 2.1 / 2.7 — IMPORTANT: no `select` here.
        //
        // The cache MUST hold the raw paginated envelope
        //   { data: { data: [...threads], current_page, ... }, ... }
        // because useSendCustomerMessage() writes into that exact shape.
        // If `select` flattens it, every cache write is clobbered by the
        // next refetch and the freshly-sent message disappears from the
        // UI. Flattening is already done in CustomerManagement.jsx.
        //
        // staleTime 0 + refetchOnMount 'always' ensure that switching
        // customers or navigating away and back always re-pulls the
        // server truth instead of serving an old cache snapshot.
        staleTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
        refetchOnReconnect: true,

        // ⭐ REQUEST 2.2 / 2.7 — Polling is a fallback. Reverb handles
        //    the real-time path; this catches up if the socket drops.
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
    });
};

/**
 * Get loyalty points and tier for a customer
 */
export const useCustomerLoyalty = (customerId) => {
  return useQuery({
    queryKey: customerKeys.loyalty(customerId),
    queryFn: () => api.get(`/customers/${customerId}/loyalty`),
    select: (response) => unwrap(response) || { points: 0, tier: 'bronze', next_tier: 'silver', points_to_next: 500 },
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * ⭐ REQUEST #2.3 — Fetch the latest booking for a customer so the
 * Customer Directory's Rebook button can hand off with the right ID.
 */
export const useLatestCustomerBooking = (customerId) => {
  return useQuery({
    queryKey: [...customerKeys.bookings(customerId), 'latest'],
    queryFn: () => api.get(`/customers/${customerId}/bookings`),
    select: (response) => {
      const data = response?.data?.data;
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      if (rows.length === 0) return null;
      return [...rows].sort((a, b) => {
        const da = new Date(a.created_at || a.event_date || 0).getTime();
        const db = new Date(b.created_at || b.event_date || 0).getTime();
        return db - da;
      })[0];
    },
    enabled: !!customerId,
    staleTime: 60 * 1000,
  });
};

// ============================================================
// CUSTOMER MUTATIONS
// ============================================================

/**
 * Create a new customer
 */
export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/customers', data),
    onSuccess: () => {
      message.success('Customer created successfully');
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.stats() });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to create customer');
    },
  });
};

/**
 * Update an existing customer
 */
export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/customers/${id}`, data),
    onSuccess: (_, variables) => {
      message.success('Customer updated successfully');
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.stats() });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to update customer');
    },
  });
};

/**
 * Delete (soft delete) a customer
 */
export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      message.success('Customer deleted successfully');
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.stats() });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to delete customer');
    },
  });
};

/**
 * Restore a soft-deleted customer
 */
export const useRestoreCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.post(`/customers/${id}/restore`),
    onSuccess: () => {
      message.success('Customer restored successfully');
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.stats() });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to restore customer');
    },
  });
};

/**
 * Toggle customer active status
 */
export const useToggleCustomerStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.post(`/customers/${id}/toggle-status`),
    onSuccess: (_, id) => {
      message.success('Customer status updated');
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.stats() });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to update status');
    },
  });
};

// ============================================================
// FEEDBACK & REVIEW MUTATIONS
// ============================================================

/**
 * Respond to customer feedback
 */
export const useRespondToFeedback = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, response }) => api.post(`/feedbacks/${id}/respond`, { response }),
    onSuccess: () => {
      message.success('Response sent to customer');
      queryClient.invalidateQueries({ queryKey: customerKeys.feedback() });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to send response');
    },
  });
};

/**
 * Approve a customer review
 */
export const useApproveReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.post(`/reviews/${id}/approve`),
    onSuccess: () => {
      message.success('Review approved and published');
      queryClient.invalidateQueries({ queryKey: customerKeys.feedback() });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to approve review');
    },
  });
};

/**
 * Hide/delete a customer review
 */
export const useHideReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.post(`/reviews/${id}/hide`),
    onSuccess: () => {
      message.success('Review hidden');
      queryClient.invalidateQueries({ queryKey: customerKeys.feedback() });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to hide review');
    },
  });
};

/**
 * Feature/unfeature a review
 */
export const useFeatureReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, featured }) => api.post(`/reviews/${id}/feature`, { featured }),
    onSuccess: (_, variables) => {
      message.success(variables.featured ? 'Added to featured' : 'Removed from featured');
      queryClient.invalidateQueries({ queryKey: customerKeys.feedback() });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to update featured status');
    },
  });
};

// ============================================================
// MESSAGE MUTATIONS
// ============================================================

/**
 * Send a message to a customer
 */
export const useSendCustomerMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customer_id, message: msg, formData, reply_to_id }) => {
      if (formData) {
        formData.append('reply_to_id', reply_to_id);
        return api.post('/customer-messages', formData);
      }
      return api.post('/customer-messages', { customer_id, message: msg, reply_to_id });
    },
    onSuccess: (response, variables) => {
      message.success('Message sent successfully');

      // ⭐ Extract the saved ChatMessage record from the response.
      //    Backend shape: { success, message, data: { message_id, ... } }
      const envelope = response?.data ?? {};
      const savedMessage =
        envelope?.data?.data ||
        envelope?.data ||
        null;

      const savedId =
        savedMessage?.message_id ??
        savedMessage?.id ??
        null;

      const customerId = Number(
        variables?.customer_id ??
        savedMessage?.customer_id ??
        savedMessage?.thread?.customer_id
      );

      if (!savedId || !customerId) {
        // Nothing to patch — let the poll pick it up.
        queryClient.invalidateQueries({ queryKey: customerKeys.messages() });
        return;
      }

      // ⭐ REQUEST 2.1 / 2.7 — Patch the cache with the new message so
      //    navigating away and back NEVER loses it. We must find the
      //    threads array regardless of how deeply the envelope nests it.
      queryClient.setQueryData(customerKeys.messages(), (current) => {
        // Deep-walk to find the first array of threads. This handles all
        // shapes:
        //   raw array                         → [...threads]
        //   { data: [...threads] }            → unpaginated
        //   { data: { data: [...threads] } }  → paginated
        //   axios { data: { data: {...} } }   → axios wrapper
        const findThreadsArray = (node, depth = 0) => {
          if (depth > 6 || node == null) return null;
          if (Array.isArray(node)) return node;
          if (typeof node !== 'object') return null;
          if (Array.isArray(node.data)) return node.data;
          if (node.data && typeof node.data === 'object') {
            const found = findThreadsArray(node.data, depth + 1);
            if (found) return found;
          }
          return null;
        };

        const threads = findThreadsArray(current) || [];
        const idx = threads.findIndex(
          (t) => Number(t.customer_id) === customerId
        );

        const appendedMessage = {
          ...savedMessage,
          id: savedId,
          message_id: savedId,
          customer_id: customerId,
        };

        let nextThreads;
        if (idx >= 0) {
          const thread = threads[idx];
          const existingMessages = Array.isArray(thread.messages)
            ? thread.messages
            : [];
          const alreadyThere = existingMessages.some(
            (m) => String(m.message_id || m.id) === String(savedId)
          );
          const nextMessages = alreadyThere
            ? existingMessages
            : [...existingMessages, appendedMessage];
          nextThreads = [...threads];
          nextThreads[idx] = {
            ...thread,
            messages: nextMessages,
            updated_at: new Date().toISOString(),
          };
        } else {
          nextThreads = [
            ...threads,
            {
              customer_id: customerId,
              messages: [appendedMessage],
              updated_at: new Date().toISOString(),
            },
          ];
        }

        // Rebuild the envelope shape from the cached value so we never
        // produce a corrupt hybrid the next read can't parse.
        if (current == null || Array.isArray(current)) {
          return nextThreads;
        }
        if (current.data == null) {
          return { ...current, data: nextThreads };
        }
        if (Array.isArray(current.data)) {
          return { ...current, data: nextThreads };
        }
        if (current.data && typeof current.data === 'object') {
          if (Array.isArray(current.data.data)) {
            return { ...current, data: { ...current.data, data: nextThreads } };
          }
          if (current.data.data && typeof current.data.data === 'object') {
            return {
              ...current,
              data: {
                ...current.data,
                data: {
                  ...current.data.data,
                  data: nextThreads,
                },
              },
            };
          }
          return { ...current, data: { ...current.data, data: nextThreads } };
        }
        return { ...current, data: { data: nextThreads } };
      });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to send message');
    },
  });
};
/**
 * Mark a message as read
 */
export const useMarkMessageRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId) => api.post(`/customer-messages/${messageId}/read`),
    onSuccess: (_data, messageId) => {
      // ⭐ Optimistically patch the read_at of the message in the cache
      //    instead of invalidating the whole query — one mutation per
      //    unread message was causing a refetch storm.
      queryClient.setQueryData(customerKeys.messages(), (current) => {
        const findThreadsArray = (node, depth = 0) => {
          if (depth > 6 || node == null) return null;
          if (Array.isArray(node)) return node;
          if (typeof node !== 'object') return null;
          if (Array.isArray(node.data)) return node.data;
          if (node.data && typeof node.data === 'object') {
            const found = findThreadsArray(node.data, depth + 1);
            if (found) return found;
          }
          return null;
        };

        const threads = findThreadsArray(current);
        if (!threads) return current;

        const nowIso = new Date().toISOString();
        const patched = threads.map((thread) => ({
          ...thread,
          messages: Array.isArray(thread.messages)
            ? thread.messages.map((m) =>
                String(m.message_id || m.id) === String(messageId)
                  ? { ...m, read_at: m.read_at || nowIso }
                  : m
              )
            : thread.messages,
        }));

        // Re-wrap with the same envelope shape the cache already uses.
        const wrapBack = (node, nextThreads, depth = 0) => {
          if (node == null || Array.isArray(node)) return nextThreads;
          if (typeof node !== 'object') return node;
          if (Array.isArray(node.data)) {
            return { ...node, data: nextThreads };
          }
          if (node.data && typeof node.data === 'object') {
            return { ...node, data: wrapBack(node.data, nextThreads, depth + 1) };
          }
          return node;
        };

        return wrapBack(current, patched);
      });
    },
    onError: (error) => {
      // Silent — the poll will reconcile.
      // eslint-disable-next-line no-console
      console.warn(
        'mark-read failed:',
        error?.response?.data?.message || error?.message
      );
    },
  });
};

// ============================================================
// LOYALTY MUTATIONS
// ============================================================

/**
 * Add loyalty points to a customer
 */
export const useAddLoyaltyPoints = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerId, points, reason }) => api.post(`/customers/${customerId}/loyalty/add`, { points, reason }),
    onSuccess: (_, variables) => {
      message.success(`${variables.points} points added`);
      queryClient.invalidateQueries({ queryKey: customerKeys.loyalty(variables.customerId) });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to add points');
    },
  });
};

/**
 * Redeem loyalty points
 */
export const useRedeemLoyaltyPoints = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerId, points, bookingId }) => api.post(`/customers/${customerId}/loyalty/redeem`, { points, booking_id: bookingId }),
    onSuccess: (_, variables) => {
      message.success(`${variables.points} points redeemed`);
      queryClient.invalidateQueries({ queryKey: customerKeys.loyalty(variables.customerId) });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to redeem points');
    },
  });
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

/**
 * Export customers to CSV/Excel
 */
export const useExportCustomers = () => {
  return useMutation({
    mutationFn: (filters = {}) => api.get('/customers/export', { 
      params: filters, 
      responseType: 'blob' 
    }),
    onSuccess: (response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('Customers exported successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to export customers');
    },
  });
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  // Queries
  useCustomers,
  useCustomer,
  useCustomerStats,
  useCustomerBookings,
  useCustomerPayments,
  useCustomerReviews,
  useCustomerFeedback,
  useCustomerMessages,
  useCustomerLoyalty,
  useLatestCustomerBooking,
  // Mutations
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useRestoreCustomer,
  useToggleCustomerStatus,
  useRespondToFeedback,
  useApproveReview,
  useHideReview,
  useFeatureReview,
  useSendCustomerMessage,
  useMarkMessageRead,
  useAddLoyaltyPoints,
  useRedeemLoyaltyPoints,
  useExportCustomers,
  // Keys
  customerKeys,
};