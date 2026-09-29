// src/components/Staff/StaffAttendancePage.jsx - v16 FINAL
// -----------------------------------------------------------------------------
// v16 additions (builds on v15):
//   #6  Scheduled-but-no-attendance records are auto-tagged AWOL by the backend
//       (materializeScheduledAbsences). The UI now renders attendance_flag_label
//       on every record and in the Employee Overview insight strip.
//   #7  Insight counters per employee for the selected cutoff:
//       AWOL, Emergency Absent (EA), On Leave, Late In, Present Days.
//   #9  New "Flag" action on each record inside Attendance Records modal.
//       Modal supports AWOL / Emergency Absent / On Leave / Late In / Clear.
//
// v15 behaviour preserved:
//   - Per-side verify/reject/un-reject that persists across refetches.
//   - Every side has its own buttons — no auto-approve of the other side.
//   - Employee Overview only reloads on period change / explicit refresh.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import '../styles/StaffAttendance.css';

import {
  useMobileAttendance,
  useAttendanceStatistics,
  useStatusPanel,
  useStatusPanelSummary,
  useEmployeesList,
  useDepartmentsList,
  useUpdateAttendanceStatus,
  useUnverifyAttendance,
  expandAttendanceLogs,
  normalizeAttendanceLog,
  patchEmployeeRecordInPlace,
} from '../../../hooks/useAttendanceQueries';

import api from '../../../services/api';

import {
  FiUsers, FiClock, FiCalendar, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiSearch, FiFilter, FiEye, FiDownload, FiRefreshCw, FiChevronLeft,
  FiChevronRight, FiUserCheck, FiLogOut, FiMapPin,
  FiCalendar as FiCalendarIcon, FiArchive, FiList, FiCheck,
  FiThumbsUp, FiThumbsDown, FiRotateCcw, FiSliders, FiBell, FiBellOff,
  FiAlertTriangle, FiFileText, FiSave, FiEdit2,
  FiPlus, FiMoreVertical, FiSettings, FiPrinter, FiX, FiEdit,
  FiLock, FiChevronDown, FiInfo, FiArrowRight, FiFlag
} from 'react-icons/fi';
import { FiXCircle as FiXIcon } from 'react-icons/fi';
import { BsCameraFill } from 'react-icons/bs';

// ==================== HELPERS ====================
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid Time';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
};

const extractApiList = (payload) => {
  const body = payload?.data ?? payload;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  if (Array.isArray(body?.data?.data?.data)) return body.data.data.data;
  return [];
};

const unwrapEmployeeOverviewPayload = (response) => response?.data?.data ?? response?.data ?? response ?? {};
const toEmployeeOverviewArray = (value) => (Array.isArray(value) ? value : []);

const toDateInputValue = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDecimalHours = (value) => `${Number(value || 0).toFixed(2)}h`;

