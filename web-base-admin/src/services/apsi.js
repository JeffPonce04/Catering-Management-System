Try AI directly in your favorite apps … Use Gemini to generate drafts and refine content, plus get Gemini Pro with access to Google's next-gen AI for ₱1,100 ₱0 for 1 month
// src/services/api.js - Updated version with improved staffAPI methods

import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// ==================== HELPER FUNCTIONS ====================
// Helper function to ensure data is always an array
export const ensureArray = (data) => {
  if (!data) return [];
  
  // If it's already an array, return it
  if (Array.isArray(data)) {
    return data;
  
  } else if (data && typeof data === 'object') {
    // If it's an object with a data property that's an array
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    // If it's an object with items property that's an array
    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }
    // If it's an object with results property that's an array
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    // If it's an object with records property that's an array
    if (data.records && Array.isArray(data.records)) {
      return data.records;
    }
    // If it's a single object, wrap it in an array
    if (data.id || data._id || data.employee_id) {
      return [data];
    }
  }

  if (data && typeof data === 'object') {
    // Handle Laravel pagination structure { data: [...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Handle other common API response structures
    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    if (data.records && Array.isArray(data.records)) {
      return data.records;
    }

      // If it's a single object with an id, wrap it
    if (data.id || data._id || data.employee_id || data.department_id) {
      return [data];
    }
    
    // If it has a data property but it's not an array (maybe a single object)
    if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      return [data.data];
    }
  } 
   console.warn('ensureArray: Could not convert data to array:', data);
  return [];
};

// Helper function to clean and format data for API requests
const cleanData = (data) => {
  const cleaned = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
};

// Helper function to create FormData from object
const createFormData = (data, method = 'POST') => {
  const formData = new FormData();
  
  if (method === 'PUT' || method === 'PATCH') {
    formData.append('_method', method);
  }
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        // Handle arrays by JSON stringifying them
        formData.append(key, JSON.stringify(value));
      } else if (value instanceof File) {
        // Handle file uploads
        formData.append(key, value);
      } else if (typeof value === 'object') {
        // Handle nested objects
        formData.append(key, JSON.stringify(value));
      } else {
        // Handle primitive values
        formData.append(key, String(value));
      }
    }
  });
  
  return formData;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true,
  timeout: 30000 // 30 seconds timeout
});

// Request interceptor - adds token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 ${config.method.toUpperCase()} ${config.url}`, config.params || config.data);
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handles errors
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${response.config.method.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('session_token');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    }
    
    return Promise.reject(error);
  }
);

