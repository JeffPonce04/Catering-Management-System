// src/hooks/useBookingQuotation.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { bookingAPI, quotationAPI, paymentAPI } from '../services/api';
import api from '../services/api';
import { useEffect } from 'react';

// ============================================================
// API RESPONSE NORMALIZATION
// ============================================================

const isObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const hasOwn = (object, key) => {
    return Object.prototype.hasOwnProperty.call(object, key);
};

const isAxiosResponse = (value) => {
    return (
        isObject(value) &&
        hasOwn(value, 'data') &&
        (
            hasOwn(value, 'status') ||
            hasOwn(value, 'statusText') ||
            hasOwn(value, 'headers') ||
            hasOwn(value, 'config') ||
            hasOwn(value, 'request')
        )
    );
};

const unwrapAxiosResponse = (response) => {
    return isAxiosResponse(response) ? response.data : response;
};

const isApiEnvelope = (value) => {
    if (!isObject(value) || !hasOwn(value, 'data')) {
        return false;
    }
    const keys = Object.keys(value);
    return (
        hasOwn(value, 'success') ||
        hasOwn(value, 'message') ||
        hasOwn(value, 'status') ||
        hasOwn(value, 'error') ||
        keys.length === 1
    );
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const createEmptyListEnvelope = () => {
    return {
        data: [],
        total: 0,
        current_page: 1,
        per_page: 6,
        last_page: 1
    };
};

export const normalizeListResponse = (response) => {
    let payload = unwrapAxiosResponse(response);
    let depth = 0;

    while (depth < 8) {
        depth += 1;

        if (Array.isArray(payload)) {
            return {
                data: payload,
                total: payload.length,
                current_page: 1,
                per_page: Math.max(6, payload.length),
                last_page: 1
            };
        }

        if (!isObject(payload)) {
            return createEmptyListEnvelope();
        }

        if (Array.isArray(payload.data)) {
            const rows = payload.data;
            const total = toNumber(payload.total ?? rows.length, rows.length);
            const perPage = toNumber(payload.per_page ?? payload.perPage ?? 6, 6);
            const currentPage = toNumber(payload.current_page ?? payload.currentPage ?? 1, 1);
            const lastPage = Math.max(1, Math.ceil(total / perPage));
            
            return {
                ...payload,
                data: rows,
                total: total,
                current_page: currentPage,
                per_page: perPage,
                last_page: lastPage
            };
        }

        if (isApiEnvelope(payload)) {
            payload = payload.data;
            continue;
        }

        if (isObject(payload.data)) {
            const dataKeys = Object.keys(payload.data).filter(key => Array.isArray(payload.data[key]));
            if (dataKeys.length > 0) {
                const rows = payload.data[dataKeys[0]];
                const total = toNumber(payload.data.total ?? payload.total ?? rows.length, rows.length);
                const perPage = toNumber(payload.data.per_page ?? payload.per_page ?? 6, 6);
                const currentPage = toNumber(payload.data.current_page ?? payload.current_page ?? 1, 1);
                const lastPage = Math.max(1, Math.ceil(total / perPage));
                
                return {
                    data: rows,
                    total: total,
                    current_page: currentPage,
                    per_page: perPage,
                    last_page: lastPage
                };
            }
            payload = payload.data;
            continue;
        }

        return createEmptyListEnvelope();
    }

    return createEmptyListEnvelope();
};

export const normalizeObjectResponse = (response, fallback = {}) => {
    let payload = unwrapAxiosResponse(response);
    let depth = 0;

    while (depth < 8) {
        depth += 1;

        if (!isObject(payload)) {
            return fallback;
        }

        if (isApiEnvelope(payload) && isObject(payload.data)) {
            payload = payload.data;
            continue;
        }

        return payload;
    }

    return fallback;
};

const getResponseMessage = (response, fallback) => {
    const payload = unwrapAxiosResponse(response);
    return payload?.message || payload?.data?.message || response?.message || fallback;
};

const getErrorMessage = (error, fallback) => {
    return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
};

// ============================================================
// QUERY KEYS
// ============================================================
export const bookingKeys = {
    all: ['bookings'],
    lists: () => [...bookingKeys.all, 'list'],
    list: (filters) => [...bookingKeys.lists(), { filters }],
    details: () => [...bookingKeys.all, 'detail'],
    detail: (id) => [...bookingKeys.details(), id],
    statistics: () => [...bookingKeys.all, 'statistics'],
    conflicts: () => [...bookingKeys.all, 'conflicts'],
    paymentSummary: (bookingId) => [...bookingKeys.all, 'payment-summary', bookingId],
    calendar: (params) => [...bookingKeys.all, 'calendar', params],
    recent: (limit) => [...bookingKeys.all, 'recent', limit],
};

export const quotationKeys = {
    all: ['quotations'],
    lists: () => [...quotationKeys.all, 'list'],
    list: (filters) => [...quotationKeys.lists(), { filters }],
    details: () => [...quotationKeys.all, 'detail'],
    detail: (id) => [...quotationKeys.details(), id]
};

export const paymentKeys = {
    all: ['payments'],
    lists: () => [...paymentKeys.all, 'list'],
    list: (filters) => [...paymentKeys.lists(), { filters }],
    details: () => [...paymentKeys.all, 'detail'],
    detail: (id) => [...paymentKeys.details(), id]
};

export const eventTypeKeys = {
    all: ['event-types'],
    list: () => [...eventTypeKeys.all, 'list']
};

// ============================================================
// CACHE INVALIDATION HELPERS
// ============================================================
const invalidateBookingData = (queryClient) => {
    queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    queryClient.invalidateQueries({ queryKey: ['bookings', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['bookings', 'ingredients-summary'] });
};

const invalidateQuotationData = (queryClient) => {
    queryClient.invalidateQueries({ queryKey: quotationKeys.all });
};

const invalidatePaymentData = (queryClient) => {
    queryClient.invalidateQueries({ queryKey: paymentKeys.all });
};

const getBookingId = (booking) => booking?.booking_id ?? booking?.id;

const bookingMatchesFilters = (booking, filters = {}) => {
    if (!booking) return false;

    const status = String(booking.booking_status || booking.status || '').toLowerCase();
    const exactStatus = filters.status ? String(filters.status).toLowerCase() : '';
    const includedStatuses = filters.status_in
        ? String(filters.status_in).split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
        : [];
    const excludedStatuses = filters.status_not_in
        ? String(filters.status_not_in).split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
        : [];

    if (exactStatus && status !== exactStatus) return false;
    if (includedStatuses.length > 0 && !includedStatuses.includes(status)) return false;
    if (excludedStatuses.includes(status)) return false;

    if (filters.booking_scope) {
        const bookingScope = String(booking.booking_scope || '').toLowerCase();
        const filterScope = String(filters.booking_scope).toLowerCase();
        if (bookingScope && bookingScope !== filterScope) return false;
        // Do not insert an unknown-scope booking into a scope-specific list.
        // Existing rows can still be updated by syncBookingInCache.
        if (!bookingScope) return false;
    }
    if (filters.event_type_id && Number(booking.event_type_id) !== Number(filters.event_type_id)) return false;
    if (filters.event_date && String(booking.event_date || '') !== String(filters.event_date)) return false;
    if (filters.date_from && String(booking.event_date || '') < String(filters.date_from)) return false;
    if (filters.date_to && String(booking.event_date || '') > String(filters.date_to)) return false;

    if (filters.search) {
        const needle = String(filters.search).trim().toLowerCase();
        const haystack = [
            booking.booking_no,
            booking.customer_name,
            booking.customer_email,
            booking.venue,
        ].filter(Boolean).join(' ').toLowerCase();
        if (needle && !haystack.includes(needle)) return false;
    }

    return true;
};

/**
 * Insert, update, or remove a booking from every cached booking-list query
 * according to that query's existing filters. This gives all mounted modules
 * an immediate consistent view without a full-page reload.
 */
export const syncBookingInCache = (queryClient, booking) => {
    const bookingId = getBookingId(booking);
    if (!bookingId) return;

    queryClient.setQueryData(bookingKeys.detail(bookingId), (current) => (
        current && typeof current === 'object' ? { ...current, ...booking } : booking
    ));

    queryClient.getQueriesData({ queryKey: bookingKeys.lists() }).forEach(([queryKey, cached]) => {
        if (!cached || !Array.isArray(cached.data)) return;

        const filters = queryKey?.[2]?.filters || {};
        const previousRows = cached.data;
        const existingIndex = previousRows.findIndex(row => String(getBookingId(row)) === String(bookingId));
        const existingBooking = existingIndex >= 0 ? previousRows[existingIndex] : null;
        const synchronizedBooking = existingBooking ? { ...existingBooking, ...booking } : booking;
        const withoutBooking = previousRows.filter(row => String(getBookingId(row)) !== String(bookingId));
        const matchesFilters = bookingMatchesFilters(synchronizedBooking, filters);
        const page = toNumber(filters.page ?? cached.current_page, 1);
        // A newly approved record belongs at the top of the first page because
        // booking lists are sorted latest-first. On later cached pages, only
        // update an existing row; do not create duplicates across pages.
        const shouldInclude = matchesFilters && (page <= 1 || existingIndex >= 0);
        const unboundedRows = shouldInclude ? [synchronizedBooking, ...withoutBooking] : withoutBooking;
        const perPage = toNumber(filters.per_page ?? cached.per_page, 0);
        const nextRows = perPage > 0 ? unboundedRows.slice(0, perPage) : unboundedRows;
        const totalDelta = matchesFilters
            ? (existingIndex >= 0 ? 0 : 1)
            : (existingIndex >= 0 ? -1 : 0);

        queryClient.setQueryData(queryKey, {
            ...cached,
            data: nextRows,
            total: Math.max(0, toNumber(cached.total, previousRows.length) + totalDelta),
        });
    });
};

// ============================================================
// EVENT TYPES
// ============================================================
const notifyBookingApproved = (bookingId, bookingNo, booking = null) => {
    try {
        window.dispatchEvent(new CustomEvent('booking-approved', { 
            detail: { 
                bookingId: bookingId,
                bookingNo: bookingNo,
                booking,
                message: 'Booking approved successfully',
                timestamp: new Date().toISOString()
            }
        }));
        localStorage.setItem('notifications_updated', Date.now().toString());
    } catch (error) {
        console.warn('Failed to dispatch notification event:', error);
    }
};

// ============================================================
// EVENT TYPE QUERIES
// ============================================================
export const useEventTypes = () => {
    return useQuery({
        queryKey: eventTypeKeys.list(),
        queryFn: async () => {
            const response = await bookingAPI.getEventTypes();
            return normalizeListResponse(response);
        },
        staleTime: 60 * 60 * 1000
    });
};

// ============================================================
// CALENDAR QUERIES
// ============================================================
export const useCalendarEvents = (params = {}) => {
    return useQuery({
        queryKey: bookingKeys.calendar(params),
        queryFn: async () => {
            const response = await bookingAPI.getCalendarEvents(params);
            const normalized = normalizeListResponse(response);
            return normalized.data;
        },
        staleTime: 5 * 60 * 1000
    });
};

// ============================================================
// BOOKING QUERIES WITH REAL-TIME UPDATES
// ============================================================
export const useBookings = (filters = {}) => {
    const queryClient = useQueryClient();
    
    // Ensure per_page defaults to 6
    const defaultFilters = { per_page: 6, page: 1 };
    const mergedFilters = { ...defaultFilters, ...filters };
    
    const query = useQuery({
        queryKey: bookingKeys.list(mergedFilters),
        queryFn: async () => {
            const response = await bookingAPI.getBookings(mergedFilters);
            const normalized = normalizeListResponse(response);
            
            if (normalized.per_page < 6) {
                normalized.per_page = 6;
            }
            
            if (normalized.total > 0 && normalized.per_page > 0) {
                normalized.last_page = Math.max(1, Math.ceil(normalized.total / normalized.per_page));
            }
            
            if (normalized.current_page > normalized.last_page) {
                normalized.current_page = normalized.last_page;
            }
            
            return normalized;
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData || {
            data: [],
            total: 0,
            current_page: 1,
            per_page: 6,
            last_page: 1
        },
        keepPreviousData: true,
        refetchOnWindowFocus: false,
    });

    // 🔥 REAL-TIME: Listen for booking approvals
    useEffect(() => {
        // Try to connect to WebSocket if available
        if (window.Echo) {
            const channel = window.Echo.channel('bookings');
            
            if (channel) {
                channel.listen('.booking.approved', (data) => {
                    console.log('🔔 Real-time: Booking approved event received', data);

                    if (data?.booking) {
                        syncBookingInCache(queryClient, data.booking);
                    } else {
                        queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), refetchType: 'active' });
                    }
                    queryClient.invalidateQueries({ queryKey: bookingKeys.statistics(), refetchType: 'active' });
                    queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' });
                    
                    // Show success message
                    message.success(`✅ Booking ${data.booking_no} confirmed!`);
                    
                    // Trigger custom event
                    notifyBookingApproved(data.booking_id, data.booking_no, data.booking || null);
                });
                
                return () => {
                    channel.stopListening('.booking.approved');
                };
            }
        }
        
        // Fallback: Listen for custom events
        const handleBookingApproved = (event) => {
            const detail = event.detail;
            if (detail) {
                if (detail.booking) {
                    syncBookingInCache(queryClient, detail.booking);
                } else {
                    queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), refetchType: 'active' });
                }
            }
        };
        
        window.addEventListener('booking-approved', handleBookingApproved);
        
        return () => {
            window.removeEventListener('booking-approved', handleBookingApproved);
        };
    }, [queryClient]);

    return query;
};

