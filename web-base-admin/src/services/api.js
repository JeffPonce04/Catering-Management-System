// src/services/api.js - Complete Fixed Version

import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// ==================== HELPER FUNCTIONS ====================

/**
 * Ensures data is always returned as an array
 * @param {any} data - The data to convert to array
 * @returns {Array} - Always returns an array
 */
export const ensureArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  
  if (data && typeof data === 'object') {
    // Common API response structures
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (data.results && Array.isArray(data.results)) return data.results;
    if (data.records && Array.isArray(data.records)) return data.records;
    
    // Single object with ID
    if (data.id || data._id || data.employee_id || data.department_id || data.item_id) {
      return [data];
    }
    
    // Single object wrapped in data property
    if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      return [data.data];
    }
  }
  
  console.warn('ensureArray: Could not convert data to array:', data);
  return [];
};

/**
 * Removes null, undefined, and empty string values from object
 * @param {Object} data - The data to clean
 * @returns {Object} - Cleaned object
 */
const cleanData = (data) => {
  const cleaned = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
};

/**
 * Creates FormData object from data object
 * @param {Object} data - The data to convert
 * @param {string} method - HTTP method (POST, PUT, PATCH)
 * @returns {FormData} - FormData object
 */
const createFormData = (data, method = 'POST') => {
  const formData = new FormData();
  
  if (method === 'PUT' || method === 'PATCH') {
    formData.append('_method', method);
  }
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else if (value instanceof File) {
        formData.append(key, value);
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });
  
  return formData;
};

// ==================== AXIOS INSTANCE ====================

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true,
  timeout: 30000
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
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

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${response.config.method.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
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
  changePassword: (data) => api.post('/auth/change-password', data)
};

