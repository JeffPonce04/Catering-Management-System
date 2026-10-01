import axios from 'axios';
import { message } from 'antd';

/* =========================================================
  API CONFIGURATION
  ========================================================= */

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const normalizedApiUrl = rawApiUrl.trim().replace(/\/+$/, '');

export const API_ORIGIN = normalizedApiUrl.replace(/(?:\/api\/v1)+$/i, '');

export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true') {
  console.log('🔧 API Configuration:', {
    mode: import.meta.env.MODE,
    apiOrigin: API_ORIGIN,
    apiBaseUrl: API_BASE_URL,
  });
}
/* =========================================================
  AXIOS INSTANCE
  ========================================================= */

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 15000,
  withCredentials: true,
});

/* =========================================================
  HELPERS
  ========================================================= */

export const clearAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('userData');
};

export const handleApiError = (
  error,
  fallback = 'Something went wrong. Please try again.'
) => {
  const validationErrors = error?.response?.data?.errors || {};

  const firstValidationError = Object.values(validationErrors)
    .flat()
    .find(Boolean);

  const errorMessage =
    error?.response?.data?.message ||
    firstValidationError ||
    error?.message ||
    fallback;

  console.error('API Error:', error?.response?.data || error);

  return errorMessage;
};

export const ensureArray = (payload) => {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data?.data?.data)) return data.data.data.data;

  return [];
};

export const extractData = (response, fallback = []) => {
  return (
    response?.data?.data?.data ||
    response?.data?.data ||
    response?.data ||
    fallback
  );
};

const cleanData = (data = {}) => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      // ⭐ FIX: Preserve explicit `null` for keys that carry semantic
      //    meaning (e.g. `deductions: null` = "no deductions").
      //    Only drop `undefined` and empty strings.
      if (value === undefined) return false;
      if (value === '') return false;
      return true;
    })
  );
};

const createFormData = (data = {}, method = 'POST') => {
  const formData = new FormData();

  if (method === 'PUT' || method === 'PATCH') {
    formData.append('_method', method);
  }

  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }

    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
};