export const useBooking = (id) => {
    return useQuery({
        queryKey: bookingKeys.detail(id),
        queryFn: async () => {
            const response = await bookingAPI.getBooking(id);
            return normalizeObjectResponse(response);
        },
        enabled: Boolean(id),
        staleTime: 5 * 60 * 1000
    });
};

export const useBookingStatistics = () => {
    return useQuery({
        queryKey: bookingKeys.statistics(),
        queryFn: async () => {
            const response = await bookingAPI.getStatistics();
            return {
                data: normalizeObjectResponse(response, {
                    total_bookings: 0,
                    pending_approvals: 0,
                    total_revenue: 0,
                    total_paid: 0,
                    total_outstanding: 0,
                    regular_bookings: 0,
                    multi_day_events: 0
                })
            };
        },
        refetchInterval: 30000,
        staleTime: 30000
    });
};

export const usePaymentSummary = (bookingId) => {
    return useQuery({
        queryKey: bookingKeys.paymentSummary(bookingId),
        queryFn: async () => {
            const response = await bookingAPI.getPaymentSummary(bookingId);
            return normalizeObjectResponse(response, {
                booking_id: bookingId,
                total_amount: 0,
                total_paid: 0,
                balance: 0,
                payment_status: 'pending',
                payments: []
            });
        },
        enabled: Boolean(bookingId),
        staleTime: 2 * 60 * 1000
    });
};

