import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api, { inventoryAPI } from '../services/api';

const LIST_STALE_TIME = 60 * 1000;

const bodyOf = (response) => response?.data ?? {};
const singleOf = (response, fallback = null) => bodyOf(response)?.data ?? fallback;
const listOf = (response) => {
  const body = bodyOf(response);
  const data = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.data?.data)
      ? body.data.data
      : [];
  const pagination = body?.pagination ?? body?.data?.pagination ?? {};

  return {
    data,
    total: Number(pagination.total ?? data.length),
    current_page: Number(pagination.current_page ?? 1),
    last_page: Number(pagination.last_page ?? 1),
    per_page: Number(pagination.per_page ?? (data.length || 20)),
    pagination,
  };
};

const apiError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

export const inventoryKeys = {
  products: ['inventory', 'products'],
  equipment: ['inventory', 'equipment'],
  movements: ['inventory', 'movements'],
  waste: ['inventory', 'waste'],
  purchaseRequests: ['inventory', 'purchase-requests'],
  purchaseSuggestions: ['inventory', 'purchase-suggestions'],
  suppliers: ['inventory', 'suppliers'],
  reservations: ['inventory', 'reservations'],
  maintenance: ['inventory', 'maintenance'],
  dashboard: ['inventory', 'dashboard'],
  lowStock: ['inventory', 'low-stock'],
  expiringSoon: ['inventory', 'expiring-soon'],
  stockValue: ['inventory', 'stock-value'],
  summary: ['inventory', 'summary'],
  warnings: ['inventory', 'equipment-warnings'],
};

const listKey = (root, filters) => [...root, filters];

const invalidateInventory = (queryClient, roots) => {
  roots.forEach((root) => queryClient.invalidateQueries({ queryKey: root }));
};

export const useProducts = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.products, filters),
  queryFn: () => inventoryAPI.getProducts(filters),
  select: listOf,
  staleTime: LIST_STALE_TIME,
});

export const useProduct = (id) => useQuery({
  queryKey: [...inventoryKeys.products, id],
  queryFn: () => inventoryAPI.getProduct(id),
  select: (response) => singleOf(response, {}),
  enabled: Boolean(id),
});

export const useProductStats = () => useQuery({
  queryKey: [...inventoryKeys.products, 'stats'],
  queryFn: inventoryAPI.getProductStats,
  select: (response) => singleOf(response, {}),
});

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.createProduct,
    onSuccess: () => {
      message.success('Product created successfully');
      invalidateInventory(queryClient, [inventoryKeys.products, inventoryKeys.dashboard, inventoryKeys.lowStock]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to create product')),
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.updateProduct(id, data),
    onSuccess: () => {
      message.success('Product updated successfully');
      invalidateInventory(queryClient, [inventoryKeys.products, inventoryKeys.dashboard, inventoryKeys.lowStock]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to update product')),
  });
};

export const useSetProductActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => inventoryAPI.updateProduct(id, { is_active: active }),
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: inventoryKeys.products });
      const snapshots = queryClient.getQueriesData({ queryKey: inventoryKeys.products });
      snapshots.forEach(([key, value]) => {
        const responseBody = value?.data;
        const rows = Array.isArray(responseBody?.data)
          ? responseBody.data
          : Array.isArray(responseBody?.data?.data)
            ? responseBody.data.data
            : null;

        if (!rows) return;

        const updatedRows = rows.map((item) => item.id === id
          ? { ...item, is_active: active, active, product_status: active ? 'Active' : 'Not Active' }
          : item);

        queryClient.setQueryData(key, {
          ...value,
          data: Array.isArray(responseBody.data)
            ? { ...responseBody, data: updatedRows }
            : { ...responseBody, data: { ...responseBody.data, data: updatedRows } },
        });
      });
      return { snapshots };
    },
    onError: (error, _variables, context) => {
      context?.snapshots?.forEach(([key, value]) => queryClient.setQueryData(key, value));
      message.error(apiError(error, 'Failed to change product status'));
    },
    onSuccess: (_response, { active }) => message.success(`Product ${active ? 'activated' : 'deactivated'} successfully`),
    onSettled: () => invalidateInventory(queryClient, [inventoryKeys.products, inventoryKeys.dashboard]),
  });
};

export const useEquipment = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.equipment, filters),
  queryFn: () => inventoryAPI.getEquipment(filters),
  select: listOf,
  staleTime: LIST_STALE_TIME,
});

