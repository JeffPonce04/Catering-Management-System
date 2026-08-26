// src/components/Staff/Staff_Payroll_Formal.jsx - ENHANCED PROFESSIONAL VERSION

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TeamOutlined, SearchOutlined, DownloadOutlined,
  ClockCircleOutlined, CalendarOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, PlusOutlined,
  CheckCircleOutlined, WarningOutlined, ReloadOutlined,
  LeftOutlined, RightOutlined, DollarOutlined,
  RiseOutlined, SettingOutlined, HistoryOutlined,
  FileExcelOutlined, CalculatorOutlined, QuestionCircleOutlined,
  CheckOutlined, WalletOutlined, FilePdfOutlined,
  MinusCircleOutlined, SaveOutlined, DeleteOutlined as DeleteIcon,
  UndoOutlined, ThunderboltOutlined, PrinterOutlined,
  MailOutlined, FileTextOutlined, AppstoreOutlined,
  ScheduleOutlined, UserOutlined, EnvironmentOutlined,
  TagOutlined, TrophyOutlined, MenuOutlined, FilterOutlined,
  LoadingOutlined, InfoCircleOutlined, SafetyOutlined,
  ClockCircleOutlined as ClockIcon, UserSwitchOutlined,
  BankOutlined, SecurityScanOutlined, DashboardOutlined,
  PieChartOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import { payrollAPI, employeeAPI, departmentAPI, payslipAPI, attendanceAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, hasAllowedRole } from '../../../utils/roleRoutes';
import { 
  message, Modal, Spin, Alert, Row, Col, Card, Avatar, Badge, 
  Tag, Button, Input, Statistic, Divider, InputNumber, Switch, 
  Tabs, Space, Tooltip, Checkbox, Dropdown, ConfigProvider, 
  theme as antdTheme, Typography, Progress, List, Empty,
  Table, Form, Select, DatePicker, Radio, App, Descriptions,
  Timeline, Steps, Collapse
} from 'antd';
import dayjs from 'dayjs';
import '../styles/StaffPayroll.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

// ============================================================
// SAFE VALUE HELPERS
// ============================================================
const safeString = (value, defaultValue = '') => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return defaultValue;
  return String(value);
};

const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const unwrapResponse = (value) => {
  const body = value?.data ?? value;
  if (body?.success && Object.prototype.hasOwnProperty.call(body, 'data')) return body.data;
  return body;
};

const safeArray = (value, defaultValue = []) => {
  if (Array.isArray(value)) return value;
  const body = value?.data ?? value;
  if (Array.isArray(unwrapResponse(value))) return unwrapResponse(value);
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  if (Array.isArray(body?.employees)) return body.employees;
  if (Array.isArray(body?.data?.employees)) return body.data.employees;
  return defaultValue;
};

const safeObject = (value, defaultValue = {}) => {
  const body = value?.data ?? value;
  const unwrapped = unwrapResponse(value);
  if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) return unwrapped;
  if (body?.success && body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  return defaultValue;
};

const getPagination = (value) => {
  const body = value?.data ?? value;
  return body?.pagination || body?.data?.pagination || body?.meta || body?.data?.meta || {};
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatDateSafe = (dateValue, format = 'MMM DD, YYYY') => {
  if (!dateValue) return 'N/A';
  try {
    const parsed = dayjs(dateValue);
    return parsed.isValid() ? parsed.format(format) : 'Invalid Date';
  } catch (e) {
    return 'Invalid Date';
  }
};

// ============================================================
// UI CONFIGURATION
// ============================================================
const payrollStatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' }
];

const getStatusConfig = (status) => {
  const config = {
    paid: { text: 'Paid', color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
    approved: { text: 'Approved', color: '#2563eb', background: '#eff6ff', icon: <CheckCircleOutlined /> },
    calculated: { text: 'Calculated', color: '#8b5cf6', background: '#f5f3ff', icon: <CalculatorOutlined /> },
    draft: { text: 'Draft', color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
    cancelled: { text: 'Cancelled', color: '#ef4444', background: '#fef2f2', icon: <WarningOutlined /> },
    pending: { text: 'Pending', color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
    processing: { text: 'Processing', color: '#8b5cf6', background: '#f5f3ff', icon: <SettingOutlined /> }
  };
  return config[status] || config.pending;
};

// ============================================================
// EMPLOYEE TYPE CONSTANTS
// ============================================================
const EMPLOYEE_TYPES = {
  REGULAR: 'regular',
  ON_CALL: 'on_call',
  CONTRACT: 'contract',
  PART_TIME: 'part_time'
};

// ============================================================
// DEDUCTION SCHEDULE
// ============================================================
const DEDUCTION_SCHEDULE = {
  FIRST_CUTOFF: 'first',
  SECOND_CUTOFF: 'second',
};

// ============================================================
// REACT QUERY KEYS
// ============================================================
const payrollQueryKeys = {
  all: ['payroll'],
  list: (params) => [...payrollQueryKeys.all, 'list', params],
  history: (params) => [...payrollQueryKeys.all, 'history', params],
  stats: (params) => [...payrollQueryKeys.all, 'stats', params],
  historyStats: (params) => [...payrollQueryKeys.all, 'historyStats', params],
  eligibleEmployees: (params) => [...payrollQueryKeys.all, 'eligibleEmployees', params],
  preview: (params) => [...payrollQueryKeys.all, 'preview', params],
  payslips: (params) => [...payrollQueryKeys.all, 'payslips', params],
  departments: () => ['departments'],
  attendance: (params) => ['attendance', params],
};

// ============================================================
// REACT QUERY HOOKS
// ============================================================
const usePayrollList = (params) => {
  return useQuery({
    queryKey: payrollQueryKeys.list(params),
    queryFn: () => payrollAPI.getAll(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!params?.start_date && !!params?.end_date,
  });
};

const usePayrollHistory = (params) => {
  return useQuery({
    queryKey: payrollQueryKeys.history(params),
    queryFn: () => payrollAPI.getHistory(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!params?.start_date && !!params?.end_date,
  });
};

const usePayrollStats = (params) => {
  return useQuery({
    queryKey: payrollQueryKeys.stats(params),
    queryFn: () => payrollAPI.getStats(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!params?.start_date && !!params?.end_date,
  });
};

const usePayrollHistoryStats = (params) => {
  return useQuery({
    queryKey: payrollQueryKeys.historyStats(params),
    queryFn: () => payrollAPI.getHistoryStats(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!params?.start_date && !!params?.end_date,
  });
};

const useEligibleEmployees = (params) => {
  return useQuery({
    queryKey: payrollQueryKeys.eligibleEmployees(params),
    queryFn: () => employeeAPI.getEligibleForPayroll(params),
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
    enabled: !!params?.start_date && !!params?.end_date,
  });
};

const useAttendanceForPayroll = (params) => {
  return useQuery({
    queryKey: payrollQueryKeys.attendance(params),
    queryFn: () => attendanceAPI.getDateRange(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!params?.start_date && !!params?.end_date,
  });
};

const useDepartmentsList = () => {
  return useQuery({
    queryKey: payrollQueryKeys.departments(),
    queryFn: () => departmentAPI.getAll(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

// ============================================================
// MUTATIONS
// ============================================================
const useProcessPayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => payrollAPI.processSelected(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.eligibleEmployees() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.preview() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.attendance() });
      const payload = safeObject(response, {});
      const processed = safeNumber(payload.processed_count, 0);
      const skipped = safeNumber(payload.skipped_count, 0);
      if (processed > 0) {
        message.success(`${processed} payroll record(s) processed${skipped ? `; ${skipped} skipped` : ''}.`);
      } else {
        message.warning('No payroll records were ready. Review the attendance status shown for each employee.');
      }
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to process payroll');
    },
  });
};

const usePreviewPayroll = () => {
  return useMutation({
    mutationFn: (data) => payrollAPI.previewPayroll(data),
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to preview payroll');
    },
  });
};

const useUpdatePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => payrollAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
      message.success('Payroll updated successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to update payroll');
    },
  });
};

const useApprovePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      message.success('Payroll approved successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to approve payroll');
    },
  });
};

const useMarkAsPaid = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => payrollAPI.markAsPaid(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      message.success('Payroll marked as paid and moved to history');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to mark as paid');
    },
  });
};

const useDeletePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.historyStats() });
      message.success('Payroll moved to history archive');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to delete payroll');
    },
  });
};

const useRestorePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.historyStats() });
      message.success('Payroll restored from history');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to restore payroll');
    },
  });
};

const usePermanentDeletePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.historyStats() });
      message.success('Payroll permanently deleted');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to permanently delete');
    },
  });
};

const useBulkUpdateDeductions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => payrollAPI.bulkUpdateDeductions(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
      message.success('Bulk deductions applied successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to apply bulk deductions');
    },
  });
};

// ============================================================
// PAYSLIP MUTATIONS
// ============================================================
const useGeneratePayslip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => payslipAPI.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
      message.success('Payslip generated successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to generate payslip');
    },
  });
};

const useBulkGeneratePayslips = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payrollIds) => payslipAPI.bulkGenerate(payrollIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips });
      message.success('Payslips generated successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to generate payslips');
    },
  });
};

const useDownloadPayslip = () => {
  return useMutation({
    mutationFn: (id) => payslipAPI.download(id),
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to download payslip');
    },
  });
};