export const useRecentBookings = (limit = 5) => {
    return useQuery({
        queryKey: bookingKeys.recent(limit),
        queryFn: async () => {
            const response = await bookingAPI.getBookings({ 
                per_page: Math.max(6, limit),
                latest: true 
            });
            const normalized = normalizeListResponse(response);
            return normalized.data || [];
        },
        staleTime: 2 * 60 * 1000,
        refetchInterval: 30000,
    });
};

export const useUpcomingBookings = (limit = 10) => {
    return useQuery({
        queryKey: ['upcoming-bookings', limit],
        queryFn: async () => {
            const response = await bookingAPI.getBookings({ 
                per_page: Math.max(6, limit),
                status: 'confirmed',
                upcoming: true 
            });
            const normalized = normalizeListResponse(response);
            return normalized.data || [];
        },
        staleTime: 2 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });
};

export const useBookingConflicts = (date) => {
    return useQuery({
        queryKey: bookingKeys.conflicts(),
        queryFn: async () => {
            const response = await bookingAPI.checkConflicts({ event_date: date });
            return normalizeObjectResponse(response, { has_conflicts: false, conflicts: [] });
        },
        enabled: Boolean(date),
        staleTime: 5 * 60 * 1000,
    });
};

// ============================================================
// BOOKING MUTATIONS
// ============================================================
export const useConfirmBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => bookingAPI.confirmBooking(id),
        onSuccess: (response, id) => {
            const approvedBooking = normalizeObjectResponse(response, {});
            const bookingNo = approvedBooking?.booking_no || '';
            
            message.success({
                content: `✅ Booking ${bookingNo} confirmed successfully!`,
                duration: 4,
            });

            syncBookingInCache(queryClient, approvedBooking);
            queryClient.invalidateQueries({ queryKey: bookingKeys.statistics(), refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['orders', 'statistics'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'], refetchType: 'active' });
            invalidateQuotationData(queryClient);
            notifyBookingApproved(id, bookingNo, approvedBooking);
        },
        onError: (error) => {
            const errorMsg = error?.response?.data?.message || error?.message || 'Failed to confirm booking';
            message.error(errorMsg);
            console.error('Approval error:', error);
        }
    });
};

