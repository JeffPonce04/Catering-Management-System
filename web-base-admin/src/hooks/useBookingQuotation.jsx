// src/hooks/useBookingQuotation.jsx
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
// ⭐ Import App instead of the static `message` so hooks consume the
//    dynamic theme context and stop warning about it.
import { App } from 'antd';
import { bookingAPI, quotationAPI, paymentAPI, insightVisibilityAPI } from '../services/api';
import api from '../services/api';
import { useEffect } from 'react';
import dayjs from 'dayjs';
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

    // ⭐ REQUEST #9: A newly approved booking must NOT stay in lists that
    // explicitly exclude the confirmed status. But it MUST appear in any
    // list that doesn't exclude it — the caller merges it at the top.
    // We keep the existing filter semantics here and rely on the caller
    // (syncBookingInCache) to place approved rows at index 0.
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

    // ⭐ FIX: When the list is filtered to "pending" (or "pending_approval"),
    // a newly confirmed booking must NOT be inserted into it — but it MUST
    // be removed from that list. Handled by the caller. Returning false
    // here causes the booking to disappear from the pending tab, which is
    // correct — it will appear in the "confirmed" tab.
    //
    // The important fix is elsewhere: the pending tab must not be the ONLY
    // source of truth. The confirmed booking needs a place to go.

    // ⭐ FIX: A filter of `status_in=confirmed,ongoing,completed` must
    // accept a booking whose status just changed to 'confirmed'.
    // Previously the case-sensitive string compare on `booking_scope`
    // would drop bookings with no scope set.
    if (filters.booking_scope) {
        const bookingScope = String(booking.booking_scope || '').toLowerCase();
        const filterScope = String(filters.booking_scope).toLowerCase();
        if (bookingScope && bookingScope !== filterScope) return false;
        // Unknown scope bookings still belong in scope-specific lists
        // so the operator can see them.
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

    // Merge into the detail cache.
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

        // ⭐ FIX: A newly approved booking must appear in EVERY list that
        // doesn't explicitly exclude 'confirmed' — not just page 1.
        // Previously the check `page <= 1 || existingIndex >= 0` dropped
        // newly approved bookings from pages 2+.
           const matchesFilters = bookingMatchesFilters(synchronizedBooking, filters);

        // Don't insert into a list that was never loaded (empty cached.data
        // with total=0 is fine because that's a legitimately empty list).
        const shouldInclude = matchesFilters;

        // ⭐ REQUEST #9: Approved bookings float to the top of every list.
        const synchronizedStatus = String(
            synchronizedBooking.booking_status || synchronizedBooking.status || ''
        ).toLowerCase();
        const isApprovedRow = ['confirmed', 'approved'].includes(synchronizedStatus);

        let unboundedRows;
        if (!shouldInclude) {
            unboundedRows = withoutBooking;
        } else if (isApprovedRow) {
            unboundedRows = [synchronizedBooking, ...withoutBooking];
        } else {
            // Insert non-approved rows in their original position by date,
            // preserving the existing (approved-first, then date) ordering.
            const stillApproved = withoutBooking.filter((row) => {
                const s = String(row?.booking_status || row?.status || '').toLowerCase();
                return ['confirmed', 'approved'].includes(s);
            });
            const nonApproved = withoutBooking.filter((row) => {
                const s = String(row?.booking_status || row?.status || '').toLowerCase();
                return !['confirmed', 'approved'].includes(s);
            });
            unboundedRows = [...stillApproved, synchronizedBooking, ...nonApproved];
        }
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
export const useCalendarEvents = (params = {}, options = {}) => {
    return useQuery({
        queryKey: bookingKeys.calendar(params),
        queryFn: async () => {
            const response = await bookingAPI.getCalendarEvents(params);
            const normalized = normalizeListResponse(response);
            return normalized.data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: options.enabled !== false,
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
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        // ⭐ 20-second poll so bookings changed on another device
        //    (phone, tablet, other browser) appear without a manual refresh.
        refetchInterval: 20 * 1000,
        refetchIntervalInBackground: false,
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
                    
                                  // ⭐ Toast is suppressed here so it only appears once,
                    // after the page-level loading line finishes.
                    // message.success(`Booking ${data.booking_no} confirmed!`);
                    
                    // Trigger custom event
                    notifyBookingApproved(data.booking_id, data.booking_no, data.booking || null);
                });
                
                return () => {
                    channel.stopListening('.booking.approved');
                };
            }
        }
        
        // NOTE: Removed the window 'booking-approved' fallback listener.
        // It was registered once per mounted useBookings instance (3 on the
        // booking page), so a single approval event triggered 3 × invalidate
        // × 3 list queries = 9 cascading network requests. Cache syncing
        // now happens ONLY inside useConfirmBooking's onSuccess.
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

export const useBookingStatistics = (period = 'monthly', anchor = null) => {
    const resolvedAnchor = anchor || dayjs().format('YYYY-MM-DD');

    return useQuery({
        queryKey: [...bookingKeys.statistics(), { period, anchor: resolvedAnchor }],
        queryFn: async () => {
            const response = await bookingAPI.getStatistics({
                period,
                anchor: resolvedAnchor,
            });
            return {
                data: normalizeObjectResponse(response, {
                    period: period,
                    period_label: '',
                    period_start: null,
                    period_end: null,
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
           // ⭐ A new period/anchor is a NEW queryKey — treat it as fresh data
        //    so it fetches immediately and never serves a stale window.
        staleTime: 15 * 1000,
        // ⭐ REQUEST #6 — 20-second poll so pending approvals and revenue
        //    numbers stay current without any manual refresh.
        refetchInterval: 20 * 1000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        placeholderData: (previous) => previous,
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
            // ⭐ FIX: The response from POST /bookings/{id}/confirm is a
            // full booking payload with booking_status='confirmed'.
            // Capture it so we can sync it into every list cache.
            const approvedBooking = normalizeObjectResponse(response, {});

            // Ensure the status field is set even if the response
            // came back with a slightly different shape.
            if (approvedBooking && !approvedBooking.booking_status) {
                approvedBooking.booking_status = 'confirmed';
            }

            const bookingNo = approvedBooking?.booking_no || '';

            // ⭐ 1. Patch every booking list with the new record.
            //    This makes the booking INSTANTLY appear in the confirmed
            //    tab and disappear from the pending tab.
            if (approvedBooking && approvedBooking.booking_id) {
                syncBookingInCache(queryClient, approvedBooking);
            }

            // ⭐ 2. Force-invalidate the list queries so any list that
            //    was NOT patched by syncBookingInCache (e.g. hidden tabs)
            //    re-fetches on next mount.
            queryClient.invalidateQueries({
                queryKey: bookingKeys.lists(),
                refetchType: 'active',
            });

            // ⭐ 3. Invalidate the detail so opening the booking shows
            //    the confirmed status and the newly-created order/invoice.
            if (id) {
                queryClient.invalidateQueries({
                    queryKey: bookingKeys.detail(id),
                    refetchType: 'active',
                });
            }

            // ⭐ 4. Statistics + counts.
            queryClient.invalidateQueries({
                queryKey: bookingKeys.statistics(),
                refetchType: 'active',
            });

            // ⭐ 5. Order page — this is the fix for "doesn't appear in Orders".
            //    Use a bare prefix ['orders'] so every variation of the
            //    orders query key is invalidated at once.
            queryClient.invalidateQueries({
                queryKey: ['orders'],
                refetchType: 'active',
            });

            // ⭐ 6. Inventory + dashboard refresh.
            queryClient.invalidateQueries({
                queryKey: ['inventory', 'dashboard-stats'],
                refetchType: 'active',
            });
            queryClient.invalidateQueries({
                queryKey: ['dashboard'],
                refetchType: 'active',
            });

            // ⭐ 7. Quotations (invoice status may have changed).
            invalidateQuotationData(queryClient);

            // ⭐ 8. Fire the cross-tab event so other mounted tabs refresh.
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
              onSuccess: (response, id) => {
            // ⭐ REQUEST #6 — Broadcast so every other tab un-highlights
            // the row immediately without a refresh.
            broadcastBookingChanged(id, 'rejected');
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
              onSuccess: (response, variables) => {
            const id = variables?.id ?? variables?.booking_id;
            if (id) broadcastBookingChanged(id, 'cancelled');
            message.success(getResponseMessage(response, 'Booking cancelled successfully'));
            invalidateBookingData(queryClient);
            invalidatePaymentData(queryClient);
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to cancel booking'));
        }
    });
};

/**
 * ⭐ REQUEST #4 — Un-reject a booking (restore to pending approval).
 * Uses syncBookingInCache so the row moves out of history instantly.
 */
export const useUnrejectBooking = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id) => bookingAPI.unrejectBooking(id),
        onSuccess: (response, id) => {
            const restored = normalizeObjectResponse(response, {});
            if (restored && !restored.booking_status) {
                restored.booking_status = 'pending_approval';
            }

            if (restored && restored.booking_id) {
                syncBookingInCache(queryClient, restored);
            }

            queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id), refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: bookingKeys.statistics(), refetchType: 'active' });

            broadcastBookingChanged(id, 'unrejected');

            message.success(
                getResponseMessage(response, 'Booking restored to pending approval.')
            );
        },
        onError: (error) => {
            message.error(getErrorMessage(error, 'Failed to restore booking'));
        },
    });
};

