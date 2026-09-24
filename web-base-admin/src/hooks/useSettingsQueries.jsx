// src/hooks/useSettingsQueries.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../services/api';
import {
    settingsAPI,
    userManagementAPI,
    auditAPI,
    deliveryZoneAPI,
    announcementAPI,
    backupConfigAPI,
    roleRestrictionsAPI,
    userAccountSettingsAPI,
    maintenanceAPI,
} from '../services/api';

// ==================== SETTINGS KEYS ====================
export const settingsKeys = {
    all: ['settings'],
    sections: () => [...settingsKeys.all, 'sections'],
    section: (section) => [...settingsKeys.sections(), section],
    users: () => ['users'],
    roles: () => ['roles'],
    auditLogs: () => ['audit-logs'],
    employeesWithoutAccounts: () => ['employees-without-accounts'],
    employeeForAccount: (id) => ['employee-for-account', id],
    staffSnapshot: () => ['settings', 'staff', 'snapshot'],
    superAdminSnapshot: () => ['settings', 'system', 'snapshot'],
    loginLogs: (params) => ['login-logs', params],
    backups: () => ['system', 'backups'],
    systemStatus: () => ['system', 'status'],
    deliveryZones: (params) => ['delivery-zones', params],
    announcements: () => ['system-announcements'],
    activeAnnouncements: () => ['system-announcements', 'active'],
    backupConfig: () => ['system-backup-config'],
    roleRestrictions: (roleSlug) => ['role-restrictions', roleSlug],
    userAccountSettings: () => ['user-account-settings'],
    maintenanceConfig: () => ['maintenance-config'],
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

// ==================== STAFF MANAGEMENT ====================
export const useStaffSnapshot = (options = {}) => {
    return useQuery({
        queryKey: settingsKeys.staffSnapshot(),
        queryFn: () => settingsAPI.getStaffSnapshot(),
        select: (response) => response?.data?.data || {},
        staleTime: 2 * 60 * 1000,
        enabled: options.enabled ?? true,
    });
};

export const useUpdateStaffGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ group, data }) => settingsAPI.updateStaffGroup(group, data),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Staff settings saved');
            queryClient.invalidateQueries({ queryKey: settingsKeys.staffSnapshot() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to save staff settings');
        },
    });
};

// ==================== SUPER ADMIN ====================
export const useSuperAdminSnapshot = (options = {}) => {
    return useQuery({
        queryKey: settingsKeys.superAdminSnapshot(),
        queryFn: () => settingsAPI.getSuperAdminSnapshot(),
        select: (response) => response?.data?.data || {},
        staleTime: 2 * 60 * 1000,
        enabled: options.enabled ?? true,
    });
};

export const useUpdateSystemGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ group, data }) => settingsAPI.updateSystemGroup(group, data),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'System settings saved');
            queryClient.invalidateQueries({ queryKey: settingsKeys.superAdminSnapshot() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to save system settings');
        },
    });
};

export const useLoginLogs = (params = {}, options = {}) => {
    return useQuery({
        queryKey: settingsKeys.loginLogs(params),
        queryFn: () => settingsAPI.getLoginLogs(params),
        select: (response) => response?.data?.data || { data: [], total: 0 },
        staleTime: 60 * 1000,
        enabled: options.enabled ?? true,
    });
};

// ==================== BACKUPS ====================
export const useBackups = (options = {}) => {
    return useQuery({
        queryKey: settingsKeys.backups(),
        queryFn: () => settingsAPI.listBackups(),
        select: (response) => response?.data?.data?.history || [],
        staleTime: 30 * 1000,
        enabled: options.enabled ?? true,
    });
};

export const useCreateBackup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => settingsAPI.createBackup(),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Backup created');
            queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to create backup');
        },
    });
};

export const useRestoreBackup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ filename, confirm }) => settingsAPI.restoreBackup(filename, confirm),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Database restored');
            queryClient.invalidateQueries();
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to restore backup');
        },
    });
};

export const useDeleteBackup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (filename) => settingsAPI.deleteBackup(filename),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Backup deleted');
            queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to delete backup');
        },
    });
};

export const useDownloadBackup = () => {
    return useMutation({
        mutationFn: (filename) => settingsAPI.downloadBackup(filename),
        onSuccess: (response, filename) => {
            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            message.success('Backup downloaded');
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to download backup');
        },
    });
};

// ==================== SYSTEM STATUS & MAINTENANCE ====================
export const useSystemStatus = (options = {}) => {
    return useQuery({
        queryKey: settingsKeys.systemStatus(),
        queryFn: () => settingsAPI.getSystemStatus(),
        select: (response) => response?.data?.data || {},
        staleTime: 30 * 1000,
        enabled: options.enabled ?? true,
    });
};