export const useRejectBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => bookingAPI.rejectBooking(id),
        onSuccess: (response) => {
            message.warning(getResponseMessage(response, 'Booking rejected'));
            invalidateBookingData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to reject booking'));
        }
    });
};

export const useCancelBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => bookingAPI.cancelBooking(id, data),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Booking cancelled successfully'));
            invalidateBookingData(queryClient);
            invalidatePaymentData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to cancel booking'));
        }
    });
};

export const useCancelBookingWithReason = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }) => api.post(`/bookings/${id}/cancel-with-reason`, { reason }),
        onSuccess: (response) => {
            message.success(response.data?.message || 'Booking cancelled');
            invalidateBookingData(queryClient);
            invalidatePaymentData(queryClient);
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to cancel booking');
        }
    });
};

export const useCompleteBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => api.post(`/bookings/${id}/complete`),
        onSuccess: (response, id) => {
            message.success(response.data?.message || 'Booking completed successfully');
            invalidateBookingData(queryClient);
            queryClient.invalidateQueries({ queryKey: bookingKeys.statistics() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to complete booking');
        }
    });
};

export const useRescheduleBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => bookingAPI.rescheduleBooking(id, data),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Booking rescheduled successfully'));
            invalidateBookingData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to reschedule booking'));
        }
    });
};