export const useCancelBookingWithReason = () => {    const queryClient = useQueryClient();

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
            broadcastBookingChanged(id, 'completed');
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
            // ⭐ REQUEST #2 — A payment just landed. Broadcast so every open
            // tab re-fetches this booking and the yellow deposit highlight
            // disappears automatically without a manual refresh.
            if (variables?.id) broadcastBookingChanged(variables.id, 'payment_recorded');

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
               staleTime: 5 * 60 * 1000
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
              staleTime: 5 * 60 * 1000
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

export const useCalendarAvailability = (params = {}, options = {}) => {
    return useQuery({
        queryKey: calendarAvailabilityKeys.list(params),
        queryFn: async () => {
            const response = await bookingAPI.getCalendarAvailability(params);
            return normalizeListResponse(response);
        },
        staleTime: 2 * 60 * 1000,
        enabled: options.enabled !== false,
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
// ⭐ REQUEST #6, #7, #8: INSIGHT VISIBILITY (Hide/Unhide)
//
// Behaviour:
//   • Cashier sees the mask instantly when admin toggles (BroadcastChannel).
//   • Refresh preserves the mask (localStorage snapshot + server truth).
//   • Cross-device updates arrive within 15s (poll fallback).
//   • A read failure falls back to the CACHED value, never to "all visible".
// ============================================================

export const insightVisibilityKeys = {
    all: ['insight-visibility'],
};

const INSIGHT_VISIBILITY_CACHE_KEY = 'insight_visibility_state';
const INSIGHT_VISIBILITY_CHANNEL   = 'insight_visibility_channel';

const DEFAULT_INSIGHT_VISIBILITY = {
    total_approved:      false,
    total_revenue:       false,
    rejected:            false,
    outstanding_balance: false,
};

/**
 * Read the last-known visibility map from localStorage.
 * Used as initialData so the first render already reflects the mask.
 */
const readCachedInsightVisibility = () => {
    try {
        const raw = localStorage.getItem(INSIGHT_VISIBILITY_CACHE_KEY);
        if (!raw) return DEFAULT_INSIGHT_VISIBILITY;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return DEFAULT_INSIGHT_VISIBILITY;
        return {
            total_approved:      Boolean(parsed.total_approved),
            total_revenue:       Boolean(parsed.total_revenue),
            rejected:            Boolean(parsed.rejected),
            outstanding_balance: Boolean(parsed.outstanding_balance),
        };
    } catch (e) {
        return DEFAULT_INSIGHT_VISIBILITY;
    }
};

const writeCachedInsightVisibility = (value) => {
    try {
        localStorage.setItem(INSIGHT_VISIBILITY_CACHE_KEY, JSON.stringify(value));
    } catch (e) {
        console.warn('Could not cache insight visibility:', e);
    }
};

/**
 * ⭐ Broadcast a new visibility state to every tab in this browser, and
 * persist it so a reload preserves the mask.
 *
 * Call this from the mutation's onSuccess.
 */
export const broadcastInsightVisibility = (next) => {
    const normalized = {
        total_approved:      Boolean(next?.total_approved),
        total_revenue:       Boolean(next?.total_revenue),
        rejected:            Boolean(next?.rejected),
        outstanding_balance: Boolean(next?.outstanding_balance),
    };

    // 1. Persist for the next reload.
    writeCachedInsightVisibility(normalized);

    // 2. Push to every open tab in the same browser, instantly.
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel(INSIGHT_VISIBILITY_CHANNEL);
            channel.postMessage({ payload: normalized });
            channel.close();
        }
    } catch (e) {
        console.warn('BroadcastChannel post failed:', e);
    }
};

/**
 * Reads the persisted insight visibility map.
 *
 * Sources of truth (in priority order):
 *   1. React Query cache (shared across every component on the page)
 *   2. localStorage snapshot (survives refresh, avoids first-render flash)
 *   3. Server response (authoritative — always wins once received)
 */
export const useInsightVisibility = () => {
    return useQuery({
        queryKey: insightVisibilityKeys.all,
        queryFn: async () => {
            try {
                const response = await insightVisibilityAPI.get();
                const payload =
                    response?.data?.data?.data ||
                    response?.data?.data ||
                    response?.data ||
                    {};
                const resolved = {
                    total_approved:      Boolean(payload?.total_approved),
                    total_revenue:       Boolean(payload?.total_revenue),
                    rejected:            Boolean(payload?.rejected),
                    outstanding_balance: Boolean(payload?.outstanding_balance),
                };
                // ⭐ Persist so the cashier sees the mask right after refresh.
                writeCachedInsightVisibility(resolved);
                return resolved;
            } catch (error) {
                console.error(
                    'Failed to load insight visibility (using cached value):',
                    error?.response?.status,
                    error?.response?.data || error?.message
                );
                // ⭐ Fall back to the cached value, NOT "everything visible".
                return readCachedInsightVisibility();
            }
        },
        // ⭐ Pre-seed the cache so the first render (including on refresh)
        //    already reflects the last-known state.
        initialData: () => readCachedInsightVisibility(),
        initialDataUpdatedAt: () => 0,
        staleTime: 15 * 1000,
        refetchOnWindowFocus: true,
        // ⭐ 15-second poll for cross-device updates.
        refetchInterval: 15 * 1000,
        refetchIntervalInBackground: false,
    });
};

/**
 * ⭐ Keeps every mounted tab (admin + cashier) in sync.
 *
 * Two channels:
 *   1. BroadcastChannel — same-origin, same-browser, instant.
 *   2. storage event    — fallback for browsers without BroadcastChannel.
 */
export const useInsightVisibilitySync = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        let channel;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                channel = new BroadcastChannel(INSIGHT_VISIBILITY_CHANNEL);
                channel.onmessage = (event) => {
                    const next = event?.data?.payload;
                    if (!next) return;
                    const normalized = {
                        total_approved:      Boolean(next.total_approved),
                        total_revenue:       Boolean(next.total_revenue),
                        rejected:            Boolean(next.rejected),
                        outstanding_balance: Boolean(next.outstanding_balance),
                    };
                    writeCachedInsightVisibility(normalized);
                    queryClient.setQueryData(insightVisibilityKeys.all, normalized);
                };
            }
        } catch (e) {
            console.warn('BroadcastChannel unavailable, using storage events only:', e);
        }

        const handleStorage = (event) => {
            if (event.key !== INSIGHT_VISIBILITY_CACHE_KEY) return;
            try {
                const next = JSON.parse(event.newValue || '{}');
                queryClient.setQueryData(insightVisibilityKeys.all, {
                    total_approved:      Boolean(next.total_approved),
                    total_revenue:       Boolean(next.total_revenue),
                    rejected:            Boolean(next.rejected),
                    outstanding_balance: Boolean(next.outstanding_balance),
                });
            } catch (e) {
                // ignore malformed payloads
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (channel) channel.close();
            window.removeEventListener('storage', handleStorage);
        };
    }, [queryClient]);
};

