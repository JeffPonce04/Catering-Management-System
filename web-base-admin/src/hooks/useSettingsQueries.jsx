// src/hooks/useSettingsQueries.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { settingsAPI, userManagementAPI, auditAPI } from '../services/api';

// ==================== SETTINGS KEYS ====================
export const settingsKeys = {
    all: ['settings'],
    sections: () => [...settingsKeys.all, 'sections'],
    section: (section) => [...settingsKeys.sections(), section],
    users: () => ['users'],
    roles: () => ['roles'],
    auditLogs: () => ['audit-logs'],
};

// ==================== SETTINGS QUERIES ====================
export const useSettings = (options = {}) => {
    return useQuery({
        queryKey: settingsKeys.all,
        queryFn: () => settingsAPI.getSettings(),
        select: (response) => response?.data?.data || {},
        staleTime: 5 * 60 * 1000,
        enabled: options.enabled ?? true,
    });
};

export const useSettingsSection = (section) => {
    return useQuery({
        queryKey: settingsKeys.section(section),
        queryFn: () => settingsAPI.getSection(section),
        select: (response) => response?.data?.data || {},
        enabled: !!section,
        staleTime: 5 * 60 * 1000,
    });
};

// ==================== SETTINGS MUTATIONS ====================
export const useUpdateSettingsSection = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ section, data }) => settingsAPI.updateSection(section, data),
        onSuccess: (response, variables) => {
            message.success(response?.data?.message || `${variables.section} settings saved successfully`);
            queryClient.invalidateQueries({ queryKey: settingsKeys.section(variables.section) });
            queryClient.invalidateQueries({ queryKey: settingsKeys.all });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to save settings');
        },
    });
};

// ==================== USER QUERIES ====================
export const useUsers = (params = {}) => {
    return useQuery({
        queryKey: [...settingsKeys.users(), params],
        queryFn: () => userManagementAPI.getUsers(params),
        select: (response) => response?.data?.data || { data: [], total: 0 },
        staleTime: 2 * 60 * 1000,
    });
};

export const useRoles = () => {
    return useQuery({
        queryKey: settingsKeys.roles(),
        queryFn: () => userManagementAPI.getRoles(),
        select: (response) => response?.data?.data || [],
        staleTime: 10 * 60 * 1000,
    });
};

// ==================== USER MUTATIONS ====================
export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => userManagementAPI.createUser(data),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Account created successfully');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to create account');
        },
    });
};

export const useUpdateUserRole = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ userId, roleSlug }) => userManagementAPI.updateUserRole(userId, roleSlug),
        onSuccess: () => {
            message.success('User role updated successfully');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to update user role');
        },
    });
};

export const useToggleUserActive = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (userId) => userManagementAPI.toggleUserActive(userId),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'User status toggled');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to toggle user status');
        },
    });
};

// ==================== AUDIT LOG QUERIES ====================
export const useAuditLogs = (params = {}) => {
    return useQuery({
        queryKey: [...settingsKeys.auditLogs(), params],
        queryFn: () => auditAPI.getAuditLogs(params),
        select: (response) => response?.data?.data || { data: [], total: 0 },
        staleTime: 1 * 60 * 1000,
        refetchInterval: 30000,
    });
};

export const useExportAuditLogs = () => {
    return useMutation({
        mutationFn: (params) => auditAPI.exportAuditLogs(params),
        onSuccess: (response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Audit logs exported successfully');
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to export audit logs');
        },
    });
};