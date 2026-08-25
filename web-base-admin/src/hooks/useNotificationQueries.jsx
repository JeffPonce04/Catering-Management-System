// src/hooks/useNotificationQueries.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../services/api';

const markingReadMap = new Map();
const markingReadTimers = new Map();

// ==================== QUERY KEYS ====================
export const notificationKeys = {
    all: ['notifications'],
    lists: () => [...notificationKeys.all, 'list'],
    list: (params) => [...notificationKeys.lists(), { params }],
    details: () => [...notificationKeys.all, 'detail'],
    detail: (id) => [...notificationKeys.details(), id],
    unread: () => [...notificationKeys.all, 'unread'],
    starred: () => [...notificationKeys.all, 'starred'],
};

// ==================== NOTIFICATION HOOKS ====================

/**
 * Get all notifications with filtering
 */
export const useNotifications = (params = {}) => {
    return useQuery({
        queryKey: notificationKeys.list(params),
        queryFn: async () => {
            const response = await api.get('/notifications', { params });
            const data = response?.data?.data || response?.data || { data: [], total: 0 };
            
            // Extract notifications from nested structure
            let notifications = [];
            let total = 0;
            let unreadCount = 0;
            
            if (Array.isArray(data)) {
                notifications = data;
                total = data.length;
            } else if (data?.data && Array.isArray(data.data)) {
                notifications = data.data;
                total = data.total || data.data.length;
                unreadCount = data.unread_count || 0;
            } else if (Array.isArray(data?.data)) {
                notifications = data.data;
                total = data.total || data.data.length;
            }
            
            return {
                data: notifications,
                total: total,
                unread_count: unreadCount,
                current_page: data.current_page || 1,
                last_page: data.last_page || 1,
                per_page: data.per_page || 15,
            };
        },
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        keepPreviousData: true,
        retry: 1,
    });
};

/**
 * Get unread count with fallback for 404
 */
export const useUnreadCount = () => {
    return useQuery({
        queryKey: notificationKeys.unread(),
        queryFn: async () => {
            try {
                // First try the dedicated endpoint
                const response = await api.get('/notifications/unread-count');
                const count = response?.data?.data?.count || response?.data?.count || 0;
                return Math.max(0, parseInt(count) || 0);
            } catch (error) {
                // If 404, try fallback from main endpoint
                if (error.response?.status === 404) {
                    console.warn('Unread count endpoint not found, using fallback...');
                    try {
                        const fallbackResponse = await api.get('/notifications', {
                            params: { unread: true, per_page: 1 }
                        });
                        const count = fallbackResponse?.data?.unread_count || 
                                     fallbackResponse?.data?.data?.total || 0;
                        return Math.max(0, parseInt(count) || 0);
                    } catch (fallbackError) {
                        console.warn('Fallback also failed:', fallbackError);
                        return 0;
                    }
                }
                console.error('Error fetching unread count:', error);
                return 0;
            }
        },
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        // Don't throw errors to UI
        throwOnError: false,
        // Return 0 as default
        initialData: 0,
    });
};

/**
 * Get starred notifications
 */
export const useStarredNotifications = () => {
    return useQuery({
        queryKey: notificationKeys.starred(),
        queryFn: async () => {
            const response = await api.get('/notifications/starred');
            return response?.data?.data || response?.data || [];
        },
        staleTime: 30 * 1000,
    });
};

/**
 * Get notifications by type
 */
export const useNotificationsByType = (type) => {
    return useQuery({
        queryKey: ['notifications', 'type', type],
        queryFn: async () => {
            const response = await api.get(`/notifications/type/${type}`);
            return response?.data?.data || response?.data || [];
        },
        enabled: !!type,
        staleTime: 30 * 1000,
    });
};

/**
 * Get notifications by priority
 */
export const useNotificationsByPriority = (priority) => {
    return useQuery({
        queryKey: ['notifications', 'priority', priority],
        queryFn: async () => {
            const response = await api.get(`/notifications/priority/${priority}`);
            return response?.data?.data || response?.data || [];
        },
        enabled: !!priority,
        staleTime: 30 * 1000,
    });
};

// ==================== MUTATION HOOKS ====================