const usePreviewPayslip = () => {
  return useMutation({
    mutationFn: (payrollId) => payslipAPI.preview(payrollId),
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to preview payslip');
    },
  });
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const Staff_Payroll_Formal = () => {
  const queryClient = useQueryClient();
  const isMounted = useRef(true);
  const { user } = useAuth();
  const canFinalizePayroll = hasAllowedRole(user, ADMIN_ROLES);
  const currentUserName = user?.person?.full_name || user?.name || user?.username || '';

  // ========================================================
  // LOCAL STATE
  // ========================================================
  const [cutoffType, setCutoffType] = useState('first');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('active');
  const pageSize = 10;
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Employee selection
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('all');
  const [selectedEmployeesForPayroll, setSelectedEmployeesForPayroll] = useState([]);
  const [selectAllEmployees, setSelectAllEmployees] = useState(false);

  // Bulk selection
  const [selectedPayrollIds, setSelectedPayrollIds] = useState([]);

  // Modal states
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showEmployeeSelectionModal, setShowEmployeeSelectionModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEditDeductionsModal, setShowEditDeductionsModal] = useState(false);
  const [showHistoryDetailsModal, setShowHistoryDetailsModal] = useState(false);
  const [showBulkDeductionModal, setShowBulkDeductionModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showPayslipPreviewModal, setShowPayslipPreviewModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedPayrollForEdit, setSelectedPayrollForEdit] = useState(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [payslipPreview, setPayslipPreview] = useState(null);
  const [payrollPreview, setPayrollPreview] = useState(null);
  const [processNotes, setProcessNotes] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Bulk deduction states
  const [bulkDeductionAmount, setBulkDeductionAmount] = useState(0);
  const [bulkDeductionReason, setBulkDeductionReason] = useState('');
  const [bulkDeductionType, setBulkDeductionType] = useState('other');
  const [bulkDeductionCategory, setBulkDeductionCategory] = useState('company');

  // Formal deduction states
  const [deductionType, setDeductionType] = useState('cash_advance');
  const [deductionCategory, setDeductionCategory] = useState('loan');
  const [deductionReference, setDeductionReference] = useState('');
  const [deductionDate, setDeductionDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [deductionApprovedBy, setDeductionApprovedBy] = useState('');
  const [manualDeductionAmount, setManualDeductionAmount] = useState(0);
  const [manualDeductionReason, setManualDeductionReason] = useState('');
  const [enableManualDeduction, setEnableManualDeduction] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // ========================================================
  // MUTATION HOOKS
  // ========================================================
  const processPayrollMutation = useProcessPayroll();
  const previewPayrollMutation = usePreviewPayroll();
  const updatePayrollMutation = useUpdatePayroll();
  const approvePayrollMutation = useApprovePayroll();
  const markAsPaidMutation = useMarkAsPaid();
  const deletePayrollMutation = useDeletePayroll();
  const restorePayrollMutation = useRestorePayroll();
  const permanentDeleteMutation = usePermanentDeletePayroll();
  const bulkUpdateDeductionsMutation = useBulkUpdateDeductions();
  const generatePayslipMutation = useGeneratePayslip();
  const bulkGeneratePayslipsMutation = useBulkGeneratePayslips();
  const downloadPayslipMutation = useDownloadPayslip();
  const previewPayslipMutation = usePreviewPayslip();

  // ========================================================
  // THEME DETECTION
  // ========================================================
  useEffect(() => {
    const detectTheme = () => {
      if (!isMounted.current) return;
      setIsDarkMode(document.body.classList.contains('dark-mode'));
    };
    detectTheme();
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => {
      isMounted.current = false;
      observer.disconnect();
    };
  }, []);

  // ========================================================
  // HELPER FUNCTIONS
  // ========================================================
  const getCutoffDates = useCallback((year, month, cutoff) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    let start, end, label, shortLabel;
    
    if (cutoff === 'first') {
      start = new Date(year, month, 1);
      end = new Date(year, month, 15, 23, 59, 59);
      label = `${startDate.toLocaleString('default', { month: 'long' })} 1-15, ${year}`;
      shortLabel = '1st Cutoff';
    } else {
      start = new Date(year, month, 16);
      end = new Date(year, month + 1, 0, 23, 59, 59);
      label = `${startDate.toLocaleString('default', { month: 'long' })} 16-${endDate.getDate()}, ${year}`;
      shortLabel = '2nd Cutoff';
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      label = 'Invalid period';
      shortLabel = 'Invalid';
    }

    return {
      start,
      end,
      label,
      shortLabel,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, []);

  const currentCutoff = useMemo(() => {
    try {
      return getCutoffDates(selectedYear, selectedMonth, cutoffType);
    } catch (error) {
      console.error('Error calculating cutoff dates:', error);
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        label: 'Current Period',
        shortLabel: 'Current',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      };
    }
  }, [selectedYear, selectedMonth, cutoffType, getCutoffDates]);

  const periodLabel = currentCutoff.label || 'Current Period';

  const getDeductionScheduleInfo = useCallback(() => {
    if (cutoffType === 'first') {
      return {
        label: '1st Cutoff (1-15)',
        deductions: ['SSS'],
        description: 'SSS contribution is deducted on the 1st cutoff of the month.'
      };
    } else {
      return {
        label: '2nd Cutoff (16-End)',
        deductions: ['PhilHealth', 'Pag-IBIG'],
        description: 'PhilHealth and Pag-IBIG contributions are deducted on the 2nd cutoff of the month.'
      };
    }
  }, [cutoffType]);

  const deductionScheduleInfo = getDeductionScheduleInfo();

  const getEmployeeType = (employee) => {
    const position = safeString(employee?.position?.title || employee?.position_name || '').toLowerCase();
    const employmentType = safeString(employee?.employment_type || employee?.employee_type || '').toLowerCase();
    
    if (employmentType === 'on_call' || employmentType === 'on-call' || position.includes('on-call')) {
      return EMPLOYEE_TYPES.ON_CALL;
    }
    if (employmentType === 'contract' || position.includes('contract')) {
      return EMPLOYEE_TYPES.CONTRACT;
    }
    if (employmentType === 'part_time' || employmentType === 'part-time' || position.includes('part-time')) {
      return EMPLOYEE_TYPES.PART_TIME;
    }
    return EMPLOYEE_TYPES.REGULAR;
  };

  // ========================================================
  // REACT QUERY PARAMS
  // ========================================================
  const payrollParams = useMemo(() => {
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    return {
      page: currentPage,
      per_page: pageSize,
      start_date: startDate,
      end_date: endDate,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      department_id: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      search: searchQuery || undefined
    };
  }, [currentPage, currentCutoff, selectedStatus, selectedDepartment, searchQuery, pageSize]);

  const historyParams = useMemo(() => {
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    return {
      page: historyCurrentPage,
      per_page: pageSize,
      start_date: startDate,
      end_date: endDate,
      department_id: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      search: searchQuery || undefined
    };
  }, [historyCurrentPage, currentCutoff, selectedDepartment, searchQuery, pageSize]);

  const statsParams = useMemo(() => {
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    return {
      start_date: startDate,
      end_date: endDate
    };
  }, [currentCutoff]);

  const eligibleParams = useMemo(() => {
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    return {
      start_date: startDate,
      end_date: endDate,
      department_id: employeeDepartmentFilter !== 'all' ? employeeDepartmentFilter : undefined
    };
  }, [currentCutoff, employeeDepartmentFilter]);

  const attendanceParams = useMemo(() => {
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    return {
      start_date: startDate,
      end_date: endDate,
      per_page: 1000
    };
  }, [currentCutoff]);

  // ========================================================
  // REACT QUERY DATA FETCHING
  // ========================================================
  const { data: payrollDataRes, isLoading: payrollLoading, refetch: refetchPayroll } = usePayrollList(payrollParams);
  const { data: historyDataRes, isLoading: historyLoading, refetch: refetchHistory } = usePayrollHistory(historyParams);
  const { data: statsRes, refetch: refetchStats } = usePayrollStats(statsParams);
  const { data: historyStatsRes, refetch: refetchHistoryStats } = usePayrollHistoryStats(statsParams);
  const { data: eligibleRes, refetch: refetchEligible } = useEligibleEmployees(eligibleParams);
  const { data: departmentsRes } = useDepartmentsList();
  const { data: attendanceRes, refetch: refetchAttendance } = useAttendanceForPayroll(attendanceParams);

  const payrollData = safeArray(payrollDataRes);
  const payrollMeta = getPagination(payrollDataRes);
  const totalPages = payrollMeta?.last_page || 1;
  
  const payrollHistory = safeArray(historyDataRes);
  const historyMeta = getPagination(historyDataRes);
  const historyTotalPages = historyMeta?.last_page || 1;
  
  const statistics = statsRes?.data?.data?.statistics || statsRes?.data?.statistics || statsRes?.data?.data || null;
  const historyStatistics = historyStatsRes?.data?.data?.statistics || historyStatsRes?.data?.statistics || historyStatsRes?.data?.data || null;
  
  const eligiblePayload = safeObject(eligibleRes, {});
  const eligibleEmployees = safeArray(eligiblePayload?.employees || eligibleRes);
  const eligibilitySummary = eligiblePayload?.summary || null;
  
  const departments = safeArray(departmentsRes);
  const attendanceData = safeArray(attendanceRes);

  const filteredData = useMemo(() => {
    if (!Array.isArray(payrollData)) return [];
    return payrollData.filter(item => {
      const deptMatch = selectedDepartment === 'all' || item.employee?.department_id == selectedDepartment;
      const statusMatch = selectedStatus === 'all' || item.status === selectedStatus;
      const searchMatch = !searchQuery || 
        (item.employee?.full_name && item.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.employee?.employee_id && item.employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.payroll_number && item.payroll_number.toLowerCase().includes(searchQuery.toLowerCase()));
      return deptMatch && statusMatch && searchMatch;
    });
  }, [payrollData, selectedDepartment, selectedStatus, searchQuery]);

  const paginatedData = useMemo(() => {
    return filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredData, currentPage, pageSize]);

  const filteredEligibleEmployees = useMemo(() => {
    const normalizedSearch = employeeSearchQuery.trim().toLowerCase();

    return (eligibleEmployees || []).filter((emp) => {
      const matchesSearch = !normalizedSearch
        || safeString(emp.full_name).toLowerCase().includes(normalizedSearch)
        || safeString(emp.employee_code).toLowerCase().includes(normalizedSearch)
        || safeString(emp.employee_id).toLowerCase().includes(normalizedSearch);
      const matchesDepartment = employeeDepartmentFilter === 'all'
        || String(emp.department_id) === String(employeeDepartmentFilter);

      return matchesSearch && matchesDepartment;
    });
  }, [eligibleEmployees, employeeSearchQuery, employeeDepartmentFilter]);
  
  const selectableEligibleEmployees = useMemo(
    () => filteredEligibleEmployees.filter((emp) => emp.eligible),
    [filteredEligibleEmployees]
  );

  const isAllSelected = useMemo(() => {
    return selectableEligibleEmployees.length > 0 &&
      selectableEligibleEmployees.every(emp => selectedEmployeesForPayroll.includes(emp.id));
  }, [selectableEligibleEmployees, selectedEmployeesForPayroll]);

  // ========================================================
  // HANDLERS
  // ========================================================
  const handleViewPayroll = useCallback((item) => {
    setSelectedEmployee(item);
    setShowPayrollModal(true);
  }, []);

  const handleViewAttendance = useCallback(async (employee) => {
    try {
      const startDate = currentCutoff.startDate;
      const endDate = currentCutoff.endDate;

      const response = await attendanceAPI.getDateRange({
        employee_id: employee.employee_id,
        start_date: startDate,
        end_date: endDate,
        per_page: 1000
      });
      
      const data = safeArray(response);
      setAttendanceRecords(data);
      setSelectedEmployee(employee);
      setShowAttendanceModal(true);
    } catch (error) {
      message.error('Failed to load attendance records');
      console.error('Attendance view error:', error);
    }
  }, [currentCutoff]);

  const handleEditDeductions = useCallback((payroll) => {
    setSelectedPayrollForEdit(payroll);
    setEnableManualDeduction((payroll.manual_deductions || 0) > 0);
    setManualDeductionAmount(payroll.manual_deductions || 0);
    setManualDeductionReason(payroll.manual_deduction_notes || '');
    setDeductionType(payroll.deduction_type || 'cash_advance');
    setDeductionCategory(payroll.deduction_category || 'loan');
    setDeductionReference(payroll.deduction_reference || '');
    setDeductionDate(payroll.deduction_date || dayjs().format('YYYY-MM-DD'));
    setDeductionApprovedBy(payroll.deduction_approved_by || '');
    setShowEditDeductionsModal(true);
  }, []);

  const handleApprovePayroll = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Approve Payroll',
      content: 'Approve this calculated payroll for payment?',
      okText: 'Approve Payroll',
      cancelText: 'Cancel',
      onOk: async () => {
        await approvePayrollMutation.mutateAsync(payrollId);
      }
    });
  }, [approvePayrollMutation]);

  const handleMarkAsPaid = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Payment',
      content: 'Mark this approved payroll as paid? It will be removed from the active table and moved to Payroll History.',
      okText: 'Confirm Payment',
      cancelText: 'Cancel',
      onOk: async () => {
        await markAsPaidMutation.mutateAsync({ id: payrollId, data: { payment_method: 'bank_transfer' } });
        setSelectedPayrollIds(prev => prev.filter(id => id !== payrollId));
      }
    });
  }, [markAsPaidMutation]);

  const handleDeletePayroll = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Deletion',
      content: 'Are you sure you want to delete this payroll record? It will be moved to history.',
      okText: 'Move to History',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deletePayrollMutation.mutateAsync(payrollId);
        setSelectedPayrollIds(prev => prev.filter(id => id !== payrollId));
      }
    });
  }, [deletePayrollMutation]);

  const handleRestorePayroll = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Restoration',
      content: 'Are you sure you want to restore this payroll record?',
      okText: 'Restore',
      cancelText: 'Cancel',
      onOk: async () => {
        await restorePayrollMutation.mutateAsync(payrollId);
      }
    });
  }, [restorePayrollMutation]);

  const handlePermanentDelete = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Permanent Deletion',
      content: 'Are you sure you want to permanently delete this payroll record? This action cannot be undone.',
      okText: 'Permanently Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        await permanentDeleteMutation.mutateAsync(payrollId);
      }
    });
  }, [permanentDeleteMutation]);

  const handleGeneratePayslip = useCallback(async (payrollId) => {
    try {
      const result = await generatePayslipMutation.mutateAsync({ payroll_id: payrollId });
      if (result?.data?.success) {
        message.success('Payslip generated successfully');
        setSelectedPayslip(result.data.data);
        setShowPayslipModal(true);
      }
    } catch (error) {
      console.error('Generate payslip error:', error);
    }
  }, [generatePayslipMutation]);

  const handleBulkGeneratePayslips = useCallback(async () => {
    if (selectedPayrollIds.length === 0) {
      message.warning('Please select payroll records first');
      return;
    }
    Modal.confirm({
      title: 'Bulk Generate Payslips',
      content: `Are you sure you want to generate payslips for ${selectedPayrollIds.length} payroll record(s)?`,
      okText: 'Generate',
      cancelText: 'Cancel',
      onOk: async () => {
        await bulkGeneratePayslipsMutation.mutateAsync(selectedPayrollIds);
        setSelectedPayrollIds([]);
      }
    });
  }, [selectedPayrollIds, bulkGeneratePayslipsMutation]);

  const handlePreviewPayslip = useCallback(async (payrollId) => {
    try {
      const result = await previewPayslipMutation.mutateAsync(payrollId);
      if (result?.data?.success) {
        setPayslipPreview(result.data.data);
        setShowPayslipPreviewModal(true);
      }
    } catch (error) {
      console.error('Preview payslip error:', error);
    }
  }, [previewPayslipMutation]);

  const handleDownloadPayslip = useCallback(async (payslipId) => {
    try {
      const result = await downloadPayslipMutation.mutateAsync(payslipId);
      if (result?.data?.success) {
        const pdfData = result.data.data;
        if (pdfData.pdf_url) {
          window.open(pdfData.pdf_url, '_blank');
        } else {
          message.success('Payslip ready for download');
        }
      }
    } catch (error) {
      console.error('Download payslip error:', error);
    }
  }, [downloadPayslipMutation]);

  const getPayrollActionMenu = useCallback((item) => ({
    items: [
      {
        key: 'view',
        label: 'View Details',
        icon: <EyeOutlined />,
        onClick: () => handleViewPayroll(item)
      },
      {
        key: 'attendance',
        label: 'View Attendance',
        icon: <ScheduleOutlined />,
        onClick: () => handleViewAttendance(item.employee)
      },
      {
        key: 'payslip',
        label: 'Generate Payslip',
        icon: <FilePdfOutlined />,
        onClick: () => handleGeneratePayslip(item.id)
      },
      {
        key: 'preview-payslip',
        label: 'Preview Payslip',
        icon: <FileTextOutlined />,
        onClick: () => handlePreviewPayslip(item.id)
      },
      {
        key: 'divider-1',
        type: 'divider'
      },
      {
        key: 'edit-deductions',
        label: 'Edit Deductions',
        icon: <CalculatorOutlined />,
        onClick: () => handleEditDeductions(item),
        disabled: item.status === 'paid'
      },
      {
        key: 'approve-payroll',
        label: 'Approve Payroll',
        icon: <CheckCircleOutlined />,
        onClick: () => handleApprovePayroll(item.id),
        disabled: item.status === 'approved' || item.status === 'paid' || item.status === 'cancelled'
      },
      {
        key: 'mark-paid',
        label: 'Mark as Paid & Archive',
        icon: <CheckOutlined />,
        onClick: () => handleMarkAsPaid(item.id),
        disabled: item.status !== 'approved'
      },
      {
        key: 'divider-2',
        type: 'divider'
      },
      {
        key: 'delete',
        label: 'Move to History',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDeletePayroll(item.id),
        disabled: item.status === 'paid'
      }
    ].filter((entry) => canFinalizePayroll || !['approve-payroll', 'mark-paid', 'delete', 'divider-2'].includes(entry.key))
  }), [canFinalizePayroll, handleViewPayroll, handleViewAttendance, handleGeneratePayslip, handlePreviewPayslip, handleEditDeductions, handleApprovePayroll, handleMarkAsPaid, handleDeletePayroll]);

  // ========================================================
  // PROCESS PAYROLL
  // ========================================================
  const handleProcessPayroll = useCallback(async () => {
    if (selectedEmployeesForPayroll.length === 0) {
      message.warning('Please select at least one employee');
      return;
    }

    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    if (!startDate || !endDate) {
      message.error('Invalid payroll period dates. Please select a valid cutoff.');
      return;
    }

    const data = {
      period_start: startDate,
      period_end: endDate,
      start_date: startDate,
      end_date: endDate,
      employee_ids: selectedEmployeesForPayroll,
      notes: processNotes || 'Payroll processed from attendance',
      cutoff_type: cutoffType,
    };

    try {
      const result = await processPayrollMutation.mutateAsync(data);
      if (result?.data?.success) {
        message.success(`Payroll processed for ${selectedEmployeesForPayroll.length} employee(s)`);
        setShowEmployeeSelectionModal(false);
        setSelectedEmployeesForPayroll([]);
        setSelectAllEmployees(false);
        setProcessNotes('');
        await refetchPayroll();
        await refetchStats();
        await refetchEligible();
        await refetchAttendance();
      } else {
        const errorMsg = result?.data?.message || 'Failed to process payroll';
        message.error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.errors?.start_date?.[0] ||
                          error?.response?.data?.errors?.period_start?.[0] ||
                          error?.message || 
                          'Failed to process payroll. Please check the attendance records and try again.';
      message.error(errorMessage);
      console.error('Payroll processing error:', error);
    }
  }, [
    selectedEmployeesForPayroll, 
    currentCutoff, 
    processNotes, 
    cutoffType, 
    processPayrollMutation, 
    refetchPayroll, 
    refetchStats, 
    refetchEligible,
    refetchAttendance
  ]);

  // ========================================================
  // PREVIEW PAYROLL
  // ========================================================
  const handlePreviewPayroll = useCallback(async () => {
    if (selectedEmployeesForPayroll.length === 0) {
      message.warning('Please select at least one employee');
      return;
    }

    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    if (!startDate || !endDate) {
      message.error('Invalid payroll period dates. Please select a valid cutoff.');
      return;
    }

    const data = {
      employee_ids: selectedEmployeesForPayroll,
      period_start: startDate,
      period_end: endDate,
      start_date: startDate,
      end_date: endDate,
      cutoff_type: cutoffType,
    };

    try {
      const result = await previewPayrollMutation.mutateAsync(data);
      if (result?.data?.success) {
        setPayrollPreview(result.data.data);
        setShowPreviewModal(true);
      } else {
        const errorMsg = result?.data?.message || 'Failed to preview payroll';
        message.error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.errors?.start_date?.[0] ||
                          error?.response?.data?.errors?.period_start?.[0] ||
                          error?.message || 
                          'Failed to preview payroll';
      message.error(errorMessage);
      console.error('Preview payroll error:', error);
    }
  }, [selectedEmployeesForPayroll, currentCutoff, cutoffType, previewPayrollMutation]);

  // ========================================================
  // EXPORT
  // ========================================================
  const handleExport = useCallback(async () => {
    try {
      const startDate = currentCutoff.startDate;
      const endDate = currentCutoff.endDate;

      const response = await payrollAPI.export({
        start_date: startDate,
        end_date: endDate
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payroll_${currentCutoff.label.replace(/[^a-z0-9]/gi, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Export started');
    } catch (error) {
      message.error('Failed to export payroll');
      console.error('Export error:', error);
    }
  }, [currentCutoff]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchPayroll(), 
      refetchStats(), 
      refetchHistory(), 
      refetchHistoryStats(), 
      refetchEligible(),
      refetchAttendance()
    ]);
    message.success('Data refreshed successfully');
  }, [refetchPayroll, refetchStats, refetchHistory, refetchHistoryStats, refetchEligible, refetchAttendance]);

  const changeCutoff = useCallback((direction) => {
    if (direction === 'prev') {
      if (cutoffType === 'first') {
        setCutoffType('second');
        let newMonth = selectedMonth - 1;
        let newYear = selectedYear;
        if (newMonth < 0) {
          newMonth = 11;
          newYear--;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
      } else {
        setCutoffType('first');
      }
    } else {
      if (cutoffType === 'second') {
        setCutoffType('first');
        let newMonth = selectedMonth + 1;
        let newYear = selectedYear;
        if (newMonth > 11) {
          newMonth = 0;
          newYear++;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
      } else {
        setCutoffType('second');
      }
    }
    setCurrentPage(1);
    setHistoryCurrentPage(1);
    setSelectedPayrollIds([]);
  }, [cutoffType, selectedMonth, selectedYear]);

  const goToCurrentPeriod = useCallback(() => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setCutoffType(now.getDate() <= 15 ? 'first' : 'second');
    setCurrentPage(1);
    setHistoryCurrentPage(1);
    setSelectedPayrollIds([]);
  }, []);

  const openEmployeeSelectionModal = useCallback(() => {
    setEmployeeSearchQuery('');
    setEmployeeDepartmentFilter('all');
    setSelectedEmployeesForPayroll([]);
    setSelectAllEmployees(false);
    setShowEmployeeSelectionModal(true);
  }, []);

  const resetDeductionForm = useCallback(() => {
    setEnableManualDeduction(false);
    setManualDeductionAmount(0);
    setManualDeductionReason('');
    setDeductionType('cash_advance');
    setDeductionCategory('loan');
    setDeductionReference('');
    setDeductionDate(dayjs().format('YYYY-MM-DD'));
    setDeductionApprovedBy('');
    setSelectedPayrollForEdit(null);
  }, []);

  const handleSaveManualDeductions = useCallback(async () => {
    if (!selectedPayrollForEdit) return;
    const deductionAmount = enableManualDeduction ? manualDeductionAmount : 0;
    const data = {
      manual_deductions: deductionAmount,
      manual_deduction_notes: manualDeductionReason,
      deduction_type: deductionType,
      deduction_category: deductionCategory,
      deduction_reference: deductionReference,
      deduction_date: deductionDate,
      deduction_approved_by: canFinalizePayroll ? (deductionApprovedBy || currentUserName || null) : null,
      deduction_status: canFinalizePayroll ? 'approved' : 'pending'
    };
    await updatePayrollMutation.mutateAsync({ id: selectedPayrollForEdit.id, data });
    setShowEditDeductionsModal(false);
    resetDeductionForm();
  }, [selectedPayrollForEdit, enableManualDeduction, manualDeductionAmount, manualDeductionReason, deductionType, deductionCategory, deductionReference, deductionDate, deductionApprovedBy, canFinalizePayroll, currentUserName, updatePayrollMutation, resetDeductionForm]);

  const handleBulkMarkAsPaid = useCallback(() => {
    if (selectedPayrollIds.length === 0) {
      message.warning('Please select payroll records first');
      return;
    }
    const selectedRows = payrollData.filter((row) => selectedPayrollIds.includes(row.id));
    if (selectedRows.some((row) => row.status !== 'approved')) {
      message.warning('Only approved payroll records can be marked as paid. Approve all selected records first.');
      return;
    }
    Modal.confirm({
      title: 'Bulk Mark as Paid',
      content: `Mark ${selectedPayrollIds.length} approved payroll record(s) as paid and move them to Payroll History?`,
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        setProcessingAction(true);
        try {
          for (const id of selectedPayrollIds) {
            await markAsPaidMutation.mutateAsync({ id, data: { payment_method: 'bank_transfer' } });
          }
          message.success(`${selectedPayrollIds.length} record(s) marked as paid`);
          setSelectedPayrollIds([]);
          await Promise.all([refetchPayroll(), refetchStats(), refetchHistory(), refetchHistoryStats()]);
        } catch (error) {
          message.error('Failed to mark some records as paid');
        } finally {
          setProcessingAction(false);
        }
      }
    });
  }, [selectedPayrollIds, payrollData, markAsPaidMutation, refetchPayroll, refetchStats, refetchHistory, refetchHistoryStats]);

  const handleBulkDeductions = useCallback(async () => {
    if (selectedPayrollIds.length === 0) {
      message.warning('Please select payroll records first');
      return;
    }
    if (bulkDeductionAmount <= 0) {
      message.warning('Please enter a valid deduction amount');
      return;
    }
    if (!bulkDeductionReason.trim()) {
      message.warning('Please provide a reason for the deduction');
      return;
    }
    const data = {
      payroll_ids: selectedPayrollIds,
      manual_deductions: bulkDeductionAmount,
      manual_deduction_notes: bulkDeductionReason,
      deduction_type: bulkDeductionType,
      deduction_category: bulkDeductionCategory,
      deduction_approved_by: canFinalizePayroll ? (currentUserName || null) : null,
      deduction_status: canFinalizePayroll ? 'approved' : 'pending',
      deduction_date: dayjs().format('YYYY-MM-DD')
    };
    await bulkUpdateDeductionsMutation.mutateAsync(data);
    setShowBulkDeductionModal(false);
    setSelectedPayrollIds([]);
    setBulkDeductionAmount(0);
    setBulkDeductionReason('');
    setBulkDeductionType('other');
    setBulkDeductionCategory('company');
    await refetchPayroll();
    await refetchStats();
  }, [selectedPayrollIds, bulkDeductionAmount, bulkDeductionReason, bulkDeductionType, bulkDeductionCategory, canFinalizePayroll, currentUserName, bulkUpdateDeductionsMutation, refetchPayroll, refetchStats]);

  const handleViewHistory = useCallback((item) => {
    setSelectedHistoryItem(item);
    setShowHistoryDetailsModal(true);
  }, []);

  const handleTabChange = useCallback((key) => {
    setActiveTab(key);
    setSelectedPayrollIds([]);
  }, []);

  const handleSelectAllEmployees = useCallback(() => {
    if (selectAllEmployees) {
      setSelectedEmployeesForPayroll([]);
    } else {
      setSelectedEmployeesForPayroll(selectableEligibleEmployees.map(emp => emp.id));
    }
    setSelectAllEmployees(!selectAllEmployees);
  }, [selectAllEmployees, selectableEligibleEmployees]);

  const handleSelectEmployee = useCallback((employeeId) => {
    setSelectedEmployeesForPayroll(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  }, []);

  const handleSelectPayroll = useCallback((payrollId) => {
    setSelectedPayrollIds(prev => 
      prev.includes(payrollId) 
        ? prev.filter(id => id !== payrollId)
        : [...prev, payrollId]
    );
  }, []);

  const handleSelectAllPayroll = useCallback(() => {
    if (selectedPayrollIds.length === paginatedData.length) {
      setSelectedPayrollIds([]);
    } else {
      setSelectedPayrollIds(paginatedData.map(item => item.id));
    }
  }, [selectedPayrollIds, paginatedData]);

  useEffect(() => {
    setSelectAllEmployees(isAllSelected);
  }, [isAllSelected]);

  // ========================================================
  // RENDER PAGINATION
  // ========================================================
  const renderPaginationItem = (_, type, originalElement) => {
    if (type === 'prev') {
      return (
        <Button className="prf-pagination-navigation-button" size="small" icon={<LeftOutlined />}>
          Previous
        </Button>
      );
    }
    if (type === 'next') {
      return (
        <Button className="prf-pagination-navigation-button" size="small">
          Next <RightOutlined />
        </Button>
      );
    }
    return originalElement;
  };

  const renderEmptyPaginationFooter = (label) => {
    return (
      <div className="prf-empty-pagination-footer">
        <span className="prf-empty-pagination-total">Total 0 {label}</span>
        <div className="prf-empty-pagination-controls">
          <Button className="prf-pagination-navigation-button" size="small" icon={<LeftOutlined />} disabled>
            Previous
          </Button>
          <button type="button" className="prf-empty-pagination-current-page" disabled>1</button>
          <Button className="prf-pagination-navigation-button" size="small" disabled>
            Next <RightOutlined />
          </Button>
        </div>
      </div>
    );
  };

  // ========================================================
  // TABLE COLUMNS
  // ========================================================
  const payrollColumns = [
    {
      title: '',
      key: 'select',
      width: 50,
      render: (_, record) => (
        <input 
          type="checkbox" 
          checked={selectedPayrollIds.includes(record.id)}
          onChange={() => handleSelectPayroll(record.id)}
          disabled={record.status === 'paid'}
          className="prf-table-checkbox"
        />
      )
    },
    {
      title: 'PAYROLL #',
      dataIndex: 'payroll_number',
      key: 'payroll_number',
      width: 140,
      render: (value) => <span className="prf-id-text">{safeString(value)}</span>
    },
    {
      title: 'EMPLOYEE',
      key: 'employee',
      width: 220,
      render: (_, record) => (
        <div className="prf-employee-cell">
          <div className="prf-employee-avatar">
            {safeString(record.employee?.full_name, '?').charAt(0)}
          </div>
          <div>
            <div className="prf-employee-name">{safeString(record.employee?.full_name)}</div>
            <div className="prf-employee-id">{safeString(record.employee?.employee_code || record.employee?.employee_id)}</div>
            <Tag size="small" color={getEmployeeType(record.employee) === EMPLOYEE_TYPES.ON_CALL ? 'orange' : 'blue'}>
              {getEmployeeType(record.employee) === EMPLOYEE_TYPES.ON_CALL ? 'On-Call' : 'Regular'}
            </Tag>
          </div>
        </div>
      )
    },
    {
      title: 'POSITION',
      key: 'position',
      width: 150,
      render: (_, record) => (
        <div>
          <div className="prf-position-name">{safeString(record.employee?.position)}</div>
          <div className="prf-position-dept">{safeString(record.employee?.department)}</div>
        </div>
      )
    },
    {
      title: 'HOURS',
      key: 'hours',
      width: 100,
      render: (_, record) => (
        <div className="prf-hours-cell">
          <div><span className="prf-hours-label">Regular:</span> {safeNumber(record.regular_hours)}h</div>
          {record.overtime_hours > 0 && (
            <div className="prf-overtime"><span className="prf-hours-label">OT:</span> {safeNumber(record.overtime_hours)}h</div>
          )}
        </div>
      )
    },
    {
      title: 'GROSS PAY',
      dataIndex: 'gross_pay',
      key: 'gross_pay',
      width: 140,
      align: 'right',
      render: (value, record) => (
        <span className="prf-amount">{formatCurrency(value || (record.regular_pay || 0) + (record.overtime_pay || 0))}</span>
      )
    },
    {
      title: 'DEDUCTIONS',
      key: 'deductions',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <div>
          <div className="prf-amount prf-amount-negative">{formatCurrency(record.total_deductions)}</div>
          {record.sss_deduction > 0 && <Tag color="red" size="small">SSS</Tag>}
          {record.philhealth_deduction > 0 && <Tag color="blue" size="small">PhilHealth</Tag>}
          {record.pagibig_deduction > 0 && <Tag color="green" size="small">Pag-IBIG</Tag>}
        </div>
      )
    },
    {
      title: 'NET PAY',
      dataIndex: 'net_pay',
      key: 'net_pay',
      width: 150,
      align: 'right',
      render: (value) => (
        <span className="prf-amount prf-amount-primary">{formatCurrency(value)}</span>
      )
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => {
        const config = getStatusConfig(value);
        return (
          <span className="prf-status" style={{ color: config.color, background: config.background }}>
            {config.icon} {config.text}
          </span>
        );
      }
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Dropdown menu={getPayrollActionMenu(record)} trigger={['click']}>
          <Button type="text" icon={<SettingOutlined />} className="prf-action-dropdown" />
        </Dropdown>
      )
    }
  ];

  const historyColumns = [
    {
      title: 'PAYROLL #',
      dataIndex: 'payroll_number',
      key: 'payroll_number',
      width: 140,
      render: (value) => <span className="prf-id-text">{safeString(value)}</span>
    },
    {
      title: 'EMPLOYEE',
      key: 'employee',
      width: 200,
      render: (_, record) => (
        <div className="prf-employee-cell">
          <div className="prf-employee-avatar">
            {safeString(record.employee?.full_name, '?').charAt(0)}
          </div>
          <div>
            <div className="prf-employee-name">{safeString(record.employee?.full_name)}</div>
            <div className="prf-employee-id">{safeString(record.employee?.employee_code || record.employee?.employee_id)}</div>
          </div>
        </div>
      )
    },
    {
      title: 'PERIOD',
      key: 'period',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{formatDateSafe(record.period_start)} - {formatDateSafe(record.period_end)}</div>
          <div className="prf-period-cutoff">{record.cutoff_type || (record.period_start && dayjs(record.period_start).date() <= 15 ? '1st Cutoff' : '2nd Cutoff')}</div>
        </div>
      )
    },
    {
      title: 'GROSS PAY',
      key: 'gross_pay',
      width: 140,
      align: 'right',
      render: (_, record) => (
        <span className="prf-amount">{formatCurrency(record.gross_pay || (record.regular_pay || 0) + (record.overtime_pay || 0))}</span>
      )
    },
    {
      title: 'DEDUCTIONS',
      key: 'deductions',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <span className="prf-amount prf-amount-negative">{formatCurrency(record.total_deductions)}</span>
      )
    },
    {
      title: 'NET PAY',
      dataIndex: 'net_pay',
      key: 'net_pay',
      width: 150,
      align: 'right',
      render: (value) => (
        <span className="prf-amount prf-amount-primary">{formatCurrency(value)}</span>
      )
    },
    {
      title: 'HISTORY STATUS',
      key: 'history_status',
      width: 180,
      render: (_, record) => {
        const config = getStatusConfig(record.status);
        return (
          <div>
            <span className="prf-status" style={{ color: config.color, background: config.background }}>
              {config.icon} {config.text}
            </span>
            <div className="prf-deleted-at">{formatDateSafe(record.paid_at || record.deleted_at)}</div>
          </div>
        );
      }
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <div className="prf-action-group">
          <Tooltip title="View Details">
            <button className="prf-action-icon view" onClick={() => handleViewHistory(record)}>
              <EyeOutlined />
            </button>
          </Tooltip>
          {canFinalizePayroll && record.status !== 'paid' && (
            <Tooltip title="Restore">
              <button className="prf-action-icon restore" onClick={() => handleRestorePayroll(record.id)}>
                <UndoOutlined />
              </button>
            </Tooltip>
          )}
          {canFinalizePayroll && (
            <Tooltip title="Permanently Delete">
              <button className="prf-action-icon delete" onClick={() => handlePermanentDelete(record.id)}>
                <DeleteIcon />
              </button>
            </Tooltip>
          )}
        </div>
      )
    }
  ];

  // ========================================================
  // RENDER
  // ========================================================
  const containerClass = `prf-container ${isDarkMode ? 'prf-dark-mode' : ''}`;
  const headerClass = `prf-header ${isDarkMode ? 'prf-header-dark' : ''}`;
  const mainCardClass = `prf-main-card ${isDarkMode ? 'prf-main-card-dark' : ''}`;
  const filtersClass = `prf-filters ${isDarkMode ? 'prf-filters-dark' : ''}`;
  const tableClass = `prf-table-wrapper ${isDarkMode ? 'prf-table-wrapper-dark' : ''}`;
  const isLoading = payrollLoading || historyLoading;

  return (
    <App>
      <ConfigProvider theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
        <div className={containerClass}>
          {/* ============================================================
              HEADER - Professional & Clean
          ============================================================ */}
          <div className={headerClass}>
            <div className="prf-header-left">
              <div className="prf-logo-icon">
                <DollarOutlined />
              </div>
              <div className="prf-header-info">
                <h1>Payroll Management</h1>
                <span>ENTERPRISE COMPENSATION SYSTEM</span>
              </div>
            </div>
            <div className="prf-header-right">
              <div className="prf-date-display">
                <CalendarOutlined />
                <span>{dayjs().format('dddd, MMMM DD, YYYY')}</span>
              </div>
              <Divider type="vertical" style={{ height: 28 }} />
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                Refresh
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                Export
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={openEmployeeSelectionModal}
              >
                Process Payroll
              </Button>
            </div>
          </div>

          {/* ============================================================
              KPI CARDS - Professional Stats
          ============================================================ */}
          {statistics && (
            <div className="prf-kpi-grid">
              <div className="prf-kpi-card">
                <div className="prf-kpi-icon blue"><DollarOutlined /></div>
                <div className="prf-kpi-stats">
                  <div className="prf-kpi-value">{formatCurrency(statistics.total_payroll_amount || 0)}</div>
                  <div className="prf-kpi-label">Total Payroll</div>
                </div>
              </div>
              <div className="prf-kpi-card">
                <div className="prf-kpi-icon green"><TeamOutlined /></div>
                <div className="prf-kpi-stats">
                  <div className="prf-kpi-value">{statistics.total_employees || 0}</div>
                  <div className="prf-kpi-label">Active Employees</div>
                </div>
              </div>
              <div className="prf-kpi-card">
                <div className="prf-kpi-icon orange"><WalletOutlined /></div>
                <div className="prf-kpi-stats">
                  <div className="prf-kpi-value">{formatCurrency(statistics.average_net_pay || 0)}</div>
                  <div className="prf-kpi-label">Average Net Pay</div>
                </div>
              </div>
              <div className="prf-kpi-card">
                <div className="prf-kpi-icon purple"><ClockCircleOutlined /></div>
                <div className="prf-kpi-stats">
                  <div className="prf-kpi-value">{formatCurrency(statistics.pending_amount || 0)}</div>
                  <div className="prf-kpi-label">Pending Amount</div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              MAIN CARD - Clean & Organized
          ============================================================ */}
          <Card className={mainCardClass} variant="borderless">
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              className="prf-tabs"
              items={[
                {
                  key: 'active',
                  label: <span><DollarOutlined /> Active Payroll ({filteredData.length})</span>,
                  children: (
                    <>
                      {/* Period Navigator - Clean & Professional */}
                      <div className="prf-period-nav">
                        <div className="prf-period-left">
                          <div className="prf-cutoff-selector">
                            <button 
                              className={`prf-cutoff-btn ${cutoffType === 'first' ? 'active' : ''}`} 
                              onClick={() => setCutoffType('first')}
                            >
                              <span className="cutoff-number">1ˢᵗ</span>
                              <span className="cutoff-range">- 15ᵗʰ</span>
                            </button>
                            <button 
                              className={`prf-cutoff-btn ${cutoffType === 'second' ? 'active' : ''}`} 
                              onClick={() => setCutoffType('second')}
                            >
                              <span className="cutoff-number">16ᵗʰ</span>
                              <span className="cutoff-range">- End</span>
                            </button>
                          </div>
                          <div className="prf-period-picker">
                            <CalendarOutlined />
                            <span>{periodLabel}</span>
                          </div>
                          <div className="prf-period-buttons">
                            <button className="prf-period-btn" onClick={() => changeCutoff('prev')}>
                              <LeftOutlined />
                            </button>
                            <button className="prf-period-btn" onClick={() => changeCutoff('next')}>
                              <RightOutlined />
                            </button>
                          </div>
                          <button className="prf-period-current" onClick={goToCurrentPeriod}>
                            Current Period
                          </button>
                        </div>
                      </div>

                      {/* Filters - Clean & Organized */}
                      <div className={filtersClass}>
                        <div className="prf-filter-group">
                          <FilterOutlined />
                          <Select
                            value={selectedStatus}
                            onChange={(value) => { setSelectedStatus(value); setCurrentPage(1); }}
                            className="prf-filter-select"
                            placeholder="Status"
                          >
                            {payrollStatusOptions.map((option) => (
                              <Option key={option.value} value={option.value}>{option.label}</Option>
                            ))}
                          </Select>
                        </div>
                        <div className="prf-filter-group">
                          <TeamOutlined />
                          <Select
                            value={selectedDepartment}
                            onChange={(value) => { setSelectedDepartment(value); setCurrentPage(1); }}
                            className="prf-filter-select"
                            placeholder="Department"
                          >
                            <Option value="all">All Departments</Option>
                            {departments.map((dept) => (
                              <Option key={dept.id} value={dept.id}>{safeString(dept.name)}</Option>
                            ))}
                          </Select>
                        </div>
                        <div className={`prf-filter-group prf-search`}>
                          <SearchOutlined />
                          <Input
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search payroll or employee..."
                            allowClear
                            className="prf-search-input"
                          />
                        </div>
                      </div>

                      {/* Bulk Actions Bar - Professional */}
                      {selectedPayrollIds.length > 0 && (
                        <div className="prf-bulk-actions-bar">
                          <span><ThunderboltOutlined /> {selectedPayrollIds.length} record(s) selected</span>
                          <Space>
                            <Button 
                              type="primary" 
                              danger 
                              icon={<MinusCircleOutlined />}
                              onClick={() => setShowBulkDeductionModal(true)}
                              loading={processingAction}
                            >
                              Bulk Add Deduction
                            </Button>
                            <Button 
                              type="primary" 
                              icon={<FilePdfOutlined />}
                              onClick={handleBulkGeneratePayslips}
                              loading={bulkGeneratePayslipsMutation.isPending}
                            >
                              Bulk Generate Payslips
                            </Button>
                            {canFinalizePayroll && (
                              <Button 
                                type="primary" 
                                icon={<CheckOutlined />}
                                onClick={handleBulkMarkAsPaid}
                                loading={processingAction}
                              >
                                Bulk Mark as Paid
                              </Button>
                            )}
                            <Button onClick={() => setSelectedPayrollIds([])}>
                              Clear Selection
                            </Button>
                          </Space>
                        </div>
                      )}

                      {/* Table - Professional & Clean */}
                      <Spin spinning={isLoading} indicator={<LoadingOutlined spin />}>
                        <Table
                          columns={payrollColumns}
                          dataSource={paginatedData}
                          rowKey={(record) => record.id}
                          className={tableClass}
                          scroll={{ x: 1400 }}
                          footer={
                            paginatedData.length === 0
                              ? () => renderEmptyPaginationFooter('payroll records')
                              : undefined
                          }
                          pagination={{
                            current: currentPage,
                            pageSize: pageSize,
                            total: filteredData.length,
                            showSizeChanger: false,
                            showTotal: (total) => `Total ${total} payroll records`,
                            itemRender: renderPaginationItem,
                            onChange: setCurrentPage
                          }}
                        />
                      </Spin>
                    </>
                  )
                },
                {
                  key: 'history',
                  label: <span><HistoryOutlined /> History Archive ({payrollHistory.length})</span>,
                  children: (
                    <div className="prf-tab-content">
                      <Alert
                        message="Payroll History Archive"
                        description="Paid payrolls are automatically moved here. Manually archived unpaid records can still be restored."
                        type="info"
                        showIcon
                        className="prf-info-alert"
                      />
                      
                      {historyStatistics && (
                        <div className="prf-history-stats">
                          <Row gutter={16}>
                            <Col span={8}>
                              <Card className="prf-history-stat-card">
                                <Statistic
                                  title="History Records"
                                  value={historyStatistics.total_history ?? historyStatistics.total_deleted ?? 0}
                                  prefix={<DeleteIcon />}
                                />
                              </Card>
                            </Col>
                            <Col span={8}>
                              <Card className="prf-history-stat-card">
                                <Statistic
                                  title="History Amount"
                                  value={historyStatistics.total_history_amount ?? historyStatistics.total_deleted_amount ?? 0}
                                  prefix="₱"
                                  precision={2}
                                />
                              </Card>
                            </Col>
                            <Col span={8}>
                              <Card className="prf-history-stat-card">
                                <Statistic
                                  title="Paid Payrolls"
                                  value={historyStatistics.paid_history_count || 0}
                                  prefix={<CheckCircleOutlined />}
                                />
                              </Card>
                            </Col>
                          </Row>
                        </div>
                      )}

                      <Table
                        columns={historyColumns}
                        dataSource={payrollHistory}
                        rowKey={(record) => record.id}
                        className={tableClass}
                        scroll={{ x: 1300 }}
                        footer={
                          payrollHistory.length === 0
                            ? () => renderEmptyPaginationFooter('history records')
                            : undefined
                        }
                        pagination={{
                          current: historyCurrentPage,
                          pageSize: pageSize,
                          total: payrollHistory.length,
                          showSizeChanger: false,
                          showTotal: (total) => `Total ${total} history records`,
                          itemRender: renderPaginationItem,
                          onChange: setHistoryCurrentPage
                        }}
                      />
                    </div>
                  )
                }
              ]}
            />
          </Card>

          {/* ============================================================
              All Modals - Clean & Professional
              (Keeping all existing modals with enhanced styling)
          ============================================================ */}

          {/* EMPLOYEE SELECTION MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><PlusOutlined /></div>
                <div className="prf-modal-title-text">Select Employees for Payroll</div>
                <div className="prf-modal-badge">{periodLabel}</div>
              </div>
            }
            open={showEmployeeSelectionModal}
            onCancel={() => setShowEmployeeSelectionModal(false)}
            width={950}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowEmployeeSelectionModal(false)}>Cancel</Button>
                <Button 
                  loading={previewPayrollMutation.isPending} 
                  onClick={handlePreviewPayroll} 
                  icon={<EyeOutlined />}
                >
                  Preview
                </Button>
                <Button 
                  type="primary" 
                  loading={processPayrollMutation.isPending} 
                  onClick={handleProcessPayroll} 
                  icon={<CalculatorOutlined />}
                >
                  Process Payroll
                </Button>
              </div>
            }
          >
            <div className="prf-modal-clean-content">
              {/* Eligibility Summary */}
              {eligibilitySummary && (
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title="Total Employees" value={eligibilitySummary.total_employees || 0} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title="Eligible" value={eligibilitySummary.eligible_count || 0} valueStyle={{ color: '#10b981' }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title="Already Processed" value={eligibilitySummary.has_payroll_count || 0} valueStyle={{ color: '#ef4444' }} />
                    </Card>
                  </Col>
                </Row>
              )}

              <div className="prf-selection-filters">
                <Input
                  placeholder="Search employee..."
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  prefix={<SearchOutlined />}
                  className="prf-selection-search"
                />
                <Select
                  value={employeeDepartmentFilter}
                  onChange={setEmployeeDepartmentFilter}
                  className="prf-selection-filter"
                  placeholder="Department"
                >
                  <Option value="all">All Departments</Option>
                  {departments.map((dept) => (
                    <Option key={dept.id} value={dept.id}>{safeString(dept.name)}</Option>
                  ))}
                </Select>
                <Button size="small" onClick={handleSelectAllEmployees}>
                  {selectAllEmployees ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="prf-selection-count">{selectedEmployeesForPayroll.length} selected</span>
              </div>

              <div className="prf-selection-table-wrapper">
                <table className="prf-selection-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <Checkbox 
                          checked={isAllSelected} 
                          indeterminate={selectedEmployeesForPayroll.length > 0 && !isAllSelected} 
                          onChange={handleSelectAllEmployees}
                          disabled={selectableEligibleEmployees.length === 0}
                        />
                      </th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Type</th>
                      <th>Hourly Rate</th>
                      <th>Attendance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEligibleEmployees.map((emp) => {
                      const empType = getEmployeeType(emp);
                      return (
                        <tr key={emp.id}>
                          <td>
                            <Checkbox 
                              checked={selectedEmployeesForPayroll.includes(emp.id)} 
                              onChange={() => handleSelectEmployee(emp.id)} 
                              disabled={!emp.eligible} 
                            />
                          </td>
                          <td>
                            <div className="prf-employee-cell">
                              <Avatar size={32}>{safeString(emp.full_name, '?').charAt(0)}</Avatar>
                              <div>
                                <div>{safeString(emp.full_name)}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{safeString(emp.employee_code || emp.employee_id)}</div>
                              </div>
                            </div>
                          </td>
                          <td>{safeString(emp.department?.name || emp.department_name, 'N/A')}</td>
                          <td>{safeString(emp.position?.title || emp.position?.name || emp.position_name, 'N/A')}</td>
                          <td>
                            <Tag color={empType === EMPLOYEE_TYPES.ON_CALL ? 'orange' : 'blue'}>
                              {empType === EMPLOYEE_TYPES.ON_CALL ? 'On-Call' : 
                               empType === EMPLOYEE_TYPES.CONTRACT ? 'Contract' :
                               empType === EMPLOYEE_TYPES.PART_TIME ? 'Part-Time' : 'Regular'}
                            </Tag>
                          </td>
                          <td>{formatCurrency(emp.hourly_rate || 0)}/hr</td>
                          <td>
                            <Badge 
                              status={emp.has_attendance ? 'success' : 'warning'} 
                              text={emp.has_attendance ? 'Has Attendance' : 'No Attendance'} 
                            />
                          </td>
                          <td>
                            {emp.has_payroll ? (
                              <Tag color="orange">Processed</Tag>
                            ) : emp.eligible ? (
                              <Tag color="green">Eligible</Tag>
                            ) : (
                              <Tag color="red" title={safeString(emp.eligibility_status, 'Needs attendance review')}>
                                {safeString(emp.eligibility_status, 'Needs Review')}
                              </Tag>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="prf-selection-notes">
                <label>Notes (Optional)</label>
                <TextArea 
                  rows={2} 
                  placeholder="Add notes for this payroll batch..." 
                  value={processNotes} 
                  onChange={(e) => setProcessNotes(e.target.value)} 
                />
              </div>
            </div>
          </Modal>

          {/* PREVIEW MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><EyeOutlined /></div>
                <div className="prf-modal-title-text">Payroll Preview</div>
                <div className="prf-modal-badge">{periodLabel}</div>
              </div>
            }
            open={showPreviewModal}
            onCancel={() => setShowPreviewModal(false)}
            width={950}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowPreviewModal(false)}>Cancel</Button>
                <Button 
                  type="primary" 
                  loading={processPayrollMutation.isPending} 
                  onClick={handleProcessPayroll} 
                  icon={<CheckOutlined />}
                >
                  Confirm & Process
                </Button>
              </div>
            }
          >
            {payrollPreview && (
              <div className="prf-modal-clean-content">
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="Total Employees" value={payrollPreview.summary?.total_employees || 0} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="Total Regular Hours" value={payrollPreview.summary?.total_regular_hours?.toFixed(2) || 0} suffix="hrs" />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="Total Overtime Hours" value={payrollPreview.summary?.total_overtime_hours?.toFixed(2) || 0} suffix="hrs" />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="Total Net Pay" value={formatCurrency(payrollPreview.summary?.total_net_pay || 0)} />
                    </Card>
                  </Col>
                </Row>

                <Divider>Employee Breakdown</Divider>

                <div className="prf-preview-table-wrapper">
                  <table className="prf-preview-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Type</th>
                        <th>Regular Hrs</th>
                        <th>OT Hrs</th>
                        <th>Gross</th>
                        <th>Deductions</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payrollPreview.preview || []).map((item, idx) => {
                        const empType = getEmployeeType(item.employee);
                        return (
                          <tr key={idx}>
                            <td>
                              <strong>{safeString(item.employee?.full_name)}</strong>
                              <br />
                              <small style={{ color: '#94a3b8' }}>{safeString(item.employee?.employee_id)}</small>
                            </td>
                            <td>
                              <Tag color={empType === EMPLOYEE_TYPES.ON_CALL ? 'orange' : 'blue'}>
                                {empType === EMPLOYEE_TYPES.ON_CALL ? 'On-Call' : 
                                 empType === EMPLOYEE_TYPES.CONTRACT ? 'Contract' :
                                 empType === EMPLOYEE_TYPES.PART_TIME ? 'Part-Time' : 'Regular'}
                              </Tag>
                            </td>
                            <td>{item.calculation?.regular_hours || 0}h</td>
                            <td>{item.calculation?.overtime_hours > 0 ? `${item.calculation.overtime_hours}h` : '—'}</td>
                            <td>{formatCurrency(item.calculation?.base_pay || 0)}</td>
                            <td>
                              {formatCurrency(item.calculation?.total_deductions || 0)}
                              {item.calculation?.sss_deduction > 0 && <Tag color="red" size="small">SSS</Tag>}
                              {item.calculation?.philhealth_deduction > 0 && <Tag color="blue" size="small">PhilHealth</Tag>}
                              {item.calculation?.pagibig_deduction > 0 && <Tag color="green" size="small">Pag-IBIG</Tag>}
                            </td>
                            <td><strong>{formatCurrency(item.calculation?.net_pay || 0)}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Alert 
                  message="Confirmation Required" 
                  description={`${deductionScheduleInfo.deductions.join(' + ')} deductions will be automatically applied based on the current cutoff schedule.`} 
                  type="warning" 
                  showIcon 
                  style={{ marginTop: 16 }} 
                />
              </div>
            )}
          </Modal>

          {/* ATTENDANCE MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><ScheduleOutlined /></div>
                <div className="prf-modal-title-text">Attendance Records</div>
                <div className="prf-modal-badge">{safeString(selectedEmployee?.full_name)}</div>
              </div>
            }
            open={showAttendanceModal}
            onCancel={() => setShowAttendanceModal(false)}
            width={900}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowAttendanceModal(false)}>Close</Button>
                <Button 
                  type="primary" 
                  icon={<FileExcelOutlined />} 
                  onClick={() => {
                    const csv = ['Date,Time In,Time Out,Regular Hours,Overtime Hours,Status'];
                    attendanceRecords.forEach(record => {
                      csv.push(`${record.date || record.attendance_date},${record.time_in || 'N/A'},${record.time_out || 'N/A'},${record.regular_hours || 0},${record.overtime_hours || 0},${record.status || 'Present'}`);
                    });
                    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `attendance_${selectedEmployee?.full_name}_${periodLabel.replace(/[^a-z0-9]/gi, '_')}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    message.success('Attendance exported');
                  }}
                >
                  Export CSV
                </Button>
              </div>
            }
          >
            <div className="prf-modal-clean-content">
              <div className="prf-modal-employee">
                <Avatar size={48}>{safeString(selectedEmployee?.full_name, '?').charAt(0)}</Avatar>
                <div>
                  <h4>{safeString(selectedEmployee?.full_name)}</h4>
                  <p>{safeString(selectedEmployee?.position)} • {safeString(selectedEmployee?.department)}</p>
                  <small>Employee ID: {safeString(selectedEmployee?.employee_code || selectedEmployee?.employee_id)}</small>
                </div>
              </div>

              <Divider />

              <div className="prf-attendance-summary">
                <Row gutter={16}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic 
                        title="Total Days" 
                        value={attendanceRecords.length} 
                        prefix={<CalendarOutlined />} 
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic 
                        title="Regular Hours" 
                        value={attendanceRecords.reduce((sum, r) => sum + (r.regular_hours || 0), 0).toFixed(2)} 
                        suffix="hrs" 
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic 
                        title="Overtime Hours" 
                        value={attendanceRecords.reduce((sum, r) => sum + (r.overtime_hours || 0), 0).toFixed(2)} 
                        suffix="hrs" 
                        valueStyle={{ color: '#f59e0b' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic 
                        title="Present Days" 
                        value={attendanceRecords.filter(r => r.status === 'present' || r.status === 'verified').length} 
                        prefix={<CheckCircleOutlined />} 
                        valueStyle={{ color: '#10b981' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              <div className="prf-attendance-table-wrapper">
                <table className="prf-attendance-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Schedule</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Regular Hours</th>
                      <th>OT Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((record, idx) => (
                      <tr key={idx}>
                        <td>{formatDateSafe(record.attendance_date || record.date)}</td>
                        <td>{record.day || (record.attendance_date ? dayjs(record.attendance_date).format('ddd') : '—')}</td>
                        <td>{record.assigned_schedule || 'Unscheduled'}</td>
                        <td>{record.formatted_time_in || record.time_in || '—'}</td>
                        <td>{record.formatted_time_out || record.time_out || '—'}</td>
                        <td>{safeNumber(record.regular_hours).toFixed(2)}h</td>
                        <td>{safeNumber(record.overtime_hours).toFixed(2)}h</td>
                        <td>
                          <span className={`prf-attendance-status ${record.status || 'present'}`}>
                            {record.status === 'verified' || record.status === 'approved' ? '✓ Verified' :
                             record.status === 'pending' ? '⏳ Pending' :
                             record.status === 'late' ? '⏰ Late' :
                             record.status === 'absent' ? '❌ Absent' : '✓ Present'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {attendanceRecords.length === 0 && (
                      <tr>
                        <td colSpan="8" className="prf-text-center">No attendance records found for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>

          {/* PAYROLL DETAILS MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><EyeOutlined /></div>
                <div className="prf-modal-title-text">Payroll Details</div>
                <div className="prf-modal-badge">{safeString(selectedEmployee?.payroll_number)}</div>
              </div>
            }
            open={showPayrollModal}
            onCancel={() => setShowPayrollModal(false)}
            width={700}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowPayrollModal(false)}>Close</Button>
                {selectedEmployee?.status !== 'paid' && (
                  <Button 
                    onClick={() => { 
                      setShowPayrollModal(false);
                      handleEditDeductions(selectedEmployee);
                    }} 
                    icon={<CalculatorOutlined />}
                  >
                    Edit Deduction
                  </Button>
                )}
                {selectedEmployee && (
                  <Button 
                    type="primary" 
                    icon={<FilePdfOutlined />} 
                    onClick={() => {
                      setShowPayrollModal(false);
                      handleGeneratePayslip(selectedEmployee.id);
                    }}
                  >
                    Generate Payslip
                  </Button>
                )}
              </div>
            }
          >
            {selectedEmployee && (
              <div className="prf-modal-clean-content">
                <div className="prf-modal-employee">
                  <Avatar size={64}>{safeString(selectedEmployee.employee?.full_name, '?').charAt(0)}</Avatar>
                  <div>
                    <h3>{safeString(selectedEmployee.employee?.full_name)}</h3>
                    <p>{safeString(selectedEmployee.employee?.position)} • {safeString(selectedEmployee.employee?.department)}</p>
                    <small>Employee ID: {safeString(selectedEmployee.employee?.employee_id || selectedEmployee.employee?.employee_code)}</small>
                  </div>
                  <span className={`prf-modal-status prf-status-${selectedEmployee.status}`}>
                    {getStatusConfig(selectedEmployee.status).text}
                  </span>
                </div>

                <Divider />

                <div className="prf-modal-summary">
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="prf-summary-item">
                        <label>Period Covered</label>
                        <span>{periodLabel}</span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Regular Hours</label>
                        <span><strong>{selectedEmployee.regular_hours || 0}</strong> hours</span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Overtime Hours</label>
                        <span><strong>{selectedEmployee.overtime_hours || 0}</strong> hours</span>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="prf-summary-item">
                        <label>Gross Pay</label>
                        <span><strong>{formatCurrency(selectedEmployee.gross_pay || (selectedEmployee.regular_pay || 0) + (selectedEmployee.overtime_pay || 0))}</strong></span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Total Deductions</label>
                        <span><strong style={{ color: '#ef4444' }}>{formatCurrency(selectedEmployee.total_deductions)}</strong></span>
                        {selectedEmployee.sss_deduction > 0 && <Tag color="red" size="small">SSS</Tag>}
                        {selectedEmployee.philhealth_deduction > 0 && <Tag color="blue" size="small">PhilHealth</Tag>}
                        {selectedEmployee.pagibig_deduction > 0 && <Tag color="green" size="small">Pag-IBIG</Tag>}
                      </div>
                      <div className="prf-summary-item prf-summary-total">
                        <label>Net Pay</label>
                        <span><strong style={{ fontSize: 20, color: '#10b981' }}>{formatCurrency(selectedEmployee.net_pay)}</strong></span>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            )}
          </Modal>

          {/* HISTORY DETAILS MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><HistoryOutlined /></div>
                <div className="prf-modal-title-text">Archived Payroll Details</div>
                <div className="prf-modal-badge">{safeString(selectedHistoryItem?.payroll_number)}</div>
              </div>
            }
            open={showHistoryDetailsModal}
            onCancel={() => setShowHistoryDetailsModal(false)}
            width={700}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowHistoryDetailsModal(false)}>Close</Button>
                {canFinalizePayroll && (
                  <Button 
                    type="primary" 
                    onClick={() => {
                      setShowHistoryDetailsModal(false);
                      if (selectedHistoryItem) handleRestorePayroll(selectedHistoryItem.id);
                    }} 
                    icon={<UndoOutlined />}
                  >
                    Restore Record
                  </Button>
                )}
              </div>
            }
          >
            {selectedHistoryItem && (
              <div className="prf-modal-clean-content">
                <div className="prf-modal-employee">
                  <Avatar size={64}>{safeString(selectedHistoryItem.employee?.full_name, '?').charAt(0)}</Avatar>
                  <div>
                    <h3>{safeString(selectedHistoryItem.employee?.full_name)}</h3>
                    <p>{safeString(selectedHistoryItem.employee?.position)} • {safeString(selectedHistoryItem.employee?.department)}</p>
                  </div>
                  <Tag color="red">Archived</Tag>
                </div>

                <Divider />

                <div className="prf-modal-summary">
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="prf-summary-item">
                        <label>Period</label>
                        <span>{formatDateSafe(selectedHistoryItem.period_start)} - {formatDateSafe(selectedHistoryItem.period_end)}</span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Deleted By</label>
                        <span>{selectedHistoryItem.deleted_by || 'System'}</span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Deleted At</label>
                        <span>{formatDateSafe(selectedHistoryItem.deleted_at)}</span>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="prf-summary-item">
                        <label>Gross Pay</label>
                        <span>{formatCurrency(selectedHistoryItem.gross_pay || (selectedHistoryItem.regular_pay || 0) + (selectedHistoryItem.overtime_pay || 0))}</span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Deductions</label>
                        <span style={{ color: '#ef4444' }}>{formatCurrency(selectedHistoryItem.total_deductions)}</span>
                      </div>
                      <div className="prf-summary-item prf-summary-total">
                        <label>Net Pay</label>
                        <span><strong style={{ fontSize: 20, color: '#10b981' }}>{formatCurrency(selectedHistoryItem.net_pay)}</strong></span>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            )}
          </Modal>

          {/* EDIT DEDUCTIONS MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><CalculatorOutlined /></div>
                <div className="prf-modal-title-text">Edit Deductions</div>
                <div className="prf-modal-badge">{safeString(selectedPayrollForEdit?.payroll_number)}</div>
              </div>
            }
            open={showEditDeductionsModal}
            onCancel={() => {
              setShowEditDeductionsModal(false);
              resetDeductionForm();
            }}
            width={700}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => {
                  setShowEditDeductionsModal(false);
                  resetDeductionForm();
                }}>Cancel</Button>
                <Button 
                  type="primary" 
                  loading={updatePayrollMutation.isPending} 
                  onClick={handleSaveManualDeductions} 
                  icon={<SaveOutlined />}
                >
                  Authorize Deduction
                </Button>
              </div>
            }
          >
            {selectedPayrollForEdit && (
              <div className="prf-modal-clean-content">
                <div className="prf-modal-employee">
                  <Avatar size={48}>{safeString(selectedPayrollForEdit.employee?.full_name, '?').charAt(0)}</Avatar>
                  <div>
                    <h4>{safeString(selectedPayrollForEdit.employee?.full_name)}</h4>
                    <p>{safeString(selectedPayrollForEdit.employee?.position)} • {safeString(selectedPayrollForEdit.employee?.department)}</p>
                    <small>Employee ID: {safeString(selectedPayrollForEdit.employee?.employee_id || selectedPayrollForEdit.employee?.employee_code)}</small>
                  </div>
                </div>

                <Divider />

                <div className="prf-payroll-summary">
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="prf-summary-item">
                        <label>Period Covered</label>
                        <span>{periodLabel}</span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Regular Hours</label>
                        <span><strong>{selectedPayrollForEdit.regular_hours || 0}</strong> hours</span>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="prf-summary-item">
                        <label>Current Net Pay</label>
                        <span><strong style={{ color: '#10b981' }}>{formatCurrency(selectedPayrollForEdit.net_pay)}</strong></span>
                      </div>
                      <div className="prf-summary-item">
                        <label>Manual Deductions</label>
                        <span><strong style={{ color: selectedPayrollForEdit.manual_deductions > 0 ? '#ef4444' : '#94a3b8' }}>
                          {selectedPayrollForEdit.manual_deductions > 0 ? formatCurrency(selectedPayrollForEdit.manual_deductions) : 'None'}
                        </strong></span>
                      </div>
                    </Col>
                  </Row>
                </div>

                <Divider />

                <div className="prf-deduction-section">
                  <div className="prf-deduction-header">
                    <strong><MinusCircleOutlined /> Apply Deduction Adjustment</strong>
                    <Switch 
                      checked={enableManualDeduction} 
                      onChange={setEnableManualDeduction} 
                      checkedChildren="Enabled" 
                      unCheckedChildren="Disabled" 
                    />
                  </div>

                  {enableManualDeduction && (
                    <>
                      <div className="prf-deduction-field">
                        <label>Deduction Type *</label>
                        <select value={deductionType} onChange={(e) => setDeductionType(e.target.value)}>
                          <option value="cash_advance">Cash Advance</option>
                          <option value="salary_loan">Salary Loan</option>
                          <option value="sss_loan">SSS Loan</option>
                          <option value="pagibig_loan">Pag-IBIG Loan</option>
                          <option value="tax_withholding">Tax Withholding Adjustment</option>
                          <option value="penalty">Penalty/Damages</option>
                          <option value="uniform_deduction">Uniform Deduction</option>
                          <option value="other">Other Deductions</option>
                        </select>
                      </div>

                      <div className="prf-deduction-field">
                        <label>Deduction Category</label>
                        <select value={deductionCategory} onChange={(e) => setDeductionCategory(e.target.value)}>
                          <option value="loan">Loan Repayment</option>
                          <option value="government">Government Mandated</option>
                          <option value="company">Company Charge</option>
                          <option value="tax">Tax Adjustment</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="prf-deduction-field">
                        <label>Deduction Amount *</label>
                        <InputNumber 
                          style={{ width: '100%' }} 
                          min={0} 
                          max={100000} 
                          step={100} 
                          value={manualDeductionAmount} 
                          onChange={(val) => setManualDeductionAmount(val || 0)} 
                          formatter={v => `₱ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                          parser={v => v.replace(/₱\s?|(,*)/g, '')} 
                          placeholder="Enter amount" 
                        />
                      </div>

                      <div className="prf-deduction-field">
                        <label>Reference Number</label>
                        <Input 
                          placeholder="e.g., Loan Reference, OR Number" 
                          value={deductionReference} 
                          onChange={(e) => setDeductionReference(e.target.value)} 
                        />
                      </div>

                      <div className="prf-deduction-field">
                        <label>Reason / Justification *</label>
                        <TextArea 
                          rows={3} 
                          placeholder="Provide detailed reason for this deduction..." 
                          value={manualDeductionReason} 
                          onChange={(e) => setManualDeductionReason(e.target.value)} 
                        />
                      </div>

                      <div className="prf-deduction-field">
                        <label>Authorized By</label>
                        <Input 
                          placeholder="Name of authorizing personnel" 
                          value={deductionApprovedBy} 
                          onChange={(e) => setDeductionApprovedBy(e.target.value)} 
                        />
                        <small>Leave blank to use system default</small>
                      </div>
                    </>
                  )}
                </div>

                <Divider />

                <div className="prf-financial-impact">
                  <strong>Financial Impact Calculation</strong>
                  <div className="prf-impact-row">
                    <span>Original Net Pay:</span>
                    <span><strong>{formatCurrency(selectedPayrollForEdit.net_pay)}</strong></span>
                  </div>
                  <div className="prf-impact-row prf-impact-deduction">
                    <span>Deduction Amount:</span>
                    <span style={{ color: '#ef4444' }}>
                      <strong>-{formatCurrency(enableManualDeduction ? manualDeductionAmount : 0)}</strong>
                    </span>
                  </div>
                  <div className="prf-impact-divider" />
                  <div className="prf-impact-row prf-impact-total">
                    <span>Adjusted Net Pay:</span>
                    <span>
                      <strong style={{ fontSize: 20, color: '#10b981' }}>
                        {formatCurrency((selectedPayrollForEdit.net_pay || 0) - (enableManualDeduction ? manualDeductionAmount : 0))}
                      </strong>
                    </span>
                  </div>
                </div>

                <Divider />

                <div className="prf-declaration">
                  <p><strong>Declaration:</strong> I hereby certify that the information provided above is true and correct. The deduction has been properly authorized and documented in accordance with company policies and applicable labor laws.</p>
                </div>
              </div>
            )}
          </Modal>

          {/* BULK DEDUCTION MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><MinusCircleOutlined /></div>
                <div className="prf-modal-title-text">Bulk Deduction Application</div>
                <div className="prf-modal-badge">{selectedPayrollIds.length} records</div>
              </div>
            }
            open={showBulkDeductionModal}
            onCancel={() => {
              setShowBulkDeductionModal(false);
              setBulkDeductionAmount(0);
              setBulkDeductionReason('');
              setBulkDeductionType('other');
              setBulkDeductionCategory('company');
            }}
            width={550}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => {
                  setShowBulkDeductionModal(false);
                  setBulkDeductionAmount(0);
                  setBulkDeductionReason('');
                }}>Cancel</Button>
                <Button 
                  type="primary" 
                  danger 
                  onClick={handleBulkDeductions} 
                  loading={bulkUpdateDeductionsMutation.isPending} 
                  icon={<SaveOutlined />}
                >
                  Apply to {selectedPayrollIds.length} Record(s)
                </Button>
              </div>
            }
          >
            <div className="prf-modal-clean-content">
              <Alert
                message="Bulk Deduction Warning"
                description={`You are about to apply a deduction to ${selectedPayrollIds.length} payroll record(s). This action will affect the net pay of each selected employee.`}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <div className="prf-deduction-section">
                <div className="prf-deduction-field">
                  <label>Deduction Type *</label>
                  <select value={bulkDeductionType} onChange={(e) => setBulkDeductionType(e.target.value)}>
                    <option value="cash_advance">Cash Advance</option>
                    <option value="salary_loan">Salary Loan</option>
                    <option value="sss_loan">SSS Loan</option>
                    <option value="pagibig_loan">Pag-IBIG Loan</option>
                    <option value="tax_withholding">Tax Withholding Adjustment</option>
                    <option value="penalty">Penalty/Damages</option>
                    <option value="uniform_deduction">Uniform Deduction</option>
                    <option value="other">Other Deductions</option>
                  </select>
                </div>

                <div className="prf-deduction-field">
                  <label>Deduction Category</label>
                  <select value={bulkDeductionCategory} onChange={(e) => setBulkDeductionCategory(e.target.value)}>
                    <option value="loan">Loan Repayment</option>
                    <option value="government">Government Mandated</option>
                    <option value="company">Company Charge</option>
                    <option value="tax">Tax Adjustment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="prf-deduction-field">
                  <label>Deduction Amount *</label>
                  <InputNumber 
                    style={{ width: '100%' }} 
                    min={0} 
                    max={100000} 
                    step={100} 
                    value={bulkDeductionAmount} 
                    onChange={(val) => setBulkDeductionAmount(val || 0)} 
                    formatter={v => `₱ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                    parser={v => v.replace(/₱\s?|(,*)/g, '')} 
                    placeholder="Enter amount" 
                  />
                </div>

                <div className="prf-deduction-field">
                  <label>Reason / Justification *</label>
                  <TextArea 
                    rows={3} 
                    placeholder="Provide detailed reason for this bulk deduction..." 
                    value={bulkDeductionReason} 
                    onChange={(e) => setBulkDeductionReason(e.target.value)} 
                  />
                </div>
              </div>

              <Divider />

              <div className="prf-declaration">
                <p><strong>Declaration:</strong> I hereby certify that the information provided above is true and correct. The deduction has been properly authorized and documented in accordance with company policies and applicable labor laws.</p>
              </div>
            </div>
          </Modal>

          {/* PAYSLIP MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon" style={{ background: '#ef4444' }}><FilePdfOutlined /></div>
                <div className="prf-modal-title-text">Employee Payslip</div>
                <div className="prf-modal-badge">{safeString(selectedPayslip?.employee_name)}</div>
              </div>
            }
            open={showPayslipModal}
            onCancel={() => setShowPayslipModal(false)}
            width={1000}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowPayslipModal(false)}>Close</Button>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />} 
                  onClick={() => selectedPayslip && handleDownloadPayslip(selectedPayslip.id)}
                >
                  Download PDF
                </Button>
              </div>
            }
          >
            {selectedPayslip && (
              <div className="prf-payslip-container" id="payslip-print-area">
                <div className="prf-payslip-header">
                  <div>
                    <h2>{selectedPayslip.company_name || 'GPA PROVIDENCE CORP'}</h2>
                    <p>PAYSLIP</p>
                  </div>
                  <div className="prf-payslip-meta">
                    <div><span className="prf-payslip-label">Payment Date:</span> {selectedPayslip.paid_at ? formatDateSafe(selectedPayslip.paid_at) : '—'}</div>
                    <div><span className="prf-payslip-label">Payroll Period:</span> {formatDateSafe(selectedPayslip.period_start)} - {formatDateSafe(selectedPayslip.period_end)}</div>
                    <div><span className="prf-payslip-label">Cutoff:</span> {selectedPayslip.cutoff_type === 'first' ? '1st Cutoff (1-15)' : '2nd Cutoff (16-End)'}</div>
                  </div>
                </div>

                <div className="prf-payslip-employee">
                  <div><span className="prf-payslip-label">Employee ID:</span> {selectedPayslip.employee_code || '—'}</div>
                  <div><span className="prf-payslip-label">Employee Name:</span> {selectedPayslip.employee_name || '—'}</div>
                  <div><span className="prf-payslip-label">Department:</span> {selectedPayslip.department_name || '—'}</div>
                  <div><span className="prf-payslip-label">Employee Type:</span> {selectedPayslip.employee_type || 'Regular'}</div>
                </div>

                <div className="prf-payslip-section">
                  <h4>WORK DETAIL COSTING</h4>
                  <table className="prf-payslip-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>ST</th>
                        <th>NDP</th>
                        <th>Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedPayslip.daily_work_details || []).map((day, idx) => (
                        <tr key={idx}>
                          <td>{day.date ? dayjs(day.date).format('MM/DD') : '—'}</td>
                          <td>{safeNumber(day.regular_hours).toFixed(2)}</td>
                          <td>{safeNumber(day.night_diff_hours).toFixed(2)}</td>
                          <td className="prf-text-right">{formatCurrency(day.pay_per_day || 0)}</td>
                        </tr>
                      ))}
                      {(!selectedPayslip.daily_work_details || selectedPayslip.daily_work_details.length === 0) && (
                        <tr>
                          <td colSpan="4" className="prf-text-center">No daily work details available</td>
                        </tr>
                      )}
                      <tr className="prf-payslip-total">
                        <td><strong>TOTAL:</strong></td>
                        <td><strong>{safeNumber(selectedPayslip.total_regular_hours).toFixed(2)}</strong></td>
                        <td><strong>{safeNumber(selectedPayslip.night_differential_hours).toFixed(2)}</strong></td>
                        <td className="prf-text-right"><strong>{formatCurrency(selectedPayslip.gross_pay || 0)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="prf-payslip-earnings">
                  <div className="prf-payslip-earnings-left">
                    <div className="prf-payslip-rate">
                      <span className="prf-payslip-label">Hourly Rate</span>
                      <span className="prf-payslip-rate-value">{formatCurrency(selectedPayslip.hourly_rate || 0)}</span>
                    </div>
                    <table className="prf-payslip-earnings-table">
                      <tbody>
                        <tr>
                          <td>Straight Time</td>
                          <td className="prf-text-right">{safeNumber(selectedPayslip.total_regular_hours).toFixed(2)} hr(s)</td>
                          <td className="prf-text-right">{formatCurrency(selectedPayslip.regular_pay || 0)}</td>
                        </tr>
                        <tr>
                          <td>Night Premium</td>
                          <td className="prf-text-right">{safeNumber(selectedPayslip.night_differential_hours).toFixed(2)} hr(s)</td>
                          <td className="prf-text-right">{formatCurrency(selectedPayslip.night_differential_pay || 0)}</td>
                        </tr>
                        <tr className="prf-payslip-total">
                          <td><strong>TOTAL TAXABLE INCOME</strong></td>
                          <td></td>
                          <td className="prf-text-right"><strong>{formatCurrency(selectedPayslip.gross_pay || 0)}</strong></td>
                        </tr>
                        <tr>
                          <td>ADD</td>
                          <td></td>
                          <td></td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: '20px' }}>Crew Meeting</td>
                          <td></td>
                          <td className="prf-text-right">{formatCurrency(selectedPayslip.allowances || 0)}</td>
                        </tr>
                        <tr className="prf-payslip-total">
                          <td><strong>TOTAL NON-TAXABLE INCOME</strong></td>
                          <td></td>
                          <td className="prf-text-right"><strong>{formatCurrency(selectedPayslip.allowances || 0)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="prf-payslip-deductions">
                    <table className="prf-payslip-deductions-table">
                      <tbody>
                        <tr>
                          <td><strong>DEDUCTIONS</strong></td>
                          <td></td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: '20px' }}>TAXABLE INCOME</td>
                          <td className="prf-text-right">{formatCurrency(selectedPayslip.gross_pay || 0)}</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: '20px' }}>Unsold Cheesy eggdesal</td>
                          <td className="prf-text-right">{formatCurrency(selectedPayslip.other_deductions || 0)}</td>
                        </tr>
                        <tr className="prf-payslip-total">
                          <td><strong>TOTAL DEDUCTIONS</strong></td>
                          <td className="prf-text-right"><strong>{formatCurrency((selectedPayslip.other_deductions || 0) + (selectedPayslip.sss_deduction || 0))}</strong></td>
                        </tr>
                        <tr className="prf-payslip-total">
                          <td><strong>TOTAL TAXABLE INCOME</strong></td>
                          <td className="prf-text-right"><strong>{formatCurrency((selectedPayslip.gross_pay || 0) - (selectedPayslip.other_deductions || 0))}</strong></td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: '20px' }}>LESS</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: '40px' }}>SSS</td>
                          <td className="prf-text-right">{formatCurrency(selectedPayslip.sss_deduction || 0)}</td>
                        </tr>
                        <tr className="prf-payslip-total">
                          <td><strong>NET TAXABLE INCOME</strong></td>
                          <td className="prf-text-right"><strong>{formatCurrency((selectedPayslip.gross_pay || 0) - (selectedPayslip.other_deductions || 0) - (selectedPayslip.sss_deduction || 0))}</strong></td>
                        </tr>
                        <tr>
                          <td><strong>NET TAXABLE & NON-TAXABLE</strong></td>
                          <td className="prf-text-right"><strong>{formatCurrency((selectedPayslip.gross_pay || 0) - (selectedPayslip.other_deductions || 0) - (selectedPayslip.sss_deduction || 0) + (selectedPayslip.allowances || 0))}</strong></td>
                        </tr>
                        <tr className="prf-payslip-net">
                          <td><strong>NET PAY</strong></td>
                          <td className="prf-text-right"><strong style={{ fontSize: 24, color: '#10b981' }}>{formatCurrency(selectedPayslip.net_pay || 0)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="prf-payslip-footer">
                  <small>This is a computer-generated document. No signature required.</small>
                </div>
              </div>
            )}
          </Modal>

          {/* PAYSLIP PREVIEW MODAL */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><EyeOutlined /></div>
                <div className="prf-modal-title-text">Payslip Preview</div>
              </div>
            }
            open={showPayslipPreviewModal}
            onCancel={() => setShowPayslipPreviewModal(false)}
            width={1000}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => setShowPayslipPreviewModal(false)}>Close</Button>
                <Button 
                  type="primary" 
                  icon={<FilePdfOutlined />} 
                  onClick={() => {
                    if (payslipPreview?.payroll?.id) {
                      handleGeneratePayslip(payslipPreview.payroll.id);
                      setShowPayslipPreviewModal(false);
                    }
                  }}
                >
                  Generate Payslip
                </Button>
              </div>
            }
          >
            {payslipPreview && (
              <div className="prf-modal-clean-content">
                <Alert 
                  message="Preview Mode" 
                  description="This is a preview of the payslip before generation. Click 'Generate Payslip' to create the actual payslip." 
                  type="info" 
                  showIcon 
                  style={{ marginBottom: 16 }} 
                />
                
                <div className="prf-payslip-container">
                  <div className="prf-payslip-header">
                    <div>
                      <h2>GPA PROVIDENCE CORP</h2>
                      <p>PAYSLIP PREVIEW</p>
                    </div>
                    <div>
                      <p>Period: {formatDateSafe(payslipPreview.payroll?.period_start)} - {formatDateSafe(payslipPreview.payroll?.period_end)}</p>
                      <p>Cutoff: {payslipPreview.payroll?.cutoff_type === 'first' ? '1st Cutoff (1-15)' : '2nd Cutoff (16-End)'}</p>
                    </div>
                  </div>

                  <div className="prf-payslip-employee">
                    <p><strong>Employee:</strong> {payslipPreview.employee?.full_name || '—'}</p>
                    <p><strong>Department:</strong> {payslipPreview.employee?.department?.name || '—'}</p>
                    <p><strong>Employee Type:</strong> {getEmployeeType(payslipPreview.employee) === EMPLOYEE_TYPES.ON_CALL ? 'On-Call' : 'Regular'}</p>
                  </div>

                  <div className="prf-payslip-section">
                    <h4>WORK DETAIL COSTING</h4>
                    <table className="prf-payslip-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>ST</th>
                          <th>NDP</th>
                          <th>Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(payslipPreview.daily_breakdown || []).map((day, idx) => (
                          <tr key={idx}>
                            <td>{day.date ? dayjs(day.date).format('MM/DD') : '—'}</td>
                            <td>{safeNumber(day.regular_hours).toFixed(2)}</td>
                            <td>{safeNumber(day.night_diff_hours).toFixed(2)}</td>
                            <td className="prf-text-right">{formatCurrency(day.pay_per_day || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="prf-payslip-summary">
                    <div>
                      <strong>Gross Pay:</strong> {formatCurrency(payslipPreview.gross_pay || 0)}
                    </div>
                    <div>
                      <strong>Total Deductions:</strong> {formatCurrency(payslipPreview.total_deductions || 0)}
                    </div>
                    <div>
                      <strong style={{ fontSize: 20, color: '#10b981' }}>NET PAY: {formatCurrency(payslipPreview.net_pay || 0)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        </div>
      </ConfigProvider>
    </App>
  );
};

export default Staff_Payroll_Formal;