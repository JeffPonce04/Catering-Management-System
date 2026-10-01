// src/components/Staff/Staff_Payroll_Formal.jsx - v18 FINAL
// - Status labels standardized: Pending / Calculated / Approved / Paid
// - Status filter options updated to match exactly
// - Print opens payslip in a NEW window (fixes blank print preview)
// - Deductions modal displays all fields without clipping
// - Payslip uses soft blue theme + logo
// - All other behaviour preserved

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';import {
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
  CloseOutlined, FileSearchOutlined, MoreOutlined,
  ExclamationCircleOutlined, StopOutlined, LockOutlined,
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
  Timeline, Steps, Collapse, Result
} from 'antd';
import dayjs from 'dayjs';
import companyLogo from '../../../assets/images/logo.png';
import '../styles/StaffPayroll.css';
import '../styles/ProcessPayrollModal.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

/* ============================================================
   COMPANY CONSTANTS
   ============================================================ */
const COMPANY_INFO = {
  name: "Dear Babs's Fastfood and Catering Services",
  address: 'Zone 3 Amoros, El Salvador City, Misamis Oriental',
  tin: '',
  phone: '',
  email: '',
};

/* ============================================================
   SAFE HELPERS
   ============================================================ */
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

const safeArray = (value, defaultValue = []) => {
  if (Array.isArray(value)) return value;
  const body = value?.data ?? value;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  if (Array.isArray(body?.employees)) return body.employees;
  if (Array.isArray(body?.data?.employees)) return body.data.employees;
  return defaultValue;
};

const safeObject = (value, defaultValue = {}) => {
  const body = value?.data ?? value;
  if (body?.success && body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  return defaultValue;
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₱0.00';
  const num = Number(amount);
  if (!Number.isFinite(num)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatDecimalHours = (value) => `${Number(value || 0).toFixed(2)}h`;

const formatDateSafe = (dateValue, format = 'MMM DD, YYYY') => {
  if (!dateValue) return 'N/A';
  try {
    const parsed = dayjs(dateValue);
    return parsed.isValid() ? parsed.format(format) : 'Invalid Date';
  } catch (e) {
    return 'Invalid Date';
  }
};

const formatPayrollNumber = (value) => {
  const raw = safeString(value, '').trim();
  if (!raw) return '—';
  if (/^\d+$/.test(raw)) return String(raw).padStart(5, '0');
  const matches = raw.match(/(\d+)(?!.*\d)/);
  if (matches) return matches[1].padStart(5, '0');
  return raw;
};

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const isCutoffProcessable = (year, month, cutoffType) => {
  const now = new Date();
  if (cutoffType === 'first') {
    const end = new Date(year, month, 15, 23, 59, 59);
    return now >= new Date(year, month, 1) || now >= end;
  }
  const start = new Date(year, month, 16);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return now >= start || now >= end;
};

/* ============================================================
   PRINT HELPER — opens payslip HTML in a new window
   ============================================================ */
const printPayslipInNewWindow = (htmlContent) => {
  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) {
    alert('Please allow pop-ups for this site to print the payslip.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.error('Print failed:', e);
    }
  }, 400);
};

/* ============================================================
   SKELETON COMPONENTS
   ============================================================ */

const PrfSkeletonText = ({ width = '100%', height = 12, radius = 6, style = {} }) => (
  <div className="prf-skeleton-text" style={{ width, height, borderRadius: radius, ...style }} />
);

const PrfSkeletonCircle = ({ size = 40, radius = '50%', style = {} }) => (
  <div className="prf-skeleton-circle" style={{ width: size, height: size, minWidth: size, borderRadius: radius, ...style }} />
);

/* Header skeleton */
const PrfSkeletonHeader = () => (
  <div className="prf-header prf-skeleton-header">
    <div className="prf-header-left">
      <PrfSkeletonCircle size={44} radius={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PrfSkeletonText width={200} height={18} />
        <PrfSkeletonText width={170} height={10} />
      </div>
    </div>
    <div className="prf-header-right">
      <PrfSkeletonText width={180} height={34} radius={10} />
      <PrfSkeletonText width={90} height={34} radius={8} />
      <PrfSkeletonText width={80} height={34} radius={8} />
      <PrfSkeletonText width={150} height={34} radius={8} />
    </div>
  </div>
);

/* KPI card skeleton */
const PrfSkeletonKpiCard = ({ delay = 0 }) => (
  <div className="prf-kpi-card prf-skeleton-card" style={{ animationDelay: `${delay}s` }}>
    <div className="prf-skeleton-icon" />
    <div className="prf-kpi-stats" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PrfSkeletonText width={110} height={22} />
      <PrfSkeletonText width={80} height={10} />
    </div>
  </div>
);

/* Period nav skeleton */
const PrfSkeletonPeriodNav = () => (
  <div className="prf-period-nav prf-skeleton-period-nav">
    <div className="prf-period-info" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <PrfSkeletonCircle size={46} radius={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PrfSkeletonText width={130} height={10} />
        <PrfSkeletonText width={200} height={16} />
      </div>
    </div>
    <div className="prf-period-controls">
      <PrfSkeletonText width={220} height={38} radius={10} />
      <PrfSkeletonText width={190} height={38} radius={10} />
    </div>
  </div>
);

/* Filters skeleton */
const PrfSkeletonFilters = () => (
  <div className="prf-filters prf-skeleton-filters">
    <PrfSkeletonText width={180} height={38} radius={10} />
    <PrfSkeletonText width={180} height={38} radius={10} />
    <PrfSkeletonText width={280} height={38} radius={10} />
  </div>
);

/* Table skeleton */
const PrfSkeletonTable = () => {
  const rowWidths = [
    [90, 160, 120, 60, 55, 90, 90, 90, 100, 130],
    [80, 150, 110, 55, 60, 85, 95, 95, 95, 130],
    [95, 170, 125, 65, 55, 90, 90, 90, 105, 130],
    [85, 155, 115, 60, 60, 88, 92, 92, 100, 130],
    [90, 165, 118, 58, 55, 90, 95, 95, 100, 130],
  ];

  return (
    <div className="prf-table-wrapper prf-skeleton-table-wrap">
      <div className="prf-table-scroll">
        <table className="prf-skeleton-table">
          <thead>
            <tr>
              {[...Array(10)].map((_, i) => (
                <th key={i}>
                  <PrfSkeletonText width={i < 3 ? 80 : i === 9 ? 60 : 55} height={10} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowWidths.map((widths, i) => (
              <tr key={i} className="prf-skeleton-row" style={{ animationDelay: `${i * 0.05}s` }}>
                <td><PrfSkeletonText width={widths[0]} height={12} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PrfSkeletonCircle size={32} radius={8} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <PrfSkeletonText width={widths[1]} height={12} />
                      <PrfSkeletonText width={60} height={9} />
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <PrfSkeletonText width={widths[2]} height={12} />
                    <PrfSkeletonText width={70} height={9} />
                  </div>
                </td>
                <td><PrfSkeletonText width={widths[3]} height={12} /></td>
                <td><PrfSkeletonText width={widths[4]} height={12} /></td>
                <td><PrfSkeletonText width={widths[5]} height={12} /></td>
                <td><PrfSkeletonText width={widths[6]} height={12} /></td>
                <td><PrfSkeletonText width={widths[7]} height={12} /></td>
                <td><PrfSkeletonText width={widths[8]} height={22} radius={20} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <PrfSkeletonCircle size={28} radius={6} />
                    <PrfSkeletonCircle size={28} radius={6} />
                    <PrfSkeletonCircle size={28} radius={6} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================
   UI CONFIG — STATUS FILTER OPTIONS
   ============================================================ */
const payrollStatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'calculated', label: 'Calculated' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
];

const getStatusConfig = (status) => {
  const config = {
    paid:       { text: 'Paid',       icon: <CheckCircleOutlined />, color: '#10b981', bg: '#d1fae5' },
    approved:   { text: 'Approved',   icon: <CheckCircleOutlined />, color: '#2563eb', bg: '#dbeafe' },
    calculated: { text: 'Calculated', icon: <CalculatorOutlined />,  color: '#7c3aed', bg: '#ede9fe' },
    draft:      { text: 'Calculated', icon: <CalculatorOutlined />,  color: '#7c3aed', bg: '#ede9fe' },
    pending:    { text: 'Pending',    icon: <ClockCircleOutlined />, color: '#d97706', bg: '#fef3c7' },
    cancelled:  { text: 'Cancelled',  icon: <WarningOutlined />,     color: '#ef4444', bg: '#fee2e2' },
  };
  return config[status] || config.pending;
};

/* ============================================================
   STATUS LABEL MAPPER
   Maps a backend status to the four user-facing labels.
   ============================================================ */
const mapStatusToLabel = (rawStatus) => {
  const s = String(rawStatus || '').toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'approved') return 'approved';
  if (s === 'calculated' || s === 'draft') return 'calculated';
  return 'pending';
};

const EMPLOYEE_TYPES = {
  REGULAR: 'regular',
  ON_CALL: 'on_call',
  CONTRACT: 'contract',
  PART_TIME: 'part_time',
};

const getEmployeeTypeClass = (type = '') => {
  const t = String(type).toLowerCase();
  if (t.includes('full') || t.includes('regular')) return 'blue';
  if (t.includes('part')) return 'orange';
  if (t.includes('contract')) return 'purple';
  if (t.includes('intern') || t.includes('temporary') || t.includes('on_call') || t.includes('on-call')) return 'amber';
  return 'blue';
};

const computeGovernmentDeductions = ({ monthlyBasicSalary, msc, isRegular, autoEnabled }) => {
  const result = { sss: 0, pagibig: 0, philhealth: 0 };
  if (!isRegular || !autoEnabled) return result;

  const sssBase = Math.max(0, msc || monthlyBasicSalary || 0);
  result.sss = +(sssBase * 0.05).toFixed(2);

  const pagibigBase = Math.min(Math.max(0, monthlyBasicSalary || 0), 5000);
  const pagibigRate = (monthlyBasicSalary || 0) <= 1500 ? 0.01 : 0.02;
  result.pagibig = +(pagibigBase * pagibigRate).toFixed(2);

  const philhealthBase = Math.max(0, monthlyBasicSalary || 0);
  result.philhealth = +(philhealthBase * 0.025).toFixed(2);

  return result;
};

const isEndOfMonthCutoff = (cutoffType) => cutoffType === 'second';

/* ============================================================
   REACT QUERY KEYS
   ============================================================ */
const payrollQueryKeys = {
  all: ['payroll'],
  list: (params) => [...payrollQueryKeys.all, 'list', params],
  history: (params) => [...payrollQueryKeys.all, 'history', params],
  stats: (params) => [...payrollQueryKeys.all, 'stats', params],
  historyStats: (params) => [...payrollQueryKeys.all, 'historyStats', params],
  eligibleEmployees: (params) => [...payrollQueryKeys.all, 'eligibleEmployees', params],
  savedEmployees: (params) => [...payrollQueryKeys.all, 'savedEmployees', params],
  preview: (params) => [...payrollQueryKeys.all, 'preview', params],
  payslips: (params) => [...payrollQueryKeys.all, 'payslips', params],
  departments: () => ['departments'],
  attendance: (params) => ['attendance', params],
};

/* ============================================================
   OPTIMISTIC CACHE PATCH HELPERS
   ============================================================
   Every mutation below patches every cached payroll list in
   place BEFORE the server responds, so the UI updates within
   one animation frame (~16ms) instead of waiting for a refetch.
   On settle, the caches are silently reconciled with the server.
   ============================================================ */

/** Patch one row inside every cached payroll list + history list. */
const patchPayrollRowInCache = (queryClient, payrollId, patch) => {
  if (!payrollId) return;
  const targets = queryClient.getQueriesData({ queryKey: payrollQueryKeys.all });

  targets.forEach(([key, value]) => {
    if (!value) return;

    const patchArray = (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map((row) => {
        const id = row?.id ?? row?.payroll_id;
        if (String(id) !== String(payrollId)) return row;
        return { ...row, ...patch };
      });
    };

    const body = value?.data ?? value;

    // shape: [...]
    if (Array.isArray(value)) {
      queryClient.setQueryData(key, patchArray(value));
      return;
    }

    // shape: { data: [...] }
    if (Array.isArray(body)) {
      queryClient.setQueryData(key, { ...value, data: patchArray(body) });
      return;
    }

    // shape: { data: { data: [...] } }
    if (Array.isArray(body?.data)) {
      queryClient.setQueryData(key, {
        ...value,
        data: { ...body, data: patchArray(body.data) },
      });
    }
  });
};

/** Patch one payroll row inside the History tab list. */
const patchHistoryRowInCache = (queryClient, payrollId, patch) => {
  if (!payrollId) return;
  const targets = queryClient.getQueriesData({ queryKey: [...payrollQueryKeys.all, 'history'] });

  targets.forEach(([key, value]) => {
    if (!value) return;
    const body = value?.data ?? value;

    const patchArray = (arr) =>
      Array.isArray(arr)
        ? arr.map((row) => {
            const id = row?.id ?? row?.payroll_id;
            return String(id) === String(payrollId) ? { ...row, ...patch } : row;
          })
        : arr;

    if (Array.isArray(body)) {
      queryClient.setQueryData(key, { ...value, data: patchArray(body) });
    } else if (Array.isArray(body?.data)) {
      queryClient.setQueryData(key, {
        ...value,
        data: { ...body, data: patchArray(body.data) },
      });
    }
  });
};

/** Remove one payroll row from every active list (used by delete). */
const removePayrollRowFromCache = (queryClient, payrollId) => {
  if (!payrollId) return;
  const targets = queryClient.getQueriesData({ queryKey: payrollQueryKeys.all });

  targets.forEach(([key, value]) => {
    if (!value) return;
    const body = value?.data ?? value;
    const filterArray = (arr) =>
      Array.isArray(arr)
        ? arr.filter((row) => String(row?.id ?? row?.payroll_id) !== String(payrollId))
        : arr;

    if (Array.isArray(value)) {
      queryClient.setQueryData(key, filterArray(value));
    } else if (Array.isArray(body)) {
      queryClient.setQueryData(key, { ...value, data: filterArray(body) });
    } else if (Array.isArray(body?.data)) {
      queryClient.setQueryData(key, {
        ...value,
        data: { ...body, data: filterArray(body.data) },
      });
    }
  });
};

/** Patch one row inside the "saved attendance employees" list. */
const patchSavedEmployeeInCache = (queryClient, employeeId, patch) => {
  if (!employeeId) return;
  const targets = queryClient.getQueriesData({ queryKey: payrollQueryKeys.savedEmployees() });

  targets.forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    queryClient.setQueryData(
      key,
      value.map((row) =>
        String(row.employee_id) === String(employeeId) ? { ...row, ...patch } : row
      )
    );
  });
};
/* ============================================================
   QUERIES
   ============================================================ */
// ⭐ PERF: `keepPreviousData` keeps the previous cutoff's rows on screen
//    while the new cutoff's request is in flight, so switching cutoffs
//    never blanks the table or flashes the loading spinner.
const usePayrollList = (params) => useQuery({
  queryKey: payrollQueryKeys.list(params),
  queryFn: () => payrollAPI.getAll({ ...params, per_page: 1000 }),
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  placeholderData: keepPreviousData,
  enabled: !!params?.start_date && !!params?.end_date,
});

const usePayrollHistory = (params) => useQuery({
  queryKey: payrollQueryKeys.history(params),
  queryFn: () => payrollAPI.getHistory({ ...params, per_page: 1000 }),
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  placeholderData: keepPreviousData,
  enabled: !!params?.start_date && !!params?.end_date,
});

const usePayrollStats = (params) => useQuery({
  queryKey: payrollQueryKeys.stats(params),
  queryFn: () => payrollAPI.getStats(params),
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
  enabled: !!params?.start_date && !!params?.end_date,
});

const usePayrollHistoryStats = (params) => useQuery({
  queryKey: payrollQueryKeys.historyStats(params),
  queryFn: () => payrollAPI.getHistoryStats(params),
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
  enabled: !!params?.start_date && !!params?.end_date,
});
const useSavedAttendanceEmployees = (params) => useQuery({
  queryKey: payrollQueryKeys.savedEmployees(params),
  queryFn: async () => {
    const [overviewRes, employeesRes] = await Promise.all([
      attendanceAPI.getEmployeeOverview(params),
      employeeAPI.getAllEmployeesList({ per_page: 1000 }),
    ]);

    const body = safeObject(overviewRes, {});
    const employees = safeArray(body?.employees || overviewRes);

    const allEmployees = safeArray(employeesRes);
    const rateMap = new Map();
    allEmployees.forEach((e) => {
      const id = e.employee_id || e.id;
      const rate = safeNumber(
        e.calculated_hourly_rate ||
        e.hourly_rate ||
        e.position?.salary_grade?.default_hourly_rate ||
        e.position?.salaryGrade?.default_hourly_rate
      );
      rateMap.set(Number(id), rate);
    });

    // ⭐ FIX: The backend employeeOverview() now sets saved_to_payroll from
    //    payroll_ready_at. Trust that flag exclusively. If it is missing
    //    (older backend), fall back to unsaved_count === 0.
    // ⭐ FIX: Include an employee whenever ANY row in the cutoff has been
    //    saved as payroll ready. Partial saves must not hide the employee.
    const saved = employees.filter((emp) => {
      if (emp.saved_to_payroll === true) return true;
      if (safeNumber(emp.saved_count, 0) > 0) return true;
      if (safeNumber(emp.unsaved_count, -1) === 0) return true;
      if (emp.payroll_status) return true;
      return false;
    });

    return saved.map((emp) => {
      const regularHours = safeNumber(emp.regular_hours);
      const overtimeHours = safeNumber(emp.overtime_hours);
      const hourlyRate = safeNumber(
        emp.hourly_rate ||
        emp.calculated_hourly_rate ||
        rateMap.get(Number(emp.employee_id))
      );
      const regularPay = regularHours * hourlyRate;
      const overtimePay = overtimeHours * hourlyRate * 1.25;
      const estimatedGross = safeNumber(
        emp.estimated_gross_pay ||
        (regularPay + overtimePay)
      );

           const payrollStatus = String(emp.payroll_status || '').toLowerCase();
      // ⭐ FIX: "calculated" / "draft" means the row EXISTS but is not yet
      //    approved. It must still be selectable for re-processing and must
      //    NOT disappear from the modal.
      const isFinalized = ['approved', 'paid'].includes(payrollStatus);
      const hasPayrollRow = Boolean(emp.payroll_id || emp.payroll_number) || isFinalized;
      const lastProcessedAt = emp.payroll_updated_at || emp.last_processed_at || emp.payroll_calculated_at || null;

      return {
        id: emp.employee_id,
        employee_id: emp.employee_id,
        employee_code: emp.employee_code,
        full_name: emp.employee_name,
        position: emp.position,
        department: emp.department,
        department_id: emp.department_id,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        total_hours: safeNumber(emp.total_hours) || (regularHours + overtimeHours),
        hourly_rate: hourlyRate,
        regular_pay: regularPay,
        overtime_pay: overtimePay,
        estimated_gross_pay: estimatedGross,
        late_undertime: emp.late_undertime || '',
        // ⭐ FIX: has_payroll must be true whenever a payroll row exists for
        //    this cutoff, regardless of status. Otherwise the modal lets the
        //    user select an employee who already has a calculated payroll,
        //    and the backend rejects the whole batch.
             has_payroll: hasPayrollRow,
        payroll_finalized: isFinalized,
        payroll_status: emp.payroll_status || null,
        payroll_archived: !!emp.payroll_archived,
        employee_type: emp.employee_type || emp.employment_type || 'regular',
        saved_to_payroll: true,
        payroll_id: emp.payroll_id || null,
        payroll_number: emp.payroll_number || null,
        last_processed_at: lastProcessedAt,
      };
    });
  },
  staleTime: 15 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  placeholderData: keepPreviousData,
  enabled: !!params?.start_date && !!params?.end_date,
});
const useAttendanceForPayroll = (params) => useQuery({
  queryKey: payrollQueryKeys.attendance(params),
  queryFn: () => attendanceAPI.getDateRange(params),
  staleTime: 2 * 60 * 1000,
  placeholderData: keepPreviousData,
  enabled: !!params?.start_date && !!params?.end_date,
});

const useDepartmentsList = () => useQuery({
  queryKey: payrollQueryKeys.departments(),
  queryFn: () => departmentAPI.getAll(),
  staleTime: 10 * 60 * 1000,
});

/* ============================================================
   MUTATIONS
   ============================================================ */
const useProcessPayroll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => payrollAPI.processSelected(data),

       // ⭐ OPTIMISTIC: mark the affected employee rows as calculated
    //    BEFORE the server responds so the modal updates instantly.
    //    Also patch the main `payroll` list so the Active Payroll table
    //    picks up the new status in the same frame.
    onMutate: async (variables) => {
      const employeeIds = Array.isArray(variables?.employee_ids) ? variables.employee_ids : [];
      const savedSnapshot = queryClient.getQueriesData({ queryKey: payrollQueryKeys.savedEmployees() });
      const listSnapshot = queryClient.getQueriesData({ queryKey: payrollQueryKeys.all });

      employeeIds.forEach((employeeId) => {
        patchSavedEmployeeInCache(queryClient, employeeId, {
          payroll_status: 'calculated',
          payroll_finalized: false,
          saved_to_payroll: true,
          last_processed_at: new Date().toISOString(),
        });

        // Mark any existing Active Payroll row for this employee as
        // "calculated" so the status pill flips immediately.
        patchPayrollRowInCache(queryClient, employeeId, {
          status: 'calculated',
        });
      });

      return { savedSnapshot, listSnapshot };
    },
    onSuccess: (response) => {
      const payload = safeObject(response, {});
      const processed = safeNumber(payload.processed_count, 0);
      const skipped = safeNumber(payload.skipped_count, 0);
      const alreadyProcessed = safeNumber(payload.already_processed_count, 0);

      if (processed > 0) {
        message.success(
          `${processed} payroll record(s) processed${skipped ? `; ${skipped} skipped` : ''}${alreadyProcessed ? `; ${alreadyProcessed} already processed` : ''}.`
        );
      } else if (alreadyProcessed > 0) {
        message.warning(`${alreadyProcessed} payroll record(s) already exist for this period.`);
      } else {
        message.warning('No payroll records were ready.');
      }
    },

    onError: (error, _variables, context) => {
      // Roll the optimistic patch back.
      if (context?.snapshot) {
        context.snapshot.forEach(([key, value]) => {
          queryClient.setQueryData(key, value);
        });
      }
      message.error(error.response?.data?.message || 'Failed to process payroll');
    },

    // ⭐ Reconcile: because a brand-new payroll row cannot be invented
    //    optimistically (the server assigns its payroll_number / id),
    //    the Active Payroll list and the KPI stats MUST be refetched
    //    after the mutation settles. Use the default refetch type
    //    ("active") so mounted queries re-run immediately.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.savedEmployees() });
    },
  });
};

const usePreviewPayroll = () => useMutation({
  mutationFn: (data) => payrollAPI.previewPayroll(data),
  onError: (error) => {
    message.error(error.response?.data?.message || 'Failed to preview payroll');
  },
});

const useUpdatePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => payrollAPI.update(id, data),

    onMutate: async ({ id, data }) => {
      // Patch the visible row immediately.
      patchPayrollRowInCache(queryClient, id, {
        ...data,
        // optimistic values so the totals look right until the server replies
        sss_deduction: safeNumber(data?.sss_deduction),
        pagibig_deduction: safeNumber(data?.pagibig_deduction),
        philhealth_deduction: safeNumber(data?.philhealth_deduction),
        other_deductions: safeNumber(data?.other_deduction),
        manual_deductions: safeNumber(data?.manual_deductions),
      });
    },

    onSuccess: () => {
      message.success('Payroll updated successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to update payroll');
    },
     onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
    },
  });
};

const useApprovePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.approve(id),

    onMutate: async (id) => {
      patchPayrollRowInCache(queryClient, id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
      });
    },

    onSuccess: () => {
      message.success('Payroll approved successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to approve payroll');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all, refetchType: 'none' });
    },
  });
};

const useMarkAsPaid = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => payrollAPI.markAsPaid(id, data),

    onMutate: async ({ id }) => {
      // Approved → Paid: remove from Active, add to History.
      removePayrollRowFromCache(queryClient, id);
    },

    onSuccess: () => {
      message.success('Payroll marked as paid and moved to history');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to mark as paid');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history(), refetchType: 'none' });
    },
  });
};

const useDeletePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.delete(id),

    onMutate: async (id) => {
      removePayrollRowFromCache(queryClient, id);
    },

    onSuccess: () => {
      message.success('Payroll moved to history archive');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to delete payroll');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history(), refetchType: 'none' });
    },
  });
};

const useRestorePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.restore(id),

    onMutate: async (id) => {
      patchHistoryRowInCache(queryClient, id, {
        deleted_at: null,
        restored_at: new Date().toISOString(),
      });
    },

    onSuccess: () => {
      message.success('Payroll restored from history');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to restore payroll');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history(), refetchType: 'none' });
    },
  });
};

const usePermanentDeletePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => payrollAPI.permanentDelete(id),

    onMutate: async (id) => {
      removePayrollRowFromCache(queryClient, id);
    },

    onSuccess: () => {
      message.success('Payroll permanently deleted');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to permanently delete');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.history(), refetchType: 'none' });
    },
  });
};

const useBulkUpdateDeductions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => payrollAPI.bulkUpdateDeductions(data),

    onMutate: async (data) => {
      const ids = Array.isArray(data?.payroll_ids) ? data.payroll_ids : [];
      ids.forEach((id) => {
        patchPayrollRowInCache(queryClient, id, {
          manual_deductions: safeNumber(data?.manual_deductions),
          manual_deduction_notes: data?.manual_deduction_notes,
        });
      });
    },

    onSuccess: () => {
      message.success('Bulk deductions applied successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to apply bulk deductions');
    },
      onSettled: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.stats() });
    },
  });
};

const useGeneratePayslip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => payslipAPI.generate(data),
    onSuccess: () => {
      // No UI cache to patch — payslip is fetched on demand.
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips, refetchType: 'none' });
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
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.payslips, refetchType: 'none' });
      message.success('Payslips generated successfully');
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to generate payslips');
    },
  });
};

const useDownloadPayslip = () => useMutation({
  mutationFn: (id) => payslipAPI.download(id),
});

const usePreviewPayslip = () => useMutation({
  mutationFn: (payrollId) => payslipAPI.preview(payrollId),
});
/* ============================================================
   PAYSLIP DOCUMENT (LANDSCAPE, SOFT BLUE THEME)
   ============================================================ */
