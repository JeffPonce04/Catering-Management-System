import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../services/api';

export const userKeys = {
  all: ['users'],
  lists: () => ['users', 'list'],
  list: (filters) => ['users', 'list', { filters }],
  details: () => ['users', 'detail'],
  detail: (id) => ['users', 'detail', id],
  permissions: (id) => ['users', 'permissions', id],
  loginHistory: (id) => ['users', 'login-history', id],
};

export const roleKeys = {
  all: ['roles'],
  list: () => ['roles', 'list'],
};

export const auditKeys = {
  all: ['audit-logs'],
  list: (filters) => ['audit-logs', { filters }],
};

const unwrap = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback;

export const useUsers = (filters = {}) => useQuery({
  queryKey: userKeys.list(filters),
  queryFn: async () => unwrap(await api.get('/users', { params: filters }), {
    data: [], total: 0, current_page: 1, last_page: 1, per_page: 15,
  }),
  staleTime: 5 * 60 * 1000,
  placeholderData: (previousData) => previousData,
});

export const useUser = (id) => useQuery({
  queryKey: userKeys.detail(id),
  queryFn: async () => unwrap(await api.get(`/users/${id}`), {}),
  enabled: Boolean(id),
  staleTime: 5 * 60 * 1000,
});

export const useUserPermissions = (id) => useQuery({
  queryKey: userKeys.permissions(id),
  queryFn: async () => {
    const user = unwrap(await api.get(`/users/${id}`), {});
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.reduce((permissions, role) => {
      const rolePermissions = Array.isArray(role?.permissions) ? role.permissions : [];
      rolePermissions.forEach((permission) => {
        const key = permission?.slug || permission?.name || permission;
        if (key) permissions[key] = true;
      });
      return permissions;
    }, {});
  },
  enabled: Boolean(id),
  staleTime: 2 * 60 * 1000,
});

export const useUserLoginHistory = (id) => useQuery({
  queryKey: userKeys.loginHistory(id),
  queryFn: async () => {
    const payload = unwrap(await api.get('/audit-logs', {
      params: { user_id: id, module: 'auth', per_page: 100 },
    }), {});
    return Array.isArray(payload?.data) ? payload.data : [];
  },
  enabled: Boolean(id),
  staleTime: 60 * 1000,
});

export const useRoles = () => useQuery({
  queryKey: roleKeys.list(),
  queryFn: async () => {
    const payload = unwrap(await api.get('/roles'), []);
    return Array.isArray(payload) ? payload : [];
  },
  staleTime: 10 * 60 * 1000,
});

export const useAuditLogs = (filters = {}) => useQuery({
  queryKey: auditKeys.list(filters),
  queryFn: async () => unwrap(await api.get('/audit-logs', { params: filters }), {
    data: [], total: 0, current_page: 1, last_page: 1, per_page: 20,
  }),
  staleTime: 60 * 1000,
  placeholderData: (previousData) => previousData,
});

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => {
      message.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => message.error(error?.response?.data?.message || 'Failed to create user'),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      if (data?.role_slug) return api.put(`/users/${id}/role`, { role_slug: data.role_slug });
      if (typeof data?.is_active === 'boolean') return api.post(`/users/${id}/toggle-active`);
      throw new Error('The existing API supports user role and active-status updates only.');
    },
    onSuccess: (_, variables) => {
      message.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
    },
    onError: (error) => message.error(error?.response?.data?.message || error?.message || 'Failed to update user'),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // The current backend exposes deactivation rather than a user-delete endpoint.
    mutationFn: (id) => api.post(`/users/${id}/toggle-active`),
    onSuccess: () => {
      message.success('User account deactivated');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => message.error(error?.response?.data?.message || 'Failed to deactivate user'),
  });
};

export const useUpdateUserPermissions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permission_ids }) => {
      if (!roleId) throw new Error('A role ID is required to update permissions.');
      return api.put(`/roles/${roleId}`, { permission_ids });
    },
    onSuccess: () => {
      message.success('Role permissions updated successfully');
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => message.error(error?.response?.data?.message || error?.message || 'Failed to update permissions'),
  });
};

export const useForcePasswordReset = () => useMutation({
  mutationFn: (employeeId) => api.post(`/employees/${employeeId}/force-password-reset`),
  onSuccess: () => message.success('Password reset required for the selected employee'),
  onError: (error) => message.error(error?.response?.data?.message || 'Failed to require password reset'),
});

export const useBlockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId) => api.post(`/employees/${employeeId}/block`),
    onSuccess: () => {
      message.success('User blocked successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => message.error(error?.response?.data?.message || 'Failed to block user'),
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId) => api.post(`/employees/${employeeId}/unblock`),
    onSuccess: () => {
      message.success('User unblocked successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => message.error(error?.response?.data?.message || 'Failed to unblock user'),
  });
};

export const useBulkImportUsers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/employees/bulk-import', data),
    onSuccess: () => {
      message.success('Employee accounts imported successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => message.error(error?.response?.data?.message || 'Failed to import employee accounts'),
  });
};