/* =========================================================
  INTERCEPTORS
  ========================================================= */

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else {
      config.headers['Content-Type'] = 'application/json';
    }

    if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true') {
      console.log(
        `📤 ${config.method?.toUpperCase()} ${API_BASE_URL}${config.url}`,
        {
          hasToken: Boolean(token),
          data: config.data instanceof FormData ? 'FormData' : config.data,
        }
      );
    }
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error Details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('/login');
    const isAuthRoute = error.config?.url?.includes('/auth/');
    const isLoginEndpoint =
      error.config?.url === '/auth/login' ||
      error.config?.url === '/auth/employee-login';
    const isUserEndpoint =
      error.config?.url === '/auth/user' ||
      error.config?.url === '/auth/profile';

    if (error.response?.status === 401) {
      if (isLoginEndpoint) {
        return Promise.reject(error);
      }

      if (isAuthRoute || isUserEndpoint) {
        return Promise.reject(error);
      }

      const token =
        localStorage.getItem('auth_token') ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token');

      if (token && !isLoginPage) {
        clearAuth();
        message.error('Session expired. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }

      if (isLoginPage) {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

/* =========================================================
  AUTH API
  ========================================================= */

export const authAPI = {
  login: (data) => {
    return api.post('/auth/login', {
      userId:
        data.userId?.trim() ||
        data.username?.trim() ||
        data.email?.trim(),
      password: data.password,
      role: data.role,
      otp_code: data.otp_code,
      require_otp: data.require_otp,
      remember_me: data.remember_me || data.rememberMe || false,
    });
  },

  
  employeeLogin: (data) => {
    return api.post('/auth/employee-login', {
      employee_code: data.employee_code || data.employeeCode,
      password: data.password,
    });
  },

  mobileEmployeeLogin: (employeeCode) => {
    return api.post('/auth/mobile-employee-login', {
      employee_code: employeeCode,
    });
  },

  logout: () => {
    return api.post('/auth/logout');
  },

  getUser: () => {
    return api.get('/auth/user');
  },

  updateProfile: (data) => {
    return api.put('/auth/profile', cleanData(data));
  },

  changePassword: (data) => {
    return api.put('/auth/change-password', cleanData(data));
  },

  forgotPassword: (data) => {
    return api.post('/auth/forgot-password', cleanData(data));
  },

  verifyResetOtp: (data) => {
    return api.post('/auth/verify-otp', cleanData(data));
  },

  resendResetOtp: (data) => {
    return api.post('/auth/resend-otp', cleanData(data));
  },

    resetPassword: (data) => {
    return api.post('/auth/reset-password', cleanData(data));
  },

  /**
   * Upload (or replace) the caller's profile photo.
   * Uses POST /auth/profile-photo with multipart/form-data.
   */
  updateProfilePhoto: (formData) => {
    return api.post('/auth/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Remove the caller's profile photo.
   */
  removeProfilePhoto: () => {
    return api.delete('/auth/profile-photo');
  },

  /**
   * Self-service profile update (mobile / employee self-service).
   * Only touches the caller's own Person record.
   */
  updateSelfProfile: (data) => {
    return api.put('/auth/self-profile', cleanData(data));
  },
};



/* =========================================================
  EMPLOYEES API
  ========================================================= */

export const employeeAPI = {
  getAll: (params = {}) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  getAllEmployees: (params = {}) => api.get('/employees/all', { params }),
  getAllEmployeesList: (params = {}) => api.get('/employees/all-list', { params }),
  getActive: () => api.get('/employees/active'),
  getOnLeave: () => api.get('/employees/on-leave'),
  getBirthdays: () => api.get('/employees/birthdays'),
  getArchived: () => api.get('/employees/archived'),
  getStats: () => api.get('/employees/stats'),
  search: (query) => api.get('/employees/search', { params: { q: query } }),
  getAttendance: (id) => api.get(`/employees/${id}/attendance`),
  getLeaves: (id) => api.get(`/employees/${id}/leaves`),
  getPayroll: (id) => api.get(`/employees/${id}/payroll`),
  toggleBookmark: (id) => api.post(`/employees/${id}/toggle-bookmark`),
  updateStatus: (id, status) =>
    api.post(`/employees/${id}/update-status`, { status }),
  restore: (id) => api.post(`/employees/${id}/restore`),
  forceDelete: (id) => api.delete(`/employees/${id}/force`),
  bulkArchive: (data) => api.post('/employees/bulk-archive', data),
  bulkDelete: (data) => api.post('/employees/bulk-delete', data),
  bulkUpdateStatus: (data) => api.post('/employees/bulk-update-status', data),
  getEligibleForPayroll: (params = {}) =>
    api.get('/employees/eligible-for-payroll', { params }),

  create: (data) => {
    const payload = data instanceof FormData ? data : createFormData(data);
    return api.post('/employees', payload);
  },

  update: (id, data) => {
    const payload = data instanceof FormData ? data : createFormData(data, 'PUT');

    if (data instanceof FormData && !data.has('_method')) {
      data.append('_method', 'PUT');
    }

    return api.post(`/employees/${id}`, payload);
  },

  delete: (id) => api.delete(`/employees/${id}`),
};



/* =========================================================
  SCHEDULES API
  ========================================================= */

/* =========================================================
  SCHEDULES API - FIXED
  ========================================================= */

export const scheduleAPI = {
  getAll: (params = {}) => api.get('/schedules', { params }),
  getById: (id) => api.get(`/schedules/${id}`),
  getByDate: (date) => api.get(`/schedules/date/${date}`),
  getByEmployee: (employeeId) => api.get(`/schedules/employee/${employeeId}`),
  getWeek: (params = {}) => api.get('/schedules/week', { params }),
  getMonth: (params = {}) => api.get('/schedules/month', { params }),
  getToday: () => api.get('/schedules/today'),
  getArchived: (params = {}) => api.get('/schedules/archived', { params }),
  getStats: (params = {}) => api.get('/schedules/stats', { params }),
  getRange: (params = {}) => api.get('/schedules/range', { params }),
  getWarnings: () => api.get('/schedules/warnings'),
  getCompletedShifts: (params = {}) => api.get('/schedules/completed-shifts', { params }),
  getEmployeeSchedule: (employeeId) => api.get(`/schedules/employee/${employeeId}`),
  getTimeOffRequests: () => api.get('/employee-requests'),
  getEmployeeRequests: () => api.get('/employee-requests'),
  
  // FIXED: Don't use cleanData - send full payload
  create: (data) => api.post('/schedules', data),
  
  createBulk: (schedules) => api.post('/schedules/bulk', { schedules }),
  
  // FIXED: Don't use cleanData - send full payload
  update: (id, data) => api.put(`/schedules/${id}`, data),
  
  delete: (id) => api.delete(`/schedules/${id}`),
  archive: (id) => api.post(`/schedules/${id}/archive`),
  restore: (id) => api.post(`/schedules/${id}/restore`),
  bulkArchive: (ids) => api.post('/schedules/bulk-archive', { ids }),
  bulkRestore: (ids) => api.post('/schedules/bulk-restore', { ids }),
  export: (params = {}) => api.get('/schedules/export', { params }),
};

/* =========================================================
  ATTENDANCE API
  ========================================================= */

export const attendanceAPI = {
  getAll: (params = {}) => api.get('/attendance/all', { params }),
  getToday: (params = {}) => api.get('/attendance/today', { params }),
  getSummary: (params = {}) => api.get('/attendance/summary', { params }),
  getStatistics: (params = {}) => api.get('/attendance/statistics', { params }),
  getHistory: (params = {}) => api.get('/attendance/history', { params }),
  getDateRange: (params = {}) => api.get('/attendance/range', { params }),
  getNeedsApproval: (params = {}) => api.get('/attendance/needs-approval', { params }),
  getByEmployee: (employeeId, params = {}) =>
    api.get(`/attendance/employee/${employeeId}`, { params }),

  getEmployeeOverview: (params = {}) =>
    api.get('/attendance/employee-overview', { params }),

  getEmployeeRecords: (params = {}) =>
    api.get('/attendance/employee-records', { params }),

  getEmployeeSavedRecords: (params = {}) =>
    api.get('/attendance/employee-saved-records', { params }),

  getEmployees: (params = {}) => api.get('/employees', { params }),
  getDepartments: (params = {}) => api.get('/departments', { params }),

  mobileLogin: (employeeId) =>
    api.post('/attendance/login', { employee_id: employeeId }),

  clockIn: (data) => api.post('/attendance/time-in', cleanData(data)),
  clockOut: (data) => api.post('/attendance/time-out', cleanData(data)),
  logout: () => api.post('/attendance/logout'),

  updateStatus: (attendanceId, status, notes = '') => {
    const normalizedStatus =
      status === 'verified' ? 'APPROVED'
      : status === 'rejected' ? 'REJECTED'
      : status === 'pending' ? 'PENDING'
      : status;

    return api.put(`/attendance/${attendanceId}/status`, {
      verification_status: normalizedStatus,
      verification_notes: notes,
    });
  },

  approve: (id, data = {}) => {
    const payload = typeof data === 'string' ? { notes: data } : data;
    return api.post(`/attendance/${id}/approve`, cleanData(payload));
  },

  reject: (id, notes = '') =>
    api.put(`/attendance/${id}/status`, {
      verification_status: 'REJECTED',
      verification_notes: notes,
    }),

  unverify: (id) => api.post(`/attendance/${id}/unverify`),

  approveUnscheduled: (id, adminNotes = '') =>
    api.post(`/attendance/${id}/approve-unscheduled`, { admin_notes: adminNotes }),

  approveOvertime: (id, notes = '', approvedOvertimeHours = undefined) =>
    api.post(`/attendance/${id}/approve-overtime`, cleanData({
      notes,
      approved_overtime_hours: approvedOvertimeHours,
    })),

  rejectOvertime: (id, reason = '') =>
    api.post(`/attendance/${id}/reject-overtime`, { reason }),

  approveUndertime: (id, approvedUndertimeHours, notes = '') =>
    api.post(`/attendance/${id}/approve-undertime`, {
      approved_undertime_hours: approvedUndertimeHours,
      notes,
    }),

  rejectUndertime: (id, reason = '') =>
    api.post(`/attendance/${id}/reject-undertime`, { reason }),

  bulkOvertimeDecision: (data) =>
    api.post('/attendance/overtime/bulk-decision', cleanData(data)),

  decline: (recordId, reason = '') =>
    api.post(`/daily-attendance/${recordId}/decline`, { reason }),

  undecline: (recordId) => api.post(`/daily-attendance/${recordId}/undecline`),
  unapprove: (recordId) => api.post(`/daily-attendance/${recordId}/unapprove`),
};



/* =========================================================
  DAILY ATTENDANCE API
  ========================================================= */

export const dailyAttendanceAPI = {
  getAll: (params = {}) => api.get('/daily-attendance', { params }),
  getPending: (params = {}) => api.get('/daily-attendance/pending', { params }),
  getSummary: () => api.get('/daily-attendance/summary'),
  approve: (recordId, data = {}) =>
    api.post(`/daily-attendance/${recordId}/approve`, cleanData(data)),
  decline: (recordId, reason = '') =>
    api.post(`/daily-attendance/${recordId}/decline`, { reason }),
  undecline: (recordId) => api.post(`/daily-attendance/${recordId}/undecline`),
  unapprove: (recordId) => api.post(`/daily-attendance/${recordId}/unapprove`),
  approveOvertime: (recordId, data = {}) =>
    api.post(`/daily-attendance/${recordId}/approve-overtime`, cleanData(data)),
  rejectOvertime: (recordId, reason = '') =>
    api.post(`/daily-attendance/${recordId}/reject-overtime`, { reason }),
  bulkApprove: (recordIds, notes = '', overtimeConfirmed = false, removeOvertime = false) =>
    api.post('/daily-attendance/bulk-approve', {
      record_ids: recordIds,
      notes,
      overtime_confirmed: overtimeConfirmed,
      remove_overtime: removeOvertime,
    }),
};

/* =========================================================
  PAYROLL API
  ========================================================= */

export const payrollAPI = {
  getAll: (params = {}) => api.get('/payroll', { params }),
  getById: (id) => api.get(`/payroll/${id}`),
  getHistory: (params = {}) => api.get('/payroll/history', { params }),
  getStats: (params = {}) => api.get('/payroll/stats', { params }),
  getHistoryStats: (params = {}) => api.get('/payroll/history-stats', { params }),
  preview: (data) => api.post('/payroll/preview', cleanData(data)),
  process: (data) => {
    if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true') {
      console.log('📤 payroll.process payload:', JSON.stringify(data, null, 2));
    }
    return api.post('/payroll/process', cleanData(data));
  },  update: (id, data) => api.put(`/payroll/${id}`, cleanData(data)),
  approve: (id) => api.post(`/payroll/${id}/approve`),
  markAsPaid: (id, data) => api.post(`/payroll/${id}/mark-paid`, cleanData(data)),
  delete: (id) => api.delete(`/payroll/${id}`),
  restore: (id) => api.post(`/payroll/${id}/restore`),
  permanentDelete: (id) => api.delete(`/payroll/${id}/permanent`),
  bulkUpdateDeductions: (data) => api.post('/payroll/bulk-deductions', cleanData(data)),
  summary: (params = {}) => api.get('/payroll/summary', { params }),
  processSelected: (data) => api.post('/payroll/process', cleanData(data)),
   previewPayroll: (data) => {
    if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true') {
      console.log('📤 payroll.preview payload:', JSON.stringify(data, null, 2));
    }
    return api.post('/payroll/preview', cleanData(data));
  },
  export: (params = {}) =>
    api.get('/payroll/export', { params, responseType: 'blob' }),
};

/* =========================================================
  PAYSLIP API
  ========================================================= */

export const payslipAPI = {
  getAll: (params = {}) => api.get('/payslips', { params }),
  getById: (id) => api.get(`/payslips/${id}`),
  getByPayroll: (payrollId) => api.get(`/payroll/${payrollId}/payslip`),
  generate: (data) => api.post('/payslips/generate', cleanData(data)),
  bulkGenerate: (payrollIds) =>
    api.post('/payslips/bulk-generate', { payroll_ids: payrollIds }),
  download: (id) => api.get(`/payslips/${id}/download`, { responseType: 'blob' }),
  email: (id) => api.post(`/payslips/${id}/email`),
  preview: (payrollId) => api.get(`/payroll/${payrollId}/payslip`),
  print: (id) => api.get(`/payslips/${id}/download`, { responseType: 'blob' }),
};

/* =========================================================
  EMPLOYEE REQUESTS API
  ========================================================= */

export const employeeRequestAPI = {
  getAll: (params = {}) => api.get('/employee-requests', { params }),
  getPending: (params = {}) => api.get('/employee-requests/pending', { params }),
  getById: (id) => api.get(`/employee-requests/${id}`),
  create: (data) => api.post('/employee-requests', cleanData(data)),
  update: (id, data) => api.put(`/employee-requests/${id}`, cleanData(data)),
  updateStatus: (id, status, adminNotes = '') =>
    api.put(`/employee-requests/${id}/status`, {
      status,
      admin_notes: adminNotes,
    }),
  approve: (id, adminNotes = '') =>
    api.put(`/employee-requests/${id}/status`, {
      status: 'approved',
      admin_notes: adminNotes,
    }),
  reject: (id, adminNotes = '') =>
    api.put(`/employee-requests/${id}/status`, {
      status: 'rejected',
      admin_notes: adminNotes,
    }),
  cancel: (id, reason = '') =>
    api.post(`/employee-requests/${id}/cancel`, { reason }),
  delete: (id) => api.delete(`/employee-requests/${id}`),
};

export const timeOffAPI = {
  getAll: employeeRequestAPI.getAll,
  getById: employeeRequestAPI.getById,
  getPending: employeeRequestAPI.getPending,
  getBalance: (employeeId) =>
    api.get('/employee-requests', { params: { employee_id: employeeId } }),
  getStats: (params = {}) => employeeRequestAPI.getAll(params),
  create: employeeRequestAPI.create,
  update: employeeRequestAPI.update,
  delete: employeeRequestAPI.delete,
  approve: employeeRequestAPI.approve,
  reject: employeeRequestAPI.reject,
};

/* =========================================================
  DEPARTMENTS API
  ========================================================= */

export const departmentAPI = {
  getAll: (params = {}) =>
    api.get('/departments', { params: { ...params, all: true } }),
  getPaginated: (params = {}) => api.get('/departments', { params }),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', cleanData(data)),
  update: (id, data) => api.put(`/departments/${id}`, cleanData(data)),
  delete: (id) => api.delete(`/departments/${id}`),
  getStats: () => api.get('/departments/stats'),
  getWithEmployees: () => api.get('/departments/with-employees'),
};

/* =========================================================
  POSITIONS API
  ========================================================= */

export const positionAPI = {
  getAll: (params = {}) =>
    api.get('/positions', { params: { ...params, all: true } }),
  getPaginated: (params = {}) => api.get('/positions', { params }),
  getById: (id) => api.get(`/positions/${id}`),
  create: (data) => api.post('/positions', cleanData(data)),
  update: (id, data) => api.put(`/positions/${id}`, cleanData(data)),
  delete: (id) => api.delete(`/positions/${id}`),
  getStats: () => api.get('/positions/stats'),
  getBySalaryGrade: (salaryGradeId) =>
    api.get(`/positions/by-salary-grade/${salaryGradeId}`),
};

/* =========================================================
  SALARY GRADES API
  ========================================================= */

export const salaryGradeAPI = {
  getAll: (params = {}) =>
    api.get('/salary-grades', { params: { ...params, all: true } }),
  getPaginated: (params = {}) => api.get('/salary-grades', { params }),
  getById: (id) => api.get(`/salary-grades/${id}`),
  create: (data) => api.post('/salary-grades', cleanData(data)),
  update: (id, data) => api.put(`/salary-grades/${id}`, cleanData(data)),
  delete: (id) => api.delete(`/salary-grades/${id}`),
  getStats: () => api.get('/salary-grades/stats'),
};

/* =========================================================
  STAFF API ALIAS
  ========================================================= */

export const staffAPI = {
  getDepartments: departmentAPI.getAll,
  getDepartment: departmentAPI.getById,
  createDepartment: departmentAPI.create,
  updateDepartment: departmentAPI.update,
  deleteDepartment: departmentAPI.delete,
  getDepartmentStats: departmentAPI.getStats,
  getDepartmentsWithEmployees: departmentAPI.getWithEmployees,

  getPositions: positionAPI.getAll,
  getPosition: positionAPI.getById,
  createPosition: positionAPI.create,
  updatePosition: positionAPI.update,
  deletePosition: positionAPI.delete,
  getPositionStats: positionAPI.getStats,
  getPositionsBySalaryGrade: positionAPI.getBySalaryGrade,

  getSalaryGrades: salaryGradeAPI.getAll,
  getSalaryGrade: salaryGradeAPI.getById,
  createSalaryGrade: salaryGradeAPI.create,
  updateSalaryGrade: salaryGradeAPI.update,
  deleteSalaryGrade: salaryGradeAPI.delete,
  getSalaryGradeStats: salaryGradeAPI.getStats,

  getEmployees: (params = {}) => api.get('/employees', { params }),
  getEmployee: (id) => api.get(`/employees/${id}`),
  getAllEmployees: (params = {}) => api.get('/employees/all', { params }),
  getAllEmployeesList: (params = {}) => api.get('/employees/all-list', { params }),
  getActiveEmployees: employeeAPI.getActive,
  getOnLeaveEmployees: employeeAPI.getOnLeave,
  getArchivedEmployees: employeeAPI.getArchived,
  getEmployeeBirthdays: employeeAPI.getBirthdays,
  getEmployeeStats: employeeAPI.getStats,
  searchEmployees: employeeAPI.search,
  createEmployee: employeeAPI.create,
  updateEmployee: employeeAPI.update,
  deleteEmployee: employeeAPI.delete,
  restoreEmployee: employeeAPI.restore,
  forceDeleteEmployee: employeeAPI.forceDelete,
  updateEmployeeStatus: employeeAPI.updateStatus,
  toggleBookmark: employeeAPI.toggleBookmark,
  bulkArchive: employeeAPI.bulkArchive,
  bulkDelete: employeeAPI.bulkDelete,
  bulkUpdateStatus: employeeAPI.bulkUpdateStatus,
  getEligibleForPayroll: employeeAPI.getEligibleForPayroll,
};

/* =========================================================
  MENU API
  ========================================================= */

export const menuAPI = {
  getPublicMenuItems: (params = {}) => api.get('/public/menu-items', { params }),
  getMenuItems: (params = {}) => api.get('/menu-items', { params }),
  getMenuItem: (id) => api.get(`/menu-items/${id}`),
  createMenuItem: (data) => api.post('/menu-items', data),
  updateMenuItem: ({ id, data }) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/menu-items/${id}`, data);
    }
    return api.put(`/menu-items/${id}`, data);
  },
  deleteMenuItem: (id) => api.delete(`/menu-items/${id}`),
  toggleAvailability: (id) => api.post(`/menu-items/${id}/toggle-availability`),
  toggleFeatured: (id) => api.post(`/menu-items/${id}/toggle-featured`),
};

export const categoryAPI = {
  getPublicCategories: () => api.get('/public/meal-categories'),
  getCategories: (params = {}) =>
    api.get('/meal-categories/manage', { params: { ...params, manage: 1 } }),
  createCategory: (data) => api.post('/meal-categories', data),
  updateCategory: ({ id, data }) => api.put(`/meal-categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/meal-categories/${id}`),
};

export const packageAPI = {
  getPublicPackages: (params = {}) => api.get('/public/packages', { params }),
  getPackages: (params = {}) => api.get('/packages', { params }),
  getPackage: (id) => api.get(`/packages/${id}`),
  createPackage: (data) => api.post('/packages', data),
  updatePackage: ({ id, data }) => api.put(`/packages/${id}`, data),
  deletePackage: (id) => api.delete(`/packages/${id}`),
};

export const promotionAPI = {
  getPromotions: (params = {}) => api.get('/promotions', { params }),
  getPromotion: (id) => api.get(`/promotions/${id}`),
  getActivePromotions: (params = {}) => api.get('/promotions/active', { params }),
  getStats: () => api.get('/promotions/stats'),
  createPromotion: (data) => api.post('/promotions', data),
  updatePromotion: ({ id, data }) => api.put(`/promotions/${id}`, data),
  deletePromotion: (id) => api.delete(`/promotions/${id}`),
  toggleActive: (id) => api.post(`/promotions/${id}/toggle-active`),
  duplicate: (id) => api.post(`/promotions/${id}/duplicate`),
  validateCode: (data) => api.post('/promotions/validate', data),
  redeemCode: (data) => api.post('/promotions/redeem', data),
  getRedemptions: (id, params = {}) =>
    api.get(`/promotions/${id}/redemptions`, { params }),
  getAnalytics: (id) => api.get(`/promotions/${id}/analytics`),
  sendExpiryReminders: () => api.post('/promotions/send-expiry-reminders'),
};

export const ingredientAPI = {
  getIngredients: (params = {}) => api.get('/ingredients', { params }),
  getLowStock: (params = {}) => api.get('/ingredients/low-stock', { params }),
  getIngredient: (id) => api.get(`/ingredients/${id}`),
  createIngredient: (data) => api.post('/ingredients', data),
  updateIngredient: ({ id, data }) => api.put(`/ingredients/${id}`, data),
  deleteIngredient: (id) => api.delete(`/ingredients/${id}`),
  updateStock: ({ id, currentStock }) =>
    api.put(`/ingredients/${id}/stock`, { current_stock: currentStock }),
};

export const recipeAPI = {
  getRecipes: () => api.get('/recipes'),
  getRecipe: (menuItemId) => api.get(`/recipes/${encodeURIComponent(menuItemId)}`),
  saveRecipe: (data) => api.post('/recipes', data),
  deleteRecipe: (menuItemId) =>
    api.delete(`/recipes/${encodeURIComponent(menuItemId)}`),
};

export const statisticsAPI = {
  getMenuStatistics: () => api.get('/menu-statistics'),
};

/* =========================================================
  PRODUCT API
  ========================================================= */

export const productAPI = {
  getProducts: (params = {}) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', cleanData(data)),
  updateProduct: (id, data) => api.put(`/products/${id}`, cleanData(data)),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  restoreProduct: (id) => api.post(`/products/${id}/restore`),
  getStats: () => api.get('/products/stats'),
};

/* =========================================================
  EQUIPMENT API
  ========================================================= */

export const equipmentAPI = {
  getEquipment: (params = {}) => api.get('/equipment', { params }),
  getEquipmentItem: (id) => api.get(`/equipment/${id}`),
  createEquipment: (data) => api.post('/equipment', cleanData(data)),
  updateEquipment: (id, data) => api.put(`/equipment/${id}`, cleanData(data)),
  deleteEquipment: (id) => api.delete(`/equipment/${id}`),
  restoreEquipment: (id) => api.post(`/equipment/${id}/restore`),
  getStats: () => api.get('/equipment/stats'),
  getEquipmentHistory: (id) => api.get(`/equipment/${id}/history`),
};

/* =========================================================
  EVENT API
  ========================================================= */

export const eventAPI = {
  getEvents: (params = {}) => api.get('/events', { params }),
  getEvent: (id) => api.get(`/events/${id}`),
  createEvent: (data) => api.post('/events', cleanData(data)),
  updateEvent: (id, data) => api.put(`/events/${id}`, cleanData(data)),
  deleteEvent: (id) => api.delete(`/events/${id}`),
  getStats: () => api.get('/events/stats'),
  returnEquipment: (eventCode, data) =>
    api.post(`/events/${eventCode}/return-equipment`, cleanData(data)),
  getEquipment: (eventId) => api.get(`/events/${eventId}/equipment`),
  checkoutEquipment: (eventId, data) =>
    api.post(`/events/${eventId}/equipment/checkout`, cleanData(data)),
  approveSelectedEquipment: (eventId, data = {}) =>
    api.post(`/events/${eventId}/equipment/approve-selected`, cleanData(data)),
  approveAllEquipment: (eventId, data = {}) =>
    api.post(`/events/${eventId}/equipment/approve-all`, cleanData(data)),
  returnEventEquipment: (eventId, transactionId, data) =>
    api.post(`/events/${eventId}/equipment/${transactionId}/return`, cleanData(data)),
  assignStaff: (eventId, data) => api.post(`/events/${eventId}/staff`, data),
  getStaff: (eventId) => api.get(`/events/${eventId}/staff`),
  updateStaffStatus: (eventId, staffId, data) =>
    api.put(`/events/${eventId}/staff/${staffId}`, data),
  removeStaff: (eventId, staffId) =>
    api.delete(`/events/${eventId}/staff/${staffId}`),
  getChecklist: (eventId) => api.get(`/events/${eventId}/checklist`),
  updateChecklistItem: (eventId, itemId, data) =>
    api.put(`/events/${eventId}/checklist/${itemId}`, data),
  addChecklistItem: (eventId, data) =>
    api.post(`/events/${eventId}/checklist`, data),
  deleteChecklistItem: (eventId, itemId) =>
    api.delete(`/events/${eventId}/checklist/${itemId}`),
  getDeliveries: (eventId) => api.get(`/events/${eventId}/deliveries`),
  updateDeliveryStatus: (eventId, deliveryId, data) =>
    api.put(`/events/${eventId}/deliveries/${deliveryId}/status`, data),
  addDelivery: (eventId, data) => api.post(`/events/${eventId}/deliveries`, data),
  getDailyProgress: (eventId) => api.get(`/events/${eventId}/daily-progress`),
  updateDailyProgress: (eventId, day, data) =>
    api.put(`/events/${eventId}/daily-progress/${day}`, data),
  advanceToNextDay: (eventId) => api.post(`/events/${eventId}/advance-day`),
  updateAttendance: (eventId, day, data) =>
    api.put(`/events/${eventId}/attendance/${day}`, data),
  getLiveStatus: (eventId) => api.get(`/events/${eventId}/live-status`),
  updateLiveStatus: (eventId, data) =>
    api.put(`/events/${eventId}/live-status`, data),
  startEvent: (eventId, data = {}) =>
    api.post(`/events/${eventId}/start`, cleanData(data)),
  updateMealServiceStatus: (eventId, mealServiceId, data) =>
    api.put(`/events/${eventId}/meal-services/${mealServiceId}/status`, cleanData(data)),
  completeEvent: (eventId) => api.post(`/events/${eventId}/complete`),
  track: (id, data) => api.post(`/events/${id}/tracking`, data),
  getSessions: (eventId) => api.get(`/events/${eventId}/sessions`),
  addSession: (eventId, data) => api.post(`/events/${eventId}/sessions`, data),
  updateSessionStatus: (eventId, sessionId, data) =>
    api.put(`/events/${eventId}/sessions/${sessionId}/status`, data),
  deleteSession: (eventId, sessionId) =>
    api.delete(`/events/${eventId}/sessions/${sessionId}`),
};

/* =========================================================
  INVENTORY HISTORY API
  ========================================================= */

export const historyAPI = {
  getRecent: () => api.get('/inventory-history/recent'),
  getSummary: () => api.get('/inventory-history/summary'),
  getByDateRange: (params = {}) => api.get('/inventory-history/date-range', { params }),
  getByType: (type) => api.get(`/inventory-history/type/${type}`),
  getItemHistory: (type, id) => api.get(`/inventory-history/item/${type}/${id}`),
};

/* =========================================================
  DASHBOARD API
  ========================================================= */

export const dashboardAPI = {
  getStats: (params = {}) => api.get('/dashboard/stats', { params }),
  getMonthlySummary: (params = {}) => api.get('/dashboard/monthly-summary', { params }),
  getCharts: (params = {}) => api.get('/dashboard/charts', { params }),
  getDetail: (card, params = {}) => api.get(`/dashboard/detail/${card}`, { params }),
};

/* =========================================================
  BOOKING API
  ========================================================= */

export const bookingAPI = {
  getBookings: (params = {}) => {
    const defaultParams = { per_page: 6, page: 1 };
    const mergedParams = { ...defaultParams, ...params };
    return api.get('/bookings', { params: mergedParams });
  },
  getBooking: (id) => api.get(`/bookings/${id}`),
  createBooking: (data) => api.post('/bookings', data),
  updateBooking: (id, data) => api.put(`/bookings/${id}`, data),
  deleteBooking: (id) => api.delete(`/bookings/${id}`),
  confirmBooking: (id) => api.post(`/bookings/${id}/confirm`),
  rejectBooking: (id) => api.post(`/bookings/${id}/reject`),
  unrejectBooking: (id) => api.post(`/bookings/${id}/unreject`),  cancelBooking: (id, data) => api.post(`/bookings/${id}/cancel`, data),
  rescheduleBooking: (id, data) => api.post(`/bookings/${id}/reschedule`, data),
  requestReschedule: (id, data) => api.post(`/bookings/${id}/request-reschedule`, data),
  approveReschedule: (id) => api.post(`/bookings/${id}/approve-reschedule`),
  rejectReschedule: (id) => api.post(`/bookings/${id}/reject-reschedule`),
  recordPayment: (id, data) => api.post(`/bookings/${id}/record-payment`, data),
  getPaymentSummary: (bookingId) => api.get(`/bookings/${bookingId}/payment-summary`),
  checkConflicts: (params = {}) => api.get('/bookings/check-conflicts', { params }),
  getStatistics: (params = {}) => api.get('/bookings-statistics', { params }),
  getCalendarEvents: (params = {}) => api.get('/calendar-events', { params }),
  getCalendarAvailability: (params = {}) =>
    api.get('/booking-calendar/availability', { params }),
  saveCalendarAvailability: (date, data) =>
    api.put(`/booking-calendar/availability/${date}`, data),
  deleteCalendarAvailability: (date) =>
    api.delete(`/booking-calendar/availability/${date}`),
  getEventTypes: () => api.get('/event-types'),
  createEvent: (bookingId) => api.post(`/bookings/${bookingId}/create-event`),
  completeBooking: (id) => api.post(`/bookings/${id}/complete`),
  cancelWithReason: (id, data) => api.post(`/bookings/${id}/cancel-with-reason`, data),
  getCompleted: (params = {}) => api.get('/bookings/completed', { params }),
  getIngredientsSummary: (bookingId) =>
    api.get(`/bookings/${bookingId}/ingredients-summary`),
  markIngredientsPurchased: (bookingId, data) =>
    api.post(`/bookings/${bookingId}/ingredients-purchased`, data),
  getBookingsWithIngredients: (params = {}) =>
    api.get('/bookings/ingredients-management', { params }),
  getBookingIngredientsDetails: (bookingId) =>
    api.get(`/bookings/${bookingId}/ingredients-details`),
  getMenuItemIngredients: (bookingId, menuItemId) =>
    api.get(`/bookings/${bookingId}/menu-item/${menuItemId}/ingredients`),
  markIngredientsPurchasedPerBooking: (bookingId, data) =>
    api.post(`/bookings/${bookingId}/ingredients-mark-purchased`, data),
  markAllIngredientsPurchased: (bookingId) =>
    api.post(`/bookings/${bookingId}/ingredients-mark-all-purchased`),
};

/* =========================================================
  QUOTATION API
  ========================================================= */

export const quotationAPI = {
  getQuotations: (params = {}) => api.get('/quotations', { params }),
  getQuotation: (id) => api.get(`/quotations/${id}`),
  createQuotation: (data) => api.post('/quotations', data),
  updateQuotation: (id, data) => api.put(`/quotations/${id}`, data),
  deleteQuotation: (id) => api.delete(`/quotations/${id}`),
  approveQuotation: (id) => api.post(`/quotations/${id}/approve`),
  rejectQuotation: (id) => api.post(`/quotations/${id}/reject`),
  sendQuotation: (id) => api.post(`/quotations/${id}/send`),
};

/* =========================================================
  PAYMENT API
  ========================================================= */

export const paymentAPI = {
  getPayments: (params = {}) => api.get('/payments', { params }),
  getPayment: (id) => api.get(`/payments/${id}`),
  createPayment: (data) => {
    if (data.receipt_file instanceof File) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });
      return api.post('/payments', formData);
    }
    return api.post('/payments', data);
  },
  updatePayment: (id, data) => api.put(`/payments/${id}`, data),
  verifyPayment: (id, notes) => api.post(`/payments/${id}/verify`, { notes }),
  rejectPayment: (id, reason) => api.post(`/payments/${id}/reject`, { reason }),
  deletePayment: (id) => api.delete(`/payments/${id}`),
  downloadReceipt: (id) =>
    api.get(`/payments/${id}/download-receipt`, { responseType: 'blob' }),
  refundPayment: (id, data) => api.post(`/payments/${id}/refund`, data),
  getPaymentSummary: (params = {}) => api.get('/payments/summary', { params }),
};

/* =========================================================
  INVOICE API
  ========================================================= */

export const invoiceAPI = {
  getInvoices: (params = {}) => api.get('/invoices', { params }),
  getInvoice: (id) => api.get(`/invoices/${id}`),
  createInvoice: (data) => api.post('/invoices', data),
  updateInvoice: (id, data) => api.put(`/invoices/${id}`, data),
  deleteInvoice: (id) => api.delete(`/invoices/${id}`),
  getDebts: (params = {}) => api.get('/debts', { params }),
  getInvoicePayments: (id) => api.get(`/invoices/${id}/payments`),
  sendReminder: (id, data) => api.post(`/invoices/${id}/reminder`, data),
  downloadInvoice: (id) =>
    api.get(`/invoices/${id}/download`, { responseType: 'blob' }),
};

/* =========================================================
  FINANCIAL REPORT API
  ========================================================= */

export const financialReportAPI = {
  getReports: (params = {}) => api.get('/financial-reports', { params }),
  getSalesReport: (params = {}) => api.get('/financial-reports/sales', { params }),
  getExpensesReport: (params = {}) => api.get('/financial-reports/expenses', { params }),
  getProfitLossReport: (params = {}) => api.get('/financial-reports/profit-loss', { params }),
};

/* =========================================================
  SHIFT TYPE API
  ========================================================= */

export const shiftTypeAPI = {
  getShiftTypes: (params = {}) => api.get('/shift-types', { params }),
  getShiftType: (id) => api.get(`/shift-types/${id}`),
  createShiftType: (data) => api.post('/shift-types', data),
  updateShiftType: (id, data) => api.put(`/shift-types/${id}`, data),
  deleteShiftType: (id) => api.delete(`/shift-types/${id}`),
};

/* =========================================================
  ORDER API
  ========================================================= */

export const orderAPI = {
  getOrders: (params = {}) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  createOrder: (data) => api.post('/orders', data),
  updateOrder: (id, data) => api.put(`/orders/${id}`, data),
  deleteOrder: (id) => api.delete(`/orders/${id}`),
  updateStatus: (id, data) => api.post(`/orders/${id}/status`, data),
  addToKitchen: (id) => api.post(`/orders/${id}/add-to-kitchen`),
  removeFromKitchen: (id) => api.post(`/orders/${id}/remove-from-kitchen`),
  getKitchenOrders: () => api.get('/orders/kitchen-orders'),
  updateKitchenTask: (orderId, data) => api.put(`/orders/${orderId}/kitchen-task`, data),
  addToDelivery: (id) => api.post(`/orders/${id}/add-to-delivery`),
  removeFromDelivery: (id) => api.post(`/orders/${id}/remove-from-delivery`),
  getDeliveryOrders: () => api.get('/orders/delivery-orders'),
  updateDeliveryItem: (orderId, data) => api.put(`/orders/${orderId}/delivery-item`, data),
  computeIngredients: (id) => api.post(`/orders/${id}/compute-ingredients`),
  getIngredientsComputed: (id) => api.get(`/orders/${id}/ingredients`),
  addToShoppingList: (orderId, data) => api.post(`/orders/${orderId}/shopping-list`, data),
  getShoppingList: (params = {}) => api.get('/shopping-list', { params }),
  markShoppingItemPurchased: (itemId) =>
    api.post(`/shopping-list/items/${itemId}/purchased`),
  deleteShoppingItem: (itemId) => api.delete(`/shopping-list/items/${itemId}`),
  bulkMarkPurchased: (itemIds) =>
    api.post('/shopping-list/bulk-purchased', { item_ids: itemIds }),
  getPendingPurchasesCount: () => api.get('/shopping-list/pending-count'),
  getStatistics: () => api.get('/orders/stats'),
  createFromBooking: (bookingId) => api.post(`/bookings/${bookingId}/create-order`),
};

/* =========================================================
  CALENDAR API
  ========================================================= */

export const calendarAPI = {
  getEvents: (params = {}) => api.get('/calendar-events', { params }),
};

/* =========================================================
  INVENTORY API
  ========================================================= */

export const inventoryAPI = {
  getProducts: (params = {}) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  getProductStats: () => api.get('/products/stats'),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  restoreProduct: (id) => api.post(`/products/${id}/restore`),

  getEquipment: (params = {}) => api.get('/equipment', { params }),
  getEquipmentItem: (id) => api.get(`/equipment/${id}`),
  getEquipmentStats: () => api.get('/equipment/stats'),
  getEquipmentHistory: (id) => api.get(`/equipment/${id}/history`),
  createEquipment: (data) => api.post('/equipment', data),
  updateEquipment: (id, data) => api.put(`/equipment/${id}`, data),
  deleteEquipment: (id) => api.delete(`/equipment/${id}`),
  restoreEquipment: (id) => api.post(`/equipment/${id}/restore`),

  getMovements: (params = {}) => api.get('/inventory/movements', { params }),
  recordMovement: (data) => api.post('/inventory/movements', data),
  getWasteRecords: (params = {}) => api.get('/inventory/waste', { params }),
  recordWaste: (data) => api.post('/inventory/waste', data),
  getPurchaseRequests: (params = {}) => api.get('/inventory/purchase-requests', { params }),
  createPurchaseRequest: (data) => api.post('/inventory/purchase-requests', data),
  getSuppliers: (params = {}) => api.get('/suppliers', { params }),
  createSupplier: (data) => api.post('/suppliers', data),
  updateSupplier: (id, data) => api.put(`/suppliers/${id}`, data),
  getPurchaseSuggestions: (params = {}) =>
    api.get('/inventory/purchase-suggestions', { params }),
  getApprovedRequests: (params = {}) =>
    api.get('/inventory/approved-requests', { params }),
  getApprovedRequestFiles: () =>
    api.get('/inventory/approved-request-files'),
  renameApprovedRequestFile: (date, name) =>
    api.put(`/inventory/approved-request-files/${date}/rename`, { name }),
  updatePurchaseRequest: (id, data) =>
    api.put(`/inventory/purchase-requests/${id}`, data),
  getEquipmentReservations: (params = {}) =>
    api.get('/equipment/reservations', { params }),
  createEquipmentReservation: (data) => api.post('/equipment/reservations', data),
  updateEquipmentReservation: (id, data) =>
    api.put(`/equipment/reservations/${id}`, data),
  checkInEquipmentReservation: (id, data = {}) =>
    api.post(`/equipment/checkin/${id}`, data),
  getMaintenanceRecords: (params = {}) => api.get('/inventory/maintenance', { params }),
  createMaintenanceRecord: (data) => api.post('/inventory/maintenance', data),
  updateMaintenanceRecord: (id, data) => api.put(`/inventory/maintenance/${id}`, data),
  cancelMaintenanceRecord: (id) => api.delete(`/inventory/maintenance/${id}`),
  getDashboardStats: () => api.get('/inventory/dashboard-stats'),
  getInventorySummary: (params = {}) => api.get('/inventory/summary', { params }),
  getEquipmentWarnings: (params = {}) => api.get('/inventory/equipment-warnings', { params }),
  getItemHistory: (type, id) => api.get(`/inventory/history/${type}/${id}`),
};

/* =========================================================
  USER API
  ========================================================= */

export const userAPI = {
  getUsers: (params = {}) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => {
    if (data?.role_slug) return api.put(`/users/${id}/role`, { role_slug: data.role_slug });
    if (typeof data?.is_active === 'boolean') return api.post(`/users/${id}/toggle-active`);
    throw new Error('The existing API supports user role and active-status updates only.');
  },
  deleteUser: (id) => api.post(`/users/${id}/toggle-active`),
  getUserPermissions: (id) => api.get(`/users/${id}`),
  updateUserPermissions: (roleId, data) => api.put(`/roles/${roleId}`, data),
  getUserLoginHistory: (id) =>
    api.get('/audit-logs', { params: { user_id: id, module: 'auth' } }),
  forcePasswordReset: (id) => api.post(`/employees/${id}/force-password-reset`),
  blockUser: (id) => api.post(`/employees/${id}/block`),
  unblockUser: (id) => api.post(`/employees/${id}/unblock`),
  bulkImport: (data) => api.post('/employees/bulk-import', data),
};

export const roleAPI = {
  getRoles: (params = {}) => api.get('/roles', { params }),
  getRole: (id) => api.get(`/roles/${id}`),
  createRole: (data) => api.post('/roles', data),
  updateRole: (id, data) => api.put(`/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/roles/${id}`),
};

/* =========================================================
  SETTINGS API (EXPANDED)
  ========================================================= */
export const settingsAPI = {
  // Core section operations
  getSettings: () => api.get('/settings'),
  getSection: (section) => api.get(`/settings/${section}`),
  updateSection: (section, data) => api.put(`/settings/${section}`, { data }),
  resetSettings: () => api.post('/settings/reset'),

  // ⭐ Food Allergens master list
  getAllergens: () => api.get('/settings/allergens'),
  createAllergen: (data) => api.post('/settings/allergens', data),
  updateAllergen: (allergenId, data) =>
    api.put(`/settings/allergens/${encodeURIComponent(allergenId)}`, data),
  deleteAllergen: (allergenId) =>
    api.delete(`/settings/allergens/${encodeURIComponent(allergenId)}`),
  // Staff settings
  getStaffSnapshot: () => api.get('/settings/staff/snapshot'),
  updateStaffGroup: (group, data) => api.put(`/settings/staff/${group}`, { data }),

  // Super admin settings
  getSuperAdminSnapshot: () => api.get('/settings/system/snapshot'),
  updateSystemGroup: (group, data) => api.put(`/settings/system/${group}`, { data }),

  // Login logs
  getLoginLogs: (params = {}) => api.get('/settings/login-logs', { params }),

  // Backup & restore
  listBackups: () => api.get('/settings/backups'),
  createBackup: () => api.post('/settings/backups'),
  downloadBackup: (filename) =>
    api.get(`/settings/backups/${encodeURIComponent(filename)}/download`, { responseType: 'blob' }),
  restoreBackup: (filename, confirm) =>
    api.post(`/settings/backups/${encodeURIComponent(filename)}/restore`, { confirm }),
  deleteBackup: (filename) =>
    api.delete(`/settings/backups/${encodeURIComponent(filename)}`),

  // System status
  getSystemStatus: () => api.get('/settings/system-status'),
  clearSystemCache: () => api.post('/settings/clear-cache'),

  // Backup config
  getBackupConfig: () => api.get('/settings/system-backup-config'),
  updateBackupConfig: (data) => api.put('/settings/system-backup-config', data),

  // Role restrictions
  getRoleRestrictions: (roleSlug) => api.get(`/settings/role-restrictions/${roleSlug}`),
  updateRoleRestrictions: (roleSlug, data) => api.put(`/settings/role-restrictions/${roleSlug}`, data),

  // User account
  getUserAccountSettings: () => api.get('/settings/user-account-settings'),
  updateUserAccountSettings: (data) => api.put('/settings/user-account-settings', data),

  // Maintenance
  getMaintenanceConfig: () => api.get('/settings/maintenance-config'),
  updateMaintenanceConfig: (data) => api.put('/settings/maintenance-config', data),
  clearTempFiles: () => api.post('/settings/clear-temp-files'),
  runDatabaseMaintenance: () => api.post('/settings/run-database-maintenance'),
  forceLogoutAll: (data = {}) => api.post('/settings/force-logout-all', data),
};

export const userManagementAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUser: (userId) => api.get(`/users/${userId}`),
  createUser: (data) => api.post('/users', data),
  createUserFromEmployee: (data) => api.post('/users/from-employee', data),
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),
  updateUserRole: (userId, roleSlug) => api.put(`/users/${userId}/role`, { role_slug: roleSlug }),
  toggleUserActive: (userId) => api.post(`/users/${userId}/toggle-active`),
  banUser: (userId) => api.post(`/users/${userId}/ban`),
  unbanUser: (userId) => api.post(`/users/${userId}/unban`),
  forceLogoutUser: (userId) => api.post(`/users/${userId}/force-logout`),
  forceChangePassword: (userId, data) => api.post(`/users/${userId}/force-password`, data),

  getRoles: () => api.get('/roles'),

  getEmployeesWithoutAccounts: async (params) => {
    const res = await api.get('/employees/without-accounts', { params });
    return { data: res.data?.data || { data: [], total: 0 } };
  },

  getEmployeeForAccount: (employeeId) => api.get(`/employees/${employeeId}/for-account`),
};

export const auditAPI = {
  getAuditLogs: (params = {}) => api.get('/audit-logs', { params }),
  getAuditCatalog: () => api.get('/audit-logs/catalog'),
  exportAuditLogs: (params = {}) =>
    api.get('/audit-logs/export', { params, responseType: 'blob' }),
};

/* =========================================================
  DELIVERY ZONES API
  ========================================================= */

export const deliveryZoneAPI = {
  getAll: (params = {}) => api.get('/delivery-zones', { params }),
  getById: (id) => api.get(`/delivery-zones/${id}`),
  create: (data) => api.post('/delivery-zones', data),
  update: (id, data) => api.put(`/delivery-zones/${id}`, data),
  delete: (id) => api.delete(`/delivery-zones/${id}`),
  toggleStatus: (id) => api.post(`/delivery-zones/${id}/toggle`),
};

/* =========================================================
  SYSTEM ANNOUNCEMENTS API
  ========================================================= */

export const announcementAPI = {
  getAll: () => api.get('/system-announcements'),
  create: (data) => api.post('/system-announcements', data),
  update: (id, data) => api.put(`/system-announcements/${id}`, data),
  delete: (id) => api.delete(`/system-announcements/${id}`),
  getActive: () => api.get('/announcements/active'),
};

/* =========================================================
  FOOD ALLERGENS API — Master list of food allergens
  Reuses the existing Setting model via /settings/allergens.
  ========================================================= */
export const allergenAPI = {
  getAll: () => api.get('/settings/allergens'),
  create: (data) => api.post('/settings/allergens', data),
  update: (allergenId, data) =>
    api.put(`/settings/allergens/${encodeURIComponent(allergenId)}`, data),
  delete: (allergenId) =>
    api.delete(`/settings/allergens/${encodeURIComponent(allergenId)}`),
};

/* =========================================================
  INSIGHT VISIBILITY API — Hide/Unhide KPI values
  Sends BOTH shapes so the controller accepts either style.
  ========================================================= */

/* =========================================================
  INSIGHT VISIBILITY API (REQUEST #6, #7, #8)
  Persisted per-card visibility. Admin-only write.
  Reuses the existing /settings/{section} endpoint so no
  new backend controller/migration is required.
  ========================================================= */
export const insightVisibilityAPI = {
  get: () => api.get('/settings/insight-visibility'),
  update: (data) => api.put('/settings/insight-visibility', {
    ...data,
    data,
  }),
};

/* =========================================================
  BILLING KPI VISIBILITY — Hide/Unhide Billing KPI cards.
  Mirrors the financial-visibility pattern so cashiers
  see the mask instantly without a refresh.
  ========================================================= */
export const billingVisibilityAPI = {
  get: () => api.get('/settings/billing-visibility'),
  update: (data) => api.put('/settings/billing-visibility', data),
};
/* =========================================================
  BACKUP CONFIG API
  ========================================================= */

export const backupConfigAPI = {
  get: () => api.get('/settings/system-backup-config'),
  update: (data) => api.put('/settings/system-backup-config', data),
};

/* =========================================================
  ROLE RESTRICTIONS API
  ========================================================= */

export const roleRestrictionsAPI = {
  get: (roleSlug) => api.get(`/settings/role-restrictions/${roleSlug}`),
  update: (roleSlug, data) => api.put(`/settings/role-restrictions/${roleSlug}`, data),
};

/* =========================================================
  USER ACCOUNT SETTINGS API (NEW — was missing)
  ========================================================= */

export const userAccountSettingsAPI = {
  get: () => api.get('/settings/user-account-settings'),
  update: (data) => api.put('/settings/user-account-settings', data),
};

/* =========================================================
  MAINTENANCE API (NEW — was missing)
  ========================================================= */

export const maintenanceAPI = {
  getConfig: () => api.get('/settings/maintenance-config'),
  updateConfig: (data) => api.put('/settings/maintenance-config', data),
  clearTempFiles: () => api.post('/settings/clear-temp-files'),
  runDatabaseMaintenance: () => api.post('/settings/run-database-maintenance'),
  forceLogoutAll: (data = {}) => api.post('/settings/force-logout-all', data),
};

/* =========================================================
  COMPATIBILITY ALIASES
  ========================================================= */

export const schedulingAPI = scheduleAPI;
export const employeeRequestsAPI = employeeRequestAPI;

export default api;