/**
 * Admin-only mutation. Reuses the existing settings section endpoint.
 */
export const useUpdateInsightVisibility = () => {
    const queryClient = useQueryClient();
    const { message } = App.useApp();

    return useMutation({
        mutationFn: async (nextVisibility) => {
            const payload = {
                total_approved:      Boolean(nextVisibility?.total_approved),
                total_revenue:       Boolean(nextVisibility?.total_revenue),
                rejected:            Boolean(nextVisibility?.rejected),
                outstanding_balance: Boolean(nextVisibility?.outstanding_balance),
            };
            const response = await insightVisibilityAPI.update(payload);
            return response;
        },
        onSuccess: (_response, nextVisibility) => {
            const normalized = {
                total_approved:      Boolean(nextVisibility?.total_approved),
                total_revenue:       Boolean(nextVisibility?.total_revenue),
                rejected:            Boolean(nextVisibility?.rejected),
                outstanding_balance: Boolean(nextVisibility?.outstanding_balance),
            };

            // Update this tab's cache immediately.
            queryClient.setQueryData(insightVisibilityKeys.all, normalized);

            // ⭐ Push to every other tab in the same browser instantly,
            //    and persist for the next reload.
            broadcastInsightVisibility(normalized);

            message.success('Visibility updated.');
        },
        onError: (error) => {
            const status = error?.response?.status;
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                'Failed to update visibility';

            if (status === 403) {
                message.error(
                    'Your account does not have permission to hide insight values. ' +
                    'Only Administrators can toggle visibility.'
                );
            } else if (status === 404) {
                message.error(
                    'Insight visibility endpoint missing. Register GET/PUT ' +
                    '/settings/insight-visibility in routes/api.php.'
                );
            } else {
                message.error(msg);
            }
        },
    });
};