export const useEquipmentItem = (id) => useQuery({
  queryKey: [...inventoryKeys.equipment, id],
  queryFn: () => inventoryAPI.getEquipmentItem(id),
  select: (response) => singleOf(response, {}),
  enabled: Boolean(id),
});

export const useEquipmentStats = () => useQuery({
  queryKey: [...inventoryKeys.equipment, 'stats'],
  queryFn: inventoryAPI.getEquipmentStats,
  select: (response) => singleOf(response, {}),
});

export const useEquipmentHistory = (id) => useQuery({
  queryKey: [...inventoryKeys.equipment, id, 'history'],
  queryFn: () => inventoryAPI.getEquipmentHistory(id),
  select: (response) => singleOf(response, []),
  enabled: Boolean(id),
});

export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.createEquipment,
    onSuccess: () => {
      message.success('Equipment created successfully');
      invalidateInventory(queryClient, [inventoryKeys.equipment, inventoryKeys.dashboard]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to create equipment')),
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.updateEquipment(id, data),
    onSuccess: () => {
      message.success('Equipment updated successfully');
      invalidateInventory(queryClient, [inventoryKeys.equipment, inventoryKeys.dashboard, inventoryKeys.maintenance]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to update equipment')),
  });
};

export const useSetEquipmentActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => inventoryAPI.updateEquipment(id, { is_active: active }),
    onSuccess: (_response, { active }) => message.success(`Equipment ${active ? 'activated' : 'deactivated'} successfully`),
    onError: (error) => message.error(apiError(error, 'Failed to change equipment status')),
    onSettled: () => invalidateInventory(queryClient, [inventoryKeys.equipment, inventoryKeys.dashboard]),
  });
};

export const useInventoryMovements = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.movements, filters),
  queryFn: () => inventoryAPI.getMovements(filters),
  select: listOf,
  staleTime: 30 * 1000,
});

export const useRecordMovement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.recordMovement,
    onSuccess: () => {
      message.success('Stock movement recorded successfully');
      invalidateInventory(queryClient, [inventoryKeys.movements, inventoryKeys.products, inventoryKeys.dashboard, inventoryKeys.lowStock]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to record stock movement')),
  });
};

export const useWasteRecords = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.waste, filters),
  queryFn: () => inventoryAPI.getWasteRecords(filters),
  select: listOf,
  staleTime: 30 * 1000,
});

export const useRecordWaste = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.recordWaste,
    onSuccess: () => {
      message.success('Waste recorded successfully');
      invalidateInventory(queryClient, [inventoryKeys.waste, inventoryKeys.movements, inventoryKeys.products, inventoryKeys.dashboard]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to record waste')),
  });
};

export const useSuppliers = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.suppliers, filters),
  queryFn: () => inventoryAPI.getSuppliers(filters),
  select: listOf,
  staleTime: LIST_STALE_TIME,
});

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.createSupplier,
    onSuccess: () => {
      message.success('Supplier created successfully');
      invalidateInventory(queryClient, [inventoryKeys.suppliers]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to create supplier')),
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.updateSupplier(id, data),
    onSuccess: () => {
      message.success('Supplier updated successfully');
      invalidateInventory(queryClient, [inventoryKeys.suppliers, inventoryKeys.products]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to update supplier')),
  });
};

export const useSetSupplierActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => inventoryAPI.updateSupplier(id, { is_active: active }),
    onSuccess: (_response, { active }) => message.success(`Supplier ${active ? 'activated' : 'deactivated'} successfully`),
    onError: (error) => message.error(apiError(error, 'Failed to change supplier status')),
    onSettled: () => invalidateInventory(queryClient, [inventoryKeys.suppliers]),
  });
};

export const usePurchaseRequests = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.purchaseRequests, filters),
  queryFn: () => inventoryAPI.getPurchaseRequests(filters),
  select: listOf,
  staleTime: 30 * 1000,
});

export const usePurchaseSuggestions = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.purchaseSuggestions, filters),
  queryFn: () => inventoryAPI.getPurchaseSuggestions(filters),
  select: (response) => singleOf(response, []),
  staleTime: 30 * 1000,
});

export const useCreatePurchaseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.createPurchaseRequest,
    onSuccess: () => {
      message.success('Purchase request created successfully');
      invalidateInventory(queryClient, [inventoryKeys.purchaseRequests, inventoryKeys.purchaseSuggestions, inventoryKeys.dashboard]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to create purchase request')),
  });
};