const formatPeso = (value) => {
  const num = Number(value || 0);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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

const getApiErrorMessage = (error, fallback = 'Request failed') => {
  const errors = error?.response?.data?.errors;
  const firstError = errors ? Object.values(errors).flat().find(Boolean) : null;
  return error?.response?.data?.message || firstError || error?.message || fallback;
};

const getCutoffDates = (year, month, period) => {
  if (period === 'first') return { start: new Date(year, month, 1), end: new Date(year, month, 15, 23, 59, 59) };
  return { start: new Date(year, month, 16), end: new Date(year, month + 1, 0, 23, 59, 59) };
};

const isCutoffReached = (year, month, period) => new Date() >= getCutoffDates(year, month, period).end;

const formatCutoffRange = (year, month, period) => {
  const d = getCutoffDates(year, month, period);
  const endDay = d.end.getDate();
  const monthName = d.start.toLocaleString('default', { month: 'long' });
  return period === 'first' ? `${monthName} 1-15, ${year}` : `${monthName} 16-${endDay}, ${year}`;
};

const isWithinCutoff = (record, cutoffStart, cutoffEnd) => {
  const raw = record?.attendance_date || record?.date;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return d >= cutoffStart && d <= cutoffEnd;
};

// ---------- "No Duty" detection ----------
const isAbsentOrNonWorking = (rec) => {
  if (!rec) return false;

  const state = String(rec?.attendance_state || '').toLowerCase().trim();
  const status = String(rec?.status || '').toLowerCase().trim();
  const schedule = String(rec?.assigned_schedule || '').toLowerCase().trim();
  const formattedIn = String(rec?.formatted_time_in || '').toLowerCase().trim();
  const formattedOut = String(rec?.formatted_time_out || '').toLowerCase().trim();

  if (
    status === 'absent' ||
    status === 'rest_day' ||
    status === 'rest day' ||
    status === 'no_duty' ||
    status === 'no duty' ||
    state === 'absent' ||
    state === 'rest day' ||
    state === 'rest_day' ||
    state === 'no schedule' ||
    state === 'no_schedule' ||
    state === 'no duty' ||
    state === 'no_duty'
  ) {
    return true;
  }

  const hasTimeIn = rec?.time_in && rec.time_in !== '' && rec.time_in !== null;
  const hasTimeOut = rec?.time_out && rec.time_out !== '' && rec.time_out !== null;

  if (!hasTimeIn && !hasTimeOut) {
    const noSchedule =
      !schedule ||
      schedule === 'unscheduled' ||
      schedule === '—' ||
      schedule === 'n/a' ||
      schedule === '-';

    const zeroHours =
      Number(rec?.regular_hours || 0) === 0 &&
      Number(rec?.overtime_hours || 0) === 0 &&
      Number(rec?.undertime_hours || 0) === 0;

    if (noSchedule || zeroHours) return true;
  }

  const backendSaysNoIn = formattedIn === 'no time in' || formattedIn === '';
  const backendSaysNoOut = formattedOut === 'no time out' || formattedOut === '';

  if (backendSaysNoIn && backendSaysNoOut && (!schedule || schedule === 'unscheduled')) {
    return true;
  }

  return false;
};

const isUnresolvedRecord = (rec) => {
  if (!rec) return false;
  if (rec.payroll_ready || rec.payroll_ready_at) return false;
  return true;
};

const hasAnyAttendanceSignal = (rec) => {
  const hasSchedule = rec?.assigned_schedule && rec.assigned_schedule !== 'Unscheduled';
  const hasTimeIn = rec?.time_in && rec.time_in !== '';
  const hasTimeOut = rec?.time_out && rec.time_out !== '';
  return Boolean(hasSchedule || hasTimeIn || hasTimeOut);
};

// ============================================================================
// PERSISTENT PER-SIDE STATUS STORE (localStorage-backed)
// ============================================================================

const SIDE_STATUS_STORAGE_KEY = 'attendance_side_status_v1';

const loadSideStatusMap = () => {
  try {
    const raw = localStorage.getItem(SIDE_STATUS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const persistSideStatusMap = (map) => {
  try {
    localStorage.setItem(SIDE_STATUS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
};
// ==================== SKELETONS (Dashboard-style) ====================

// Base building blocks
const SkeletonText = ({ width = '100%', height = 14, className = '', style = {} }) => (
  <div className={`att-skeleton-text ${className}`} style={{ width, height, ...style }} />
);

const SkeletonCircle = ({ size = 48, className = '', style = {} }) => (
  <div
    className={`att-skeleton-circle ${className}`}
    style={{ width: size, height: size, minWidth: size, ...style }}
  />
);

// Attendance Records table skeleton
const SkeletonTable = () => (
  <div className="att-skeleton-table-container">
    <div className="att-skeleton-table-header">
      {['Date & Time', 'Employee', 'Type', 'Selfie', 'Status', 'Actions'].map((h, i) => (
        <div key={h} className="att-skeleton-header-cell" style={{ animationDelay: `${i * 0.05}s` }}>
          <SkeletonText width="70%" height={11} />
        </div>
      ))}
    </div>
    <div className="att-skeleton-table-body">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="att-skeleton-row" style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="att-skeleton-cell">
            <SkeletonText width="80%" height={12} />
            <SkeletonText width="55%" height={10} style={{ marginTop: 4 }} />
          </div>
          <div className="att-skeleton-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SkeletonCircle size={28} />
            <div style={{ flex: 1 }}>
              <SkeletonText width="70%" height={12} />
              <SkeletonText width="45%" height={10} style={{ marginTop: 4 }} />
            </div>
          </div>
          <div className="att-skeleton-cell">
            <div className="att-skeleton-pill" />
          </div>
          <div className="att-skeleton-cell">
            <div className="att-skeleton-pill att-skeleton-pill-sm" />
          </div>
          <div className="att-skeleton-cell">
            <div className="att-skeleton-pill" />
          </div>
          <div className="att-skeleton-cell" style={{ display: 'flex', gap: 6 }}>
            <SkeletonCircle size={28} style={{ borderRadius: 8 }} />
            <SkeletonCircle size={28} style={{ borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Employee Overview (Status Panel) skeleton — avatar + varied bars
const SkeletonStatusPanelTable = () => {
  const rowWidths = [
    [140, 90, 110, 80, 70, 100],
    [120, 80, 130, 90, 60, 95],
    [150, 95, 105, 75, 75, 110],
    [130, 85, 120, 85, 65, 90],
    [145, 90, 100, 80, 70, 105],
  ];

  return (
    <div className="att-skeleton-table-container">
      <div className="att-skeleton-table-header att-skeleton-header-10">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="att-skeleton-header-cell" style={{ animationDelay: `${i * 0.04}s` }}>
            <SkeletonText width="65%" height={11} />
          </div>
        ))}
      </div>
      <div className="att-skeleton-table-body">
        {[...Array(5)].map((_, i) => {
          const widths = rowWidths[i % rowWidths.length];
          return (
            <div key={i} className="att-skeleton-status-row" style={{ animationDelay: `${i * 0.06}s` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SkeletonCircle size={34} />
                <div style={{ flex: 1 }}>
                  <SkeletonText width={widths[0]} height={12} />
                  <SkeletonText width={widths[1]} height={10} style={{ marginTop: 4 }} />
                </div>
              </div>
              <SkeletonText width={widths[2]} height={12} />
              <SkeletonText width={widths[3]} height={12} />
              <SkeletonText width={widths[4]} height={12} />
              <div className="att-skeleton-pill" />
              <div className="att-skeleton-pill att-skeleton-pill-sm" />
              <div style={{ display: 'flex', gap: 6 }}>
                <SkeletonCircle size={28} style={{ borderRadius: 8 }} />
                <SkeletonCircle size={28} style={{ borderRadius: 8 }} />
                <SkeletonCircle size={28} style={{ borderRadius: 8 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== PAGE-WIDE SKELETON (pixel-matched to real UI) ====================
const AttendancePageSkeleton = () => {
  const isDark = (() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.body.classList.contains('dark-mode');
  })();

  return (
    <div className={`attendance-container att-sk-container ${isDark ? 'att-dark-mode' : ''}`}>
      <div className="att-sk-inner">

        {/* ===== HEADER (matches .attendance-header) ===== */}
        <div className="att-sk-card att-sk-header-block" style={{ animationDelay: '0s' }}>
          <div className="att-sk-header-left">
            <div className="att-skeleton-circle att-sk-header-icon" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="att-skeleton-text" style={{ width: 200, height: 18 }} />
              <div className="att-skeleton-text" style={{ width: 320, height: 10 }} />
            </div>
          </div>
          <div className="att-sk-header-actions">
            <div className="att-skeleton-circle att-sk-action-btn" />
            <div className="att-skeleton-circle att-sk-action-btn" />
            <div className="att-skeleton-circle att-sk-action-btn" />
          </div>
        </div>

        {/* ===== TABS (matches .main-tabs) ===== */}
        <div className="att-sk-card att-sk-tabs-block" style={{ animationDelay: '0.05s' }}>
          <div className="att-skeleton-text att-sk-tab-pill" style={{ width: 155 }} />
          <div className="att-skeleton-text att-sk-tab-pill" style={{ width: 155 }} />
          <div className="att-skeleton-text att-sk-tab-pill" style={{ width: 125 }} />
        </div>

        {/* ===== CUTOFF SELECTOR (matches .cutoff-selector) ===== */}
        <div className="att-sk-card att-sk-cutoff-block" style={{ animationDelay: '0.10s' }}>
          <div className="att-sk-cutoff-left">
            <div className="att-skeleton-text" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="att-skeleton-text" style={{ width: 110, height: 10 }} />
              <div className="att-skeleton-text" style={{ width: 180, height: 15 }} />
            </div>
          </div>
          <div className="att-sk-cutoff-right">
            <div className="att-skeleton-text" style={{ width: 130, height: 34, borderRadius: 8 }} />
            <div className="att-skeleton-text" style={{ width: 130, height: 34, borderRadius: 8 }} />
            <div className="att-skeleton-text" style={{ width: 190, height: 34, borderRadius: 8 }} />
          </div>
        </div>

        {/* ===== KPI CARDS (6 across, matches .attendance-insights-grid) ===== */}
        <div className="att-sk-kpi-grid">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="att-sk-card att-sk-kpi-card"
              style={{ animationDelay: `${0.15 + i * 0.05}s` }}
            >
              <div className="att-skeleton-circle att-sk-kpi-icon" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div className="att-skeleton-text" style={{ width: 55, height: 22 }} />
                <div className="att-skeleton-text" style={{ width: 90, height: 10 }} />
              </div>
            </div>
          ))}
        </div>

        {/* ===== SEARCH BAR (matches .search-filter-bar) ===== */}
        <div className="att-sk-card att-sk-search-block" style={{ animationDelay: '0.35s' }}>
          <div className="att-skeleton-text" style={{ width: '100%', height: 44, borderRadius: 8 }} />
          <div className="att-skeleton-text" style={{ width: 90, height: 44, borderRadius: 8 }} />
        </div>

        {/* ===== TABLE (matches .attendance-table.formal) ===== */}
        <div className="att-sk-card att-sk-table-block" style={{ animationDelay: '0.40s' }}>
          {/* Header row */}
          <div className="att-sk-table-header">
            <div className="att-skeleton-text" style={{ width: 80, height: 10 }} />
            <div className="att-skeleton-text" style={{ width: 70, height: 10 }} />
            <div className="att-skeleton-text" style={{ width: 45, height: 10 }} />
            <div className="att-skeleton-text" style={{ width: 50, height: 10 }} />
            <div className="att-skeleton-text" style={{ width: 55, height: 10 }} />
            <div className="att-skeleton-text" style={{ width: 60, height: 10, marginLeft: 'auto' }} />
          </div>

          {/* Body rows — mirror the real row structure */}
          <div className="att-sk-table-body">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="att-sk-table-row"
                style={{ animationDelay: `${0.45 + i * 0.05}s` }}
              >
                {/* Date & Time — 2 lines */}
                <div className="att-sk-col-date">
                  <div className="att-skeleton-text" style={{ width: 85, height: 12 }} />
                  <div className="att-skeleton-text" style={{ width: 60, height: 10, marginTop: 6 }} />
                </div>

                {/* Employee — name + code */}
                <div className="att-sk-col-employee">
                  <div className="att-skeleton-text" style={{ width: 105, height: 12 }} />
                  <div className="att-skeleton-text" style={{ width: 55, height: 10, marginTop: 6 }} />
                </div>

                {/* Type — pill */}
                <div className="att-sk-col-type">
                  <div className="att-skeleton-pill" />
                </div>

                {/* Selfie — text like "No selfie" */}
                <div className="att-sk-col-selfie">
                  <div className="att-skeleton-text" style={{ width: 62, height: 12 }} />
                </div>

                {/* Status — pill with icon */}
                <div className="att-sk-col-status">
                  <div className="att-skeleton-pill att-skeleton-pill-wide" />
                </div>

                {/* Actions — 2 buttons aligned right */}
                <div className="att-sk-col-actions">
                  <div className="att-skeleton-circle att-sk-action-icon" />
                  <div className="att-skeleton-circle att-sk-action-icon" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== STATUS HELPERS ====================
const getAttendanceStatus = (schedule, attendance) => {
  if (!schedule && !attendance) return { status: 'REST_DAY', label: 'Rest Day', severity: 'info' };
  if (schedule && !attendance) return { status: 'AWOL', label: 'AWOL', severity: 'warning' };
  if (!schedule && attendance) {
    const hasTimeIn = attendance.time_in && attendance.time_in !== '' && attendance.time_in !== null;
    const hasTimeOut = attendance.time_out && attendance.time_out !== '' && attendance.time_out !== null;
    if (hasTimeIn || hasTimeOut) {
      if (attendance.verification_status === 'verified' || attendance.verification_status === 'approved' || attendance.approval_status === 'approved') {
        return { status: 'APPROVED', label: 'Approved (Unscheduled)', severity: 'success' };
      }
      if (attendance.verification_status === 'rejected' || attendance.approval_status === 'rejected') {
        return { status: 'REJECTED', label: 'Rejected', severity: 'danger' };
      }
      return { status: 'UNSCHEDULED', label: 'Unscheduled', severity: 'warning' };
    }
  }
  if (schedule && attendance) {
    const hasTimeIn = attendance.time_in && attendance.time_in !== '' && attendance.time_in !== null;
    const hasTimeOut = attendance.time_out && attendance.time_out !== '' && attendance.time_out !== null;
    if (attendance.verification_status === 'rejected' || attendance.approval_status === 'rejected') {
      return { status: 'REJECTED', label: 'Rejected', severity: 'danger' };
    }
    if (attendance.verification_status === 'verified' || attendance.verification_status === 'approved' || attendance.approval_status === 'approved') {
      return { status: 'VERIFIED', label: 'Verified', severity: 'success' };
    }
    const hasSelfie = attendance.time_in_selfie_url || attendance.time_out_selfie_url || attendance.selfie_url;
    if (hasSelfie && attendance.selfie_verified !== true && attendance.verification_status !== 'verified') {
      return { status: 'UNVERIFIED', label: 'Unverified Selfie', severity: 'warning' };
    }
    if (!hasTimeIn && hasTimeOut) return { status: 'MISSING_TIME_IN', label: 'Missing Time In', severity: 'danger' };
    if (hasTimeIn && !hasTimeOut) return { status: 'MISSING_TIME_OUT', label: 'Missing Time Out', severity: 'danger' };
    if (hasTimeIn && hasTimeOut) return { status: 'PENDING', label: 'Pending Verification', severity: 'warning' };
  }
  return { status: 'INCOMPLETE', label: 'Incomplete', severity: 'warning' };
};

const getOTStatus = (recordOrHours) => {
  const record = typeof recordOrHours === 'object' && recordOrHours !== null ? recordOrHours : null;
  const otHours = record ? Number(record.overtime_hours || 0) : Number(recordOrHours || 0);

  if (record) {
    const explicitStatus = record.overtime_status || record.ot_status;
    if (explicitStatus === 'approved') return { status: 'APPROVED', label: 'OT Approved', severity: 'success' };
    if (explicitStatus === 'rejected') return { status: 'REJECTED', label: 'OT Rejected', severity: 'danger' };
    if (explicitStatus === 'not_applicable') return { status: 'NONE', label: 'No OT', severity: 'info' };
    if (record.overtime_approved === true && otHours > 0) return { status: 'APPROVED', label: 'OT Approved', severity: 'success' };
  }

  if (!otHours || otHours <= 0) return { status: 'NONE', label: 'No OT', severity: 'info' };
  return { status: 'PENDING', label: 'OT Pending Approval', severity: 'warning' };
};

const getUndertimeStatus = (recordOrHours) => {
  const record = typeof recordOrHours === 'object' && recordOrHours !== null ? recordOrHours : null;
  const utHours = record ? Number(record.undertime_hours || 0) : Number(recordOrHours || 0);

  if (record) {
    const explicitStatus = record.undertime_status || record.ut_status;
    if (explicitStatus === 'approved') return { status: 'APPROVED', label: 'UT Approved', severity: 'success' };
    if (explicitStatus === 'rejected') return { status: 'REJECTED', label: 'UT Rejected', severity: 'danger' };
    if (explicitStatus === 'not_applicable') return { status: 'NONE', label: 'No UT', severity: 'info' };
    if (record.undertime_approved === true) return { status: 'APPROVED', label: 'UT Approved', severity: 'success' };
    if (record.approval_status === 'approved' && utHours > 0) return { status: 'APPROVED', label: 'UT Reviewed', severity: 'success' };
  }

  if (!utHours || utHours <= 0) return { status: 'NONE', label: 'No UT', severity: 'info' };
  return { status: 'PENDING', label: 'UT Pending Approval', severity: 'warning' };
};

// ⭐ NEW — flag label rendering map
const getFlagStyle = (flag) => {
  switch (flag) {
    case 'awol':
      return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'AWOL' };
    case 'emergency_absent':
      return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', label: 'EA' };
    case 'on_leave':
      return { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe', label: 'Leave' };
    case 'late_in':
      return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', label: 'Late In' };
    default:
      return null;
  }
};

// ==================== PRINT HELPERS ====================
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const openPrintWindow = (html) => {
  const w = window.open('', '_blank', 'width=1200,height=800');
  if (!w) { window.alert('Please allow pop-ups to print.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

const printSavedRecords = ({ employee, summary, records, cutoffLabel, month, year, cutoff }) => {
  if (!records || records.length === 0) { window.alert('No saved records to print.'); return; }
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  const cutoffText = cutoff === 'first' ? '1 - 15' : '16 - End';
  const printedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const rowsHtml = records.map((record) => `
    <tr>
      <td>${escapeHtml(formatEmployeeOverviewDate(record.attendance_date || record.date))}</td>
      <td>${escapeHtml(record.assigned_schedule || 'Unscheduled')}</td>
      <td>${escapeHtml(record.formatted_time_in || '—')}</td>
      <td>${escapeHtml(record.formatted_time_out || '—')}</td>
      <td class="num">${formatDecimalHours(record.regular_hours)}</td>
      <td class="num">${formatDecimalHours(record.overtime_hours)}</td>
      <td class="num">${formatDecimalHours(record.undertime_hours)}</td>
      <td class="num"><strong>${formatDecimalHours(record.total_hours)}</strong></td>
      <td class="num">${escapeHtml(record.late_undertime || `${record.late_minutes || 0}L / ${record.undertime_minutes || 0}U`)}</td>
      <td>${escapeHtml(record.verification_status || 'approved')}</td>
    </tr>
  `).join('');

  openPrintWindow(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Saved Attendance - ${escapeHtml(employee.employee_name)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; font-weight: 500; color: #4b5563; margin: 0 0 16px; }
      .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 20px; margin-bottom: 20px; font-size: 12px; }
      .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; }
      .summary .cell { text-align: center; }
      .summary .label { font-size: 10px; text-transform: uppercase; font-weight: 600; color: #1e40af; }
      .summary .value { font-size: 16px; font-weight: 700; color: #1e40af; margin-top: 3px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tfoot td { background: #f8fafc; font-weight: 700; }
      .footer { margin-top: 20px; font-size: 10px; color: #6b7280; text-align: center; }
    </style></head><body>
    <h1>Attendance Saved Records</h1>
    <h2>${escapeHtml(employee.employee_name)} (${escapeHtml(employee.employee_code || employee.employee_id)})</h2>
    <div class="meta">
      <div><strong>Cutoff Period:</strong> ${escapeHtml(cutoffLabel || `${monthName} ${cutoffText}, ${year}`)}</div>
      <div><strong>Department:</strong> ${escapeHtml(employee.department || 'N/A')}</div>
      <div><strong>Position:</strong> ${escapeHtml(employee.position || 'N/A')}</div>
      <div><strong>Total Records:</strong> ${records.length}</div>
    </div>
    <div class="summary">
      <div class="cell"><div class="label">Regular Hours</div><div class="value">${formatDecimalHours(summary?.total_regular_hours)}</div></div>
      <div class="cell"><div class="label">OT Hours</div><div class="value">${formatDecimalHours(summary?.total_overtime_hours)}</div></div>
      <div class="cell"><div class="label">Undertime</div><div class="value">${formatDecimalHours(summary?.total_undertime_hours)}</div></div>
      <div class="cell"><div class="label">Total Hours</div><div class="value">${formatDecimalHours(summary?.total_hours)}</div></div>
      <div class="cell"><div class="label">Labor Cost</div><div class="value">${formatPeso(summary?.total_labor_cost)}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Schedule</th><th>Time In</th><th>Time Out</th><th>Regular</th><th>OT</th><th>Undertime</th><th>Total</th><th>Late/UT</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr>
        <td colspan="4" style="text-align:right;">TOTALS:</td>
        <td class="num">${formatDecimalHours(summary?.total_regular_hours)}</td>
        <td class="num">${formatDecimalHours(summary?.total_overtime_hours)}</td>
        <td class="num">${formatDecimalHours(summary?.total_undertime_hours)}</td>
        <td class="num">${formatDecimalHours(summary?.total_hours)}</td>
        <td colspan="2" class="num" style="text-align:right;">Labor Cost: <strong>${formatPeso(summary?.total_labor_cost)}</strong></td>
      </tr></tfoot>
    </table>
    <div class="footer">Printed on ${escapeHtml(printedAt)}</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
    </body></html>`);
};

const printAttendanceRecords = ({ employee, records, cutoffLabel }) => {
  if (!records || records.length === 0) { window.alert('No records to print.'); return; }
  const printedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const rowsHtml = records.map((r) => `
    <tr>
      <td>${escapeHtml(formatEmployeeOverviewDate(r.date || r.attendance_date))}</td>
      <td>${escapeHtml(r.assigned_schedule || 'Unscheduled')}</td>
      <td>${escapeHtml(r.formatted_time_in || '—')}</td>
      <td>${escapeHtml(r.formatted_time_out || '—')}</td>
      <td class="num">${formatDecimalHours(r.regular_hours)}</td>
      <td class="num">${formatDecimalHours(r.overtime_hours)}</td>
      <td class="num">${formatDecimalHours(r.undertime_hours)}</td>
      <td class="num"><strong>${formatDecimalHours(r.total_hours)}</strong></td>
      <td>${escapeHtml((r.verification_status || r.approval_status || 'pending'))}</td>
    </tr>
  `).join('');

  openPrintWindow(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Attendance Records - ${escapeHtml(employee.employee_name)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; color: #4b5563; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
      th { background: #eff6ff; color: #1e40af; font-size: 10px; text-transform: uppercase; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #6b7280; }
    </style></head><body>
    <h1>Attendance Records</h1>
    <h2>${escapeHtml(employee.employee_name)} (${escapeHtml(employee.employee_code || employee.employee_id)}) — ${escapeHtml(cutoffLabel || '')}</h2>
    <table>
      <thead><tr><th>Date</th><th>Schedule</th><th>Time In</th><th>Time Out</th><th>Regular</th><th>OT</th><th>UT</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">Printed on ${escapeHtml(printedAt)}</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
    </body></html>`);
};

const printArchiveRecords = ({ employee, records, cutoffLabel }) => {
  if (!records || records.length === 0) { window.alert('No archive records to print.'); return; }
  const printedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rowsHtml = records.map((r) => `
    <tr>
      <td>${escapeHtml(formatDate(r.attendance_date || r.date || r.timestamp))}</td>
      <td>${escapeHtml(r.assigned_schedule || 'Unscheduled')}</td>
      <td>${escapeHtml(r.formatted_time_in || '—')}</td>
      <td>${escapeHtml(r.formatted_time_out || '—')}</td>
      <td class="num">${formatDecimalHours(r.regular_hours)}</td>
      <td class="num">${formatDecimalHours(r.overtime_hours)}</td>
      <td class="num">${formatDecimalHours(r.undertime_hours)}</td>
      <td class="num"><strong>${formatDecimalHours(r.total_hours)}</strong></td>
      <td>${escapeHtml(r.verification_status || r.approval_status || 'pending')}</td>
    </tr>
  `).join('');

  const totals = records.reduce((acc, r) => {
    acc.reg += Number(r.regular_hours || 0);
    acc.ot += Number(r.overtime_hours || 0);
    acc.ut += Number(r.undertime_hours || 0);
    acc.total += Number(r.total_hours || (Number(r.regular_hours || 0) + Number(r.overtime_hours || 0)));
    return acc;
  }, { reg: 0, ot: 0, ut: 0, total: 0 });

  openPrintWindow(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Archive - ${escapeHtml(employee.employee_name)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; color: #4b5563; margin: 0 0 16px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; }
      .summary .cell { text-align: center; }
      .summary .label { font-size: 10px; text-transform: uppercase; font-weight: 600; color: #1e40af; }
      .summary .value { font-size: 16px; font-weight: 700; color: #1e40af; margin-top: 3px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
      th { background: #eff6ff; color: #1e40af; font-size: 10px; text-transform: uppercase; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #6b7280; }
    </style></head><body>
    <h1>Attendance Archive</h1>
    <h2>${escapeHtml(employee.employee_name)} (${escapeHtml(employee.employee_code || employee.employee_id)}) — ${escapeHtml(cutoffLabel)}</h2>
    <div class="summary">
      <div class="cell"><div class="label">Regular</div><div class="value">${formatDecimalHours(totals.reg)}</div></div>
      <div class="cell"><div class="label">Overtime</div><div class="value">${formatDecimalHours(totals.ot)}</div></div>
      <div class="cell"><div class="label">Undertime</div><div class="value">${formatDecimalHours(totals.ut)}</div></div>
      <div class="cell"><div class="label">Total</div><div class="value">${formatDecimalHours(totals.total)}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Schedule</th><th>Time In</th><th>Time Out</th><th>Regular</th><th>OT</th><th>UT</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">Printed on ${escapeHtml(printedAt)}</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
    </body></html>`);
};

// ==================== VALIDATION LOGIC ====================
const inspectRecordsForSave = (records) => {
  const issues = {
    missingTimeIn: [],
    missingTimeOut: [],
    pendingAttendance: [],
    pendingOvertime: [],
    pendingUndertime: [],
    empty: records.length === 0,
  };

  records.forEach((rec) => {
    const isAbsent = isAbsentOrNonWorking(rec);
    if (isAbsent) return;

    const hasTimeIn = rec.time_in && rec.time_in !== '';
    const hasTimeOut = rec.time_out && rec.time_out !== '';

    if (!hasTimeIn) issues.missingTimeIn.push(rec);
    if (!hasTimeOut) issues.missingTimeOut.push(rec);

    const approval = String(rec.approval_status || rec.verification_status || 'pending').toLowerCase();
    if (approval === 'pending') issues.pendingAttendance.push(rec);

    const otStatus = getOTStatus(rec);
    if (otStatus.status === 'PENDING') issues.pendingOvertime.push(rec);

    const utStatus = getUndertimeStatus(rec);
    if (utStatus.status === 'PENDING') issues.pendingUndertime.push(rec);
  });

  const totalBlockers =
    issues.missingTimeIn.length +
    issues.missingTimeOut.length +
    issues.pendingAttendance.length +
    issues.pendingOvertime.length +
    issues.pendingUndertime.length;

  return { issues, totalBlockers, canSave: totalBlockers === 0 && !issues.empty };
};

// ==================== MAIN COMPONENT ====================
const Staff_Attendance = () => {
  const mainContentRef = useRef(null);
  const queryClient = useQueryClient();

  // Theme sync (matches Dashboard behavior)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.body.classList.contains('dark-mode');
  });

  useEffect(() => {
    const handleThemeChange = (e) => setIsDarkMode(Boolean(e?.detail?.isDark));
    const handleStorage = (e) => {
      if (e.key === 'theme') setIsDarkMode(e.newValue === 'dark');
    };
    window.addEventListener('themeChange', handleThemeChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // ⭐ Page-wide skeleton gate (mirrors Dashboard behavior)
  const [showPageSkeleton, setShowPageSkeleton] = useState(true);
  const [pageAnimate, setPageAnimate] = useState(false);

  // ---- Refs that must survive re-renders ----
  const hasInitiallyLoadedRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const lastFetchedPeriodRef = useRef(null);
  const searchRef = useRef('');
  const deptRef = useRef('all');
  const currentPeriodKeyRef = useRef(null);

  // Persistent per-side status map (localStorage-backed)
  const [sideStatusMap, setSideStatusMap] = useState(() => loadSideStatusMap());
  useEffect(() => { persistSideStatusMap(sideStatusMap); }, [sideStatusMap]);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cutoffPeriod, setCutoffPeriod] = useState('first');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [activeMainTab, setActiveMainTab] = useState('attendance');
  const [submitting, setSubmitting] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const [selectedSelfie, setSelectedSelfie] = useState(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  const [employeeOverviewEmployees, setEmployeeOverviewEmployees] = useState([]);
  const [employeeOverviewSelectedEmployee, setEmployeeOverviewSelectedEmployee] = useState(null);
  const [employeeOverviewSelectedRecords, setEmployeeOverviewSelectedRecords] = useState([]);
  const [employeeOverviewLoading, setEmployeeOverviewLoading] = useState(false);
  const [employeeOverviewActionLoading, setEmployeeOverviewActionLoading] = useState(null);
  const [employeeOverviewSearch, setEmployeeOverviewSearch] = useState('');
  const [employeeOverviewDepartment, setEmployeeOverviewDepartment] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(null);

  const [inlineEditRecord, setInlineEditRecord] = useState(null);
  const [inlineEditTimeIn, setInlineEditTimeIn] = useState('');
  const [inlineEditTimeOut, setInlineEditTimeOut] = useState('');
  const [inlineEditNotes, setInlineEditNotes] = useState('');
  const [inlineEditSaving, setInlineEditSaving] = useState(false);

  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false);
  const [addAttendanceEmployee, setAddAttendanceEmployee] = useState(null);
  const [addAttendanceDate, setAddAttendanceDate] = useState('');
  const [addAttendanceTimeIn, setAddAttendanceTimeIn] = useState('');
  const [addAttendanceTimeOut, setAddAttendanceTimeOut] = useState('');
  const [addAttendanceNotes, setAddAttendanceNotes] = useState('');

  const [recordFilterMonth, setRecordFilterMonth] = useState(new Date().getMonth());
  const [recordFilterYear, setRecordFilterYear] = useState(new Date().getFullYear());
  const [recordFilterCutoff, setRecordFilterCutoff] = useState('first');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedRecordEmployee, setSelectedRecordEmployee] = useState(null);
  const [employeeSavedRecords, setEmployeeSavedRecords] = useState([]);
  const [employeeSavedRecordsSummary, setEmployeeSavedRecordsSummary] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveEmployees, setArchiveEmployees] = useState([]);
  const [archiveSelectedEmployee, setArchiveSelectedEmployee] = useState(null);
  const [archiveRecords, setArchiveRecords] = useState([]);
  const [archiveLoadingRecords, setArchiveLoadingRecords] = useState(false);
  const [archiveMonth, setArchiveMonth] = useState(new Date().getMonth());
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear());
  const [archiveCutoff, setArchiveCutoff] = useState('first');
  const [archiveSearch, setArchiveSearch] = useState('');

  // OT approval modal
  const [showOTApprovalModal, setShowOTApprovalModal] = useState(false);
  const [otApprovalRecord, setOtApprovalRecord] = useState(null);
  const [otApprovalHours, setOtApprovalHours] = useState(0);
  const [otApprovalReason, setOtApprovalReason] = useState('');
  const [otApprovalSubmitting, setOtApprovalSubmitting] = useState(false);

  // OT rejection modal
  const [showOTRejectModal, setShowOTRejectModal] = useState(false);
  const [otRejectRecord, setOtRejectRecord] = useState(null);
  const [otRejectReason, setOtRejectReason] = useState('');
  const [otRejectSubmitting, setOtRejectSubmitting] = useState(false);

  // UT approval modal
  const [showUTApprovalModal, setShowUTApprovalModal] = useState(false);
  const [utApprovalRecord, setUtApprovalRecord] = useState(null);
  const [utApprovalHours, setUtApprovalHours] = useState(0);
  const [utApprovalReason, setUtApprovalReason] = useState('');
  const [utApprovalSubmitting, setUtApprovalSubmitting] = useState(false);

  // UT rejection modal
  const [showUTRejectModal, setShowUTRejectModal] = useState(false);
  const [utRejectRecord, setUtRejectRecord] = useState(null);
  const [utRejectReason, setUtRejectReason] = useState('');
  const [utRejectSubmitting, setUtRejectSubmitting] = useState(false);

  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [requirementsInfo, setRequirementsInfo] = useState(null);

  const [showCutoffConfirmModal, setShowCutoffConfirmModal] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState(null);

  // ⭐ NEW — Flag modal state (#9)
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagRecord, setFlagRecord] = useState(null);
  const [flagType, setFlagType] = useState('awol');
  const [flagNotes, setFlagNotes] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  // Unscheduled
  const [pendingUnscheduledRecords, setPendingUnscheduledRecords] = useState([]);
  const [showUnscheduledModal, setShowUnscheduledModal] = useState(false);
  const [selectedUnscheduledRecord, setSelectedUnscheduledRecord] = useState(null);
  const [unscheduledApprovalNote, setUnscheduledApprovalNote] = useState('');
  const [unscheduledPage, setUnscheduledPage] = useState(1);
  const unscheduledItemsPerPage = 10;

  // ============ DATES ============
  const dates = useMemo(() => getCutoffDates(selectedYear, selectedMonth, cutoffPeriod), [selectedYear, selectedMonth, cutoffPeriod]);
  const employeeOverviewPeriod = useMemo(() => ({
    start_date: toDateInputValue(dates.start),
    end_date: toDateInputValue(dates.end),
  }), [dates]);
  const employeeOverviewCutoffLabel = formatCutoffRange(selectedYear, selectedMonth, cutoffPeriod);
  const currentPeriodKey = `${selectedYear}-${selectedMonth}-${cutoffPeriod}`;

  useEffect(() => { currentPeriodKeyRef.current = currentPeriodKey; }, [currentPeriodKey]);
  useEffect(() => { searchRef.current = employeeOverviewSearch; }, [employeeOverviewSearch]);
  useEffect(() => { deptRef.current = employeeOverviewDepartment; }, [employeeOverviewDepartment]);

  const mobileAttendanceParams = useMemo(() => ({
    year: selectedYear,
    month: selectedMonth + 1,
    start_date: dates.start.toISOString().split('T')[0],
    end_date: dates.end.toISOString().split('T')[0],
    per_page: 100
  }), [selectedYear, selectedMonth, dates]);

  const { data: mobileAttendanceData, isLoading: mobileLoading, refetch: refetchMobile, isFetching: isMobileFetching } = useMobileAttendance(mobileAttendanceParams);

  // ⭐ Skeleton → content orchestration (must be AFTER mobileLoading is declared)
  const isPageLoading = mobileLoading || (employeeOverviewLoading && activeMainTab === 'status-panel');
  useEffect(() => {
    if (!isPageLoading) {
      const t = setTimeout(() => {
        setShowPageSkeleton(false);
        setPageAnimate(false);
        requestAnimationFrame(() => setPageAnimate(true));
      }, 100);
      return () => clearTimeout(t);
    } else {
      setShowPageSkeleton(true);
      setPageAnimate(false);
    }
  }, [isPageLoading]);  const { refetch: refetchStats } = useAttendanceStatistics(selectedYear, selectedMonth + 1);
  const { refetch: refetchStatusPanelSummary } = useStatusPanelSummary();
  const { data: employeesData } = useEmployeesList();
  const { data: departmentsData } = useDepartmentsList();
  const { refetch: refetchStatusPanel } = useStatusPanel({});

  const unverifyAttendanceMutation = useUnverifyAttendance();
  const updateAttendanceStatusMutation = useUpdateAttendanceStatus();

  const isRefreshing = isMobileFetching;

  useEffect(() => {
    if (!isRefreshing && mobileAttendanceData) setLastRefreshTime(new Date());
  }, [isRefreshing, mobileAttendanceData]);

  const employees = extractApiList(employeesData);
  const departments = extractApiList(departmentsData);
  const mobileAttendance = extractApiList(mobileAttendanceData);

  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const getVerificationStatusDetails = (status) => {
    const map = {
      verified: { color: '#27ae60', icon: FiCheckCircle, text: 'Verified' },
      approved: { color: '#27ae60', icon: FiCheckCircle, text: 'Approved' },
      pending: { color: '#f39c12', icon: FiClock, text: 'Pending' },
      rejected: { color: '#e74c3c', icon: FiXCircle, text: 'Rejected' }
    };
    return map[status] || map.pending;
  };

  const getTypeDetails = (type) => {
    const map = {
      IN: { icon: FiLogOut, text: 'Time In', iconRotation: 'rotate(180deg)' },
      OUT: { icon: FiLogOut, text: 'Time Out', iconRotation: '0deg' }
    };
    return map[type] || map.IN;
  };

  const getCurrentCutoffAttendance = () => {
    const range = getCutoffDates(selectedYear, selectedMonth, cutoffPeriod);
    return mobileAttendance.filter((record) => {
      const d = new Date(record.timestamp);
      return d >= range.start && d <= range.end;
    });
  };

  const getStatusForRecord = (record) => {
    const hasSchedule = record.assigned_schedule && record.assigned_schedule !== 'Unscheduled';
    return getAttendanceStatus(hasSchedule ? { exists: true } : null, record);
  };

  // ============ PER-SIDE HELPERS (persistent) ============
  const getSideKey = (recordOrId, side) => {
    const id = typeof recordOrId === 'object'
      ? (recordOrId?.attendance_id ?? recordOrId?.id)
      : recordOrId;
    return `${id}:${side}`;
  };

  const getSideStatus = (recordOrId, side) => {
    const key = getSideKey(recordOrId, side);
    if (sideStatusMap[key]) return sideStatusMap[key];
    const recStatus = String(
      (typeof recordOrId === 'object'
        ? (recordOrId?.verification_status || recordOrId?.approval_status)
        : null) || 'pending'
    ).toLowerCase();
    if (recStatus === 'verified' || recStatus === 'approved') return 'verified';
    if (recStatus === 'rejected' || recStatus === 'declined') return 'rejected';
    return 'pending';
  };

  const setSideStatus = (recordOrId, side, status) => {
    const key = getSideKey(recordOrId, side);
    setSideStatusMap((prev) => ({ ...prev, [key]: status }));
  };

  const handleVerifySide = async (recordOrId, side, status) => {
    const attendanceId = typeof recordOrId === 'object'
      ? (recordOrId?.attendance_id ?? recordOrId?.id)
      : recordOrId;
    if (!attendanceId) {
      showNotificationMessage('Invalid record ID', 'error');
      return false;
    }

    setSideStatus(attendanceId, side, status);

    setEmployeeOverviewSelectedRecords((prev) =>
      patchEmployeeRecordInPlace(
        prev,
        attendanceId,
        status === 'verified'
          ? { verification_status: 'verified', approval_status: 'approved' }
          : status === 'rejected'
            ? { verification_status: 'rejected', approval_status: 'rejected' }
            : { verification_status: 'pending', approval_status: 'pending' }
      )
    );

    try {
      const response = await api.put(`/attendance/${attendanceId}/status`, {
        verification_status:
          status === 'verified' ? 'approved'
          : status === 'rejected' ? 'rejected'
          : 'pending',
        verification_notes:
          status === 'verified'
            ? `Verified ${side === 'in' ? 'Time In' : 'Time Out'} by admin`
            : status === 'rejected'
              ? `Rejected ${side === 'in' ? 'Time In' : 'Time Out'} by admin`
              : `Un-verified ${side === 'in' ? 'Time In' : 'Time Out'} by admin`,
      });

      if (response.data?.success || response.data?.data) {
        const verb = status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'un-rejected';
        showNotificationMessage(
          `${side === 'in' ? 'Time In' : 'Time Out'} ${verb}`,
          status === 'verified' ? 'success' : 'info'
        );
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        return true;
      }
      showNotificationMessage(response.data?.message || 'Failed to update', 'error');
      setSideStatus(attendanceId, side, 'pending');
      return false;
    } catch (error) {
      setSideStatus(attendanceId, side, 'pending');
      showNotificationMessage(getApiErrorMessage(error, 'Failed to update'), 'error');
      return false;
    }
  };

  const handleApproveBoth = async (record) => {
    const attendanceId = record?.attendance_id ?? record?.id;
    if (!attendanceId) return;

    setSideStatus(attendanceId, 'in', 'verified');
    setSideStatus(attendanceId, 'out', 'verified');
    setEmployeeOverviewSelectedRecords((prev) =>
      patchEmployeeRecordInPlace(prev, attendanceId, {
        verification_status: 'verified',
        approval_status: 'approved',
      })
    );

    try {
      const response = await api.put(`/attendance/${attendanceId}/status`, {
        verification_status: 'approved',
        verification_notes: 'Approved both Time In and Time Out by admin',
      });
      if (response.data?.success || response.data?.data) {
        showNotificationMessage('Time In and Time Out approved', 'success');
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
      }
    } catch (error) {
      setSideStatus(attendanceId, 'in', 'pending');
      setSideStatus(attendanceId, 'out', 'pending');
      showNotificationMessage(getApiErrorMessage(error, 'Failed to approve'), 'error');
    }
  };

  // ⭐ NEW #9 — Flag handlers
  const openFlagModal = (record) => {
    setFlagRecord(record);
    setFlagType(record?.attendance_flag || 'awol');
    setFlagNotes(record?.flag_notes || '');
    setShowFlagModal(true);
  };

  const closeFlagModal = () => {
    if (flagSubmitting) return;
    setShowFlagModal(false);
    setFlagRecord(null);
    setFlagNotes('');
  };

  const submitFlag = async () => {
    if (!flagRecord) return;
    const attendanceId = flagRecord.attendance_id ?? flagRecord.id;
    if (!attendanceId) return;

    setFlagSubmitting(true);
    try {
      const response = await api.post(`/attendance/${attendanceId}/flag`, {
        flag: flagType,
        notes: flagNotes?.trim() || null,
      });

      if (response.data?.success || response.data?.data) {
        const label = flagType === 'none' ? 'cleared' : flagType.replace('_', ' ');
        showNotificationMessage(`Attendance flag ${label}`, 'success');

        // Patch the modal list in place so the badge updates without refetch.
        setEmployeeOverviewSelectedRecords((prev) =>
          patchEmployeeRecordInPlace(prev, attendanceId, {
            attendance_flag: flagType === 'none' ? null : flagType,
            attendance_flag_label: flagType === 'none' ? null : label,
            flag_notes: flagNotes?.trim() || null,
          })
        );

        setShowFlagModal(false);
        setFlagRecord(null);
        setFlagNotes('');
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
      } else {
        showNotificationMessage(response.data?.message || 'Failed to update flag', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to update flag'), 'error');
    } finally {
      setFlagSubmitting(false);
    }
  };

  // ============ UNIFIED MODAL FILTER ============
  const filterEmployeeRecordsForModal = useCallback((records, cutoffStart, cutoffEnd) => {
    if (!Array.isArray(records)) return [];
    const inCutoff = records.filter((rec) => isWithinCutoff(rec, cutoffStart, cutoffEnd));
    return inCutoff.filter((rec) => {
      if (!isUnresolvedRecord(rec)) return false;

      // ⭐ AWOL / EA / On Leave records SHOW even though they have no times —
      //    we need to display them so admins can review and re-flag.
      if (rec.attendance_flag === 'awol' || rec.attendance_flag === 'emergency_absent' || rec.attendance_flag === 'on_leave') {
        return true;
      }

      if (isAbsentOrNonWorking(rec)) return false;
      if (hasAnyAttendanceSignal(rec)) return true;
      const state = String(rec?.attendance_state || '').toLowerCase();
      if (state && state !== 'complete') return true;
      return false;
    });
  }, []);

  // ============ FETCH EMPLOYEE OVERVIEW ============
  const fetchEmployeeOverviewRef = useRef(null);
  fetchEmployeeOverviewRef.current = async (force = false) => {
    const periodKey = currentPeriodKeyRef.current;

    if (
      !force &&
      hasInitiallyLoadedRef.current &&
      lastFetchedPeriodRef.current === periodKey &&
      employeeOverviewEmployees.length > 0
    ) {
      return;
    }
    if (fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    setEmployeeOverviewLoading(true);

    try {
      const response = await api.get('/attendance/employee-overview', {
        params: {
          start_date: employeeOverviewPeriod.start_date,
          end_date: employeeOverviewPeriod.end_date,
          employee_id: searchRef.current || undefined,
          department_id: deptRef.current !== 'all' ? deptRef.current : undefined,
        },
        timeout: 60000,
      });
      const body = unwrapEmployeeOverviewPayload(response);
      const list = toEmployeeOverviewArray(body.employees).map((emp) => ({
        ...emp,
        _fetched_for_period: periodKey,
      }));

      setEmployeeOverviewEmployees(list);
      setLastRefreshTime(new Date());
      hasInitiallyLoadedRef.current = true;
      lastFetchedPeriodRef.current = periodKey;
    } catch (error) {
      if (error.code !== 'ECONNABORTED') {
        showNotificationMessage(getApiErrorMessage(error, 'Failed to load Employee Overview'), 'error');
      }
      if (force) setEmployeeOverviewEmployees([]);
    } finally {
      fetchInFlightRef.current = false;
      setEmployeeOverviewLoading(false);
    }
  };

  const fetchEmployeeOverview = useCallback((force = false) => {
    return fetchEmployeeOverviewRef.current?.(force);
  }, []);

  // ============ REFRESH ============
  const refreshEverything = useCallback(async (opts = {}) => {
    const { forceOverview = false } = opts;
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['payroll'] });
    await Promise.all([
      refetchMobile(),
      refetchStats(),
      refetchStatusPanelSummary(),
      refetchStatusPanel(),
    ]);
    if (forceOverview) {
      await fetchEmployeeOverview(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, refetchMobile, refetchStats, refetchStatusPanelSummary, refetchStatusPanel, fetchEmployeeOverview]);

  // ============ EFFECT: only reload overview when the period changes ============
  useEffect(() => {
    const periodKey = `${selectedYear}-${selectedMonth}-${cutoffPeriod}`;
    const periodChanged = lastFetchedPeriodRef.current !== periodKey;

    if (periodChanged) {
      hasInitiallyLoadedRef.current = false;
      lastFetchedPeriodRef.current = null;
      setEmployeeOverviewEmployees([]);
      setEmployeeOverviewSelectedRecords([]);
      setEmployeeOverviewSelectedEmployee(null);
      setDropdownOpen(null);
      fetchEmployeeOverview(true);
    }

    if (activeMainTab === 'unscheduled') {
      fetchPendingUnscheduledRecords();
      setUnscheduledPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, cutoffPeriod]);

  // ============ EFFECT: first mount only ============
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { window.location.href = '/login'; return; }
    fetchPendingUnscheduledRecords();
    fetchEmployeeOverview(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============ REFRESH MODAL RECORDS ============
  const refreshSelectedEmployeeRecords = useCallback(async () => {
    const emp = employeeOverviewSelectedEmployee;
    if (!emp) return;
    try {
      const response = await api.get('/attendance/employee-records', {
        params: {
          employee_id: emp.employee_id,
          start_date: employeeOverviewPeriod.start_date,
          end_date: employeeOverviewPeriod.end_date,
        },
        timeout: 60000,
      });
      const body = unwrapEmployeeOverviewPayload(response);
      const records = toEmployeeOverviewArray(body.records);
      const unsaved = filterEmployeeRecordsForModal(records, dates.start, dates.end);
      setEmployeeOverviewSelectedRecords(unsaved);
    } catch (error) {
      if (error.code !== 'ECONNABORTED') {
        showNotificationMessage(getApiErrorMessage(error, 'Failed to refresh attendance records'), 'error');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeOverviewSelectedEmployee, employeeOverviewPeriod.start_date, employeeOverviewPeriod.end_date, dates, filterEmployeeRecordsForModal]);

  const loadEmployeeOverviewRecords = async (employee, openModal = true) => {
    setEmployeeOverviewActionLoading(`view-${employee.employee_id}`);
    try {
      const response = await api.get('/attendance/employee-records', {
        params: {
          employee_id: employee.employee_id,
          start_date: employeeOverviewPeriod.start_date,
          end_date: employeeOverviewPeriod.end_date,
        },
        timeout: 60000
      });
      const body = unwrapEmployeeOverviewPayload(response);
      const records = toEmployeeOverviewArray(body.records);

      const unsaved = filterEmployeeRecordsForModal(records, dates.start, dates.end);

      if (openModal) {
        setEmployeeOverviewSelectedEmployee(employee);
        setEmployeeOverviewSelectedRecords(unsaved);
        cancelInlineEdit();
      }
      return unsaved;
    } catch (error) {
      if (error.code !== 'ECONNABORTED') {
        showNotificationMessage(getApiErrorMessage(error, 'Failed to load employee records'), 'error');
      }
      return [];
    } finally {
      setEmployeeOverviewActionLoading(null);
    }
  };

  // ============ SAVE ============
  const handleSaveSingleEmployeeToPayroll = async (employee, bypass = false) => {
    if (!employee) { showNotificationMessage('Invalid employee', 'error'); return; }
    const cutoffReached = isCutoffReached(selectedYear, selectedMonth, cutoffPeriod);

    setEmployeeOverviewActionLoading(`save-${employee.employee_id}`);
    let allRecords = [];
    try {
      const response = await api.get('/attendance/employee-records', {
        params: {
          employee_id: employee.employee_id,
          start_date: employeeOverviewPeriod.start_date,
          end_date: employeeOverviewPeriod.end_date,
        },
        timeout: 60000
      });
      const body = unwrapEmployeeOverviewPayload(response);
      allRecords = toEmployeeOverviewArray(body.records);
    } catch (err) {
      // fallback
    } finally {
      setEmployeeOverviewActionLoading(null);
    }

    const unsavedRecords = filterEmployeeRecordsForModal(allRecords, dates.start, dates.end);

    if (unsavedRecords.length === 0) {
      const inCutoff = allRecords.filter((rec) => isWithinCutoff(rec, dates.start, dates.end));
      const realRecords = inCutoff.filter((rec) => !isAbsentOrNonWorking(rec));
      setRequirementsInfo({
        title: 'Nothing to Save',
        tone: 'info',
        message: realRecords.length === 0
          ? `${employee.employee_name} has no attendance records for ${employeeOverviewCutoffLabel}.`
          : `All of ${employee.employee_name}'s attendance for ${employeeOverviewCutoffLabel} has already been saved to payroll. There is nothing new to save.`,
        items: [],
        employee,
      });
      setShowRequirementsModal(true);
      return;
    }

    const inspection = inspectRecordsForSave(unsavedRecords);
    if (!inspection.canSave) {
      const items = [];
      if (inspection.issues.missingTimeIn.length > 0)
        items.push(`${inspection.issues.missingTimeIn.length} record(s) missing Time In`);
      if (inspection.issues.missingTimeOut.length > 0)
        items.push(`${inspection.issues.missingTimeOut.length} record(s) missing Time Out`);
      if (inspection.issues.pendingAttendance.length > 0)
        items.push(`${inspection.issues.pendingAttendance.length} record(s) with pending attendance approval`);
      if (inspection.issues.pendingOvertime.length > 0)
        items.push(`${inspection.issues.pendingOvertime.length} record(s) with pending overtime decision`);
      if (inspection.issues.pendingUndertime.length > 0)
        items.push(`${inspection.issues.pendingUndertime.length} record(s) with pending undertime decision`);

      setRequirementsInfo({
        title: 'Action Required Before Saving',
        tone: 'warning',
        message: `These records must be resolved before saving to payroll:`,
        items,
        employee,
      });
      setShowRequirementsModal(true);
      return;
    }

    if (!cutoffReached && !bypass) {
      setPendingSaveAction({ type: 'single', employee });
      setShowCutoffConfirmModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/attendance/save-summary-to-payroll', {
        employee_id: employee.employee_id,
        start_date: dates.start.toISOString().split('T')[0],
        end_date: dates.end.toISOString().split('T')[0],
        notes: 'Saved from Employee Overview'
      });
      if (response.data?.success) {
        showNotificationMessage(`Attendance saved for ${employee.employee_name}!`, 'success');

        setEmployeeOverviewEmployees((prev) =>
          prev.map((emp) =>
            emp.employee_id === employee.employee_id
              ? { ...emp, saved_to_payroll: true, unsaved_count: 0 }
              : emp
          )
        );

        if (employeeOverviewSelectedEmployee?.employee_id === employee.employee_id) {
          await refreshSelectedEmployeeRecords();
        }

        refreshEverything({ forceOverview: false });
        if (selectedRecordEmployee?.employee_id === employee.employee_id) await fetchSavedRecords();
      } else {
        showNotificationMessage(response.data?.message || 'Failed to save attendance', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to save attendance'), 'error');
    } finally {
      setSubmitting(false);
      setShowCutoffConfirmModal(false);
      setPendingSaveAction(null);
    }
  };

  const handleSaveFromModal = async (bypass = false) => {
    const employee = employeeOverviewSelectedEmployee;
    if (!employee) return;

    const cutoffReached = isCutoffReached(selectedYear, selectedMonth, cutoffPeriod);
    if (!cutoffReached && !bypass) {
      setPendingSaveAction({ type: 'modal', employee });
      setShowCutoffConfirmModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/attendance/save-summary-to-payroll', {
        employee_id: employee.employee_id,
        start_date: employeeOverviewPeriod.start_date,
        end_date: employeeOverviewPeriod.end_date,
        notes: 'Saved from Attendance Records modal',
      });

      if (response.data?.success) {
        showNotificationMessage(`Attendance saved for ${employee.employee_name}!`, 'success');

        setEmployeeOverviewEmployees((prev) =>
          prev.map((emp) =>
            emp.employee_id === employee.employee_id
              ? { ...emp, saved_to_payroll: true, unsaved_count: 0 }
              : emp
          )
        );

        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
      } else {
        showNotificationMessage(response.data?.message || 'Failed to save attendance', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to save attendance'), 'error');
    } finally {
      setSubmitting(false);
      setShowCutoffConfirmModal(false);
      setPendingSaveAction(null);
    }
  };

  const handleSaveAllAttendance = async (bypass = false) => {
    const cutoffReached = isCutoffReached(selectedYear, selectedMonth, cutoffPeriod);
    if (!cutoffReached && !bypass) {
      setPendingSaveAction('save-all');
      setShowCutoffConfirmModal(true);
      return;
    }
    setSavingAll(true);
    try {
      const response = await api.post('/attendance/save-all-summaries-to-payroll', {
        start_date: dates.start.toISOString().split('T')[0],
        end_date: dates.end.toISOString().split('T')[0],
        month: selectedMonth + 1,
        year: selectedYear,
        cutoff: cutoffPeriod,
        notes: 'Saved from Employee Overview'
      });
      if (response.data?.success) {
        const processed = response.data?.data?.processed_count || 0;
        const skipped = response.data?.data?.skipped_count || 0;

        if (processed === 0) {
          setRequirementsInfo({
            title: 'Nothing to Save',
            tone: 'info',
            message: skipped > 0
              ? `No new attendance records were ready to save for ${employeeOverviewCutoffLabel}. ${skipped} record(s) were skipped (see details).`
              : `All attendance for ${employeeOverviewCutoffLabel} has already been saved to payroll. There is nothing new to save.`,
            items: (response.data?.data?.skipped || []).map(
              (s) => `${s.employee_name || s.employee_id}: ${s.reason}`
            ),
            employee: null,
          });
          setShowRequirementsModal(true);
        } else {
          showNotificationMessage(`${processed} attendance record(s) saved successfully!`, 'success');
        }

        refreshEverything({ forceOverview: false });
        if (employeeOverviewSelectedEmployee) await refreshSelectedEmployeeRecords();
        if (selectedRecordEmployee) await fetchSavedRecords();
      } else {
        showNotificationMessage(response.data?.message || 'Failed to save attendance', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to save attendance'), 'error');
    } finally {
      setSavingAll(false);
      setShowCutoffConfirmModal(false);
      setPendingSaveAction(null);
    }
  };

  // ============ SAVED RECORDS ============
  const openRecordModal = async (employee) => {
    setSelectedRecordEmployee(employee);
    setLoadingRecords(true);
    setShowRecordModal(true);
    setEmployeeSavedRecordsSummary(null);
    setRecordFilterMonth(selectedMonth);
    setRecordFilterYear(selectedYear);
    setRecordFilterCutoff(cutoffPeriod);

    try {
      const response = await api.get('/attendance/employee-saved-records', {
        params: { employee_id: employee.employee_id, month: selectedMonth + 1, year: selectedYear, cutoff: cutoffPeriod }
      });
      const body = unwrapEmployeeOverviewPayload(response);
      setEmployeeSavedRecords(toEmployeeOverviewArray(body.records));
      setEmployeeSavedRecordsSummary(body.summary || null);
    } catch (error) {
      console.error('Saved records fetch error:', error);
      setEmployeeSavedRecords([]);
      setEmployeeSavedRecordsSummary(null);
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchSavedRecords = async (employeeId = null) => {
    const targetId = employeeId || selectedRecordEmployee?.employee_id;
    if (!targetId) return;
    setLoadingRecords(true);
    try {
      const response = await api.get('/attendance/employee-saved-records', {
        params: { employee_id: targetId, month: recordFilterMonth + 1, year: recordFilterYear, cutoff: recordFilterCutoff }
      });
      const body = unwrapEmployeeOverviewPayload(response);
      setEmployeeSavedRecords(toEmployeeOverviewArray(body.records));
      setEmployeeSavedRecordsSummary(body.summary || null);
    } catch (error) {
      setEmployeeSavedRecords([]);
      setEmployeeSavedRecordsSummary(null);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handlePrintSavedRecords = () => {
    if (!selectedRecordEmployee) return;
    printSavedRecords({
      employee: selectedRecordEmployee,
      summary: employeeSavedRecordsSummary,
      records: employeeSavedRecords,
      cutoffLabel: `${new Date(recordFilterYear, recordFilterMonth).toLocaleString('default', { month: 'long' })} ${recordFilterCutoff === 'first' ? '1 - 15' : '16 - End'}, ${recordFilterYear}`,
      month: recordFilterMonth,
      year: recordFilterYear,
      cutoff: recordFilterCutoff,
    });
  };

  // ============ RECORD-LEVEL VERIFY (legacy compatibility) ============
  const handleVerifyAttendance = async (recordOrId, status) => {
    if (recordOrId && typeof recordOrId === 'object' && recordOrId.type) {
      const side = recordOrId.type === 'IN' ? 'in' : 'out';
      return handleVerifySide(recordOrId, side, status);
    }
    return handleVerifySide(recordOrId, 'in', status);
  };

  const handleUnverifyAttendance = async (record) => {
    if (record && typeof record === 'object' && record.type) {
      const side = record.type === 'IN' ? 'in' : 'out';
      return handleVerifySide(record, side, 'pending');
    }
    const recordId = record?.id || record?.attendance_id;
    if (!recordId) return;
    return handleVerifySide(recordId, 'in', 'pending');
  };

  const handleCancelReject = async (record) => {
    if (record && typeof record === 'object' && record.type) {
      const side = record.type === 'IN' ? 'in' : 'out';
      return handleVerifySide(record, side, 'pending');
    }
    const recordId = record?.id || record?.attendance_id;
    if (!recordId) return;
    return handleVerifySide(recordId, 'in', 'pending');
  };

  // ============ OT ============
  const openOTApprovalModal = (record) => {
    setOtApprovalRecord(record);
    setOtApprovalHours(Number(record?.overtime_hours || 0));
    setOtApprovalReason('');
    setShowOTApprovalModal(true);
  };

  const submitOTApproval = async () => {
    if (!otApprovalRecord) return;
    const maxHours = Number(otApprovalRecord.overtime_hours || 0);
    if (otApprovalHours <= 0) { showNotificationMessage('Approved hours must be greater than 0.', 'warning'); return; }
    if (otApprovalHours > maxHours) { showNotificationMessage(`Cannot exceed ${maxHours}h.`, 'warning'); return; }
    if (!otApprovalReason.trim()) { showNotificationMessage('Please provide a reason.', 'warning'); return; }
    const attendanceId = otApprovalRecord?.id || otApprovalRecord?.attendance_id;
    setOtApprovalSubmitting(true);
    try {
      const response = await api.post(`/attendance/${attendanceId}/approve-overtime`, {
        approved_overtime_hours: otApprovalHours,
        notes: otApprovalReason,
      });
      if (response.data?.success) {
        showNotificationMessage(`Overtime approved (${otApprovalHours}h)`, 'success');
        setShowOTApprovalModal(false);
        setOtApprovalRecord(null);
        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
      } else {
        showNotificationMessage(response.data?.message || 'Failed to approve overtime', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to approve overtime'), 'error');
    } finally {
      setOtApprovalSubmitting(false);
    }
  };

  const openOTRejectModal = (record) => {
    setOtRejectRecord(record);
    setOtRejectReason('');
    setShowOTRejectModal(true);
  };

  const submitOTRejection = async () => {
    if (!otRejectRecord) return;
    if (!otRejectReason.trim()) {
      showNotificationMessage('Please provide a reason for rejection.', 'warning');
      return;
    }
    const attendanceId = otRejectRecord?.id || otRejectRecord?.attendance_id;
    setOtRejectSubmitting(true);
    try {
      const response = await api.post(`/attendance/${attendanceId}/reject-overtime`, {
        reason: otRejectReason,
      });
      if (response.data?.success) {
        showNotificationMessage('Overtime rejected', 'info');
        setShowOTRejectModal(false);
        setOtRejectRecord(null);
        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
      } else {
        showNotificationMessage(response.data?.message || 'Failed to reject overtime', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to reject overtime'), 'error');
    } finally {
      setOtRejectSubmitting(false);
    }
  };

  // ============ UT ============
  const openUTApprovalModal = (record) => {
    setUtApprovalRecord(record);
    setUtApprovalHours(Number(record?.undertime_hours || 0));
    setUtApprovalReason('');
    setShowUTApprovalModal(true);
  };

  const submitUTApproval = async () => {
    if (!utApprovalRecord) return;
    const maxHours = Number(utApprovalRecord.undertime_hours || 0);
    if (utApprovalHours <= 0) { showNotificationMessage('Approved hours must be greater than 0.', 'warning'); return; }
    if (utApprovalHours > maxHours) { showNotificationMessage(`Cannot exceed ${maxHours}h.`, 'warning'); return; }
    if (!utApprovalReason.trim()) { showNotificationMessage('Please provide a reason.', 'warning'); return; }
    const attendanceId = utApprovalRecord?.id || utApprovalRecord?.attendance_id;
    setUtApprovalSubmitting(true);
    try {
      const response = await api.post(`/attendance/${attendanceId}/approve-undertime`, {
        approved_undertime_hours: utApprovalHours,
        notes: utApprovalReason,
      });
      if (!response.data?.success) {
        showNotificationMessage(response.data?.message || 'Failed to approve undertime', 'error');
        return;
      }
      if (utApprovalRecord?.approval_status !== 'approved') {
        try {
          await api.put(`/attendance/${attendanceId}/status`, {
            verification_status: 'approved',
            verification_notes: 'Undertime reviewed and approved',
          });
        } catch (e) { /* non-fatal */ }
      }
      showNotificationMessage(`Undertime approved (${utApprovalHours}h)`, 'success');
      setShowUTApprovalModal(false);
      setUtApprovalRecord(null);
      await refreshSelectedEmployeeRecords();
      refreshEverything({ forceOverview: false });
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to approve undertime'), 'error');
    } finally {
      setUtApprovalSubmitting(false);
    }
  };

  const openUTRejectModal = (record) => {
    setUtRejectRecord(record);
    setUtRejectReason('');
    setShowUTRejectModal(true);
  };

  const submitUTRejection = async () => {
    if (!utRejectRecord) return;
    if (!utRejectReason.trim()) {
      showNotificationMessage('Please provide a reason for rejection.', 'warning');
      return;
    }
    const attendanceId = utRejectRecord?.id || utRejectRecord?.attendance_id;
    setUtRejectSubmitting(true);
    try {
      const response = await api.post(`/attendance/${attendanceId}/reject-undertime`, {
        reason: utRejectReason,
      });
      if (response.data?.success) {
        showNotificationMessage('Undertime rejected', 'info');
        setShowUTRejectModal(false);
        setUtRejectRecord(null);
        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
      } else {
        showNotificationMessage(response.data?.message || 'Failed to reject undertime', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to reject undertime'), 'error');
    } finally {
      setUtRejectSubmitting(false);
    }
  };

  // ============ INLINE EDIT ============
  const openInlineEdit = (record) => {
    setInlineEditRecord(record);
    setInlineEditTimeIn(toDateTimeLocalInput(record.time_in, record.date, '08:00'));
    setInlineEditTimeOut(toDateTimeLocalInput(record.time_out, record.date, '17:00'));
    setInlineEditNotes('Edited from Attendance Records');
  };

  const cancelInlineEdit = () => {
    setInlineEditRecord(null);
    setInlineEditTimeIn('');
    setInlineEditTimeOut('');
    setInlineEditNotes('');
  };

  const saveInlineEdit = async () => {
    if (!inlineEditRecord) return;
    if (!inlineEditTimeIn && !inlineEditTimeOut) {
      showNotificationMessage('Enter at least a time-in or time-out.', 'warning');
      return;
    }
    setInlineEditSaving(true);
    try {
      const response = await api.put(`/attendance/${inlineEditRecord.attendance_id || inlineEditRecord.id}/times`, {
        time_in: inlineEditTimeIn || null,
        time_out: inlineEditTimeOut || null,
        notes: inlineEditNotes,
      }, { timeout: 60000 });
      if (response.data?.success) {
        const merged = response.data?.data?.merged === true;
        showNotificationMessage(
          merged
            ? 'Attendance merged with an existing record on the same date.'
            : 'Attendance updated successfully.',
          merged ? 'info' : 'success'
        );
        cancelInlineEdit();
        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to update attendance'), 'error');
    } finally {
      setInlineEditSaving(false);
    }
  };

  // ============ PRINT ============
  const handlePrintAttendanceRecords = () => {
    if (!employeeOverviewSelectedEmployee) return;
    printAttendanceRecords({
      employee: employeeOverviewSelectedEmployee,
      records: employeeOverviewSelectedRecords,
      cutoffLabel: employeeOverviewCutoffLabel,
    });
  };

  // ============ ADD ATTENDANCE ============
  const handleAddAttendance = (employee) => {
    setAddAttendanceEmployee(employee);
    setAddAttendanceDate(new Date().toISOString().split('T')[0]);
    setAddAttendanceTimeIn('');
    setAddAttendanceTimeOut('');
    setAddAttendanceNotes('');
    setShowAddAttendanceModal(true);
  };

  const confirmAddAttendance = async () => {
    if (!addAttendanceEmployee || !addAttendanceDate) {
      showNotificationMessage('Please select employee and date', 'warning');
      return;
    }
    if (!addAttendanceTimeIn && !addAttendanceTimeOut) {
      showNotificationMessage('Enter at least a time-in or time-out.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const existingRes = await api.get('/attendance/employee-records', {
        params: { employee_id: addAttendanceEmployee.employee_id, start_date: addAttendanceDate, end_date: addAttendanceDate },
        timeout: 30000,
      });
      const existing = toEmployeeOverviewArray(unwrapEmployeeOverviewPayload(existingRes).records).filter(
        (rec) => (rec.date || rec.attendance_date) === addAttendanceDate && (rec.time_in || rec.time_out)
      );
      if (existing.length > 0) {
        showNotificationMessage(`${addAttendanceEmployee.employee_name} already has a record for ${formatDate(addAttendanceDate)}.`, 'warning');
        return;
      }

      const timeInIso = addAttendanceTimeIn ? `${addAttendanceDate}T${addAttendanceTimeIn}:00` : null;
      const timeOutIso = addAttendanceTimeOut ? `${addAttendanceDate}T${addAttendanceTimeOut}:00` : null;

      if (timeInIso) {
        await api.post('/attendance/time-in', {
          employee_id: addAttendanceEmployee.employee_id,
          captured_at: timeInIso,
          device_info: 'Admin manual entry',
          notes: addAttendanceNotes || 'Added from Employee Overview',
        }, { timeout: 30000 });
      }
      if (timeOutIso) {
        try {
          await api.post('/attendance/time-out', {
            employee_id: addAttendanceEmployee.employee_id,
            captured_at: timeOutIso,
            device_info: 'Admin manual entry',
          }, { timeout: 30000 });
        } catch (e) {
          showNotificationMessage(`Time-out failed. Time-in was recorded.`, 'warning');
        }
      }

      showNotificationMessage(`Attendance created for ${addAttendanceEmployee.employee_name}`, 'success');
      setShowAddAttendanceModal(false);
      setAddAttendanceEmployee(null);
      if (employeeOverviewSelectedEmployee?.employee_id === addAttendanceEmployee.employee_id) {
        await refreshSelectedEmployeeRecords();
      }
      refreshEverything({ forceOverview: false });
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to create attendance'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============ UNSCHEDULED ============
  const fetchPendingUnscheduledRecords = useCallback(async () => {
    try {
      const response = await api.get('/attendance/needs-approval', {
        params: { status: 'unscheduled', approval_status: 'pending', per_page: 100 },
      });
      const records = extractApiList(response).map(normalizeAttendanceLog);
      setPendingUnscheduledRecords(records);
    } catch (error) {
      setPendingUnscheduledRecords([]);
    }
  }, []);

  const approveUnscheduledRecord = async (recordId, notes) => {
    setSubmitting(true);
    try {
      const response = await api.post(`/attendance/${recordId}/approve-unscheduled`, {
        admin_notes: notes || 'Approved from Unscheduled tab',
      });
      if (response.data?.success) {
        showNotificationMessage('Unscheduled attendance approved!', 'success');
        await fetchPendingUnscheduledRecords();
        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
        setShowUnscheduledModal(false);
        setSelectedUnscheduledRecord(null);
        setUnscheduledApprovalNote('');
      } else {
        showNotificationMessage(response.data?.message || 'Failed to approve', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to approve'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const rejectUnscheduledRecord = async (attendanceId, reason) => {
    setSubmitting(true);
    try {
      const result = await updateAttendanceStatusMutation.mutateAsync({
        attendanceId,
        status: 'rejected',
        notes: `Unscheduled attendance rejected: ${reason || 'No reason provided'}`,
      });
      if (result?.success) {
        showNotificationMessage('Unscheduled attendance rejected', 'info');
        await fetchPendingUnscheduledRecords();
        await refreshSelectedEmployeeRecords();
        refreshEverything({ forceOverview: false });
      } else {
        showNotificationMessage('Failed to reject record', 'error');
      }
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to reject record'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============ ARCHIVE ============
  const openArchiveModal = async () => {
    setShowArchiveModal(true);
    setArchiveLoading(true);
    setArchiveSelectedEmployee(null);
    setArchiveRecords([]);
    setArchiveMonth(selectedMonth);
    setArchiveYear(selectedYear);
    setArchiveCutoff(cutoffPeriod);
    try {
      const response = await api.get('/employees', { params: { all: true, per_page: 1000 } });
      setArchiveEmployees(extractApiList(response));
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to load employees'), 'error');
      setArchiveEmployees([]);
    } finally {
      setArchiveLoading(false);
    }
  };

  const loadArchiveForEmployee = async (employee) => {
    setArchiveSelectedEmployee(employee);
    setArchiveLoadingRecords(true);
    setArchiveRecords([]);
    try {
      const range = getCutoffDates(archiveYear, archiveMonth, archiveCutoff);
      const response = await api.get('/attendance/employee-records', {
        params: {
          employee_id: employee.employee_id,
          start_date: toDateInputValue(range.start),
          end_date: toDateInputValue(range.end),
        },
        timeout: 60000,
      });
      const body = unwrapEmployeeOverviewPayload(response);
      setArchiveRecords(toEmployeeOverviewArray(body.records));
    } catch (error) {
      showNotificationMessage(getApiErrorMessage(error, 'Failed to load archive records'), 'error');
      setArchiveRecords([]);
    } finally {
      setArchiveLoadingRecords(false);
    }
  };

  const handlePrintArchive = () => {
    if (!archiveSelectedEmployee) return;
    printArchiveRecords({
      employee: archiveSelectedEmployee,
      records: archiveRecords,
      cutoffLabel: `${new Date(archiveYear, archiveMonth).toLocaleString('default', { month: 'long' })} ${archiveCutoff === 'first' ? '1 - 15' : '16 - End'}, ${archiveYear}`,
    });
  };

  const filteredArchiveEmployees = useMemo(() => {
    if (!archiveSearch.trim()) return archiveEmployees;
    const term = archiveSearch.toLowerCase();
    return archiveEmployees.filter((e) =>
      (e.employee_name || e.full_name || '').toLowerCase().includes(term) ||
      (e.employee_code || '').toLowerCase().includes(term)
    );
  }, [archiveEmployees, archiveSearch]);

  // ============ DERIVED ============
  const attendanceTabStats = useMemo(() => {
    const records = getCurrentCutoffAttendance();
    const ins = records.filter((r) => r.type === 'IN');
    const outs = records.filter((r) => r.type === 'OUT');
    const verified = records.filter((r) => r.verification_status === 'verified' || r.verification_status === 'approved');
    const pending = records.filter((r) => r.verification_status === 'pending' || !r.verification_status);
    const rejected = records.filter((r) => r.verification_status === 'rejected');
    return {
      total: records.length,
      ins: ins.length,
      outs: outs.length,
      verified: verified.length,
      pending: pending.length,
      rejected: rejected.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileAttendance, selectedYear, selectedMonth, cutoffPeriod]);

  // ⭐ NEW #7 — Cutoff-wide insight totals across all employees
  const cutoffInsightTotals = useMemo(() => {
    const list = Array.isArray(employeeOverviewEmployees) ? employeeOverviewEmployees : [];
    return list.reduce(
      (acc, emp) => {
        acc.awol += Number(emp.awol_count || 0);
        acc.ea += Number(emp.emergency_absent_count || 0);
        acc.leave += Number(emp.on_leave_count || 0);
        acc.lateIn += Number(emp.late_in_count || 0);
        acc.present += Number(emp.present_days_count || 0);
        return acc;
      },
      { awol: 0, ea: 0, leave: 0, lateIn: 0, present: 0 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeOverviewEmployees]);

  const filteredMobileAttendance = useMemo(() => {
    let filtered = [...getCurrentCutoffAttendance()];
    if (typeFilter !== 'ALL') filtered = filtered.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(r => r.verification_status === statusFilter);
    if (searchTerm) {
      filtered = filtered.filter(r =>
        (r.employee_name && r.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.employee_code && r.employee_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileAttendance, selectedYear, selectedMonth, cutoffPeriod, typeFilter, statusFilter, searchTerm]);

  const paginatedMobileAttendance = filteredMobileAttendance.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalUnscheduledPages = Math.ceil(pendingUnscheduledRecords.length / unscheduledItemsPerPage);
  const paginatedUnscheduledRecords = pendingUnscheduledRecords.slice(
    (unscheduledPage - 1) * unscheduledItemsPerPage,
    unscheduledPage * unscheduledItemsPerPage
  );

  // ============ STYLES ============
  const injectedStyles = `
    /* ============ ACTION BUTTONS + DROPDOWN ============ */
    .action-buttons-row { position: relative; display: flex; align-items: center; gap: 6px; }
    .pro-dropdown { position: absolute; top: calc(100% + 6px); right: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 12px 32px rgba(15,23,42,0.12); min-width: 250px; z-index: 1000; padding: 6px; animation: proDropIn 0.14s ease-out; }
    @keyframes proDropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .pro-dropdown-header { padding: 8px 12px 6px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #94a3b8; }
    .pro-dropdown-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; width: 100%; border: none; background: transparent; cursor: pointer; font-size: 13px; color: #1f2937; border-radius: 7px; text-align: left; transition: background 0.12s ease; }
    .pro-dropdown-item:hover { background: #eff6ff; }
    .pro-dropdown-item .icon-wrapper { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
    .pro-dropdown-item .icon-wrapper.blue { background: #dbeafe; color: #2563eb; }
    .pro-dropdown-item .icon-wrapper.green { background: #d1fae5; color: #059669; }
    .pro-dropdown-item .icon-wrapper.purple { background: #ede9fe; color: #7c3aed; }
    .pro-dropdown-item .text-block { display: flex; flex-direction: column; gap: 1px; }
    .pro-dropdown-item .label { font-weight: 600; font-size: 13px; color: #0f172a; }
    .pro-dropdown-item .sub-label { font-size: 11px; color: #64748b; }
    .pro-dropdown-divider { height: 1px; background: #f1f5f9; margin: 6px 8px; }

    /* ============ SAVED BADGE ============ */
    .saved-badge { display: inline-flex; align-items: center; gap: 4px; background: #d1fae5; color: #059669; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }

    /* ============ FLAG BADGE (⭐ NEW #6 / #9) ============ */
    .flag-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }

    /* ============ INLINE EDIT ============ */
    .inline-edit-row td { background: #eff6ff !important; }
    .inline-edit-input { width: 100%; padding: 5px 8px; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 12px; background: #fff; }
    .inline-edit-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }

    /* ============ MISSING TIME HIGHLIGHT ============ */
    .time-missing { color: #dc2626; font-weight: 600; }

    /* ============ BLUE-WHITE MODAL ============ */
    .modal-blue-white { border-top: 4px solid #2563eb; }
    .modal-blue-white .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; }
    .modal-blue-white .modal-header h2 { color: #1e40af; display: flex; align-items: center; gap: 8px; }
    .modal-blue-white .modal-body { background: #ffffff; }
    .modal-blue-white .modal-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; }

    /* ============ INFO MODAL ICONS ============ */
    .info-modal-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .info-modal-icon.warning { background: #fef3c7; color: #d97706; }
    .info-modal-icon.info { background: #dbeafe; color: #2563eb; }
    .info-modal-icon.success { background: #d1fae5; color: #059669; }

    /* ============ REQUIREMENTS LIST ============ */
    .requirements-list { margin: 12px 0 0 0; padding-left: 20px; }
    .requirements-list li { margin-bottom: 6px; font-size: 13px; color: #334155; }

    /* ============ BLUE BUTTONS ============ */
    .blue-primary-btn { background: #2563eb; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.12s; }
    .blue-primary-btn:hover { background: #1d4ed8; }
    .blue-primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .blue-secondary-btn { background: #fff; color: #1e40af; border: 1px solid #bfdbfe; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .blue-secondary-btn:hover { background: #eff6ff; }
    .blue-secondary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* ============ EVENT VERIFY PILLS ============ */
    .event-verify-row { display: inline-flex; align-items: center; gap: 4px; }
    .event-verify-btn { display: inline-flex; align-items: center; gap: 3px; padding: 3px 7px; border-radius: 6px; font-size: 10.5px; font-weight: 600; border: 1px solid transparent; cursor: pointer; }
    .event-verify-btn.approve { background: #d1fae5; color: #065f46; border-color: #6ee7b7; }
    .event-verify-btn.approve:hover { background: #a7f3d0; }
    .event-verify-btn.reject { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    .event-verify-btn.reject:hover { background: #fecaca; }
    .event-verify-btn.undo { background: #e2e8f0; color: #475569; border-color: #cbd5e1; }
    .event-verify-btn.undo:hover { background: #cbd5e1; }
    .event-status-pill { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    .event-status-pill.pending { background: #fef3c7; color: #b45309; }
    .event-status-pill.verified { background: #d1fae5; color: #065f46; }
    .event-status-pill.rejected { background: #fee2e2; color: #991b1b; }

    /* ============ OT / UT MODAL ============ */
    .ot-modal-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 12px; }
    .ot-modal-info .label { color: #1e40af; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; }
    .ot-modal-info .value { color: #0f172a; font-weight: 600; font-size: 14px; margin-top: 2px; }
    .ot-modal-field label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px; }
    .ot-modal-field .helper { font-size: 11px; color: #64748b; margin-top: 4px; }
    .ot-modal-field input[type="number"], .ot-modal-field textarea { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-family: inherit; background: #fff; }
    .ot-modal-field input[type="number"]:focus, .ot-modal-field textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    .hours-quick-picks { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .hours-quick-picks button { padding: 5px 10px; border: 1px solid #bfdbfe; background: #fff; border-radius: 20px; font-size: 11px; color: #1e40af; cursor: pointer; }
    .hours-quick-picks button:hover { background: #eff6ff; }
    .hours-quick-picks button.active { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 600; }

    /* ============ ARCHIVE ============ */
    .archive-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; }
    .archive-employee-list { max-height: 520px; overflow-y: auto; border-right: 1px solid #e5e7eb; padding-right: 12px; }
    .archive-employee-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; cursor: pointer; margin-bottom: 6px; border: 1px solid transparent; transition: all 0.12s; }
    .archive-employee-item:hover { background: #eff6ff; }
    .archive-employee-item.active { background: #dbeafe; border-color: #2563eb; }
    .archive-employee-item .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1e40af); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
    .archive-employee-item .name { font-weight: 600; font-size: 13px; color: #0f172a; }
    .archive-employee-item .code { font-size: 11px; color: #64748b; }

    /* ============ TAB BADGE ============ */
    .tab-badge { margin-left: 6px; background: #2563eb; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }

    /* ============ ATTENDANCE TAB INSIGHTS ============ */
    .attendance-insights-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin: 16px 0;
      padding: 0 24px;
    }
    @media (max-width: 1280px) {
      .attendance-insights-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 720px) {
      .attendance-insights-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .insight-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15,23,42,0.04);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .insight-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(15,23,42,0.06);
    }
    .insight-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .insight-info { display: flex; flex-direction: column; min-width: 0; }
    .insight-value { font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1; }
    .insight-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-top: 4px; }

    .insight-blue    .insight-icon { background: #dbeafe; color: #2563eb; }
    .insight-green   .insight-icon { background: #d1fae5; color: #059669; }
    .insight-red     .insight-icon { background: #fee2e2; color: #dc2626; }
    .insight-emerald .insight-icon { background: #d1fae5; color: #059669; }
    .insight-amber   .insight-icon { background: #fef3c7; color: #d97706; }
    .insight-slate   .insight-icon { background: #e2e8f0; color: #475569; }
    .insight-violet  .insight-icon { background: #ede9fe; color: #7c3aed; }
    .insight-rose    .insight-icon { background: #ffe4e6; color: #e11d48; }
    .insight-indigo  .insight-icon { background: #e0e7ff; color: #4338ca; }

    /* ============ CUTOFF INSIGHTS STRIP (⭐ NEW #7) ============ */
    .cutoff-insights-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin: 0 24px 16px 24px;
      padding: 16px;
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
      border: 1px solid #dbeafe;
      border-radius: 12px;
    }
    @media (max-width: 1024px) {
      .cutoff-insights-strip { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 640px) {
      .cutoff-insights-strip { grid-template-columns: repeat(2, 1fr); }
    }
    .cutoff-insight-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 8px;
      background: #fff;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    .cutoff-insight-value { font-size: 22px; font-weight: 800; line-height: 1; }
    .cutoff-insight-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b; margin-top: 6px; }

    /* ============ UNSCHEDULED ============ */
    .unscheduled-container { padding: 16px 24px 24px 24px; }
    .unscheduled-header-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 22px 28px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
    }
    .unscheduled-header-left { display: flex; align-items: center; gap: 18px; flex: 1; min-width: 0; }
    .unscheduled-header-icon {
      width: 52px; height: 52px; border-radius: 12px;
      background: #2563eb; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; flex-shrink: 0;
    }
    .unscheduled-header-card h3 { margin: 0 0 4px 0; color: #1e40af; font-size: 17px; font-weight: 700; line-height: 1.25; }
    .unscheduled-header-card p { margin: 0; color: #475569; font-size: 13px; line-height: 1.4; }

    .unscheduled-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
    .unscheduled-stat {
      display: flex; align-items: center; gap: 14px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 16px 18px; box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    }
    .unscheduled-stat .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .unscheduled-stat .stat-icon.blue { background: #dbeafe; color: #2563eb; }
    .unscheduled-stat .stat-icon.green { background: #d1fae5; color: #059669; }
    .unscheduled-stat .stat-icon.red { background: #fee2e2; color: #dc2626; }
    .unscheduled-stat .stat-info { display: flex; flex-direction: column; }
    .unscheduled-stat .stat-value { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1; }
    .unscheduled-stat .stat-label { font-size: 11px; text-transform: uppercase; color: #64748b; margin-top: 4px; letter-spacing: 0.5px; font-weight: 600; }

    .unscheduled-empty-state {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 60px 20px; text-align: center;
    }
    .unscheduled-empty-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: #dbeafe; color: #2563eb;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; margin: 0 auto 16px;
    }
    .unscheduled-empty-state h3 { margin: 0 0 6px; color: #1e40af; font-size: 16px; font-weight: 700; }
    .unscheduled-empty-state p { margin: 0; color: #64748b; font-size: 13px; }

    .unscheduled-table-wrapper {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    }
    .unscheduled-table-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .unscheduled-table-header h4 { margin: 0; color: #1e40af; font-size: 14px; font-weight: 700; }
    .unscheduled-table-count { background: #2563eb; color: #fff; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }

    .unscheduled-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .unscheduled-table th {
      background: #f8fafc; text-align: left; padding: 12px 20px;
      font-size: 11px; text-transform: uppercase; color: #475569;
      border-bottom: 1px solid #e2e8f0; font-weight: 700; letter-spacing: 0.4px;
    }
    .unscheduled-table td { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .unscheduled-table tr:hover td { background: #f8fafc; }
    .unscheduled-table tr:last-child td { border-bottom: none; }

    .attendance-type-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .attendance-type-pill.in { background: #d1fae5; color: #065f46; }
    .attendance-type-pill.out { background: #fee2e2; color: #991b1b; }

    .unscheduled-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .unscheduled-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      border: 1px solid transparent; transition: all 0.12s;
    }
    .unscheduled-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .unscheduled-btn.approve { background: #2563eb; color: #fff; }
    .unscheduled-btn.approve:hover:not(:disabled) { background: #1d4ed8; }
    .unscheduled-btn.reject { background: #fff; color: #dc2626; border-color: #fecaca; }
    .unscheduled-btn.reject:hover:not(:disabled) { background: #fef2f2; }

    /* ============ FLAG MODAL QUICK PICKS (⭐ NEW #9) ============ */
    .flag-quick-picks { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .flag-quick-picks button {
      padding: 7px 14px;
      border: 1px solid #bfdbfe;
      background: #fff;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: #1e40af;
      cursor: pointer;
      transition: all 0.12s;
    }
    .flag-quick-picks button:hover { background: #eff6ff; }
    .flag-quick-picks button.active { background: #2563eb; border-color: #2563eb; color: #fff; }

    /* ============ PAGINATION ============ */
    .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 10px; padding: 16px; border-top: 1px solid #f1f5f9; }
    .pagination-btn {
      padding: 7px 14px; border: 1px solid #bfdbfe; background: #fff;
      border-radius: 8px; font-size: 12px; color: #1e40af;
      cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
      font-weight: 600;
    }
    .pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination-btn:hover:not(:disabled) { background: #eff6ff; }
    .pagination-info { font-size: 12px; color: #64748b; font-weight: 500; }

    /* ============ MINI FLAG DOT ============ */
    .flag-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;
    }
  `;

  // ⭐ Show full page skeleton while loading
  if (showPageSkeleton) {
    return <AttendancePageSkeleton />;
  }

  return (
    <div className={`attendance-container ${pageAnimate ? 'att-animate-in' : ''} ${isDarkMode ? 'att-dark-mode' : ''}`}>
      <style>{injectedStyles}</style>
      {showNotification && (
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
      )}

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

      <div className="attendance-header">
        <div className="header-left">
          <div className="header-icon"><FiUserCheck /></div>
          <div className="header-title">
            <h1>Attendance Management</h1>
            <p>Track employee time-in and time-out records by cutoff period</p>
          </div>
        </div>
        <div className="header-actions">
          <button className={`action-btn auto-refresh-btn ${autoRefreshEnabled ? 'active' : ''}`} onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)} title="Toggle auto-refresh">
            {autoRefreshEnabled ? <FiBell /> : <FiBellOff />}
          </button>
          <button className="action-btn archive-btn" onClick={openArchiveModal} title="Attendance Archive"><FiArchive /></button>
          <button className="action-btn refresh-btn" onClick={() => refreshEverything({ forceOverview: true })} title="Refresh"><FiRefreshCw /></button>
        </div>
      </div>

      <div className="main-tabs">
        <button className={`main-tab ${activeMainTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveMainTab('attendance')}><FiList /> Attendance Records</button>
        <button className={`main-tab ${activeMainTab === 'status-panel' ? 'active' : ''}`} onClick={() => setActiveMainTab('status-panel')}><FiSliders /> Employee Overview</button>
        <button className={`main-tab ${activeMainTab === 'unscheduled' ? 'active' : ''}`} onClick={() => setActiveMainTab('unscheduled')}>
          <FiAlertTriangle /> Unscheduled
          {pendingUnscheduledRecords.length > 0 && <span className="tab-badge warning">{pendingUnscheduledRecords.length}</span>}
        </button>
      </div>

      {activeMainTab === 'attendance' && (
        <>
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
                <button className={`period-btn ${cutoffPeriod === 'first' ? 'active' : ''}`} onClick={() => setCutoffPeriod('first')}><FiCalendar /> 1st - 15th</button>
                <button className={`period-btn ${cutoffPeriod === 'second' ? 'active' : ''}`} onClick={() => setCutoffPeriod('second')}><FiCalendar /> 16th - End</button>
              </div>
              <div className="month-selector">
                <button className="month-nav-btn" onClick={() => {
                  if (cutoffPeriod === 'first') setCutoffPeriod('second');
                  else { setCutoffPeriod('first'); let m = selectedMonth - 1, y = selectedYear; if (m < 0) { m = 11; y--; } setSelectedMonth(m); setSelectedYear(y); }
                }}><FiChevronLeft /></button>
                <span className="current-month">{new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button className="month-nav-btn" onClick={() => {
                  if (cutoffPeriod === 'second') setCutoffPeriod('first');
                  else { setCutoffPeriod('second'); let m = selectedMonth + 1, y = selectedYear; if (m > 11) { m = 0; y++; } setSelectedMonth(m); setSelectedYear(y); }
                }}><FiChevronRight /></button>
              </div>
            </div>
          </div>

          <div className="attendance-insights-grid">
            <div className="insight-card insight-blue">
              <div className="insight-icon"><FiUsers /></div>
              <div className="insight-info">
                <span className="insight-value">{attendanceTabStats.total}</span>
                <span className="insight-label">Total Records</span>
              </div>
            </div>

            <div className="insight-card insight-green">
              <div className="insight-icon"><FiLogOut style={{ transform: 'rotate(180deg)' }} /></div>
              <div className="insight-info">
                <span className="insight-value">{attendanceTabStats.ins}</span>
                <span className="insight-label">Time Ins</span>
              </div>
            </div>

            <div className="insight-card insight-red">
              <div className="insight-icon"><FiLogOut /></div>
              <div className="insight-info">
                <span className="insight-value">{attendanceTabStats.outs}</span>
                <span className="insight-label">Time Outs</span>
              </div>
            </div>

            <div className="insight-card insight-emerald">
              <div className="insight-icon"><FiCheckCircle /></div>
              <div className="insight-info">
                <span className="insight-value">{attendanceTabStats.verified}</span>
                <span className="insight-label">Verified</span>
              </div>
            </div>

            <div className="insight-card insight-amber">
              <div className="insight-icon"><FiClock /></div>
              <div className="insight-info">
                <span className="insight-value">{attendanceTabStats.pending}</span>
                <span className="insight-label">Pending</span>
              </div>
            </div>

            <div className="insight-card insight-slate">
              <div className="insight-icon"><FiXCircle /></div>
              <div className="insight-info">
                <span className="insight-value">{attendanceTabStats.rejected}</span>
                <span className="insight-label">Rejected</span>
              </div>
            </div>
          </div>

          <div className="search-filter-bar">
            <div className="search-wrapper">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
            </div>
            <button className={`filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}><FiFilter /><span>Filters</span></button>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div className="filters-content">
                <div className="filter-group">
                  <label>Type</label>
                  <div className="filter-options">
                    {['ALL', 'IN', 'OUT'].map(t => <button key={t} className={`filter-option ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>)}
                  </div>
                </div>
                <div className="filter-group">
                  <label>Status</label>
                  <div className="filter-options">
                    {['all', 'pending', 'verified', 'rejected'].map(s => <button key={s} className={`filter-option ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="main-content-scrollable" ref={mainContentRef}>
            <div className="attendance-list">
              {mobileLoading ? <SkeletonTable /> : (
                <>
                  <div className="table-wrapper-scrollable">
                    <table className="attendance-table formal">
                      <thead><tr><th>Date & Time</th><th>Employee</th><th>Type</th><th>Selfie</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {paginatedMobileAttendance.map((record) => {
                          const td = getTypeDetails(record.type);
                          const TIcon = td.icon;

                          const side = record.type === 'IN' ? 'in' : 'out';
                          const sideStatus = getSideStatus(record, side);
                          const sd = getVerificationStatusDetails(sideStatus);
                          const SIcon = sd.icon;

                          return (
                            <tr key={record.event_id || record.id}>
                              <td><div className="datetime-cell"><span className="date">{formatDate(record.timestamp)}</span><span className="time">{formatTime(record.timestamp)}</span></div></td>
                              <td><div className="employee-cell"><span className="employee-name">{record.employee_name || 'N/A'}</span><span className="employee-code">{record.employee_code}</span></div></td>
                              <td><span className={`attendance-type ${record.type === 'IN' ? 'check-in' : 'check-out'}`}><TIcon style={{ transform: td.iconRotation }} /><span>{td.text}</span></span></td>
                              <td>{record.selfie_url ? <button className="selfie-view-btn" onClick={() => { setSelectedSelfie(record.selfie_url); setShowSelfieModal(true); }}><BsCameraFill /><span>View</span></button> : <span className="no-selfie">No selfie</span>}</td>
                              <td>
                                <span
                                  className={`verification-status ${
                                    sideStatus === 'verified' ? 'verified' :
                                    sideStatus === 'rejected' ? 'rejected' : 'pending'
                                  }`}
                                >
                                  <SIcon />
                                  <span>
                                    {sideStatus === 'verified' ? `Verified (${record.type === 'IN' ? 'IN' : 'OUT'})` :
                                     sideStatus === 'rejected' ? `Rejected (${record.type === 'IN' ? 'IN' : 'OUT'})` :
                                     'Pending'}
                                  </span>
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {sideStatus === 'pending' && (
                                    <>
                                      <button
                                        type="button"
                                        title={`Approve this ${record.type === 'IN' ? 'Time In' : 'Time Out'} only`}
                                        onClick={() => handleVerifySide(record, side, 'verified')}
                                        disabled={submitting}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          border: '1px solid #6ee7b7',
                                          background: '#d1fae5',
                                          color: '#065f46',
                                          cursor: submitting ? 'not-allowed' : 'pointer',
                                          opacity: submitting ? 0.5 : 1,
                                        }}
                                      >
                                        <FiCheckCircle size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        title={`Reject this ${record.type === 'IN' ? 'Time In' : 'Time Out'} only`}
                                        onClick={() => handleVerifySide(record, side, 'rejected')}
                                        disabled={submitting}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          border: '1px solid #fca5a5',
                                          background: '#fee2e2',
                                          color: '#991b1b',
                                          cursor: submitting ? 'not-allowed' : 'pointer',
                                          opacity: submitting ? 0.5 : 1,
                                        }}
                                      >
                                        <FiXCircle size={14} />
                                      </button>
                                    </>
                                  )}

                                  {sideStatus === 'verified' && (
                                    <button
                                      type="button"
                                      title="Undo this side back to pending"
                                      onClick={() => handleVerifySide(record, side, 'pending')}
                                      disabled={submitting}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #fcd34d',
                                        background: '#fef3c7',
                                        color: '#b45309',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.5 : 1,
                                      }}
                                    >
                                      <FiRotateCcw size={14} />
                                    </button>
                                  )}

                                  {sideStatus === 'rejected' && (
                                    <button
                                      type="button"
                                      title="Un-reject this side back to pending"
                                      onClick={() => handleVerifySide(record, side, 'pending')}
                                      disabled={submitting}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        background: '#e2e8f0',
                                        color: '#475569',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.5 : 1,
                                      }}
                                    >
                                      <FiRotateCcw size={14} />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="action-icon-btn view"
                                    onClick={() => { setSelectedAttendance(record); setShowAttendanceModal(true); }}
                                  >
                                    <FiEye />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredMobileAttendance.length === 0 && <div className="empty-state"><h3>No attendance records found</h3></div>}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {activeMainTab === 'status-panel' && (
        <div className="status-panel-container">
          <div className="status-panel-header-info">
            <div>
              <span style={{ fontWeight: 'bold' }}>Employee Overview</span>
              <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>History for the selected cutoff</span>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#999' }}>Last updated: {lastRefreshTime.toLocaleTimeString()}</span>
              {employeeOverviewLoading && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#2563eb' }}><FiRefreshCw className="spinning" /> Updating...</span>}
            </div>
          </div>

          <div className="cutoff-selector">
            <div className="cutoff-info">
              <FiCalendarIcon className="cutoff-icon" />
              <div className="cutoff-details">
                <span className="cutoff-label">Payroll Period</span>
                <span className="cutoff-range">{employeeOverviewCutoffLabel}</span>
                {!isCutoffReached(selectedYear, selectedMonth, cutoffPeriod) && <span className="cutoff-warning">Cutoff not yet reached</span>}
              </div>
            </div>
            <div className="cutoff-controls">
              <div className="period-selector">
                <button className={`period-btn ${cutoffPeriod === 'first' ? 'active' : ''}`} onClick={() => setCutoffPeriod('first')}><FiCalendar /> 1st - 15th</button>
                <button className={`period-btn ${cutoffPeriod === 'second' ? 'active' : ''}`} onClick={() => setCutoffPeriod('second')}><FiCalendar /> 16th - End</button>
              </div>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="month-select">
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
              <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="year-input" min="2020" max="2030" />
            </div>
          </div>

          {/* ⭐ NEW #7 — Cutoff insight strip */}
          <div className="cutoff-insights-strip">
            <div className="cutoff-insight-cell">
              <span className="cutoff-insight-value" style={{ color: '#059669' }}>{cutoffInsightTotals.present}</span>
              <span className="cutoff-insight-label">Present Days</span>
            </div>
            <div className="cutoff-insight-cell">
              <span className="cutoff-insight-value" style={{ color: '#dc2626' }}>{cutoffInsightTotals.awol}</span>
              <span className="cutoff-insight-label">AWOL</span>
            </div>
            <div className="cutoff-insight-cell">
              <span className="cutoff-insight-value" style={{ color: '#d97706' }}>{cutoffInsightTotals.ea}</span>
              <span className="cutoff-insight-label">Emergency Absent</span>
            </div>
            <div className="cutoff-insight-cell">
              <span className="cutoff-insight-value" style={{ color: '#4338ca' }}>{cutoffInsightTotals.leave}</span>
              <span className="cutoff-insight-label">On Leave</span>
            </div>
            <div className="cutoff-insight-cell">
              <span className="cutoff-insight-value" style={{ color: '#b45309' }}>{cutoffInsightTotals.lateIn}</span>
              <span className="cutoff-insight-label">Late In</span>
            </div>
          </div>

          <div className="status-panel-filters">
            <select className="filter-select" value={employeeOverviewDepartment} onChange={(e) => setEmployeeOverviewDepartment(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="text" className="filter-search" placeholder="Search employee..." value={employeeOverviewSearch} onChange={(e) => setEmployeeOverviewSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fetchEmployeeOverview(true); }} />
            <button className="refresh-btn" onClick={() => fetchEmployeeOverview(true)} disabled={employeeOverviewLoading}><FiSearch /> Search</button>
            <button className="refresh-btn force-refresh" onClick={() => handleSaveAllAttendance()} disabled={savingAll || submitting}><FiSave /> Save All to Payroll</button>
          </div>

          <div className="status-panel-table-wrapper">
            {employeeOverviewLoading ? <SkeletonStatusPanelTable /> : employeeOverviewEmployees.length > 0 ? (
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
                      <th>Record</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeOverviewEmployees.map((employee) => {
                      const hasUnsaved = (employee.unsaved_count || 0) > 0;
                      const isCurrentPeriod = employee._fetched_for_period === currentPeriodKey;
                      const savedForThisCutoff = isCurrentPeriod && employee.saved_to_payroll;
                      return (
                        <tr key={employee.employee_id}>
                          <td>
                            <div className="employee-info">
                              <div className="employee-avatar" style={{ background: 'linear-gradient(135deg, #3b82f6, #1e40af)' }}>{employee.employee_name?.charAt(0) || '?'}</div>
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
                          {/* ⭐ NEW #7 — Per-employee insight pills */}
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(employee.present_days_count || 0) > 0 && (
                                <span className="flag-badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
                                  {employee.present_days_count}P
                                </span>
                              )}
                              {(employee.awol_count || 0) > 0 && (
                                <span className="flag-badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                  {employee.awol_count} AWOL
                                </span>
                              )}
                              {(employee.emergency_absent_count || 0) > 0 && (
                                <span className="flag-badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}>
                                  {employee.emergency_absent_count} EA
                                </span>
                              )}
                              {(employee.on_leave_count || 0) > 0 && (
                                <span className="flag-badge" style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>
                                  {employee.on_leave_count} Leave
                                </span>
                              )}
                              {(employee.late_in_count || 0) > 0 && (
                                <span className="flag-badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}>
                                  {employee.late_in_count} Late
                                </span>
                              )}
                              {(employee.present_days_count || 0) === 0
                                && (employee.awol_count || 0) === 0
                                && (employee.emergency_absent_count || 0) === 0
                                && (employee.on_leave_count || 0) === 0
                                && (employee.late_in_count || 0) === 0 && (
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                                )}
                            </div>
                          </td>
                          <td>
                            {savedForThisCutoff && !hasUnsaved && (<span className="saved-badge">Saved</span>)}
                            {hasUnsaved && !savedForThisCutoff && (<span className="status-badge pending">Pending</span>)}
                            {hasUnsaved && savedForThisCutoff && (<span className="status-badge partial">Partial ({employee.unsaved_count} unsaved)</span>)}
                          </td>
                          <td>
                            <div className="action-buttons-row">
                              <button className="action-icon-btn view" onClick={() => loadEmployeeOverviewRecords(employee)} disabled={employeeOverviewActionLoading === `view-${employee.employee_id}`} title="View Attendance"><FiEye /></button>
                              <button
                                className="action-icon-btn save"
                                onClick={() => handleSaveSingleEmployeeToPayroll(employee)}
                                disabled={
                                  submitting ||
                                  employeeOverviewActionLoading === `save-${employee.employee_id}` ||
                                  (savedForThisCutoff && !hasUnsaved)
                                }
                                title={
                                  savedForThisCutoff && !hasUnsaved
                                    ? 'Already saved for this cutoff'
                                    : 'Save to Payroll'
                                }
                              >
                                <FiSave />
                              </button>
                              <button className="action-icon-btn more" onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === employee.employee_id ? null : employee.employee_id); }} title="More Actions"><FiMoreVertical size={16} /></button>

                              {dropdownOpen === employee.employee_id && (
                                <div className="pro-dropdown" style={{ right: 0, top: '100%' }}>
                                  <div className="pro-dropdown-header">Actions</div>
                                  <button className="pro-dropdown-item" onClick={() => { handleAddAttendance(employee); setDropdownOpen(null); }}>
                                    <span className="icon-wrapper blue"><FiPlus size={15} /></span>
                                    <div className="text-block"><span className="label">Add Attendance</span><span className="sub-label">Manually add a new record</span></div>
                                  </button>
                                  <button className="pro-dropdown-item" onClick={() => { openRecordModal(employee); setDropdownOpen(null); }}>
                                    <span className="icon-wrapper green"><FiFileText size={15} /></span>
                                    <div className="text-block"><span className="label">Saved Records</span><span className="sub-label">Payroll history + print</span></div>
                                  </button>
                                  <div className="pro-dropdown-divider" />
                                  <button className="pro-dropdown-item" onClick={async () => { await loadEmployeeOverviewRecords(employee); setDropdownOpen(null); }}>
                                    <span className="icon-wrapper purple"><FiEye size={15} /></span>
                                    <div className="text-block"><span className="label">View Attendance</span><span className="sub-label">Open records modal</span></div>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <FiFileText className="empty-icon" />
                <h3>No employees with attendance</h3>
              </div>
            )}
          </div>

          {employeeOverviewSelectedEmployee && (
            <div className="modal-overlay" onClick={() => { setEmployeeOverviewSelectedEmployee(null); cancelInlineEdit(); }}>
              <div className="modal-content" style={{ maxWidth: '1400px', width: '96%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h2>Attendance Records</h2>
                    <p style={{ margin: 0, color: '#374151', fontWeight: 600 }}>{employeeOverviewSelectedEmployee.employee_name}</p>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px' }}>{employeeOverviewCutoffLabel} — Unsaved records</p>
                  </div>
                  <button className="close-modal" onClick={() => { setEmployeeOverviewSelectedEmployee(null); cancelInlineEdit(); }}>×</button>
                </div>
                <div className="modal-body">
                  <div className="attendance-table-wrapper">
                    <table className="status-panel-table">
                      <thead>
                        <tr>
                          <th>Date</th><th>Schedule</th>
                          <th>Time In</th><th>In Status</th>
                          <th>Time Out</th><th>Out Status</th>
                          <th>Flag</th>
                          <th>Reg Hrs</th><th>OT Hrs</th><th>OT Status</th>
                          <th>UT Hrs</th><th>UT Status</th><th>Total</th>
                          <th>Record</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeOverviewSelectedRecords.map((record, index) => {
                          if (!record) return null;
                          const status = getStatusForRecord(record);
                          const otStatus = getOTStatus(record);
                          const utStatus = getUndertimeStatus(record);
                          const isInline = inlineEditRecord && (inlineEditRecord.attendance_id || inlineEditRecord.id) === (record.attendance_id || record.id);
                          const missingTimeIn = !record.time_in || record.time_in === '';
                          const missingTimeOut = !record.time_out || record.time_out === '';

                          const inStatus = getSideStatus(record.attendance_id ?? record.id, 'in');
                          const outStatus = getSideStatus(record.attendance_id ?? record.id, 'out');
                          const flagStyle = getFlagStyle(record.attendance_flag);

                          return (
                            <tr key={record.attendance_id || index} className={isInline ? 'inline-edit-row' : ''}>
                              <td><strong>{record.day || 'N/A'}</strong><br /><span style={{ fontSize: '11px', color: '#6b7280' }}>{formatEmployeeOverviewDate(record.date)}</span></td>
                              <td>{record.assigned_schedule || 'Unscheduled'}</td>

                              <td>
                                {isInline ? (
                                  <input type="datetime-local" className="inline-edit-input" value={inlineEditTimeIn} onChange={(e) => setInlineEditTimeIn(e.target.value)} />
                                ) : (
                                  <span className={missingTimeIn ? 'time-missing' : ''}>
                                    {record.formatted_time_in || 'No Time In'}
                                  </span>
                                )}
                              </td>
                              <td>
                                {missingTimeIn ? (
                                  <span className="event-status-pill pending">N/A</span>
                                ) : (
                                  <div className="event-verify-row">
                                    <span className={`event-status-pill ${inStatus}`}>
                                      {inStatus === 'verified' ? 'VERIFIED' : inStatus === 'rejected' ? 'REJECTED' : 'PENDING'}
                                    </span>
                                    {!isInline && inStatus === 'pending' && (
                                      <>
                                        <button className="event-verify-btn approve" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'in', 'verified')} title="Approve Time In"><FiCheck size={11} /></button>
                                        <button className="event-verify-btn reject" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'in', 'rejected')} title="Reject Time In"><FiX size={11} /></button>
                                      </>
                                    )}
                                    {!isInline && inStatus === 'verified' && (
                                      <button className="event-verify-btn undo" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'in', 'pending')} title="Undo Time In"><FiRotateCcw size={11} /></button>
                                    )}
                                    {!isInline && inStatus === 'rejected' && (
                                      <button className="event-verify-btn undo" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'in', 'pending')} title="Un-reject Time In"><FiRotateCcw size={11} /></button>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td>
                                {isInline ? (
                                  <input type="datetime-local" className="inline-edit-input" value={inlineEditTimeOut} onChange={(e) => setInlineEditTimeOut(e.target.value)} />
                                ) : (
                                  <span className={missingTimeOut ? 'time-missing' : ''}>
                                    {record.formatted_time_out || 'No Time Out'}
                                  </span>
                                )}
                              </td>
                              <td>
                                {missingTimeOut ? (
                                  <span className="event-status-pill pending">N/A</span>
                                ) : (
                                  <div className="event-verify-row">
                                    <span className={`event-status-pill ${outStatus}`}>
                                      {outStatus === 'verified' ? 'VERIFIED' : outStatus === 'rejected' ? 'REJECTED' : 'PENDING'}
                                    </span>
                                    {!isInline && outStatus === 'pending' && (
                                      <>
                                        <button className="event-verify-btn approve" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'out', 'verified')} title="Approve Time Out"><FiCheck size={11} /></button>
                                        <button className="event-verify-btn reject" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'out', 'rejected')} title="Reject Time Out"><FiX size={11} /></button>
                                      </>
                                    )}
                                    {!isInline && outStatus === 'verified' && (
                                      <button className="event-verify-btn undo" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'out', 'pending')} title="Undo Time Out"><FiRotateCcw size={11} /></button>
                                    )}
                                    {!isInline && outStatus === 'rejected' && (
                                      <button className="event-verify-btn undo" onClick={() => handleVerifySide(record.attendance_id ?? record.id, 'out', 'pending')} title="Un-reject Time Out"><FiRotateCcw size={11} /></button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* ⭐ NEW #6 — Flag badge per row */}
                              <td>
                                {flagStyle ? (
                                  <span
                                    className="flag-badge"
                                    style={{
                                      background: flagStyle.bg,
                                      color: flagStyle.color,
                                      border: `1px solid ${flagStyle.border}`,
                                    }}
                                    title={record.flag_notes || flagStyle.label}
                                  >
                                    <FiFlag size={10} /> {flagStyle.label}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                                )}
                              </td>

                              <td>{formatDecimalHours(record.regular_hours)}</td>
                              <td>{formatDecimalHours(record.overtime_hours)}</td>
                              <td><span className={`status-badge ${otStatus.status.toLowerCase()}`}>{otStatus.label}</span></td>
                              <td>{formatDecimalHours(record.undertime_hours)}</td>
                              <td><span className={`status-badge ${utStatus.status.toLowerCase()}`}>{utStatus.label}</span></td>
                              <td><strong>{formatDecimalHours(record.total_hours)}</strong></td>
                              <td><span className={`status-badge ${status.status.toLowerCase().replace('_', '-')}`}>{status.label}</span></td>
                              <td>
                                {isInline ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="action-icon-btn verify" onClick={saveInlineEdit} disabled={inlineEditSaving} title="Save">{inlineEditSaving ? <FiRefreshCw className="spinning" /> : <FiSave />}</button>
                                    <button className="action-icon-btn reject" onClick={cancelInlineEdit} disabled={inlineEditSaving} title="Cancel"><FiX /></button>
                                  </div>
                                ) : (
                                  <div className="action-buttons-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
                                    <button className="action-icon-btn" onClick={() => openInlineEdit(record)} title="Edit Times"><FiEdit2 /></button>

                                    {/* ⭐ NEW #9 — Flag action */}
                                    <button
                                      className="action-icon-btn"
                                      onClick={() => openFlagModal(record)}
                                      title="Flag: AWOL / EA / Leave / Late In"
                                      style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}
                                    >
                                      <FiFlag />
                                    </button>

                                    {inStatus === 'pending' && outStatus === 'pending' && !missingTimeIn && !missingTimeOut && (
                                      <button className="event-verify-btn approve" onClick={() => handleApproveBoth(record)} title="Approve Both Time In & Time Out">
                                        <FiCheckCircle size={11} /> Both
                                      </button>
                                    )}

                                    {status.status === 'REJECTED' && (
                                      <button className="action-icon-btn cancel-reject" onClick={() => handleCancelReject(record)} title="Un-reject"><FiRotateCcw /></button>
                                    )}

                                    {otStatus.status === 'PENDING' && (
                                      <>
                                        <button className="action-icon-btn verify" onClick={() => openOTApprovalModal(record)} title="Approve Overtime"><FiCheckCircle /> OT</button>
                                        <button className="action-icon-btn reject" onClick={() => openOTRejectModal(record)} title="Reject Overtime"><FiXCircle /> OT</button>
                                      </>
                                    )}
                                    {utStatus.status === 'PENDING' && (
                                      <>
                                        <button className="action-icon-btn verify" onClick={() => openUTApprovalModal(record)} title="Approve Undertime"><FiCheckCircle /> UT</button>
                                        <button className="action-icon-btn reject" onClick={() => openUTRejectModal(record)} title="Reject Undertime"><FiXCircle /> UT</button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {employeeOverviewSelectedRecords.length === 0 && (
                      <div className="empty-state">
                        <FiCheckCircle className="empty-icon" />
                        <p>All records have been saved to payroll.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="blue-primary-btn"
                      onClick={handlePrintAttendanceRecords}
                      disabled={employeeOverviewSelectedRecords.length === 0}
                    >
                      <FiPrinter /> Print
                    </button>
                    <button
                      className="blue-primary-btn"
                      onClick={() => handleSaveFromModal()}
                      disabled={submitting || employeeOverviewSelectedRecords.length === 0}
                      title="Save all verified records for this employee to payroll"
                    >
                      {submitting ? <FiRefreshCw className="spinning" /> : <FiSave />} Save to Payroll
                    </button>
                  </div>
                  <button
                    className="modal-btn secondary"
                    onClick={() => { setEmployeeOverviewSelectedEmployee(null); cancelInlineEdit(); }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAddAttendanceModal && addAttendanceEmployee && (
            <div className="modal-overlay" onClick={() => setShowAddAttendanceModal(false)}>
              <div className="modal-content modal-blue-white" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2><FiPlus /> Add Attendance</h2>
                  <button className="close-modal" onClick={() => setShowAddAttendanceModal(false)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="filter-group" style={{ marginBottom: '14px' }}>
                    <label>Employee</label>
                    <input type="text" className="filter-search" value={addAttendanceEmployee.employee_name || ''} readOnly />
                  </div>
                  <div className="filter-group" style={{ marginBottom: '14px' }}>
                    <label>Date</label>
                    <input type="date" className="filter-search" value={addAttendanceDate} onChange={(e) => setAddAttendanceDate(e.target.value)} />
                  </div>
                  <div className="filter-group" style={{ marginBottom: '14px' }}>
                    <label>Time In</label>
                    <input type="time" className="filter-search" value={addAttendanceTimeIn} onChange={(e) => setAddAttendanceTimeIn(e.target.value)} />
                  </div>
                  <div className="filter-group" style={{ marginBottom: '14px' }}>
                    <label>Time Out</label>
                    <input type="time" className="filter-search" value={addAttendanceTimeOut} onChange={(e) => setAddAttendanceTimeOut(e.target.value)} />
                  </div>
                  <div className="filter-group">
                    <label>Notes</label>
                    <textarea className="filter-search" rows="3" value={addAttendanceNotes} onChange={(e) => setAddAttendanceNotes(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="blue-secondary-btn" onClick={() => setShowAddAttendanceModal(false)}>Cancel</button>
                  <button className="blue-primary-btn" onClick={confirmAddAttendance} disabled={submitting}><FiSave /> Create</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeMainTab === 'unscheduled' && (
        <div className="unscheduled-container">
          <div className="unscheduled-header-card">
            <div className="unscheduled-header-left">
              <div className="unscheduled-header-icon">
                <FiAlertTriangle />
              </div>
              <div>
                <h3>Pending Unscheduled Attendance</h3>
                <p>Review and approve or reject unscheduled time-in / time-out records below.</p>
              </div>
            </div>
            <button className="blue-secondary-btn" onClick={fetchPendingUnscheduledRecords} disabled={submitting}>
              <FiRefreshCw /> Refresh
            </button>
          </div>

          <div className="unscheduled-stats">
            <div className="unscheduled-stat">
              <div className="stat-icon blue"><FiAlertCircle /></div>
              <div className="stat-info">
                <span className="stat-value">{pendingUnscheduledRecords.length}</span>
                <span className="stat-label">Total Pending</span>
              </div>
            </div>
            <div className="unscheduled-stat">
              <div className="stat-icon green"><FiLogOut style={{ transform: 'rotate(180deg)' }} /></div>
              <div className="stat-info">
                <span className="stat-value">{pendingUnscheduledRecords.filter(r => r.type === 'IN').length}</span>
                <span className="stat-label">Time Ins</span>
              </div>
            </div>
            <div className="unscheduled-stat">
              <div className="stat-icon red"><FiLogOut /></div>
              <div className="stat-info">
                <span className="stat-value">{pendingUnscheduledRecords.filter(r => r.type === 'OUT').length}</span>
                <span className="stat-label">Time Outs</span>
              </div>
            </div>
          </div>

          {pendingUnscheduledRecords.length === 0 ? (
            <div className="unscheduled-empty-state">
              <div className="unscheduled-empty-icon">
                <FiCheckCircle />
              </div>
              <h3>No Pending Unscheduled Approvals</h3>
              <p>All unscheduled attendance records have been reviewed. You're all caught up.</p>
            </div>
          ) : (
            <div className="unscheduled-table-wrapper">
              <div className="unscheduled-table-header">
                <h4>Attendance Records Awaiting Review</h4>
                <span className="unscheduled-table-count">
                  {pendingUnscheduledRecords.length} record{pendingUnscheduledRecords.length === 1 ? '' : 's'}
                </span>
              </div>
              <table className="unscheduled-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Selfie</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                          <span className="employee-code">{record.employee_code || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`attendance-type-pill ${record.type === 'IN' ? 'in' : 'out'}`}>
                          <FiLogOut style={{ transform: record.type === 'IN' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                          {record.type === 'IN' ? 'Time In' : 'Time Out'}
                        </span>
                      </td>
                      <td>
                        {record.selfie_url ? (
                          <button className="selfie-view-btn" onClick={() => { setSelectedSelfie(record.selfie_url); setShowSelfieModal(true); }}>
                            <BsCameraFill /> View
                          </button>
                        ) : (
                          <span className="no-selfie">No selfie</span>
                        )}
                      </td>
                      <td>
                        <div className="unscheduled-actions">
                          <button
                            className="unscheduled-btn approve"
                            onClick={() => { setSelectedUnscheduledRecord(record); setShowUnscheduledModal(true); }}
                            disabled={submitting}
                          >
                            <FiThumbsUp /> Approve
                          </button>
                          <button
                            className="unscheduled-btn reject"
                            onClick={() => {
                              const reason = prompt('Reason for rejecting:');
                              if (reason && reason.trim()) rejectUnscheduledRecord(record.id, reason);
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

              {pendingUnscheduledRecords.length > unscheduledItemsPerPage && (
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => setUnscheduledPage((p) => Math.max(1, p - 1))}
                    disabled={unscheduledPage === 1}
                  >
                    <FiChevronLeft /> Prev
                  </button>
                  <span className="pagination-info">
                    Page {unscheduledPage} of {totalUnscheduledPages}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setUnscheduledPage((p) => Math.min(totalUnscheduledPages, p + 1))}
                    disabled={unscheduledPage === totalUnscheduledPages}
                  >
                    Next <FiChevronRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showRecordModal && selectedRecordEmployee && (
        <div className="modal-overlay" onClick={() => { setShowRecordModal(false); setEmployeeSavedRecordsSummary(null); }}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '1300px', width: '96%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2><FiFileText /> Saved Records - {selectedRecordEmployee.employee_name}</h2>
                <p style={{ margin: 0, color: '#475569' }}>Payroll history for the selected cutoff</p>
              </div>
              <button className="close-modal" onClick={() => { setShowRecordModal(false); setEmployeeSavedRecordsSummary(null); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="status-panel-filters" style={{ marginBottom: '16px' }}>
                <div className="filter-group">
                  <label>Month</label>
                  <select className="filter-select" value={recordFilterMonth} onChange={(e) => setRecordFilterMonth(parseInt(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => (<option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Year</label>
                  <input type="number" className="filter-search" value={recordFilterYear} onChange={(e) => setRecordFilterYear(parseInt(e.target.value) || new Date().getFullYear())} min="2020" max="2100" />
                </div>
                <div className="filter-group">
                  <label>Cutoff</label>
                  <select className="filter-select" value={recordFilterCutoff} onChange={(e) => setRecordFilterCutoff(e.target.value)}>
                    <option value="first">1 - 15</option>
                    <option value="second">16 - End</option>
                  </select>
                </div>
                <button className="blue-primary-btn" onClick={() => fetchSavedRecords()} disabled={loadingRecords}><FiSearch /> Apply Filters</button>
              </div>

              {loadingRecords ? (
                <div className="loading-container"><div className="loading-spinner"></div><p>Loading saved records...</p></div>
              ) : employeeSavedRecords.length > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', padding: '14px', marginBottom: '16px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '600' }}>Total Regular Hours</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af', marginTop: '4px' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_regular_hours)}</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '600' }}>Total OT Hours</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af', marginTop: '4px' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_overtime_hours)}</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#b45309', textTransform: 'uppercase', fontWeight: '600' }}>Total Undertime</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#b45309', marginTop: '4px' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_undertime_hours)}</div></div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid #93c5fd', paddingLeft: '10px' }}><div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '600' }}>Total Hours</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af', marginTop: '4px' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_hours)}</div></div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid #93c5fd', paddingLeft: '10px' }}><div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '600' }}>Labor Cost</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af', marginTop: '4px' }}>{formatPeso(employeeSavedRecordsSummary?.total_labor_cost)}</div></div>
                  </div>

                  <div className="table-wrapper-scrollable">
                    <table className="status-panel-table">
                      <thead>
                        <tr><th>Date</th><th>Schedule</th><th>Time In</th><th>Time Out</th><th>Regular</th><th>OT</th><th>Undertime</th><th>Total</th><th>Late/UT</th><th>Flag</th><th>Status</th><th>Saved</th></tr>
                      </thead>
                      <tbody>
                        {employeeSavedRecords.map((record) => {
                          const flagStyle = getFlagStyle(record.attendance_flag);
                          return (
                            <tr key={record.attendance_id || record.date}>
                              <td>{formatEmployeeOverviewDate(record.attendance_date || record.date)}</td>
                              <td>{record.assigned_schedule || 'Unscheduled'}</td>
                              <td>{record.formatted_time_in || '—'}</td>
                              <td>{record.formatted_time_out || '—'}</td>
                              <td>{formatDecimalHours(record.regular_hours)}</td>
                              <td>{formatDecimalHours(record.overtime_hours)}</td>
                              <td>{formatDecimalHours(record.undertime_hours)}</td>
                              <td><strong>{formatDecimalHours(record.total_hours)}</strong></td>
                              <td style={{ fontSize: '11px' }}>{record.late_undertime || `${record.late_minutes || 0}L / ${record.undertime_minutes || 0}U`}</td>
                              <td>
                                {flagStyle ? (
                                  <span
                                    className="flag-badge"
                                    style={{ background: flagStyle.bg, color: flagStyle.color, border: `1px solid ${flagStyle.border}` }}
                                  >
                                    {flagStyle.label}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td><span className={`status-badge ${record.verification_status || 'approved'}`}>{record.verification_status || 'Approved'}</span></td>
                              <td style={{ fontSize: '11px', color: '#6b7280' }}>{record.saved_at ? formatDate(record.saved_at) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#eff6ff', fontWeight: '700', borderTop: '2px solid #bfdbfe' }}>
                          <td colSpan="4" style={{ textAlign: 'right', paddingRight: '12px' }}>TOTALS:</td>
                          <td style={{ color: '#1e40af' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_regular_hours)}</td>
                          <td style={{ color: '#1e40af' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_overtime_hours)}</td>
                          <td style={{ color: '#b45309' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_undertime_hours)}</td>
                          <td style={{ color: '#1e40af' }}>{formatDecimalHours(employeeSavedRecordsSummary?.total_hours)}</td>
                          <td colSpan="3" style={{ textAlign: 'right', color: '#1e40af' }}>Labor Cost:</td>
                          <td style={{ color: '#1e40af' }}>{formatPeso(employeeSavedRecordsSummary?.total_labor_cost)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <FiFileText className="empty-icon" />
                  <h3>No saved records found</h3>
                  <p>No payroll records for {new Date(recordFilterYear, recordFilterMonth).toLocaleString('default', { month: 'long', year: 'numeric' })} — {recordFilterCutoff === 'first' ? '1 - 15' : '16 - End'}.</p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="blue-primary-btn" onClick={handlePrintSavedRecords} disabled={loadingRecords || employeeSavedRecords.length === 0}><FiPrinter /> Print</button>
              <button className="blue-secondary-btn" onClick={() => { setShowRecordModal(false); setEmployeeSavedRecordsSummary(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '1300px', width: '96%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2><FiArchive /> Attendance Archive</h2>
                <p style={{ margin: 0, color: '#475569' }}>Select month & cutoff, then click an employee to view their records.</p>
              </div>
              <button className="close-modal" onClick={() => setShowArchiveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="status-panel-filters" style={{ marginBottom: '16px' }}>
                <div className="filter-group"><label>Month</label>
                  <select className="filter-select" value={archiveMonth} onChange={(e) => setArchiveMonth(parseInt(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                  </select>
                </div>
                <div className="filter-group"><label>Year</label>
                  <input type="number" className="filter-search" value={archiveYear} onChange={(e) => setArchiveYear(parseInt(e.target.value) || new Date().getFullYear())} min="2020" max="2100" />
                </div>
                <div className="filter-group"><label>Cutoff</label>
                  <select className="filter-select" value={archiveCutoff} onChange={(e) => setArchiveCutoff(e.target.value)}>
                    <option value="first">1 - 15</option><option value="second">16 - End</option>
                  </select>
                </div>
                <button className="blue-primary-btn" onClick={() => archiveSelectedEmployee && loadArchiveForEmployee(archiveSelectedEmployee)} disabled={!archiveSelectedEmployee}><FiSearch /> Apply Filters</button>
              </div>

              <div className="archive-layout">
                <div>
                  <input type="text" className="filter-search" placeholder="Search employee..." value={archiveSearch} onChange={(e) => setArchiveSearch(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
                  <div className="archive-employee-list">
                    {archiveLoading ? (
                      <div className="loading-container"><div className="loading-spinner"></div></div>
                    ) : filteredArchiveEmployees.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#999' }}>No employees found.</p>
                    ) : (
                      filteredArchiveEmployees.map((emp) => (
                        <div key={emp.employee_id} className={`archive-employee-item ${archiveSelectedEmployee?.employee_id === emp.employee_id ? 'active' : ''}`} onClick={() => loadArchiveForEmployee(emp)}>
                          <div className="avatar">{(emp.employee_name || emp.full_name || '?').charAt(0)}</div>
                          <div>
                            <div className="name">{emp.employee_name || emp.full_name || 'N/A'}</div>
                            <div className="code">{emp.employee_code || emp.employee_id}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  {archiveSelectedEmployee ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <strong>{archiveSelectedEmployee.employee_name}</strong>
                          <span style={{ marginLeft: 10, color: '#6b7280', fontSize: '12px' }}>
                            {new Date(archiveYear, archiveMonth).toLocaleString('default', { month: 'long' })} {archiveCutoff === 'first' ? '1 - 15' : '16 - End'}, {archiveYear} · {archiveRecords.length} record(s)
                          </span>
                        </div>
                        <button className="blue-primary-btn" onClick={handlePrintArchive} disabled={archiveRecords.length === 0}><FiPrinter /> Print</button>
                      </div>
                      {archiveLoadingRecords ? (
                        <div className="loading-container"><div className="loading-spinner"></div></div>
                      ) : archiveRecords.length === 0 ? (
                        <div className="empty-state"><p>No records for this employee in the selected cutoff.</p></div>
                      ) : (
                        <div className="table-wrapper-scrollable" style={{ maxHeight: '480px' }}>
                          <table className="status-panel-table">
                            <thead>
                              <tr><th>Date</th><th>Schedule</th><th>Time In</th><th>Time Out</th><th>Regular</th><th>OT</th><th>UT</th><th>Total</th><th>Flag</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                              {archiveRecords.map((r, idx) => {
                                const flagStyle = getFlagStyle(r.attendance_flag);
                                return (
                                  <tr key={r.attendance_id || idx}>
                                    <td>{formatEmployeeOverviewDate(r.attendance_date || r.date)}</td>
                                    <td>{r.assigned_schedule || 'Unscheduled'}</td>
                                    <td>{r.formatted_time_in || '—'}</td>
                                    <td>{r.formatted_time_out || '—'}</td>
                                    <td>{formatDecimalHours(r.regular_hours)}</td>
                                    <td>{formatDecimalHours(r.overtime_hours)}</td>
                                    <td>{formatDecimalHours(r.undertime_hours)}</td>
                                    <td><strong>{formatDecimalHours(r.total_hours)}</strong></td>
                                    <td>
                                      {flagStyle ? (
                                        <span className="flag-badge" style={{ background: flagStyle.bg, color: flagStyle.color, border: `1px solid ${flagStyle.border}` }}>
                                          {flagStyle.label}
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                                      )}
                                    </td>
                                    <td><span className={`status-badge ${(r.verification_status || r.approval_status || 'pending').toLowerCase()}`}>{r.verification_status || r.approval_status || 'pending'}</span></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-state">
                      <FiArchive className="empty-icon" />
                      <h3>Select an employee</h3>
                      <p style={{ fontSize: '12px', color: '#6b7280' }}>Click any employee on the left to view their archive.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="blue-secondary-btn" onClick={() => setShowArchiveModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showRequirementsModal && requirementsInfo && (
        <div className="modal-overlay" onClick={() => setShowRequirementsModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className={`info-modal-icon ${requirementsInfo.tone}`}>
                  {requirementsInfo.tone === 'warning' ? <FiAlertTriangle /> : <FiInfo />}
                </div>
                <h2 style={{ margin: 0 }}>{requirementsInfo.title}</h2>
              </div>
              <button className="close-modal" onClick={() => setShowRequirementsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: '#334155' }}>{requirementsInfo.message}</p>
              {requirementsInfo.items.length > 0 && (
                <ul className="requirements-list">
                  {requirementsInfo.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => setShowRequirementsModal(false)}>Cancel</button>
              {requirementsInfo.employee && requirementsInfo.items.length > 0 && (
                <button className="blue-primary-btn" onClick={async () => {
                  const emp = requirementsInfo.employee;
                  setShowRequirementsModal(false);
                  await loadEmployeeOverviewRecords(emp);
                }}>
                  <FiArrowRight /> Go to Attendance Records
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCutoffConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowCutoffConfirmModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="info-modal-icon warning"><FiAlertTriangle /></div>
                <h2 style={{ margin: 0 }}>Payroll Cutoff Not Yet Reached</h2>
              </div>
              <button className="close-modal" onClick={() => setShowCutoffConfirmModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>You are about to save attendance for a cutoff that is not yet complete.</p>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                <div><strong>Cutoff:</strong> {employeeOverviewCutoffLabel}</div>
                <div><strong>Ends:</strong> {formatDate(dates.end.toISOString())}</div>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>You can continue, but please verify all records are correct before saving to payroll.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => { setShowCutoffConfirmModal(false); setPendingSaveAction(null); }}>Cancel</button>
              <button className="blue-primary-btn" onClick={() => {
                setShowCutoffConfirmModal(false);
                if (pendingSaveAction === 'save-all') handleSaveAllAttendance(true);
                else if (pendingSaveAction?.type === 'single') handleSaveSingleEmployeeToPayroll(pendingSaveAction.employee, true);
                else if (pendingSaveAction?.type === 'modal') handleSaveFromModal(true);
                setPendingSaveAction(null);
              }}><FiCheckCircle /> Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ NEW #9 — Flag Modal */}
      {showFlagModal && flagRecord && (
        <div className="modal-overlay" onClick={closeFlagModal}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="info-modal-icon warning"><FiFlag /></div>
                <h2 style={{ margin: 0 }}>Flag Attendance Record</h2>
              </div>
              <button className="close-modal" onClick={closeFlagModal} disabled={flagSubmitting}>×</button>
            </div>
            <div className="modal-body">
              <div className="ot-modal-info" style={{ marginBottom: 16 }}>
                <div>
                  <div className="label">Employee</div>
                  <div className="value">{flagRecord.employee_name || 'N/A'}</div>
                </div>
                <div>
                  <div className="label">Date</div>
                  <div className="value">{formatEmployeeOverviewDate(flagRecord.date || flagRecord.attendance_date)}</div>
                </div>
                <div>
                  <div className="label">Time In</div>
                  <div className="value">{flagRecord.formatted_time_in || '—'}</div>
                </div>
                <div>
                  <div className="label">Time Out</div>
                  <div className="value">{flagRecord.formatted_time_out || '—'}</div>
                </div>
              </div>

              <div className="ot-modal-field">
                <label>Flag Type</label>
                <div className="flag-quick-picks">
                  {[
                    { id: 'awol', label: 'AWOL' },
                    { id: 'emergency_absent', label: 'Emergency Absent (EA)' },
                    { id: 'on_leave', label: 'On Leave' },
                    { id: 'late_in', label: 'Late In' },
                    { id: 'none', label: 'Clear flag' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={flagType === id ? 'active' : ''}
                      onClick={() => setFlagType(id)}
                      disabled={flagSubmitting}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {flagType === 'awol' && (
                  <div className="helper">Marking as AWOL will clear any time-in/out on this record.</div>
                )}
                {flagType === 'emergency_absent' && (
                  <div className="helper">Emergency Absent clears times and marks the record as absent.</div>
                )}
                {flagType === 'on_leave' && (
                  <div className="helper">Use when the employee has an approved leave for this day.</div>
                )}
                {flagType === 'late_in' && (
                  <div className="helper">Times stay as-is; the record is tagged as a late check-in.</div>
                )}
                {flagType === 'none' && (
                  <div className="helper">Clears the current flag. Existing time data is not affected.</div>
                )}
              </div>

              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Notes (optional)</label>
                <textarea
                  rows={3}
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  placeholder="Reason or additional context for this flag..."
                  disabled={flagSubmitting}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={closeFlagModal} disabled={flagSubmitting}>Cancel</button>
              <button className="blue-primary-btn" onClick={submitFlag} disabled={flagSubmitting}>
                {flagSubmitting ? <><FiRefreshCw className="spinning" /> Saving...</> : <><FiSave /> Save Flag</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOTApprovalModal && otApprovalRecord && (
        <div className="modal-overlay" onClick={() => !otApprovalSubmitting && setShowOTApprovalModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiClock /> Approve Overtime</h2>
              <button className="close-modal" onClick={() => !otApprovalSubmitting && setShowOTApprovalModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ot-modal-info">
                <div><div className="label">Employee</div><div className="value">{otApprovalRecord.employee_name || 'N/A'}</div></div>
                <div><div className="label">Date</div><div className="value">{formatEmployeeOverviewDate(otApprovalRecord.date)}</div></div>
                <div><div className="label">Recorded OT</div><div className="value">{Number(otApprovalRecord.overtime_hours || 0).toFixed(2)} h</div></div>
                <div><div className="label">Max Approvable</div><div className="value">{Number(otApprovalRecord.overtime_hours || 0).toFixed(2)} h</div></div>
              </div>
              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Approved Overtime Hours <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" min="0" step="0.25" max={Number(otApprovalRecord.overtime_hours || 0)} value={otApprovalHours} onChange={(e) => setOtApprovalHours(parseFloat(e.target.value) || 0)} />
                <div className="helper">Enter the number of hours to approve. Cannot exceed {Number(otApprovalRecord.overtime_hours || 0).toFixed(2)}h.</div>
                <div className="hours-quick-picks">
                  {[0.25, 0.5, 1, 2, 3, 4].filter((h) => h <= Number(otApprovalRecord.overtime_hours || 0)).map((h) => (
                    <button key={h} type="button" className={otApprovalHours === h ? 'active' : ''} onClick={() => setOtApprovalHours(h)}>{h}h</button>
                  ))}
                  <button type="button" className={otApprovalHours === Number(otApprovalRecord.overtime_hours || 0) ? 'active' : ''} onClick={() => setOtApprovalHours(Number(otApprovalRecord.overtime_hours || 0))}>Max</button>
                </div>
              </div>
              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Reason for Approval <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea placeholder="e.g., Approved 3 of 5 hours due to budget constraint." value={otApprovalReason} onChange={(e) => setOtApprovalReason(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => setShowOTApprovalModal(false)} disabled={otApprovalSubmitting}>Cancel</button>
              <button className="blue-primary-btn" onClick={submitOTApproval} disabled={otApprovalSubmitting}>{otApprovalSubmitting ? 'Approving...' : `Approve ${otApprovalHours}h`}</button>
            </div>
          </div>
        </div>
      )}

      {showOTRejectModal && otRejectRecord && (
        <div className="modal-overlay" onClick={() => !otRejectSubmitting && setShowOTRejectModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiXCircle /> Reject Overtime</h2>
              <button className="close-modal" onClick={() => !otRejectSubmitting && setShowOTRejectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ot-modal-info">
                <div><div className="label">Employee</div><div className="value">{otRejectRecord.employee_name || 'N/A'}</div></div>
                <div><div className="label">Date</div><div className="value">{formatEmployeeOverviewDate(otRejectRecord.date)}</div></div>
                <div><div className="label">Recorded OT</div><div className="value">{Number(otRejectRecord.overtime_hours || 0).toFixed(2)} h</div></div>
                <div><div className="label">Decision</div><div className="value" style={{ color: '#dc2626' }}>Rejection</div></div>
              </div>
              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Reason for Rejection <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea
                  placeholder="e.g., OT not pre-approved / outside scope / not required by operations."
                  value={otRejectReason}
                  onChange={(e) => setOtRejectReason(e.target.value)}
                  rows={4}
                />
                <div className="helper">This reason will be recorded against the overtime request.</div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => setShowOTRejectModal(false)} disabled={otRejectSubmitting}>Cancel</button>
              <button
                className="blue-primary-btn"
                style={{ background: '#dc2626' }}
                onClick={submitOTRejection}
                disabled={otRejectSubmitting}
              >
                {otRejectSubmitting ? 'Rejecting...' : (<><FiXCircle /> Reject Overtime</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUTApprovalModal && utApprovalRecord && (
        <div className="modal-overlay" onClick={() => !utApprovalSubmitting && setShowUTApprovalModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiClock /> Approve Undertime</h2>
              <button className="close-modal" onClick={() => !utApprovalSubmitting && setShowUTApprovalModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ot-modal-info">
                <div><div className="label">Employee</div><div className="value">{utApprovalRecord.employee_name || 'N/A'}</div></div>
                <div><div className="label">Date</div><div className="value">{formatEmployeeOverviewDate(utApprovalRecord.date)}</div></div>
                <div><div className="label">Recorded UT</div><div className="value">{Number(utApprovalRecord.undertime_hours || 0).toFixed(2)} h</div></div>
                <div><div className="label">Max Approvable</div><div className="value">{Number(utApprovalRecord.undertime_hours || 0).toFixed(2)} h</div></div>
              </div>
              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Approved Undertime Hours <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" min="0" step="0.25" max={Number(utApprovalRecord.undertime_hours || 0)} value={utApprovalHours} onChange={(e) => setUtApprovalHours(parseFloat(e.target.value) || 0)} />
                <div className="helper">Enter the number of undertime hours to approve. Cannot exceed {Number(utApprovalRecord.undertime_hours || 0).toFixed(2)}h.</div>
                <div className="hours-quick-picks">
                  {[0.25, 0.5, 1, 2].filter((h) => h <= Number(utApprovalRecord.undertime_hours || 0)).map((h) => (
                    <button key={h} type="button" className={utApprovalHours === h ? 'active' : ''} onClick={() => setUtApprovalHours(h)}>{h}h</button>
                  ))}
                  <button type="button" className={utApprovalHours === Number(utApprovalRecord.undertime_hours || 0) ? 'active' : ''} onClick={() => setUtApprovalHours(Number(utApprovalRecord.undertime_hours || 0))}>Max</button>
                </div>
              </div>
              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Reason for Approval <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea placeholder="e.g., Approved due to medical appointment with documentation." value={utApprovalReason} onChange={(e) => setUtApprovalReason(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => setShowUTApprovalModal(false)} disabled={utApprovalSubmitting}>Cancel</button>
              <button className="blue-primary-btn" onClick={submitUTApproval} disabled={utApprovalSubmitting}>{utApprovalSubmitting ? 'Approving...' : `Approve ${utApprovalHours}h`}</button>
            </div>
          </div>
        </div>
      )}

      {showUTRejectModal && utRejectRecord && (
        <div className="modal-overlay" onClick={() => !utRejectSubmitting && setShowUTRejectModal(false)}>
          <div className="modal-content modal-blue-white" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiXCircle /> Reject Undertime</h2>
              <button className="close-modal" onClick={() => !utRejectSubmitting && setShowUTRejectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ot-modal-info">
                <div><div className="label">Employee</div><div className="value">{utRejectRecord.employee_name || 'N/A'}</div></div>
                <div><div className="label">Date</div><div className="value">{formatEmployeeOverviewDate(utRejectRecord.date)}</div></div>
                <div><div className="label">Recorded UT</div><div className="value">{Number(utRejectRecord.undertime_hours || 0).toFixed(2)} h</div></div>
                <div><div className="label">Decision</div><div className="value" style={{ color: '#dc2626' }}>Rejection</div></div>
              </div>
              <div className="ot-modal-field" style={{ marginTop: 16 }}>
                <label>Reason for Rejection <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea
                  placeholder="e.g., Undertime not covered by any leave or approval / schedule was adjusted."
                  value={utRejectReason}
                  onChange={(e) => setUtRejectReason(e.target.value)}
                  rows={4}
                />
                <div className="helper">This reason will be recorded against the undertime decision.</div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => setShowUTRejectModal(false)} disabled={utRejectSubmitting}>Cancel</button>
              <button
                className="blue-primary-btn"
                style={{ background: '#dc2626' }}
                onClick={submitUTRejection}
                disabled={utRejectSubmitting}
              >
                {utRejectSubmitting ? 'Rejecting...' : (<><FiXCircle /> Reject Undertime</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnscheduledModal && selectedUnscheduledRecord && (
        <div className="modal-overlay" onClick={() => setShowUnscheduledModal(false)}>
          <div className="modal-content modal-blue-white unscheduled-approve-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="info-modal-icon warning"><FiAlertTriangle /></div>
                <h2 style={{ margin: 0 }}>Approve Unscheduled Attendance</h2>
              </div>
              <button className="close-modal" onClick={() => setShowUnscheduledModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ot-modal-info" style={{ marginBottom: '16px' }}>
                <div>
                  <div className="label">Employee</div>
                  <div className="value">{selectedUnscheduledRecord.employee_name || 'N/A'}</div>
                </div>
                <div>
                  <div className="label">Date</div>
                  <div className="value">{formatDate(selectedUnscheduledRecord.timestamp)}</div>
                </div>
                <div>
                  <div className="label">Time</div>
                  <div className="value">{formatTime(selectedUnscheduledRecord.timestamp)}</div>
                </div>
                <div>
                  <div className="label">Type</div>
                  <div className="value">{selectedUnscheduledRecord.type === 'IN' ? 'Time In' : 'Time Out'}</div>
                </div>
              </div>

              {selectedUnscheduledRecord.selfie_url && (
                <div className="selfie-preview" style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <img
                    src={selectedUnscheduledRecord.selfie_url}
                    alt="Selfie"
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid #bfdbfe' }}
                  />
                </div>
              )}

              <div className="ot-modal-field">
                <label>Admin Notes</label>
                <textarea
                  rows={3}
                  placeholder="Reason for approving this unscheduled attendance (optional)"
                  value={unscheduledApprovalNote}
                  onChange={(e) => setUnscheduledApprovalNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="blue-secondary-btn" onClick={() => setShowUnscheduledModal(false)} disabled={submitting}>Cancel</button>
              <button
                className="blue-primary-btn"
                onClick={() => approveUnscheduledRecord(selectedUnscheduledRecord.id, unscheduledApprovalNote)}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : (<><FiCheckCircle /> Approve</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAttendanceModal && selectedAttendance && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal-content attendance-details-modal modal-blue-white" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Attendance Details</h2><button className="close-modal" onClick={() => setShowAttendanceModal(false)}><FiXIcon /></button></div>
            <div className="modal-body">
              {selectedAttendance.selfie_url && <div className="selfie-preview"><img src={selectedAttendance.selfie_url} alt="Attendance Selfie" /></div>}
              <div className="details-grid">
                <div className="detail-item"><span className="detail-label">Employee</span><span className="detail-value">{selectedAttendance.employee_name}</span></div>
                <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{formatDate(selectedAttendance.timestamp)}</span></div>
                <div className="detail-item"><span className="detail-label">Time</span><span className="detail-value">{formatTime(selectedAttendance.timestamp)}</span></div>
                <div className="detail-item"><span className="detail-label">Type</span><span className="detail-value">{selectedAttendance.type === 'IN' ? 'Time In' : 'Time Out'}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="blue-secondary-btn" onClick={() => setShowAttendanceModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff_Attendance;