const PayslipDocument = ({ payslip }) => {
  const s = payslip?.summary || {};
  const wd = payslip?.work_details || payslip?.attendance_days || [];
  const wdTotals = s?.work_details_totals || {};

  const regularPay = safeNumber(s.regular_pay);
  const overtimePay = safeNumber(s.overtime_pay);
  const holidayPay = safeNumber(s.holiday_pay || 0);
  const grossPay = safeNumber(s.gross_pay) || (regularPay + overtimePay + holidayPay);

  const sss = safeNumber(s.sss);
  const pagibig = safeNumber(s.pagibig);
  const philhealth = safeNumber(s.philhealth);
  const tax = safeNumber(s.tax || s.withholding_tax || 0);
  const otherDeductions = safeNumber(s.other_deduction || s.other_deductions || 0);

  const totalDeductions =
    safeNumber(s.total_deductions) || (sss + pagibig + philhealth + tax + otherDeductions);
  const netPay = safeNumber(s.net_pay) || (grossPay - totalDeductions);

  return (
    <div className="payslip-doc-landscape">
      <div className="payslip-doc-header-landscape">
        <div className="payslip-doc-brand-landscape">
          <div className="payslip-doc-brand-mark-landscape">
            <img src={companyLogo} alt="Company logo" />
          </div>
          <div className="payslip-doc-brand-text-landscape">
            <h1>{COMPANY_INFO.name}</h1>
            <p>{COMPANY_INFO.address}</p>
          </div>
        </div>
        <div className="payslip-doc-title-landscape">
          <div className="payslip-doc-title-main">PAYSLIP</div>
          <div className="payslip-doc-title-sub">
            № {formatPayrollNumber(s.payroll_number)}
          </div>
        </div>
      </div>

      <div className="payslip-info-grid-landscape">
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Employee</span>
          <span className="payslip-info-value-landscape">{s.employee_name || '—'}</span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Employee ID</span>
          <span className="payslip-info-value-landscape">{s.employee_code || s.employee_id || '—'}</span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Position</span>
          <span className="payslip-info-value-landscape">{s.position_name || '—'}</span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Department</span>
          <span className="payslip-info-value-landscape">{s.department_name || '—'}</span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Bank account</span>
          <span className="payslip-info-value-landscape">{s.bank_account_number || '—'}</span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Employment type</span>
          <span className="payslip-info-value-landscape">{s.employee_type || 'Regular'}</span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Payroll period</span>
          <span className="payslip-info-value-landscape">
            {formatDateSafe(s.period_start, 'MMM DD')} – {formatDateSafe(s.period_end, 'MMM DD, YYYY')}
          </span>
        </div>
        <div className="payslip-info-block-landscape">
          <span className="payslip-info-label-landscape">Payment date</span>
          <span className="payslip-info-value-landscape">
            {formatDateSafe(s.payment_date, 'MMM DD, YYYY')}
          </span>
        </div>
      </div>

      <div className="payslip-columns-landscape">
        <div className="payslip-panel-landscape">
          <div className="payslip-panel-title-landscape earn">
            <DollarOutlined /> EARNINGS
          </div>
          <table className="payslip-desc-table-landscape">
            <thead>
              <tr>
                <th style={{ width: '58%' }}>Description</th>
                <th style={{ width: '18%' }} className="num">Rate / hrs</th>
                <th style={{ width: '24%' }} className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Hourly rate</td>
                <td className="num">{formatCurrency(s.hourly_rate)}</td>
                <td className="num">—</td>
              </tr>
              <tr>
                <td>Regular pay</td>
                <td className="num">{Number(s.regular_hours || 0).toFixed(2)} hrs</td>
                <td className="num">{formatCurrency(regularPay)}</td>
              </tr>
              <tr>
                <td>Overtime pay</td>
                <td className="num">{Number(s.overtime_hours || 0).toFixed(2)} hrs</td>
                <td className="num">{formatCurrency(overtimePay)}</td>
              </tr>
              {holidayPay > 0 && (
                <tr>
                  <td>Holiday pay</td>
                  <td className="num">—</td>
                  <td className="num">{formatCurrency(holidayPay)}</td>
                </tr>
              )}
              <tr className="payslip-row-total-landscape">
                <td colSpan={2}>Gross pay</td>
                <td className="num">{formatCurrency(grossPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="payslip-panel-landscape">
          <div className="payslip-panel-title-landscape deduct">
            <MinusCircleOutlined /> DEDUCTIONS
          </div>
          <table className="payslip-desc-table-landscape">
            <thead>
              <tr>
                <th style={{ width: '58%' }}>Description</th>
                <th style={{ width: '18%' }} className="num">Rate</th>
                <th style={{ width: '24%' }} className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>SSS</td>
                <td className="num">5.00%</td>
                <td className="num">{formatCurrency(sss)}</td>
              </tr>
              <tr>
                <td>Pag-IBIG</td>
                <td className="num">2.00%</td>
                <td className="num">{formatCurrency(pagibig)}</td>
              </tr>
              <tr>
                <td>PhilHealth</td>
                <td className="num">2.50%</td>
                <td className="num">{formatCurrency(philhealth)}</td>
              </tr>
              <tr>
                <td>Withholding tax</td>
                <td className="num">—</td>
                <td className="num">{formatCurrency(tax)}</td>
              </tr>
              <tr>
                <td>Other deductions</td>
                <td className="num">—</td>
                <td className="num">{formatCurrency(otherDeductions)}</td>
              </tr>
              <tr className="payslip-row-total-landscape deduct">
                <td colSpan={2}>Total deductions</td>
                <td className="num">{formatCurrency(totalDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="payslip-netpay-strip-landscape">
        <div className="payslip-netpay-strip-label-landscape">
          <CheckCircleOutlined /> Net pay
        </div>
        <div className="payslip-netpay-strip-amount-landscape">
          {formatCurrency(netPay)}
        </div>
      </div>

      <div className="payslip-workdetails-landscape">
        <div className="payslip-workdetails-title-landscape">
          <ScheduleOutlined /> WORK DETAIL COSTING
        </div>
        <div className="payslip-workdetails-scroll-landscape">
          <table className="payslip-workdetails-table-landscape">
            <thead>
              <tr>
                <th style={{ width: '11%' }}>Date</th>
                <th style={{ width: '7%' }}>Day</th>
                <th style={{ width: '13%' }}>Schedule</th>
                <th style={{ width: '9%' }}>Time in</th>
                <th style={{ width: '9%' }}>Time out</th>
                <th style={{ width: '8%' }} className="num">Hours</th>
                <th style={{ width: '7%' }} className="num">OT</th>
                <th style={{ width: '12%' }} className="num">Salary pay</th>
                <th style={{ width: '12%' }} className="num">OT pay</th>
                <th style={{ width: '12%' }} className="num">Day total</th>
              </tr>
            </thead>
            <tbody>
              {wd.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-landscape">
                    No attendance records for this period.
                  </td>
                </tr>
              )}
              {wd.map((row, i) => (
                <tr key={i}>
                  <td>{formatDateSafe(row.date, 'MMM DD, YYYY')}</td>
                  <td>{row.day || '—'}</td>
                  <td>{row.schedule_time || 'Unscheduled'}</td>
                  <td>{row.time_in || '—'}</td>
                  <td>{row.time_out || '—'}</td>
                  <td className="num">{Number(row.regular_hours || 0).toFixed(2)}</td>
                  <td className="num">
                    {Number(row.overtime_hours || 0) > 0
                      ? Number(row.overtime_hours).toFixed(2)
                      : '—'}
                  </td>
                  <td className="num">{formatCurrency(row.regular_pay)}</td>
                  <td className="num">
                    {Number(row.overtime_pay || 0) > 0 ? formatCurrency(row.overtime_pay) : '—'}
                  </td>
                  <td className="num payslip-wd-day-total-landscape">
                    {formatCurrency(row.daily_total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="tfoot-label-landscape">TOTALS</td>
                <td className="num">
                  {Number(wdTotals.total_regular_hours || 0).toFixed(2)}
                </td>
                <td className="num">
                  {Number(wdTotals.total_overtime_hours || 0).toFixed(2)}
                </td>
                <td className="num">{formatCurrency(wdTotals.total_regular_pay)}</td>
                <td className="num">{formatCurrency(wdTotals.total_overtime_pay)}</td>
                <td className="num tfoot-grand-landscape">
                  {formatCurrency(wdTotals.total_labor_cost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="payslip-footer-landscape">
        <div className="payslip-footer-note-landscape">
          <InfoCircleOutlined /> System-generated payslip — no signature required. For questions, contact HR.
        </div>
        <div className="payslip-footer-stamp-landscape">
          Generated {formatDateSafe(new Date(), 'MMM DD, YYYY · HH:mm')}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
const Staff_Payroll_Formal = () => {
  const queryClient = useQueryClient();
  const isMounted = useRef(true);
  const { user } = useAuth();
  const canFinalizePayroll = hasAllowedRole(user, ADMIN_ROLES);
  const currentUserName = user?.person?.full_name || user?.name || user?.username || '';

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

  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('all');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('all');
  const [selectedEmployeesForPayroll, setSelectedEmployeesForPayroll] = useState([]);
  const [selectAllEmployees, setSelectAllEmployees] = useState(false);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState([]);

  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showEmployeeSelectionModal, setShowEmployeeSelectionModal] = useState(false);
  const [showDeductionsModal, setShowDeductionsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEditDeductionsModal, setShowEditDeductionsModal] = useState(false);
  const [showHistoryDetailsModal, setShowHistoryDetailsModal] = useState(false);
  const [showBulkDeductionModal, setShowBulkDeductionModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showSavedRecordsModal, setShowSavedRecordsModal] = useState(false);
  const [showCutoffWarningModal, setShowCutoffWarningModal] = useState(false);
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState(false);
  const [pendingPayrollProcess, setPendingPayrollProcess] = useState(null);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedPayrollForEdit, setSelectedPayrollForEdit] = useState(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [payrollPreview, setPayrollPreview] = useState(null);
  const [processNotes, setProcessNotes] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [savedRecordsEmployee, setSavedRecordsEmployee] = useState(null);
  const [savedRecordsList, setSavedRecordsList] = useState([]);
  const [savedRecordsSummary, setSavedRecordsSummary] = useState(null);
  const [savedRecordsLoading, setSavedRecordsLoading] = useState(false);
  const [savedRecordsFilterMonth, setSavedRecordsFilterMonth] = useState(new Date().getMonth());
  const [savedRecordsFilterYear, setSavedRecordsFilterYear] = useState(new Date().getFullYear());
  const [savedRecordsFilterCutoff, setSavedRecordsFilterCutoff] = useState('first');

  const [deductionAutoEnabled, setDeductionAutoEnabled] = useState(false);
  const [processDeductions, setProcessDeductions] = useState({
    sss: 0, pagibig: 0, philhealth: 0, tax: 0, other: 0,
  });
  const [processDeductionNotes, setProcessDeductionNotes] = useState('');
  const [otherDeductionType, setOtherDeductionType] = useState('');
  const [otherDeductionNotes, setOtherDeductionNotes] = useState('');
  const [forceWarningOpen, setForceWarningOpen] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [forceReprocess, setForceReprocess] = useState(false);
  const [duplicateProcessInfo, setDuplicateProcessInfo] = useState(null);

  const [bulkDeductionAmount, setBulkDeductionAmount] = useState(0);
  const [bulkDeductionReason, setBulkDeductionReason] = useState('');
  const [bulkDeductionType, setBulkDeductionType] = useState('other');
  const [bulkDeductionCategory, setBulkDeductionCategory] = useState('company');

  const [deductionType, setDeductionType] = useState('cash_advance');
  const [deductionCategory, setDeductionCategory] = useState('loan');
  const [deductionReference, setDeductionReference] = useState('');
  const [deductionDate, setDeductionDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [deductionApprovedBy, setDeductionApprovedBy] = useState('');
  const [manualDeductionAmount, setManualDeductionAmount] = useState(0);
  const [manualDeductionReason, setManualDeductionReason] = useState('');
  const [enableManualDeduction, setEnableManualDeduction] = useState(false);
  const [sssDeduction, setSssDeduction] = useState(0);
  const [pagibigDeduction, setPagibigDeduction] = useState(0);
  const [philhealthDeduction, setPhilhealthDeduction] = useState(0);
  const [otherDeduction, setOtherDeduction] = useState(0);
  const [processingAction, setProcessingAction] = useState(false);

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

   // ⭐ FIX: Format a Date using LOCAL components, never toISOString().
  //    toISOString() converts to UTC, which shifts the calendar day
  //    backwards in timezones ahead of UTC (e.g. UTC+8 Philippines),
  //    pushing a Sept 16 cutoff start back to Sept 15 and causing the
  //    saved Payroll row to land in the wrong cutoff / month.
  const toLocalDateString = useCallback((date) => {
    if (!date || isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

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
      start, end, label, shortLabel,
      // ⭐ FIX: Use local date components, NOT toISOString().
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
    };
  }, [toLocalDateString]);
  const currentCutoff = useMemo(() => {
    try {
      return getCutoffDates(selectedYear, selectedMonth, cutoffType);
    } catch (error) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        label: 'Current Period',
        shortLabel: 'Current',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
      };
    }
  }, [selectedYear, selectedMonth, cutoffType, getCutoffDates]);

  const periodLabel = currentCutoff.label || 'Current Period';

  const isCutoffComplete = useMemo(() => {
    const now = new Date();
    const endDate = new Date(currentCutoff.end);
    return now >= endDate;
  }, [currentCutoff]);

  const isFutureCutoff = useMemo(() => {
    const now = new Date();
    if (cutoffType === 'first') {
      return now < new Date(selectedYear, selectedMonth, 1);
    }
    return now < new Date(selectedYear, selectedMonth, 16);
  }, [selectedYear, selectedMonth, cutoffType]);

  const getEmployeeType = (employee) => {
    const position = safeString(employee?.position?.title || employee?.position_name || employee?.position || '').toLowerCase();
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

  const isRegularEmployee = (employee) => {
    const t = safeString(
      employee?.employee_type ||
      employee?.employment_type ||
      employee?.position?.employment_type ||
      ''
    ).toLowerCase();
    if (!t) return true;
    return t === 'regular' || t === 'full_time' || t === 'full-time';
  };

    // ⭐ PERF: The query key is derived ONLY from the cutoff dates. Pagination
  //    and filters are applied client-side. This means switching cutoffs
  //    reuses the prefetched cache entry (no spinner, no blank table),
  //    and prefetch in the mount effect above actually warms the right key.
  const payrollParams = useMemo(() => ({
    start_date: currentCutoff.startDate,
    end_date: currentCutoff.endDate,
  }), [currentCutoff]);

  const historyParams = useMemo(() => ({
    start_date: currentCutoff.startDate,
    end_date: currentCutoff.endDate,
  }), [currentCutoff]);

  const statsParams = useMemo(() => ({
    start_date: currentCutoff.startDate,
    end_date: currentCutoff.endDate,
  }), [currentCutoff]);

  const savedEmployeesParams = useMemo(() => ({
    start_date: currentCutoff.startDate,
    end_date: currentCutoff.endDate,
    department_id: employeeDepartmentFilter !== 'all' ? employeeDepartmentFilter : undefined,
  }), [currentCutoff, employeeDepartmentFilter]);

  const attendanceParams = useMemo(() => ({
    start_date: currentCutoff.startDate,
    end_date: currentCutoff.endDate,
    per_page: 1000,
  }), [currentCutoff]);

  const { data: payrollDataRes, isLoading: payrollLoading, refetch: refetchPayroll } = usePayrollList(payrollParams);
  const { data: historyDataRes, isLoading: historyLoading, refetch: refetchHistory } = usePayrollHistory(historyParams);
  const { data: statsRes, refetch: refetchStats } = usePayrollStats(statsParams);
  const { data: historyStatsRes, refetch: refetchHistoryStats } = usePayrollHistoryStats(statsParams);
  const { data: savedEmployeesRes, refetch: refetchSaved } = useSavedAttendanceEmployees(savedEmployeesParams);
  const { data: departmentsRes } = useDepartmentsList();
  const { data: attendanceRes, refetch: refetchAttendance } = useAttendanceForPayroll(attendanceParams);

  const payrollData = safeArray(payrollDataRes);
  const payrollHistory = safeArray(historyDataRes);

  const statistics = statsRes?.data?.data?.statistics || statsRes?.data?.statistics || statsRes?.data?.data || null;
  const historyStatistics = historyStatsRes?.data?.data?.statistics || historyStatsRes?.data?.statistics || historyStatsRes?.data?.data || null;

  const savedEmployees = safeArray(savedEmployeesRes);
  const eligibleEmployees = savedEmployees;
  const departments = safeArray(departmentsRes);
  const attendanceData = safeArray(attendanceRes);

  /* ============================================================
     CLIENT-SIDE STATUS FILTER
     Matches the four user-facing labels:
       pending    → records that somehow have no status
       calculated → calculated + draft
       approved   → approved
       paid       → paid
     ============================================================ */
  const filteredData = useMemo(() => {
    if (!Array.isArray(payrollData)) return [];
    return payrollData.filter((item) => {
      const deptMatch = selectedDepartment === 'all' || item.employee?.department_id == selectedDepartment;

      let statusMatch = true;
      if (selectedStatus !== 'all') {
        const rawStatus = String(item.status || '').toLowerCase();
        if (selectedStatus === 'pending') {
          statusMatch = !rawStatus || rawStatus === 'pending';
        } else if (selectedStatus === 'calculated') {
          statusMatch = rawStatus === 'calculated' || rawStatus === 'draft';
        } else {
          statusMatch = rawStatus === selectedStatus;
        }
      }

      const searchMatch = !searchQuery
        || (item.employee?.full_name && item.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
        || (item.employee?.employee_id && item.employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase()))
        || (item.payroll_number && item.payroll_number.toLowerCase().includes(searchQuery.toLowerCase()));
      return deptMatch && statusMatch && searchMatch;
    });
  }, [payrollData, selectedDepartment, selectedStatus, searchQuery]);

  const paginatedData = useMemo(
    () => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredData, currentPage, pageSize]
  );

  const totalPayrollPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const totalHistoryPages = Math.max(1, Math.ceil(payrollHistory.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPayrollPages) setCurrentPage(totalPayrollPages);
  }, [totalPayrollPages, currentPage]);

  useEffect(() => {
    if (historyCurrentPage > totalHistoryPages) setHistoryCurrentPage(totalHistoryPages);
  }, [totalHistoryPages, historyCurrentPage]);

    const filteredEligibleEmployees = useMemo(() => {
    const normalizedSearch = employeeSearchQuery.trim().toLowerCase();
    return (eligibleEmployees || []).filter((emp) => {
      const matchesSearch = !normalizedSearch
        || safeString(emp.full_name).toLowerCase().includes(normalizedSearch)
        || safeString(emp.employee_code).toLowerCase().includes(normalizedSearch)
        || safeString(emp.employee_id).toLowerCase().includes(normalizedSearch)
        || safeString(emp.position).toLowerCase().includes(normalizedSearch)
        || safeString(emp.department).toLowerCase().includes(normalizedSearch);

      const matchesDepartment = employeeDepartmentFilter === 'all'
        || String(emp.department_id) === String(employeeDepartmentFilter);

      const s = String(emp.payroll_status || '').toLowerCase();
      const isCalculated = s === 'calculated' || s === 'draft';
      const isFinalized = Boolean(emp.payroll_finalized);

      // ⭐ FIX: "Ready" must mean "not yet finalized". Anything that is
      //    pending OR calculated (but not approved/paid) still needs admin
      //    action, so it belongs under "Ready". Previously a calculated row
      //    was excluded from BOTH "Ready" and "Finalized", making the table
      //    empty even though the stat strip said "2 Ready to Process".
      const isReady = !isFinalized;

      const matchesStatus =
        employeeStatusFilter === 'all'
        || (employeeStatusFilter === 'eligible' && isReady)
        || (employeeStatusFilter === 'calculated' && isCalculated)
        || (employeeStatusFilter === 'processed' && isFinalized);

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [eligibleEmployees, employeeSearchQuery, employeeDepartmentFilter, employeeStatusFilter]);

  const eligibleStats = useMemo(() => {
    const total = eligibleEmployees.length;

    // ⭐ FIX: "Processed" = approved OR paid (true finalization).
    //    "Calculated" = has a payroll row but not yet approved — still
    //    actionable, so it counts toward "Ready to Process".
    const finalized = eligibleEmployees.filter((e) => e.payroll_finalized).length;
    const calculated = eligibleEmployees.filter((e) => {
      const s = String(e.payroll_status || '').toLowerCase();
      return s === 'calculated' || s === 'draft';
    }).length;

    // Ready = anything not finalized (pending + calculated).
    const readyToProcess = total - finalized;

    return {
      total,
      pending: readyToProcess,
      processed: finalized,
      saved: calculated,
      calculated,
    };
  }, [eligibleEmployees]);
  
  const selectableEligibleEmployees = useMemo(
    // ⭐ FIX: Only approved/paid rows are locked. Calculated rows must remain
    //    selectable so the admin can reprocess them, and they now appear
    //    under the "Ready" tab.
    () => filteredEligibleEmployees.filter((emp) => !emp.payroll_finalized),
    [filteredEligibleEmployees]
  );

  const isAllSelected = useMemo(() => {
    return selectableEligibleEmployees.length > 0
      && selectableEligibleEmployees.every((emp) => selectedEmployeesForPayroll.includes(emp.id));
  }, [selectableEligibleEmployees, selectedEmployeesForPayroll]);

  const selectedTotals = useMemo(() => {
    const selected = eligibleEmployees.filter((e) => selectedEmployeesForPayroll.includes(e.id));
    return {
      regularHours: selected.reduce((s, e) => s + safeNumber(e.regular_hours), 0),
      overtimeHours: selected.reduce((s, e) => s + safeNumber(e.overtime_hours), 0),
      grossPay: selected.reduce((s, e) => s + safeNumber(e.estimated_gross_pay), 0),
    };
  }, [eligibleEmployees, selectedEmployeesForPayroll]);

  const autoDeductionPreview = useMemo(() => {
    if (!deductionAutoEnabled) return { sss: 0, pagibig: 0, philhealth: 0, perEmployee: [] };

    let sss = 0;
    let pagibig = 0;
    let philhealth = 0;
    const perEmployee = [];

    const selectedEmps = eligibleEmployees.filter((e) => selectedEmployeesForPayroll.includes(e.id));

    selectedEmps.forEach((emp) => {
      if (!isRegularEmployee(emp)) return;

      const hourlyRate = safeNumber(emp.hourly_rate);
      const monthlyBasic = safeNumber(
        emp.monthly_basic_salary ||
        (hourlyRate > 0 ? hourlyRate * 8 * 22 : 0)
      );

      const computed = computeGovernmentDeductions({
        monthlyBasicSalary: monthlyBasic,
        msc: emp.msc || monthlyBasic,
        isRegular: true,
        autoEnabled: true,
      });

      sss += computed.sss;
      pagibig += computed.pagibig;
      philhealth += computed.philhealth;

      perEmployee.push({
        employee_id: emp.employee_id,
        name: emp.full_name,
        monthly_basic: monthlyBasic,
        sss: computed.sss,
        pagibig: computed.pagibig,
        philhealth: computed.philhealth,
      });
    });

    return {
      sss: +sss.toFixed(2),
      pagibig: +pagibig.toFixed(2),
      philhealth: +philhealth.toFixed(2),
      perEmployee,
    };
  }, [deductionAutoEnabled, eligibleEmployees, selectedEmployeesForPayroll]);

  useEffect(() => {
    if (!deductionAutoEnabled) return;
    setProcessDeductions((prev) => ({
      ...prev,
      sss: autoDeductionPreview.sss,
      pagibig: autoDeductionPreview.pagibig,
      philhealth: autoDeductionPreview.philhealth,
    }));
  }, [deductionAutoEnabled, autoDeductionPreview]);

  const handleViewPayroll = useCallback((item) => {
    setSelectedEmployee(item);
    setShowPayrollModal(true);
  }, []);

  const handleViewAttendance = useCallback(async (employee) => {
    try {
      const response = await attendanceAPI.getEmployeeRecords({
        employee_id: employee.employee_id,
        start_date: currentCutoff.startDate,
        end_date: currentCutoff.endDate,
      });
      const body = safeObject(response, {});
      const rows = safeArray(body?.records);

      const enriched = rows.map((r) => {
        const scheduled = r.assigned_schedule && r.assigned_schedule !== 'Unscheduled';
        const hasIn = r.time_in && r.time_in !== '' && r.time_in !== null;
        const hasOut = r.time_out && r.time_out !== '' && r.time_out !== null;

        let computedStatus = 'present';
        if (scheduled && !hasIn && !hasOut) {
          computedStatus = 'absent';
        } else if (!scheduled && !hasIn && !hasOut) {
          computedStatus = 'no_duty';
        } else if (hasIn && !hasOut) {
          computedStatus = 'missing_time_out';
        } else if (!hasIn && hasOut) {
          computedStatus = 'missing_time_in';
        } else if (hasIn && hasOut) {
          const st = String(r.status || '').toLowerCase();
          computedStatus = st === 'late' ? 'late' : 'present';
        }

        return { ...r, _computed_status: computedStatus };
      });

      setAttendanceRecords(enriched);
      setSelectedEmployee(employee);
      setShowAttendanceModal(true);
    } catch (error) {
      message.error('Failed to load attendance records');
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
    setSssDeduction(payroll.sss_deduction || 0);
    setPagibigDeduction(payroll.pagibig_deduction || 0);
    setPhilhealthDeduction(payroll.philhealth_deduction || 0);
    setOtherDeduction(payroll.other_deductions || 0);
    setShowEditDeductionsModal(true);
  }, []);

  const handleApprovePayroll = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Approve Payroll',
      content: 'Approve this calculated payroll for payment?',
      okText: 'Approve Payroll',
      cancelText: 'Cancel',
      onOk: async () => { await approvePayrollMutation.mutateAsync(payrollId); },
    });
  }, [approvePayrollMutation]);

  const handleMarkAsPaid = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Payment',
      content: 'Mark this approved payroll as paid? It will be moved to Payroll History.',
      okText: 'Confirm Payment',
      cancelText: 'Cancel',
      onOk: async () => {
        await markAsPaidMutation.mutateAsync({ id: payrollId, data: { payment_method: 'bank_transfer' } });
        setSelectedPayrollIds((prev) => prev.filter((id) => id !== payrollId));
      },
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
        setSelectedPayrollIds((prev) => prev.filter((id) => id !== payrollId));
      },
    });
  }, [deletePayrollMutation]);

  const handleRestorePayroll = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Restoration',
      content: 'Are you sure you want to restore this payroll record?',
      okText: 'Restore',
      cancelText: 'Cancel',
      onOk: async () => { await restorePayrollMutation.mutateAsync(payrollId); },
    });
  }, [restorePayrollMutation]);

  const handlePermanentDelete = useCallback((payrollId) => {
    Modal.confirm({
      title: 'Confirm Permanent Deletion',
      content: 'This action cannot be undone.',
      okText: 'Permanently Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => { await permanentDeleteMutation.mutateAsync(payrollId); },
    });
  }, [permanentDeleteMutation]);

  const handleGeneratePayslip = useCallback(async (payrollId) => {
    if (!payrollId) {
      message.warning('Invalid payroll record.');
      return;
    }
    try {
      const result = await previewPayslipMutation.mutateAsync(payrollId);
      const payload = result?.data?.data ?? result?.data;
      if (payload && (payload.summary || payload.work_details || payload.payroll)) {
        setSelectedPayslip(payload);
        setShowPayslipModal(true);
      } else {
        const fallback = await generatePayslipMutation.mutateAsync({ payroll_id: payrollId });
        const fallbackPayload = fallback?.data?.data ?? fallback?.data;
        if (fallbackPayload) {
          setSelectedPayslip(fallbackPayload);
          setShowPayslipModal(true);
        } else {
          message.error('Payslip data unavailable.');
        }
      }
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to load payslip');
    }
  }, [previewPayslipMutation, generatePayslipMutation]);

  const handleBulkGeneratePayslips = useCallback(async () => {
    if (selectedPayrollIds.length === 0) { message.warning('Please select payroll records first'); return; }
    Modal.confirm({
      title: 'Bulk Generate Payslips',
      content: `Generate payslips for ${selectedPayrollIds.length} payroll record(s)?`,
      okText: 'Generate',
      cancelText: 'Cancel',
      onOk: async () => {
        await bulkGeneratePayslipsMutation.mutateAsync(selectedPayrollIds);
        setSelectedPayrollIds([]);
      },
    });
  }, [selectedPayrollIds, bulkGeneratePayslipsMutation]);

  const handleDownloadPayslip = useCallback(async (payrollId) => {
    if (!payrollId) {
      message.warning('No payroll record to download.');
      return;
    }
    try {
      const result = await downloadPayslipMutation.mutateAsync(payrollId);
      const blob = new Blob([result.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      message.error('Failed to download payslip');
    }
  }, [downloadPayslipMutation]);

  const handleOpenSavedRecords = useCallback(async (employee) => {
    setSavedRecordsEmployee(employee);
    setShowSavedRecordsModal(true);
    setSavedRecordsLoading(true);
    setSavedRecordsList([]);
    setSavedRecordsSummary(null);
    setSavedRecordsFilterMonth(selectedMonth);
    setSavedRecordsFilterYear(selectedYear);
    setSavedRecordsFilterCutoff(cutoffType);
    try {
          // ⭐ FIX: Always send the cutoff currently shown in the header, not the
      //    Saved Records filter state (which the user may have changed).
      const response = await attendanceAPI.getEmployeeSavedRecords({
        employee_id: employee.employee_id || employee.id,
        month: selectedMonth + 1,
        year: selectedYear,
        cutoff: cutoffType,
        start_date: currentCutoff.startDate,
        end_date: currentCutoff.endDate,
      });
      const body = safeObject(response, {});
      setSavedRecordsList(safeArray(body?.records));
      setSavedRecordsSummary(body?.summary || null);
    } catch (error) {
      setSavedRecordsList([]);
      setSavedRecordsSummary(null);
    } finally {
      setSavedRecordsLoading(false);
    }
  }, [selectedMonth, selectedYear, cutoffType]);

  const handleFetchSavedRecords = useCallback(async () => {
    if (!savedRecordsEmployee) return;
    setSavedRecordsLoading(true);
    try {
        // ⭐ FIX: Use dayjs with explicit local date components.
        //    `new Date(y, m, 0)` = last day of month `m` (0-indexed),
        //    which dayjs formats in LOCAL time — safe for UTC+8.
        const savedCutoffStart = dayjs(
          new Date(
            savedRecordsFilterYear,
            savedRecordsFilterMonth,
            savedRecordsFilterCutoff === 'second' ? 16 : 1
          )
        ).format('YYYY-MM-DD');

        const savedCutoffEnd = savedRecordsFilterCutoff === 'second'
          ? dayjs(new Date(savedRecordsFilterYear, savedRecordsFilterMonth + 1, 0)).format('YYYY-MM-DD')
          : dayjs(new Date(savedRecordsFilterYear, savedRecordsFilterMonth, 15)).format('YYYY-MM-DD');

        const response = await attendanceAPI.getEmployeeSavedRecords({
          employee_id: savedRecordsEmployee.employee_id || savedRecordsEmployee.id,
          month: savedRecordsFilterMonth + 1,
          year: savedRecordsFilterYear,
          cutoff: savedRecordsFilterCutoff,
          start_date: savedCutoffStart,
          end_date: savedCutoffEnd,
        });
      const body = safeObject(response, {});
      setSavedRecordsList(safeArray(body?.records));
      setSavedRecordsSummary(body?.summary || null);
    } catch (error) {
      setSavedRecordsList([]);
      setSavedRecordsSummary(null);
    } finally {
      setSavedRecordsLoading(false);
    }
  }, [savedRecordsEmployee, savedRecordsFilterMonth, savedRecordsFilterYear, savedRecordsFilterCutoff]);

  const getMoreActionsMenu = useCallback((item) => ({
    items: [
      { key: 'attendance', label: 'View Attendance', icon: <ScheduleOutlined />, onClick: () => handleViewAttendance(item.employee) },
      { key: 'saved-records', label: 'Saved Records', icon: <FileSearchOutlined />, onClick: () => handleOpenSavedRecords(item.employee) },
      { key: 'generate-payslip', label: 'Generate Payslip', icon: <FilePdfOutlined />, onClick: () => handleGeneratePayslip(item.id) },
      { key: 'divider-1', type: 'divider' },
      { key: 'edit-deductions', label: 'Edit Deductions', icon: <CalculatorOutlined />, onClick: () => handleEditDeductions(item), disabled: item.status === 'paid' },
      { key: 'divider-2', type: 'divider' },
      { key: 'delete', label: 'Move to History', icon: <DeleteOutlined />, danger: true, onClick: () => handleDeletePayroll(item.id), disabled: item.status === 'paid' },
    ].filter((entry) => canFinalizePayroll || !['delete', 'divider-2'].includes(entry.key)),
  }), [canFinalizePayroll, handleViewAttendance, handleOpenSavedRecords, handleGeneratePayslip, handleEditDeductions, handleDeletePayroll]);

  const openDeductionsModal = useCallback(() => {
    if (selectedEmployeesForPayroll.length === 0) {
      message.warning('Please select at least one employee');
      return;
    }
    if (isFutureCutoff) {
      message.warning('Cannot process payroll for a cutoff that has not started yet.');
      return;
    }
    // ⭐ FIX: Always start the deductions modal from a clean zero state.
    //    Auto-deductions default OFF so the admin must explicitly opt in.
    setProcessDeductions({ sss: 0, pagibig: 0, philhealth: 0, tax: 0, other: 0 });
    setProcessDeductionNotes('');
    setDeductionAutoEnabled(false);
    setOtherDeductionType('');
    setOtherDeductionNotes('');
    setForceReprocess(false);
    setForceReason('');
    setShowDeductionsModal(true);
  }, [selectedEmployeesForPayroll, isFutureCutoff]);

  const governmentDeductionsRequested = useMemo(() => (
    safeNumber(processDeductions.sss) > 0
    || safeNumber(processDeductions.pagibig) > 0
    || safeNumber(processDeductions.philhealth) > 0
  ), [processDeductions]);

  const executeProcessPayroll = useCallback(async (forceReprocessFlag = false, forceReasonText = '') => {
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

       // ⭐ FIX: Zero means "no deduction". Only send the deductions object
    //    when the user actually entered a non-zero amount OR enabled
    //    auto government deductions. Otherwise the backend treats the
    //    presence of the keys as "apply deductions" and silently
    //    deducts even when the admin typed 0.
    const sssAmount = safeNumber(processDeductions.sss);
    const pagibigAmount = safeNumber(processDeductions.pagibig);
    const philhealthAmount = safeNumber(processDeductions.philhealth);
    const taxAmount = safeNumber(processDeductions.tax);
    const otherAmount = safeNumber(processDeductions.other);

    const hasAnyManualDeduction =
      sssAmount > 0 ||
      pagibigAmount > 0 ||
      philhealthAmount > 0 ||
      taxAmount > 0 ||
      otherAmount > 0;

    const shouldSendDeductions = deductionAutoEnabled || hasAnyManualDeduction;

    const data = {
      period_start: startDate,
      period_end: endDate,
      start_date: startDate,
      end_date: endDate,
      employee_ids: selectedEmployeesForPayroll,
      notes: processNotes || 'Payroll processed from saved attendance',
      cutoff_type: cutoffType,
      auto_government_deductions: deductionAutoEnabled,
      force_reprocess: forceReprocessFlag,
      force_reason: forceReasonText,
      // ⭐ FIX: Only include `deductions` when something is actually applied.
      //    When it is omitted, the backend must produce zero deductions.
      ...(shouldSendDeductions
        ? {
            deductions: {
              sss: sssAmount,
              pagibig: pagibigAmount,
              philhealth: philhealthAmount,
              tax: taxAmount,
              other: otherAmount,
              other_type: otherDeductionType || null,
              other_notes: otherDeductionNotes || null,
              notes: processDeductionNotes || null,
            },
          }
        : {
            // Explicit signal so the backend cannot fall back to defaults.
            deductions: null,
            skip_deductions: true,
          }),
    };

    try {
      const result = await processPayrollMutation.mutateAsync(data);
      if (result?.data?.success) {
        const payload = safeObject(result.data, {});
        const processed = safeNumber(payload.processed_count, 0);
        const alreadyProcessed = safeNumber(payload.already_processed_count, 0);

        message.success(`Payroll processed for ${processed} employee(s)${alreadyProcessed ? `; ${alreadyProcessed} already existed` : ''}`);
        setShowDeductionsModal(false);
        setShowEmployeeSelectionModal(false);
        setForceWarningOpen(false);
        setForceReason('');
        setForceReprocess(false);
        setShowDuplicateWarningModal(false);
        setDuplicateProcessInfo(null);
        setSelectedEmployeesForPayroll([]);
        setSelectAllEmployees(false);
        setProcessNotes('');
        setOtherDeductionType('');
        setOtherDeductionNotes('');
                // ⭐ PERF: Fire the refetches in the background. The optimistic
        //    onMutate patch already updated the visible cache, so the modal
        //    can close immediately instead of waiting for the server.
        Promise.allSettled([
          refetchPayroll(),
          refetchStats(),
          refetchSaved(),
          refetchAttendance(),
        ]);
        // ⭐ Move the modal to the Calculated tab so the user can see the
        //    row that was just produced, instead of watching it vanish from
        //    the "Ready" tab.
        setEmployeeStatusFilter('calculated');
      } else {
        message.error(result?.data?.message || 'Failed to process payroll');
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message
        || error?.response?.data?.errors?.start_date?.[0]
        || error?.message
        || 'Failed to process payroll.';
      message.error(errorMessage);
    }
  }, [
    selectedEmployeesForPayroll, currentCutoff, processNotes, cutoffType,
    deductionAutoEnabled, processDeductions, processDeductionNotes,
    otherDeductionType, otherDeductionNotes,
    processPayrollMutation, refetchPayroll, refetchStats, refetchSaved, refetchAttendance,
  ]);

  const handleConfirmDeductions = useCallback(async () => {
    if (safeNumber(processDeductions.other) > 0 && !otherDeductionType) {
      message.warning('Please select a type for the "Other Deduction" you entered.');
      return;
    }
    if (otherDeductionType === 'other' && !otherDeductionNotes.trim()) {
      message.warning('Please describe the "Other" deduction.');
      return;
    }

    if (isFutureCutoff) {
      message.error('Cannot process payroll for a cutoff that has not started yet.');
      return;
    }

    if (!isCutoffComplete && !pendingPayrollProcess) {
      setPendingPayrollProcess({ type: 'confirmDeductions' });
      setShowCutoffWarningModal(true);
      return;
    }

    if (governmentDeductionsRequested && !isEndOfMonthCutoff(cutoffType)) {
      setForceWarningOpen(true);
      return;
    }

    // ⭐ FIX: Only finalized (approved/paid) rows are true duplicates.
    //    A calculated row that is re-selected is a reprocess, not a duplicate.
    const alreadyProcessedEmployees = eligibleEmployees.filter(
      (emp) => selectedEmployeesForPayroll.includes(emp.id) && emp.payroll_finalized
    );

    if (alreadyProcessedEmployees.length > 0 && !forceReprocess) {
      setDuplicateProcessInfo({
        count: alreadyProcessedEmployees.length,
        employees: alreadyProcessedEmployees.map((e) => ({
          id: e.id,
          name: e.full_name,
          code: e.employee_code,
          status: e.payroll_status,
          payrollNumber: e.payroll_number,
        })),
      });
      setShowDuplicateWarningModal(true);
      return;
    }

    await executeProcessPayroll(forceReprocess, forceReason);
  }, [
    governmentDeductionsRequested, cutoffType, executeProcessPayroll,
    isCutoffComplete, isFutureCutoff, pendingPayrollProcess, forceReprocess, forceReason,
    processDeductions.other, otherDeductionType, otherDeductionNotes,
    eligibleEmployees, selectedEmployeesForPayroll,
  ]);

  const handleForceAddDeductions = useCallback(async () => {
    if (!forceReason.trim()) {
      message.warning('Please provide a reason for adding deductions outside end-of-month cutoff.');
      return;
    }
    await executeProcessPayroll(forceReprocess, forceReason);
  }, [forceReason, forceReprocess, executeProcessPayroll]);

    const handlePreviewPayroll = useCallback(async () => {
    if (selectedEmployeesForPayroll.length === 0) {
      message.warning('Please select at least one employee');
      return;
    }
    const startDate = currentCutoff.startDate;
    const endDate = currentCutoff.endDate;

    // ⭐ FIX: Mirror the same deduction intent the Process Payroll flow
    //    sends, so the preview shows exactly what the admin will get.
    const sssAmount = safeNumber(processDeductions.sss);
    const pagibigAmount = safeNumber(processDeductions.pagibig);
    const philhealthAmount = safeNumber(processDeductions.philhealth);
    const taxAmount = safeNumber(processDeductions.tax);
    const otherAmount = safeNumber(processDeductions.other);

    const hasAnyManualDeduction =
      sssAmount > 0 ||
      pagibigAmount > 0 ||
      philhealthAmount > 0 ||
      taxAmount > 0 ||
      otherAmount > 0;

    const shouldSendDeductions = deductionAutoEnabled || hasAnyManualDeduction;

    const data = {
      employee_ids: selectedEmployeesForPayroll,
      period_start: startDate,
      period_end: endDate,
      start_date: startDate,
      end_date: endDate,
      cutoff_type: cutoffType,
      auto_government_deductions: deductionAutoEnabled,
      ...(shouldSendDeductions
        ? {
            deductions: {
              sss: sssAmount,
              pagibig: pagibigAmount,
              philhealth: philhealthAmount,
              tax: taxAmount,
              other: otherAmount,
            },
          }
        : {
            deductions: null,
            skip_deductions: true,
          }),
    };
    try {
      const result = await previewPayrollMutation.mutateAsync(data);
      if (result?.data?.success) {
        setPayrollPreview(result.data.data);
        setShowPreviewModal(true);
      } else {
        message.error(result?.data?.message || 'Failed to preview payroll');
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to preview payroll';
      message.error(errorMessage);
    }
  }, [
    selectedEmployeesForPayroll,
    currentCutoff,
    cutoffType,
    previewPayrollMutation,
    deductionAutoEnabled,
    processDeductions,
  ]);

  const handleExport = useCallback(async () => {
    try {
      const response = await payrollAPI.export({
        start_date: currentCutoff.startDate,
        end_date: currentCutoff.endDate,
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
    }
  }, [currentCutoff]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchPayroll(),
      refetchStats(),
      refetchHistory(),
      refetchHistoryStats(),
      refetchSaved(),
      refetchAttendance(),
    ]);
    message.success('Data refreshed successfully');
  }, [refetchPayroll, refetchStats, refetchHistory, refetchHistoryStats, refetchSaved, refetchAttendance]);

    const changeCutoff = useCallback((direction) => {
    // ⭐ PERF: Reset pagination and selection BEFORE the new cutoff is
    //    applied, so the table renders the new cutoff's first page in the
    //    same frame the state changes.
    setCurrentPage(1);
    setHistoryCurrentPage(1);
    setSelectedPayrollIds([]);
    setSelectedEmployeesForPayroll([]);
    setSearchQuery('');
    setSelectedStatus('all');

    if (direction === 'prev') {
      if (cutoffType === 'first') {
        setCutoffType('second');
        let newMonth = selectedMonth - 1;
        let newYear = selectedYear;
        if (newMonth < 0) { newMonth = 11; newYear--; }
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
        if (newMonth > 11) { newMonth = 0; newYear++; }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
      } else {
        setCutoffType('second');
      }
    }
  }, [cutoffType, selectedMonth, selectedYear]);

  // ⭐ FIX: Warm the React Query cache for a cutoff the user is *about to*
  //    navigate to (hover on the cutoff/month buttons). Uses the same query
  //    keys as the live hooks so the click hits a warm cache — no spinner,
  //    no blank table, no flash.
  const prefetchCutoff = useCallback(
    (year, month, cutoff) => {
      try {
        const target = getCutoffDates(year, month, cutoff);
        if (!target?.startDate || !target?.endDate) return;

        const listParams = {
          start_date: target.startDate,
          end_date: target.endDate,
        };
        const savedParams = {
          start_date: target.startDate,
          end_date: target.endDate,
          department_id:
            employeeDepartmentFilter !== 'all' ? employeeDepartmentFilter : undefined,
        };

        // Payroll list
        queryClient.prefetchQuery({
          queryKey: payrollQueryKeys.list(listParams),
          queryFn: () => payrollAPI.getAll({ ...listParams, per_page: 1000 }),
          staleTime: 30 * 1000,
        });

        // Payroll history
        queryClient.prefetchQuery({
          queryKey: payrollQueryKeys.history(listParams),
          queryFn: () => payrollAPI.getHistory({ ...listParams, per_page: 1000 }),
          staleTime: 30 * 1000,
        });

        // Payroll stats
        queryClient.prefetchQuery({
          queryKey: payrollQueryKeys.stats(listParams),
          queryFn: () => payrollAPI.getStats(listParams),
          staleTime: 30 * 1000,
        });

        // History stats
        queryClient.prefetchQuery({
          queryKey: payrollQueryKeys.historyStats(listParams),
          queryFn: () => payrollAPI.getHistoryStats(listParams),
          staleTime: 30 * 1000,
        });

        // Saved attendance employees (used by the Process Payroll modal)
        queryClient.prefetchQuery({
          queryKey: payrollQueryKeys.savedEmployees(savedParams),
          queryFn: async () => {
            const [overviewRes, employeesRes] = await Promise.all([
              attendanceAPI.getEmployeeOverview(savedParams),
              employeeAPI.getAllEmployeesList({ per_page: 1000 }),
            ]);

            const body = safeObject(overviewRes, {});
            const employees = safeArray(body?.employees || overviewRes);
            const allEmployees = safeArray(employeesRes);

            const rateMap = new Map();
            allEmployees.forEach((e) => {
              const id = e.employee_id || e.id;
              const rate = safeNumber(
                e.calculated_hourly_rate ||
                  e.hourly_rate ||
                  e.position?.salary_grade?.default_hourly_rate ||
                  e.position?.salaryGrade?.default_hourly_rate
              );
              rateMap.set(Number(id), rate);
            });

            const saved = employees.filter((emp) => {
              if (emp.saved_to_payroll === true) return true;
              if (safeNumber(emp.saved_count, 0) > 0) return true;
              if (safeNumber(emp.unsaved_count, -1) === 0) return true;
              if (emp.payroll_status) return true;
              return false;
            });

            return saved.map((emp) => {
              const regularHours = safeNumber(emp.regular_hours);
              const overtimeHours = safeNumber(emp.overtime_hours);
              const hourlyRate = safeNumber(
                emp.hourly_rate ||
                  emp.calculated_hourly_rate ||
                  rateMap.get(Number(emp.employee_id))
              );
              const regularPay = regularHours * hourlyRate;
              const overtimePay = overtimeHours * hourlyRate * 1.25;
              const estimatedGross = safeNumber(
                emp.estimated_gross_pay || regularPay + overtimePay
              );

              const payrollStatus = String(emp.payroll_status || '').toLowerCase();
              const isFinalized = ['approved', 'paid'].includes(payrollStatus);
              const hasPayrollRow =
                Boolean(emp.payroll_id || emp.payroll_number) || isFinalized;
              const lastProcessedAt =
                emp.payroll_updated_at ||
                emp.last_processed_at ||
                emp.payroll_calculated_at ||
                null;

              return {
                id: emp.employee_id,
                employee_id: emp.employee_id,
                employee_code: emp.employee_code,
                full_name: emp.employee_name,
                position: emp.position,
                department: emp.department,
                department_id: emp.department_id,
                regular_hours: regularHours,
                overtime_hours: overtimeHours,
                total_hours:
                  safeNumber(emp.total_hours) || regularHours + overtimeHours,
                hourly_rate: hourlyRate,
                regular_pay: regularPay,
                overtime_pay: overtimePay,
                estimated_gross_pay: estimatedGross,
                late_undertime: emp.late_undertime || '',
                has_payroll: hasPayrollRow,
                payroll_finalized: isFinalized,
                payroll_status: emp.payroll_status || null,
                payroll_archived: !!emp.payroll_archived,
                employee_type:
                  emp.employee_type || emp.employment_type || 'regular',
                saved_to_payroll: true,
                payroll_id: emp.payroll_id || null,
                payroll_number: emp.payroll_number || null,
                last_processed_at: lastProcessedAt,
              };
            });
          },
          staleTime: 15 * 1000,
        });
      } catch (e) {
        // Prefetch must never break the UI.
        if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true') {
          console.warn('prefetchCutoff failed:', e);
        }
      }
    },
    [queryClient, getCutoffDates, employeeDepartmentFilter]
  );

  const openEmployeeSelectionModal = useCallback(() => {
    setEmployeeSearchQuery('');
    setEmployeeDepartmentFilter('all');
    // ⭐ FIX: Default to "Ready" so the user lands on rows that actually
    //    need action. Calculated / finalized rows are one tab away.
    setEmployeeStatusFilter('eligible');
    setSelectedEmployeesForPayroll([]);
    setSelectAllEmployees(false);
    setShowEmployeeSelectionModal(true);
    refetchSaved();
  }, [refetchSaved]);
  const resetDeductionForm = useCallback(() => {
    setEnableManualDeduction(false);
    setManualDeductionAmount(0);
    setManualDeductionReason('');
    setDeductionType('cash_advance');
    setDeductionCategory('loan');
    setDeductionReference('');
    setDeductionDate(dayjs().format('YYYY-MM-DD'));
    setDeductionApprovedBy('');
    setSssDeduction(0);
    setPagibigDeduction(0);
    setPhilhealthDeduction(0);
    setOtherDeduction(0);
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
      deduction_status: canFinalizePayroll ? 'approved' : 'pending',
      sss_deduction: sssDeduction,
      pagibig_deduction: pagibigDeduction,
      philhealth_deduction: philhealthDeduction,
      other_deduction: otherDeduction,
    };
    await updatePayrollMutation.mutateAsync({ id: selectedPayrollForEdit.id, data });
    setShowEditDeductionsModal(false);
    resetDeductionForm();
  }, [selectedPayrollForEdit, enableManualDeduction, manualDeductionAmount, manualDeductionReason, deductionType, deductionCategory, deductionReference, deductionDate, deductionApprovedBy, sssDeduction, pagibigDeduction, philhealthDeduction, otherDeduction, canFinalizePayroll, currentUserName, updatePayrollMutation, resetDeductionForm]);

  const handleBulkMarkAsPaid = useCallback(() => {
    if (selectedPayrollIds.length === 0) { message.warning('Please select payroll records first'); return; }
    const selectedRows = payrollData.filter((row) => selectedPayrollIds.includes(row.id));
    if (selectedRows.some((row) => row.status !== 'approved')) {
      message.warning('Only approved payroll records can be marked as paid.');
      return;
    }
    Modal.confirm({
      title: 'Bulk Mark as Paid',
      content: `Mark ${selectedPayrollIds.length} approved payroll record(s) as paid?`,
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
      },
    });
  }, [selectedPayrollIds, payrollData, markAsPaidMutation, refetchPayroll, refetchStats, refetchHistory, refetchHistoryStats]);

  const handleBulkDeductions = useCallback(async () => {
    if (selectedPayrollIds.length === 0) { message.warning('Please select payroll records first'); return; }
    if (bulkDeductionAmount <= 0) { message.warning('Please enter a valid deduction amount'); return; }
    if (!bulkDeductionReason.trim()) { message.warning('Please provide a reason for the deduction'); return; }
    const data = {
      payroll_ids: selectedPayrollIds,
      manual_deductions: bulkDeductionAmount,
      manual_deduction_notes: bulkDeductionReason,
      deduction_type: bulkDeductionType,
      deduction_category: bulkDeductionCategory,
      deduction_approved_by: canFinalizePayroll ? (currentUserName || null) : null,
      deduction_status: canFinalizePayroll ? 'approved' : 'pending',
      deduction_date: dayjs().format('YYYY-MM-DD'),
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
      setSelectedEmployeesForPayroll(selectableEligibleEmployees.map((emp) => emp.id));
    }
    setSelectAllEmployees(!selectAllEmployees);
  }, [selectAllEmployees, selectableEligibleEmployees]);

  const handleSelectEmployee = useCallback((employeeId) => {
    setSelectedEmployeesForPayroll((prev) => (
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    ));
  }, []);

  const handleSelectPayroll = useCallback((payrollId) => {
    setSelectedPayrollIds((prev) => (
      prev.includes(payrollId) ? prev.filter((id) => id !== payrollId) : [...prev, payrollId]
    ));
  }, []);

  useEffect(() => {
    setSelectAllEmployees(isAllSelected);
  }, [isAllSelected]);

  const renderEmptyPaginationFooter = (label) => (
    <div className="prf-empty-pagination-footer">
      <span className="prf-empty-pagination-total">Total 0 {label}</span>
      <div className="prf-empty-pagination-controls">
        <Button className="prf-pagination-navigation-button" size="small" icon={<LeftOutlined />} disabled>Previous</Button>
        <button type="button" className="prf-empty-pagination-current-page" disabled>1</button>
        <Button className="prf-pagination-navigation-button" size="small" disabled>Next <RightOutlined /></Button>
      </div>
    </div>
  );

  const buildPageList = (totalPages, current) => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 4) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    if (current < totalPages - 3) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  /* ============================================================
     PAYROLL TABLE COLUMNS
     ============================================================ */
  const payrollColumns = [
    {
      title: 'PAYROLL #',
      dataIndex: 'payroll_number',
      key: 'payroll_number',
      width: 110,
      render: (value) => <span className="prf-id-text">#{formatPayrollNumber(value)}</span>,
    },
    {
      title: 'EMPLOYEE',
      key: 'employee',
      width: 220,
      render: (_, record) => (
        <div className="prf-employee-cell">
          <div className="prf-employee-avatar">
            {getInitials(record.employee?.full_name || record.employee_name)}
          </div>
          <div>
            <div className="prf-employee-name">
              {safeString(record.employee?.full_name || record.employee_name)}
            </div>
            <div className="prf-employee-id">
              {safeString(record.employee?.employee_code || record.employee_code || record.employee?.employee_id)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'POSITION',
      key: 'position',
      width: 160,
      render: (_, record) => (
        <div>
          <div className="prf-position-name">
            {safeString(record.position_name || record.employee?.position || '—')}
          </div>
          <div className="prf-position-dept">
            {safeString(record.department_name || record.employee?.department || '—')}
          </div>
        </div>
      ),
    },
    {
      title: 'REG HOURS',
      key: 'regular_hours',
      width: 90,
      align: 'right',
      render: (_, record) => (
        <span className="prf-amount">{formatDecimalHours(record.regular_hours)}</span>
      ),
    },
    {
      title: 'OT HOURS',
      key: 'overtime_hours',
      width: 90,
      align: 'right',
      render: (_, record) => {
        const ot = safeNumber(record.overtime_hours);
        if (ot <= 0) return <span className="prf-amount" style={{ color: '#94a3b8' }}>—</span>;
        return <span className="prf-amount prf-overtime">{formatDecimalHours(ot)}</span>;
      },
    },
    {
      title: 'GROSS PAY',
      key: 'gross_pay',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const gross = safeNumber(record.gross_pay)
          || (safeNumber(record.regular_pay) + safeNumber(record.overtime_pay));
        return <span className="prf-amount">{formatCurrency(gross)}</span>;
      },
    },
    {
      title: 'DEDUCTIONS',
      key: 'deductions',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <span className="prf-amount prf-amount-negative">
          {formatCurrency(record.total_deductions)}
        </span>
      ),
    },
    {
      title: 'NET PAY',
      dataIndex: 'net_pay',
      key: 'net_pay',
      width: 130,
      align: 'right',
      render: (value) => <span className="prf-amount prf-amount-primary">{formatCurrency(value)}</span>,
    },
    {
      /* STATUS COLUMN — maps backend status to one of the four user-facing
         labels: Pending / Calculated / Approved / Paid. */
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value) => {
        const label = mapStatusToLabel(value);
        const config = getStatusConfig(label);
        return (
          <span className={`prf-status ${label}`}>
            {config.icon} {config.text}
          </span>
        );
      },
    },
    {
      title: 'ACTIONS',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const isPaid = record.status === 'paid';
        const isApproved = record.status === 'approved';
        return (
          <div className="prf-action-cell">
            <Tooltip title="View Details">
              <button
                type="button"
                className="prf-action-btn view"
                onClick={() => handleViewPayroll(record)}
              >
                <EyeOutlined />
              </button>
            </Tooltip>

            <Tooltip title="Preview Payslip">
              <button
                type="button"
                className="prf-action-btn preview"
                onClick={() => handleGeneratePayslip(record.id)}
              >
                <FileTextOutlined />
              </button>
            </Tooltip>

            {!isPaid && !isApproved && canFinalizePayroll && (
              <Tooltip title="Approve Payroll">
                <button
                  type="button"
                  className="prf-action-btn approve"
                  onClick={() => handleApprovePayroll(record.id)}
                >
                  <CheckCircleOutlined />
                </button>
              </Tooltip>
            )}
            {isApproved && canFinalizePayroll && (
              <Tooltip title="Mark as Paid">
                <button
                  type="button"
                  className="prf-action-btn approve"
                  onClick={() => handleMarkAsPaid(record.id)}
                >
                  <CheckOutlined />
                </button>
              </Tooltip>
            )}

            <Dropdown
              menu={getMoreActionsMenu(record)}
              trigger={['click']}
              placement="bottomRight"
            >
              <button type="button" className="prf-action-btn more">
                <MoreOutlined />
              </button>
            </Dropdown>
          </div>
        );
      },
    },
  ];

  const historyColumns = [
    {
      title: 'PAYROLL #',
      dataIndex: 'payroll_number',
      key: 'payroll_number',
      width: 130,
      render: (value) => <span className="prf-id-text">#{formatPayrollNumber(value)}</span>,
    },
    {
      title: 'EMPLOYEE',
      key: 'employee',
      width: 200,
      render: (_, record) => (
        <div className="prf-employee-cell">
          <div className="prf-employee-avatar">
            {getInitials(record.employee?.full_name || record.employee_name)}
          </div>
          <div>
            <div className="prf-employee-name">
              {safeString(record.employee?.full_name || record.employee_name)}
            </div>
            <div className="prf-employee-id">
              {safeString(record.employee?.employee_code || record.employee_code || record.employee?.employee_id)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'PERIOD',
      key: 'period',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{formatDateSafe(record.period_start || record.cutoff_start)} - {formatDateSafe(record.period_end || record.cutoff_end)}</div>
          <div className="prf-period-cutoff">
            {record.cutoff_type || (record.period_start && dayjs(record.period_start).date() <= 15 ? '1st Cutoff' : '2nd Cutoff')}
          </div>
        </div>
      ),
    },
    {
      title: 'GROSS PAY',
      key: 'gross_pay',
      width: 140,
      align: 'right',
      render: (_, record) => (
        <span className="prf-amount">
          {formatCurrency(record.gross_pay || (safeNumber(record.regular_pay) + safeNumber(record.overtime_pay)))}
        </span>
      ),
    },
    {
      title: 'DEDUCTIONS',
      key: 'deductions',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <span className="prf-amount prf-amount-negative">{formatCurrency(record.total_deductions)}</span>
      ),
    },
    {
      title: 'NET PAY',
      dataIndex: 'net_pay',
      key: 'net_pay',
      width: 150,
      align: 'right',
      render: (value) => <span className="prf-amount prf-amount-primary">{formatCurrency(value)}</span>,
    },
    {
      title: 'HISTORY STATUS',
      key: 'history_status',
      width: 180,
      render: (_, record) => {
        const label = mapStatusToLabel(record.status);
        const config = getStatusConfig(label);
        return (
          <div>
            <span className={`prf-status ${label}`}>
              {config.icon} {config.text}
            </span>
            <div className="prf-deleted-at">{formatDateSafe(record.paid_at || record.deleted_at)}</div>
          </div>
        );
      },
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 140,
      align: 'right',
      render: (_, record) => (
        <div className="prf-action-cell" style={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View Details">
            <button className="prf-action-btn view" onClick={() => handleViewHistory(record)}>
              <EyeOutlined />
            </button>
          </Tooltip>
          {canFinalizePayroll && record.status !== 'paid' && (
            <Tooltip title="Restore">
              <button className="prf-action-btn approve" onClick={() => handleRestorePayroll(record.id)}>
                <UndoOutlined />
              </button>
            </Tooltip>
          )}
          {canFinalizePayroll && (
            <Tooltip title="Permanently Delete">
              <button
                className="prf-action-btn more"
                style={{ color: '#ef4444' }}
                onClick={() => handlePermanentDelete(record.id)}
              >
                <DeleteIcon />
              </button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  const containerClass = `prf-container ${isDarkMode ? 'prf-dark-mode' : ''}`;
  const headerClass = `prf-header ${isDarkMode ? 'prf-header-dark' : ''}`;
  const mainCardClass = `prf-main-card ${isDarkMode ? 'prf-main-card-dark' : ''}`;
  const filtersClass = `prf-filters ${isDarkMode ? 'prf-filters-dark' : ''}`;
  const tableClass = `prf-table-wrapper ${isDarkMode ? 'prf-table-wrapper-dark' : ''}`;
  const isLoading = payrollLoading || historyLoading;
  // ⭐ PERF: Only show the full-page skeleton on the very first load.
  //    When switching cutoffs, `keepPreviousData` keeps the old rows
  //    visible, so we must not swap the whole page for a skeleton.
  const hasEverLoaded = payrollData.length > 0 || payrollHistory.length > 0;
  const showFullSkeleton = isLoading && !hasEverLoaded;
  const endOfMonth = isEndOfMonthCutoff(cutoffType);
  const totalProcessDeductions = safeNumber(processDeductions.sss)
    + safeNumber(processDeductions.pagibig)
    + safeNumber(processDeductions.philhealth)
    + safeNumber(processDeductions.tax)
    + safeNumber(processDeductions.other);

  // ⭐ Full-page skeleton while the initial load runs
  if (showFullSkeleton) {
    return (
      <App>
        <ConfigProvider theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
          <div className={`prf-container prf-skeleton-container ${isDarkMode ? 'prf-dark-mode' : ''}`}>
            <PrfSkeletonHeader />

            <div className="prf-kpi-grid">
              {[...Array(4)].map((_, i) => (
                <PrfSkeletonKpiCard key={i} delay={i * 0.05} />
              ))}
            </div>

            <Card className={`prf-main-card prf-skeleton-card ${isDarkMode ? 'prf-main-card-dark' : ''}`} variant="borderless">
              <div className="prf-skeleton-tabs-row">
                <PrfSkeletonText width={180} height={42} radius={8} />
                <PrfSkeletonText width={200} height={42} radius={8} />
              </div>

              <PrfSkeletonPeriodNav />
              <PrfSkeletonFilters />
              <PrfSkeletonTable />
            </Card>
          </div>
        </ConfigProvider>
      </App>
    );
  }

  return (
    <App>
      <ConfigProvider theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
        <div className={containerClass}>

          <div className={headerClass}>
            <div className="prf-header-left">
              <div className="prf-logo-icon"><DollarOutlined /></div>
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
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Refresh</Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>Export</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openEmployeeSelectionModal} disabled={isFutureCutoff}>
                Process Payroll
              </Button>
            </div>
          </div>

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
                      <div className="prf-period-nav">
                        <div className="prf-period-info">
                          <div className="prf-period-icon">
                            <CalendarOutlined />
                          </div>
                          <div className="prf-period-text">
                            <span className="prf-period-label">CURRENT CUTOFF PERIOD</span>
                            <span className="prf-period-value">{periodLabel}</span>
                            {!isCutoffComplete && !isFutureCutoff && (
                              <span className="prf-period-badge prf-period-badge--active">
                                In Progress
                              </span>
                            )}
                            {isCutoffComplete && !isFutureCutoff && (
                              <span className="prf-period-badge prf-period-badge--past">
                                Ended — Processable
                              </span>
                            )}
                            {isFutureCutoff && (
                              <span className="prf-period-badge prf-period-badge--future">
                                Future — Not Yet Available
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="prf-period-controls">
                          <div className="prf-cutoff-selector">
                                                       <button
                              type="button"
                              className={`prf-cutoff-btn ${cutoffType === 'first' ? 'active' : ''}`}
                              onMouseEnter={() => prefetchCutoff(selectedYear, selectedMonth, 'first')}
                              onClick={() => {
                                setCurrentPage(1);
                                setHistoryCurrentPage(1);
                                setSelectedPayrollIds([]);
                                setSelectedEmployeesForPayroll([]);
                                setSearchQuery('');
                                setSelectedStatus('all');
                                setCutoffType('first');
                              }}
                            >
                              <CalendarOutlined className="prf-cutoff-btn-icon" />
                              <span>1st - 15th</span>
                            </button>
                            <button
                              type="button"
                              className={`prf-cutoff-btn ${cutoffType === 'second' ? 'active' : ''}`}
                              onMouseEnter={() => prefetchCutoff(selectedYear, selectedMonth, 'second')}
                              onClick={() => {
                                setCurrentPage(1);
                                setHistoryCurrentPage(1);
                                setSelectedPayrollIds([]);
                                setSelectedEmployeesForPayroll([]);
                                setSearchQuery('');
                                setSelectedStatus('all');
                                setCutoffType('second');
                              }}
                            >
                              <CalendarOutlined className="prf-cutoff-btn-icon" />
                              <span>16th - End</span>
                            </button>
                          </div>

                          <div className="prf-month-navigator">
                                                        <button
                              type="button"
                              className="prf-month-nav-btn"
                              onMouseEnter={() => {
                                const prevMonth = cutoffType === 'first' ? selectedMonth - 1 : selectedMonth;
                                const prevCutoff = cutoffType === 'first' ? 'second' : 'first';
                                let y = selectedYear;
                                let m = prevMonth;
                                if (m < 0) { m = 11; y -= 1; }
                                prefetchCutoff(y, m, prevCutoff);
                              }}
                              onClick={() => changeCutoff('prev')}
                              aria-label="Previous period"
                            >
                              <LeftOutlined />
                            </button>
                            <span className="prf-month-label">
                              {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <button
                              type="button"
                              className="prf-month-nav-btn"
                              onMouseEnter={() => {
                                const nextMonth = cutoffType === 'second' ? selectedMonth + 1 : selectedMonth;
                                const nextCutoff = cutoffType === 'second' ? 'first' : 'second';
                                let y = selectedYear;
                                let m = nextMonth;
                                if (m > 11) { m = 0; y += 1; }
                                prefetchCutoff(y, m, nextCutoff);
                              }}
                              onClick={() => changeCutoff('next')}
                              aria-label="Next period"
                            >
                              <RightOutlined />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isFutureCutoff && (
                        <Alert
                          type="warning"
                          showIcon
                          icon={<ClockCircleOutlined />}
                          message="This cutoff has not started yet"
                          description={`The cutoff ${periodLabel} starts on ${formatDateSafe(currentCutoff.start)}. You can only process payroll for the current or past cutoffs.`}
                          style={{ margin: '0 0 16px 0' }}
                        />
                      )}

                      <div className={filtersClass}>
                        <div className="prf-filter-group">
                          <FilterOutlined />
                          <Select
                            value={selectedStatus}
                            onChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
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
                            onChange={(v) => { setSelectedDepartment(v); setCurrentPage(1); }}
                            className="prf-filter-select"
                            placeholder="Department"
                          >
                            <Option value="all">All Departments</Option>
                            {departments.map((dept) => (
                              <Option key={dept.id} value={dept.id}>{safeString(dept.name)}</Option>
                            ))}
                          </Select>
                        </div>
                        <div className="prf-filter-group prf-search">
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

                      {selectedPayrollIds.length > 0 && (
                        <div className="prf-bulk-actions-bar">
                          <span><ThunderboltOutlined /> {selectedPayrollIds.length} record(s) selected</span>
                          <Space>
                            <Button type="primary" danger icon={<MinusCircleOutlined />} onClick={() => setShowBulkDeductionModal(true)} loading={processingAction}>
                              Bulk Add Deduction
                            </Button>
                            <Button type="primary" icon={<FilePdfOutlined />} onClick={handleBulkGeneratePayslips} loading={bulkGeneratePayslipsMutation.isPending}>
                              Bulk Generate Payslips
                            </Button>
                            {canFinalizePayroll && (
                              <Button type="primary" icon={<CheckOutlined />} onClick={handleBulkMarkAsPaid} loading={processingAction}>
                                Bulk Mark as Paid
                              </Button>
                            )}
                            <Button onClick={() => setSelectedPayrollIds([])}>Clear Selection</Button>
                          </Space>
                        </div>
                      )}

                                 <Spin
                        spinning={isLoading && !hasEverLoaded}
                        indicator={<LoadingOutlined spin />}
                      >
                        <div className="prf-table-wrapper">
                          <div className="prf-table-scroll">
                            <Table
                              columns={payrollColumns}
                              dataSource={paginatedData}
                              rowKey={(record) => record.id}
                              className={tableClass}
                              scroll={{ x: 1100 }}
                              pagination={false}
                              footer={
                                paginatedData.length === 0
                                  ? () => renderEmptyPaginationFooter('payroll records')
                                  : undefined
                              }
                            />
                          </div>

                          {filteredData.length > 0 && (
                            <div className="prf-table-pagination">
                              <span className="prf-pagination-info">
                                Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>
                                {' '}–{' '}
                                <strong>{Math.min(currentPage * pageSize, filteredData.length)}</strong>
                                {' '}of <strong>{filteredData.length}</strong> payroll record{filteredData.length === 1 ? '' : 's'}
                              </span>
                              <div className="prf-pagination-controls">
                                <button
                                  type="button"
                                  className="prf-pagination-btn"
                                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                  disabled={currentPage === 1}
                                >
                                  <LeftOutlined /> Prev
                                </button>
                                {buildPageList(totalPayrollPages, currentPage).map((p, idx) =>
                                  p === '...' ? (
                                    <span key={`e-${idx}`} className="prf-pagination-ellipsis">…</span>
                                  ) : (
                                    <button
                                      key={p}
                                      type="button"
                                      className={`prf-pagination-page ${currentPage === p ? 'active' : ''}`}
                                      onClick={() => setCurrentPage(p)}
                                    >
                                      {p}
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  className="prf-pagination-btn"
                                  onClick={() => setCurrentPage((p) => Math.min(totalPayrollPages, p + 1))}
                                  disabled={currentPage >= totalPayrollPages}
                                >
                                  Next <RightOutlined />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </Spin>
                    </>
                  ),
                },
                {
                  key: 'history',
                  label: <span><HistoryOutlined /> History Archive ({payrollHistory.length})</span>,
                  children: (
                    <div className="prf-tab-content">
                      <div className="prf-history-header">
                        <div className="prf-history-header-left">
                          <div className="prf-history-header-icon">
                            <HistoryOutlined />
                          </div>
                          <div className="prf-history-header-text">
                            <span className="prf-history-header-title">Payroll History Archive</span>
                            <span className="prf-history-header-sub">
                              Paid payrolls are automatically moved here
                            </span>
                          </div>
                        </div>
                        <span className="prf-history-header-badge">
                          {payrollHistory.length} record{payrollHistory.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {historyStatistics && (
                        <div className="prf-history-stats">
                          <div className="prf-history-stat">
                            <div className="prf-history-stat-icon blue">
                              <DeleteIcon />
                            </div>
                            <div className="prf-history-stat-info">
                              <span className="prf-history-stat-value">
                                {historyStatistics.total_history ?? 0}
                              </span>
                              <span className="prf-history-stat-label">History Records</span>
                            </div>
                          </div>
                          <div className="prf-history-stat">
                            <div className="prf-history-stat-icon purple">
                              <DollarOutlined />
                            </div>
                            <div className="prf-history-stat-info">
                              <span className="prf-history-stat-value">
                                {formatCurrency(historyStatistics.total_history_amount ?? 0)}
                              </span>
                              <span className="prf-history-stat-label">History Amount</span>
                            </div>
                          </div>
                          <div className="prf-history-stat">
                            <div className="prf-history-stat-icon green">
                              <CheckCircleOutlined />
                            </div>
                            <div className="prf-history-stat-info">
                              <span className="prf-history-stat-value">
                                {historyStatistics.paid_history_count || 0}
                              </span>
                              <span className="prf-history-stat-label">Paid Payrolls</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="prf-table-wrapper">
                        <div className="prf-table-scroll">
                          <Table
                            columns={historyColumns}
                            dataSource={payrollHistory}
                            rowKey={(record) => record.id}
                            className={tableClass}
                            scroll={{ x: 1100 }}
                            pagination={false}
                            footer={
                              payrollHistory.length === 0
                                ? () => renderEmptyPaginationFooter('history records')
                                : undefined
                            }
                          />
                        </div>

                        {payrollHistory.length > 0 && (
                          <div className="prf-table-pagination">
                            <span className="prf-pagination-info">
                              Showing <strong>{(historyCurrentPage - 1) * pageSize + 1}</strong>
                              {' '}–{' '}
                              <strong>{Math.min(historyCurrentPage * pageSize, payrollHistory.length)}</strong>
                              {' '}of <strong>{payrollHistory.length}</strong> history record{payrollHistory.length === 1 ? '' : 's'}
                            </span>
                            <div className="prf-pagination-controls">
                              <button
                                type="button"
                                className="prf-pagination-btn"
                                onClick={() => setHistoryCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={historyCurrentPage === 1}
                              >
                                <LeftOutlined /> Prev
                              </button>
                              {buildPageList(totalHistoryPages, historyCurrentPage).map((p, idx) =>
                                p === '...' ? (
                                  <span key={`he-${idx}`} className="prf-pagination-ellipsis">…</span>
                                ) : (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`prf-pagination-page ${historyCurrentPage === p ? 'active' : ''}`}
                                    onClick={() => setHistoryCurrentPage(p)}
                                  >
                                    {p}
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                className="prf-pagination-btn"
                                onClick={() => setHistoryCurrentPage((p) => Math.min(totalHistoryPages, p + 1))}
                                disabled={historyCurrentPage >= totalHistoryPages}
                              >
                                Next <RightOutlined />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          {/* ================== PROCESS PAYROLL MODAL ================== */}
          <Modal
            open={showEmployeeSelectionModal}
            onCancel={() => setShowEmployeeSelectionModal(false)}
            width="96vw"
            style={{ top: 20, maxWidth: 1440 }}
            className="prf-modal-clean pp-modal-host"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            <div className="pp-modal-shell">
              <div className="pp-modal-header">
                <div className="pp-header-left">
                  <div className="pp-header-icon"><PlusOutlined /></div>
                  <div className="pp-header-text">
                    <h2>Process Payroll</h2>
                    <span className="pp-header-sub">
                      {periodLabel} · Saved attendance only
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pp-close-btn"
                  onClick={() => setShowEmployeeSelectionModal(false)}
                  aria-label="Close"
                >
                  <CloseOutlined />
                </button>
              </div>

              <div className="pp-modal-body">
                <div className="pp-stats-strip pp-stats-strip-3">
                  <div className="pp-stat">
                    <div className="pp-stat-icon blue"><TeamOutlined /></div>
                    <div className="pp-stat-info">
                      <span className="pp-stat-value">{eligibleStats.total}</span>
                      <span className="pp-stat-label">Saved Employees</span>
                    </div>
                  </div>
                  <div className="pp-stat">
                    <div className="pp-stat-icon amber"><ClockCircleOutlined /></div>
                    <div className="pp-stat-info">
                      <span className="pp-stat-value">{eligibleStats.pending}</span>
                      <span className="pp-stat-label">Ready to Process</span>
                    </div>
                  </div>
                  <div className="pp-stat">
                    <div className="pp-stat-icon green"><CheckCircleOutlined /></div>
                    <div className="pp-stat-info">
                      <span className="pp-stat-value">{eligibleStats.processed}</span>
                      <span className="pp-stat-label">Approved / Paid</span>
                    </div>
                  </div>
                </div>

                         {eligibleStats.total === 0 && (
                  <div className="pp-info-banner">
                    <InfoCircleOutlined />
                    <span>
                      {isFutureCutoff
                        ? `This cutoff (${periodLabel}) has not started yet. There is nothing to process.`
                        : <>No attendance has been saved to payroll for <strong>{periodLabel}</strong>. Go to
                          <strong> Attendance → Employee Overview → Save All to Payroll</strong> first,
                          then come back here.</>}
                    </span>
                  </div>
                )}

                {eligibleStats.total > 0 && eligibleStats.pending === 0 && (
                  <div className="pp-info-banner">
                    <CheckCircleOutlined />
                    <span>
                      All saved employees for {periodLabel} have already been finalized (approved or paid).
                      There is nothing left to process in this cutoff.
                    </span>
                  </div>
                )}

                <div className="pp-filters">
                  <div className="pp-search-wrap">
                    <SearchOutlined className="pp-search-icon" />
                    <input
                      type="text"
                      className="pp-search-input"
                      placeholder="Search by name, code, position, department..."
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    />
                    {employeeSearchQuery && (
                      <button
                        type="button"
                        className="pp-search-clear"
                        onClick={() => setEmployeeSearchQuery('')}
                        aria-label="Clear search"
                      >
                        <CloseOutlined />
                      </button>
                    )}
                  </div>

                  <select
                    className="pp-filter-select"
                    value={employeeDepartmentFilter}
                    onChange={(e) => setEmployeeDepartmentFilter(e.target.value)}
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{safeString(dept.name)}</option>
                    ))}
                  </select>

                                   <div className="pp-filter-tabs">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'eligible', label: 'Ready' },
                      { key: 'calculated', label: 'Calculated' },
                      { key: 'processed', label: 'Finalized' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`pp-filter-tab ${employeeStatusFilter === tab.key ? 'active' : ''}`}
                        onClick={() => setEmployeeStatusFilter(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="pp-select-all-btn"
                    onClick={handleSelectAllEmployees}
                    disabled={selectableEligibleEmployees.length === 0}
                  >
                    {selectAllEmployees ? 'Deselect All' : 'Select All'}
                  </button>

                  <span className="pp-selected-count">
                    {selectedEmployeesForPayroll.length} selected
                  </span>
                </div>

                <div className="pp-table-scroll">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th className="pp-col-check">
                          <input
                            type="checkbox"
                            className="pp-checkbox"
                            checked={isAllSelected}
                            onChange={handleSelectAllEmployees}
                            disabled={selectableEligibleEmployees.length === 0}
                          />
                        </th>
                        <th className="pp-col-employee">Employee</th>
                        <th className="pp-col-id">Employee ID</th>
                        <th className="pp-col-position">Position</th>
                        <th className="pp-col-dept">Department</th>
                        <th className="pp-col-num">Regular Hrs</th>
                        <th className="pp-col-num">OT Hrs</th>
                        <th className="pp-col-num">Total Hrs</th>
                        <th className="pp-col-num">Rate</th>
                        <th className="pp-col-num">Est. Gross</th>
                        <th className="pp-col-status">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEligibleEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="pp-empty">
                            <InfoCircleOutlined className="pp-empty-icon" />
                            <p>
                              {eligibleStats.total === 0
                                ? 'No payroll-ready attendance found for this cutoff. Save attendance first.'
                                : 'No employees match your filters.'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredEligibleEmployees.map((emp) => {
                          const empType = getEmployeeType(emp);
                          const typeLabel =
                            empType === EMPLOYEE_TYPES.ON_CALL ? 'On-Call' :
                            empType === EMPLOYEE_TYPES.CONTRACT ? 'Contract' :
                            empType === EMPLOYEE_TYPES.PART_TIME ? 'Part-Time' : 'Regular';
                          const typeClass = getEmployeeTypeClass(typeLabel);
                                                  const isSelected = selectedEmployeesForPayroll.includes(emp.id);
                          // ⭐ FIX: A calculated / draft payroll is NOT final.
                          //    The admin must be able to select it and reprocess.
                          //    Only approved / paid rows are locked.
                          const isDisabled = Boolean(emp.payroll_finalized);

                          const payrollStatus = String(emp.payroll_status || '').toLowerCase();
                          let statusClass = 'eligible';
                          let statusLabel = 'Pending';
                          let statusSub = 'Not yet processed';

                          if (payrollStatus === 'approved') {
                            statusClass = 'processed';
                            statusLabel = 'Approved';
                            statusSub = emp.last_processed_at
                              ? `on ${formatDateSafe(emp.last_processed_at, 'MMM DD, YYYY')}`
                              : '';
                          } else if (payrollStatus === 'paid') {
                            statusClass = 'processed';
                            statusLabel = 'Paid';
                            statusSub = emp.last_processed_at
                              ? `on ${formatDateSafe(emp.last_processed_at, 'MMM DD, YYYY')}`
                              : '';
                                             } else if (payrollStatus === 'calculated' || payrollStatus === 'draft') {
                            // ⭐ FIX: Calculated rows still need admin action,
                            //    so keep them visually under "Ready" but label
                            //    them clearly as Calculated / reprocessable.
                            statusClass = 'eligible';
                            statusLabel = 'Calculated';
                            statusSub = emp.last_processed_at
                              ? `Reprocess · ${formatDateSafe(emp.last_processed_at, 'MMM DD, YYYY')}`
                              : 'Reprocess available';
                          }
                          return (
                            <tr
                              key={emp.id}
                              className={`${isSelected ? 'pp-row-selected' : ''} ${isDisabled ? 'pp-row-disabled' : ''}`}
                              onClick={() => !isDisabled && handleSelectEmployee(emp.id)}
                            >
                              <td className="pp-col-check" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="pp-checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => handleSelectEmployee(emp.id)}
                                />
                              </td>
                              <td className="pp-col-employee">
                                <div className="pp-emp-cell">
                                  <div className="pp-emp-avatar">{getInitials(emp.full_name)}</div>
                                  <div className="pp-emp-meta">
                                    <div className="pp-emp-name">
                                      <span className="pp-emp-name-text">{safeString(emp.full_name, 'N/A')}</span>
                                      <span className={`pp-emp-type ${typeClass}`}>{typeLabel}</span>
                                    </div>
                                    <div className="pp-emp-sub">
                                      <span>{safeString(emp.position || 'No position')}</span>
                                      <span className="pp-dot">·</span>
                                      <span>{safeString(emp.department || 'No department')}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="pp-col-id">
                                <span className="pp-id-pill">
                                  {safeString(emp.employee_code || emp.employee_id)}
                                </span>
                              </td>
                              <td className="pp-col-position">{safeString(emp.position || '—')}</td>
                              <td className="pp-col-dept">{safeString(emp.department || '—')}</td>
                              <td className="pp-col-num">{formatDecimalHours(emp.regular_hours)}</td>
                              <td className="pp-col-num">
                                {safeNumber(emp.overtime_hours) > 0 ? (
                                  <span className="pp-ot-value">{formatDecimalHours(emp.overtime_hours)}</span>
                                ) : (
                                  <span className="pp-muted">—</span>
                                )}
                              </td>
                              <td className="pp-col-num"><strong>{formatDecimalHours(emp.total_hours)}</strong></td>
                              <td className="pp-col-num">{formatCurrency(emp.hourly_rate)}</td>
                              <td className="pp-col-num">
                                <strong className="pp-amount">{formatCurrency(emp.estimated_gross_pay)}</strong>
                              </td>
                              <td className="pp-col-status">
                                <span className={`pp-status-pill ${statusClass}`}>{statusLabel}</span>
                                {statusSub && (
                                  <span className="pp-status-sub">{statusSub}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedEmployeesForPayroll.length > 0 && (
                  <div className="pp-selection-summary">
                    <div className="pp-summary-left">
                      <strong>{selectedEmployeesForPayroll.length}</strong>
                      <span>employee{selectedEmployeesForPayroll.length === 1 ? '' : 's'} selected</span>
                    </div>
                    <div className="pp-summary-stats">
                      <div className="pp-summary-stat">
                        <span className="pp-summary-label">Regular Hrs</span>
                        <span className="pp-summary-value">{formatDecimalHours(selectedTotals.regularHours)}</span>
                      </div>
                      <div className="pp-summary-stat">
                        <span className="pp-summary-label">OT Hrs</span>
                        <span className="pp-summary-value">{formatDecimalHours(selectedTotals.overtimeHours)}</span>
                      </div>
                      <div className="pp-summary-stat">
                        <span className="pp-summary-label">Est. Gross</span>
                        <span className="pp-summary-value pp-summary-amount">
                          {formatCurrency(selectedTotals.grossPay)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pp-notes">
                  <label htmlFor="pp-notes-input">Notes (optional)</label>
                  <textarea
                    id="pp-notes-input"
                    rows={2}
                    placeholder="Add any notes about this payroll batch..."
                    value={processNotes}
                    onChange={(e) => setProcessNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="pp-modal-footer">
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => setShowEmployeeSelectionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={handlePreviewPayroll}
                  disabled={previewPayrollMutation.isPending || selectedEmployeesForPayroll.length === 0}
                >
                  <EyeOutlined /> Preview
                </button>
                <button
                  type="button"
                  className="pp-btn primary"
                  onClick={openDeductionsModal}
                  disabled={selectedEmployeesForPayroll.length === 0 || isFutureCutoff}
                >
                  <CalculatorOutlined /> Process Payroll ({selectedEmployeesForPayroll.length})
                </button>
              </div>
            </div>
          </Modal>

          {/* ================== DEDUCTIONS MODAL — CLEAN ================== */}
          <Modal
            open={showDeductionsModal}
            onCancel={() => setShowDeductionsModal(false)}
            width={1430}
            className="prf-modal-clean pp-modal-host"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            <div className="pp-modal-shell pp-modal-shell-deductions">
              <div className="pp-modal-header pp-deductions-header">
                <div className="pp-header-left">
                  <div className="pp-header-icon pp-header-icon-deductions">
                    <CalculatorOutlined />
                  </div>
                  <div className="pp-header-text">
                    <h2>Deductions</h2>
                    <span className="pp-header-sub">
                      {periodLabel} · {selectedEmployeesForPayroll.length} employee(s)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pp-close-btn"
                  onClick={() => setShowDeductionsModal(false)}
                  aria-label="Close"
                >
                  <CloseOutlined />
                </button>
              </div>

              <div className="pp-deductions-body">
                <div className={`pp-cutoff-banner ${endOfMonth ? 'pp-cutoff-banner-success' : 'pp-cutoff-banner-warning'}`}>
                  <div className="pp-cutoff-banner-icon">
                    {endOfMonth ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                  </div>
                  <div className="pp-cutoff-banner-content">
                    <strong>{endOfMonth ? 'End-of-month cutoff' : 'Mid-month cutoff'}</strong>
                    <span>
                      {endOfMonth
                        ? 'SSS, Pag-IBIG, and PhilHealth contributions will be applied.'
                        : 'SSS, Pag-IBIG, and PhilHealth are normally deducted on the 2nd cutoff. You can still add them with a reason.'}
                    </span>
                  </div>
                </div>

                {/* Auto deductions */}
                <div className="pp-deduction-section">
                  <div className="pp-deduction-section-header">
                    <div className="pp-deduction-section-title">
                      <ThunderboltOutlined className="pp-section-icon pp-icon-auto" />
                      <span>Auto deductions</span>
                    </div>
                    <Switch
                      checked={deductionAutoEnabled}
                      onChange={setDeductionAutoEnabled}
                      checkedChildren="On"
                      unCheckedChildren="Off"
                      size="small"
                    />
                  </div>
                  <p className="pp-deduction-section-desc">
                    Auto-computed for regular employees. Values update automatically when enabled.
                  </p>

                  {deductionAutoEnabled && selectedEmployeesForPayroll.length > 0 && (
                    <div className="pp-auto-preview-card">
                      <div className="pp-auto-preview-header">
                        <span>Computed for {selectedEmployeesForPayroll.length} employee(s)</span>
                        <span className="pp-auto-preview-total-badge">
                          {formatCurrency(
                            autoDeductionPreview.sss +
                            autoDeductionPreview.pagibig +
                            autoDeductionPreview.philhealth
                          )}
                        </span>
                      </div>
                      <div className="pp-auto-preview-list">
                        {autoDeductionPreview.perEmployee.slice(0, 5).map((e) => (
                          <div key={e.employee_id} className="pp-auto-preview-item">
                            <span className="pp-auto-preview-name">{e.name}</span>
                            <span className="pp-auto-preview-values">
                              <span className="pp-auto-preview-val sss">SSS {formatCurrency(e.sss)}</span>
                              <span className="pp-auto-preview-val pagibig">Pag-IBIG {formatCurrency(e.pagibig)}</span>
                              <span className="pp-auto-preview-val philhealth">PhilHealth {formatCurrency(e.philhealth)}</span>
                            </span>
                          </div>
                        ))}
                        {autoDeductionPreview.perEmployee.length > 5 && (
                          <div className="pp-auto-preview-more">
                            +{autoDeductionPreview.perEmployee.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Government contributions */}
                <div className="pp-deduction-section">
                  <div className="pp-deduction-section-header">
                    <div className="pp-deduction-section-title">
                      <BankOutlined className="pp-section-icon pp-icon-gov" />
                      <span>Government contributions</span>
                    </div>
                  </div>
                  <Row gutter={16} style={{ marginTop: 14 }}>
                    <Col span={8}>
                      <div className="pp-deduction-field">
                        <label className="pp-deduction-label">
                          SSS
                          <Tooltip title="Social Security System — MSC × 5%">
                            <QuestionCircleOutlined className="pp-label-help" />
                          </Tooltip>
                        </label>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          value={processDeductions.sss}
                          onChange={(v) => setProcessDeductions((p) => ({ ...p, sss: v || 0 }))}
                          formatter={(value) => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => value.replace(/₱\s?|(,*)/g, '')}
                          className="pp-deduction-input"
                        />
                      </div>
                    </Col>
                    <Col span={8}>
                      <div className="pp-deduction-field">
                        <label className="pp-deduction-label">Pag-IBIG</label>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          value={processDeductions.pagibig}
                          onChange={(v) => setProcessDeductions((p) => ({ ...p, pagibig: v || 0 }))}
                          formatter={(value) => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => value.replace(/₱\s?|(,*)/g, '')}
                          className="pp-deduction-input"
                        />
                      </div>
                    </Col>
                    <Col span={8}>
                      <div className="pp-deduction-field">
                        <label className="pp-deduction-label">PhilHealth</label>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          value={processDeductions.philhealth}
                          onChange={(v) => setProcessDeductions((p) => ({ ...p, philhealth: v || 0 }))}
                          formatter={(value) => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => value.replace(/₱\s?|(,*)/g, '')}
                          className="pp-deduction-input"
                        />
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* Other deductions */}
                <div className="pp-deduction-section">
                  <div className="pp-deduction-section-header">
                    <div className="pp-deduction-section-title">
                      <MinusCircleOutlined className="pp-section-icon pp-icon-other" />
                      <span>Other deductions</span>
                    </div>
                  </div>

                  <Row gutter={16} style={{ marginTop: 14 }}>
                    <Col span={12}>
                      <div className="pp-deduction-field">
                        <label className="pp-deduction-label">Withholding tax</label>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          value={processDeductions.tax}
                          onChange={(v) => setProcessDeductions((p) => ({ ...p, tax: v || 0 }))}
                          formatter={(value) => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => value.replace(/₱\s?|(,*)/g, '')}
                          className="pp-deduction-input"
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="pp-deduction-field">
                        <label className="pp-deduction-label">Deduction type</label>
                        <select
                          className="pp-deduction-select"
                          value={otherDeductionType}
                          onChange={(e) => {
                            const v = e.target.value;
                            setOtherDeductionType(v);
                            setProcessDeductions((p) => ({ ...p, other: 0 }));
                          }}
                        >
                          <option value="">— Select type —</option>
                          <option value="loan">Loan repayment</option>
                          <option value="cash_advance">Cash advance</option>
                          <option value="uniform">Uniform / PPE</option>
                          <option value="penalty">Penalty / damages</option>
                          <option value="sss_loan">SSS loan</option>
                          <option value="pagibig_loan">Pag-IBIG loan</option>
                          <option value="tax_adjustment">Tax adjustment</option>
                          <option value="other">Other (specify)</option>
                        </select>
                      </div>
                    </Col>
                  </Row>

                  {otherDeductionType && (
                    <Row gutter={16} style={{ marginTop: 14 }}>
                      <Col span={12}>
                        <div className="pp-deduction-field">
                          <label className="pp-deduction-label">Amount</label>
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            value={processDeductions.other}
                            onChange={(v) => setProcessDeductions((p) => ({ ...p, other: v || 0 }))}
                            formatter={(value) => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value.replace(/₱\s?|(,*)/g, '')}
                            className="pp-deduction-input"
                          />
                        </div>
                      </Col>
                      <Col span={12}>
                        <div className="pp-deduction-field">
                          <label className="pp-deduction-label">
                            {otherDeductionType === 'other' ? 'Description' : 'Reference'}
                          </label>
                          <Input
                            value={otherDeductionNotes}
                            onChange={(e) => setOtherDeductionNotes(e.target.value)}
                            placeholder={
                              otherDeductionType === 'other'
                                ? 'e.g., Uniform purchase, ID replacement'
                                : 'e.g., Loan #12345'
                            }
                            className="pp-deduction-input"
                          />
                        </div>
                      </Col>
                    </Row>
                  )}

                  {otherDeductionType === 'other' && !otherDeductionNotes.trim() && (
                    <div className="pp-deduction-warning">
                      <ExclamationCircleOutlined />
                      Please describe what this deduction is for.
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="pp-deduction-section">
                  <div className="pp-deduction-field">
                    <label className="pp-deduction-label">Notes</label>
                    <TextArea
                      rows={3}
                      value={processDeductionNotes}
                      onChange={(e) => setProcessDeductionNotes(e.target.value)}
                      placeholder="Optional notes about these deductions..."
                      className="pp-deduction-textarea"
                    />
                  </div>
                </div>

                {/* Summary strip */}
                <div className="pp-deduction-summary">
                  <div className="pp-deduction-summary-row">
                    <span>Applied to</span>
                    <strong>{selectedEmployeesForPayroll.length} employee(s)</strong>
                  </div>
                  <div className="pp-deduction-summary-row pp-deduction-summary-total">
                    <span>Total deductions</span>
                    <span className="pp-deduction-total-amount">
                      {formatCurrency(totalProcessDeductions)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pp-modal-footer">
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => setShowDeductionsModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pp-btn primary"
                  onClick={handleConfirmDeductions}
                  disabled={processPayrollMutation.isPending}
                >
                  {processPayrollMutation.isPending ? (
                    <><LoadingOutlined spin /> Processing…</>
                  ) : (
                    <><CheckOutlined /> Confirm &amp; process</>
                  )}
                </button>
              </div>
            </div>
          </Modal>

          {/* ================== CUTOFF WARNING MODAL ================== */}
          <Modal
            open={showCutoffWarningModal}
            onCancel={() => {
              setShowCutoffWarningModal(false);
              setPendingPayrollProcess(null);
            }}
            width={580}
            className="prf-modal-clean pp-modal-host"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            <div className="pp-modal-shell">
              <div className="pp-modal-header pp-warning-header">
                <div className="pp-header-left">
                  <div className="pp-header-icon pp-header-icon-warning">
                    <WarningOutlined />
                  </div>
                  <div className="pp-header-text">
                    <h2>Cutoff Not Yet Ended</h2>
                    <span className="pp-header-sub">Please review before proceeding</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pp-close-btn"
                  onClick={() => {
                    setShowCutoffWarningModal(false);
                    setPendingPayrollProcess(null);
                  }}
                  aria-label="Close"
                >
                  <CloseOutlined />
                </button>
              </div>

              <div className="pp-warning-body">
                <div className="pp-warning-alert">
                  <div className="pp-warning-alert-icon">
                    <ExclamationCircleOutlined />
                  </div>
                  <div className="pp-warning-alert-content">
                    <strong>The payroll cutoff has not ended yet</strong>
                    <p>
                      You are about to process payroll for <strong>{periodLabel}</strong>, but this
                      cutoff hasn't finished yet. Any attendance edited after processing will not be
                      reflected until you regenerate the payroll.
                    </p>
                  </div>
                </div>

                <div className="pp-warning-details">
                  <div className="pp-warning-detail-row">
                    <span className="pp-warning-detail-label">
                      <CalendarOutlined /> Cutoff Period
                    </span>
                    <span className="pp-warning-detail-value">{periodLabel}</span>
                  </div>
                  <div className="pp-warning-detail-row">
                    <span className="pp-warning-detail-label">
                      <ClockCircleOutlined /> Ends On
                    </span>
                    <span className="pp-warning-detail-value">{formatDateSafe(currentCutoff.end)}</span>
                  </div>
                  <div className="pp-warning-detail-row">
                    <span className="pp-warning-detail-label">
                      <ScheduleOutlined /> Today
                    </span>
                    <span className="pp-warning-detail-value">{formatDateSafe(new Date())}</span>
                  </div>
                  <div className="pp-warning-detail-row pp-warning-detail-row-highlight">
                    <span className="pp-warning-detail-label">
                      <WarningOutlined /> Days Remaining
                    </span>
                    <span className="pp-warning-detail-value pp-warning-days-remaining">
                      {Math.max(0, dayjs(currentCutoff.end).diff(dayjs(), 'days'))} day(s)
                    </span>
                  </div>
                </div>

                <div className="pp-warning-note">
                  <InfoCircleOutlined />
                  <span>
                    You can still proceed, but we recommend waiting until the cutoff ends to ensure
                    all attendance records are captured.
                  </span>
                </div>
              </div>

              <div className="pp-modal-footer pp-warning-footer">
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => {
                    setShowCutoffWarningModal(false);
                    setPendingPayrollProcess(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pp-btn warning"
                  onClick={async () => {
                    setShowCutoffWarningModal(false);
                    const action = pendingPayrollProcess;
                    setPendingPayrollProcess(null);
                    if (action?.type === 'confirmDeductions') {
                      if (governmentDeductionsRequested && !isEndOfMonthCutoff(cutoffType)) {
                        setForceWarningOpen(true);
                        return;
                      }
                      await executeProcessPayroll(forceReprocess, forceReason);
                    }
                  }}
                >
                  <CheckOutlined /> Continue Anyway
                </button>
              </div>
            </div>
          </Modal>

          {/* ================== DUPLICATE WARNING MODAL ================== */}
          <Modal
            open={showDuplicateWarningModal}
            onCancel={() => {
              setShowDuplicateWarningModal(false);
              setDuplicateProcessInfo(null);
              setForceReprocess(false);
              setForceReason('');
            }}
            width={620}
            className="prf-modal-clean pp-modal-host"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            <div className="pp-modal-shell">
              <div className="pp-modal-header pp-duplicate-header">
                <div className="pp-header-left">
                  <div className="pp-header-icon pp-header-icon-duplicate">
                    <StopOutlined />
                  </div>
                  <div className="pp-header-text">
                    <h2>Payroll Already Exists</h2>
                    <span className="pp-header-sub">
                      {duplicateProcessInfo?.count || 0} employee(s) already have payroll for this period
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pp-close-btn"
                  onClick={() => {
                    setShowDuplicateWarningModal(false);
                    setDuplicateProcessInfo(null);
                    setForceReprocess(false);
                    setForceReason('');
                  }}
                  aria-label="Close"
                >
                  <CloseOutlined />
                </button>
              </div>

              <div className="pp-duplicate-body">
                <div className="pp-duplicate-alert">
                  <div className="pp-duplicate-alert-icon">
                    <LockOutlined />
                  </div>
                  <div className="pp-duplicate-alert-content">
                    <strong>Duplicate processing detected</strong>
                    <p>
                      {duplicateProcessInfo?.count || 0} of the selected employee(s) already have
                      payroll records for <strong>{periodLabel}</strong>. Processing again will
                      override the existing records.
                    </p>
                  </div>
                </div>

                {duplicateProcessInfo?.employees && duplicateProcessInfo.employees.length > 0 && (
                  <div className="pp-duplicate-list">
                    <div className="pp-duplicate-list-header">
                      <span>Affected Employees</span>
                    </div>
                    <div className="pp-duplicate-list-items">
                      {duplicateProcessInfo.employees.slice(0, 5).map((emp) => (
                        <div key={emp.id} className="pp-duplicate-list-item">
                          <div className="pp-duplicate-list-item-left">
                            <span className="pp-duplicate-list-item-name">{emp.name}</span>
                            <span className="pp-duplicate-list-item-code">{emp.code}</span>
                          </div>
                          <div className="pp-duplicate-list-item-right">
                            <span className={`pp-duplicate-status ${emp.status}`}>
                              {emp.status}
                            </span>
                            {emp.payrollNumber && (
                              <span className="pp-duplicate-payroll-number">
                                #{formatPayrollNumber(emp.payrollNumber)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {duplicateProcessInfo.employees.length > 5 && (
                        <div className="pp-duplicate-list-more">
                          +{duplicateProcessInfo.employees.length - 5} more employee(s)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pp-duplicate-force-section">
                  <div className="pp-duplicate-force-header">
                    <Checkbox
                      checked={forceReprocess}
                      onChange={(e) => setForceReprocess(e.target.checked)}
                    >
                      <span className="pp-duplicate-force-label">
                        Force reprocess these payroll records
                      </span>
                    </Checkbox>
                  </div>
                  {forceReprocess && (
                    <div className="pp-duplicate-force-reason">
                      <label className="pp-deduction-label">Reason for reprocessing *</label>
                      <TextArea
                        rows={3}
                        value={forceReason}
                        onChange={(e) => setForceReason(e.target.value)}
                        placeholder="Explain why you need to reprocess these payroll records..."
                        className="pp-deduction-textarea"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pp-modal-footer pp-duplicate-footer">
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => {
                    setShowDuplicateWarningModal(false);
                    setDuplicateProcessInfo(null);
                    setForceReprocess(false);
                    setForceReason('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => {
                    setShowDuplicateWarningModal(false);
                    setDuplicateProcessInfo(null);
                    setForceReprocess(false);
                    setForceReason('');
                    const processedIds = duplicateProcessInfo?.employees?.map((e) => e.id) || [];
                    setSelectedEmployeesForPayroll((prev) =>
                      prev.filter((id) => !processedIds.includes(id))
                    );
                  }}
                >
                  <MinusCircleOutlined /> Skip Processed
                </button>
                <button
                  type="button"
                  className="pp-btn danger"
                  onClick={handleConfirmDeductions}
                  disabled={!forceReprocess || !forceReason.trim()}
                >
                  <UndoOutlined /> Force Reprocess
                </button>
              </div>
            </div>
          </Modal>

          {/* ================== FORCE-ADD WARNING MODAL ================== */}
          <Modal
            open={forceWarningOpen}
            onCancel={() => setForceWarningOpen(false)}
            width={580}
            className="prf-modal-clean pp-modal-host"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            <div className="pp-modal-shell">
              <div className="pp-modal-header pp-warning-header">
                <div className="pp-header-left">
                  <div className="pp-header-icon pp-header-icon-warning">
                    <WarningOutlined />
                  </div>
                  <div className="pp-header-text">
                    <h2>Out-of-Schedule Deductions</h2>
                    <span className="pp-header-sub">Government deductions on wrong cutoff</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pp-close-btn"
                  onClick={() => setForceWarningOpen(false)}
                  aria-label="Close"
                >
                  <CloseOutlined />
                </button>
              </div>

              <div className="pp-warning-body">
                <div className="pp-warning-alert">
                  <div className="pp-warning-alert-icon">
                    <ExclamationCircleOutlined />
                  </div>
                  <div className="pp-warning-alert-content">
                    <strong>Government deductions are out of schedule</strong>
                    <p>
                      SSS, Pag-IBIG, and PhilHealth are only deducted on the 2nd cutoff.
                      You can force-add them but a written reason is required.
                    </p>
                  </div>
                </div>

                <div className="pp-deduction-field">
                  <label className="pp-deduction-label">Reason *</label>
                  <TextArea
                    rows={3}
                    value={forceReason}
                    onChange={(e) => setForceReason(e.target.value)}
                    placeholder="Explain why these deductions need to be added outside the normal schedule..."
                    className="pp-deduction-textarea"
                  />
                </div>
              </div>

              <div className="pp-modal-footer pp-warning-footer">
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => setForceWarningOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pp-btn danger"
                  onClick={handleForceAddDeductions}
                  disabled={!forceReason.trim() || processPayrollMutation.isPending}
                >
                  {processPayrollMutation.isPending ? (
                    <><LoadingOutlined spin /> Processing...</>
                  ) : (
                    <><CheckOutlined /> Force Add with Reason</>
                  )}
                </button>
              </div>
            </div>
          </Modal>

          {/* ================== PAYSLIP MODAL (LANDSCAPE) ================== */}
          <Modal
            open={showPayslipModal}
            onCancel={() => setShowPayslipModal(false)}
            width="96vw"
            style={{ top: 20, maxWidth: 1400 }}
            className="payslip-modal-host-landscape"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            {selectedPayslip && (
              <div className="payslip-shell-landscape">
                <div className="payslip-toolbar-landscape">
                  <div className="payslip-toolbar-left-landscape">
                    <div className="payslip-toolbar-icon-landscape">
                      <FilePdfOutlined />
                    </div>
                    <div className="payslip-toolbar-text-landscape">
                      <strong>Payslip</strong>
                      <span>
                        {selectedPayslip.summary?.employee_name || 'Employee'} ·{' '}
                        {selectedPayslip.summary?.period_start} – {selectedPayslip.summary?.period_end}
                      </span>
                    </div>
                  </div>
                  <div className="payslip-toolbar-actions-landscape">
                    <button
                      type="button"
                      className="payslip-toolbar-btn-landscape"
                      onClick={() => {
                        const doc = document.querySelector('.payslip-doc-landscape');
                        if (!doc) {
                          alert('Payslip content not found.');
                          return;
                        }

                        const printable = `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta charset="utf-8" />
                              <title>Payslip - ${selectedPayslip?.summary?.employee_name || 'Employee'}</title>
                              <style>
                                @page { size: A4 landscape; margin: 10mm; }
                                * {
                                  -webkit-print-color-adjust: exact !important;
                                  print-color-adjust: exact !important;
                                  color-adjust: exact !important;
                                  box-sizing: border-box;
                                }
                                html, body {
                                  margin: 0;
                                  padding: 0;
                                  background: #ffffff;
                                  font-family: 'Helvetica Neue', 'Segoe UI', Arial, sans-serif;
                                  font-size: 11.5px;
                                  color: #1e293b;
                                }
                                .payslip-doc-landscape {
                                  width: 100%;
                                  max-width: 1120px;
                                  margin: 0 auto;
                                  padding: 20px 28px;
                                  background: #ffffff;
                                }
                                .payslip-doc-header-landscape {
                                  display: flex; justify-content: space-between; align-items: flex-start;
                                  gap: 20px; padding-bottom: 14px;
                                  border-bottom: 2px solid #3b82f6; margin-bottom: 16px;
                                }
                                .payslip-doc-brand-landscape { display: flex; gap: 12px; align-items: center; }
                                .payslip-doc-brand-mark-landscape {
                                  width: 52px; height: 52px; border-radius: 8px;
                                  background: #ffffff; border: 1px solid #bfdbfe;
                                  display: flex; align-items: center; justify-content: center;
                                  overflow: hidden; flex-shrink: 0;
                                }
                                .payslip-doc-brand-mark-landscape img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
                                .payslip-doc-brand-text-landscape h1 { margin: 0; font-size: 15.5px; font-weight: 800; color: #1e40af; line-height: 1.2; }
                                .payslip-doc-brand-text-landscape p { margin: 3px 0 0; font-size: 11px; color: #475569; line-height: 1.3; }
                                .payslip-doc-title-landscape { text-align: right; }
                                .payslip-doc-title-main { font-size: 17px; font-weight: 800; color: #3b82f6; letter-spacing: 3px; line-height: 1; }
                                .payslip-doc-title-sub { margin-top: 6px; font-size: 11px; color: #475569; font-family: 'SF Mono', 'Monaco', monospace; }
                                .payslip-info-grid-landscape {
                                  display: grid; grid-template-columns: repeat(4, 1fr);
                                  gap: 12px 20px; padding: 0 0 14px 0;
                                  border-bottom: 1px solid #e2e8f0; margin-bottom: 14px;
                                }
                                .payslip-info-block-landscape { display: flex; flex-direction: column; gap: 2px; }
                                .payslip-info-label-landscape { font-size: 9px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; color: #64748b; }
                                .payslip-info-value-landscape { font-size: 12px; font-weight: 600; color: #0f172a; }
                                .payslip-columns-landscape { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
                                .payslip-panel-landscape { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
                                .payslip-panel-title-landscape {
                                  display: flex; align-items: center; gap: 7px;
                                  padding: 8px 14px; font-size: 10.5px; font-weight: 700;
                                  letter-spacing: 1.3px; color: #ffffff;
                                }
                                .payslip-panel-title-landscape.earn { background: #3b82f6; }
                                .payslip-panel-title-landscape.deduct { background: #60a5fa; }
                                .payslip-desc-table-landscape { width: 100%; border-collapse: collapse; font-size: 11.5px; }
                                .payslip-desc-table-landscape th {
                                  padding: 7px 12px; background: #f8fafc; font-size: 9px;
                                  font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
                                  color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0;
                                }
                                .payslip-desc-table-landscape td {
                                  padding: 7px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b;
                                }
                                .payslip-desc-table-landscape td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Monaco', monospace; }
                                .payslip-row-total-landscape td {
                                  background: #eff6ff; font-weight: 700; color: #1e40af;
                                  border-top: 1px solid #bfdbfe; border-bottom: none; font-size: 12px;
                                }
                                .payslip-netpay-strip-landscape {
                                  display: flex; justify-content: space-between; align-items: center;
                                  margin-top: 14px; padding: 12px 20px;
                                  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
                                  color: #ffffff; border-radius: 6px;
                                }
                                .payslip-netpay-strip-label-landscape {
                                  display: flex; align-items: center; gap: 9px;
                                  font-size: 11.5px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase;
                                }
                                .payslip-netpay-strip-amount-landscape {
                                  font-size: 24px; font-weight: 800; letter-spacing: -0.5px;
                                  font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Monaco', monospace;
                                }
                                .payslip-workdetails-landscape { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
                                .payslip-workdetails-title-landscape {
                                  display: flex; align-items: center; gap: 7px;
                                  padding: 8px 14px; background: #3b82f6; color: #fff;
                                  font-size: 10.5px; font-weight: 700; letter-spacing: 1.3px;
                                }
                                .payslip-workdetails-table-landscape { width: 100%; border-collapse: collapse; font-size: 11px; }
                                .payslip-workdetails-table-landscape th {
                                  padding: 7px 9px; background: #f8fafc; font-size: 9px;
                                  font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
                                  color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0;
                                  vertical-align: middle;
                                }
                                .payslip-workdetails-table-landscape th.num { text-align: right; }
                                .payslip-workdetails-table-landscape td {
                                  padding: 6px 9px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle;
                                }
                                .payslip-workdetails-table-landscape td.num {
                                  text-align: right; font-variant-numeric: tabular-nums;
                                  font-family: 'SF Mono', 'Monaco', monospace;
                                }
                                .payslip-workdetails-table-landscape tfoot td {
                                  background: #eff6ff; font-weight: 700; color: #1e40af;
                                  border-top: 1.5px solid #bfdbfe; border-bottom: none;
                                }
                                .payslip-wd-day-total-landscape { font-weight: 700; color: #3b82f6; }
                                .tfoot-label-landscape { text-align: right !important; letter-spacing: 1.8px; font-size: 10px; color: #3b82f6; }
                                .tfoot-grand-landscape { color: #3b82f6; font-size: 12px; }
                                .payslip-footer-landscape {
                                  display: flex; justify-content: space-between; align-items: center;
                                  gap: 20px; margin-top: 18px; padding-top: 12px;
                                  border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #64748b;
                                }
                                .payslip-footer-note-landscape { display: flex; align-items: center; gap: 8px; max-width: 60%; line-height: 1.5; }
                                .payslip-footer-stamp-landscape { font-style: italic; color: #94a3b8; }
                              </style>
                            </head>
                            <body>${doc.outerHTML}</body>
                          </html>
                        `;

                        printPayslipInNewWindow(printable);
                      }}
                    >
                      <PrinterOutlined /> Print
                    </button>
                    <button
                      type="button"
                      className="payslip-toolbar-btn-landscape"
                      onClick={() => handleDownloadPayslip(selectedPayslip.summary?.payroll_id)}
                    >
                      <DownloadOutlined /> Download
                    </button>
                    <button
                      type="button"
                      className="payslip-toolbar-btn-landscape close"
                      onClick={() => setShowPayslipModal(false)}
                      aria-label="Close"
                    >
                      <CloseOutlined />
                    </button>
                  </div>
                </div>

                <div className="payslip-scroll-landscape">
                  <PayslipDocument payslip={selectedPayslip} />
                </div>
              </div>
            )}
          </Modal>

          {/* ================== ATTENDANCE MODAL ================== */}
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
            footer={<div className="prf-modal-buttons-clean"><Button onClick={() => setShowAttendanceModal(false)}>Close</Button></div>}
          >
            <div className="prf-modal-clean-content">
              <div className="prf-modal-employee">
                <Avatar size={48}>{safeString(selectedEmployee?.full_name, '?').charAt(0)}</Avatar>
                <div>
                  <h4>{safeString(selectedEmployee?.full_name)}</h4>
                  <p>{safeString(selectedEmployee?.position)} • {safeString(selectedEmployee?.department)}</p>
                </div>
              </div>
              <Divider />
              <div className="prf-attendance-table-wrapper">
                <table className="prf-attendance-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Schedule</th><th>Time In</th><th>Time Out</th>
                      <th>Regular</th><th>OT</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((record, idx) => {
                      const status = record._computed_status || 'present';
                      const statusLabel = {
                        present: 'Present',
                        late: 'Late',
                        absent: 'Absent',
                        no_duty: 'No Duty',
                        missing_time_in: 'Missing Time In',
                        missing_time_out: 'Missing Time Out',
                      }[status] || status;
                      return (
                        <tr key={idx}>
                          <td>{formatDateSafe(record.attendance_date || record.date)}</td>
                          <td>{record.assigned_schedule || 'Unscheduled'}</td>
                          <td>{record.formatted_time_in || record.time_in || '—'}</td>
                          <td>{record.formatted_time_out || record.time_out || '—'}</td>
                          <td>{safeNumber(record.regular_hours).toFixed(2)}h</td>
                          <td>{safeNumber(record.overtime_hours).toFixed(2)}h</td>
                          <td>
                            <span className={`prf-attendance-status ${status}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {attendanceRecords.length === 0 && (
                      <tr><td colSpan="7" className="prf-text-center">No records found for this period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>

          {/* ================== PAYROLL DETAILS MODAL ================== */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><EyeOutlined /></div>
                <div className="prf-modal-title-text">Payroll Details</div>
                <div className="prf-modal-badge">#{formatPayrollNumber(selectedEmployee?.payroll_number)}</div>
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
                  <Button onClick={() => { setShowPayrollModal(false); handleEditDeductions(selectedEmployee); }} icon={<CalculatorOutlined />}>
                    Edit Deduction
                  </Button>
                )}
                {selectedEmployee && (
                  <Button type="primary" icon={<FilePdfOutlined />} onClick={() => { setShowPayrollModal(false); handleGeneratePayslip(selectedEmployee.id); }}>
                    Generate Payslip
                  </Button>
                )}
              </div>
            }
          >
            {selectedEmployee && (
              <div className="prf-modal-clean-content">
                <div className="prf-modal-employee">
                  <Avatar size={64}>{safeString(selectedEmployee.employee?.full_name || selectedEmployee.employee_name, '?').charAt(0)}</Avatar>
                  <div>
                    <h3>{safeString(selectedEmployee.employee?.full_name || selectedEmployee.employee_name)}</h3>
                    <p>{safeString(selectedEmployee.position_name || selectedEmployee.employee?.position)} • {safeString(selectedEmployee.department_name || selectedEmployee.employee?.department)}</p>
                  </div>
                  <span className={`prf-modal-status prf-status-${mapStatusToLabel(selectedEmployee.status)}`}>
                    {getStatusConfig(mapStatusToLabel(selectedEmployee.status)).text}
                  </span>
                </div>
                <Divider />
                <div className="prf-modal-summary">
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="prf-summary-item"><label>Payroll #</label><span>#{formatPayrollNumber(selectedEmployee.payroll_number)}</span></div>
                      <div className="prf-summary-item"><label>Period</label><span>{periodLabel}</span></div>
                      <div className="prf-summary-item"><label>Regular Hours</label><span><strong>{safeNumber(selectedEmployee.regular_hours).toFixed(2)}</strong> hours</span></div>
                      <div className="prf-summary-item"><label>Overtime Hours</label><span><strong>{safeNumber(selectedEmployee.overtime_hours).toFixed(2)}</strong> hours</span></div>
                      <div className="prf-summary-item"><label>Hourly Rate</label><span>{formatCurrency(selectedEmployee.hourly_rate)}</span></div>
                    </Col>
                    <Col span={12}>
                      <div className="prf-summary-item"><label>Gross Pay</label><span><strong>{formatCurrency(selectedEmployee.gross_pay || (safeNumber(selectedEmployee.regular_pay) + safeNumber(selectedEmployee.overtime_pay)))}</strong></span></div>
                      <div className="prf-summary-item"><label>Total Deductions</label><span><strong style={{ color: '#ef4444' }}>{formatCurrency(selectedEmployee.total_deductions)}</strong></span></div>
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

          {/* ================== HISTORY DETAILS MODAL ================== */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><HistoryOutlined /></div>
                <div className="prf-modal-title-text">Archived Payroll</div>
                <div className="prf-modal-badge">#{formatPayrollNumber(selectedHistoryItem?.payroll_number)}</div>
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
                  <Button type="primary" onClick={() => { setShowHistoryDetailsModal(false); if (selectedHistoryItem) handleRestorePayroll(selectedHistoryItem.id); }} icon={<UndoOutlined />}>
                    Restore Record
                  </Button>
                )}
              </div>
            }
          >
            {selectedHistoryItem && (
              <div className="prf-modal-clean-content">
                <div className="prf-modal-employee">
                  <Avatar size={64}>{safeString(selectedHistoryItem.employee?.full_name || selectedHistoryItem.employee_name, '?').charAt(0)}</Avatar>
                  <div>
                    <h3>{safeString(selectedHistoryItem.employee?.full_name || selectedHistoryItem.employee_name)}</h3>
                    <p>{safeString(selectedHistoryItem.employee?.position)} • {safeString(selectedHistoryItem.employee?.department)}</p>
                  </div>
                  <Tag color="red">Archived</Tag>
                </div>
                <Divider />
                <div className="prf-modal-summary">
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="prf-summary-item"><label>Period</label><span>{formatDateSafe(selectedHistoryItem.period_start || selectedHistoryItem.cutoff_start)} - {formatDateSafe(selectedHistoryItem.period_end || selectedHistoryItem.cutoff_end)}</span></div>
                      <div className="prf-summary-item"><label>Deleted At</label><span>{formatDateSafe(selectedHistoryItem.deleted_at)}</span></div>
                    </Col>
                    <Col span={12}>
                      <div className="prf-summary-item"><label>Gross Pay</label><span>{formatCurrency(selectedHistoryItem.gross_pay)}</span></div>
                      <div className="prf-summary-item prf-summary-total"><label>Net Pay</label><span><strong style={{ fontSize: 20, color: '#10b981' }}>{formatCurrency(selectedHistoryItem.net_pay)}</strong></span></div>
                    </Col>
                  </Row>
                </div>
              </div>
            )}
          </Modal>

          {/* ================== EDIT DEDUCTIONS MODAL ================== */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><CalculatorOutlined /></div>
                <div className="prf-modal-title-text">Edit Deductions</div>
                <div className="prf-modal-badge">#{formatPayrollNumber(selectedPayrollForEdit?.payroll_number)}</div>
              </div>
            }
            open={showEditDeductionsModal}
            onCancel={() => { setShowEditDeductionsModal(false); resetDeductionForm(); }}
            width={700}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => { setShowEditDeductionsModal(false); resetDeductionForm(); }}>Cancel</Button>
                <Button type="primary" loading={updatePayrollMutation.isPending} onClick={handleSaveManualDeductions} icon={<SaveOutlined />}>
                  Save
                </Button>
              </div>
            }
          >
            {selectedPayrollForEdit && (
              <div className="prf-modal-clean-content">
                <div className="prf-modal-employee">
                  <Avatar size={48}>{safeString(selectedPayrollForEdit.employee?.full_name || selectedPayrollForEdit.employee_name, '?').charAt(0)}</Avatar>
                  <div>
                    <h4>{safeString(selectedPayrollForEdit.employee?.full_name || selectedPayrollForEdit.employee_name)}</h4>
                    <p>{safeString(selectedPayrollForEdit.employee?.position)} • {safeString(selectedPayrollForEdit.employee?.department)}</p>
                  </div>
                </div>
                <Divider />
                <div className="prf-deduction-section">
                  <div className="prf-deduction-header"><strong>Payroll Deductions</strong></div>
                  <Row gutter={12}>
                    <Col span={12}><div className="prf-deduction-field"><label>SSS</label><InputNumber style={{ width: '100%' }} min={0} value={sssDeduction} onChange={(v) => setSssDeduction(v || 0)} /></div></Col>
                    <Col span={12}><div className="prf-deduction-field"><label>Pag-IBIG</label><InputNumber style={{ width: '100%' }} min={0} value={pagibigDeduction} onChange={(v) => setPagibigDeduction(v || 0)} /></div></Col>
                    <Col span={12}><div className="prf-deduction-field"><label>PhilHealth</label><InputNumber style={{ width: '100%' }} min={0} value={philhealthDeduction} onChange={(v) => setPhilhealthDeduction(v || 0)} /></div></Col>
                    <Col span={12}><div className="prf-deduction-field"><label>Other</label><InputNumber style={{ width: '100%' }} min={0} value={otherDeduction} onChange={(v) => setOtherDeduction(v || 0)} /></div></Col>
                  </Row>
                </div>
                <Divider />
                <div className="prf-deduction-section">
                  <div className="prf-deduction-header">
                    <strong><MinusCircleOutlined /> Manual Deduction</strong>
                    <Switch checked={enableManualDeduction} onChange={setEnableManualDeduction} checkedChildren="Enabled" unCheckedChildren="Disabled" />
                  </div>
                  {enableManualDeduction && (
                    <>
                      <div className="prf-deduction-field">
                        <label>Type</label>
                        <select value={deductionType} onChange={(e) => setDeductionType(e.target.value)}>
                          <option value="cash_advance">Cash Advance</option>
                          <option value="salary_loan">Salary Loan</option>
                          <option value="sss_loan">SSS Loan</option>
                          <option value="pagibig_loan">Pag-IBIG Loan</option>
                          <option value="tax_withholding">Tax Withholding</option>
                          <option value="penalty">Penalty/Damages</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="prf-deduction-field">
                        <label>Amount</label>
                        <InputNumber style={{ width: '100%' }} min={0} value={manualDeductionAmount} onChange={(v) => setManualDeductionAmount(v || 0)} />
                      </div>
                      <div className="prf-deduction-field">
                        <label>Reason</label>
                        <TextArea rows={3} value={manualDeductionReason} onChange={(e) => setManualDeductionReason(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </Modal>

          {/* ================== BULK DEDUCTION MODAL ================== */}
          <Modal
            title={
              <div className="prf-modal-header-clean">
                <div className="prf-modal-title-icon"><MinusCircleOutlined /></div>
                <div className="prf-modal-title-text">Bulk Deduction</div>
                <div className="prf-modal-badge">{selectedPayrollIds.length} records</div>
              </div>
            }
            open={showBulkDeductionModal}
            onCancel={() => { setShowBulkDeductionModal(false); setBulkDeductionAmount(0); setBulkDeductionReason(''); }}
            width={550}
            className="prf-modal-clean"
            destroyOnHidden={true}
            footer={
              <div className="prf-modal-buttons-clean">
                <Button onClick={() => { setShowBulkDeductionModal(false); setBulkDeductionAmount(0); setBulkDeductionReason(''); }}>Cancel</Button>
                <Button type="primary" danger onClick={handleBulkDeductions} loading={bulkUpdateDeductionsMutation.isPending} icon={<SaveOutlined />}>
                  Apply to {selectedPayrollIds.length} Record(s)
                </Button>
              </div>
            }
          >
            <div className="prf-modal-clean-content">
              <Alert
                message="Bulk Deduction Warning"
                description={`You are about to apply a deduction to ${selectedPayrollIds.length} payroll record(s).`}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <div className="prf-deduction-field">
                <label>Amount *</label>
                <InputNumber style={{ width: '100%' }} min={0} value={bulkDeductionAmount} onChange={(v) => setBulkDeductionAmount(v || 0)} />
              </div>
              <div className="prf-deduction-field">
                <label>Reason *</label>
                <TextArea rows={3} value={bulkDeductionReason} onChange={(e) => setBulkDeductionReason(e.target.value)} />
              </div>
            </div>
          </Modal>

          {/* ================== SAVED RECORDS MODAL ================== */}
          <Modal
            open={showSavedRecordsModal}
            onCancel={() => setShowSavedRecordsModal(false)}
            width="96vw"
            style={{ top: 20, maxWidth: 1440 }}
            className="prf-modal-clean pp-modal-host"
            destroyOnHidden={true}
            closable={false}
            maskClosable={false}
            footer={null}
            styles={{ body: { padding: 0 } }}
          >
            <div className="pp-modal-shell">
              <div className="pp-modal-header">
                <div className="pp-header-left">
                  <div className="pp-header-icon"><FileTextOutlined /></div>
                  <div className="pp-header-text">
                    <h2>Saved Records</h2>
                    <span className="pp-header-sub">
                      {safeString(savedRecordsEmployee?.full_name || savedRecordsEmployee?.employee_name)} · Payroll history
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pp-close-btn"
                  onClick={() => setShowSavedRecordsModal(false)}
                  aria-label="Close"
                >
                  <CloseOutlined />
                </button>
              </div>

              <div className="pp-modal-body">
                <div className="pp-filters">
                  <select
                    className="pp-filter-select"
                    value={savedRecordsFilterMonth}
                    onChange={(e) => setSavedRecordsFilterMonth(parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="pp-filter-select"
                    style={{ minWidth: 100 }}
                    value={savedRecordsFilterYear}
                    onChange={(e) => setSavedRecordsFilterYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                    min="2020"
                    max="2100"
                  />
                  <select
                    className="pp-filter-select"
                    value={savedRecordsFilterCutoff}
                    onChange={(e) => setSavedRecordsFilterCutoff(e.target.value)}
                  >
                    <option value="first">1 - 15</option>
                    <option value="second">16 - End</option>
                  </select>
                  <button
                    type="button"
                    className="pp-btn primary"
                    onClick={handleFetchSavedRecords}
                    disabled={savedRecordsLoading}
                  >
                    <SearchOutlined /> Apply Filters
                  </button>
                </div>

                {savedRecordsLoading ? (
                  <div className="pp-empty">
                    <div className="pp-loading-spinner" />
                    <p>Loading saved records...</p>
                  </div>
                ) : savedRecordsList.length > 0 ? (
                  <>
                    <div className="pp-stats-strip pp-stats-strip-5">
                      <div className="pp-stat">
                        <div className="pp-stat-info">
                          <span className="pp-stat-value">{formatDecimalHours(savedRecordsSummary?.total_regular_hours)}</span>
                          <span className="pp-stat-label">Regular Hours</span>
                        </div>
                      </div>
                      <div className="pp-stat">
                        <div className="pp-stat-info">
                          <span className="pp-stat-value">{formatDecimalHours(savedRecordsSummary?.total_overtime_hours)}</span>
                          <span className="pp-stat-label">OT Hours</span>
                        </div>
                      </div>
                      <div className="pp-stat">
                        <div className="pp-stat-info">
                          <span className="pp-stat-value" style={{ color: '#d97706' }}>{formatDecimalHours(savedRecordsSummary?.total_undertime_hours)}</span>
                          <span className="pp-stat-label">Undertime</span>
                        </div>
                      </div>
                      <div className="pp-stat">
                        <div className="pp-stat-info">
                          <span className="pp-stat-value">{formatDecimalHours(savedRecordsSummary?.total_hours)}</span>
                          <span className="pp-stat-label">Total Hours</span>
                        </div>
                      </div>
                      <div className="pp-stat">
                        <div className="pp-stat-info">
                          <span className="pp-stat-value" style={{ color: '#059669' }}>{formatCurrency(savedRecordsSummary?.total_labor_cost)}</span>
                          <span className="pp-stat-label">Labor Cost</span>
                        </div>
                      </div>
                    </div>

                    <div className="pp-table-scroll">
                      <table className="pp-table pp-table-saved">
                        <thead>
                          <tr>
                            <th style={{ width: '10%' }}>Date</th>
                            <th style={{ width: '11%' }}>Schedule</th>
                            <th style={{ width: '9%' }}>Time In</th>
                            <th style={{ width: '9%' }}>Time Out</th>
                            <th className="pp-col-num" style={{ width: '8%' }}>Regular</th>
                            <th className="pp-col-num" style={{ width: '7%' }}>OT</th>
                            <th className="pp-col-num" style={{ width: '9%' }}>Undertime</th>
                            <th className="pp-col-num" style={{ width: '8%' }}>Total</th>
                            <th style={{ width: '12%' }}>Late/UT</th>
                            <th style={{ width: '9%' }}>Status</th>
                            <th style={{ width: '8%' }}>Saved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {savedRecordsList.map((record) => (
                            <tr key={record.attendance_id || record.date} style={{ cursor: 'default' }}>
                              <td>{formatDateSafe(record.attendance_date || record.date)}</td>
                              <td>{record.assigned_schedule || 'Unscheduled'}</td>
                              <td>{record.formatted_time_in || '—'}</td>
                              <td>{record.formatted_time_out || '—'}</td>
                              <td className="pp-col-num">{formatDecimalHours(record.regular_hours)}</td>
                              <td className="pp-col-num">
                                {safeNumber(record.overtime_hours) > 0 ? (
                                  <span className="pp-ot-value">{formatDecimalHours(record.overtime_hours)}</span>
                                ) : (
                                  <span className="pp-muted">—</span>
                                )}
                              </td>
                              <td className="pp-col-num">{formatDecimalHours(record.undertime_hours)}</td>
                              <td className="pp-col-num"><strong>{formatDecimalHours(record.total_hours)}</strong></td>
                              <td style={{ fontSize: 11 }}>
                                {record.late_undertime || `${record.late_minutes || 0}L / ${record.undertime_minutes || 0}U`}
                              </td>
                              <td>
                                <span className={`pp-status-pill ${(record.verification_status || 'approved') === 'approved' ? 'eligible' : 'processed'}`}>
                                  {record.verification_status || 'Approved'}
                                </span>
                              </td>
                              <td style={{ fontSize: 11, color: '#6b7280' }}>
                                {record.saved_at ? formatDateSafe(record.saved_at) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                              TOTALS:
                            </td>
                            <td className="pp-col-num" style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>{formatDecimalHours(savedRecordsSummary?.total_regular_hours)}</td>
                            <td className="pp-col-num" style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>{formatDecimalHours(savedRecordsSummary?.total_overtime_hours)}</td>
                            <td className="pp-col-num" style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>{formatDecimalHours(savedRecordsSummary?.total_undertime_hours)}</td>
                            <td className="pp-col-num" style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>{formatDecimalHours(savedRecordsSummary?.total_hours)}</td>
                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>Labor Cost:</td>
                            <td style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0', color: '#059669' }}>{formatCurrency(savedRecordsSummary?.total_labor_cost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="pp-empty">
                    <FileTextOutlined className="pp-empty-icon" />
                    <h3>No saved records found</h3>
                    <p>
                      No payroll records for {new Date(savedRecordsFilterYear, savedRecordsFilterMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      {' — '}{savedRecordsFilterCutoff === 'first' ? '1 - 15' : '16 - End'}.
                    </p>
                  </div>
                )}
              </div>

              <div className="pp-modal-footer" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="pp-btn primary"
                  onClick={() => window.print()}
                  disabled={savedRecordsLoading || savedRecordsList.length === 0}
                >
                  <PrinterOutlined /> Print
                </button>
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => setShowSavedRecordsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>

        </div>
      </ConfigProvider>
    </App>
  );
};

export default Staff_Payroll_Formal;