export const useClearSystemCache = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => settingsAPI.clearSystemCache(),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'System cache cleared');
            queryClient.invalidateQueries({ queryKey: settingsKeys.superAdminSnapshot() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.systemStatus() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to clear cache');
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

// ==================== EMPLOYEES WITHOUT ACCOUNTS ====================
export const useEmployeesWithoutAccounts = (params = {}, options = {}) => {
    return useQuery({
        queryKey: [...settingsKeys.employeesWithoutAccounts(), params],
        queryFn: () => userManagementAPI.getEmployeesWithoutAccounts(params),
        select: (response) => response?.data?.data || [],
        staleTime: 30 * 1000,
        enabled: options.enabled ?? true,
    });
};

export const useEmployeeForAccount = (employeeId, options = {}) => {
    return useQuery({
        queryKey: settingsKeys.employeeForAccount(employeeId),
        queryFn: () => userManagementAPI.getEmployeeForAccount(employeeId),
        select: (response) => response?.data?.data || null,
        enabled: !!employeeId,
        ...options,
    });
};

// ==================== USER MUTATIONS ====================
export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => {
            const endpoint = payload.employee_id
                ? userManagementAPI.createUserFromEmployee
                : userManagementAPI.createUser;
            return endpoint(payload);
        },
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Account created successfully');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.employeesWithoutAccounts() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to create account');
        },
    });
};

export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, data }) => userManagementAPI.updateUser(userId, data),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Account updated successfully');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to update account');
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

export const useBanUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId) => userManagementAPI.banUser(userId),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'User banned');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to ban user');
        },
    });
};

export const useUnbanUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId) => userManagementAPI.unbanUser(userId),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'User unbanned');
            queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to unban user');
        },
    });
};

export const useForceLogoutUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId) => userManagementAPI.forceLogoutUser(userId),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'User has been logged out from all devices');
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to force logout user');
        },
    });
};