export const useRequestReschedule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => bookingAPI.requestReschedule(id, data),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Reschedule request submitted successfully'));
            invalidateBookingData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to submit reschedule request'));
        }
    });
};

export const useApproveReschedule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => bookingAPI.approveReschedule(id),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Reschedule request approved'));
            invalidateBookingData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to approve reschedule'));
        }
    });
};

export const useRejectReschedule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => bookingAPI.rejectReschedule(id),
        onSuccess: (response) => {
            message.warning(getResponseMessage(response, 'Reschedule request rejected'));
            invalidateBookingData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to reject reschedule'));
        }
    });
};

export const useRecordPayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => bookingAPI.recordPayment(id, data),
        onSuccess: (response, variables) => {
            message.success(getResponseMessage(response, 'Payment recorded successfully'));
            invalidateBookingData(queryClient);
            invalidatePaymentData(queryClient);
            queryClient.invalidateQueries({ queryKey: bookingKeys.paymentSummary(variables.id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to record payment'));
        }
    });
};

// ============================================================
// QUOTATION QUERIES
// ============================================================
export const useQuotations = (filters = {}) => {
    return useQuery({
        queryKey: quotationKeys.list(filters),
        queryFn: async () => {
            const response = await quotationAPI.getQuotations(filters);
            return normalizeListResponse(response);
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData
    });
};

export const useQuotation = (id) => {
    return useQuery({
        queryKey: quotationKeys.detail(id),
        queryFn: async () => {
            const response = await quotationAPI.getQuotation(id);
            return normalizeObjectResponse(response);
        },
        enabled: Boolean(id),
        staleTime: 5 * 60 * 1000
    });
};

// ============================================================
// QUOTATION MUTATIONS
// ============================================================
export const useCreateQuotation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => quotationAPI.createQuotation(data),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Quotation created successfully'));
            invalidateQuotationData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to create quotation'));
        }
    });
};

export const useApproveQuotation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => quotationAPI.approveQuotation(id),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Quotation approved and booking created'));
            invalidateQuotationData(queryClient);
            invalidateBookingData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to approve quotation'));
        }
    });
};

export const useRejectQuotation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => quotationAPI.rejectQuotation(id),
        onSuccess: (response) => {
            message.warning(getResponseMessage(response, 'Quotation rejected'));
            invalidateQuotationData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to reject quotation'));
        }
    });
};

export const useSendQuotation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => quotationAPI.sendQuotation(id),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Quotation sent successfully'));
            invalidateQuotationData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to send quotation'));
        }
    });
};

export const useUpdateQuotation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }) => quotationAPI.updateQuotation(id, data),
        onSuccess: (response, variables) => {
            message.success(getResponseMessage(response, 'Quotation updated successfully'));
            invalidateQuotationData(queryClient);
            queryClient.invalidateQueries({ queryKey: quotationKeys.detail(variables.id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to update quotation'));
        }
    });
};

export const useDeleteQuotation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => quotationAPI.deleteQuotation(id),
        onSuccess: (response, id) => {
            message.success(getResponseMessage(response, 'Quotation deleted successfully'));
            invalidateQuotationData(queryClient);
            queryClient.removeQueries({ queryKey: quotationKeys.detail(id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to delete quotation'));
        }
    });
};