/**
 * Mark a notification as read
 */
export const useMarkNotificationRead = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (id) => {
            // Prevent duplicate requests
            if (markingReadMap.has(id)) {
                console.log(`⚠️ Notification ${id} already being marked as read`);
                return null;
            }
            
            markingReadMap.set(id, true);
            
            // Clear any existing timer for this ID
            if (markingReadTimers.has(id)) {
                clearTimeout(markingReadTimers.get(id));
            }
            
            // Auto-cleanup after 3 seconds
            markingReadTimers.set(id, setTimeout(() => {
                markingReadMap.delete(id);
                markingReadTimers.delete(id);
            }, 3000));
            
            try {
                const response = await api.post(`/notifications/${id}/read`);
                return response;
            } catch (error) {
                markingReadMap.delete(id);
                if (markingReadTimers.has(id)) {
                    clearTimeout(markingReadTimers.get(id));
                    markingReadTimers.delete(id);
                }
                throw error;
            }
        },
        onSuccess: (data, id) => {
            if (data) {
                // Invalidate all notification queries
                queryClient.invalidateQueries({ queryKey: notificationKeys.all });
                // Also invalidate unread count
                queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
                // Trigger custom event for other components
                window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
                message.success('Notification marked as read');
            }
        },
        onError: (error) => {
            console.error('Failed to mark as read:', error);
            message.error(error?.response?.data?.message || 'Failed to mark as read');
        },
    });
};

/**
 * Delete a notification
 */
export const useDeleteNotification = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (id) => api.delete(`/notifications/${id}`),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
            message.success('Notification deleted');
            window.dispatchEvent(new CustomEvent('notification-deleted', { detail: { id } }));
        },
        onError: (error) => {
            console.error('Failed to delete:', error);
            message.error(error?.response?.data?.message || 'Failed to delete');
        },
    });
};

/**
 * Mark all notifications as read
 */
export const useMarkAllRead = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: () => api.post('/notifications/read-all'),
        onSuccess: () => {
            message.success('All notifications marked as read');
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
            window.dispatchEvent(new CustomEvent('all-notifications-read'));
        },
        onError: (error) => {
            console.error('Failed to mark all as read:', error);
            message.error(error?.response?.data?.message || 'Failed to mark all as read');
        },
    });
};

/**
 * Toggle star status on a notification
 */
export const useToggleStar = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (id) => api.post(`/notifications/${id}/star`),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationKeys.starred() });
            window.dispatchEvent(new CustomEvent('notification-star-toggled', { detail: { id } }));
        },
        onError: (error) => {
            console.error('Failed to toggle star:', error);
            message.error(error?.response?.data?.message || 'Failed to toggle star');
        },
    });
};

/**
 * Clear all notifications
 */
export const useClearAllNotifications = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: () => api.delete('/notifications/clear-all'),
        onSuccess: () => {
            message.success('All notifications cleared');
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
            queryClient.invalidateQueries({ queryKey: notificationKeys.starred() });
            window.dispatchEvent(new CustomEvent('all-notifications-cleared'));
        },
        onError: (error) => {
            console.error('Failed to clear all:', error);
            message.error(error?.response?.data?.message || 'Failed to clear notifications');
        },
    });
};

/**
 * Delete multiple notifications
 */
export const useDeleteMultipleNotifications = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (ids) => api.post('/notifications/delete-multiple', { notification_ids: ids }),
        onSuccess: () => {
            message.success('Notifications deleted');
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
            window.dispatchEvent(new CustomEvent('multiple-notifications-deleted'));
        },
        onError: (error) => {
            console.error('Failed to delete notifications:', error);
            message.error(error?.response?.data?.message || 'Failed to delete notifications');
        },
    });
};

// ==================== EXPORTS ====================
export default {
    // Queries
    useNotifications,
    useUnreadCount,
    useStarredNotifications,
    useNotificationsByType,
    useNotificationsByPriority,
    // Mutations
    useMarkNotificationRead,
    useDeleteNotification,
    useMarkAllRead,
    useToggleStar,
    useClearAllNotifications,
    useDeleteMultipleNotifications,
    // Keys
    notificationKeys,
};