// ==================== INVENTORY API ====================
export const inventoryAPI = {
  getCategories: (params = {}) => api.get('/inventory/categories', { params }),
  getCategory: (id) => api.get(`/inventory/categories/${id}`),
  createCategory: (data) => api.post('/inventory/categories', data),
  updateCategory: (id, data) => api.put(`/inventory/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/inventory/categories/${id}`),
  getCategoryItems: (id) => api.get(`/inventory/categories/${id}/items`),

  getUnits: (params = {}) => api.get('/inventory/units', { params }),
  getUnit: (id) => api.get(`/inventory/units/${id}`),
  createUnit: (data) => api.post('/inventory/units', data),
  updateUnit: (id, data) => api.put(`/inventory/units/${id}`, data),
  deleteUnit: (id) => api.delete(`/inventory/units/${id}`),

  getSuppliers: (params = {}) => api.get('/inventory/suppliers', { params }),
  getSupplier: (id) => api.get(`/inventory/suppliers/${id}`),
  createSupplier: (data) => api.post('/inventory/suppliers', data),
  updateSupplier: (id, data) => api.put(`/inventory/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/inventory/suppliers/${id}`),
  getSupplierItems: (id) => api.get(`/inventory/suppliers/${id}/items`),

  getWarehouses: (params = {}) => api.get('/inventory/warehouses', { params }),
  getWarehouse: (id) => api.get(`/inventory/warehouses/${id}`),
  createWarehouse: (data) => api.post('/inventory/warehouses', data),
  updateWarehouse: (id, data) => api.put(`/inventory/warehouses/${id}`, data),
  deleteWarehouse: (id) => api.delete(`/inventory/warehouses/${id}`),
  getWarehouseInventory: (id) => api.get(`/inventory/warehouses/${id}/inventory`),

  getLocations: (params = {}) => api.get('/inventory/locations', { params }),
  getLocation: (id) => api.get(`/inventory/locations/${id}`),
  createLocation: (data) => api.post('/inventory/locations', data),
  updateLocation: (id, data) => api.put(`/inventory/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`/inventory/locations/${id}`),
  getLocationInventory: (id) => api.get(`/inventory/locations/${id}/inventory`),

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
  bulkDeleteItems: (ids) => api.post('/inventory/items/bulk-delete', { ids }),
  bulkUpdateStock: (data) => api.post('/inventory/items/bulk-update-stock', data),

  getStockMovements: (params = {}) => api.get('/inventory/stock-movements', { params }),
  getStockMovement: (id) => api.get(`/inventory/stock-movements/${id}`),
  createStockIn: (data) => api.post('/inventory/stock-in', data),
  createStockOut: (data) => api.post('/inventory/stock-out', data),
  createTransfer: (data) => api.post('/inventory/transfer', data),
  createAdjustment: (data) => api.post('/inventory/adjustment', data),
  bulkTransfer: (data) => api.post('/inventory/bulk-transfer', data),

  getBatches: (params = {}) => api.get('/inventory/batches', { params }),
  getBatch: (id) => api.get(`/inventory/batches/${id}`),
  createBatch: (data) => api.post('/inventory/batches', data),
  updateBatch: (id, data) => api.put(`/inventory/batches/${id}`, data),
  deleteBatch: (id) => api.delete(`/inventory/batches/${id}`),
  getExpiringBatches: (days = 30) => 
    api.get('/inventory/batches/expiring', { params: { days } }),

  getCounts: (params = {}) => api.get('/inventory/counts', { params }),
  getCount: (id) => api.get(`/inventory/counts/${id}`),
  createCount: (data) => api.post('/inventory/counts', data),
  updateCount: (id, data) => api.put(`/inventory/counts/${id}`, data),
  deleteCount: (id) => api.delete(`/inventory/counts/${id}`),
  startCount: (id) => api.post(`/inventory/counts/${id}/start`),
  completeCount: (id, data) => api.post(`/inventory/counts/${id}/complete`, data),

  getInventoryValue: () => api.get('/inventory/reports/value'),
  getStockLevels: () => api.get('/inventory/reports/stock-levels'),
  getMovementReport: (params = {}) => api.get('/inventory/reports/movements', { params }),
  getTurnoverRate: (params = {}) => api.get('/inventory/reports/turnover', { params }),
  getSlowMoving: (params = {}) => api.get('/inventory/reports/slow-moving', { params }),
  getFastMoving: (params = {}) => api.get('/inventory/reports/fast-moving', { params }),
  getReorderReport: () => api.get('/inventory/reports/reorder'),
  getDeadStock: (days = 90) => api.get('/inventory/reports/dead-stock', { params: { days } }),

  getAlerts: () => api.get('/inventory/alerts'),
  getLowStockAlerts: () => api.get('/inventory/alerts/low-stock'),
  getExpiryAlerts: () => api.get('/inventory/alerts/expiring'),
  dismissAlert: (id) => api.post(`/inventory/alerts/${id}/dismiss`),

  exportInventory: (format = 'csv', params = {}) => 
    api.post('/inventory/export', { format, ...params }, { responseType: 'blob' }),
  importInventory: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/inventory/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getDashboardStats: () => api.get('/inventory/dashboard/stats'),
  getRecentMovements: (limit = 10) => 
    api.get('/inventory/dashboard/recent-movements', { params: { limit } })
};

// ==================== STAFF API ====================
export const staffAPI = {
  // Departments
  getDepartments: (params = {}) => {
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
    const allParams = { ...params, all: true };
    return api.get('/staff/positions', { params: allParams });
  },
  createPosition: (data) => api.post('/staff/positions', data),
  updatePosition: (id, data) => api.put(`/staff/positions/${id}`, data),
  deletePosition: (id) => api.delete(`/staff/positions/${id}`),
  getPositionEmployees: (id) => api.get(`/staff/positions/${id}/employees`),

  // Employees
  getEmployees: (params = {}) => {
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
  // If data is FormData, let axios handle it properly
  if (data instanceof FormData) {
    return api.post('/staff/employees', data, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json'
      }
    });
  }
  // Otherwise, send as JSON
  return api.post('/staff/employees', data);
},

updateEmployee: (id, data) => {
  // If data is FormData, let axios handle it properly
  if (data instanceof FormData) {
    return api.post(`/staff/employees/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  // Otherwise, use PUT with JSON
  return api.put(`/staff/employees/${id}`, data);
},

  deleteEmployee: (id) => api.delete(`/staff/employees/${id}`),
  getEmployeeStats: () => api.get('/staff/employees/stats'),
  getEmployeesByDepartment: (deptId) => api.get(`/staff/employees/by-department/${deptId}`),
  bulkUpdateStatus: (data) => api.post('/staff/employees/bulk-status', data),
  bulkArchive: (data) => api.post('/staff/employees/bulk-archive', data),
  bulkDeleteEmployees: (data) => api.post('/staff/employees/bulk-delete', data),
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
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  archiveProduct: (id) => api.post(`/products/${id}/archive`),
  restoreProduct: (id) => api.post(`/products/${id}/restore`),
  adjustStock: (id, data) => api.post(`/products/${id}/adjust-stock`, data)
};

// ==================== EQUIPMENT API ====================
export const equipmentAPI = {
  getEquipment: (params = {}) => api.get('/equipment', { params }),
  getStats: () => api.get('/equipment/stats'),
  getCategories: () => api.get('/equipment/categories'),
  getConditions: () => api.get('/equipment/conditions'),
  getEquipmentItem: (id) => api.get(`/equipment/${id}`),
  getEquipmentHistory: (id) => api.get(`/equipment/${id}/history`),
  createEquipment: (data) => api.post('/equipment', data),
  updateEquipment: (id, data) => api.put(`/equipment/${id}`, data),
  deleteEquipment: (id) => api.delete(`/equipment/${id}`),
  archiveEquipment: (id) => api.post(`/equipment/${id}/archive`),
  restoreEquipment: (id) => api.post(`/equipment/${id}/restore`),
  markDamaged: (id, data) => api.post(`/equipment/${id}/mark-damaged`, data),
  scheduleMaintenance: (id, data) => api.post(`/equipment/${id}/schedule-maintenance`, data),
  completeMaintenance: (id, data) => api.post(`/equipment/${id}/complete-maintenance`, data)
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
  createEvent: (data) => api.post('/events', data),
  updateEvent: (id, data) => api.put(`/events/${id}`, data),
  cancelEvent: (id) => api.post(`/events/${id}/cancel`),
  deleteEvent: (id) => api.delete(`/events/${id}`),
  returnEquipment: (id, data) => api.post(`/events/${id}/return`, data)
};

