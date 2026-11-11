// src/hooks/useStaffQueries.js
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { staffAPI, departmentAPI, positionAPI, salaryGradeAPI } from '../services/api';

export const useEmployees = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ['employees', filters],
    queryFn: () => staffAPI.getEmployees(filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,   // ✅ Smooth pagination — no blank flicker
    refetchOnWindowFocus: false,        // ✅ Don't refetch when user switches tabs
    refetchOnMount: false,              // ✅ Trust cache on mount (staleTime already handles freshness)
    enabled: options.enabled !== false, // ✅ Allows conditional fetch — used by Master List
  });
export const useEmployeeStats = () =>
  useQuery({
    queryKey: ['employee-stats'],
    queryFn: async () => {
      const res = await staffAPI.getEmployeeStats();
      // Unwrap possible nesting: { data }, { data: { data } }, or flat
      return res?.data?.data ?? res?.data ?? res ?? {};
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useArchivedEmployees = () =>
  useQuery({
    queryKey: ['archived-employees'],
    queryFn: () => staffAPI.getArchivedEmployees(),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

export const useDepartments = () =>
  useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentAPI.getAll(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const usePositions = () =>
  useQuery({
    queryKey: ['positions'],
    queryFn: () => positionAPI.getAll(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useSalaryGrades = () =>
  useQuery({
    queryKey: ['salary-grades'],
    queryFn: () => salaryGradeAPI.getAll(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => staffAPI.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-stats'] });
    },
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => staffAPI.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-stats'] });
    },
  });
};

export const useBulkUpdateStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // staffAPI.bulkUpdateStatus accepts one payload object, not two positional arguments.
    mutationFn: ({ ids, status }) => staffAPI.bulkUpdateStatus({ ids, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-stats'] });
      queryClient.invalidateQueries({ queryKey: ['archived-employees'] });
    },
  });
};

export const useToggleBookmark = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => staffAPI.toggleBookmark(id),
    // ✅ Optimistic update — instant star toggle, no waiting for server
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['employees'] });
      const previous = queryClient.getQueriesData({ queryKey: ['employees'] });

      queryClient.setQueriesData({ queryKey: ['employees'] }, (old) => {
        if (!old) return old;
        const patch = (list) =>
          Array.isArray(list)
            ? list.map((emp) =>
                (emp.id || emp.employee_id) === id
                  ? { ...emp, is_bookmarked: !emp.is_bookmarked }
                  : emp
              )
            : list;

        if (Array.isArray(old)) return patch(old);
        if (old.data && Array.isArray(old.data)) return { ...old, data: patch(old.data) };
        if (old.data?.data && Array.isArray(old.data.data))
          return { ...old, data: { ...old.data, data: patch(old.data.data) } };
        return old;
      });

      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback on failure
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    // ✅ No invalidation needed — we already have the fresh state locally
  });
};

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => departmentAPI.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => departmentAPI.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => departmentAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useCreatePosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => positionAPI.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions'] }),
  });
};

export const useUpdatePosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => positionAPI.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions'] }),
  });
};

export const useDeletePosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => positionAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions'] }),
  });
};

export const useCreateSalaryGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => salaryGradeAPI.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary-grades'] }),
  });
};

export const useUpdateSalaryGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => salaryGradeAPI.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary-grades'] }),
  });
};

export const useDeleteSalaryGrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => salaryGradeAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary-grades'] }),
  });
};
