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
                 enabled: typeof window !== 'undefined'
            ? Boolean(localStorage.getItem('auth_token'))
            : false,
        staleTime: 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
            // ⭐ Single endpoint only — NO fallback.
            //    Backend route: GET /v1/notifications/unread-count
            const response = await api.get('/notifications/unread-count');

            const count =
                response?.data?.data?.count ??
                response?.data?.count ??
                response?.data?.unread_count ??
                0;

            return Math.max(0, parseInt(count) || 0);
        },
        enabled: typeof window !== 'undefined'
            ? Boolean(localStorage.getItem('auth_token'))
            : false,
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
        throwOnError: false,
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
        enabled: typeof window !== 'undefined'
            ? Boolean(localStorage.getItem('auth_token'))
            : false,
        staleTime: 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
            enabled: Boolean(type) && (
            typeof window !== 'undefined'
                ? Boolean(localStorage.getItem('auth_token'))
                : false
        ),
        staleTime: 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
               enabled: Boolean(priority) && (
            typeof window !== 'undefined'
                ? Boolean(localStorage.getItem('auth_token'))
                : false
        ),
        staleTime: 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
                // A single invalidate on ['notifications'] covers list, unread, starred…
                queryClient.invalidateQueries({ queryKey: notificationKeys.all });
                // Trigger custom event for other components (Navigation listeners
                // will NOT invalidate again — they just update local UI state)
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
            // ⭐ Single invalidate — 'all' prefix-matches every notification query
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
            // ⭐ Single invalidate — covers unread + list + starred
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
            // ⭐ Single invalidate — covers starred + list + unread
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
            // ⭐ Single invalidate — 'all' covers unread + starred + list
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
            // ⭐ Single invalidate — covers unread + list + starred
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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