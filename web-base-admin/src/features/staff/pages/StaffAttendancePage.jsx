// src/components/Staff/Staff_Attendance.jsx - OPTIMIZED WITH CACHE & SCROLL FIXES

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import '../styles/StaffAttendance.css';

// Import from your hooks file
import {
  useMobileAttendance,
  useAttendanceStatistics,
  useStatusPanel,
  useStatusPanelSummary,
  useEmployeesList,
  useDepartmentsList,
  useUpdateAttendanceStatus,
  useApproveStatusPanelRecord,
  useDeclineStatusPanelRecord,
  useUndeclineRecord,
  useUnapproveRecord,
  useUnverifyAttendance,
  expandAttendanceLogs,
  normalizeAttendanceLog,
} from '../../../hooks/useAttendanceQueries';

// Import API for direct calls
import api from '../../../services/api';

// Icon Imports
import {
  FiUsers, FiClock, FiCalendar, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiSearch, FiFilter, FiEye, FiDownload, FiRefreshCw, FiChevronLeft,
  FiChevronRight, FiUserCheck, FiLogOut, FiCamera, FiMapPin,
  FiCalendar as FiCalendarIcon, FiArchive, FiTrendingUp, FiList, FiCheck,
  FiThumbsUp, FiThumbsDown, FiRotateCcw, FiSliders, FiBell, FiBellOff,
  FiDollarSign, FiAlertTriangle, FiTrendingUp as FiTrendingUpIcon, FiFileText, FiPrinter, FiSave, FiEdit2,
  FiInfo, FiStar, FiClock as FiClockIcon
} from 'react-icons/fi';
import { FiXCircle as FiXIcon } from 'react-icons/fi';
import { BsCameraFill, BsGeoAlt } from 'react-icons/bs';

// ==================== TIMESTAMP AND RESPONSE HELPERS ====================
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid Time';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
};

const extractApiList = (payload) => {
  const body = payload?.data ?? payload;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  if (Array.isArray(body?.data?.data?.data)) return body.data.data.data;
  return [];
};

// ==================== EMPLOYEE OVERVIEW HELPERS ====================
const unwrapEmployeeOverviewPayload = (response) => response?.data?.data ?? response?.data ?? response ?? {};
const toEmployeeOverviewArray = (value) => (Array.isArray(value) ? value : []);

const toDateInputValue = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDecimalHours = (value) => `${Number(value || 0).toFixed(2)}h`;

const toDateTimeLocalInput = (value, dateValue, fallbackTime) => {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      const hh = String(parsed.getHours()).padStart(2, '0');
      const min = String(parsed.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
  }
  return dateValue ? `${dateValue}T${fallbackTime}` : '';
};

const formatEmployeeOverviewDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatEmployeeOverviewLocation = (location) => {
  if (!location?.lat || !location?.lng) return 'No location';
  return `${Number(location.lat).toFixed(6)}, ${Number(location.lng).toFixed(6)}`;
};

const getApiErrorMessage = (error, fallback = 'Request failed') => {
  const errors = error?.response?.data?.errors;
  const firstError = errors ? Object.values(errors).flat().find(Boolean) : null;
  return error?.response?.data?.message || firstError || error?.message || fallback;
};

// ==================== RESIZEOBSERVER ERROR FIX ====================
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('ResizeObserver loop') || 
        errorMessage.includes('ResizeObserver loop completed') ||
        errorMessage.includes('ResizeObserver loop limit exceeded')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// ==================== SKELETON LOADING COMPONENTS ====================
const SkeletonRow = () => (
  <div className="skeleton-row">
    <div className="skeleton-cell"><div className="skeleton-text"></div></div>
    <div className="skeleton-cell"><div className="skeleton-text"></div></div>
    <div className="skeleton-cell"><div className="skeleton-badge"></div></div>
    <div className="skeleton-cell"><div className="skeleton-button-small"></div></div>
    <div className="skeleton-cell"><div className="skeleton-text short"></div></div>
    <div className="skeleton-cell"><div className="skeleton-badge"></div></div>
    <div className="skeleton-cell"><div className="skeleton-actions"></div></div>
  </div>
);

const SkeletonTable = () => (
  <div className="skeleton-table-container">
    <div className="skeleton-table-header">
      <div className="skeleton-header-cell">Date & Time</div>
      <div className="skeleton-header-cell">Employee</div>
      <div className="skeleton-header-cell">Type</div>
      <div className="skeleton-header-cell">Selfie</div>
      <div className="skeleton-header-cell">Location</div>
      <div className="skeleton-header-cell">Status</div>
      <div className="skeleton-header-cell">Actions</div>
    </div>
    <div className="skeleton-table-body">
      {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
    </div>
  </div>
);

const SkeletonStatusPanelTable = () => (
  <div className="skeleton-table-container">
    <div className="skeleton-table-header">
      {[...Array(8)].map((_, i) => <div key={i} className="skeleton-table-header-cell"></div>)}
    </div>
    <div className="skeleton-table-body">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton-status-row">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-text short"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-badge"></div>
          <div className="skeleton-actions"></div>
        </div>
      ))}
    </div>
  </div>
);

// ==================== 7TH DAY CONSECUTIVE WORKING DETECTION ====================
const detectConsecutiveDays = (attendanceRecords) => {
  const employeeDays = {};
  
  attendanceRecords.forEach(record => {
    if (!record.employee_id) return;
    const date = record.date || (record.timestamp ? new Date(record.timestamp).toISOString().split('T')[0] : null);
    if (!date) return;
    
    if (!employeeDays[record.employee_id]) {
      employeeDays[record.employee_id] = {
        employee_name: record.employee_name || 'Unknown',
        dates: new Set(),
        records: []
      };
    }
    employeeDays[record.employee_id].dates.add(date);
    employeeDays[record.employee_id].records.push(record);
  });
  
  const warnings = [];
  
  Object.keys(employeeDays).forEach(empId => {
    const data = employeeDays[empId];
    const sortedDates = Array.from(data.dates).sort();
    
    if (sortedDates.length < 7) return;
    
    let streakStart = 0;
    let streakLength = 1;
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streakLength++;
        if (streakLength >= 7) {
          warnings.push({
            employee_id: empId,
            employee_name: data.employee_name,
            consecutive_days: streakLength,
            start_date: sortedDates[streakStart],
            end_date: sortedDates[i],
            records: data.records.filter(r => {
              const rDate = r.date || (r.timestamp ? new Date(r.timestamp).toISOString().split('T')[0] : null);
              return rDate >= sortedDates[streakStart] && rDate <= sortedDates[i];
            })
          });
        }
      } else {
        streakStart = i;
        streakLength = 1;
      }
    }
  });
  
  return warnings;
};