export const useUpdatePurchaseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.updatePurchaseRequest(id, data),
    onSuccess: () => {
      message.success('Purchase request updated successfully');
      invalidateInventory(queryClient, [inventoryKeys.purchaseRequests, inventoryKeys.purchaseSuggestions, inventoryKeys.dashboard]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to update purchase request')),
  });
};

export const useEquipmentReservations = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.reservations, filters),
  queryFn: () => inventoryAPI.getEquipmentReservations(filters),
  select: listOf,
  staleTime: 30 * 1000,
});

export const useCreateEquipmentReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.createEquipmentReservation,
    onSuccess: () => {
      message.success('Equipment reserved successfully');
      invalidateInventory(queryClient, [inventoryKeys.reservations, inventoryKeys.equipment, inventoryKeys.movements, inventoryKeys.dashboard]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to reserve equipment')),
  });
};

export const useUpdateEquipmentReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.updateEquipmentReservation(id, data),
    onSuccess: () => {
      message.success('Reservation updated successfully');
      invalidateInventory(queryClient, [inventoryKeys.reservations, inventoryKeys.equipment, inventoryKeys.movements]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to update reservation')),
  });
};

export const useReturnEquipmentReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.checkInEquipmentReservation(id, data),
    onSuccess: () => {
      message.success('Equipment returned successfully');
      invalidateInventory(queryClient, [inventoryKeys.reservations, inventoryKeys.equipment, inventoryKeys.movements, inventoryKeys.dashboard]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to return equipment')),
  });
};

export const useMaintenanceRecords = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.maintenance, filters),
  queryFn: () => inventoryAPI.getMaintenanceRecords(filters),
  select: listOf,
  staleTime: 30 * 1000,
});

export const useCreateMaintenance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.createMaintenanceRecord,
    onSuccess: () => {
      message.success('Maintenance record created successfully');
      invalidateInventory(queryClient, [inventoryKeys.maintenance, inventoryKeys.equipment]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to create maintenance record')),
  });
};

export const useUpdateMaintenance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => inventoryAPI.updateMaintenanceRecord(id, data),
    onSuccess: () => {
      message.success('Maintenance record updated successfully');
      invalidateInventory(queryClient, [inventoryKeys.maintenance, inventoryKeys.equipment]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to update maintenance record')),
  });
};

export const useCancelMaintenance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryAPI.cancelMaintenanceRecord,
    onSuccess: () => {
      message.success('Maintenance record cancelled');
      invalidateInventory(queryClient, [inventoryKeys.maintenance]);
    },
    onError: (error) => message.error(apiError(error, 'Failed to cancel maintenance record')),
  });
};

export const useInventoryDashboardStats = () => useQuery({
  queryKey: inventoryKeys.dashboard,
  queryFn: inventoryAPI.getDashboardStats,
  select: (response) => singleOf(response, {}),
  staleTime: 30 * 1000,
  refetchInterval: 60 * 1000,
});

export const useLowStockItems = (filters = {}) => useQuery({
  queryKey: listKey(inventoryKeys.lowStock, filters),
  queryFn: () => api.get('/inventory/low-stock', { params: filters }),
  select: listOf,
});

export const useExpiringSoonItems = () => useQuery({
  queryKey: inventoryKeys.expiringSoon,
  queryFn: () => api.get('/inventory/expiring-soon'),
  select: (response) => singleOf(response, []),
});

export const useStockValue = () => useQuery({
  queryKey: inventoryKeys.stockValue,
  queryFn: () => api.get('/inventory/stock-value'),
  select: (response) => singleOf(response, { total_value: 0, by_category: [] }),
});

export const useInventorySummary = () => useQuery({
  queryKey: inventoryKeys.summary,
  queryFn: inventoryAPI.getInventorySummary,
  select: (response) => singleOf(response, {}),
});

export const useEquipmentWarnings = () => useQuery({
  queryKey: inventoryKeys.warnings,
  queryFn: inventoryAPI.getEquipmentWarnings,
  select: (response) => singleOf(response, []),
});

export const useItemHistory = (type, id) => useQuery({
  queryKey: ['inventory', 'history', type, id],
  queryFn: () => inventoryAPI.getItemHistory(type, id),
  select: (response) => singleOf(response, []),
  enabled: Boolean(id),
});