export const useForceChangePassword = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, password, password_confirmation }) =>
            userManagementAPI.forceChangePassword(userId, { password, password_confirmation }),
        onSuccess: (response) => {
            message.success(response?.data?.message || 'Password changed successfully');
            queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs() });
        },
        onError: (error) => {
            message.error(error.response?.data?.message || 'Failed to change password');
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

// ==================== DELIVERY ZONES ====================
export const useDeliveryZones = (params = {}) =>
    useQuery({
        queryKey: settingsKeys.deliveryZones(params),
        queryFn: async () => {
            const res = await deliveryZoneAPI.getAll(params);
            return res?.data?.data || [];
        },
        staleTime: 2 * 60 * 1000,
    });

export const useCreateDeliveryZone = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deliveryZoneAPI.create,
        onSuccess: () => {
            message.success('Delivery location created');
            qc.invalidateQueries({ queryKey: ['delivery-zones'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to create location'),
    });
};

export const useUpdateDeliveryZone = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => deliveryZoneAPI.update(id, data),
        onSuccess: () => {
            message.success('Delivery location updated');
            qc.invalidateQueries({ queryKey: ['delivery-zones'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to update location'),
    });
};

export const useDeleteDeliveryZone = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deliveryZoneAPI.delete,
        onSuccess: () => {
            message.success('Delivery location deactivated');
            qc.invalidateQueries({ queryKey: ['delivery-zones'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to deactivate location'),
    });
};

export const useToggleDeliveryZone = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deliveryZoneAPI.toggleStatus,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-zones'] }),
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to toggle status'),
    });
};

// ==================== PUBLIC DELIVERY ZONES ====================
export const usePublicDeliveryZones = () =>
    useQuery({
        queryKey: ['public-delivery-zones'],
        queryFn: async () => {
            const res = await api.get('/public/delivery-zones');
            return res?.data?.data || [];
        },
        staleTime: 10 * 60 * 1000,
    });

// ==================== SYSTEM ANNOUNCEMENTS ====================
export const useAnnouncements = () =>
    useQuery({
        queryKey: settingsKeys.announcements(),
        queryFn: async () => {
            const res = await announcementAPI.getAll();
            return res?.data?.data || [];
        },
    });

export const useActiveAnnouncements = () =>
    useQuery({
        queryKey: settingsKeys.activeAnnouncements(),
        queryFn: async () => {
            const res = await announcementAPI.getActive();
            return res?.data?.data || [];
        },
        staleTime: 60 * 1000,
    });

export const useCreateAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: announcementAPI.create,
        onSuccess: () => {
            message.success('Announcement created');
            qc.invalidateQueries({ queryKey: ['system-announcements'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to create announcement'),
    });
};

export const useUpdateAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => announcementAPI.update(id, data),
        onSuccess: () => {
            message.success('Announcement updated');
            qc.invalidateQueries({ queryKey: ['system-announcements'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to update announcement'),
    });
};

export const useDeleteAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: announcementAPI.delete,
        onSuccess: () => {
            message.success('Announcement deleted');
            qc.invalidateQueries({ queryKey: ['system-announcements'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to delete announcement'),
    });
};

// ==================== BACKUP CONFIG ====================
export const useBackupConfig = () =>
    useQuery({
        queryKey: settingsKeys.backupConfig(),
        queryFn: async () => {
            const res = await backupConfigAPI.get();
            return res?.data?.data || {};
        },
    });

export const useUpdateBackupConfig = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: backupConfigAPI.update,
        onSuccess: () => {
            message.success('Backup configuration saved');
            qc.invalidateQueries({ queryKey: ['system-backup-config'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to save configuration'),
    });
};

// ==================== ROLE RESTRICTIONS ====================
export const useRoleRestrictions = (roleSlug) =>
    useQuery({
        queryKey: settingsKeys.roleRestrictions(roleSlug),
        queryFn: async () => {
            const res = await roleRestrictionsAPI.get(roleSlug);
            return res?.data?.data || {};
        },
        enabled: !!roleSlug,
    });

export const useUpdateRoleRestrictions = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ roleSlug, data }) => roleRestrictionsAPI.update(roleSlug, data),
        onSuccess: (_, v) => {
            message.success('Role restrictions saved');
            qc.invalidateQueries({ queryKey: ['role-restrictions', v.roleSlug] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to save restrictions'),
    });
};

// ==================== USER ACCOUNT SETTINGS ====================
export const useUserAccountSettings = () =>
    useQuery({
        queryKey: settingsKeys.userAccountSettings(),
        queryFn: async () => {
            const res = await userAccountSettingsAPI.get();
            return res?.data?.data || { customer: {}, admin: {} };
        },
    });

export const useUpdateUserAccountSettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: userAccountSettingsAPI.update,
        onSuccess: () => {
            message.success('User account settings saved');
            qc.invalidateQueries({ queryKey: ['user-account-settings'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to save settings'),
    });
};

// ==================== MAINTENANCE CONFIG ====================
export const useMaintenanceConfig = () =>
    useQuery({
        queryKey: settingsKeys.maintenanceConfig(),
        queryFn: async () => {
            const res = await maintenanceAPI.getConfig();
            return res?.data?.data || {};
        },
    });

export const useUpdateMaintenanceConfig = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: maintenanceAPI.updateConfig,
        onSuccess: () => {
            message.success('Maintenance configuration saved');
            qc.invalidateQueries({ queryKey: ['maintenance-config'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to save configuration'),
    });
};

export const useClearTempFiles = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: maintenanceAPI.clearTempFiles,
        onSuccess: (res) => {
            message.success(res?.data?.message || 'Temporary files cleared');
            qc.invalidateQueries({ queryKey: ['maintenance-config'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to clear files'),
    });
};

export const useRunDatabaseMaintenance = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: maintenanceAPI.runDatabaseMaintenance,
        onSuccess: (res) => {
            message.success(res?.data?.message || 'Database maintenance completed');
            qc.invalidateQueries({ queryKey: ['maintenance-config'] });
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to run maintenance'),
    });
};

export const useForceLogoutAll = () => {
    return useMutation({
        mutationFn: (data = {}) => maintenanceAPI.forceLogoutAll(data),
        onSuccess: (res) => {
            message.success(res?.data?.message || 'All sessions logged out');
        },
        onError: (e) => message.error(e?.response?.data?.message || 'Failed to force logout'),
    });
};

// ==================== DEFAULT EXPORT ====================
export default {
    // Settings
    useSettings,
    useSettingsSection,
    useUpdateSettingsSection,
    useStaffSnapshot,
    useUpdateStaffGroup,
    useSuperAdminSnapshot,
    useUpdateSystemGroup,
    useLoginLogs,
    useBackups,
    useCreateBackup,
    useRestoreBackup,
    useDeleteBackup,
    useDownloadBackup,
    useSystemStatus,
    useClearSystemCache,
    useUsers,
    useRoles,
    useEmployeesWithoutAccounts,
    useEmployeeForAccount,
    useCreateUser,
    useUpdateUser,
    useUpdateUserRole,
    useToggleUserActive,
    useBanUser,
    useUnbanUser,
    useForceLogoutUser,
    useForceChangePassword,
    useAuditLogs,
    useExportAuditLogs,
    useDeliveryZones,
    useCreateDeliveryZone,
    useUpdateDeliveryZone,
    useDeleteDeliveryZone,
    useToggleDeliveryZone,
    usePublicDeliveryZones,
    useAnnouncements,
    useActiveAnnouncements,
    useCreateAnnouncement,
    useUpdateAnnouncement,
    useDeleteAnnouncement,
    useBackupConfig,
    useUpdateBackupConfig,
    useRoleRestrictions,
    useUpdateRoleRestrictions,
    useUserAccountSettings,
    useUpdateUserAccountSettings,
    useMaintenanceConfig,
    useUpdateMaintenanceConfig,
    useClearTempFiles,
    useRunDatabaseMaintenance,
    useForceLogoutAll,
    // Keys
    settingsKeys,
};