// ==================== MAIN COMPONENT ====================
const Staff_Attendance = () => {
  const mainContentRef = useRef(null);
  const queryClient = useQueryClient();
  const hasInitiallyLoadedRef = useRef(false);
  
  // Local state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cutoffPeriod, setCutoffPeriod] = useState('first');
  const [cutoffHistory, setCutoffHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryCutoff, setSelectedHistoryCutoff] = useState(null);
  const [historyAttendance, setHistoryAttendance] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSelfie, setSelectedSelfie] = useState(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Auto-refresh toggle state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  const [selectedOvertimeHours, setSelectedOvertimeHours] = useState(0);
  const [overtimeAction, setOvertimeAction] = useState('approve_all');

  // Status Panel States
  const [activeMainTab, setActiveMainTab] = useState('attendance');
  const [statusPanelFilters, setStatusPanelFilters] = useState({
    start_date: '',
    end_date: '',
    department_id: 'all',
    employee_id: ''
  });
  const [statusPanelPage, setStatusPanelPage] = useState(1);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedRecordForDecline, setSelectedRecordForDecline] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showApproveNotesModal, setShowApproveNotesModal] = useState(false);
  const [selectedRecordForApprove, setSelectedRecordForApprove] = useState(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [statusPanelDateFilter, setStatusPanelDateFilter] = useState('this-month');
  const [submitting, setSubmitting] = useState(false);
  
  // Overtime confirmation states
  const [showOvertimeConfirmModal, setShowOvertimeConfirmModal] = useState(false);
  const [pendingApproveRecord, setPendingApproveRecord] = useState(null);
  const [overtimeReason, setOvertimeReason] = useState('');
  const [overtimeConfirmed, setOvertimeConfirmed] = useState(false);
  
  // Bulk action states
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [bulkApproveNotes, setBulkApproveNotes] = useState('');
  const [bulkOvertimeConfirmed, setBulkOvertimeConfirmed] = useState(false);

  // UNSCHEDULED APPROVALS STATES
  const [pendingUnscheduledRecords, setPendingUnscheduledRecords] = useState([]);
  const [showUnscheduledModal, setShowUnscheduledModal] = useState(false);
  const [selectedUnscheduledRecord, setSelectedUnscheduledRecord] = useState(null);
  const [unscheduledApprovalNote, setUnscheduledApprovalNote] = useState('');
  const [unscheduledPage, setUnscheduledPage] = useState(1);
  const unscheduledItemsPerPage = 10;

  // EMPLOYEE OVERVIEW TAB STATES
  const [employeeOverviewEmployees, setEmployeeOverviewEmployees] = useState([]);
  const [employeeOverviewMeta, setEmployeeOverviewMeta] = useState({ can_generate: false });
  const [employeeOverviewGenerated, setEmployeeOverviewGenerated] = useState({});
  const [employeeOverviewSaved, setEmployeeOverviewSaved] = useState({});
  const [employeeOverviewRecordsByEmployee, setEmployeeOverviewRecordsByEmployee] = useState({});
  const [employeeOverviewSelectedEmployee, setEmployeeOverviewSelectedEmployee] = useState(null);
  const [employeeOverviewSelectedRecords, setEmployeeOverviewSelectedRecords] = useState([]);
  const [employeeOverviewLoading, setEmployeeOverviewLoading] = useState(false);
  const [employeeOverviewActionLoading, setEmployeeOverviewActionLoading] = useState(null);
  const [employeeOverviewSearch, setEmployeeOverviewSearch] = useState('');
  const [employeeOverviewDepartment, setEmployeeOverviewDepartment] = useState('all');
  const [employeeOverviewSelectedOvertimeIds, setEmployeeOverviewSelectedOvertimeIds] = useState([]);
  const [employeeOverviewEditingRecord, setEmployeeOverviewEditingRecord] = useState(null);
  const [employeeOverviewEditTimeIn, setEmployeeOverviewEditTimeIn] = useState('');
  const [employeeOverviewEditTimeOut, setEmployeeOverviewEditTimeOut] = useState('');
  const [employeeOverviewEditApprovalStatus, setEmployeeOverviewEditApprovalStatus] = useState('pending');
  const [employeeOverviewEditNotes, setEmployeeOverviewEditNotes] = useState('');

  // 7TH DAY CONSECUTIVE WARNING STATES
  const [consecutiveWarnings, setConsecutiveWarnings] = useState([]);
  const [showConsecutiveModal, setShowConsecutiveModal] = useState(false);
  const [selectedConsecutiveWarning, setSelectedConsecutiveWarning] = useState(null);

  // ==================== REACT QUERY DATA FETCHING WITH CACHE CONTROL ====================
  const dates = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, cutoffPeriod === 'first' ? 1 : 16);
    const end = new Date(selectedYear, selectedMonth, cutoffPeriod === 'first' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate(), 23, 59, 59);
    return { start, end };
  }, [selectedYear, selectedMonth, cutoffPeriod]);

  const mobileAttendanceParams = useMemo(() => ({
    year: selectedYear,
    month: selectedMonth + 1,
    start_date: dates.start.toISOString().split('T')[0],
    end_date: dates.end.toISOString().split('T')[0],
    per_page: 100
  }), [selectedYear, selectedMonth, dates]);

  const statusPanelParams = useMemo(() => ({
    page: statusPanelPage,
    per_page: 15,
    start_date: statusPanelFilters.start_date,
    end_date: statusPanelFilters.end_date,
    department_id: statusPanelFilters.department_id !== 'all' ? statusPanelFilters.department_id : undefined,
    employee_id: statusPanelFilters.employee_id || undefined
  }), [statusPanelPage, statusPanelFilters]);

  // Queries with proper cache - NO auto-refetch on mount
  const { 
    data: mobileAttendanceData, 
    isLoading: mobileLoading, 
    refetch: refetchMobile,
    isFetching: isMobileFetching
  } = useMobileAttendance(mobileAttendanceParams);
  
  const { refetch: refetchStats } = useAttendanceStatistics(selectedYear, selectedMonth + 1);
  
  const { 
    data: statusPanelData, 
    isLoading: statusPanelLoading, 
    refetch: refetchStatusPanel,
    isFetching: isStatusPanelFetching
  } = useStatusPanel(statusPanelParams);
  
  const { 
    data: statusPanelSummaryData, 
    refetch: refetchStatusPanelSummary,
    isFetching: isSummaryFetching
  } = useStatusPanelSummary();
  
  const { data: employeesData } = useEmployeesList();
  const { data: departmentsData } = useDepartmentsList();

  // Mutations
  const updateAttendanceStatusMutation = useUpdateAttendanceStatus();
  const approveRecordMutation = useApproveStatusPanelRecord();
  const declineRecordMutation = useDeclineStatusPanelRecord();
  const undeclineRecordMutation = useUndeclineRecord();
  const unapproveRecordMutation = useUnapproveRecord();
  const unverifyAttendanceMutation = useUnverifyAttendance();

  // Track refresh state
  const isRefreshing = isMobileFetching || isStatusPanelFetching || isSummaryFetching;
  
  // Update last refresh time when data is fetched
  useEffect(() => {
    if (!isRefreshing && (mobileAttendanceData || statusPanelData)) {
      setLastRefreshTime(new Date());
    }
  }, [isRefreshing, mobileAttendanceData, statusPanelData]);

  // Extract normalized response data
  const employees = extractApiList(employeesData);
  const departments = extractApiList(departmentsData);
  const mobileAttendance = extractApiList(mobileAttendanceData);
  const statusPanelRecords = extractApiList(statusPanelData).map(normalizeAttendanceLog);
  
  const statusPanelStats = {
    pending_approval_count: statusPanelSummaryData?.data?.pending_approval_count || 0,
    approved_this_month: statusPanelSummaryData?.data?.approved_this_month || 0,
    declined_this_month: statusPanelSummaryData?.data?.declined_this_month || 0,
    total_hours_pending: statusPanelSummaryData?.data?.total_hours_pending || 0,
    employees_with_pending: statusPanelSummaryData?.data?.employees_with_pending || 0,
    approval_rate: statusPanelSummaryData?.data?.approval_rate || 0
  };

  const attendanceStats = {
    total_employees: employees.length,
    total_check_ins: mobileAttendance.filter(r => r.type === 'IN').length,
    total_check_outs: mobileAttendance.filter(r => r.type === 'OUT').length,
    verified_check_ins: mobileAttendance.filter(r => r.type === 'IN' && r.verification_status === 'verified').length,
    pending_verification: mobileAttendance.filter(r => r.verification_status === 'pending').length,
    average_daily_attendance: mobileAttendance.length > 0 ? Math.round(mobileAttendance.length / 15) : 0
  };

  // ==================== CONSECUTIVE DAYS WARNING DETECTION ====================
  useEffect(() => {
    if (mobileAttendance.length > 0) {
      const warnings = detectConsecutiveDays(mobileAttendance);
      setConsecutiveWarnings(warnings);
      if (warnings.length > 0) {
        console.warn('⚠️ Consecutive working day warnings:', warnings);
      }
    }
  }, [mobileAttendance]);

  // ==================== HELPER FUNCTIONS ====================
  const getCutoffDates = (year, month, period) => {
    if (period === 'first') {
      return { start: new Date(year, month, 1), end: new Date(year, month, 15, 23, 59, 59) };
    } else {
      return { start: new Date(year, month, 16), end: new Date(year, month + 1, 0, 23, 59, 59) };
    }
  };

  const formatCutoffRange = (year, month, period) => {
    const datesRange = getCutoffDates(year, month, period);
    const endDay = datesRange.end.getDate();
    const monthName = datesRange.start.toLocaleString('default', { month: 'long' });
    return period === 'first' ? `${monthName} 1-15, ${year}` : `${monthName} 16-${endDay}, ${year}`;
  };

  const formatHoursAndMinutes = (hours) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const getVerificationStatusDetails = (status) => {
    const statusMap = {
      'verified': { color: '#27ae60', icon: FiCheckCircle, text: 'Verified', bg: 'rgba(39, 174, 96, 0.1)' },
      'pending': { color: '#f39c12', icon: FiClock, text: 'Pending', bg: 'rgba(243, 156, 18, 0.1)' },
      'rejected': { color: '#e74c3c', icon: FiXCircle, text: 'Rejected', bg: 'rgba(231, 76, 60, 0.1)' }
    };
    return statusMap[status] || statusMap['pending'];
  };

  const getTypeDetails = (type) => {
    const typeMap = {
      'IN': { color: '#27ae60', icon: FiLogOut, text: 'Time In', bg: 'rgba(39, 174, 96, 0.1)', iconRotation: 'rotate(180deg)' },
      'OUT': { color: '#e74c3c', icon: FiLogOut, text: 'Time Out', bg: 'rgba(231, 76, 60, 0.1)', iconRotation: '0deg' }
    };
    return typeMap[type] || typeMap['IN'];
  };

  const getCurrentCutoffAttendance = () => {
    const datesRange = getCutoffDates(selectedYear, selectedMonth, cutoffPeriod);
    return mobileAttendance.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= datesRange.start && recordDate <= datesRange.end;
    });
  };

  // ==================== FETCH PENDING UNSCHEDULED RECORDS ====================
  const fetchPendingUnscheduledRecords = useCallback(async () => {
    try {
      const response = await api.get('/attendance/needs-approval', {
        params: {
          status: 'unscheduled',
          approval_status: 'pending',
          per_page: 100,
        },
      });
      const records = extractApiList(response).map(normalizeAttendanceLog);
      setPendingUnscheduledRecords(records);
      console.log('📋 Pending unscheduled records:', records.length);
    } catch (error) {
      console.error('Error fetching unscheduled records:', error);
      setPendingUnscheduledRecords([]);
    }
  }, []);

  // ==================== APPROVE UNSCHEDULED RECORD ====================
  const approveUnscheduledRecord = async (recordId, notes) => {
    setSubmitting(true);
    try {
      const response = await api.post(`/attendance/${recordId}/approve-unscheduled`, { 
        admin_notes: notes 
      });
      
      if (response.data?.success) {
        showNotificationMessage('✓ Unscheduled attendance approved!', 'success');
        await fetchPendingUnscheduledRecords();
        await refetchMobile();
        await refetchStatusPanel();
        await refetchStatusPanelSummary();
        setShowUnscheduledModal(false);
        setSelectedUnscheduledRecord(null);
        setUnscheduledApprovalNote('');
        return true;
      } else {
        showNotificationMessage(response.data?.message || 'Approval failed', 'error');
        return false;
      }
    } catch (error) {
      console.error('Approval error:', error);
      showNotificationMessage(error.response?.data?.message || 'Failed to approve', 'error');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== REJECT UNSCHEDULED RECORD ====================
  const rejectUnscheduledRecord = async (attendanceId, reason) => {
    setSubmitting(true);
    try {
      const result = await updateAttendanceStatusMutation.mutateAsync({ 
        attendanceId, 
        status: 'rejected',
        notes: `Unscheduled attendance rejected: ${reason}`
      });
      
      if (result?.success) {
        showNotificationMessage('✓ Unscheduled attendance rejected', 'info');
        await fetchPendingUnscheduledRecords();
        await refetchMobile();
      } else {
        showNotificationMessage(result?.message || 'Failed to reject', 'error');
      }
    } catch (error) {
      console.error('Reject error:', error);
      showNotificationMessage('Failed to reject record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== LOAD CUTOFF HISTORY ====================
  const loadCutoffHistory = async () => {
    const history = [];
    const currentDate = new Date(selectedYear, selectedMonth);
    for (let i = 0; i < 6; i++) {
      let year = currentDate.getFullYear();
      let month = currentDate.getMonth();
      let period = cutoffPeriod;
      if (i > 0) {
        if (period === 'first') period = 'second';
        else { period = 'first'; month--; if (month < 0) { month = 11; year--; } }
      }
      if (month >= 0 && year >= 2020) {
        history.push({
          id: `${year}-${month}-${period}`,
          year, month, period,
          label: formatCutoffRange(year, month, period),
          dateRange: getCutoffDates(year, month, period)
        });
      }
    }
    setCutoffHistory(history);
  };

  const loadCutoffAttendance = async (year, month, period) => {
    setLoadingHistory(true);
    try {
      const datesRange = getCutoffDates(year, month, period);
      const response = await api.get('/attendance/all', {
        params: {
          start_date: datesRange.start.toISOString().split('T')[0],
          end_date: datesRange.end.toISOString().split('T')[0],
          per_page: 1000,
          include_history: true
        }
      });
      const attendanceData = expandAttendanceLogs(extractApiList(response));
      setHistoryAttendance(attendanceData);
      setSelectedHistoryCutoff({
        year,
        month,
        period,
        label: formatCutoffRange(year, month, period),
      });
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading cutoff attendance:', error);
      showNotificationMessage('Failed to load cutoff history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // ==================== REFRESH FUNCTIONS ====================
  const handleRefresh = async () => {
    const refreshTasks = [refetchMobile(), refetchStats(), fetchPendingUnscheduledRecords()];
    if (activeMainTab === 'status-panel') {
      refreshTasks.push(fetchEmployeeOverview());
    } else {
      refreshTasks.push(refetchStatusPanel(), refetchStatusPanelSummary());
    }
    await Promise.all(refreshTasks);
    showNotificationMessage('Data refreshed successfully', 'success');
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    showNotificationMessage(
      autoRefreshEnabled ? 'Auto-refresh disabled' : 'Auto-refresh enabled',
      'info'
    );
  };

  // ==================== EXPORT FUNCTION ====================
  const handleExport = () => {
    const currentCutoffData = getCurrentCutoffAttendance();
    if (currentCutoffData.length === 0) {
      showNotificationMessage('No data to export', 'warning');
      return;
    }
    const csv = convertToCSV(currentCutoffData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${formatCutoffRange(selectedYear, selectedMonth, cutoffPeriod)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotificationMessage('Export completed successfully', 'success');
  };

  const convertToCSV = (data) => {
    if (!data.length) return '';
    const headers = ['Date', 'Time', 'Employee Name', 'Employee Code', 'Type', 'Status', 'Face Verified'];
    const rows = data.map(record => [
      formatDate(record.timestamp), formatTime(record.timestamp),
      record.employee_name || '', record.employee_code || '',
      record.type === 'IN' ? 'Time In' : 'Time Out',
      record.verification_status || 'pending',
      record.face_verified ? 'Yes' : 'No'
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  // ==================== VIEW SELFIE ====================
  const handleViewSelfie = (selfieUrl) => {
    setSelectedSelfie(selfieUrl);
    setShowSelfieModal(true);
  };

  // ==================== VERIFY ATTENDANCE ====================
  const handleVerifyAttendance = async (attendanceId, status) => {
    setSubmitting(true);
    try {
      const result = await updateAttendanceStatusMutation.mutateAsync({ 
        attendanceId, 
        status,
        notes: status === 'verified' ? 'Verified by admin' : 'Rejected by admin'
      });
      
      if (result?.success) {
        showNotificationMessage(`✓ Attendance ${status === 'verified' ? 'verified' : 'rejected'} successfully!`, 'success');
        setCurrentPage(1);
        await refetchMobile();
        await refetchStatusPanel();
        await refetchStatusPanelSummary();
        await fetchPendingUnscheduledRecords();
      } else {
        showNotificationMessage(result?.message || 'Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showNotificationMessage('Failed to update status', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== APPROVE RECORD ====================
  const handleApproveRecord = async (record, skipOvertimeCheck = false, overtimeData = {}) => {
    if (!record) return;
    
    const hasOvertime = (record.overtime_hours || 0) > 0;
    const { action, approvedHours, reason } = overtimeData;
    
    if (hasOvertime && !skipOvertimeCheck && !overtimeConfirmed) {
      setPendingApproveRecord(record);
      setShowOvertimeConfirmModal(true);
      return;
    }
    
    setSubmitting(true);
    try {
      let result;
      
      if (action === 'remove') {
        result = await approveRecordMutation.mutateAsync({ 
          recordId: record.id, 
          notes: approveNotes,
          overtimeConfirmed: false,
          removeOvertime: true,
          overtimeReason: reason || overtimeReason,
          approvedOvertimeHours: 0
        });
      } 
      else if (action === 'approve_partial') {
        result = await approveRecordMutation.mutateAsync({ 
          recordId: record.id, 
          notes: approveNotes,
          overtimeConfirmed: true,
          overtimeReason: reason || overtimeReason,
          approvedOvertimeHours: approvedHours || selectedOvertimeHours
        });
      }
      else if (action === 'decline_record') {
        result = await declineRecordMutation.mutateAsync({ 
          recordId: record.id, 
          reason: reason || overtimeReason || 'Overtime not approved - record declined'
        });
        if (result?.success) {
          showNotificationMessage(`Record declined for ${record.employee_name}`, 'info');
          setShowOvertimeConfirmModal(false);
          setSelectedRecordForApprove(null);
          setOvertimeReason('');
          setSelectedOvertimeHours(0);
          setOvertimeAction('approve_all');
          setStatusPanelPage(1);
          await refetchStatusPanel();
          await refetchStatusPanelSummary();
          setSubmitting(false);
          return;
        }
      }
      else {
        result = await approveRecordMutation.mutateAsync({ 
          recordId: record.id, 
          notes: approveNotes,
          overtimeConfirmed: overtimeConfirmed || skipOvertimeCheck,
          overtimeReason: overtimeReason,
          removeOvertime: false
        });
      }
      
      if (result?.success) {
        let message = `✓ Record approved for ${record.employee_name}`;
        if (action === 'remove') {
          message += ` with overtime removed`;
        } else if (action === 'approve_partial') {
          message += ` with ${approvedHours || selectedOvertimeHours}h overtime approved (out of ${record.overtime_hours}h)`;
        } else if (record.overtime_hours > 0) {
          message += ` with ${record.overtime_hours}h overtime approved`;
        }
        showNotificationMessage(message, 'success');
        
        setShowApproveNotesModal(false);
        setShowOvertimeConfirmModal(false);
        setApproveNotes('');
        setOvertimeReason('');
        setOvertimeConfirmed(false);
        setPendingApproveRecord(null);
        setSelectedRecordForApprove(null);
        setSelectedOvertimeHours(0);
        setOvertimeAction('approve_all');
        setStatusPanelPage(1);
        
        await refetchStatusPanel();
        await refetchStatusPanelSummary();
        
      } else if (result?.requires_overtime_confirmation) {
        setPendingApproveRecord(record);
        setShowOvertimeConfirmModal(true);
      } else {
        showNotificationMessage(result?.message || 'Failed to approve record', 'error');
      }
    } catch (error) {
      console.error('Approve error:', error);
      showNotificationMessage('Failed to approve record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveClick = (record) => {
    setSelectedRecordForApprove(record);
    setApproveNotes('');
    setOvertimeReason('');
    setOvertimeConfirmed(false);
    setSelectedOvertimeHours(record.overtime_hours || 0);
    setOvertimeAction('approve_all');
    
    if (record.overtime_hours > 0) {
      setShowOvertimeConfirmModal(true);
    } else {
      setShowApproveNotesModal(true);
    }
  };

  // ==================== DECLINE RECORD ====================
  const handleDeclineRecord = async () => {
    if (!selectedRecordForDecline) return;
    if (!declineReason.trim()) {
      showNotificationMessage('Please provide a reason for declining', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const result = await declineRecordMutation.mutateAsync({ 
        recordId: selectedRecordForDecline.id, 
        reason: declineReason 
      });
      
      if (result?.success) {
        showNotificationMessage(`Record declined for ${selectedRecordForDecline.employee_name}`, 'info');
        setShowDeclineModal(false);
        setDeclineReason('');
        setSelectedRecordForDecline(null);
        refetchStatusPanel();
        refetchStatusPanelSummary();
      } else {
        showNotificationMessage(result?.message || 'Failed to decline record', 'error');
      }
    } catch (error) {
      console.error('Decline error:', error);
      showNotificationMessage('Failed to decline record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== UNDECLINE / UNAPPROVE RECORD ====================
  const handleUndeclineRecord = async (record) => {
    setSubmitting(true);
    try {
      const result = await undeclineRecordMutation.mutateAsync(record.id);
      if (result?.success) {
        showNotificationMessage(`Record restored for ${record.employee_name}`, 'success');
        refetchStatusPanel();
        refetchStatusPanelSummary();
      } else {
        showNotificationMessage('Failed to restore record', 'error');
      }
    } catch (error) {
      showNotificationMessage('Failed to restore record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnapproveRecord = async (record) => {
    if (!window.confirm(`Remove ${record.employee_name}'s attendance from payroll?`)) return;
    setSubmitting(true);
    try {
      const result = await unapproveRecordMutation.mutateAsync(record.id);
      if (result?.success) {
        showNotificationMessage('Record removed from payroll', 'success');
        refetchStatusPanel();
        refetchStatusPanelSummary();
      } else {
        showNotificationMessage('Failed to unapprove record', 'error');
      }
    } catch (error) {
      showNotificationMessage('Failed to unapprove record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnverifyAttendance = async (attendance) => {
    if (!window.confirm(`Unverify this ${attendance.type === 'IN' ? 'time-in' : 'time-out'} record?`)) return;
    setSubmitting(true);
    try {
      const result = await unverifyAttendanceMutation.mutateAsync(attendance.id);
      if (result?.success) {
        showNotificationMessage('Attendance record unverified', 'info');
        refetchMobile();
        refetchStatusPanel();
      } else {
        showNotificationMessage('Failed to unverify record', 'error');
      }
    } catch (error) {
      showNotificationMessage('Failed to unverify record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== BULK APPROVE ====================
  const handleSelectRecord = (recordId) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handleSelectAllRecords = () => {
    if (selectedRecords.length === statusPanelRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(statusPanelRecords.map(r => r.id));
    }
  };

  const handleBulkApprove = () => {
    if (selectedRecords.length === 0) {
      showNotificationMessage('Please select records to approve', 'warning');
      return;
    }
    
    const hasOvertime = statusPanelRecords.some(r => 
      selectedRecords.includes(r.id) && (r.overtime_hours || 0) > 0
    );
    
    if (hasOvertime && !bulkOvertimeConfirmed) {
      setShowBulkApproveModal(true);
    } else {
      processBulkApprove();
    }
  };

  const processBulkApprove = async () => {
    setSubmitting(true);
    try {
      const results = await Promise.all(
        selectedRecords.map(recordId => {
          const record = statusPanelRecords.find(r => r.id === recordId);
          return approveRecordMutation.mutateAsync({
            recordId,
            notes: bulkApproveNotes,
            overtimeConfirmed: bulkOvertimeConfirmed,
            overtimeReason: 'Bulk approval with overtime confirmed'
          });
        })
      );
      
      const successCount = results.filter(r => r?.success).length;
      showNotificationMessage(`✓ ${successCount} records approved successfully`, 'success');
      
      setSelectedRecords([]);
      setBulkApproveNotes('');
      setBulkOvertimeConfirmed(false);
      setShowBulkApproveModal(false);
      refetchStatusPanel();
      refetchStatusPanelSummary();
    } catch (error) {
      console.error('Bulk approve error:', error);
      showNotificationMessage('Failed to approve some records', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const applyStatusPanelDateFilter = (filter) => {
    const now = new Date();
    let startDate = '', endDate = '';
    switch(filter) {
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      default: break;
    }
    if (filter !== 'custom') {
      setStatusPanelFilters(prev => ({ ...prev, start_date: startDate, end_date: endDate }));
    }
    setStatusPanelDateFilter(filter);
  };

  // ==================== RENDER ATTENDANCE ACTIONS ====================
  const renderAttendanceActions = (record) => {
    if (record.verification_status === 'pending') {
      return (
        <>
          <button className="action-icon-btn verify" onClick={() => handleVerifyAttendance(record.id, 'verified')} title="Verify" disabled={submitting}>
            <FiCheckCircle />
          </button>
          <button className="action-icon-btn reject" onClick={() => handleVerifyAttendance(record.id, 'rejected')} title="Reject" disabled={submitting}>
            <FiXCircle />
          </button>
        </>
      );
    } else if (record.verification_status === 'verified') {
      return (
        <>
          <button className="action-icon-btn unverify" onClick={() => handleUnverifyAttendance(record)} title="Unverify" disabled={submitting}>
            <FiRotateCcw />
          </button>
          <button className="action-icon-btn view" onClick={() => { setSelectedAttendance(record); setShowAttendanceModal(true); }} title="View">
            <FiEye />
          </button>
        </>
      );
    } else {
      return (
        <button className="action-icon-btn view" onClick={() => { setSelectedAttendance(record); setShowAttendanceModal(true); }} title="View">
          <FiEye />
        </button>
      );
    }
  };

  // Filter and paginate mobile attendance
  const getFilteredMobileAttendance = () => {
    const currentCutoff = getCurrentCutoffAttendance();
    let filtered = [...currentCutoff];
    if (typeFilter !== 'ALL') filtered = filtered.filter(record => record.type === typeFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(record => record.verification_status === statusFilter);
    if (searchTerm) {
      filtered = filtered.filter(record => 
        (record.employee_name && record.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.employee_code && record.employee_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return filtered;
  };

  const filteredMobileAttendance = getFilteredMobileAttendance();
  const totalMobilePages = Math.ceil(filteredMobileAttendance.length / itemsPerPage);
  const paginatedMobileAttendance = filteredMobileAttendance.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ==================== EMPLOYEE OVERVIEW TAB LOGIC ====================
  const employeeOverviewPeriod = useMemo(() => ({
    start_date: toDateInputValue(dates.start),
    end_date: toDateInputValue(dates.end),
  }), [dates]);

  const employeeOverviewCutoffLabel = formatCutoffRange(selectedYear, selectedMonth, cutoffPeriod);

  // ==================== FIX: Employee Overview - Only fetch once on mount ====================
  const fetchEmployeeOverview = useCallback(async (force = false) => {
    // If data already exists and not forcing, skip fetch
    if (!force && hasInitiallyLoadedRef.current && employeeOverviewEmployees.length > 0) {
      console.log('📊 Employee Overview data already loaded, skipping fetch');
      return;
    }
    
    setEmployeeOverviewLoading(true);
    try {
      const response = await api.get('/attendance/employee-overview', {
        params: {
          start_date: employeeOverviewPeriod.start_date,
          end_date: employeeOverviewPeriod.end_date,
          employee_id: employeeOverviewSearch || undefined,
          department_id: employeeOverviewDepartment !== 'all' ? employeeOverviewDepartment : undefined,
        },
      });
      const body = unwrapEmployeeOverviewPayload(response);
      setEmployeeOverviewMeta(body);
      setEmployeeOverviewEmployees(toEmployeeOverviewArray(body.employees));
      setLastRefreshTime(new Date());
      hasInitiallyLoadedRef.current = true;
    } catch (error) {
      console.error('Employee Overview error:', error);
      showNotificationMessage(getApiErrorMessage(error, 'Failed to load Employee Overview'), 'error');
      setEmployeeOverviewEmployees([]);
    } finally {
      setEmployeeOverviewLoading(false);
    }
  }, [employeeOverviewPeriod.start_date, employeeOverviewPeriod.end_date, employeeOverviewSearch, employeeOverviewDepartment, employeeOverviewEmployees.length]);

  const loadEmployeeOverviewRecords = async (employee, openModal = true) => {
    setEmployeeOverviewActionLoading(`view-${employee.employee_id}`);
    try {
      const response = await api.get('/attendance/employee-records', {
        params: {
          employee_id: employee.employee_id,
          start_date: employeeOverviewPeriod.start_date,
          end_date: employeeOverviewPeriod.end_date,
        },
      });
      const body = unwrapEmployeeOverviewPayload(response);
      const records = toEmployeeOverviewArray(body.records);
      setEmployeeOverviewRecordsByEmployee((prev) => ({ ...prev, [employee.employee_id]: records }));
      if (openModal) {
        setEmployeeOverviewSelectedEmployee(employee);
        setEmployeeOverviewSelectedRecords(records);
        setEmployeeOverviewSelectedOvertimeIds([]);
      }
      return records;
    } catch (error) {
      console.error('Employee Overview records error:', error);
      showNotificationMessage(getApiErrorMessage(error, 'Failed to load employee attendance records'), 'error');
      return [];
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  // ==================== FIX: Generate Summary with proper time detection ====================
  const generateEmployeeOverviewSummary = async (employee, cutoffWarningConfirmed = false) => {
    if (!employeeOverviewMeta.can_generate && !cutoffWarningConfirmed) {
      const shouldContinue = window.confirm(
        'The selected payroll cutoff has not been reached yet. The summary may still change as new attendance records are added. Continue generating now?'
      );
      if (!shouldContinue) return;
    }

    setEmployeeOverviewActionLoading(`generate-${employee.employee_id}`);
    try {
      const response = await api.post('/attendance/generate-summary', {
        employee_id: employee.employee_id,
        start_date: employeeOverviewPeriod.start_date,
        end_date: employeeOverviewPeriod.end_date,
      });
      const body = unwrapEmployeeOverviewPayload(response);
      
      // Check if employee has any time in/time out records
      const records = toEmployeeOverviewArray(body.records);
      const hasTimeIn = records.some(r => r.time_in !== null && r.time_in !== undefined && r.time_in !== '');
      const hasTimeOut = records.some(r => r.time_out !== null && r.time_out !== undefined && r.time_out !== '');
      
      if (!hasTimeIn || !hasTimeOut) {
        showNotificationMessage(`${employee.employee_name} has no complete time-in/time-out records. Cannot generate summary.`, 'warning');
        setEmployeeOverviewActionLoading(null);
        return;
      }
      
      setEmployeeOverviewGenerated((prev) => ({ ...prev, [employee.employee_id]: body.summary || {} }));
      setEmployeeOverviewRecordsByEmployee((prev) => ({ ...prev, [employee.employee_id]: records }));
      showNotificationMessage(`Generated attendance summary for ${employee.employee_name}.`, 'success');
    } catch (error) {
      console.error('Generate Employee Overview summary error:', error);
      showNotificationMessage(getApiErrorMessage(error, 'Failed to generate attendance summary'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  const saveEmployeeOverviewToPayroll = async (employee) => {
    const records = employeeOverviewRecordsByEmployee[employee.employee_id]?.length
      ? employeeOverviewRecordsByEmployee[employee.employee_id]
      : await loadEmployeeOverviewRecords(employee, false);
    
    // ==================== FIX: Check for complete time in/out ====================
    const hasCompleteRecord = records.some(r => 
      r.time_in !== null && r.time_in !== undefined && r.time_in !== '' &&
      r.time_out !== null && r.time_out !== undefined && r.time_out !== ''
    );
    
    if (!hasCompleteRecord) {
      showNotificationMessage(`${employee.employee_name} has no complete time-in/time-out records. Cannot save to payroll.`, 'warning');
      return;
    }
    
    const pendingOvertime = records.some((record) => record.overtime_status === 'pending');
    const unverifiedRecords = records.some((record) => !['verified', 'approved'].includes(String(
      record.approval_status || record.verification_status || record.attendance_status || ''
    ).toLowerCase()));

    if (!employeeOverviewGenerated[employee.employee_id]) {
      showNotificationMessage('Generate the attendance summary first before saving to Payroll.', 'warning');
      return;
    }

    if (records.length === 0) {
      showNotificationMessage('Cannot save. No attendance records were found for this payroll cutoff.', 'warning');
      return;
    }

    if (unverifiedRecords) {
      showNotificationMessage('Cannot save. Approve all attendance records before saving to Payroll.', 'warning');
      return;
    }

    if (pendingOvertime) {
      showNotificationMessage('Cannot save. Approve or decline all pending overtime records first.', 'warning');
      return;
    }

    setEmployeeOverviewActionLoading(`save-${employee.employee_id}`);
    try {
      await api.post('/attendance/save-summary-to-payroll', {
        employee_id: employee.employee_id,
        start_date: employeeOverviewPeriod.start_date,
        end_date: employeeOverviewPeriod.end_date,
        notes: 'Saved from Employee Overview attendance summary.',
      });
      setEmployeeOverviewSaved((prev) => ({ ...prev, [employee.employee_id]: true }));
      showNotificationMessage(`Saved ${employee.employee_name}'s attendance summary to Payroll.`, 'success');
      await fetchEmployeeOverview(true);
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    } catch (error) {
      console.error('Save Employee Overview payroll error:', error);
      showNotificationMessage(getApiErrorMessage(error, 'Failed to save attendance summary to Payroll'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  const approveEmployeeOverviewOvertime = async (record) => {
    setEmployeeOverviewActionLoading(`approve-ot-${record.attendance_id}`);
    try {
      await api.post(`/attendance/${record.attendance_id}/approve-overtime`, {
        approved_overtime_hours: record.overtime_hours,
        notes: 'Approved from Employee Overview.',
      });
      showNotificationMessage('Overtime approved.', 'success');
      if (employeeOverviewSelectedEmployee) {
        await generateEmployeeOverviewSummary(employeeOverviewSelectedEmployee);
        const refreshed = await loadEmployeeOverviewRecords(employeeOverviewSelectedEmployee, false);
        setEmployeeOverviewSelectedRecords(refreshed);
      }
    } catch (error) {
      console.error('Approve Employee Overview overtime error:', error);
      showNotificationMessage(getApiErrorMessage(error, 'Failed to approve overtime'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  const declineEmployeeOverviewOvertime = async (record) => {
    const reason = window.prompt('Reason for declining overtime:', 'Overtime declined by admin.');
    if (reason === null) return;

    setEmployeeOverviewActionLoading(`decline-ot-${record.attendance_id}`);
    try {
      await api.post(`/attendance/${record.attendance_id}/reject-overtime`, { reason });
      showNotificationMessage('Overtime declined.', 'success');
      if (employeeOverviewSelectedEmployee) {
        await generateEmployeeOverviewSummary(employeeOverviewSelectedEmployee);
        const refreshed = await loadEmployeeOverviewRecords(employeeOverviewSelectedEmployee, false);
        setEmployeeOverviewSelectedRecords(refreshed);
      }
    } catch (error) {
      console.error('Decline Employee Overview overtime error:', error);
      showNotificationMessage(getApiErrorMessage(error, 'Failed to decline overtime'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  const toggleEmployeeOverviewOvertime = (attendanceId) => {
    setEmployeeOverviewSelectedOvertimeIds((prev) => (
      prev.includes(attendanceId)
        ? prev.filter((id) => id !== attendanceId)
        : [...prev, attendanceId]
    ));
  };

  const selectAllEmployeeOverviewOvertime = () => {
    const pendingIds = employeeOverviewSelectedRecords
      .filter((record) => record.overtime_status === 'pending')
      .map((record) => record.attendance_id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => employeeOverviewSelectedOvertimeIds.includes(id));
    setEmployeeOverviewSelectedOvertimeIds(allSelected ? [] : pendingIds);
  };

  const decideSelectedEmployeeOverviewOvertime = async (action) => {
    if (employeeOverviewSelectedOvertimeIds.length === 0) {
      showNotificationMessage('Select at least one pending overtime record.', 'warning');
      return;
    }

    const reason = action === 'reject'
      ? window.prompt('Reason for declining selected overtime:', 'Overtime declined by admin.')
      : 'Bulk approved from Employee Overview.';
    if (reason === null) return;

    setEmployeeOverviewActionLoading(`bulk-ot-${action}`);
    try {
      const response = await api.post('/attendance/overtime/bulk-decision', {
        attendance_ids: employeeOverviewSelectedOvertimeIds,
        action,
        reason,
      });
      const body = unwrapEmployeeOverviewPayload(response);
      showNotificationMessage(
        `${body.updated_count || 0} overtime record(s) ${action === 'approve' ? 'approved' : 'declined'}.`,
        'success'
      );
      setEmployeeOverviewSelectedOvertimeIds([]);
      if (employeeOverviewSelectedEmployee) {
        const refreshed = await loadEmployeeOverviewRecords(employeeOverviewSelectedEmployee, false);
        setEmployeeOverviewSelectedRecords(refreshed);
        setEmployeeOverviewGenerated((prev) => {
          const next = { ...prev };
          delete next[employeeOverviewSelectedEmployee.employee_id];
          return next;
        });
      }
      await fetchEmployeeOverview(true);
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to update selected overtime records'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  const saveAllEmployeeOverviewToPayroll = async () => {
    setEmployeeOverviewActionLoading('save-all-payroll');
    try {
      const response = await api.post('/attendance/save-all-summaries-to-payroll', {
        start_date: employeeOverviewPeriod.start_date,
        end_date: employeeOverviewPeriod.end_date,
        notes: 'Automatically synchronized from Attendance Employee Overview.',
      });
      const body = unwrapEmployeeOverviewPayload(response);
      const processed = Number(body.processed_count || 0);
      const skipped = Number(body.skipped_count || 0);
      showNotificationMessage(
        processed > 0
          ? `${processed} payroll record(s) saved${skipped ? `; ${skipped} need attention` : ''}.`
          : `${skipped || 'All'} employee record(s) still need attendance approval or correction.`,
        processed > 0 ? 'success' : 'warning'
      );
      await fetchEmployeeOverview(true);
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to synchronize attendance to Payroll'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  // ==================== FIX: Edit Attendance with proper time detection ====================
  const openEmployeeOverviewAttendanceEditor = (record) => {
    // Check if record has no time in or time out
    const hasNoTimeIn = !record.time_in || record.time_in === '' || record.time_in === null;
    const hasNoTimeOut = !record.time_out || record.time_out === '' || record.time_out === null;
    
    if (hasNoTimeIn && hasNoTimeOut) {
      showNotificationMessage('This record has no time-in or time-out. Cannot edit a non-existent attendance record.', 'warning');
      return;
    }
    
    setEmployeeOverviewEditingRecord(record);
    setEmployeeOverviewEditTimeIn(toDateTimeLocalInput(record.time_in, record.date, '08:00'));
    setEmployeeOverviewEditTimeOut(toDateTimeLocalInput(record.time_out, record.date, '17:00'));
    setEmployeeOverviewEditApprovalStatus(record.approval_status || 'pending');
    setEmployeeOverviewEditNotes('Corrected from Employee Overview.');
  };

  const saveEmployeeOverviewAttendanceEdit = async () => {
    if (!employeeOverviewEditingRecord) return;
    
    // Check if both time fields are empty
    if (!employeeOverviewEditTimeIn && !employeeOverviewEditTimeOut) {
      showNotificationMessage('Enter at least a time-in or time-out to save.', 'warning');
      return;
    }

    setEmployeeOverviewActionLoading(`edit-${employeeOverviewEditingRecord.attendance_id}`);
    try {
      const response = await api.put(`/attendance/${employeeOverviewEditingRecord.attendance_id}/times`, {
        time_in: employeeOverviewEditTimeIn || null,
        time_out: employeeOverviewEditTimeOut || null,
        approval_status: employeeOverviewEditApprovalStatus,
        notes: employeeOverviewEditNotes,
      });
      const body = unwrapEmployeeOverviewPayload(response);
      const syncMessage = body.payroll_sync?.synced ? ' Payroll was synchronized automatically.' : '';
      showNotificationMessage(`Attendance record updated.${syncMessage}`, 'success');
      setEmployeeOverviewEditingRecord(null);
      if (employeeOverviewSelectedEmployee) {
        const refreshed = await loadEmployeeOverviewRecords(employeeOverviewSelectedEmployee, false);
        setEmployeeOverviewSelectedRecords(refreshed);
        setEmployeeOverviewGenerated((prev) => {
          const next = { ...prev };
          delete next[employeeOverviewSelectedEmployee.employee_id];
          return next;
        });
      }
      await fetchEmployeeOverview(true);
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to update attendance times'), 'error');
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  const printEmployeeOverviewReport = async (employee) => {
    const records = employeeOverviewRecordsByEmployee[employee.employee_id]?.length
      ? employeeOverviewRecordsByEmployee[employee.employee_id]
      : await loadEmployeeOverviewRecords(employee, false);
    const summary = employeeOverviewGenerated[employee.employee_id] || {
      regular_hours: 0,
      overtime_hours: 0,
      total_hours: 0,
      late_undertime: '0 min late / 0 min undertime',
    };

    const rows = records.map((record) => `
      <tr>
        <td>${record.day || ''}</td>
        <td>${formatEmployeeOverviewDate(record.date)}</td>
        <td>${record.assigned_schedule || 'Unscheduled'}</td>
        <td>${record.formatted_time_in || 'No Time In'}</td>
        <td>${record.formatted_time_out || 'No Time Out'}</td>
        <td>${formatEmployeeOverviewLocation(record.time_in_location)}</td>
        <td>${formatEmployeeOverviewLocation(record.time_out_location)}</td>
        <td>${formatDecimalHours(record.regular_hours)}</td>
        <td>${formatDecimalHours(record.overtime_hours)}</td>
        <td>${formatDecimalHours(record.total_hours)}</td>
        <td>${record.late_undertime || ''}</td>
      </tr>
    `).join('');

    const win = window.open('', '_blank');
    if (!win) {
      showNotificationMessage('Popup blocked. Please allow popups to print the report.', 'warning');
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Attendance Report - ${employee.employee_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 4px; }
            .muted { color: #6b7280; margin-top: 0; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
            .label { color: #6b7280; font-size: 12px; }
            .value { font-size: 20px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Print</button>
          <h1>Attendance Report</h1>
          <p class="muted">${employeeOverviewCutoffLabel}</p>
          <p><strong>${employee.employee_name}</strong> · ${employee.employee_code || 'N/A'} · ${employee.position || 'N/A'}</p>
          <div class="summary">
            <div class="card"><div class="label">Regular Hours</div><div class="value">${formatDecimalHours(summary.regular_hours)}</div></div>
            <div class="card"><div class="label">OT Hours</div><div class="value">${formatDecimalHours(summary.overtime_hours)}</div></div>
            <div class="card"><div class="label">Total Hours</div><div class="value">${formatDecimalHours(summary.total_hours)}</div></div>
            <div class="card"><div class="label">Late/Undertime</div><div class="value" style="font-size:14px">${summary.late_undertime || '0 min late / 0 min undertime'}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Day</th><th>Date</th><th>Assigned Schedule</th><th>Time In</th><th>Time Out</th><th>Time In Location</th><th>Time Out Location</th><th>Regular</th><th>OT</th><th>Total</th><th>Late/Undertime</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="11">No attendance records found.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
  };

  const displayedEmployeeOverviewEmployees = employeeOverviewEmployees.map((employee) => {
    const summary = employeeOverviewGenerated[employee.employee_id] || employee;
    return {
      ...employee,
      regular_hours: Number(summary.regular_hours || 0),
      overtime_hours: Number(summary.overtime_hours || 0),
      total_hours: Number(summary.total_hours || 0),
      late_undertime: summary.late_undertime || '0 min late / 0 min undertime',
      generated: Boolean(employeeOverviewGenerated[employee.employee_id]),
      saved_to_payroll: Boolean(employeeOverviewSaved[employee.employee_id] || employee.saved_to_payroll),
    };
  });

  const pendingEmployeeOverviewOvertime = employeeOverviewSelectedRecords.filter(
    (record) => record.overtime_status === 'pending'
  );
  const allPendingEmployeeOverviewOvertimeSelected = pendingEmployeeOverviewOvertime.length > 0
    && pendingEmployeeOverviewOvertime.every((record) => employeeOverviewSelectedOvertimeIds.includes(record.attendance_id));

  // Paginated unscheduled records
  const paginatedUnscheduledRecords = pendingUnscheduledRecords.slice(
    (unscheduledPage - 1) * unscheduledItemsPerPage,
    unscheduledPage * unscheduledItemsPerPage
  );
  const totalUnscheduledPages = Math.ceil(pendingUnscheduledRecords.length / unscheduledItemsPerPage);

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (statusPanelData) {
      console.log('📊 Status Panel Data Updated:', {
        recordCount: statusPanelRecords.length,
        records: statusPanelRecords,
        filters: statusPanelParams,
        lastRefresh: new Date().toLocaleTimeString()
      });
    }
  }, [statusPanelData, statusPanelRecords, statusPanelParams]);

  useEffect(() => {
    // Only fetch on tab switch if not already loaded
    if (activeMainTab === 'status-panel') {
      console.log('🔄 Switching to Employee Overview tab...');
      if (!hasInitiallyLoadedRef.current || employeeOverviewEmployees.length === 0) {
        fetchEmployeeOverview();
      } else {
        console.log('📊 Employee Overview data already loaded, using cache');
      }
    } else if (activeMainTab === 'unscheduled') {
      console.log('🔄 Switching to Unscheduled tab - fetching pending records...');
      fetchPendingUnscheduledRecords();
    }
  }, [activeMainTab, employeeOverviewPeriod.start_date, employeeOverviewPeriod.end_date, employeeOverviewDepartment, fetchEmployeeOverview, fetchPendingUnscheduledRecords, employeeOverviewEmployees.length]);

  useEffect(() => {
    const verifiedRecords = mobileAttendance.filter(r => r.verification_status === 'verified');
    if (verifiedRecords.length > 0) {
      console.log(`✅ Found ${verifiedRecords.length} verified records that should be in Status Panel`);
    }
  }, [mobileAttendance]);

  useEffect(() => {
    window.refreshAttendanceData = () => {
      refetchMobile();
      fetchEmployeeOverview(true);
      fetchPendingUnscheduledRecords();
    };
    return () => { delete window.refreshAttendanceData; };
  }, [refetchMobile, fetchEmployeeOverview, fetchPendingUnscheduledRecords]);

  useEffect(() => { 
    loadCutoffHistory(); 
  }, [selectedYear, selectedMonth, cutoffPeriod]);

  useEffect(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setStatusPanelFilters(prev => ({ ...prev, start_date: startDate, end_date: endDate }));
    fetchPendingUnscheduledRecords();
    // Load Employee Overview only once on initial mount
    if (!hasInitiallyLoadedRef.current) {
      fetchEmployeeOverview();
    }
  }, [fetchPendingUnscheduledRecords, fetchEmployeeOverview]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      window.location.href = '/login';
    }
  }, []);

  // Auto-refresh interval with proper cleanup - only refresh if data is stale
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      if (activeMainTab === 'status-panel') {
        // Only refresh if data might be stale (e.g., after 5 minutes)
        const dataAge = Date.now() - lastRefreshTime.getTime();
        if (dataAge > 300000) { // 5 minutes
          fetchEmployeeOverview(true);
        }
      } else if (activeMainTab === 'unscheduled') {
        fetchPendingUnscheduledRecords();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, activeMainTab, fetchEmployeeOverview, fetchPendingUnscheduledRecords, lastRefreshTime]);

  // ==================== NOTIFICATION COMPONENT ====================
  const Notification = () => (
    <div className={`attendance-notification ${notificationType}`}>
      <div className="notification-icon">
        {notificationType === 'success' && <FiCheckCircle />}
        {notificationType === 'error' && <FiXCircle />}
        {notificationType === 'warning' && <FiAlertCircle />}
        {notificationType === 'info' && <FiClock />}
      </div>
      <div className="notification-message">{notificationMessage}</div>
      <button className="notification-close" onClick={() => setShowNotification(false)}><FiXIcon /></button>
    </div>
  );

  // ==================== RENDER ====================
  return (
    <div className="attendance-container">
      {showNotification && <Notification />}

      {/* Selfie Modal */}
      {showSelfieModal && selectedSelfie && (
        <div className="modal-overlay" onClick={() => setShowSelfieModal(false)}>
          <div className="modal-content selfie-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance Selfie</h2>
              <button className="close-modal" onClick={() => setShowSelfieModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body selfie-body">
              <img src={selectedSelfie} alt="Attendance Selfie" className="selfie-full" />
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedHistoryCutoff && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance History</h2>
              <h3>{selectedHistoryCutoff.label}</h3>
              <button className="close-modal" onClick={() => setShowHistoryModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              {loadingHistory ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading history data...</p>
                </div>
              ) : (
                <>
                  <div className="history-stats">
                    <div className="history-stat">
                      <span className="stat-label">Total Records</span>
                      <span className="stat-value">{historyAttendance.length}</span>
                    </div>
                    <div className="history-stat">
                      <span className="stat-label">Time Ins</span>
                      <span className="stat-value">{historyAttendance.filter(r => r.type === 'IN').length}</span>
                    </div>
                    <div className="history-stat">
                      <span className="stat-label">Time Outs</span>
                      <span className="stat-value">{historyAttendance.filter(r => r.type === 'OUT').length}</span>
                    </div>
                    <div className="history-stat">
                      <span className="stat-label">Verified</span>
                      <span className="stat-value">{historyAttendance.filter(r => r.verification_status === 'verified').length}</span>
                    </div>
                  </div>
                  <div className="history-list">
                    <table className="attendance-table formal">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Employee</th>
                          <th>Type</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyAttendance.slice(0, 50).map((record, index) => {
                          const typeDetails = getTypeDetails(record.type);
                          const TypeIcon = typeDetails.icon;
                          const statusDetails = getVerificationStatusDetails(record.verification_status);
                          const StatusIcon = statusDetails.icon;
                          return (
                            <tr key={record.event_id || record.id || index}>
                              <td>
                                <div className="datetime-cell">
                                  <span className="date">{formatDate(record.timestamp)}</span>
                                  <span className="time">{formatTime(record.timestamp)}</span>
                                </div>
                              </td>
                              <td>
                                <div className="employee-cell">
                                  <span className="employee-name">{record.employee_name || 'N/A'}</span>
                                  <span className="employee-code">{record.employee_code}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`attendance-type ${record.type === 'IN' ? 'check-in' : 'check-out'}`}>
                                  <TypeIcon style={{ transform: typeDetails.iconRotation }} />
                                  <span>{typeDetails.text}</span>
                                </span>
                              </td>
                              <td>
                                <span className={`verification-status ${record.verification_status}`}>
                                  <StatusIcon />
                                  <span>{statusDetails.text}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {historyAttendance.length === 0 && (
                      <div className="empty-state">
                        <p>No attendance records found for this cutoff period</p>
                      </div>
                    )}
                    {historyAttendance.length > 50 && (
                      <div className="history-note">
                        <p>Showing first 50 of {historyAttendance.length} records</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="attendance-header">
        <div className="header-left">
          <div className="header-icon"><FiUserCheck /></div>
          <div className="header-title">
            <h1>Attendance Management</h1>
            <p>Track employee time-in and time-out records by cutoff period</p>
          </div>
        </div>
        <div className="header-actions">
          <button className={`action-btn auto-refresh-btn ${autoRefreshEnabled ? 'active' : ''}`} onClick={toggleAutoRefresh} title={autoRefreshEnabled ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}>
            {autoRefreshEnabled ? <FiBell /> : <FiBellOff />}
          </button>
          <button className="action-btn history-btn" onClick={() => loadCutoffHistory()} title="View Cutoff History">
            <FiArchive />
          </button>
          <button className="action-btn export-btn" onClick={handleExport} title="Export Current Cutoff">
            <FiDownload />
          </button>
          <button className="action-btn refresh-btn" onClick={handleRefresh} title="Refresh Data">
            <FiRefreshCw />
          </button>
        </div>
      </div>

      {/* ===== MAIN TABS ===== */}
      <div className="main-tabs">
        <button className={`main-tab ${activeMainTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveMainTab('attendance')}>
          <FiList /> Attendance Records
        </button>
        <button className={`main-tab ${activeMainTab === 'status-panel' ? 'active' : ''}`} onClick={() => setActiveMainTab('status-panel')}>
          <FiSliders /> Employee Overview
        </button>
        <button className={`main-tab ${activeMainTab === 'unscheduled' ? 'active' : ''}`} onClick={() => setActiveMainTab('unscheduled')}>
          <FiAlertTriangle /> Unscheduled
          {pendingUnscheduledRecords.length > 0 && <span className="tab-badge warning">{pendingUnscheduledRecords.length}</span>}
        </button>
        {/* 7th Day Warning Tab */}
        {consecutiveWarnings.length > 0 && (
          <button className={`main-tab warning ${activeMainTab === 'consecutive' ? 'active' : ''}`} onClick={() => setActiveMainTab('consecutive')}>
            <FiAlertCircle /> 7th Day
            <span className="tab-badge danger">{consecutiveWarnings.length}</span>
          </button>
        )}
      </div>

      {/* ===== ATTENDANCE TAB - SCROLLABLE ===== */}
      {activeMainTab === 'attendance' && (
        <>
          {/* Cutoff Selector */}
          <div className="cutoff-selector">
            <div className="cutoff-info">
              <FiCalendarIcon className="cutoff-icon" />
              <div className="cutoff-details">
                <span className="cutoff-label">Current Cutoff Period</span>
                <span className="cutoff-range">{formatCutoffRange(selectedYear, selectedMonth, cutoffPeriod)}</span>
              </div>
            </div>
            <div className="cutoff-controls">
              <div className="period-selector">
                <button className={`period-btn ${cutoffPeriod === 'first' ? 'active' : ''}`} onClick={() => setCutoffPeriod('first')}>
                  <FiCalendar /> 1st - 15th
                </button>
                <button className={`period-btn ${cutoffPeriod === 'second' ? 'active' : ''}`} onClick={() => setCutoffPeriod('second')}>
                  <FiCalendar /> 16th - End
                </button>
              </div>
              <div className="month-selector">
                <button className="month-nav-btn" onClick={() => {
                  if (cutoffPeriod === 'first') {
                    setCutoffPeriod('second');
                  } else {
                    setCutoffPeriod('first');
                    let newMonth = selectedMonth - 1;
                    let newYear = selectedYear;
                    if (newMonth < 0) {
                      newMonth = 11;
                      newYear--;
                    }
                    setSelectedMonth(newMonth);
                    setSelectedYear(newYear);
                  }
                }}>
                  <FiChevronLeft />
                </button>
                <span className="current-month">{new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button className="month-nav-btn" onClick={() => {
                  if (cutoffPeriod === 'second') {
                    setCutoffPeriod('first');
                  } else {
                    setCutoffPeriod('second');
                    let newMonth = selectedMonth + 1;
                    let newYear = selectedYear;
                    if (newMonth > 11) {
                      newMonth = 0;
                      newYear++;
                    }
                    setSelectedMonth(newMonth);
                    setSelectedYear(newYear);
                  }
                }}>
                  <FiChevronRight />
                </button>
              </div>
              <div className="history-shortcut">
                <button className="history-shortcut-btn" onClick={() => { loadCutoffHistory(); showNotificationMessage('Click the archive icon to view full history', 'info'); }}>
                  <FiTrendingUp /> Previous Cutoffs
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card formal">
              <div className="stat-icon total"><FiUsers /></div>
              <div className="stat-info">
                <span className="stat-label">Total Records</span>
                <span className="stat-value">{getCurrentCutoffAttendance().length}</span>
              </div>
            </div>
            <div className="stat-card formal">
              <div className="stat-icon present"><FiLogOut style={{ transform: 'rotate(180deg)' }} /></div>
              <div className="stat-info">
                <span className="stat-label">Time Ins</span>
                <span className="stat-value">{attendanceStats.total_check_ins}</span>
              </div>
            </div>
            <div className="stat-card formal">
              <div className="stat-icon"><FiLogOut /></div>
              <div className="stat-info">
                <span className="stat-label">Time Outs</span>
                <span className="stat-value">{attendanceStats.total_check_outs}</span>
              </div>
            </div>
            <div className="stat-card formal">
              <div className="stat-icon verified"><FiCheckCircle /></div>
              <div className="stat-info">
                <span className="stat-label">Verified</span>
                <span className="stat-value">{attendanceStats.verified_check_ins}</span>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="search-filter-bar">
            <div className="search-wrapper">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Search by employee name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
              {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}><FiXIcon /></button>}
            </div>
            <div className="filter-actions">
              <button className={`filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                <FiFilter /><span>Filters</span>
                {(statusFilter !== 'all' || typeFilter !== 'ALL') && <span className="filter-badge">{(statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'ALL' ? 1 : 0)}</span>}
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="filters-panel">
              <div className="filters-header">
                <h3>Filter Attendance</h3>
                <button className="close-filters" onClick={() => setShowFilters(false)}><FiXIcon /></button>
              </div>
              <div className="filters-content">
                <div className="filter-group">
                  <label>Attendance Type</label>
                  <div className="filter-options">
                    {['ALL', 'IN', 'OUT'].map(type => (
                      <button key={type} className={`filter-option ${typeFilter === type ? 'active' : ''}`} onClick={() => setTypeFilter(type)}>
                        {type === 'ALL' ? 'All' : type === 'IN' ? 'Time In' : 'Time Out'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-group">
                  <label>Verification Status</label>
                  <div className="filter-options">
                    {['all', 'pending', 'verified', 'rejected'].map(status => (
                      <button key={status} className={`filter-option ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)}>
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-actions-bottom">
                  <button className="clear-filters-btn" onClick={() => { setStatusFilter('all'); setTypeFilter('ALL'); showNotificationMessage('All filters cleared', 'success'); }}>
                    <FiXCircle /> Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== FIX: Main Content - SCROLLABLE TABLE ===== */}
          <div className="main-content-scrollable" ref={mainContentRef}>
            <div className="attendance-list">
              {mobileLoading ? (
                <SkeletonTable />
              ) : (
                <>
                  {/* Scrollable table wrapper */}
                  <div className="table-wrapper-scrollable">
                    <table className="attendance-table formal">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Employee</th>
                          <th>Type</th>
                          <th>Selfie</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMobileAttendance.map((record) => {
                          const typeDetails = getTypeDetails(record.type);
                          const TypeIcon = typeDetails.icon;
                          const statusDetails = getVerificationStatusDetails(record.verification_status);
                          const StatusIcon = statusDetails.icon;
                          return (
                            <tr key={record.event_id || record.id} className="formal-row">
                              <td>
                                <div className="datetime-cell">
                                  <span className="date">{formatDate(record.timestamp)}</span>
                                  <span className="time">{formatTime(record.timestamp)}</span>
                                </div>
                              </td>
                              <td>
                                <div className="employee-cell">
                                  <span className="employee-name">{record.employee_name || 'N/A'}</span>
                                  <span className="employee-code">{record.employee_code}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`attendance-type ${record.type === 'IN' ? 'check-in' : 'check-out'}`}>
                                  <TypeIcon style={{ transform: typeDetails.iconRotation }} />
                                  <span>{typeDetails.text}</span>
                                </span>
                              </td>
                              <td>
                                {record.selfie_url ? (
                                  <button className="selfie-view-btn" onClick={() => handleViewSelfie(record.selfie_url)}>
                                    <BsCameraFill /><span>View</span>
                                  </button>
                                ) : (
                                  <span className="no-selfie">No selfie</span>
                                )}
                              </td>
                              <td>
                                {record.location ? (
                                  <span className="location-badge" title={`Lat: ${record.location.lat}, Lng: ${record.location.lng}`}>
                                    <BsGeoAlt /> Captured
                                  </span>
                                ) : (
                                  <span className="no-location">—</span>
                                )}
                              </td>
                              <td>
                                <span className={`verification-status ${record.verification_status}`}>
                                  <StatusIcon /><span>{statusDetails.text}</span>
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  {renderAttendanceActions(record)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {filteredMobileAttendance.length === 0 && (
                    <div className="empty-state">
                      <BsCameraFill className="empty-icon" />
                      <h3>No attendance records found</h3>
                      <button className="clear-filters-btn" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('ALL'); }}>
                        Clear Filters
                      </button>
                    </div>
                  )}
                  
                  {filteredMobileAttendance.length > 0 && (
                    <div className="pagination formal">
                      <div className="pagination-info">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredMobileAttendance.length)} of {filteredMobileAttendance.length} records
                      </div>
                      <div className="pagination-controls">
                        <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                          <FiChevronLeft />
                        </button>
                        
                        {[...Array(Math.min(totalMobilePages, 5))].map((_, i) => {
                          let pageNum;
                          if (totalMobilePages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalMobilePages - 2) {
                            pageNum = totalMobilePages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button key={pageNum} className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`} onClick={() => setCurrentPage(pageNum)}>
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(totalMobilePages, prev + 1))} disabled={currentPage === totalMobilePages}>
                          <FiChevronRight />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== EMPLOYEE OVERVIEW TAB - SCROLLABLE ===== */}
      {activeMainTab === 'status-panel' && (
        <div className="status-panel-container">
          <div className="status-panel-header-info">
            <div>
              <span style={{ fontWeight: 'bold' }}>Employee Overview</span>
              <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
                One row per employee with attendance records for the selected payroll cutoff
              </span>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#999' }}>
                Last updated: {lastRefreshTime.toLocaleTimeString()}
              </span>
              {employeeOverviewLoading && (
                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#f39c12' }}>
                  <FiRefreshCw className="spinning" /> Updating...
                </span>
              )}
            </div>
          </div>

          <div className="cutoff-selector">
            <div className="cutoff-info">
              <FiCalendarIcon className="cutoff-icon" />
              <div className="cutoff-details">
                <span className="cutoff-label">Payroll Period</span>
                <span className="cutoff-range">{employeeOverviewCutoffLabel}</span>
                {!employeeOverviewMeta.can_generate && (
                  <span className="cutoff-warning">Cutoff not reached; generation remains available after confirmation.</span>
                )}
              </div>
            </div>
            <div className="cutoff-controls">
              <div className="period-selector">
                <button className={`period-btn ${cutoffPeriod === 'first' ? 'active' : ''}`} onClick={() => setCutoffPeriod('first')}>
                  <FiCalendar /> 1st - 15th
                </button>
                <button className={`period-btn ${cutoffPeriod === 'second' ? 'active' : ''}`} onClick={() => setCutoffPeriod('second')}>
                  <FiCalendar /> 16th - End
                </button>
              </div>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="month-select">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
              <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="year-input" min="2020" max="2030" />
            </div>
          </div>

          <div className="status-panel-filters">
            <div className="filter-group">
              <select className="filter-select" value={employeeOverviewDepartment} onChange={(e) => setEmployeeOverviewDepartment(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <input
                type="text"
                className="filter-search"
                placeholder="Search employee name or ID..."
                value={employeeOverviewSearch}
                onChange={(e) => setEmployeeOverviewSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchEmployeeOverview(true); }}
              />
            </div>
            <button className="refresh-btn" onClick={() => fetchEmployeeOverview(true)} disabled={employeeOverviewLoading}>
              <FiSearch /> Search
            </button>
            <button className="refresh-btn force-refresh" onClick={() => fetchEmployeeOverview(true)} disabled={employeeOverviewLoading}>
              <FiRefreshCw /> Refresh
            </button>
            <button className="refresh-btn" onClick={saveAllEmployeeOverviewToPayroll} disabled={employeeOverviewActionLoading === 'save-all-payroll'}>
              <FiSave /> {employeeOverviewActionLoading === 'save-all-payroll' ? 'Saving...' : 'Save All Ready to Payroll'}
            </button>
          </div>

          {/* ===== FIX: Scrollable Employee Overview Table ===== */}
          <div className="status-panel-table-wrapper">
            {employeeOverviewLoading ? (
              <SkeletonStatusPanelTable />
            ) : displayedEmployeeOverviewEmployees.length > 0 ? (
              <div className="table-wrapper-scrollable">
                <table className="status-panel-table">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Employee ID</th>
                      <th>Position</th>
                      <th>Regular Hours</th>
                      <th>OT Hours</th>
                      <th>Total Hours</th>
                      <th>Late/Undertime</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEmployeeOverviewEmployees.map((employee) => (
                      <tr key={employee.employee_id}>
                        <td>
                          <div className="employee-info">
                            <div className="employee-avatar" style={{ background: `linear-gradient(135deg, #3b82f6, #1e40af)` }}>
                              {employee.employee_name?.charAt(0) || '?'}
                            </div>
                            <div className="employee-details">
                              <span className="employee-name">{employee.employee_name || 'N/A'}</span>
                              <span className="employee-dept">{employee.department || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td>{employee.employee_code || employee.employee_id}</td>
                        <td>{employee.position || 'N/A'}</td>
                        <td>{formatDecimalHours(employee.regular_hours)}</td>
                        <td>{formatDecimalHours(employee.overtime_hours)}</td>
                        <td><strong>{formatDecimalHours(employee.total_hours)}</strong></td>
                        <td>{employee.late_undertime}</td>
                        <td>
                          <div className="action-buttons-row">
                            <button className="action-icon-btn view" onClick={() => loadEmployeeOverviewRecords(employee)} disabled={employeeOverviewActionLoading === `view-${employee.employee_id}`} title="View">
                              <FiEye />
                            </button>
                            <button className="action-icon-btn verify" onClick={() => generateEmployeeOverviewSummary(employee)} disabled={employeeOverviewActionLoading === `generate-${employee.employee_id}`} title="Generate">
                              <FiCheckCircle />
                            </button>
                            <button className="action-icon-btn" onClick={() => printEmployeeOverviewReport(employee)} title="Print">
                              <FiPrinter />
                            </button>
                            <button className="action-icon-btn verify" onClick={() => saveEmployeeOverviewToPayroll(employee)} disabled={!employee.generated || employee.saved_to_payroll || employeeOverviewActionLoading === `save-${employee.employee_id}`} title={employee.saved_to_payroll ? "Already saved to Payroll" : "Save to Payroll"}>
                              {employee.saved_to_payroll ? <FiCheckCircle /> : <FiSave />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <FiFileText className="empty-icon" />
                <h3>No employees with attendance</h3>
                <p>No attendance records were found for {employeeOverviewCutoffLabel}.</p>
              </div>
            )}
          </div>

          {/* Employee Overview Modal */}
          {employeeOverviewSelectedEmployee && (
            <div className="modal-overlay" onClick={() => setEmployeeOverviewSelectedEmployee(null)}>
              <div className="modal-content" style={{ maxWidth: '1200px', width: '96%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h2>{employeeOverviewSelectedEmployee.employee_name}</h2>
                    <p style={{ margin: 0, color: '#6b7280' }}>{employeeOverviewCutoffLabel}</p>
                  </div>
                  <button className="close-modal" onClick={() => setEmployeeOverviewSelectedEmployee(null)}>×</button>
                </div>
                <div className="modal-body">
                  {pendingEmployeeOverviewOvertime.length > 0 && (
                    <div className="status-panel-filters" style={{ marginBottom: '12px' }}>
                      <button className="refresh-btn" onClick={selectAllEmployeeOverviewOvertime}>
                        <FiCheck /> {allPendingEmployeeOverviewOvertimeSelected ? 'Deselect All OT' : 'Select All Pending OT'}
                      </button>
                      <button className="refresh-btn" onClick={() => decideSelectedEmployeeOverviewOvertime('approve')} disabled={employeeOverviewSelectedOvertimeIds.length === 0 || employeeOverviewActionLoading === 'bulk-ot-approve'}>
                        <FiCheckCircle /> Approve Selected
                      </button>
                      <button className="refresh-btn" onClick={() => decideSelectedEmployeeOverviewOvertime('reject')} disabled={employeeOverviewSelectedOvertimeIds.length === 0 || employeeOverviewActionLoading === 'bulk-ot-reject'}>
                        <FiXCircle /> Decline Selected
                      </button>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{employeeOverviewSelectedOvertimeIds.length} selected</span>
                    </div>
                  )}
                  <div className="attendance-table-wrapper">
                    <table className="status-panel-table">
                      <thead>
                        <tr>
                          <th style={{ width: '42px' }}>
                            <input
                              type="checkbox"
                              checked={allPendingEmployeeOverviewOvertimeSelected}
                              onChange={selectAllEmployeeOverviewOvertime}
                              disabled={pendingEmployeeOverviewOvertime.length === 0}
                              aria-label="Select all pending overtime"
                            />
                          </th>
                          <th>Day</th>
                          <th>Assigned Schedule</th>
                          <th>Time In Selfie</th>
                          <th>Time Out Selfie</th>
                          <th>Original Location</th>
                          <th>Regular Hours</th>
                          <th>OT Hours</th>
                          <th>Total Hours</th>
                          <th>Late/Undertime</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeOverviewSelectedRecords.map((record) => (
                          <tr key={record.attendance_id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={employeeOverviewSelectedOvertimeIds.includes(record.attendance_id)}
                                onChange={() => toggleEmployeeOverviewOvertime(record.attendance_id)}
                                disabled={record.overtime_status !== 'pending'}
                                aria-label={`Select overtime for ${record.date}`}
                              />
                            </td>
                            <td>
                              <strong>{record.day || 'N/A'}</strong><br />
                              <span>{formatEmployeeOverviewDate(record.date)}</span>
                            </td>
                            <td>{record.assigned_schedule || 'Unscheduled'}</td>
                            <td>
                              <div>{record.formatted_time_in || 'No Time In'}</div>
                              {record.time_in_selfie_url ? (
                                <button className="action-icon-btn view-selfie" onClick={() => handleViewSelfie(record.time_in_selfie_url)}><FiEye /> View</button>
                              ) : <span>No selfie</span>}
                            </td>
                            <td>
                              <div>{record.formatted_time_out || 'No Time Out'}</div>
                              {record.time_out_selfie_url ? (
                                <button className="action-icon-btn view-selfie" onClick={() => handleViewSelfie(record.time_out_selfie_url)}><FiEye /> View</button>
                              ) : <span>No selfie</span>}
                            </td>
                            <td>
                              <div><strong>In:</strong> {formatEmployeeOverviewLocation(record.time_in_location)}</div>
                              <div><strong>Out:</strong> {formatEmployeeOverviewLocation(record.time_out_location)}</div>
                            </td>
                            <td>{formatDecimalHours(record.regular_hours)}</td>
                            <td>{formatDecimalHours(record.overtime_hours)}</td>
                            <td><strong>{formatDecimalHours(record.total_hours)}</strong></td>
                            <td>{record.late_undertime}</td>
                            <td>
                              <div className="action-buttons-row" style={{ flexWrap: 'wrap' }}>
                                {/* ===== FIX: Only show Edit Time if record has time in or time out ===== */}
                                {(record.time_in || record.time_out) && (
                                  <button className="action-icon-btn" onClick={() => openEmployeeOverviewAttendanceEditor(record)} title="Edit time-in/time-out">
                                    <FiEdit2 /> Edit Time
                                  </button>
                                )}
                                {(!record.time_in && !record.time_out) && (
                                  <span className="no-time-warning" style={{ color: '#e74c3c', fontSize: '11px' }}>
                                    No time record to edit
                                  </span>
                                )}
                                {record.overtime_status === 'pending' ? (
                                  <>
                                    <button className="action-icon-btn verify" onClick={() => approveEmployeeOverviewOvertime(record)} disabled={employeeOverviewActionLoading === `approve-ot-${record.attendance_id}`}><FiCheckCircle /> Approve</button>
                                    <button className="action-icon-btn reject" onClick={() => declineEmployeeOverviewOvertime(record)} disabled={employeeOverviewActionLoading === `decline-ot-${record.attendance_id}`}><FiXCircle /> Decline</button>
                                  </>
                                ) : record.overtime_status === 'approved' ? (
                                  <span className="status-badge verified">OT Approved</span>
                                ) : record.overtime_status === 'rejected' ? (
                                  <span className="status-badge rejected">OT Declined</span>
                                ) : (
                                  <span>No OT</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {employeeOverviewSelectedRecords.length === 0 && <div className="empty-state"><p>No attendance records found.</p></div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="modal-btn secondary" onClick={() => setEmployeeOverviewSelectedEmployee(null)}>Close</button>
                  <button className="modal-btn" onClick={() => printEmployeeOverviewReport(employeeOverviewSelectedEmployee)}><FiPrinter /> Print Report</button>
                </div>
              </div>
            </div>
          )}

          {/* ===== FIX: Edit Attendance Modal - Shows warning when no time ===== */}
          {employeeOverviewEditingRecord && (
            <div className="modal-overlay" onClick={() => setEmployeeOverviewEditingRecord(null)}>
              <div className="modal-content" style={{ maxWidth: '560px', width: '94%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h2>Edit Attendance Times</h2>
                    <p style={{ margin: 0, color: '#6b7280' }}>{formatEmployeeOverviewDate(employeeOverviewEditingRecord.date)}</p>
                  </div>
                  <button className="close-modal" onClick={() => setEmployeeOverviewEditingRecord(null)}>×</button>
                </div>
                <div className="modal-body">
                  {/* Warning if no time records */}
                  {(!employeeOverviewEditingRecord.time_in && !employeeOverviewEditingRecord.time_out) && (
                    <div className="warning-box" style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #f59e0b' }}>
                      <FiAlertCircle style={{ color: '#f59e0b', marginRight: '8px' }} />
                      <span style={{ color: '#92400e', fontSize: '13px' }}>
                        This record has no time-in or time-out. You cannot edit a non-existent attendance record.
                      </span>
                    </div>
                  )}
                  
                  {/* Only show time fields if there's at least one time record */}
                  {(employeeOverviewEditingRecord.time_in || employeeOverviewEditingRecord.time_out) ? (
                    <>
                      <div className="filter-group" style={{ marginBottom: '14px' }}>
                        <label>Time In</label>
                        <input 
                          type="datetime-local" 
                          className="filter-search" 
                          value={employeeOverviewEditTimeIn} 
                          onChange={(e) => setEmployeeOverviewEditTimeIn(e.target.value)} 
                          placeholder={!employeeOverviewEditingRecord.time_in ? "No time in recorded" : ""}
                        />
                        {!employeeOverviewEditingRecord.time_in && (
                          <span style={{ fontSize: '11px', color: '#e74c3c' }}>⚠️ No time-in recorded for this day</span>
                        )}
                      </div>
                      <div className="filter-group" style={{ marginBottom: '14px' }}>
                        <label>Time Out</label>
                        <input 
                          type="datetime-local" 
                          className="filter-search" 
                          value={employeeOverviewEditTimeOut} 
                          onChange={(e) => setEmployeeOverviewEditTimeOut(e.target.value)} 
                          placeholder={!employeeOverviewEditingRecord.time_out ? "No time out recorded" : ""}
                        />
                        {!employeeOverviewEditingRecord.time_out && (
                          <span style={{ fontSize: '11px', color: '#e74c3c' }}>⚠️ No time-out recorded for this day</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="no-time-warning-box" style={{ background: '#fee2e2', padding: '16px', borderRadius: '8px', border: '1px solid #ef4444' }}>
                      <FiAlertCircle style={{ color: '#dc2626', fontSize: '24px', marginBottom: '8px' }} />
                      <p style={{ color: '#991b1b', fontWeight: 'bold' }}>No attendance record exists for this day.</p>
                      <p style={{ color: '#7f1d1d', fontSize: '13px' }}>This employee did not clock in or out. Cannot edit a non-existent record.</p>
                    </div>
                  )}
                  
                  <div className="filter-group" style={{ marginBottom: '14px' }}>
                    <label>Attendance Approval</label>
                    <select className="filter-select" value={employeeOverviewEditApprovalStatus} onChange={(e) => setEmployeeOverviewEditApprovalStatus(e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Correction Notes</label>
                    <textarea className="filter-search" rows="3" value={employeeOverviewEditNotes} onChange={(e) => setEmployeeOverviewEditNotes(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="modal-btn secondary" onClick={() => setEmployeeOverviewEditingRecord(null)}>Cancel</button>
                  {(employeeOverviewEditingRecord.time_in || employeeOverviewEditingRecord.time_out) && (
                    <button className="modal-btn" onClick={saveEmployeeOverviewAttendanceEdit} disabled={employeeOverviewActionLoading === `edit-${employeeOverviewEditingRecord.attendance_id}`}>
                      <FiSave /> Save Attendance
                    </button>
                  )}
                  {(!employeeOverviewEditingRecord.time_in && !employeeOverviewEditingRecord.time_out) && (
                    <button className="modal-btn disabled" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      Cannot Edit - No Time Record
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== UNSCHEDULED APPROVALS TAB ===== */}
      {activeMainTab === 'unscheduled' && (
        <div className="unscheduled-container">
          <div className="unscheduled-header">
            <div className="unscheduled-header-info">
              <FiAlertTriangle className="unscheduled-icon" />
              <div>
                <h3>Pending Unscheduled Attendance Approvals</h3>
                <p>These attendance records were created without a valid schedule. Review the selfie and approve if valid, or reject if invalid.</p>
              </div>
            </div>
            <button className="refresh-btn" onClick={fetchPendingUnscheduledRecords} disabled={submitting}>
              <FiRefreshCw /> Refresh
            </button>
          </div>

          <div className="unscheduled-stats">
            <div className="unscheduled-stat">
              <span className="stat-value">{pendingUnscheduledRecords.length}</span>
              <span className="stat-label">Pending Approvals</span>
            </div>
            <div className="unscheduled-stat">
              <span className="stat-value">{pendingUnscheduledRecords.filter(r => r.type === 'IN').length}</span>
              <span className="stat-label">Unscheduled Time Ins</span>
            </div>
            <div className="unscheduled-stat">
              <span className="stat-value">{pendingUnscheduledRecords.filter(r => r.type === 'OUT').length}</span>
              <span className="stat-label">Unscheduled Time Outs</span>
            </div>
          </div>

          {pendingUnscheduledRecords.length === 0 ? (
            <div className="empty-state">
              <FiCheckCircle className="empty-icon" />
              <h3>No pending unscheduled approvals</h3>
              <p>All attendance records have valid schedules or have been reviewed</p>
            </div>
          ) : (
            <>
              <div className="unscheduled-table-wrapper">
                <table className="unscheduled-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Validation Message</th>
                      <th>Selfie</th>
                      <th>Location</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUnscheduledRecords.map((record) => (
                      <tr key={record.event_id || record.id}>
                        <td>
                          <div className="datetime-cell">
                            <span className="date">{formatDate(record.timestamp)}</span>
                            <span className="time">{formatTime(record.timestamp)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="employee-cell">
                            <span className="employee-name">{record.employee_name || 'N/A'}</span>
                            <span className="employee-code">{record.employee_code}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`attendance-type ${record.type === 'IN' ? 'check-in' : 'check-out'}`}>
                            {record.type === 'IN' ? 'Time In' : 'Time Out'}
                          </span>
                        </td>
                        <td>
                          <div className="validation-message">
                            <FiAlertTriangle className="warning-icon" />
                            <span>{record.validation_message || 'No schedule found'}</span>
                          </div>
                        </td>
                        <td>
                          {record.selfie_url ? (
                            <button className="selfie-view-btn" onClick={() => handleViewSelfie(record.selfie_url)}>
                              <BsCameraFill /> View
                            </button>
                          ) : (
                            <span className="no-selfie">No selfie</span>
                          )}
                        </td>
                        <td>
                          {record.location ? (
                            <span className="location-badge"><BsGeoAlt /> Captured</span>
                          ) : (
                            <span className="no-location">—</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="action-btn approve" 
                              onClick={() => {
                                setSelectedUnscheduledRecord(record);
                                setUnscheduledApprovalNote('');
                                setShowUnscheduledModal(true);
                              }}
                              disabled={submitting}
                            >
                              <FiThumbsUp /> Approve
                            </button>
                            <button 
                              className="action-btn decline" 
                              onClick={() => {
                                const reason = prompt('Please provide a reason for rejecting this unscheduled attendance:');
                                if (reason && reason.trim()) {
                                  rejectUnscheduledRecord(record.id, reason);
                                }
                              }}
                              disabled={submitting}
                            >
                              <FiThumbsDown /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalUnscheduledPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    Showing {(unscheduledPage - 1) * unscheduledItemsPerPage + 1} to {Math.min(unscheduledPage * unscheduledItemsPerPage, pendingUnscheduledRecords.length)} of {pendingUnscheduledRecords.length} records
                  </div>
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn" 
                      onClick={() => setUnscheduledPage(prev => Math.max(1, prev - 1))} 
                      disabled={unscheduledPage === 1}
                    >
                      <FiChevronLeft />
                    </button>
                    {[...Array(Math.min(totalUnscheduledPages, 5))].map((_, i) => {
                      let pageNum;
                      if (totalUnscheduledPages <= 5) {
                        pageNum = i + 1;
                      } else if (unscheduledPage <= 3) {
                        pageNum = i + 1;
                      } else if (unscheduledPage >= totalUnscheduledPages - 2) {
                        pageNum = totalUnscheduledPages - 4 + i;
                      } else {
                        pageNum = unscheduledPage - 2 + i;
                      }
                      return (
                        <button 
                          key={pageNum} 
                          className={`pagination-btn ${unscheduledPage === pageNum ? 'active' : ''}`} 
                          onClick={() => setUnscheduledPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button 
                      className="pagination-btn" 
                      onClick={() => setUnscheduledPage(prev => Math.min(totalUnscheduledPages, prev + 1))} 
                      disabled={unscheduledPage === totalUnscheduledPages}
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== 7TH DAY CONSECUTIVE WORKING WARNING TAB ===== */}
      {activeMainTab === 'consecutive' && consecutiveWarnings.length > 0 && (
        <div className="consecutive-container">
          <div className="consecutive-header">
            <div className="consecutive-header-info">
              <FiAlertCircle className="consecutive-icon warning" />
              <div>
                <h3>⚠️ 7th Consecutive Working Day Warning</h3>
                <p>These employees are working on their 7th consecutive day. Additional payment approval is required before payroll processing.</p>
              </div>
            </div>
            <button className="refresh-btn" onClick={() => { 
              const warnings = detectConsecutiveDays(mobileAttendance);
              setConsecutiveWarnings(warnings);
              showNotificationMessage(`Found ${warnings.length} warnings`, 'info');
            }}>
              <FiRefreshCw /> Recheck
            </button>
          </div>

          <div className="consecutive-stats">
            <div className="consecutive-stat">
              <span className="stat-value">{consecutiveWarnings.length}</span>
              <span className="stat-label">Employees Affected</span>
            </div>
            <div className="consecutive-stat">
              <span className="stat-value">{consecutiveWarnings.reduce((sum, w) => sum + w.consecutive_days, 0)}</span>
              <span className="stat-label">Total Consecutive Days</span>
            </div>
          </div>

          <div className="consecutive-table-wrapper">
            <table className="consecutive-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Consecutive Days</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consecutiveWarnings.map((warning, index) => (
                  <tr key={index}>
                    <td>
                      <div className="employee-cell">
                        <span className="employee-name">{warning.employee_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="consecutive-days-badge">{warning.consecutive_days} days</span>
                    </td>
                    <td>{formatDate(warning.start_date)}</td>
                    <td>{formatDate(warning.end_date)}</td>
                    <td>
                      <span className="status-badge warning">Needs Review</span>
                    </td>
                    <td>
                      <button 
                        className="action-btn view" 
                        onClick={() => {
                          setSelectedConsecutiveWarning(warning);
                          setShowConsecutiveModal(true);
                        }}
                      >
                        <FiEye /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CONSECUTIVE DAYS DETAIL MODAL ===== */}
      {showConsecutiveModal && selectedConsecutiveWarning && (
        <div className="modal-overlay" onClick={() => setShowConsecutiveModal(false)}>
          <div className="modal-content consecutive-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiAlertCircle style={{ color: '#e74c3c' }} /> 7th Day Consecutive Working</h2>
              <button className="close-modal" onClick={() => setShowConsecutiveModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              <div className="consecutive-warning-box">
                <FiAlertCircle className="warning-icon" />
                <div>
                  <p><strong>{selectedConsecutiveWarning.employee_name}</strong> is working on their <strong>{selectedConsecutiveWarning.consecutive_days}th consecutive day</strong>.</p>
                  <p className="small-text">Period: {formatDate(selectedConsecutiveWarning.start_date)} - {formatDate(selectedConsecutiveWarning.end_date)}</p>
                </div>
              </div>

              <div className="consecutive-records">
                <h4>Attendance Records During This Period</h4>
                <table className="attendance-table formal">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedConsecutiveWarning.records.map((record, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(record.timestamp || record.date)}</td>
                        <td>
                          <span className={`attendance-type ${record.type === 'IN' ? 'check-in' : 'check-out'}`}>
                            {record.type === 'IN' ? 'Time In' : 'Time Out'}
                          </span>
                        </td>
                        <td>{formatTime(record.timestamp)}</td>
                        <td>
                          <span className={`verification-status ${record.verification_status || 'pending'}`}>
                            {record.verification_status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="consecutive-actions">
                <h4>Required Action</h4>
                <div className="action-box">
                  <p>⚠️ This employee must receive <strong>additional payment</strong> for working on the 7th consecutive day.</p>
                  <p className="small-text">Please ensure this is approved and included in the payroll before processing.</p>
                </div>
                <div className="approval-buttons">
                  <button className="action-btn approve" onClick={() => {
                    showNotificationMessage(`✓ 7th-day approval recorded for ${selectedConsecutiveWarning.employee_name}`, 'success');
                    setShowConsecutiveModal(false);
                  }}>
                    <FiCheckCircle /> Mark as Approved
                  </button>
                  <button className="action-btn view" onClick={() => {
                    showNotificationMessage(`📋 Reviewing ${selectedConsecutiveWarning.employee_name}'s records...`, 'info');
                  }}>
                    <FiEye /> Review Records
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowConsecutiveModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DECLINE MODAL ===== */}
      {showDeclineModal && selectedRecordForDecline && (
        <div className="modal-overlay" onClick={() => setShowDeclineModal(false)}>
          <div className="modal-content decline-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Decline Attendance Record</h2>
              <button className="close-modal" onClick={() => setShowDeclineModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              <p>Please provide a reason for declining <strong>{selectedRecordForDecline.employee_name}</strong>'s attendance on <strong>{selectedRecordForDecline.formatted_date}</strong>.</p>
              <textarea className="decline-reason-input" rows={4} placeholder="Enter decline reason..." value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowDeclineModal(false)}>Cancel</button>
              <button className="modal-btn danger" onClick={handleDeclineRecord} disabled={submitting || !declineReason.trim()}>
                {submitting ? 'Processing...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ===== APPROVE NOTES MODAL ===== */}
      {showApproveNotesModal && selectedRecordForApprove && (
        <div className="modal-overlay" onClick={() => setShowApproveNotesModal(false)}>
          <div className="modal-content approve-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approve & Add to Payroll</h2>
              <button className="close-modal" onClick={() => setShowApproveNotesModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              <div className="record-summary">
                <div className="summary-row"><span>Employee:</span><strong>{selectedRecordForApprove.employee_name}</strong></div>
                <div className="summary-row"><span>Date:</span><strong>{selectedRecordForApprove.formatted_date}</strong></div>
                <div className="summary-row"><span>Total Hours:</span><strong>{selectedRecordForApprove.formatted_total_hours}</strong></div>
                <div className="summary-row"><span>Regular Hours:</span><span>{selectedRecordForApprove.regular_hours}h</span></div>
                <div className="summary-row"><span>Overtime Hours:</span><span className={selectedRecordForApprove.overtime_hours > 0 ? 'overtime' : ''}>{selectedRecordForApprove.overtime_hours}h</span></div>
                <div className="summary-row"><span>Late Minutes:</span><span className={selectedRecordForApprove.late_minutes > 0 ? 'warning' : ''}>{selectedRecordForApprove.late_minutes}min</span></div>
                <div className="summary-row"><span>Undertime Minutes:</span><span className={selectedRecordForApprove.undertime_minutes > 0 ? 'warning' : ''}>{selectedRecordForApprove.undertime_minutes}min</span></div>
              </div>
              
              {selectedRecordForApprove.overtime_hours > 0 && (
                <div className="overtime-notice">
                  <FiAlertCircle />
                  <span>This record has {selectedRecordForApprove.overtime_hours} hours of overtime. You will be prompted to confirm.</span>
                </div>
              )}
              
              <textarea 
                className="notes-input" 
                rows={3} 
                placeholder="Add approval notes (optional)..." 
                value={approveNotes} 
                onChange={(e) => setApproveNotes(e.target.value)} 
              />
              <div className="info-message">
                <FiAlertCircle />
                <span>This will create a payroll record for this employee. The action cannot be automatically reversed.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowApproveNotesModal(false)}>Cancel</button>
              <button className="modal-btn success" onClick={() => handleApproveRecord(selectedRecordForApprove, false)} disabled={submitting}>
                {submitting ? 'Processing...' : 'Proceed to Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== OVERTIME CONFIRMATION MODAL ===== */}
      {showOvertimeConfirmModal && selectedRecordForApprove && selectedRecordForApprove.overtime_hours > 0 && (
        <div className="modal-overlay" onClick={() => setShowOvertimeConfirmModal(false)}>
          <div className="modal-content overtime-modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiAlertTriangle style={{ color: '#f39c12' }} /> Overtime Confirmation Required</h2>
              <button className="close-modal" onClick={() => setShowOvertimeConfirmModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              <div className="overtime-warning">
                <FiAlertCircle className="warning-icon" />
                <p>This record has <strong>{selectedRecordForApprove.overtime_hours} hours</strong> of overtime.</p>
                <p className="small-text">Please choose how you want to handle the overtime:</p>
              </div>
              
              <div className="record-summary">
                <div className="summary-row"><span>Employee:</span><strong>{selectedRecordForApprove.employee_name}</strong></div>
                <div className="summary-row"><span>Date:</span><strong>{selectedRecordForApprove.formatted_date}</strong></div>
                <div className="summary-row"><span>Total Hours Worked:</span><strong>{selectedRecordForApprove.formatted_total_hours}</strong></div>
                <div className="summary-row"><span>Regular Hours:</span><span>{selectedRecordForApprove.regular_hours}h</span></div>
                <div className="summary-row"><span>Overtime Hours:</span><span className="overtime">{selectedRecordForApprove.overtime_hours}h</span></div>
              </div>

              {/* Overtime Options */}
              <div className="overtime-options">
                <h4>Overtime Handling Options:</h4>
                
                <label className={`overtime-option ${overtimeAction === 'approve_all' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="overtimeAction" 
                    value="approve_all"
                    checked={overtimeAction === 'approve_all'}
                    onChange={() => setOvertimeAction('approve_all')}
                  />
                  <div className="option-content">
                    <strong>✅ Approve All Overtime</strong>
                    <span className="option-detail">Approve all {selectedRecordForApprove.overtime_hours} overtime hours. Employee will receive 1.5x pay for overtime.</span>
                  </div>
                </label>

                <label className={`overtime-option ${overtimeAction === 'approve_partial' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="overtimeAction" 
                    value="approve_partial"
                    checked={overtimeAction === 'approve_partial'}
                    onChange={() => setOvertimeAction('approve_partial')}
                  />
                  <div className="option-content">
                    <strong>✏️ Approve Partial Overtime</strong>
                    <span className="option-detail">Approve only a portion of the overtime hours.</span>
                    <div className="partial-hours-input">
                      <label>Hours to approve:</label>
                      <input 
                        type="number" 
                        step="0.5" 
                        min="0" 
                        max={selectedRecordForApprove.overtime_hours}
                        value={selectedOvertimeHours}
                        onChange={(e) => setSelectedOvertimeHours(parseFloat(e.target.value) || 0)}
                        className="partial-hours-field"
                        disabled={overtimeAction !== 'approve_partial'}
                      />
                      <span className="max-hint">Max: {selectedRecordForApprove.overtime_hours} hours</span>
                    </div>
                  </div>
                </label>

                <label className={`overtime-option ${overtimeAction === 'remove' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="overtimeAction" 
                    value="remove"
                    checked={overtimeAction === 'remove'}
                    onChange={() => setOvertimeAction('remove')}
                  />
                  <div className="option-content">
                    <strong>❌ Remove Overtime</strong>
                    <span className="option-detail">Remove overtime hours and approve only regular hours. Employee will NOT receive overtime pay.</span>
                  </div>
                </label>

                <label className={`overtime-option ${overtimeAction === 'decline_record' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="overtimeAction" 
                    value="decline_record"
                    checked={overtimeAction === 'decline_record'}
                    onChange={() => setOvertimeAction('decline_record')}
                  />
                  <div className="option-content">
                    <strong>⛔ Decline Entire Record</strong>
                    <span className="option-detail">Decline this attendance record. It will NOT be included in payroll.</span>
                  </div>
                </label>
              </div>

              <div className="form-group">
                <label>Reason / Justification <span className="required">*</span></label>
                <textarea 
                  className="overtime-reason-input" 
                  rows={3} 
                  placeholder="Please provide a reason for your decision..."
                  value={overtimeReason}
                  onChange={(e) => setOvertimeReason(e.target.value)}
                />
              </div>

              <div className="overtime-preview">
                <h4>Preview of Changes:</h4>
                {(overtimeAction === 'approve_all' || (overtimeAction === 'approve_partial' && selectedOvertimeHours > 0)) && (
                  <div className="preview-content">
                    <p>✅ Record will be <strong>APPROVED</strong></p>
                    <p>Overtime hours: <strong>{overtimeAction === 'approve_partial' ? selectedOvertimeHours : selectedRecordForApprove.overtime_hours} hours</strong></p>
                    <p>Overtime pay: <strong>₱{((selectedRecordForApprove.hourly_rate || 500) * (overtimeAction === 'approve_partial' ? selectedOvertimeHours : selectedRecordForApprove.overtime_hours) * 1.5).toLocaleString()}</strong></p>
                  </div>
                )}
                {overtimeAction === 'remove' && (
                  <div className="preview-content remove">
                    <p>⭕ Record will be <strong>APPROVED</strong> (overtime removed)</p>
                    <p>Overtime hours: <strong>0 hours</strong> (removed {selectedRecordForApprove.overtime_hours}h)</p>
                    <p>Overtime pay: <strong>₱0.00</strong></p>
                  </div>
                )}
                {overtimeAction === 'decline_record' && (
                  <div className="preview-content decline">
                    <p>⛔ Record will be <strong>DECLINED</strong></p>
                    <p>Not included in payroll</p>
                  </div>
                )}
                {(overtimeAction === 'approve_partial' && selectedOvertimeHours === 0) && (
                  <div className="preview-content warning">
                    <p>⚠️ Please enter overtime hours to approve</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowOvertimeConfirmModal(false)}>Cancel</button>
              <button 
                className="modal-btn success" 
                onClick={async () => {
                  if (!overtimeReason.trim()) {
                    showNotificationMessage('Please provide a reason for your decision', 'warning');
                    return;
                  }
                  
                  let approvedHours = selectedRecordForApprove?.overtime_hours || 0;
                  let finalAction = overtimeAction;
                  
                  if (overtimeAction === 'approve_partial') {
                    if (selectedOvertimeHours <= 0) {
                      showNotificationMessage('Please enter valid overtime hours to approve', 'warning');
                      return;
                    }
                    if (selectedOvertimeHours > (selectedRecordForApprove?.overtime_hours || 0)) {
                      showNotificationMessage(`Cannot approve more than ${selectedRecordForApprove?.overtime_hours} hours`, 'warning');
                      return;
                    }
                    approvedHours = selectedOvertimeHours;
                  }
                  
                  if (overtimeAction === 'remove') {
                    finalAction = 'remove_overtime';
                  }
                  
                  if (overtimeAction === 'decline_record') {
                    setSubmitting(true);
                    try {
                      const result = await declineRecordMutation.mutateAsync({ 
                        recordId: selectedRecordForApprove.id, 
                        reason: overtimeReason || 'Overtime not approved'
                      });
                      if (result?.success) {
                        showNotificationMessage(`Record declined for ${selectedRecordForApprove.employee_name}`, 'info');
                        setShowOvertimeConfirmModal(false);
                        setSelectedRecordForApprove(null);
                        setOvertimeReason('');
                        setSelectedOvertimeHours(0);
                        setOvertimeAction('approve_all');
                        await refetchStatusPanel();
                        await refetchStatusPanelSummary();
                      }
                    } catch (error) {
                      showNotificationMessage('Failed to decline record', 'error');
                    } finally {
                      setSubmitting(false);
                    }
                    return;
                  }
                  
                  setSubmitting(true);
                  try {
                    const result = await approveRecordMutation.mutateAsync({
                      recordId: selectedRecordForApprove.id,
                      notes: approveNotes,
                      overtimeConfirmed: (finalAction !== 'remove_overtime'),
                      removeOvertime: (finalAction === 'remove_overtime'),
                      overtimeReason: overtimeReason,
                      approvedOvertimeHours: approvedHours
                    });
                    
                    if (result?.success) {
                      let message = `✓ Record approved for ${selectedRecordForApprove.employee_name}`;
                      if (finalAction === 'remove_overtime') {
                        message += ` with overtime removed`;
                      } else if (overtimeAction === 'approve_partial') {
                        message += ` with ${approvedHours}h overtime approved (out of ${selectedRecordForApprove.overtime_hours}h)`;
                      } else {
                        message += ` with ${approvedHours}h overtime approved`;
                      }
                      showNotificationMessage(message, 'success');
                      setShowOvertimeConfirmModal(false);
                      setShowApproveNotesModal(false);
                      setApproveNotes('');
                      setOvertimeReason('');
                      setSelectedOvertimeHours(0);
                      setOvertimeAction('approve_all');
                      setSelectedRecordForApprove(null);
                      setStatusPanelPage(1);
                      await refetchStatusPanel();
                      await refetchStatusPanelSummary();
                    } else if (result?.requires_overtime_confirmation) {
                      showNotificationMessage('Please handle overtime before approving', 'warning');
                    } else {
                      showNotificationMessage(result?.message || 'Failed to approve record', 'error');
                    }
                  } catch (error) {
                    console.error('Approve error:', error);
                    showNotificationMessage('Failed to approve record', 'error');
                  } finally {
                    setSubmitting(false);
                  }
                }} 
                disabled={submitting || !overtimeReason.trim() || (overtimeAction === 'approve_partial' && selectedOvertimeHours <= 0)}
              >
                {submitting ? 'Processing...' : 'Confirm & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BULK APPROVE MODAL ===== */}
      {showBulkApproveModal && (
        <div className="modal-overlay" onClick={() => setShowBulkApproveModal(false)}>
          <div className="modal-content bulk-approve-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk Approval Confirmation</h2>
              <button className="close-modal" onClick={() => setShowBulkApproveModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              <div className="bulk-warning">
                <FiAlertCircle className="warning-icon" />
                <p>You are about to approve <strong>{selectedRecords.length} records</strong>.</p>
                <p className="note">Some records contain overtime hours. Please confirm below.</p>
              </div>
              
              <div className="form-group">
                <label>Approval Notes (Optional)</label>
                <textarea 
                  className="notes-input" 
                  rows={2} 
                  placeholder="Add notes for all approved records..."
                  value={bulkApproveNotes}
                  onChange={(e) => setBulkApproveNotes(e.target.value)}
                />
              </div>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={bulkOvertimeConfirmed}
                    onChange={(e) => setBulkOvertimeConfirmed(e.target.checked)}
                  />
                  <span>I confirm that all overtime in these records is valid and approved</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowBulkApproveModal(false)}>Cancel</button>
              <button className="modal-btn success" onClick={processBulkApprove} disabled={submitting || !bulkOvertimeConfirmed}>
                {submitting ? 'Processing...' : `Confirm & Approve ${selectedRecords.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== UNSCHEDULED APPROVAL MODAL ===== */}
      {showUnscheduledModal && selectedUnscheduledRecord && (
        <div className="modal-overlay" onClick={() => setShowUnscheduledModal(false)}>
          <div className="modal-content unscheduled-approve-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiAlertTriangle /> Approve Unscheduled Attendance</h2>
              <button className="close-modal" onClick={() => setShowUnscheduledModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              <div className="unscheduled-warning">
                <FiAlertCircle className="warning-icon" />
                <p>This employee did not have a scheduled shift for this time.</p>
              </div>
              
              <div className="record-summary">
                <div className="summary-row"><span>Employee:</span><strong>{selectedUnscheduledRecord.employee_name}</strong></div>
                <div className="summary-row"><span>Date:</span><strong>{formatDate(selectedUnscheduledRecord.timestamp)}</strong></div>
                <div className="summary-row"><span>Time:</span><strong>{formatTime(selectedUnscheduledRecord.timestamp)}</strong></div>
                <div className="summary-row"><span>Type:</span><strong>{selectedUnscheduledRecord.type === 'IN' ? 'Time In' : 'Time Out'}</strong></div>
                <div className="summary-row"><span>Validation Message:</span><span className="warning">{selectedUnscheduledRecord.validation_message}</span></div>
              </div>
              
              {selectedUnscheduledRecord.selfie_url && (
                <div className="selfie-preview-section">
                  <label>Selfie Verification</label>
                  <img 
                    src={selectedUnscheduledRecord.selfie_url} 
                    alt="Attendance Selfie" 
                    className="selfie-preview"
                    onClick={() => handleViewSelfie(selectedUnscheduledRecord.selfie_url)}
                  />
                  <button className="view-full-selfie" onClick={() => handleViewSelfie(selectedUnscheduledRecord.selfie_url)}>
                    <FiEye /> View Full Size
                  </button>
                </div>
              )}
              
              <div className="form-group">
                <label>Admin Notes (Optional)</label>
                <textarea 
                  className="notes-input" 
                  rows={3} 
                  placeholder="Add notes about why this unscheduled attendance is being approved..."
                  value={unscheduledApprovalNote}
                  onChange={(e) => setUnscheduledApprovalNote(e.target.value)}
                />
              </div>
              
              <div className="info-message">
                <FiAlertCircle />
                <span>Approving this record will mark it as verified. If both time-in and time-out are approved, a daily attendance record will be created for payroll.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowUnscheduledModal(false)}>Cancel</button>
              <button 
                className="modal-btn success" 
                onClick={() => approveUnscheduledRecord(selectedUnscheduledRecord.id, unscheduledApprovalNote)} 
                disabled={submitting}
              >
                {submitting ? 'Processing...' : '✓ Approve Unscheduled Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ATTENDANCE DETAILS MODAL ===== */}
      {showAttendanceModal && selectedAttendance && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal-content attendance-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance Details</h2>
              <button className="close-modal" onClick={() => setShowAttendanceModal(false)}><FiXIcon /></button>
            </div>
            <div className="modal-body">
              {selectedAttendance.selfie_url && (
                <div className="selfie-preview">
                  <img src={selectedAttendance.selfie_url} alt="Attendance Selfie" />
                  <button className="view-full-selfie" onClick={() => handleViewSelfie(selectedAttendance.selfie_url)}>View Full Size</button>
                </div>
              )}
              <div className="details-grid">
                <div className="detail-item"><span className="detail-label">Employee</span><span className="detail-value">{selectedAttendance.employee_name}</span></div>
                <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{formatDate(selectedAttendance.timestamp)}</span></div>
                <div className="detail-item"><span className="detail-label">Time</span><span className="detail-value">{formatTime(selectedAttendance.timestamp)}</span></div>
                <div className="detail-item"><span className="detail-label">Type</span><span className="detail-value">{selectedAttendance.type === 'IN' ? 'Time In' : 'Time Out'}</span></div>
                <div className="detail-item"><span className="detail-label">Face Verified</span><span className="detail-value">{selectedAttendance.face_verified ? 'Yes' : 'No'}</span></div>
                <div className="detail-item"><span className="detail-label">Liveness Checked</span><span className="detail-value">{selectedAttendance.liveness_checked ? 'Yes' : 'No'}</span></div>
                <div className="detail-item"><span className="detail-label">Device Info</span><span className="detail-value">{selectedAttendance.device_info || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">IP Address</span><span className="detail-value">{selectedAttendance.ip_address || 'N/A'}</span></div>
                {selectedAttendance.location && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">Lat: {selectedAttendance.location.lat}, Lng: {selectedAttendance.location.lng}</span>
                  </div>
                )}
                <div className="detail-item full-width">
                  <span className="detail-label">Verification Status</span>
                  <span className={`verification-status ${selectedAttendance.verification_status}`}>{selectedAttendance.verification_status || 'Pending'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {selectedAttendance.verification_status === 'pending' && (
                <>
                  <button className="modal-btn success" onClick={() => { handleVerifyAttendance(selectedAttendance.id, 'verified'); setShowAttendanceModal(false); }} disabled={submitting}>
                    <FiCheck /> Verify & Move to Status Panel
                  </button>
                  <button className="modal-btn danger" onClick={() => { handleVerifyAttendance(selectedAttendance.id, 'rejected'); setShowAttendanceModal(false); }} disabled={submitting}>
                    <FiXIcon /> Reject
                  </button>
                </>
              )}
              <button className="modal-btn secondary" onClick={() => setShowAttendanceModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff_Attendance;