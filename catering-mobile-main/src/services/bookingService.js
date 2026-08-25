// src/services/bookingService.js
import api, { apiHelpers } from './api';

export const bookingService = {
    /**
     * Get all bookings with optional filters
     */
    getBookings: async (params = {}) => {
        try {
            console.log('📤 Fetching bookings with params:', params);
            const response = await api.get('/v1/bookings', { params });
            console.log('📥 Bookings response status:', response.status);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching bookings:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get a single booking by ID
     */
    getBooking: async (id) => {
        try {
            const response = await api.get(`/v1/bookings/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error fetching booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Create a new booking
     */
    createBooking: async (data) => {
        try {
            console.log('📤 Creating booking:', data);
            const response = await api.post('/v1/bookings', data);
            console.log('📥 Create booking response:', response.status);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error creating booking:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Update a booking
     */
    updateBooking: async (id, data) => {
        try {
            const response = await api.put(`/v1/bookings/${id}`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error updating booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Delete/cancel a booking
     */
    cancelBooking: async (id, data = {}) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/cancel`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error cancelling booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Cancel booking with reason
     */
    cancelWithReason: async (id, reason) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/cancel-with-reason`, { reason });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error cancelling booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Confirm/approve a booking
     */
    confirmBooking: async (id) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/confirm`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error confirming booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Reject a booking
     */
    rejectBooking: async (id) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/reject`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error rejecting booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Complete a booking
     */
    completeBooking: async (id) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/complete`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error completing booking ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get booking payment summary
     */
    getPaymentSummary: async (id) => {
        try {
            const response = await api.get(`/v1/bookings/${id}/payment-summary`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error fetching payment summary ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Request reschedule for a booking
     */
    requestReschedule: async (id, data) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/request-reschedule`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error requesting reschedule ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Approve reschedule request
     */
    approveReschedule: async (id, data = {}) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/approve-reschedule`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error approving reschedule ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Reject reschedule request
     */
    rejectReschedule: async (id, data = {}) => {
        try {
            const response = await api.post(`/v1/bookings/${id}/reject-reschedule`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error rejecting reschedule ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get calendar events
     */
    getCalendarEvents: async (params = {}) => {
        try {
            const response = await api.get('/v1/calendar-events', { params });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching calendar events:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get booking statistics
     */
    getStatistics: async () => {
        try {
            const response = await api.get('/v1/bookings-statistics');
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching booking statistics:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Check for booking conflicts
     */
    checkConflicts: async (params) => {
        try {
            const response = await api.get('/v1/bookings/check-conflicts', { params });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error checking conflicts:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get calendar availability (SINGLE DEFINITION)
     */
    getCalendarAvailability: async (params = {}) => {
        try {
            const response = await api.get('/v1/booking-calendar/availability', { params });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching calendar availability:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get event types
     */
    getEventTypes: async () => {
        try {
            const response = await api.get('/v1/event-types');
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching event types:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get reschedule requests for a booking
     */
    getRescheduleRequests: async (bookingId) => {
        try {
            const response = await api.get(`/v1/bookings/${bookingId}/reschedule-requests`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error fetching reschedule requests:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Admin approves reschedule
     */
    approveRescheduleAdmin: async (bookingId, newDate, newTime) => {
        try {
            const response = await api.post(`/v1/bookings/${bookingId}/approve-reschedule`, {
                new_date: newDate,
                new_time: newTime
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error approving reschedule:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Admin rejects reschedule (booking cancelled)
     */
    rejectRescheduleAdmin: async (bookingId, reason) => {
        try {
            const response = await api.post(`/v1/bookings/${bookingId}/reject-reschedule`, {
                reason: reason || 'Reschedule request rejected'
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error rejecting reschedule:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Customer accepts reschedule
     */
    acceptReschedule: async (bookingId, newDate, newTime) => {
        try {
            const response = await api.post(`/v1/bookings/${bookingId}/accept-reschedule`, {
                new_date: newDate,
                new_time: newTime
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error accepting reschedule:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Customer rejects reschedule (booking cancelled)
     */
    rejectRescheduleCustomer: async (bookingId, reason) => {
        try {
            const response = await api.post(`/v1/bookings/${bookingId}/reject-reschedule-customer`, {
                reason: reason || 'Customer rejected reschedule'
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error rejecting reschedule:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Check if booking has pending reschedule request
     */
    hasPendingReschedule: async (bookingId) => {
        try {
            const response = await api.get(`/v1/bookings/${bookingId}/has-pending-reschedule`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error checking pending reschedule:', error);
            return { success: true, data: { has_pending: false } };
        }
    },

    /**
     * Get reschedule status for a booking
     */
    getRescheduleStatus: async (bookingId) => {
        try {
            const response = await api.get(`/v1/bookings/${bookingId}/reschedule-status`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error fetching reschedule status:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Cancel booking with reason (Customer)
     */
    cancelBookingWithReason: async (bookingId, reason) => {
        try {
            const response = await api.post(`/v1/bookings/${bookingId}/cancel-with-reason`, {
                reason: reason || 'Cancelled by customer'
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error cancelling booking:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get reschedule requests for a booking (alias)
     */
    getRescheduleRequestsForBooking: async (bookingId) => {
        return await bookingService.getRescheduleRequests(bookingId);
    },
};

export default bookingService;