// ==================== DASHBOARD API ====================
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getAlerts: () => api.get('/dashboard/alerts'),
  getRecentActivity: (limit = 10) => api.get('/dashboard/recent-activity', { params: { limit } }),
  getLowStock: () => api.get('/dashboard/low-stock'),
  getExpiringSoon: (days = 7) => api.get('/dashboard/expiring-soon', { params: { days } }),
  getMaintenanceDue: (days = 7) => api.get('/dashboard/maintenance-due', { params: { days } }),
  getPopularItems: (limit = 10) => api.get('/dashboard/popular-items', { params: { limit } }),
  getMonthlySummary: (year, month) => api.get('/dashboard/monthly-summary', { params: { year, month } })
};

// ==================== REPORTS API ====================
export const reportAPI = {
  getInventoryReport: (params = {}) => api.get('/reports/inventory', { params }),
  getEquipmentUsageReport: (params = {}) => api.get('/reports/equipment-usage', { params }),
  getEventsReport: (params = {}) => api.get('/reports/events', { params }),
  getDamagedItemsReport: (params = {}) => api.get('/reports/damaged-items', { params }),
  exportData: (type, format = 'csv', params = {}) => 
    api.post('/reports/export', { type, format, ...params }, { responseType: 'blob' })
};

// ==================== SEARCH API ====================
export const searchAPI = {
  searchAll: (query) => api.get('/search/all', { params: { q: query } }),
  searchProducts: (query) => api.get('/search/products', { params: { q: query } }),
  searchEquipment: (query) => api.get('/search/equipment', { params: { q: query } }),
  searchEvents: (query) => api.get('/search/events', { params: { q: query } }),
  searchUsers: (query) => api.get('/search/users', { params: { q: query } }),
  searchInventory: (query) => api.get('/search/inventory', { params: { q: query } })
};

// ==================== USER MANAGEMENT API ====================
export const userAPI = {
  getUsers: (params = {}) => api.get('/users', { params }),
  getStats: () => api.get('/users/stats'),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  toggleUserStatus: (id) => api.post(`/users/${id}/toggle-status`),
  updateRoles: (id, roles) => api.post(`/users/${id}/roles`, { roles }),
  updatePermissions: (id, permissions) => api.post(`/users/${id}/permissions`, { permissions }),
  getUserActivity: (id, params = {}) => api.get(`/users/${id}/activity`, { params }),
  bulkDelete: (ids) => api.post('/users/bulk-delete', { ids }),
  bulkActivate: (ids) => api.post('/users/bulk-activate', { ids }),
  bulkDeactivate: (ids) => api.post('/users/bulk-deactivate', { ids }),
  exportUsers: (format = 'csv', params = {}) => 
    api.post('/users/export', { format, ...params }, { responseType: 'blob' }),
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
  getRoles: (params = {}) => api.get('/roles', { params }),
  getRole: (id) => api.get(`/roles/${id}`),
  createRole: (data) => api.post('/roles', data),
  updateRole: (id, data) => api.put(`/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/roles/${id}`),
  getRolePermissions: (id) => api.get(`/roles/${id}/permissions`),
  updatePermissions: (id, permissions) => api.post(`/roles/${id}/permissions`, { permissions }),
  getRoleUsers: (id) => api.get(`/roles/${id}/users`)
};

// ==================== PERMISSION MANAGEMENT API ====================
export const permissionAPI = {
  getPermissions: (params = {}) => api.get('/permissions', { params }),
  getGroupedPermissions: () => api.get('/permissions/grouped'),
  createPermission: (data) => api.post('/permissions', data),
  updatePermission: (id, data) => api.put(`/permissions/${id}`, data),
  deletePermission: (id) => api.delete(`/permissions/${id}`),
  syncPermissions: () => api.post('/permissions/sync')
};

// ==================== HISTORY API ====================
export const historyAPI = {
  getRecentHistory: (params = {}) => api.get('/history/recent', { params }),
  getSummary: (params = {}) => api.get('/history/summary', { params }),
  getByDateRange: (startDate, endDate) => 
    api.get('/history/by-date', { params: { start_date: startDate, end_date: endDate } }),
  getByType: (type) => api.get(`/history/by-type/${type}`),
  getItemHistory: (type, id) => api.get(`/history/${type}/${id}`),
  getEventHistory: (eventId) => api.get(`/history/event/${eventId}`)
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
        errorMessages: errorMessages,
        status: status
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
export const formatResponse = (response) => ({
  success: response.data.success,
  data: response.data.data,
  message: response.data.message || 'Operation successful',
  meta: response.data.meta || null
});

// ==================== HEALTH CHECK ====================
export const healthCheck = () => api.get('/health');

export default api;