// ==================== USER MANAGEMENT API ====================
export const userAPI = {
  // Get all users
  getUsers: (params = {}) => api.get('/users', { params }),
  
  // Get user statistics
  getStats: () => api.get('/users/stats'),
  
  // Get single user
  getUser: (id) => api.get(`/users/${id}`),
  
  // Create new user
  createUser: (data) => {
    const cleanedData = cleanData(data);
    const formData = createFormData(cleanedData);
    return api.post('/users', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Update user
  updateUser: (id, data) => {
    const cleanedData = cleanData(data);
    const formData = createFormData(cleanedData, 'PUT');
    return api.post(`/users/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Delete user
  deleteUser: (id) => api.delete(`/users/${id}`),
  
  // Activate/Deactivate user
  toggleUserStatus: (id) => api.post(`/users/${id}/toggle-status`),
  
  // Update user roles
  updateRoles: (id, roles) => api.post(`/users/${id}/roles`, { roles }),
  
  // Update user permissions
  updatePermissions: (id, permissions) => api.post(`/users/${id}/permissions`, { permissions }),
  
  // Get user activity log
  getUserActivity: (id, params = {}) => api.get(`/users/${id}/activity`, { params }),
  
  // Bulk actions
  bulkDelete: (ids) => api.post('/users/bulk-delete', { ids }),
  bulkActivate: (ids) => api.post('/users/bulk-activate', { ids }),
  bulkDeactivate: (ids) => api.post('/users/bulk-deactivate', { ids }),
  
  // Export users
  exportUsers: (format = 'csv', params = {}) => 
    api.post('/users/export', { format, ...params }, { responseType: 'blob' }),
  
  // Import users
  importUsers: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// ==================== ROLE MANAGEMENT API ====================
export const roleAPI = {
  // Get all roles
  getRoles: (params = {}) => api.get('/roles', { params }),
  
  // Get single role
  getRole: (id) => api.get(`/roles/${id}`),
  
  // Create role
  createRole: (data) => api.post('/roles', data),
  
  // Update role
  updateRole: (id, data) => api.put(`/roles/${id}`, data),
  
  // Delete role
  deleteRole: (id) => api.delete(`/roles/${id}`),
  
  // Get role permissions
  getRolePermissions: (id) => api.get(`/roles/${id}/permissions`),
  
  // Update role permissions
  updatePermissions: (id, permissions) => api.post(`/roles/${id}/permissions`, { permissions }),
  
  // Get users with role
  getRoleUsers: (id) => api.get(`/roles/${id}/users`)
};

// ==================== PERMISSION MANAGEMENT API ====================
export const permissionAPI = {
  // Get all permissions
  getPermissions: (params = {}) => api.get('/permissions', { params }),
  
  // Get grouped permissions (by module)
  getGroupedPermissions: () => api.get('/permissions/grouped'),
  
  // Create permission
  createPermission: (data) => api.post('/permissions', data),
  
  // Update permission
  updatePermission: (id, data) => api.put(`/permissions/${id}`, data),
  
  // Delete permission
  deletePermission: (id) => api.delete(`/permissions/${id}`),
  
  // Sync permissions (for development)
  syncPermissions: () => api.post('/permissions/sync')
};

// ==================== INVENTORY API ====================
export const inventoryAPI = {
  // ========== CATEGORIES ==========
  getCategories: (params = {}) => api.get('/inventory/categories', { params }),
  getCategory: (id) => api.get(`/inventory/categories/${id}`),
  createCategory: (data) => api.post('/inventory/categories', data),
  updateCategory: (id, data) => api.put(`/inventory/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/inventory/categories/${id}`),
  getCategoryItems: (id) => api.get(`/inventory/categories/${id}/items`),
  
  // ========== UNITS ==========
  getUnits: (params = {}) => api.get('/inventory/units', { params }),
  getUnit: (id) => api.get(`/inventory/units/${id}`),
  createUnit: (data) => api.post('/inventory/units', data),
  updateUnit: (id, data) => api.put(`/inventory/units/${id}`, data),
  deleteUnit: (id) => api.delete(`/inventory/units/${id}`),
  
  // ========== SUPPLIERS ==========
  getSuppliers: (params = {}) => api.get('/inventory/suppliers', { params }),
  getSupplier: (id) => api.get(`/inventory/suppliers/${id}`),
  createSupplier: (data) => api.post('/inventory/suppliers', data),
  updateSupplier: (id, data) => api.put(`/inventory/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/inventory/suppliers/${id}`),
  getSupplierItems: (id) => api.get(`/inventory/suppliers/${id}/items`),
  
  // ========== WAREHOUSES ==========
  getWarehouses: (params = {}) => api.get('/inventory/warehouses', { params }),
  getWarehouse: (id) => api.get(`/inventory/warehouses/${id}`),
  createWarehouse: (data) => api.post('/inventory/warehouses', data),
  updateWarehouse: (id, data) => api.put(`/inventory/warehouses/${id}`, data),
  deleteWarehouse: (id) => api.delete(`/inventory/warehouses/${id}`),
  getWarehouseInventory: (id) => api.get(`/inventory/warehouses/${id}/inventory`),
  
  // ========== LOCATIONS ==========
  getLocations: (params = {}) => api.get('/inventory/locations', { params }),
  getLocation: (id) => api.get(`/inventory/locations/${id}`),
  createLocation: (data) => api.post('/inventory/locations', data),
  updateLocation: (id, data) => api.put(`/inventory/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`/inventory/locations/${id}`),
  getLocationInventory: (id) => api.get(`/inventory/locations/${id}/inventory`),
  
  // ========== PRODUCTS/ITEMS ==========
  getItems: (params = {}) => api.get('/inventory/items', { params }),
  getItem: (id) => api.get(`/inventory/items/${id}`),
  createItem: (data) => {
    const cleanedData = cleanData(data);
    const formData = createFormData(cleanedData);
    return api.post('/inventory/items', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateItem: (id, data) => {
    const cleanedData = cleanData(data);
    const formData = createFormData(cleanedData, 'PUT');
    return api.post(`/inventory/items/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteItem: (id) => api.delete(`/inventory/items/${id}`),
  
  // ========== STOCK MOVEMENTS ==========
  getStockMovements: (params = {}) => api.get('/inventory/stock-movements', { params }),
  getStockMovement: (id) => api.get(`/inventory/stock-movements/${id}`),
  createStockIn: (data) => api.post('/inventory/stock-in', data),
  createStockOut: (data) => api.post('/inventory/stock-out', data),
  createTransfer: (data) => api.post('/inventory/transfer', data),
  createAdjustment: (data) => api.post('/inventory/adjustment', data),
  
  // ========== BATCHES ==========
  getBatches: (params = {}) => api.get('/inventory/batches', { params }),
  getBatch: (id) => api.get(`/inventory/batches/${id}`),
  createBatch: (data) => api.post('/inventory/batches', data),
  updateBatch: (id, data) => api.put(`/inventory/batches/${id}`, data),
  deleteBatch: (id) => api.delete(`/inventory/batches/${id}`),
  getExpiringBatches: (days = 30) => 
    api.get('/inventory/batches/expiring', { params: { days } }),
  
  // ========== INVENTORY COUNTS ==========
  getCounts: (params = {}) => api.get('/inventory/counts', { params }),
  getCount: (id) => api.get(`/inventory/counts/${id}`),
  createCount: (data) => api.post('/inventory/counts', data),
  updateCount: (id, data) => api.put(`/inventory/counts/${id}`, data),
  deleteCount: (id) => api.delete(`/inventory/counts/${id}`),
  startCount: (id) => api.post(`/inventory/counts/${id}/start`),
  completeCount: (id, data) => api.post(`/inventory/counts/${id}/complete`, data),
  
  // ========== REPORTS & ANALYTICS ==========
  getInventoryValue: () => api.get('/inventory/reports/value'),
  getStockLevels: () => api.get('/inventory/reports/stock-levels'),
  getMovementReport: (params = {}) => api.get('/inventory/reports/movements', { params }),
  getTurnoverRate: (params = {}) => api.get('/inventory/reports/turnover', { params }),
  getSlowMoving: (params = {}) => api.get('/inventory/reports/slow-moving', { params }),
  getFastMoving: (params = {}) => api.get('/inventory/reports/fast-moving', { params }),
  getReorderReport: () => api.get('/inventory/reports/reorder'),
  getDeadStock: (days = 90) => api.get('/inventory/reports/dead-stock', { params: { days } }),
  
  // ========== ALERTS ==========
  getAlerts: () => api.get('/inventory/alerts'),
  getLowStockAlerts: () => api.get('/inventory/alerts/low-stock'),
  getExpiryAlerts: () => api.get('/inventory/alerts/expiring'),
  dismissAlert: (id) => api.post(`/inventory/alerts/${id}/dismiss`),
  
  // ========== BULK OPERATIONS ==========
  bulkDeleteItems: (ids) => api.post('/inventory/items/bulk-delete', { ids }),
  bulkUpdateStock: (data) => api.post('/inventory/items/bulk-update-stock', data),
  bulkTransfer: (data) => api.post('/inventory/bulk-transfer', data),
  
  // ========== EXPORT/IMPORT ==========
  exportInventory: (format = 'csv', params = {}) => 
    api.post('/inventory/export', { format, ...params }, { responseType: 'blob' }),
  importInventory: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/inventory/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // ========== DASHBOARD STATS ==========
  getDashboardStats: () => api.get('/inventory/dashboard/stats'),
  getRecentMovements: (limit = 10) => 
    api.get('/inventory/dashboard/recent-movements', { params: { limit } })
};

// ==================== STAFF API ====================
export const staffAPI = {
  // Departments
  getDepartments: (params = {}) => {
  // Add 'all' parameter to get all records without pagination
  const allParams = { ...params, all: true };
  return api.get('/staff/departments', { params: allParams });
},
  createDepartment: (data) => api.post('/staff/departments', data),
  updateDepartment: (id, data) => api.put(`/staff/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/staff/departments/${id}`),
  getDepartmentEmployees: (id) => api.get(`/staff/departments/${id}/employees`),
  getDepartmentPositions: (id) => api.get(`/staff/departments/${id}/positions`),

  // Positions
  getPositions: (params = {}) => {
  // Add 'all' parameter to get all records without pagination
  const allParams = { ...params, all: true };
  return api.get('/staff/positions', { params: allParams });
},
  createPosition: (data) => api.post('/staff/positions', data),
  updatePosition: (id, data) => api.put(`/staff/positions/${id}`, data),
  deletePosition: (id) => api.delete(`/staff/positions/${id}`),
  getPositionEmployees: (id) => api.get(`/staff/positions/${id}/employees`),

  // Employees - UPDATED with better handling
  getEmployees: (params = {}) => {
    // Clean params to remove undefined/null values
    const cleanParams = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });
    return api.get('/staff/employees', { params: cleanParams });
  },
  
  getEmployee: (id) => api.get(`/staff/employees/${id}`),
  
  createEmployee: (data) => {
    // Clean the data first
    const cleanedData = cleanData(data);
    
    // Create FormData with the cleaned data
    const formData = createFormData(cleanedData);
    
    // Log the data being sent (for debugging)
    if (process.env.NODE_ENV === 'development') {
      console.log('📤 Creating employee with data:', cleanedData);
      for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
      }
    }
    
    return api.post('/staff/employees', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

 updateEmployee: (id, data) => {
  // Clean the data first
  const cleanedData = cleanData(data);
  
  // Create FormData with the cleaned data
  const formData = createFormData(cleanedData, 'PUT');
  
  // Log the data being sent (for debugging)
  if (process.env.NODE_ENV === 'development') {
    console.log('📤 Updating employee with data:', cleanedData);
    for (let pair of formData.entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }
  }
    
    // Use POST with _method=PUT for file uploads
  return api.post(`/staff/employees/${id}`, formData, {
    headers: { 
      'Content-Type': 'multipart/form-data',
      'X-HTTP-Method-Override': 'PUT' // Some Laravel versions need this
    }
  });
},
  
  deleteEmployee: (id) => api.delete(`/staff/employees/${id}`),
  getEmployeeStats: () => api.get('/staff/employees/stats'),
  getEmployeesByDepartment: (deptId) => api.get(`/staff/employees/by-department/${deptId}`),
  bulkUpdateStatus: (data) => api.post('/staff/employees/bulk-status', data),
  bulkArchive: (data) => api.post('/staff/employees/bulk-archive', data),
  toggleBookmark: (id) => api.post(`/staff/employees/${id}/toggle-bookmark`),

  // Attendance
  getAttendance: (params = {}) => api.get('/staff/attendance', { params }),
  getTodayAttendance: () => api.get('/staff/attendance/today'),
  getAttendanceSummary: (params) => api.get('/staff/attendance/summary', { params }),
  checkIn: (data) => api.post('/staff/attendance/check-in', data),
  checkOut: (data) => api.post('/staff/attendance/check-out', data),
  markAttendance: (data) => api.post('/staff/attendance/mark', data),
  getEmployeeAttendance: (id) => api.get(`/staff/attendance/employee/${id}`),

  // Leaves
  getLeaves: (params = {}) => api.get('/staff/leaves', { params }),
  getLeaveSummary: (params) => api.get('/staff/leaves/summary', { params }),
  getPendingLeaves: () => api.get('/staff/leaves/pending'),
  createLeave: (data) => api.post('/staff/leaves', data),
  approveLeave: (id) => api.post(`/staff/leaves/${id}/approve`),
  rejectLeave: (id, data) => api.post(`/staff/leaves/${id}/reject`, data),
  cancelLeave: (id) => api.post(`/staff/leaves/${id}/cancel`),

  // Schedules
  getSchedules: (params = {}) => api.get('/staff/schedules', { params }),
  getWeekSchedule: (params) => api.get('/staff/schedules/week', { params }),
  getMonthSchedule: (params) => api.get('/staff/schedules/month', { params }),
  getEmployeeSchedules: (id) => api.get(`/staff/schedules/employee/${id}`),
  createSchedule: (data) => api.post('/staff/schedules', data),
  updateSchedule: (id, data) => api.put(`/staff/schedules/${id}`, data),
  deleteSchedule: (id) => api.delete(`/staff/schedules/${id}`),

  // Payroll
  getPayroll: (params = {}) => api.get('/staff/payroll', { params }),
  getPayrollPeriods: (params = {}) => api.get('/staff/payroll/periods', { params }),
  createPayrollPeriod: (data) => api.post('/staff/payroll/periods', data),
  getPayrollPeriod: (id) => api.get(`/staff/payroll/periods/${id}`),
  generatePayroll: (data) => api.post('/staff/payroll/generate', data),
  getEmployeePayroll: (id) => api.get(`/staff/payroll/employee/${id}`),
  getPayrollItem: (id) => api.get(`/staff/payroll/${id}`),
  processPayroll: (id) => api.post(`/staff/payroll/${id}/process`),
  markPayrollAsPaid: (id, data) => api.post(`/staff/payroll/${id}/pay`, data),
  generatePayslip: (id) => api.get(`/staff/payroll/${id}/payslip`),

  // Performance
  getPerformance: (params = {}) => api.get('/staff/performance', { params }),
  getEmployeePerformance: (id) => api.get(`/staff/performance/employee/${id}`),
  createPerformance: (data) => api.post('/staff/performance', data),
  updatePerformance: (id, data) => api.put(`/staff/performance/${id}`, data),
  deletePerformance: (id) => api.delete(`/staff/performance/${id}`),

  // Skills
  getEmployeeSkills: (id) => api.get(`/staff/skills/employee/${id}`),
  createSkill: (employeeId, data) => api.post(`/staff/skills/employee/${employeeId}`, data),
  updateSkill: (id, data) => api.put(`/staff/skills/${id}`, data),
  deleteSkill: (id) => api.delete(`/staff/skills/${id}`),

  // Certifications
  getEmployeeCertifications: (id) => api.get(`/staff/certifications/employee/${id}`),
  createCertification: (employeeId, data) => api.post(`/staff/certifications/employee/${employeeId}`, data),
  updateCertification: (id, data) => api.put(`/staff/certifications/${id}`, data),
  deleteCertification: (id) => api.delete(`/staff/certifications/${id}`),

  // Documents
  getEmployeeDocuments: (id) => api.get(`/staff/documents/employee/${id}`),
  uploadDocument: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return api.post('/staff/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteDocument: (id) => api.delete(`/staff/documents/${id}`),
  downloadDocument: (id) => api.get(`/staff/documents/${id}/download`, { responseType: 'blob' })
};

// ==================== PRODUCTS API ====================
export const productAPI = {
  getProducts: (params = {}) => api.get('/products', { params }),
  getStats: () => api.get('/products/stats'),
  getCategories: () => api.get('/products/categories'),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (data) => {
    const formattedData = {
      name: data.name,
      sku: data.sku || null,
      category: data.category,
      sub_category: data.sub_category || null,
      quantity: parseInt(data.quantity) || 0,
      unit: data.unit || 'pcs',
      min_stock: parseInt(data.min_stock) || 0,
      max_stock: parseInt(data.max_stock) || 0,
      reorder_point: parseInt(data.reorder_point) || 0,
      location: data.location || null,
      supplier: data.supplier || null,
      expiry_date: data.expiry_date || null,
      lead_time: parseInt(data.lead_time) || null,
      notes: data.notes || null
    };
    return api.post('/products', formattedData);
  },
  updateProduct: (id, data) => {
    const formattedData = {
      name: data.name,
      sku: data.sku,
      category: data.category,
      sub_category: data.sub_category,
      quantity: parseInt(data.quantity),
      unit: data.unit,
      min_stock: parseInt(data.min_stock),
      max_stock: parseInt(data.max_stock),
      reorder_point: parseInt(data.reorder_point),
      location: data.location,
      supplier: data.supplier,
      expiry_date: data.expiry_date,
      lead_time: parseInt(data.lead_time),
      notes: data.notes,
      active: data.active !== undefined ? data.active : true
    };
    return api.put(`/products/${id}`, formattedData);
  },
  deleteProduct: (id) => api.delete(`/products/${id}`),
  archiveProduct: (id) => api.post(`/products/${id}/archive`),
  restoreProduct: (id) => api.post(`/products/${id}/restore`),
  adjustStock: (id, data) => {
    const formattedData = {
      quantity: parseInt(data.quantity),
      reason: data.reason,
      type: data.type,
      notes: data.notes || null
    };
    return api.post(`/products/${id}/adjust-stock`, formattedData);
  },
};

// ==================== EQUIPMENT API ====================
export const equipmentAPI = {
  getEquipment: (params = {}) => api.get('/equipment', { params }),
  getStats: () => api.get('/equipment/stats'),
  getCategories: () => api.get('/equipment/categories'),
  getConditions: () => api.get('/equipment/conditions'),
  getEquipmentItem: (id) => api.get(`/equipment/${id}`),
  getEquipmentHistory: (id) => api.get(`/equipment/${id}/history`),
  createEquipment: (data) => {
    const formattedData = {
      name: data.name,
      category: data.category,
      sub_category: data.sub_category || data.subCategory || '',
      model: data.model || null,
      serial_number: data.serial_number || null,
      total_quantity: parseInt(data.total_quantity || data.totalQuantity) || 0,
      location: data.location || '',
      supplier: data.supplier || '',
      last_maintenance: data.last_maintenance || data.lastMaintenance || null,
      condition: data.condition || 'Good',
      notes: data.notes || ''
    };
    return api.post('/equipment', formattedData);
  },
  updateEquipment: (id, data) => {
    const formattedData = {
      name: data.name,
      category: data.category,
      sub_category: data.sub_category || data.subCategory || '',
      model: data.model || null,
      serial_number: data.serial_number || null,
      total_quantity: parseInt(data.total_quantity || data.totalQuantity) || 0,
      location: data.location || '',
      supplier: data.supplier || '',
      last_maintenance: data.last_maintenance || data.lastMaintenance || null,
      condition: data.condition || 'Good',
      notes: data.notes || '',
      active: data.active !== undefined ? data.active : true
    };
    return api.put(`/equipment/${id}`, formattedData);
  },
  deleteEquipment: (id) => api.delete(`/equipment/${id}`),
  archiveEquipment: (id) => api.post(`/equipment/${id}/archive`),
  restoreEquipment: (id) => api.post(`/equipment/${id}/restore`),
  markDamaged: (id, data) => {
    const formattedData = {
      quantity: parseInt(data.quantity) || 1,
      reason: data.reason || 'Marked as damaged'
    };
    return api.post(`/equipment/${id}/mark-damaged`, formattedData);
  },
  scheduleMaintenance: (id, data) => {
    const formattedData = {
      maintenance_date: data.maintenance_date,
      quantity: parseInt(data.quantity) || 1
    };
    return api.post(`/equipment/${id}/schedule-maintenance`, formattedData);
  },
  completeMaintenance: (id, data) => {
    const formattedData = {
      quantity: parseInt(data.quantity) || 0,
      notes: data.notes || ''
    };
    return api.post(`/equipment/${id}/complete-maintenance`, formattedData);
  },
};

// ==================== EVENTS API ====================
export const eventAPI = {
  getEvents: (params = {}) => api.get('/events', { params }),
  getStats: () => api.get('/events/stats'),
  getUpcoming: () => api.get('/events/upcoming'),
  getOngoing: () => api.get('/events/ongoing'),
  getCompleted: () => api.get('/events/completed'),
  getOverdue: () => api.get('/events/overdue'),
  getEvent: (id) => api.get(`/events/${id}`),
  getEventEquipment: (id) => api.get(`/events/${id}/equipment`),
  createEvent: (data) => {
    const equipment = (data.equipment || []).map(item => ({
      id: item.id,
      quantityOut: parseInt(item.quantityOut) || 1
    }));

    return api.post('/events', {
      eventName: data.eventName,
      eventLocation: data.eventLocation,
      dateOut: data.dateOut,
      expectedDateIn: data.expectedDateIn,
      personResponsible: data.personResponsible,
      contactNumber: data.contactNumber || '',
      notes: data.notes || '',
      equipment: equipment
    });
  },
  updateEvent: (id, data) => api.put(`/events/${id}`, data),
  cancelEvent: (id) => api.post(`/events/${id}/cancel`),
  deleteEvent: (id) => api.delete(`/events/${id}`),
  returnEquipment: (id, data) => {
    console.log('📤 API call - returnEquipment:', { id, data });
    
    if (!data.returns || !Array.isArray(data.returns)) {
      console.error('❌ Invalid returns data:', data);
      return Promise.reject(new Error('Invalid returns data'));
    }
    
    const formattedReturns = data.returns.map(item => ({
      equipment_id: item.equipment_id,
      returned: parseInt(item.returned) || 0,
      damaged: parseInt(item.damaged) || 0,
      missing: parseInt(item.missing) || 0
    }));
    
    console.log('📤 Formatted returns:', formattedReturns);
    
    return api.post(`/events/${id}/return`, { returns: formattedReturns });
  },
};

// ==================== HISTORY API ====================
export const historyAPI = {
  getRecentHistory: (params = {}) => api.get('/history/recent', { params }),
  getSummary: (params = {}) => api.get('/history/summary', { params }),
  getByDateRange: (startDate, endDate) => 
    api.get('/history/by-date', { params: { start_date: startDate, end_date: endDate } }),
  getByType: (type) => api.get(`/history/by-type/${type}`),
  getItemHistory: (type, id) => api.get(`/history/${type}/${id}`),
  getEventHistory: (eventId) => api.get(`/history/event/${eventId}`),
};

// ==================== DASHBOARD API ====================
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getAlerts: () => api.get('/dashboard/alerts'),
  getRecentActivity: (limit = 10) => 
    api.get('/dashboard/recent-activity', { params: { limit } }),
  getLowStock: () => api.get('/dashboard/low-stock'),
  getExpiringSoon: (days = 7) => 
    api.get('/dashboard/expiring-soon', { params: { days } }),
  getMaintenanceDue: (days = 7) => 
    api.get('/dashboard/maintenance-due', { params: { days } }),
  getPopularItems: (limit = 10) => 
    api.get('/dashboard/popular-items', { params: { limit } }),
  getMonthlySummary: (year, month) => 
    api.get('/dashboard/monthly-summary', { params: { year, month } }),
};

// ==================== REPORTS API ====================
export const reportAPI = {
  getInventoryReport: (params = {}) => api.get('/reports/inventory', { params }),
  getEquipmentUsageReport: (params = {}) => api.get('/reports/equipment-usage', { params }),
  getEventsReport: (params = {}) => api.get('/reports/events', { params }),
  getDamagedItemsReport: (params = {}) => api.get('/reports/damaged-items', { params }),
  exportData: (type, format = 'csv', params = {}) => 
    api.post('/reports/export', { type, format, ...params }, { responseType: 'blob' }),
};

// ==================== SEARCH API ====================
export const searchAPI = {
  searchAll: (query) => api.get('/search/all', { params: { q: query } }),
  searchProducts: (query) => api.get('/search/products', { params: { q: query } }),
  searchEquipment: (query) => api.get('/search/equipment', { params: { q: query } }),
  searchEvents: (query) => api.get('/search/events', { params: { q: query } }),
  searchUsers: (query) => api.get('/search/users', { params: { q: query } }),
  searchInventory: (query) => api.get('/search/inventory', { params: { q: query } }),
};

// ==================== AUTH API ====================
export const authAPI = {
  sendOtp: (data) => api.post('/auth/send-otp', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (data) => api.post('/auth/resend-otp', data),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getUser: () => api.get('/auth/user'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// ==================== ERROR HANDLER ====================
export const handleApiError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    
    if (status === 422 && data.errors) {
      const errorMessages = [];
      Object.keys(data.errors).forEach(field => {
        errorMessages.push(`${field}: ${data.errors[field].join(', ')}`);
      });
      return {
        success: false,
        message: data.message || 'Validation failed',
        errors: data.errors,
        errorMessages: errorMessages
      };
    }
    
    const statusMessages = {
      400: 'Bad request',
      401: 'Session expired. Please login again.',
      403: 'You do not have permission.',
      404: 'Resource not found.',
      405: 'Method not allowed.',
      408: 'Request timeout.',
      409: 'Conflict with existing data.',
      413: 'File too large.',
      415: 'Unsupported media type.',
      422: 'Validation failed.',
      429: 'Too many requests. Please try again later.',
      500: 'Server error. Please try again later.',
      502: 'Bad gateway.',
      503: 'Service unavailable.',
      504: 'Gateway timeout.'
    };
    
    return {
      success: false,
      message: data.message || statusMessages[status] || 'An error occurred',
      errors: data.errors || {},
      status: status
    };
    
  } else if (error.request) {
    return {
      success: false,
      message: 'Network error. Please check your internet connection.',
      errors: {},
      isNetworkError: true
    };
  } else {
    return {
      success: false,
      message: error.message || 'An unexpected error occurred',
      errors: {}
    };
  }
};

// ==================== RESPONSE FORMATTER ====================
export const formatResponse = (response) => {
  return {
    success: response.data.success,
    data: response.data.data,
    message: response.data.message || 'Operation successful',
    meta: response.data.meta || null
  };
};

// ==================== HEALTH CHECK ====================
export const healthCheck = () => api.get('/health');


export default api;