// ============================================================
// ⭐ Cross-tab / cross-window booking change signal
//
// React Query caches are per-tab. When one user mutates a booking,
// every other open tab needs to be told to refetch that booking and
// the booking list. This is that signal.
// ============================================================

const BOOKING_CHANGED_KEY = 'booking_changed_signal';
const BOOKING_CHANGED_CHANNEL = 'booking_changed_channel';

export const broadcastBookingChanged = (bookingId, reason = 'update') => {
    const payload = {
        bookingId,
        reason,
        ts: Date.now(),
    };

    // 1. localStorage (survives across windows)
    try {
        localStorage.setItem(BOOKING_CHANGED_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Could not persist booking change signal:', e);
    }

    // 2. BroadcastChannel (instant across same-origin tabs)
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel(BOOKING_CHANGED_CHANNEL);
            channel.postMessage(payload);
            channel.close();
        }
    } catch (e) {
        console.warn('BroadcastChannel post failed:', e);
    }
};

/**
 * Subscribe to booking-change signals and invalidate the React Query
 * caches so the current tab refreshes automatically.
 *
 * Mount this once per page that displays bookings (admin dashboard,
 * cashier view, super-admin view).
 */
export const useBookingChangeSync = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const invalidate = (payload) => {
            if (import.meta.env.DEV) {
                console.log('🔔 Booking change signal:', payload);
            }

            // Refresh every list + the specific booking's detail.
            queryClient.invalidateQueries({
                queryKey: bookingKeys.lists(),
                refetchType: 'active',
            });
            queryClient.invalidateQueries({
                queryKey: bookingKeys.statistics(),
                refetchType: 'active',
            });

            if (payload?.bookingId) {
                queryClient.invalidateQueries({
                    queryKey: bookingKeys.detail(payload.bookingId),
                    refetchType: 'active',
                });
            }

            // Calendar / availability may also be affected.
            queryClient.invalidateQueries({
                queryKey: ['booking-calendar-availability'],
                refetchType: 'active',
            });
        };

        let channel;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                channel = new BroadcastChannel(BOOKING_CHANGED_CHANNEL);
                channel.onmessage = (event) => invalidate(event?.data);
            }
        } catch (e) {
            console.warn('BroadcastChannel unavailable:', e);
        }

        const handleStorage = (event) => {
            if (event.key !== BOOKING_CHANGED_KEY) return;
            try {
                const payload = JSON.parse(event.newValue || '{}');
                invalidate(payload);
            } catch (e) {
                // ignore
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (channel) channel.close();
            window.removeEventListener('storage', handleStorage);
        };
    }, [queryClient]);
};

// ============================================================
// EXPORT
// ============================================================
export default {
    useEventTypes,
    useInsightVisibility,
    useInsightVisibilitySync,
    useUpdateInsightVisibility,
    useBookingChangeSync,
    broadcastBookingChanged,
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
    useUnrejectBooking,
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