// ============================================================
// PAYMENT QUERIES
// ============================================================
export const usePayments = (filters = {}) => {
    return useQuery({
        queryKey: paymentKeys.list(filters),
        queryFn: async () => {
            const response = await paymentAPI.getPayments(filters);
            return normalizeListResponse(response);
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData
    });
};

export const usePayment = (id) => {
    return useQuery({
        queryKey: paymentKeys.detail(id),
        queryFn: async () => {
            const response = await paymentAPI.getPayment(id);
            return normalizeObjectResponse(response);
        },
        enabled: Boolean(id),
        staleTime: 5 * 60 * 1000
    });
};

// ============================================================
// PAYMENT MUTATIONS
// ============================================================
export const useCreatePayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => paymentAPI.createPayment(data),
        onSuccess: (response, variables) => {
            message.success(getResponseMessage(response, 'Payment recorded successfully'));
            invalidatePaymentData(queryClient);
            invalidateBookingData(queryClient);
            queryClient.invalidateQueries({ queryKey: bookingKeys.paymentSummary(variables.booking_id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to record payment'));
        }
    });
};

export const useVerifyPayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, notes }) => paymentAPI.verifyPayment(id, notes),
        onSuccess: (response, variables) => {
            message.success(getResponseMessage(response, 'Payment verified successfully'));
            invalidatePaymentData(queryClient);
            invalidateBookingData(queryClient);
            queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to verify payment'));
        }
    });
};

export const useRejectPayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }) => paymentAPI.rejectPayment(id, reason),
        onSuccess: (response, variables) => {
            message.warning(getResponseMessage(response, 'Payment rejected'));
            invalidatePaymentData(queryClient);
            invalidateBookingData(queryClient);
            queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to reject payment'));
        }
    });
};

export const useDeletePayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => paymentAPI.deletePayment(id),
        onSuccess: (response, id) => {
            message.success(getResponseMessage(response, 'Payment deleted successfully'));
            invalidatePaymentData(queryClient);
            invalidateBookingData(queryClient);
            queryClient.removeQueries({ queryKey: paymentKeys.detail(id) });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to delete payment'));
        }
    });
};

// ============================================================
// CALENDAR AVAILABILITY
// ============================================================
export const calendarAvailabilityKeys = {
    all: ['booking-calendar-availability'],
    list: (params) => [...calendarAvailabilityKeys.all, 'list', params]
};

export const useCalendarAvailability = (params = {}) => {
    return useQuery({
        queryKey: calendarAvailabilityKeys.list(params),
        queryFn: async () => {
            const response = await bookingAPI.getCalendarAvailability(params);
            return normalizeListResponse(response);
        },
        staleTime: 2 * 60 * 1000
    });
};

export const useSaveCalendarAvailability = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ date, data }) => bookingAPI.saveCalendarAvailability(date, data),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Calendar availability saved successfully'));
            queryClient.invalidateQueries({ queryKey: calendarAvailabilityKeys.all });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to save calendar availability'));
        }
    });
};

export const useDeleteCalendarAvailability = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (date) => bookingAPI.deleteCalendarAvailability(date),
        onSuccess: (response) => {
            message.success(getResponseMessage(response, 'Calendar availability reset successfully'));
            queryClient.invalidateQueries({ queryKey: calendarAvailabilityKeys.all });
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to reset calendar availability'));
        }
    });
};

// ============================================================
// EXPORT
// ============================================================
export default {
    useEventTypes,
    useCalendarEvents,
    useBookings,
    useBooking,
    useBookingStatistics,
    usePaymentSummary,
    useRecentBookings,
    useUpcomingBookings,
    useBookingConflicts,
    useQuotations,
    useQuotation,
    usePayments,
    usePayment,
    useCalendarAvailability,
    useConfirmBooking,
    useRejectBooking,
    useCancelBooking,
    useCancelBookingWithReason,
    useCompleteBooking,
    useRescheduleBooking,
    useRequestReschedule,
    useApproveReschedule,
    useRejectReschedule,
    useRecordPayment,
    useCreateQuotation,
    useApproveQuotation,
    useRejectQuotation,
    useSendQuotation,
    useUpdateQuotation,
    useDeleteQuotation,
    useCreatePayment,
    useVerifyPayment,
    useRejectPayment,
    useDeletePayment,
    useSaveCalendarAvailability,
    useDeleteCalendarAvailability,
};