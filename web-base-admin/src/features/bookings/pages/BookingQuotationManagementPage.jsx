import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import {
    Alert,
    Badge,
    Button,
    Calendar,
    Card,
    Col,
    ConfigProvider,
    DatePicker,
    Divider,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Radio,
    Row,
    Select,
    Spin,
    Table,
    Tabs,
    Tag,
    theme as antdTheme,
    Tooltip,
    Typography,
    Steps,
    Space,
    App,
    Progress,
    Empty,
    Statistic,
    List,
    Switch,
    Checkbox,
} from 'antd';

import {
    AppstoreOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    DollarOutlined,
    EditOutlined,
    EnvironmentOutlined,
    TagOutlined,
    ExportOutlined,
    EyeOutlined,
    FileTextOutlined,
    FilterOutlined,
    ForkOutlined,
    LoadingOutlined,
    LockOutlined,
    MailOutlined,
    MenuOutlined,
    MessageOutlined,
    PhoneOutlined,
    PlusOutlined,
    PrinterOutlined,
    ReloadOutlined,
    ScheduleOutlined,
    SearchOutlined,
    SendOutlined,
    StopOutlined,
    TeamOutlined,
    TrophyOutlined,
    UnlockOutlined,
    UserOutlined,
    WalletOutlined,
    WarningOutlined,
    LeftOutlined,
    RightOutlined,
    SyncOutlined,
    InfoCircleOutlined,
    FireOutlined,
        ShoppingOutlined,
    SwapOutlined,
    MoonOutlined,
    SunOutlined,
} from '@ant-design/icons';
import { FaRegCalendarAlt } from "react-icons/fa";

import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, CASHIER_ROLES, hasAllowedRole } from '../../../utils/roleRoutes';

import {
    useBookings,
    useBookingStatistics,
    useCalendarAvailability,
    useCalendarEvents,
    useConfirmBooking,
    useCreateQuotation,
    useDeleteCalendarAvailability,
    useDeleteQuotation,
    useEventTypes,
    useQuotations,
    useRecordPayment,
    useRejectBooking,
    useRejectQuotation,
    useSaveCalendarAvailability,
    useSendQuotation,
    useInsightVisibility,
    useInsightVisibilitySync,
    useUpdateInsightVisibility,
    useBookingChangeSync,
    broadcastBookingChanged,
    normalizeListResponse
} from '../../../hooks/useBookingQuotation';

import '../../../features/bookings/styles/Sales.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// Temporary cap. Real pagination is the long-term fix.
const FETCH_ALL_LIMIT = 200;
const TABLE_SCROLL_HEIGHT = 'calc(100vh - 420px)';
const MIN_TABLE_HEIGHT = 300;

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

const safeArray = (value, defaultValue = []) => {
    if (Array.isArray(value)) return value;
    return defaultValue;
};

const safeObject = (value, defaultValue = {}) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
    return defaultValue;
};

const formatCurrency = (value) => {
    const amount = safeNumber(value);
    return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * ⭐ Hide/Unhide: mask that matches the number of digits in the visible
 * value, so the card never changes width when toggled.
 *
 *   "120"        → "***"           (3 chars)
 *   "1,234"      → "*****"         (5 chars: digits + comma)
 *   "₱12,345.00" → "₱**********"   (10 chars after the sign)
 *   ""           → "************"  (safe fallback)
 */
const maskMatchingValue = (visibleValue) => {
    const str = String(visibleValue ?? '');
    if (!str) return '************';

    const hasCurrency = str.startsWith('₱');
    // Count digits, commas and dots — that's what the user actually sees.
    const visibleLength = str.replace(/[^\d.,]/g, '').length;
    const length = Math.max(3, visibleLength);

    return (hasCurrency ? '₱' : '') + '*'.repeat(length);
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

const formatDateShort = (value) => {
    return formatDateSafe(value, 'MMM DD, YYYY');
};

const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    const dateStr = formatDateSafe(date);
    if (time) return `${dateStr} at ${time}`;
    return dateStr;
};

const formatDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 1;
    try {
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        if (!start.isValid() || !end.isValid()) return 1;
        return Math.max(end.diff(start, 'day') + 1, 1);
    } catch (e) {
        return 1;
    }
};

// ============================================================
// NOTIFICATION HELPER
// ============================================================
const notifyBookingApproved = (bookingId, bookingNo) => {
    try {
        window.dispatchEvent(new CustomEvent('booking-approved', {
            detail: {
                bookingId: bookingId,
                bookingNo: bookingNo,
                message: 'Booking approved successfully',
                timestamp: new Date().toISOString()
            }
        }));
        localStorage.setItem('notifications_updated', Date.now().toString());
    } catch (error) {
        console.warn('Failed to dispatch notification event:', error);
    }
};

const notifyRescheduleRequest = (bookingId, newDate, newTime) => {
    try {
        window.dispatchEvent(new CustomEvent('booking-reschedule-requested', {
            detail: {
                bookingId: bookingId,
                newDate: newDate,
                newTime: newTime,
                timestamp: new Date().toISOString()
            }
        }));
    } catch (error) {
        console.warn('Failed to dispatch reschedule notification:', error);
    }
};

// ============================================================
// UI CONFIGURATION
// ============================================================
const bookingStatusOptions = [
    { value: 'all', label: 'All Active Statuses' },
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'rescheduled', label: 'Rescheduled' },
    { value: 'reschedule_requested', label: 'Reschedule Requested' }
];

const availabilityOperationOptions = [
    { value: 'normal', label: 'Normal Operation' },
    { value: 'limited_slot', label: 'Limited Slot' }
];

const availabilityStatusOptions = [
    { value: 'available', label: 'Available' },
    { value: 'fully_booked', label: 'Fully Booked (No more bookings)' },
    { value: 'unavailable', label: 'Unavailable (Closed/Blocked)' }
];

const timeOptions = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
    '7:00 PM', '8:00 PM'
];

const mealTypeOptions = [
    'Breakfast', 'Morning Snacks', 'Lunch', 'Afternoon Snacks', 'Dinner'
];

const MEAL_SEQUENCE = [...mealTypeOptions];
const DEFAULT_MEAL_TIMES = {
    Breakfast: '8:00 AM',
    'Morning Snacks': '10:00 AM',
    Lunch: '12:00 PM',
    'Afternoon Snacks': '3:00 PM',
    Dinner: '6:00 PM',
};

const normalizeMealLabel = (value) => safeString(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const sortMealServicesChronologically = (services = []) => [...safeArray(services)].sort((a, b) => {
    const dayDifference = safeNumber(a.day_number, 1) - safeNumber(b.day_number, 1);
    if (dayDifference !== 0) return dayDifference;

    const aIndex = MEAL_SEQUENCE.findIndex(type => normalizeMealLabel(type) === normalizeMealLabel(a.meal_type));
    const bIndex = MEAL_SEQUENCE.findIndex(type => normalizeMealLabel(type) === normalizeMealLabel(b.meal_type));
    const normalizedA = aIndex === -1 ? MEAL_SEQUENCE.length : aIndex;
    const normalizedB = bIndex === -1 ? MEAL_SEQUENCE.length : bIndex;
    if (normalizedA !== normalizedB) return normalizedA - normalizedB;

    return safeString(a.serving_time).localeCompare(safeString(b.serving_time));
});

const parseTimeToMinutes = (timeValue) => {
    const match = safeString(timeValue).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return 0;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = safeString(match[3]).toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return (hour * 60) + minute;
};

const getBookingScheduleValue = (booking) => {
    if (!booking) return Number.MAX_SAFE_INTEGER;
    const dateValue = dayjs(booking?.event_date);
    if (!dateValue.isValid()) return Number.MAX_SAFE_INTEGER;
    return dateValue.startOf('day').valueOf() + (parseTimeToMinutes(booking?.event_time) * 60 * 1000);
};

/**
 * ⭐ REQUEST #9: Approved bookings float to the top.
 *
 * Primary sort   → approved status first (confirmed / approved)
 * Secondary sort → existing date+time ordering
 * Tie-break      → booking number
 */
const isApprovedStatusValue = (booking) => {
    const s = safeString(booking?.booking_status).toLowerCase();
    return s === 'confirmed' || s === 'approved';
};

const sortBookingsChronologically = (bookings = []) => [...safeArray(bookings)].sort((a, b) => {
    const aApproved = isApprovedStatusValue(a);
    const bApproved = isApprovedStatusValue(b);

    // Approved always above non-approved.
    if (aApproved !== bApproved) return aApproved ? -1 : 1;

    // Within the same group, keep the existing date+time ordering.
    const scheduleDifference = getBookingScheduleValue(a) - getBookingScheduleValue(b);
    if (scheduleDifference !== 0) return scheduleDifference;
    return safeString(a.booking_no).localeCompare(safeString(b.booking_no));
});

const getMenuItemCategoryText = (item = {}) => {
    const category = typeof item.category === 'string'
        ? item.category
        : item.category?.name || item.category?.category_name || '';
    const tags = Array.isArray(item.tags) ? item.tags.join(' ') : safeString(item.tags);
    return [
        category,
        item.meal_type,
        item.meal_category,
        item.type,
        tags,
        item.name,
    ].map(normalizeMealLabel).filter(Boolean).join(' ');
};

const menuItemMatchesMealType = (item, mealType) => {
    return true;
};

const serviceTypeOptions = [
    { value: 'buffet', label: 'Buffet Service', description: 'Buffet setup with serving stations' },
    { value: 'packed', label: 'Packed Meals', description: 'Individually packed meals' },
    { value: 'tray', label: 'Tray Service', description: 'Tray service with plated meals' }
];

const eventScopeOptions = [
    { value: 'regular', label: 'Regular (1 Day)', description: 'Single day event' },
    { value: 'multi_day', label: 'Multi-Day Event', description: 'Multiple days' }
];

const getStatusConfig = (status) => {
    const config = {
        pending: { text: 'Pending', color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
        pending_approval: { text: 'Pending Approval', color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
        confirmed: { text: 'Confirmed', color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
        completed: { text: 'Completed', color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
        rejected: { text: 'Rejected', color: '#ef4444', background: '#fef2f2', icon: <CloseCircleOutlined /> },
        cancelled: { text: 'Cancelled', color: '#ef4444', background: '#fef2f2', icon: <StopOutlined /> }
    };
    return config[status] || config.pending;
};

const getAvailabilityConfig = (status) => {
    const config = {
        available: { text: 'Available', status: 'success', color: '#10b981', background: '#ecfdf5', icon: <UnlockOutlined /> },
        fully_booked: { text: 'Fully Booked', status: 'warning', color: '#f97316', background: '#fff7ed', icon: <TeamOutlined /> },
        unavailable: { text: 'Unavailable', status: 'error', color: '#ef4444', background: '#fef2f2', icon: <LockOutlined /> }
    };
    return config[status] || config.available;
};

// ============================================================
// SAFE BOOKING HELPERS - WITH NULL CHECKS
// ============================================================
const getBookingLocation = (booking) => {
    if (!booking) return 'N/A';
    return booking.location || booking.venue || booking.delivery_address || 'N/A';
};

const getBookingId = (booking) => {
    if (!booking) return null;
    return booking.id || booking.booking_id;
};

/**
 * ⭐ REQUEST #1: Booking ID colour based on booking source.
 *   mobile  → pink
 *   walk_in / direct web → blue
 * The source is read from whichever field the backend exposes.
 * Falls back to 'web' (blue) when nothing is set.
 */
const getBookingSource = (booking) => {
    if (!booking) return 'web';
    const raw = (
        booking.booking_source ||
        booking.source ||
        booking.created_via ||
        booking.channel ||
        booking.origin ||
        ''
    ).toString().toLowerCase();

    if (raw.includes('mobile') || raw.includes('app')) return 'mobile';
    if (raw.includes('walk')) return 'walk_in';
    return 'web';
};

const getBookingIdColor = (booking) => {
    const source = getBookingSource(booking);
    if (source === 'mobile') {
        return {
            color: '#DB2777',
            background: '#FCE7F3',
            borderColor: '#F9A8D4',
        };
    }
    return {
        color: '#1D4ED8',
        background: '#DBEAFE',
        borderColor: '#93C5FD',
    };
};

/**
 * ⭐ Determines whether a booking has an unpaid deposit whose deadline has
 *    NOT yet passed — the "yellow" pre-warning state.
 *
 * Returns `{ isPending, dueDate, daysUntilDue }` where:
 *   isPending    → true if the row should be highlighted yellow
 *   dueDate      → the deposit due date (dayjs), or null
 *   daysUntilDue → integer days from today (0 = due today), or null
 *
 * Excludes cases where:
 *   • the deposit is already paid
 *   • the booking is not in a confirmed/approved state
 *   • the deposit has been waived, cancelled, or a decision has been made
 *   • the deadline has already passed (that's the red case)
 */
const getDepositPendingState = (booking) => {
    if (!booking) return { isPending: false, dueDate: null, daysUntilDue: null };

    const status = safeString(booking?.booking_status).toLowerCase();
    if (!['confirmed', 'approved', 'ongoing'].includes(status)) {
        return { isPending: false, dueDate: null, daysUntilDue: null };
    }

    // Skip if a decision has already been taken.
    const decision = safeString(booking?.deposit_decision_status).toLowerCase();
    if (['waived', 'cancelled', 'extended'].includes(decision)) {
        // ⭐ An extended deadline is still pending — but only if the
        //    extended_until date is in the future. Handled below.
        if (decision !== 'extended') {
            return { isPending: false, dueDate: null, daysUntilDue: null };
        }
    }

    // ⭐⭐⭐ BUG FIX #1:
    // Yellow appears ONLY when the deposit is UNPAID.
    //
    // We look at the actual payment list — that is the authoritative
    // source of truth. The previous version relied on getDepositAmount,
    // which reads `deposit_amount` (the *required* deposit) and could
    // make a paid booking look unpaid.

    const payments = Array.isArray(booking.payments) ? booking.payments : [];

    const hasCompletedDeposit = payments.some((p) => {
        const s = String(p?.status || '').toLowerCase();
        const t = String(p?.payment_type || '').toLowerCase();
        return s === 'completed' && (t === 'deposit' || t === 'down_payment');
    });

    const hasAnyCompletedPayment = payments.some((p) => {
        const s = String(p?.status || '').toLowerCase();
        const t = String(p?.payment_type || '').toLowerCase();
        return s === 'completed' && t !== 'refund';
    });

    const explicitDepositPaid = safeNumber(booking?.deposit_paid, 0);
    const explicitPaidAmount  = safeNumber(booking?.paid_amount, 0);
    const billingPaid         = safeNumber(booking?.billing_summary?.total_paid, 0);

    const totalPaidFromAnySource =
        explicitDepositPaid +
        explicitPaidAmount +
        billingPaid;

    if (
        hasCompletedDeposit ||
        hasAnyCompletedPayment ||
        totalPaidFromAnySource > 0
    ) {
        return { isPending: false, dueDate: null, daysUntilDue: null };
    }

    // Resolve the effective deadline: extended_until wins over deposit_due_date.
    let dueDate = null;
    const extendedUntil = safeString(booking?.deposit_extended_until);
    if (extendedUntil) {
        const parsed = dayjs(extendedUntil);
        if (parsed.isValid()) dueDate = parsed.startOf('day');
    }
    if (!dueDate) {
        const explicitDue = safeString(booking?.deposit_due_date);
        if (explicitDue) {
            const parsed = dayjs(explicitDue);
            if (parsed.isValid()) dueDate = parsed.startOf('day');
        }
    }
    if (!dueDate) {
        // Fallback: derive from event date minus policy days.
        const eventDate = safeString(booking?.event_date);
        if (eventDate) {
            const event = dayjs(eventDate).startOf('day');
            if (event.isValid()) {
                dueDate = event.subtract(getDepositPaymentDays(booking), 'day');
            }
        }
    }
    if (!dueDate) return { isPending: false, dueDate: null, daysUntilDue: null };

    const today = dayjs().startOf('day');
    const daysUntilDue = dueDate.diff(today, 'day');

    // ⭐ Yellow only when the deadline has NOT been reached yet.
    //    (Deadline reached/passed → red, handled by getBookingRowAlerts.)
    if (daysUntilDue < 0) {
        return { isPending: false, dueDate, daysUntilDue };
    }

    return { isPending: true, dueDate, daysUntilDue };
};

/**
 * ⭐ Returns a list of red-alert reasons for a booking.
 *    - "3-day" warning when the booking is not approved and the event
 *      is 3 days away or closer (and the event has not passed).
 *    - "deposit deadline passed" warning when the booking is approved,
 *      the deposit is unpaid, and the deadline has passed.
 *
 * Empty array = normal row.
 */
const getBookingRowAlerts = (booking) => {
    if (!booking) return [];

    const alerts = [];

    // ⭐⭐⭐ BUG FIX #2:
    // The 3-day red warning is computed ALWAYS on the frontend, from the
    // raw event_date. We no longer trust the backend flags alone, because
    // a stale value silently suppressed the row for admin.
    //
    // Rules (per ticket #11, #12, #13):
    //   • Only when the booking is NOT approved / confirmed
    //   • Only when the event date has NOT already passed
    //   • Only when the event is 3 days away or closer (0, 1, 2, 3)
    //   • Never for cancelled / rejected / completed

    const status = String(booking.booking_status || '').toLowerCase();
    const isApproved = status === 'confirmed' || status === 'approved';
    const isTerminal = ['cancelled', 'rejected', 'completed'].includes(status);

    const eventDate = safeString(booking.event_date);
    let daysUntil = null;
    if (eventDate) {
        const parsed = dayjs(eventDate).startOf('day');
        if (parsed.isValid()) {
            daysUntil = parsed.diff(dayjs().startOf('day'), 'day');
        }
    }

    const isThreeDayWarning =
        !isApproved &&
        !isTerminal &&
        daysUntil !== null &&
        daysUntil >= 0 &&      // ⭐ excludes events that already passed
        daysUntil <= 3;

    if (isThreeDayWarning) {
        const suffix =
            daysUntil === 0
                ? 'TODAY'
                : daysUntil === 1
                    ? 'TOMORROW'
                    : `in ${daysUntil} days`;
        alerts.push(`Event is ${suffix} and booking is still pending approval.`);
    }

    // ⭐ Red on deposit deadline passed + unpaid.
    //    Same fix as Bug #1 — check the payment list, not just the flags.
    const payments = Array.isArray(booking.payments) ? booking.payments : [];
    const hasAnyCompletedPayment = payments.some((p) => {
        const s = String(p?.status || '').toLowerCase();
        const t = String(p?.payment_type || '').toLowerCase();
        return s === 'completed' && t !== 'refund';
    });

    const paidAmount =
        safeNumber(booking.paid_amount, 0) +
        safeNumber(booking.deposit_paid, 0) +
        safeNumber(booking.billing_summary?.total_paid, 0);

    const depositDeadlinePassed =
        Boolean(booking.deposit_deadline_passed) ||
        isDepositOverdue(booking);

    if (
        isApproved &&
        depositDeadlinePassed &&
        !hasAnyCompletedPayment &&
        paidAmount <= 0
    ) {
        alerts.push('Deposit deadline passed — payment is still outstanding.');
    }

    return alerts;
};

/**
 * ⭐ Row class + tooltip title.
 *
 *    Priority:
 *      1. RED  — any of the red conditions above
 *      2. YELLOW — deposit pending (not overdue yet)
 *      3. ''   — normal row
 *
 *    Tooltip combines every active message, one per line.
 *
 *    Returns `{ className, title }` — title is null when no alert.
 */
const getBookingRowDecorations = (booking) => {
    const redAlerts = getBookingRowAlerts(booking);

    if (redAlerts.length > 0) {
        return {
            className: 'bqm-row-alert',
            title: redAlerts.join('\n'),
        };
    }

    const { isPending, dueDate, daysUntilDue } = getDepositPendingState(booking);

    if (isPending) {
        // Build a human-friendly deadline phrase.
        let whenLabel;
        if (daysUntilDue === 0) {
            whenLabel = 'today';
        } else if (daysUntilDue === 1) {
            whenLabel = 'tomorrow';
        } else if (daysUntilDue > 1) {
            whenLabel = `in ${daysUntilDue} days`;
        } else {
            whenLabel = 'soon';
        }

        const formattedDate = dueDate ? dueDate.format('MMM DD, YYYY') : 'the deadline';

        return {
            className: 'bqm-row-warning',
            title: `Deposit payment due on ${formattedDate} (${whenLabel}). Not yet paid.`,
        };
    }

    return { className: '', title: null };
};

const getServiceType = (booking) => {
    if (!booking) return 'Catering Service';
    return booking.service_type || booking.fulfillment_type || booking.delivery_type || 'Catering Service';
};

const getMenuType = (booking) => {
    if (!booking) return 'Customize';
    return booking.menu_selection_type === 'package' ? 'Package' : 'Customize';
};

const getSpecialRequests = (booking) => {
    if (!booking) return 'No special requests';
    return safeString(booking.special_requests, 'No special requests');
};

const getPackageInfo = (booking) => {
    if (!booking) return null;
    return booking.package_summary || booking.selected_package || null;
};

const isBookingToday = (booking) => {
    if (!booking) return false;
    const eventDate = safeString(booking?.event_date);
    if (!eventDate) return false;
    const today = dayjs().format('YYYY-MM-DD');
    return eventDate === today;
};

const isBookingTodayOrPast = (booking) => {
    if (!booking) return false;
    const eventDate = safeString(booking?.event_date);
    if (!eventDate) return false;
    return dayjs(eventDate).isBefore(dayjs().add(1, 'day'));
};

const isBookingConfirmedAndToday = (booking) => {
    if (!booking) return false;
    const status = safeString(booking?.booking_status).toLowerCase();
    return (status === 'confirmed' || status === 'approved') && isBookingToday(booking);
};

const isBookingPendingAndToday = (booking) => {
    if (!booking) return false;
    const status = safeString(booking?.booking_status).toLowerCase();
    return (status === 'pending' || status === 'pending_approval') && isBookingToday(booking);
};

const isBookingSchedulePassed = (booking) => {
    if (!booking) return false;
    const eventDate = safeString(booking?.event_date);
    const eventTime = safeString(booking?.event_time);
    if (!eventDate) return false;
    const scheduledDate = dayjs(`${eventDate} ${eventTime}`);
    if (!scheduledDate.isValid()) return false;
    return scheduledDate.isBefore(dayjs());
};

const splitAddressParts = (details = {}) => {
    if (!details) return { address_line_1: '', city: '', province: '', postal_code: '' };
    const full = safeString(details.customer_address || details.address_line_1 || details.address || '');
    const parts = full.split(',').map(part => part.trim()).filter(Boolean);
    return {
        address_line_1: safeString(details.address_line_1 || parts[0] || full),
        city: safeString(details.city || parts[1] || ''),
        province: safeString(details.province || parts[2] || ''),
        postal_code: safeString(details.postal_code || parts[3] || ''),
    };
};

const renderMealServiceTagText = (meal) => `Day ${meal.day_number || 1} • ${meal.meal_type || 'Meal'} • ${meal.serving_time || '-'}`;

// ============================================================
// POLICY-DRIVEN CUTOFF HELPERS
// ============================================================
const getCancellationCutoffDays = (booking) => {
    return safeNumber(booking?.cancellation_cutoff_days, 3);
};

const getDepositPaymentDays = (booking) => {
    // ⭐ 1. Prefer the policy value the backend already sends.
    //      This works even when deposit_due_date is missing from the row.
    if (
        booking?.deposit_payment_days !== undefined &&
        booking?.deposit_payment_days !== null
    ) {
        const n = safeNumber(booking.deposit_payment_days, NaN);
        if (Number.isFinite(n) && n >= 0) return n;
    }

    // ⭐ 2. Derive from the explicit due date if present.
    const dueDate = safeString(booking?.deposit_due_date);
    const eventDate = safeString(booking?.event_date);
    if (dueDate && eventDate) {
        const diff = dayjs(eventDate).startOf('day').diff(dayjs(dueDate).startOf('day'), 'day');
        if (Number.isFinite(diff) && diff >= 0) return diff;
    }

    // ⭐ 3. Safe fallback.
    return 7;
};

const isBookingWithinCancellationCutoff = (booking) => {
    if (!booking) return false;
    if (typeof booking.is_within_cancellation_cutoff === 'boolean') {
        return booking.is_within_cancellation_cutoff;
    }
    const cutoffDays = getCancellationCutoffDays(booking);
    const eventDate = safeString(booking?.event_date);
    if (!eventDate) return false;
    const event = dayjs(eventDate).startOf('day');
    const today = dayjs().startOf('day');
    if (!event.isValid()) return false;
    const daysUntil = event.diff(today, 'day');
    return daysUntil >= 0 && daysUntil < cutoffDays;
};

const isBookingWithinThreeDays = (booking) => isBookingWithinCancellationCutoff(booking);
const isBookingWithinOneWeek = (booking) => isBookingWithinCancellationCutoff(booking);

const getDaysUntilEvent = (booking) => {
    if (!booking) return null;
    const eventDate = safeString(booking?.event_date);
    if (!eventDate) return null;
    const event = dayjs(eventDate).startOf('day');
    const today = dayjs().startOf('day');
    if (!event.isValid()) return null;
    return event.diff(today, 'day');
};

const getDepositAmount = (booking) => {
    if (!booking) return 0;
    const candidates = [
        booking.deposit_paid,
        booking.billing_summary?.down_payment,
        booking.down_payment,
        booking.deposit_amount,
    ];
    for (const value of candidates) {
        const n = safeNumber(value, 0);
        if (n > 0) return n;
    }
    return 0;
};

const getPaidAmount = (booking) => {
    if (!booking) return 0;

    // ⭐ Prefer the payment list — it is authoritative because each row
    //    has its own status and payment_type.
    const payments = Array.isArray(booking.payments) ? booking.payments : [];
    const completedFromPayments = payments
        .filter((p) => String(p?.status || '').toLowerCase() === 'completed')
        .filter((p) => String(p?.payment_type || '').toLowerCase() !== 'refund')
        .reduce((sum, p) => sum + safeNumber(p?.amount), 0);

    if (completedFromPayments > 0) return completedFromPayments;

    // Fallback to the flat scalar fields.
    return safeNumber(
        booking.paid_amount ||
        booking.billing_summary?.total_paid ||
        0
    );
};

const hasRefundRequest = (booking) => {
    if (!booking) return false;
    const status = safeString(booking.refund_status).toLowerCase();
    return status === 'pending' || status === 'pending_approval';
};

const getRefundStatusConfig = (status) => {
    const config = {
        pending:          { text: 'Refund Pending',   color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
        pending_approval: { text: 'Refund Pending',   color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
        approved:         { text: 'Refund Approved',  color: '#3b82f6', background: '#eff6ff', icon: <CheckCircleOutlined /> },
        released:         { text: 'Refund Released',  color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
        processed:        { text: 'Refund Released',  color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
        rejected:         { text: 'Refund Rejected',  color: '#ef4444', background: '#fef2f2', icon: <CloseCircleOutlined /> },
    };
    return config[safeString(status).toLowerCase()] || null;
};

const getDepositDueDate = (booking) => {
    if (!booking) return null;
    const explicit = safeString(booking?.deposit_due_date);
    if (explicit) {
        const parsed = dayjs(explicit);
        if (parsed.isValid()) return parsed;
    }
    const eventDate = safeString(booking?.event_date);
    if (!eventDate) return null;
    const event = dayjs(eventDate).startOf('day');
    if (!event.isValid()) return null;
    return event.subtract(getDepositPaymentDays(booking), 'day');
};

const isDepositOverdue = (booking) => {
    if (!booking) return false;

    const status = safeString(booking?.booking_status).toLowerCase();
    if (!['confirmed', 'approved', 'ongoing'].includes(status)) return false;

    const decision = safeString(booking?.deposit_decision_status).toLowerCase();
    if (decision === 'waived' || decision === 'cancelled') return false;

    const depositPaid = getDepositAmount(booking);
    const paidAmount = getPaidAmount(booking);
    if (depositPaid > 0 || paidAmount > 0) return false;

    if (booking?.is_late_booking === true && !booking?.deposit_decision_status) return false;

    const extendedUntil = safeString(booking?.deposit_extended_until);
    if (extendedUntil) {
        const parsed = dayjs(extendedUntil);
        if (parsed.isValid()) {
            const today = dayjs().startOf('day');
            const deadline = parsed.startOf('day');
            return today.isAfter(deadline) || today.isSame(deadline, 'day');
        }
    }

    if (!safeString(booking?.deposit_due_date)) return false;

    const dueDate = getDepositDueDate(booking);
    if (!dueDate) return false;
    const today = dayjs().startOf('day');
    return today.isAfter(dueDate.startOf('day')) || today.isSame(dueDate, 'day');
};

const hasPendingRefundRequest = (booking) => {
    if (!booking) return false;
    const status = safeString(booking?.refund_status).toLowerCase();
    return status === 'pending' || status === 'pending_approval' || status === 'approved';
};

const getDepositStateLabel = (status) => {
    const config = {
        cancelled: { text: 'Deposit Cancelled', color: '#ef4444', background: '#fef2f2', icon: <CloseCircleOutlined /> },
        extended: { text: 'Deposit Extended', color: '#3b82f6', background: '#eff6ff', icon: <ScheduleOutlined /> },
        waived: { text: 'Deposit Waived', color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
    };
    return config[safeString(status).toLowerCase()] || null;
};

const isRefundPending = (booking) => {
    if (!booking) return false;
    const status = safeString(booking.refund_status).toLowerCase();
    return status === 'pending';
};

const isRefundApproved = (booking) => {
    if (!booking) return false;
    const status = safeString(booking.refund_status).toLowerCase();
    return status === 'approved';
};

const isRefundFinalized = (booking) => {
    if (!booking) return false;
    const status = safeString(booking.refund_status).toLowerCase();
    return status === 'released' || status === 'rejected';
};

const isCancellationInProgress = (booking) => {
    if (!booking) return false;
    const status = safeString(booking.refund_status).toLowerCase();
    if (status === 'pending' || status === 'pending_approval') return true;
    if (status === 'approved') return true;
    if (Boolean(booking.refund_admin_direct)) return true;
    if (Boolean(booking.refund_request_state?.admin_direct)) return true;
    if (Boolean(booking.cancellation_in_progress)) return true;
    return false;
};

// ============================================================
// SKELETON LOADING COMPONENTS (Light Gray)
// ============================================================

const SkeletonText = ({ width = '100%', height = 14, style = {} }) => (
  <div className="bqm-skeleton-text" style={{ width, height, ...style }} />
);

const SkeletonCircle = ({ size = 48, style = {} }) => (
  <div
    className="bqm-skeleton-circle"
    style={{ width: size, height: size, minWidth: size, ...style }}
  />
);

const SkeletonHeaderRight = () => (
  <>
    <div className="bqm-skeleton-block bqm-header-skeleton-btn" />
    <div className="bqm-skeleton-block bqm-header-skeleton-btn" />
    <div className="bqm-skeleton-block bqm-header-skeleton-btn" />
  </>
);

const SkeletonKpiCard = ({ delay = 0 }) => (
  <div
    className="bqm-kpi-skeleton-card bqm-skeleton-card"
    style={{ animationDelay: `${delay}s` }}
  >
    <SkeletonCircle size={52} style={{ borderRadius: 14 }} />
    <div className="bqm-kpi-skeleton-info">
      <SkeletonText width={120} height={22} />
      <SkeletonText width={90} height={12} />
    </div>
  </div>
);

const SkeletonKpiGrid = () => (
  <div className="bqm-kpi-skeleton-grid">
    {Array.from({ length: 4 }).map((_, i) => (
      <SkeletonKpiCard key={i} delay={i * 0.05} />
    ))}
  </div>
);

const SkeletonTableRow = ({ delay = 0 }) => {
  const rowWidths = [
    [90, 60, 130, 80],
    [80, 70, 120, 90],
    [100, 55, 140, 75],
    [85, 65, 135, 85],
    [95, 60, 125, 80],
  ];
  const widths = rowWidths[Math.floor(Math.random() * rowWidths.length)];

  return (
    <div
      className="bqm-table-skeleton-row bqm-skeleton-card"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Booking # pill */}
      <SkeletonText width={80} height={24} style={{ borderRadius: 20 }} />

      {/* Customer avatar + two bars */}
      <div className="bqm-table-skeleton-cell">
        <SkeletonCircle size={26} />
        <div className="bqm-table-skeleton-cell-stack">
          <SkeletonText width={widths[0]} height={12} />
          <SkeletonText width={widths[1]} height={10} />
        </div>
      </div>

      {/* Event date/location stack */}
      <div className="bqm-table-skeleton-cell-stack">
        <SkeletonText width={widths[2]} height={12} />
        <SkeletonText width={widths[3]} height={10} />
      </div>

      {/* Service type */}
      <SkeletonText width={90} height={12} />

      {/* Pax pill */}
      <SkeletonText width={55} height={20} style={{ borderRadius: 20 }} />

      {/* Amount */}
      <SkeletonText width={90} height={14} />

      {/* Status pill */}
      <SkeletonText width={110} height={22} style={{ borderRadius: 20 }} />

      {/* Action icons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <SkeletonCircle size={30} style={{ borderRadius: 8 }} />
        <SkeletonCircle size={30} style={{ borderRadius: 8 }} />
        <SkeletonCircle size={30} style={{ borderRadius: 8 }} />
      </div>
    </div>
  );
};

const SkeletonTable = ({ rows = 10 }) => (
  <div className="bqm-table-skeleton bqm-skeleton-card">
    <div className="bqm-table-skeleton-header">
      <SkeletonCircle size={22} style={{ borderRadius: 6 }} />
      <SkeletonText width={180} height={16} />
      <SkeletonText width={120} height={12} style={{ marginLeft: 'auto' }} />
    </div>
    <div className="bqm-table-skeleton-body">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} delay={i * 0.05} />
      ))}
    </div>
  </div>
);

const BookingSkeleton = () => (
  <div className="bqm-container bqm-skeleton-container">
    {/* Header skeleton */}
    <div className="bqm-header">
      <div className="bqm-header-left">
        <div
          className="bqm-logo-icon bqm-logo-icon-skeleton"
          style={{
            background: '#e5e7eb',
            color: 'transparent',
            opacity: 1,
          }}
        >
          <FaRegCalendarAlt style={{ color: 'transparent' }} />
        </div>
        <div className="bqm-header-info">
          <SkeletonText width={240} height={20} style={{ marginBottom: 6 }} />
          <SkeletonText width={120} height={10} />
        </div>
      </div>
      <div className="bqm-header-right">
        <SkeletonText width={180} height={32} style={{ borderRadius: 10 }} />
        <SkeletonHeaderRight />
      </div>
    </div>

    {/* KPI cards */}
    <SkeletonKpiGrid />

    {/* Main card + table */}
    <div className="bqm-main-card" style={{ padding: 0 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bqm-border)' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <SkeletonText width={100} height={20} />
          <SkeletonText width={100} height={20} />
          <SkeletonText width={100} height={20} />
        </div>
      </div>
          <SkeletonTable rows={12} />
    </div>
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

const BookingQuotationManagement = () => {
    const location = useLocation();
    const { user } = useAuth();
    const canApproveOperations = hasAllowedRole(user, ADMIN_ROLES);
    const isCashierOnly = hasAllowedRole(user, CASHIER_ROLES) && !canApproveOperations;
    const { message, modal } = App.useApp();

        const [activeMainTab, setActiveMainTab] = useState('bookings');
    const [activeBookingTab, setActiveBookingTab] = useState('regular');

    useEffect(() => {
        const requestedView = new URLSearchParams(location.search).get('view');
        if (['bookings', 'quotations', 'history', 'calendar', 'refund-requests'].includes(requestedView)) {
            setActiveMainTab(requestedView);
        }
    }, [location.search]);

    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEventType, setFilterEventType] = useState('all');
    const [filterDateRange, setFilterDateRange] = useState([]);

    const [historySearchText, setHistorySearchText] = useState('');
    const [historyBookingId, setHistoryBookingId] = useState('');
    const [historyCustomerName, setHistoryCustomerName] = useState('');
    const [historyStatus, setHistoryStatus] = useState('all');
    const [historyEventType, setHistoryEventType] = useState('all');
    const [historyDateRange, setHistoryDateRange] = useState([]);

    const [calendarMode, setCalendarMode] = useState('month');
    const [calendarCursor, setCalendarCursor] = useState(dayjs());
    const [selectedCalendarDate, setSelectedCalendarDate] = useState(dayjs());

      const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = (localStorage.getItem('theme') || '').toLowerCase();
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });

    const [selectedBooking, setSelectedBooking] = useState(null);
    const [editingBooking, setEditingBooking] = useState(null);
    const [bookingStep, setBookingStep] = useState(0);

    const [bookingDetailsModalVisible, setBookingDetailsModalVisible] = useState(false);
    const [quotationModalVisible, setQuotationModalVisible] = useState(false);
    const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
    const [rejectReasonModalVisible, setRejectReasonModalVisible] = useState(false);
    const [cancelReasonModalVisible, setCancelReasonModalVisible] = useState(false);
    const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);

    // ⭐ Cancel reschedule proposal modal
    const [cancelRescheduleModalVisible, setCancelRescheduleModalVisible] = useState(false);
    const [cancelRescheduleBooking, setCancelRescheduleBooking] = useState(null);
    const [cancelRescheduleReason, setCancelRescheduleReason] = useState('');
    const [cancelRescheduleSubmitting, setCancelRescheduleSubmitting] = useState(false);

    const [todayBookingModalVisible, setTodayBookingModalVisible] = useState(false);
    const [todayBookingData, setTodayBookingData] = useState(null);
    const [todayBookingAction, setTodayBookingAction] = useState(null);

    const [startEventModalVisible, setStartEventModalVisible] = useState(false);
    const [startEventBookingData, setStartEventBookingData] = useState(null);

    const [threeDayWarningModalVisible, setThreeDayWarningModalVisible] = useState(false);
    const [threeDayWarningBooking, setThreeDayWarningBooking] = useState(null);

    const [cancelWithRefundModalVisible, setCancelWithRefundModalVisible] = useState(false);
    const [refundApprovalModalVisible, setRefundApprovalModalVisible] = useState(false);
    const [refundApprovalBooking, setRefundApprovalBooking] = useState(null);
    const [refundApprovalForm] = Form.useForm();

    const [cancelWithRefundForm] = Form.useForm();

    const [confirmRefundModalVisible, setConfirmRefundModalVisible] = useState(false);
    const [confirmRefundBooking, setConfirmRefundBooking] = useState(null);
    const [confirmRefundForm] = Form.useForm();

    const [adminDepositAction, setAdminDepositAction] = useState('cancel');
    const [adminDepositForm] = Form.useForm();

    const [lateApprovalModalVisible, setLateApprovalModalVisible] = useState(false);
    const [lateApprovalBooking, setLateApprovalBooking] = useState(null);
    const [lateApprovalAction, setLateApprovalAction] = useState('waive');
    const [lateApprovalExtensionDays, setLateApprovalExtensionDays] = useState(7);
    const [lateApprovalNotes, setLateApprovalNotes] = useState('');
    const [lateApprovalSubmitting, setLateApprovalSubmitting] = useState(false);

    const [depositOverdueModalVisible, setDepositOverdueModalVisible] = useState(false);
    const [depositOverdueBooking, setDepositOverdueBooking] = useState(null);
    const [depositDecisionAction, setDepositDecisionAction] = useState('extend');
    const [depositDecisionForm] = Form.useForm();

    const [refundApprovalAction, setRefundApprovalAction] = useState('with_refund');

    const [addMealModalVisible, setAddMealModalVisible] = useState(false);
    const [pendingMealDay, setPendingMealDay] = useState(null);
    const [pendingMealType, setPendingMealType] = useState(null);
    const [menuSelectionModalVisible, setMenuSelectionModalVisible] = useState(false);
    const [selectedMealId, setSelectedMealId] = useState(null);
    const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
    const [menuViewMode, setMenuViewMode] = useState('grid');
    const [menuSelectionMode, setMenuSelectionMode] = useState('menu_items');

    const [createBookingStep, setCreateBookingStep] = useState(0);
    const [serviceType, setServiceType] = useState('buffet');
    const [eventScope, setEventScope] = useState('regular');
    const [multiDayDays, setMultiDayDays] = useState(2);

    const [modalPricingType, setModalPricingType] = useState('per_pax');
    const [modalSelectedIds, setModalSelectedIds] = useState([]);

    const createDefaultMealService = (overrides = {}) => ({
        id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        day_number: 1,
        service_date: null,
        meal_type: 'Lunch',
        serving_time: '12:00 PM',
        preparation_time: '10:00 AM',
        dispatch_time: '11:00 AM',
        arrival_time: '11:30 AM',
        pax: 10,
        menu_source: 'custom',
        package_id: null,
        menu_item_id: null,
        menu_name: '',
        menu_description: '',
        filters: [],
        custom_items: [],
        price_per_head: 0,
        total_meal_amount: 0,
        notes: '',
        meal_status: 'pending',
        tray_price: 0,
        tray_servings: 25,
        tray_min_pax: 20,
        tray_max_pax: 25,
        tray_description: '',
        tray_quantity: 1,
        ...overrides
    });

    const [mealServices, setMealServices] = useState([]);
    const sortedMealServices = useMemo(() => sortMealServicesChronologically(mealServices), [mealServices]);
    const guestCountRef = useRef(10);
    const [billingAdjustments, setBillingAdjustments] = useState({
        transportation_fee: 0,
        setup_fee: 0,
        service_crew_fee: 0,
        equipment_rental: 0,
        extra_food_fee: 0,
        discount: 0,
        down_payment: 0
    });

    const [menuSelectionType, setMenuSelectionType] = useState('customize');
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [selectedPromo, setSelectedPromo] = useState(null);
    const [selectedMenuItems, setSelectedMenuItems] = useState([]);
    const [menuItemsList, setMenuItemsList] = useState([]);
    const [packagesList, setPackagesList] = useState([]);
    const [promosList, setPromosList] = useState([]);
    const [isLoadingMenuData, setIsLoadingMenuData] = useState(false);

    const [formValues, setFormValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const saveLockRef = useRef(false);

       // ⭐ Cancelable loading line (shows above the action)
    const [loadingLine, setLoadingLine] = useState(null);
    const loadingLineRef = useRef(null);
    const loadingLineTimerRef = useRef(null);
    const [quotationForm] = Form.useForm();
    const [availabilityForm] = Form.useForm();
    const [rejectForm] = Form.useForm();
    const [cancelForm] = Form.useForm();
    const [rescheduleForm] = Form.useForm();

    const calendarRange = useMemo(() => {
        return {
            start: calendarCursor.startOf('month').subtract(7, 'day').format('YYYY-MM-DD'),
            end: calendarCursor.endOf('month').add(7, 'day').format('YYYY-MM-DD')
        };
    }, [calendarCursor]);

    const ACTIVE_BOOKING_STATUS_EXCLUSIONS = 'completed,cancelled,rejected';
    const HISTORY_BOOKING_STATUSES = 'completed,cancelled,rejected';

        const buildBookingParams = useCallback((scope, status = filterStatus, search = debouncedSearchText) => {
        const params = {
            booking_scope: scope,
            sort: 'event_schedule',
            per_page: FETCH_ALL_LIMIT
        };

        if (status !== 'all') {
            params.status = status;
        } else {
            params.status_not_in = ACTIVE_BOOKING_STATUS_EXCLUSIONS;
        }

        if (filterEventType !== 'all') {
            params.event_type_id = filterEventType;
        }

        if (search && search.trim()) {
            params.search = search.trim();
        }

              if (filterDateRange?.length === 2) {
            params.date_from = dayjs(filterDateRange[0]).format('YYYY-MM-DD');
            params.date_to = dayjs(filterDateRange[1]).format('YYYY-MM-DD');
        }

        return params;
    }, [filterStatus, debouncedSearchText, filterEventType, filterDateRange]);

      const buildHistoryParams = useCallback(() => {
        const combinedSearch = [historySearchText, historyBookingId, historyCustomerName]
            .map((value) => safeString(value).trim())
            .filter(Boolean)
            .join(' ');

        const params = {
            per_page: FETCH_ALL_LIMIT
        };

        if (historyStatus !== 'all') {
            params.status = historyStatus;
        } else {
            params.status_in = HISTORY_BOOKING_STATUSES;
        }

        if (historyEventType !== 'all') {
            params.event_type_id = historyEventType;
        }

        if (combinedSearch) {
            params.search = combinedSearch;
        }

        if (historyBookingId.trim()) {
            params.booking_id = historyBookingId.trim();
        }

        if (historyCustomerName.trim()) {
            params.customer_name = historyCustomerName.trim();
        }

             if (historyDateRange?.length === 2) {
            params.date_from = dayjs(historyDateRange[0]).format('YYYY-MM-DD');
            params.date_to = dayjs(historyDateRange[1]).format('YYYY-MM-DD');
        }

        return params;
    }, [historySearchText, historyBookingId, historyCustomerName, historyStatus, historyEventType, historyDateRange]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchText(searchText);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchText]);
    const regularParams = useMemo(() => buildBookingParams('regular'), [buildBookingParams]);
    const multiDayParams = useMemo(() => buildBookingParams('multi_day'), [buildBookingParams]);
    const historyParams = useMemo(() => buildHistoryParams(), [buildHistoryParams]);

    const {
        data: regularBookingsData,
        isLoading: regularBookingsLoading,
        refetch: refetchRegularBookings
    } = useBookings(regularParams);

    const {
        data: multiDayBookingsData,
        isLoading: multiDayBookingsLoading,
        refetch: refetchMultiDayBookings
    } = useBookings(multiDayParams);

    const {
        data: completedBookingsData,
        isLoading: completedBookingsLoading,
        refetch: refetchCompletedBookings
    } = useBookings(historyParams);

    const { data: statistics, refetch: refetchStatistics } = useBookingStatistics();

      const quotationParams = useMemo(() => ({
        per_page: FETCH_ALL_LIMIT,
        status_in: 'pending,approved',
        search: debouncedSearchText.trim() || undefined,
    }), [debouncedSearchText]);

    const {
        data: quotationsData,
        isLoading: quotationsLoading,
        refetch: refetchQuotations
       } = useQuotations(quotationParams);
    const { data: eventTypesData } = useEventTypes();
    const calendarEnabled = activeMainTab === 'calendar';
    const { data: calendarEvents, refetch: refetchCalendarEvents } = useCalendarEvents(
        calendarEnabled ? calendarRange : { ...calendarRange, __skip: true },
        { enabled: calendarEnabled }
    );
    const { data: calendarAvailabilityData, refetch: refetchCalendarAvailability } = useCalendarAvailability(
        calendarEnabled ? calendarRange : { ...calendarRange, __skip: true },
        { enabled: calendarEnabled }
    );
    // ⭐ Hide/Unhide: read + write the persisted visibility map.
    const { data: insightVisibility } = useInsightVisibility();
    const updateInsightVisibilityMutation = useUpdateInsightVisibility();

    // ⭐ Keeps cashier tabs in sync when admin toggles in another tab,
    //    in the same browser (BroadcastChannel) or across devices (15s poll).
    useInsightVisibilitySync();

    // ⭐ Keeps every open tab (admin, cashier, super-admin) in sync when
    //    anyone mutates a booking — deposit date changes, extensions,
    //    cancellations, approvals, etc.
    useBookingChangeSync();

    // Local mirror so the toggle is instant — the server response later
    // confirms (or rolls back) the optimistic change.
    const [localInsightVisibility, setLocalInsightVisibility] = useState(null);

    useEffect(() => {
        if (insightVisibility && localInsightVisibility === null) {
            setLocalInsightVisibility(insightVisibility);
        }
    }, [insightVisibility, localInsightVisibility]);

    // Effective state, resolved from local first, server second.
    const effectiveVisibility = localInsightVisibility || insightVisibility || {
        total_approved: false,
        total_revenue: false,
        rejected: false,
    };

    // ⭐ Admin-only. Cashiers never get the toggle button.
    const canToggleInsightVisibility = canApproveOperations;

    const handleToggleInsight = useCallback((key) => {
        if (!canToggleInsightVisibility) {
            message.warning('Only administrators can hide or unhide insight values.');
            return;
        }

        const current = effectiveVisibility;
        const next = { ...current, [key]: !current[key] };

        // Optimistic flip.
        setLocalInsightVisibility(next);

        updateInsightVisibilityMutation.mutate(next, {
            onError: () => {
                // Roll back if the server rejects the change.
                setLocalInsightVisibility(current);
            },
        });
    }, [
        canToggleInsightVisibility,
        effectiveVisibility,
        updateInsightVisibilityMutation,
        message,
    ]);
    const confirmBookingMutation = useConfirmBooking();
    const rejectBookingMutation = useRejectBooking();
    const createQuotationMutation = useCreateQuotation();
    const rejectQuotationMutation = useRejectQuotation();
    const sendQuotationMutation = useSendQuotation();
    const deleteQuotationMutation = useDeleteQuotation();
    const saveCalendarAvailabilityMutation = useSaveCalendarAvailability();
    const deleteCalendarAvailabilityMutation = useDeleteCalendarAvailability();

    const isActiveBookingStatus = (status) => !['completed', 'cancelled', 'rejected'].includes(safeString(status));

    const regularBookingsDataNormalized = normalizeListResponse(regularBookingsData);
    const regularBookings = sortBookingsChronologically(
        safeArray(regularBookingsDataNormalized?.data).filter((booking) => isActiveBookingStatus(booking.booking_status))
    );
    const regularBookingsTotal = safeNumber(regularBookingsDataNormalized?.total, regularBookings.length);

    const multiDayBookingsDataNormalized = normalizeListResponse(multiDayBookingsData);
    const multiDayBookings = sortBookingsChronologically(
        safeArray(multiDayBookingsDataNormalized?.data).filter((booking) => isActiveBookingStatus(booking.booking_status))
    );
    const multiDayBookingsTotal = safeNumber(multiDayBookingsDataNormalized?.total, multiDayBookings.length);

    const completedBookingsDataNormalized = normalizeListResponse(completedBookingsData);
    const completedBookings = safeArray(completedBookingsDataNormalized?.data);
    const completedBookingsTotal = safeNumber(completedBookingsDataNormalized?.total, completedBookings.length);

    const quotations = safeArray(quotationsData?.data).filter((quotation) => {
        const bookingStatus = safeString(quotation.booking_status).toLowerCase();
        return ['approved', 'confirmed'].includes(bookingStatus) && bookingStatus !== 'cancelled';
    });
    const quotationsTotal = safeNumber(quotationsData?.total, quotations.length);

    const eventTypes = safeArray(eventTypesData?.data);
    const events = safeArray(calendarEvents);
    const calendarAvailability = safeArray(calendarAvailabilityData?.data);

      const stats = safeObject(statistics?.data || statistics, {
        total_bookings: 0, pending_approvals: 0, total_revenue: 0,
        total_paid: 0, total_outstanding: 0, regular_bookings: 0, multi_day_events: 0
    });

    // ⭐ REQUEST #3, #4, #5: Derive the four KPI cards from the actual
    // booking lists so the counts are always status-accurate.
    const allLoadedBookings = useMemo(() => {
        const combined = [
            ...safeArray(regularBookings),
            ...safeArray(multiDayBookings),
            ...safeArray(completedBookings),
        ];
        const seen = new Set();
        return combined.filter((b) => {
            const id = getBookingId(b);
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [regularBookings, multiDayBookings, completedBookings]);

    const approvedBookingsCount = useMemo(
        () => allLoadedBookings.filter((b) =>
            ['confirmed', 'approved'].includes(safeString(b.booking_status).toLowerCase())
        ).length,
        [allLoadedBookings],
    );

    const rejectedBookingsCount = useMemo(
        () => allLoadedBookings.filter((b) =>
            safeString(b.booking_status).toLowerCase() === 'rejected'
        ).length,
        [allLoadedBookings],
    );

    // ⭐ REQUEST #4: Only approved bookings contribute to total revenue.
    const approvedRevenue = useMemo(() => {
        return allLoadedBookings
            .filter((b) =>
                ['confirmed', 'approved'].includes(safeString(b.booking_status).toLowerCase())
            )
            .reduce((sum, b) => {
                // Prefer the invoice total, then quotation, then booking total.
                const amount =
                    safeNumber(b?.invoice?.total_amount) ||
                    safeNumber(b?.quotation?.total_amount) ||
                    safeNumber(b?.total_amount);
                return sum + amount;
            }, 0);
    }, [allLoadedBookings]);

    const refundRequests = useMemo(() => {
        const all = [...regularBookings, ...multiDayBookings];
        const seen = new Set();
        return all.filter((booking) => {
            const id = getBookingId(booking);
            if (!id || seen.has(id)) return false;
            seen.add(id);
            const status = safeString(booking.refund_status).toLowerCase();
            return status === 'pending' || status === 'pending_approval' || status === 'approved';
        });
    }, [regularBookings, multiDayBookings]);

    const refundRequestsPendingCount = useMemo(
        () => refundRequests.filter((b) => isRefundPending(b)).length,
        [refundRequests]
    );
    const refundRequestsApprovedCount = useMemo(
        () => refundRequests.filter((b) => isRefundApproved(b)).length,
        [refundRequests]
    );
// ⭐ Theme sync — resilient to Navigation remounts and route changes
    useEffect(() => {
        const resolveDark = () => {
            const saved = (localStorage.getItem('theme') || '').toLowerCase();
            if (saved === 'dark') return true;
            if (saved === 'light') return false;
            return document.body.classList.contains('dark-mode');
        };

        setIsDarkMode(resolveDark());

        // Re-check shortly after mount in case Navigation runs its own effect after us
        const t1 = setTimeout(() => setIsDarkMode(resolveDark()), 0);
        const t2 = setTimeout(() => setIsDarkMode(resolveDark()), 100);

        const handleThemeChange = (e) => {
            const nextDark = Boolean(e?.detail?.isDark);
            setIsDarkMode(nextDark);
        };

        const handleStorage = (e) => {
            if (e.key === 'theme') {
                setIsDarkMode((e.newValue || '').toLowerCase() === 'dark');
            }
        };

        window.addEventListener('themeChange', handleThemeChange);
        window.addEventListener('storage', handleStorage);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('themeChange', handleThemeChange);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);
      // ⭐ Apply dark-mode class to <html> and <body> so portal-rendered modals inherit it.
    // Do NOT remove on cleanup — Navigation owns the class lifetime; leaving it
    // in place prevents the light-mode flash when this page unmounts.
    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (isDarkMode) {
            root.classList.add('bqm-dark-mode');
            body.classList.add('bqm-dark-mode');
        } else {
            root.classList.remove('bqm-dark-mode');
            body.classList.remove('bqm-dark-mode');
        }
    }, [isDarkMode]);

    // ⭐ Toggle — single source of truth, only updates the persisted key + dispatches event.    // Navigation listens to 'themeChange' and will follow along.
    const toggleDarkMode = useCallback(() => {
        const next = !isDarkMode;

        // 1. Persist — same key Navigation uses
        localStorage.setItem('theme', next ? 'dark' : 'light');

        // 2. Update body class (kept in sync for any CSS that relies on it)
        document.body.classList.toggle('dark-mode', next);
        document.body.classList.toggle('light-mode', !next);

        // 3. Notify Navigation so its toggle flips too
        window.dispatchEvent(new CustomEvent('themeChange', {
            detail: { isDark: next },
        }));

        // 4. Update local state last
        setIsDarkMode(next);
    }, [isDarkMode]);
      // ⭐ REQUEST #2: Auto-start event modal.
    // Watches the loaded booking lists. When a booking's scheduled date+time
    // has started, shows the Start/Later modal exactly ONCE per booking.
    // "Later" dismisses it permanently for that booking (stored in
    // localStorage) so it never nags the user again.
    useEffect(() => {
        const AUTO_START_LATER_KEY = 'auto_start_later_bookings';
        const dismissed = (() => {
            try {
                return JSON.parse(localStorage.getItem(AUTO_START_LATER_KEY) || '[]');
            } catch {
                return [];
            }
        })();

        const candidates = [...safeArray(regularBookings), ...safeArray(multiDayBookings)];
        const now = dayjs();
        const dueNow = candidates.find((booking) => {
            const status = safeString(booking?.booking_status).toLowerCase();
            if (!['confirmed', 'approved', 'ongoing'].includes(status)) return false;
            if (status === 'ongoing') return false; // already started

            const id = getBookingId(booking);
            if (!id || dismissed.includes(id)) return false;

            const dateStr = safeString(booking?.event_date);
            const timeStr = safeString(booking?.event_time);
            if (!dateStr) return false;

            const scheduled = dayjs(`${dateStr} ${timeStr || '00:00'}`);
            if (!scheduled.isValid()) return false;

            return scheduled.isBefore(now);
        });

        if (dueNow && !startEventModalVisible) {
            setStartEventBookingData(dueNow);
            setStartEventModalVisible(true);
        }
    }, [regularBookings, multiDayBookings, startEventModalVisible]);

    // NOTE: Removed the blanket refreshAllData() listener. useConfirmBooking
    // already syncs cache via syncBookingInCache, so refetching all 7 queries
    // here was double network traffic per approval. Only refetch calendar /
    // availability, which the confirm mutation does NOT touch.
    useEffect(() => {
        const handleBookingEvent = (event) => {
            console.log('📢 Booking event received:', event.detail);
            refetchCalendarEvents();
            refetchCalendarAvailability();
        };

        window.addEventListener('booking-cancelled', handleBookingEvent);
        window.addEventListener('booking-reschedule-requested', handleBookingEvent);

        return () => {
            window.removeEventListener('booking-cancelled', handleBookingEvent);
            window.removeEventListener('booking-reschedule-requested', handleBookingEvent);
        };
    }, [refetchCalendarEvents, refetchCalendarAvailability]);

    useEffect(() => {
        if (quotationModalVisible) {
            loadMenuData();
        }
    }, [quotationModalVisible]);

    useEffect(() => {
        if (serviceType === 'buffet') {
            quotationForm.setFieldValue('delivery_method', 'delivery');
        }
    }, [serviceType, quotationForm]);

    const loadMenuData = async () => {
        setIsLoadingMenuData(true);
        try {
            const menuResponse = await api.get('/menu-items', { params: { per_page: 100, is_available: true } });
            const menuData = menuResponse?.data?.data?.data || menuResponse?.data?.data || [];
            const mappedMenuItems = Array.isArray(menuData) ? menuData.map(item => ({
                ...item,
                pricing_type: item.pricing_type || 'both',
                tray_price: safeNumber(item.tray_price, 0),
                tray_servings: safeNumber(item.tray_servings, 25),
                tray_min_pax: safeNumber(item.tray_min_pax, 20),
                tray_max_pax: safeNumber(item.tray_max_pax, 25),
                tray_description: item.tray_description || `Good for ${safeNumber(item.tray_min_pax, 20)}–${safeNumber(item.tray_max_pax, 25)} pax`,
                has_tray_pricing: item.has_tray_pricing || (item.pricing_type === 'per_tray' || item.pricing_type === 'both'),
                has_per_pax_pricing: item.has_per_pax_pricing || (item.pricing_type === 'per_pax' || item.pricing_type === 'both')
            })) : [];
            setMenuItemsList(mappedMenuItems);

            const packageResponse = await api.get('/packages', { params: { per_page: 50, is_active: true } });
            const packageData = packageResponse?.data?.data?.data || packageResponse?.data?.data || [];
            setPackagesList(Array.isArray(packageData) ? packageData : []);

            const promoResponse = await api.get('/promotions', { params: { per_page: 50, is_active: true } });
            const promoData = promoResponse?.data?.data?.data || promoResponse?.data?.data || [];
            setPromosList(Array.isArray(promoData) ? promoData : []);
        } catch (error) {
            console.error('Failed to load menu data:', error);
            message.error('Failed to load menu items');
        } finally {
            setIsLoadingMenuData(false);
        }
    };

    const getEventTypeName = (eventTypeId) => {
        const found = eventTypes.find((eventType) => Number(eventType.event_type_id || eventType.id) === Number(eventTypeId));
        return found?.name || 'Unknown';
    };

    const getCalendarAvailability = (dateValue) => {
        const date = dayjs(dateValue).format('YYYY-MM-DD');
        return calendarAvailability.find((item) => safeString(item.availability_date || item.date) === date);
    };

    const getMenuItems = (booking) => {
        if (!booking) return [];
        const items = safeArray(booking.menu_items || booking.items || booking.selected_items, []);
        return items.map(item => ({
            name: safeString(item.name),
            quantity: safeNumber(item.quantity || item.total_quantity || item.qty, 1),
            price: safeNumber(item.price, 0),
            subtotal: safeNumber(item.total_price, safeNumber(item.price, 0) * safeNumber(item.quantity || item.total_quantity, 1))
        }));
    };

    const renderMealServicesInModal = (booking) => {
        if (!booking) {
            return (
                <div className="bqm-no-meals-message">
                    <Text type="secondary">No booking data available.</Text>
                </div>
            );
        }
        const mealServices = safeArray(booking.meal_services);

        if (mealServices.length === 0) {
            return (
                <div className="bqm-no-meals-message">
                    <Text type="secondary">No meal services configured for this booking.</Text>
                </div>
            );
        }

        const mealsByDay = {};
        mealServices.forEach(meal => {
            const day = meal.day_number || 1;
            if (!mealsByDay[day]) {
                mealsByDay[day] = [];
            }
            mealsByDay[day].push(meal);
        });

        const sortedDays = Object.keys(mealsByDay).sort((a, b) => Number(a) - Number(b));

        return (
            <div className="bqm-meal-services-view">
                {sortedDays.map((day) => {
                    const dayMeals = mealsByDay[day];
                    const mealOrder = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
                    const sortedMeals = [...dayMeals].sort((a, b) => {
                        const indexA = mealOrder.indexOf(a.meal_type);
                        const indexB = mealOrder.indexOf(b.meal_type);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    });

                    return (
                        <div key={day} className="bqm-meal-day-group">
                            <div className="bqm-meal-day-header">
                                <Tag color="blue" className="bqm-meal-day-tag">
                                    <CalendarOutlined /> Day {day}
                                </Tag>
                            </div>

                            {sortedMeals.map((meal, index) => {
                                let menuItems = [];

                                if (meal.menu_source === 'package' || meal.package_id) {
                                    const packageItems = safeArray(meal.custom_items);
                                    if (packageItems.length > 0) {
                                        menuItems = packageItems.map(item => ({
                                            name: item.item_name || item.name || 'Menu Item',
                                            quantity: safeNumber(item.quantity, 1),
                                            price: safeNumber(item.unit_price || item.price, 0),
                                            subtotal: safeNumber(item.quantity, 1) * safeNumber(item.unit_price || item.price, 0)
                                        }));
                                    } else {
                                        const packageName = meal.menu_name || meal.package_name || 'Package';
                                        menuItems = [{
                                            name: `${packageName} (Package)`,
                                            quantity: 1,
                                            price: safeNumber(meal.price_per_head, 0),
                                            subtotal: safeNumber(meal.price_per_head, 0)
                                        }];
                                    }
                                } else {
                                    menuItems = safeArray(meal.custom_items).map(item => ({
                                        name: item.item_name || item.name || 'Menu Item',
                                        quantity: safeNumber(item.quantity, 1),
                                        price: safeNumber(item.unit_price || item.price, 0),
                                        subtotal: safeNumber(item.quantity, 1) * safeNumber(item.unit_price || item.price, 0)
                                    }));

                                    if (menuItems.length === 0 && meal.menu_name) {
                                        menuItems = [{
                                            name: meal.menu_name,
                                            quantity: 1,
                                            price: safeNumber(meal.price_per_head, 0),
                                            subtotal: safeNumber(meal.price_per_head, 0)
                                        }];
                                    }
                                }

                                const totalItems = menuItems.reduce((sum, item) => sum + safeNumber(item.quantity), 0);
                                const totalPrice = menuItems.reduce((sum, item) => sum + safeNumber(item.subtotal), 0);

                                const pricingType = meal.pricing_type || 'per_pax';
                                const pricingBadge = pricingType === 'tray'
                                    ? <Tag color="orange">Tray Pricing</Tag>
                                    : <Tag color="blue">Per Pax Pricing</Tag>;

                                return (
                                    <div key={index} className="bqm-meal-schedule-group">
                                        <div className="bqm-meal-schedule-header">
                                            <div className="bqm-meal-schedule-title">
                                                <Tag color="green" className="bqm-meal-type-tag">
                                                    {meal.meal_type || 'Meal'}
                                                </Tag>
                                                {pricingBadge}
                                                <span className="bqm-meal-time">
                                                    <ClockCircleOutlined /> {meal.serving_time || 'Time TBD'}
                                                </span>
                                                <span className="bqm-meal-pax">
                                                    <TeamOutlined /> {safeNumber(meal.pax)} pax
                                                </span>
                                                {meal.notes && (
                                                    <span className="bqm-meal-notes-badge">
                                                        <MessageOutlined /> {meal.notes}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {menuItems.length > 0 ? (
                                            <div className="bqm-meal-menu-table">
                                                <div className="bqm-meal-menu-header">
                                                    <span className="bqm-menu-col-name">Item Name</span>
                                                    <span className="bqm-menu-col-qty">Qty</span>
                                                    <span className="bqm-menu-col-price">Price</span>
                                                    <span className="bqm-menu-col-subtotal">Subtotal</span>
                                                </div>
                                                {menuItems.map((item, idx) => (
                                                    <div key={idx} className="bqm-meal-menu-row">
                                                        <span className="bqm-menu-col-name">{item.name}</span>
                                                        <span className="bqm-menu-col-qty">{safeNumber(item.quantity)}</span>
                                                        <span className="bqm-menu-col-price">{formatCurrency(item.price)}</span>
                                                        <span className="bqm-menu-col-subtotal">{formatCurrency(item.subtotal)}</span>
                                                    </div>
                                                ))}
                                                {menuItems.length > 1 && (
                                                    <div className="bqm-meal-menu-total">
                                                        <span className="bqm-menu-col-name"><strong>Total</strong></span>
                                                        <span className="bqm-menu-col-qty"><strong>{totalItems}</strong></span>
                                                        <span className="bqm-menu-col-price"></span>
                                                        <span className="bqm-menu-col-subtotal"><strong>{formatCurrency(totalPrice)}</strong></span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bqm-meal-no-items">
                                                <Text type="secondary">No menu items configured for this meal.</Text>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    };

    const refreshAllData = async (showNotification = true) => {
        try {
            await Promise.all([
                refetchRegularBookings(),
                refetchMultiDayBookings(),
                refetchCompletedBookings(),
                refetchStatistics(),
                refetchQuotations(),
                refetchCalendarEvents(),
                refetchCalendarAvailability()
            ]);

            if (showNotification) {
                message.success('Bookings data refreshed');
            }
        } catch (error) {
            console.error('Refresh error:', error);
            if (showNotification) {
                message.error('Failed to refresh data');
            }
        }
    };

    const exportToExcel = (data, filename, columns) => {
        const worksheetData = data.map(row => {
            const exportRow = {};
            columns.forEach(col => {
                if (col.dataIndex) {
                    exportRow[col.title] = row[col.dataIndex];
                } else if (col.render && typeof col.render === 'function') {
                    const rendered = col.render(row[col.dataIndex || col.key], row);
                    if (typeof rendered === 'object' && rendered.props) {
                        exportRow[col.title] = rendered.props.children || '';
                    } else {
                        exportRow[col.title] = rendered;
                    }
                } else {
                    exportRow[col.title] = row[col.key] || '';
                }
            });
            return exportRow;
        });

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, filename);
        XLSX.writeFile(wb, `${filename}.xlsx`);
        message.success(`${filename} exported successfully`);
    };

    const exportRegularBookings = () => {
        const columns = [
            { title: 'BOOKING #', dataIndex: 'booking_no' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'EVENT DATE', dataIndex: 'event_date' },
            { title: 'LOCATION', dataIndex: 'venue' },
            { title: 'SERVICE', key: 'service_type' },
            { title: 'EVENT TYPE', key: 'event_type' },
            { title: 'PAX', dataIndex: 'guests_count' },
            { title: 'AMOUNT', dataIndex: 'total_amount' },
            { title: 'STATUS', dataIndex: 'booking_status' }
        ];
        const exportData = regularBookings.map(b => ({
            ...b,
            service_type: getServiceType(b),
            event_type: getEventTypeName(b.event_type_id)
        }));
        exportToExcel(exportData, 'Regular_Bookings', columns);
    };

    const exportMultiDayBookings = () => {
        const columns = [
            { title: 'BOOKING #', dataIndex: 'booking_no' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'START DATE', dataIndex: 'event_date' },
            { title: 'END DATE', dataIndex: 'event_end_date' },
            { title: 'DAYS', key: 'days' },
            { title: 'LOCATION', dataIndex: 'venue' },
            { title: 'PAX', dataIndex: 'guests_count' },
            { title: 'AMOUNT', dataIndex: 'total_amount' },
            { title: 'STATUS', dataIndex: 'booking_status' }
        ];
        const exportData = multiDayBookings.map(b => ({
            ...b,
            days: formatDays(b.event_date, b.event_end_date || b.end_date || b.event_date)
        }));
        exportToExcel(exportData, 'Multi_Day_Events', columns);
    };

    const exportHistory = () => {
        const columns = [
            { title: 'BOOKING #', dataIndex: 'booking_no' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'EVENT DATE', dataIndex: 'event_date' },
            { title: 'STATUS', dataIndex: 'booking_status' },
            { title: 'AMOUNT', dataIndex: 'total_amount' },
            { title: 'PAID', dataIndex: 'paid_amount' },
            { title: 'BALANCE', dataIndex: 'balance' }
        ];
        exportToExcel(completedBookings, 'Booking_History', columns);
    };

    const escapePrintText = (value) => safeString(value, '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

    const getListFromResponse = (response) => {
        const payload = response?.data?.data ?? response?.data;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload)) return payload;
        return [];
    };

    const fetchBookingsForPrint = async (params) => {
        const response = await api.get('/bookings', {
            params: {
                ...params,
                per_page: FETCH_ALL_LIMIT
            }
        });
        return getListFromResponse(response);
    };

    const printRows = (title, rows, columns) => {
        const htmlRows = rows.map((row) => `
            <tr>${columns.map((column) => `<td>${escapePrintText(column.get(row))}</td>`).join('')}</tr>
        `).join('');
        const html = `
            <!doctype html>
            <html>
            <head>
                <title>${escapePrintText(title)}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
                    h1 { font-size: 20px; margin-bottom: 4px; }
                    .meta { color: #6b7280; font-size: 12px; margin-bottom: 18px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; }
                    th { background: #f3f4f6; }
                    @media print { body { padding: 12px; } }
                </style>
            </head>
            <body>
                <h1>${escapePrintText(title)}</h1>
                <div class="meta">Printed ${dayjs().format('YYYY-MM-DD HH:mm')} • ${rows.length} record(s)</div>
                <table>
                    <thead><tr>${columns.map((column) => `<th>${escapePrintText(column.title)}</th>`).join('')}</tr></thead>
                    <tbody>${htmlRows || `<tr><td colspan="${columns.length}">No records found.</td></tr>`}</tbody>
                </table>
            </body>
            </html>`;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            message.error('Unable to open print window. Please allow pop-ups.');
            return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const bookingPrintColumns = [
        { title: 'Booking #', get: (row) => row.booking_no },
        { title: 'Customer', get: (row) => row.customer_name },
        { title: 'Event Date', get: (row) => formatDateSafe(row.event_date) },
        { title: 'Event Time', get: (row) => row.event_time },
        { title: 'Venue', get: (row) => row.venue || row.location },
        { title: 'PAX', get: (row) => row.guests_count },
        { title: 'Amount', get: (row) => formatCurrency(row.total_amount) },
        { title: 'Status', get: (row) => row.booking_status }
    ];

    const printRegularBookings = async () => {
        const rows = await fetchBookingsForPrint(buildBookingParams('regular'));
        printRows('Regular Booking List', rows, bookingPrintColumns);
    };

    const printMultiDayBookings = async () => {
        const rows = await fetchBookingsForPrint(buildBookingParams('multi_day'));
        printRows('Multi-Day Event Booking List', rows, bookingPrintColumns);
    };

    const printHistory = async () => {
        const rows = await fetchBookingsForPrint({ ...buildHistoryParams() });
        printRows('Booking History', rows, bookingPrintColumns);
    };

    const handleCompleteBooking = async (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        const balance = safeNumber(
            booking.balance ?? booking.outstanding_balance ?? booking.billing_summary?.remaining_balance,
            Math.max(0, safeNumber(booking.total_amount) - safeNumber(booking.paid_amount))
        );
        if (balance > 0.01) {
            message.error('Please pay the remaining balance before completing this booking.');
            return;
        }

               modal.confirm({
            title: 'Mark Booking as Completed',
            content: `Move ${safeString(booking.booking_no)} to booking history?`,
            okText: 'Mark as Completed',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                const bookingId = getBookingId(booking);
                if (!bookingId) {
                    message.error('Invalid booking ID');
                    return;
                }
                try {
                    await api.post(`/bookings/${bookingId}/complete`);
                    message.success('Booking moved to history successfully');
                    await refreshAllData();
                } catch (error) {
                    message.error(error?.response?.data?.message || 'Failed to complete booking');
                }
            }
        });
    };
    const handleCancelBooking = async (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const bookingNo = safeString(selectedBooking?.booking_no);

        try {
            const signal = showLoadingLine('cancel', bookingNo);

            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });

            await api.post(
                `/bookings/${bookingId}/cancel-with-reason`,
                { reason: values.reason },
                { signal }
            );

            message.success('Booking cancelled and moved to history');
            setCancelReasonModalVisible(false);
            cancelForm.resetFields();
            await refreshAllData();
        } catch (error) {
            if (
                error?.name !== 'CanceledError' &&
                error?.name !== 'AbortError' &&
                error?.code !== 'ERR_CANCELED'
            ) {
                message.error(error?.response?.data?.message || 'Failed to cancel booking');
            }
        } finally {
            hideLoadingLine();
        }
    };
    const closeCancelWithRefundModal = useCallback(() => {
        setCancelWithRefundModalVisible(false);
        cancelWithRefundForm.resetFields();
        adminDepositForm.resetFields();
        setAdminDepositAction('cancel');
    }, [cancelWithRefundForm, adminDepositForm]);

    const openCancelModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setSelectedBooking(booking);

        const withinCutoff = isBookingWithinCancellationCutoff(booking);
        const refundInFlight = hasPendingRefundRequest(booking) || isRefundApproved(booking);

        if (withinCutoff || refundInFlight) {
            cancelWithRefundForm.resetFields();
            adminDepositForm.resetFields();
            setAdminDepositAction('cancel');
            adminDepositForm.setFieldsValue({
                action: 'cancel',
                extension_days: 7,
                notes: '',
                refund_amount: 0,
                refund_method: 'cash',
                refund_reference: '',
            });
            setCancelWithRefundModalVisible(true);
        } else {
            cancelForm.resetFields();
            setCancelReasonModalVisible(true);
        }
    };

    const handleCancelWithoutRefund = async (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        try {
            await api.post(`/bookings/${bookingId}/cancel-with-reason`, {
                reason: values.reason,
                forfeit_deposit: true,
            });
            message.success('Booking cancelled. Deposit is forfeited per policy.');
            closeCancelWithRefundModal();
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to cancel booking');
        }
    };

    const handleSubmitRefundRequest = async (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        try {
            await api.post(`/bookings/${bookingId}/request-refund`, {
                reason: values.reason,
                refund_amount: 0,
                cancel_booking: true,
            });
            message.success('Cancellation & refund request submitted. An admin will review it.');
            closeCancelWithRefundModal();
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to submit refund request');
        }
    };

    const openRefundApprovalModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setRefundApprovalBooking(booking);
        setRefundApprovalAction('with_refund');
        refundApprovalForm.resetFields();
        refundApprovalForm.setFieldsValue({ notes: '' });
        setRefundApprovalModalVisible(true);
    };

    const handleApproveRefundWithRefund = async () => {
        const bookingId = getBookingId(refundApprovalBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const notes = refundApprovalForm.getFieldValue('notes') || '';

        try {
            await api.post(`/bookings/${bookingId}/approve-refund`, {
                notes,
            });
            message.success('Refund approved. The cashier can now confirm and enter the amount.');
            setRefundApprovalModalVisible(false);
            refundApprovalForm.resetFields();
            setRefundApprovalAction('with_refund');
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to approve refund');
        }
    };

    const handleApproveRefundWithoutRefund = async () => {
        const bookingId = getBookingId(refundApprovalBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const notes = refundApprovalForm.getFieldValue('notes') || '';

        modal.confirm({
            title: 'Cancel Booking Without Refund?',
            content: (
                <div>
                    <p>
                        Booking <strong>{safeString(refundApprovalBooking?.booking_no)}</strong> will be
                        cancelled immediately. No refund will be issued to the customer.
                    </p>
                    <p style={{ color: '#ef4444', marginTop: 8 }}>
                        <WarningOutlined /> This action cannot be undone.
                    </p>
                </div>
            ),
            okText: 'Yes, cancel without refund',
            okButtonProps: { danger: true },
            cancelText: 'Back',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                try {
                    await api.post(`/bookings/${bookingId}/admin-direct-refund`, {
                        refund_amount: 0,
                        payment_method: 'cash',
                        reference_number: null,
                        reason: notes || 'Cancellation request approved without refund.',
                    });
                    message.success('Booking cancelled without refund.');
                    setRefundApprovalModalVisible(false);
                    refundApprovalForm.resetFields();
                    setRefundApprovalAction('with_refund');
                    await refreshAllData();
                } catch (error) {
                    message.error(error?.response?.data?.message || 'Failed to cancel booking');
                    throw error;
                }
            },
        });
    };

    const handleRejectRefund = async (values) => {
        const bookingId = getBookingId(refundApprovalBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        try {
            await api.post(`/bookings/${bookingId}/reject-refund`, {
                reason: values.reason || 'Refund request rejected by admin.',
            });
            message.success('Refund request rejected. Booking remains as-is.');
            setRefundApprovalModalVisible(false);
            refundApprovalForm.resetFields();
            setRefundApprovalAction('with_refund');
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to reject refund');
        }
    };

    const openDepositOverdueModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setDepositOverdueBooking(booking);
        setDepositDecisionAction('extend');
        depositDecisionForm.resetFields();
        depositDecisionForm.setFieldsValue({
            action: 'extend',
            extension_days: 7,
            notes: '',
            refund_amount: 0,
            refund_method: 'cash',
            refund_reference: '',
        });
        setDepositOverdueModalVisible(true);
    };

    const closeDepositOverdueModal = () => {
        setDepositOverdueModalVisible(false);
        depositDecisionForm.resetFields();
        setDepositDecisionAction('extend');
    };

    const handleDepositDecision = async (values) => {
        const bookingId = getBookingId(depositOverdueBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        if (values.action === 'extend') {
            try {
                await api.post(`/bookings/${bookingId}/deposit-decision`, {
                    action: 'extend',
                    extension_days: safeNumber(values.extension_days, 7),
                    notes: values.notes || '',
                });
                message.success(
                    `Deposit deadline extended by ${safeNumber(values.extension_days, 7)} day(s).`,
                );
                closeDepositOverdueModal();
                await refreshAllData();
                // ⭐ Tell every other open tab / window that this booking
                //    changed so their React Query cache refetches too.
                broadcastBookingChanged(bookingId, 'deposit_extended');
            } catch (error) {
                message.error(error?.response?.data?.message || 'Failed to extend deposit deadline');
            }
            return;
        }

          if (values.action === 'waive') {
            try {
                await api.post(`/bookings/${bookingId}/deposit-decision`, {
                    action: 'waive',
                    notes: values.notes || '',
                });
                message.success('Deposit requirement waived. Booking remains confirmed.');
                closeDepositOverdueModal();
                await refreshAllData();
                broadcastBookingChanged(bookingId, 'deposit_waived');
            } catch (error) {
                message.error(error?.response?.data?.message || 'Failed to waive deposit');
            }
            return;
        }

        if (values.action === 'cancel') {
            const refundAmount = safeNumber(values.refund_amount, 0);
            try {
                await api.post(`/bookings/${bookingId}/admin-direct-refund`, {
                    refund_amount: refundAmount,
                    payment_method: values.refund_method || 'cash',
                    reference_number: values.refund_reference || null,
                    reason: values.notes || 'Cancelled by admin — deposit overdue.',
                });
                            message.success(
                    refundAmount > 0
                        ? `Booking cancelled. Refund of ${formatCurrency(refundAmount)} released.`
                        : 'Booking cancelled with no refund.',
                );
                closeDepositOverdueModal();
                await refreshAllData();
                broadcastBookingChanged(bookingId, 'deposit_cancelled');
            } catch (error) {
                message.error(error?.response?.data?.message || 'Failed to cancel booking');
            }
        }
    };

    const openConfirmRefundModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        if (!isRefundApproved(booking)) {
            message.warning('This booking has no approved refund to confirm.');
            return;
        }
        setConfirmRefundBooking(booking);
        confirmRefundForm.resetFields();
        confirmRefundForm.setFieldsValue({
            refund_amount: safeNumber(getDepositAmount(booking), 0),
            payment_method: 'cash',
            reference_number: '',
            notes: '',
        });
        setConfirmRefundModalVisible(true);
    };

    const handleConfirmRefund = async (values) => {
        const bookingId = getBookingId(confirmRefundBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const refundAmount = safeNumber(values.refund_amount, 0);
        if (refundAmount <= 0) {
            message.error('Please enter a refund amount greater than 0.');
            return;
        }

        try {
            await api.post(`/bookings/${bookingId}/confirm-refund`, {
                refund_amount: refundAmount,
                payment_method: values.payment_method || 'cash',
                reference_number: values.reference_number || null,
                notes: values.notes || '',
            });
            message.success(`Refund of ${formatCurrency(refundAmount)} released successfully.`);
            setConfirmRefundModalVisible(false);
            confirmRefundForm.resetFields();
            setConfirmRefundBooking(null);
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to release refund');
        }
    };

    const handleAdminDepositAction = async (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const reason = cancelWithRefundForm.getFieldValue('reason');
        if (!reason || !safeString(reason).trim()) {
            message.warning('Please provide a cancellation reason first.');
            return;
        }

        const refundAmount = safeNumber(values.refund_amount, 0);
        if (refundAmount < 0) {
            message.error('Refund amount cannot be negative.');
            return;
        }

        try {
            await api.post(`/bookings/${bookingId}/admin-direct-refund`, {
                refund_amount: refundAmount,
                payment_method: values.refund_method || 'cash',
                reference_number: values.refund_reference || null,
                reason: safeString(reason).trim() || 'Cancelled by admin.',
            });
            message.success(
                refundAmount > 0
                    ? `Booking cancelled. Refund of ${formatCurrency(refundAmount)} released.`
                    : 'Booking cancelled with no refund.',
            );
            closeCancelWithRefundModal();
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to cancel with refund');
        }
    };

    const handleRejectBooking = async (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }            if (values.action === 'reject') {
            const wasCancelled = { value: false };

            try {
                const signal = showLoadingLine('reject', safeString(selectedBooking?.booking_no));

                await new Promise((resolve, reject) => {
                    const timer = setTimeout(resolve, 5000);
                    signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        wasCancelled.value = true;
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                });

                await api.post(
                    `/bookings/${bookingId}/reject`,
                    { reason: values.reason },
                    { signal }
                );

                message.success('Booking rejected and removed from active bookings');
                setRejectReasonModalVisible(false);
                rejectForm.resetFields();
                await refreshAllData();
            } catch (error) {
                if (
                    error?.name !== 'CanceledError' &&
                    error?.name !== 'AbortError' &&
                    error?.code !== 'ERR_CANCELED'
                ) {
                    message.error(error?.response?.data?.message || 'Failed to reject booking');
                }
            } finally {
                hideLoadingLine();
            }
        } else if (values.action === 'reschedule') {
            rescheduleForm.setFieldsValue({
                new_date: dayjs(selectedBooking.event_date),
                new_time: selectedBooking.event_time,
                reason: values.reason
            });
            setRejectReasonModalVisible(false);
            setRescheduleModalVisible(true);
        }
    };

    const openRejectModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setSelectedBooking(booking);
        rejectForm.resetFields();
        setRejectReasonModalVisible(true);
    };

      const handleReschedule = async (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const newDate = values.new_date
            ? values.new_date.format('YYYY-MM-DD')
            : selectedBooking.event_date;
        const newTime = values.new_time || selectedBooking.event_time;

        const currentDate = safeString(selectedBooking?.event_date);
        const currentTime = safeString(selectedBooking?.event_time);
        const isSameDateTime = currentDate === newDate && currentTime === newTime;
        const bookingNo = safeString(selectedBooking?.booking_no);

        try {
            const signal = showLoadingLine('reschedule', bookingNo);

            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });

            const validation = await api.post(
                '/bookings/validate-slot',
                {
                    event_date: newDate,
                    event_time: newTime,
                    exclude_booking_id: bookingId,
                },
                { signal }
            );
            const validationData =
                validation?.data?.data || validation?.data || {};
            const isAvailable = validationData?.available === true;
            const isSame = validationData?.same_datetime === true;

            if (!isAvailable && !isSame && !isSameDateTime) {
                const conflict = validationData?.conflict;
                message.error(
                    conflict?.message ||
                        'The selected date and time is not available. Please choose another slot.'
                );
                return;
            }

            await api.post(
                `/bookings/${bookingId}/admin-reschedule`,
                {
                    new_date: newDate,
                    new_time: newTime,
                    reason: values.reason,
                },
                { signal }
            );

            message.success(
                isSameDateTime
                    ? 'Same-schedule proposal sent to customer (admin override).'
                    : 'Reschedule proposal sent to customer'
            );
            setRescheduleModalVisible(false);
            rescheduleForm.resetFields();
            await refreshAllData();
            notifyRescheduleRequest(bookingId, newDate, newTime);
               } catch (error) {
            if (
                error?.name !== 'CanceledError' &&
                error?.name !== 'AbortError' &&
                error?.code !== 'ERR_CANCELED'
            ) {
                console.error('Reschedule error:', error);
                message.error(
                    error?.response?.data?.message || 'Failed to submit reschedule request'
                );
            }
        } finally {
            hideLoadingLine();
        }
    };

    const openRescheduleModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setSelectedBooking(booking);
        rescheduleForm.setFieldsValue({
            new_date: dayjs(booking.event_date),
            new_time: booking.event_time,
            reason: ''
        });
        setRescheduleModalVisible(true);
    };

    // ========================================================
    // ⭐ NEW: Admin responds to CUSTOMER-initiated reschedule
    // ========================================================

    const handleApproveCustomerReschedule = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const newDate = booking.requested_date || booking.event_date;
        const newTime = booking.requested_time || booking.event_time;

        modal.confirm({
            title: 'Approve Customer Reschedule?',
            content: (
                <div>
                    <p>
                        Booking <strong>{safeString(booking.booking_no)}</strong> will be
                        moved to the customer's requested date and time.
                    </p>
                    <p style={{ marginTop: 8 }}>
                        <strong>New Date:</strong> {formatDateSafe(newDate)}
                        <br />
                        <strong>New Time:</strong> {newTime || 'N/A'}
                    </p>
                    {booking.reschedule_reason && (
                        <p style={{ marginTop: 8 }}>
                            <strong>Customer's Reason:</strong> {booking.reschedule_reason}
                        </p>
                    )}
                </div>
            ),
            okText: 'Approve Reschedule',
            okButtonProps: { style: { background: '#10b981', borderColor: '#10b981' } },
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                const hideLoading = message.loading('Approving reschedule...', 0);
                try {
                    await api.post(`/bookings/${bookingId}/approve-reschedule`);
                    hideLoading();
                    message.success('Customer reschedule approved.');
                    await refreshAllData();
                } catch (error) {
                    hideLoading();
                    message.error(
                        error?.response?.data?.message || 'Failed to approve reschedule'
                    );
                    throw error;
                }
            },
        });
    };

    const handleRejectCustomerReschedule = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        let rejectReason = '';

        modal.confirm({
            title: 'Reject Customer Reschedule?',
            content: (
                <div>
                    <p>
                        Booking <strong>{safeString(booking.booking_no)}</strong> will stay on
                        the original schedule.
                    </p>
                    <p style={{ marginTop: 8 }}>
                        <strong>Original Date:</strong> {formatDateSafe(booking.event_date)}
                        <br />
                        <strong>Original Time:</strong> {booking.event_time || 'N/A'}
                    </p>
                    <p style={{ marginTop: 8 }}>The customer will be notified.</p>
                    <label
                        style={{
                            display: 'block',
                            marginTop: 12,
                            marginBottom: 4,
                            fontWeight: 600,
                        }}
                    >
                        Reason (optional)
                    </label>
                    <TextArea
                        rows={3}
                        placeholder="e.g., No available slot on the requested date..."
                        maxLength={500}
                        onChange={(e) => {
                            rejectReason = e.target.value;
                        }}
                    />
                </div>
            ),
            okText: 'Reject Reschedule',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                const hideLoading = message.loading('Rejecting reschedule...', 0);
                try {
                    await api.post(`/bookings/${bookingId}/reject-customer-reschedule`, {
                        reason: rejectReason || 'Reschedule request rejected by admin.',
                    });
                    hideLoading();
                    message.success('Customer reschedule rejected.');
                    await refreshAllData();
                } catch (error) {
                    hideLoading();
                    message.error(
                        error?.response?.data?.message || 'Failed to reject reschedule'
                    );
                    throw error;
                }
            },
        });
    };

    const handleCancelCustomerRescheduleRequest = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        let cancelReason = '';

        modal.confirm({
            title: 'Cancel Reschedule Request?',
            content: (
                <div>
                    <p>
                        The customer's pending reschedule request for{' '}
                        <strong>{safeString(booking.booking_no)}</strong> will be withdrawn.
                    </p>
                    <p style={{ marginTop: 8 }}>
                        The booking will remain on its <strong>original schedule</strong>.
                    </p>
                    <label
                        style={{
                            display: 'block',
                            marginTop: 12,
                            marginBottom: 4,
                            fontWeight: 600,
                        }}
                    >
                        Reason (optional)
                    </label>
                    <TextArea
                        rows={3}
                        placeholder="e.g., Discussed with customer, keeping original schedule..."
                        maxLength={500}
                        onChange={(e) => {
                            cancelReason = e.target.value;
                        }}
                    />
                </div>
            ),
            okText: 'Cancel Request',
            okButtonProps: { danger: true },
            cancelText: 'Keep Request',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                const hideLoading = message.loading('Cancelling request...', 0);
                try {
                    await api.post(`/bookings/${bookingId}/cancel-reschedule-proposal`, {
                        reason: cancelReason || 'Reschedule request withdrawn by admin.',
                    });
                    hideLoading();
                    message.success('Customer reschedule request cancelled.');
                    await refreshAllData();
                } catch (error) {
                    hideLoading();
                    message.error(
                        error?.response?.data?.message || 'Failed to cancel request'
                    );
                    throw error;
                }
            },
        });
    };

    // ⭐ Admin cancels their own reschedule proposal
    const openCancelRescheduleModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setCancelRescheduleBooking(booking);
        setCancelRescheduleReason('');
        setCancelRescheduleModalVisible(true);
    };

    const closeCancelRescheduleModal = () => {
        if (cancelRescheduleSubmitting) return;
        setCancelRescheduleModalVisible(false);
        setCancelRescheduleBooking(null);
        setCancelRescheduleReason('');
    };

    const handleCancelRescheduleProposal = async () => {
        if (!cancelRescheduleBooking) return;
        const bookingId = getBookingId(cancelRescheduleBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        setCancelRescheduleSubmitting(true);
        const hideLoading = message.loading('Cancelling reschedule proposal...', 0);

        try {
            await api.post(`/bookings/${bookingId}/cancel-reschedule-proposal`, {
                reason: cancelRescheduleReason.trim() || null,
            });

            hideLoading();
            message.success('Reschedule proposal cancelled. Booking restored to confirmed.');

            closeCancelRescheduleModal();
            await refreshAllData();
        } catch (error) {
            hideLoading();
            console.error('Cancel reschedule proposal error:', error);
            message.error(
                error?.response?.data?.message ||
                'Failed to cancel reschedule proposal.'
            );
        } finally {
            setCancelRescheduleSubmitting(false);
        }
    };

    const openBookingDetails = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setSelectedBooking(booking);
        setBookingStep(0);
        setBookingDetailsModalVisible(true);
    };

    const nextBookingStep = () => {
        if (bookingStep < 4) setBookingStep(bookingStep + 1);
    };

    const prevBookingStep = () => {
        if (bookingStep > 0) setBookingStep(bookingStep - 1);
    };

    const autoCancelExpiredBooking = async (booking) => {
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return false;
        }

        try {
            await api.post(`/bookings/${bookingId}/cancel-with-reason`, {
                reason: 'Automatically cancelled: Event date and time already passed.'
            });

            message.warning('Booking automatically cancelled because the event schedule has already passed.');
            await refreshAllData(false);
            return true;
        } catch (error) {
            console.error('Failed to auto-cancel expired booking:', error);
            message.error(error?.response?.data?.message || 'Failed to automatically cancel expired booking.');
            return false;
        }
    };

    const handleStartEvent = async (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        try {
            await api.post(`/events/${bookingId}/start`, {
                force_start: true,
                reason: 'Event started by admin on event day'
            });
            message.success('Event started successfully!');
            setStartEventModalVisible(false);
            setStartEventBookingData(null);
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to start event');
        }
    };

    const openStartEventModal = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        setStartEventBookingData(booking);
        setStartEventModalVisible(true);
    };

    const confirmBooking = (booking) => {
        if (!booking) {
            message.error('No booking selected');
            return;
        }
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        const bookingNo = safeString(booking.booking_no);

        if (isBookingSchedulePassed(booking)) {
            autoCancelExpiredBooking(booking);
            return;
        }

        if (isBookingPendingAndToday(booking)) {
            setTodayBookingData(booking);
            setTodayBookingAction('approve');
            setTodayBookingModalVisible(true);
            return;
        }

        if (isBookingWithinThreeDays(booking)) {
            setThreeDayWarningBooking(booking);
            setThreeDayWarningModalVisible(true);
            return;
        }

        const daysUntil = getDaysUntilEvent(booking);
        const depositDays = getDepositPaymentDays(booking);
        const isLateBooking =
            daysUntil !== null &&
            daysUntil >= 0 &&
            depositDays > 0 &&
            daysUntil < depositDays;

        if (isLateBooking) {
            setLateApprovalBooking(booking);
            setLateApprovalAction('waive');
            setLateApprovalExtensionDays(daysUntil + 1);
            setLateApprovalNotes('');
            setLateApprovalModalVisible(true);
            return;
        }

             modal.confirm({
            title: 'Confirm Booking',
            content: `Confirm ${bookingNo}? The approved booking will be inserted into Orders & Events immediately and its quotation will be sent automatically.`,
            okText: 'Confirm Booking',
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
                              onOk: async () => {
                const bookingNoLocal = bookingNo;
                let cancelled = false;

                try {
                    const signal = showLoadingLine('approve', bookingNoLocal);

                    await new Promise((resolve) => {
                        const timer = setTimeout(resolve, 5000);
                        signal.addEventListener('abort', () => {
                            clearTimeout(timer);
                            cancelled = true;
                            resolve();
                        });
                    });

                    if (cancelled) return;

                    await confirmBookingMutation.mutateAsync(bookingId);

                    message.success({
                        content: `Booking ${bookingNoLocal} confirmed successfully!`,
                        duration: 4,
                    });
                } catch (error) {
                    if (
                        error?.name === 'CanceledError' ||
                        error?.name === 'AbortError' ||
                        error?.code === 'ERR_CANCELED'
                    ) {
                        return;
                    }
                    console.error('Approval error:', error);
                    const errorMsg = error?.response?.data?.message || error?.message || 'Failed to approve booking';
                    message.error(errorMsg);
                    throw error;
                } finally {
                    hideLoadingLine();
                }
            }
        });
    };

    const handleThreeDayWarningApprove = async () => {
        if (!threeDayWarningBooking) return;
        const bookingId = getBookingId(threeDayWarningBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        const daysUntil = getDaysUntilEvent(threeDayWarningBooking);
        const depositDays = getDepositPaymentDays(threeDayWarningBooking);
        const isLateBooking =
            daysUntil !== null &&
            daysUntil >= 0 &&
            depositDays > 0 &&
            daysUntil < depositDays;

        if (isLateBooking) {
            setThreeDayWarningModalVisible(false);
            setLateApprovalBooking(threeDayWarningBooking);
            setLateApprovalAction('waive');
            setLateApprovalExtensionDays(daysUntil + 1);
            setLateApprovalNotes('');
            setLateApprovalModalVisible(true);
            return;
        }

         const bookingNo = safeString(threeDayWarningBooking.booking_no);
        setThreeDayWarningModalVisible(false);

        let cancelled = false;

        try {
            const signal = showLoadingLine('approve', bookingNo);

            await new Promise((resolve) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    cancelled = true;
                    resolve();
                });
            });

            if (cancelled) return;

            await confirmBookingMutation.mutateAsync(bookingId);

            message.success({
                content: ` Booking ${bookingNo} confirmed successfully!`,
                duration: 4,
            });
        } catch (error) {
            if (
                error?.name === 'CanceledError' ||
                error?.name === 'AbortError' ||
                error?.code === 'ERR_CANCELED'
            ) {
                return;
            }
            console.error('Approval error:', error);
            const errorMsg = error?.response?.data?.message || error?.message || 'Failed to approve booking';
            message.error(errorMsg);
        } finally {
            hideLoadingLine();
            setThreeDayWarningBooking(null);
        }
    };
    const handleLateBookingApproval = async () => {
        if (!lateApprovalBooking) return;
        const bookingId = getBookingId(lateApprovalBooking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }

        if (lateApprovalAction === 'extend') {
            if (!lateApprovalExtensionDays || lateApprovalExtensionDays < 1) {
                message.warning('Please enter at least 1 day for the extension.');
                return;
            }
        }
        setLateApprovalSubmitting(true);
        const bookingNo = safeString(lateApprovalBooking.booking_no);

        let cancelled = false;

        try {
            const signal = showLoadingLine('approve', bookingNo);

            await new Promise((resolve) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    cancelled = true;
                    resolve();
                });
            });

            if (cancelled) return;

            await confirmBookingMutation.mutateAsync(bookingId);

            await api.post(`/bookings/${bookingId}/deposit-decision`, {
                action: lateApprovalAction,
                extension_days:
                    lateApprovalAction === 'extend'
                        ? safeNumber(lateApprovalExtensionDays, 7)
                        : null,
                notes:
                    lateApprovalNotes?.trim() ||
                    'Applied at approval (late booking).',
            });

            message.success({
                content: ` Booking ${bookingNo} confirmed successfully!`,
                duration: 4,
            });

            setLateApprovalModalVisible(false);
            setLateApprovalBooking(null);
            setThreeDayWarningBooking(null);
            await refreshAllData();
        } catch (error) {
            if (
                error?.name === 'CanceledError' ||
                error?.name === 'AbortError' ||
                error?.code === 'ERR_CANCELED'
            ) {
                return;
            }
            console.error('Late booking approval error:', error);
            message.error(
                error?.response?.data?.message ||
                    'Failed to approve booking with deposit decision.',
            );
        } finally {
            hideLoadingLine();
            setLateApprovalSubmitting(false);
        }
    };
    const closeLateBookingApprovalModal = () => {
        if (lateApprovalSubmitting) return;
        setLateApprovalModalVisible(false);
        setLateApprovalBooking(null);
        setLateApprovalAction('waive');
        setLateApprovalExtensionDays(7);
        setLateApprovalNotes('');
    };

    const handleThreeDayWarningCancel = () => {
        setThreeDayWarningModalVisible(false);
        setThreeDayWarningBooking(null);
    };

    const checkForDuplicateBooking = async (customerEmail, customerName, eventDate) => {
        try {
            const response = await api.get('/bookings', {
                params: {
                    search: customerEmail || customerName,
                    event_date: eventDate,
                    per_page: 10
                }
            });
            const existingBookings = response?.data?.data?.data || response?.data?.data || [];
            const duplicates = existingBookings.filter(booking => {
                const bookingEmail = booking.customer_email || booking.email || '';
                const bookingName = booking.customer_name || booking.name || '';
                const bookingDate = booking.event_date || '';
                const emailMatch = customerEmail && bookingEmail.toLowerCase() === customerEmail.toLowerCase();
                const nameMatch = customerName && bookingName.toLowerCase() === customerName.toLowerCase();
                const dateMatch = eventDate && bookingDate === eventDate;
                return (emailMatch || nameMatch) && dateMatch;
            });
            return {
                hasDuplicate: duplicates.length > 0,
                duplicates: duplicates,
                existingCustomer: duplicates.length > 0 ? duplicates[0] : null
            };
        } catch (error) {
            console.error('Error checking for duplicates:', error);
            return { hasDuplicate: false, duplicates: [], existingCustomer: null };
        }
    };

    const openCreateBookingModal = () => {
        quotationForm.resetFields();
        setEditingBooking(null);
        setSelectedMenuItems([]);
        setSelectedPackage(null);
        setSelectedPromo(null);
        setMenuSelectionType('customize');
        setCreateBookingStep(0);
        setServiceType('buffet');
        setEventScope('regular');
        setMultiDayDays(2);
        setModalPricingType('per_pax');
        setModalSelectedIds([]);
        setMealServices([]);
        setAddMealModalVisible(false);
        setPendingMealDay(null);
        setPendingMealType(null);
        guestCountRef.current = 10;
        setBillingAdjustments({
            transportation_fee: 0,
            setup_fee: 0,
            service_crew_fee: 0,
            equipment_rental: 0,
            extra_food_fee: 0,
            discount: 0,
            down_payment: 0
        });
        setFormValues({});
        setFieldErrors({});
        setIsSaving(false);

        quotationForm.setFieldsValue({
            delivery_method: 'delivery',
            guests_count: 10,
            event_time: '12:00 PM'
        });

        setQuotationModalVisible(true);
    };

    const validateStep = async (step) => {
        const form = quotationForm;

        if (step === 0) {
            try {
                await form.validateFields([
                    'customer_name',
                    'customer_email',
                    'customer_phone',
                    'venue',
                    'address_line_1',
                    'city',
                    'province',
                    'event_type_id',
                    'guests_count',
                    'event_date',
                    'event_time'
                ]);
                const currentValues = form.getFieldsValue();
                setFormValues({ ...formValues, ...currentValues });
                setFieldErrors({});
                return true;
            } catch (error) {
                const errorFields = error.errorFields || [];
                const errors = {};
                errorFields.forEach((field) => {
                    errors[field.name[0]] = field.errors[0];
                });
                setFieldErrors(errors);

                const firstError = errorFields[0];
                if (firstError) {
                    const fieldName = firstError.name[0];
                    const fieldLabels = {
                        customer_name: 'Customer Name',
                        customer_email: 'Email Address',
                        customer_phone: 'Phone Number',
                        venue: 'Event Venue',
                        address_line_1: 'Street Address',
                        city: 'City',
                        province: 'Province',
                        event_type_id: 'Event Type',
                        guests_count: 'Number of Guests',
                        event_date: 'Event Date',
                        event_time: 'Event Time'
                    };
                    const label = fieldLabels[fieldName] || fieldName;
                    message.error(`❌ ${label} is required`);
                }
                return false;
            }
        }

        if (step === 1) {
            try {
                const mealKeys = mealServices.map(meal => `${safeNumber(meal.day_number, 1)}::${normalizeMealLabel(meal.meal_type)}`);
                if (new Set(mealKeys).size !== mealKeys.length) {
                    message.warning('Each meal type may only be added once per day.');
                    return false;
                }
                if (eventScope === 'regular' && mealServices.some(meal => safeNumber(meal.day_number, 1) !== 1)) {
                    message.warning('Regular events can only contain Day 1 meal services.');
                    return false;
                }
                if (eventScope === 'multi_day' && mealServices.some(meal => safeNumber(meal.day_number, 1) > multiDayDays)) {
                    message.warning('A meal service is assigned beyond the configured event duration.');
                    return false;
                }
                const validMeals = getValidMealServices();
                if (validMeals.length === 0) {
                    message.warning('Please add at least one meal service with pax, menu items, and price.');
                    return false;
                }

                for (const meal of validMeals) {
                    if (!meal.custom_items || meal.custom_items.length === 0) {
                        message.warning(`Please select menu items for ${meal.meal_type}`);
                        return false;
                    }
                    if (safeNumber(meal.price_per_head) <= 0) {
                        message.warning(`Please set a price per head for ${meal.meal_type}`);
                        return false;
                    }
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        return true;
    };

    const handleCreateBookingNext = async () => {
        const currentStep = createBookingStep;
        const isValid = await validateStep(currentStep);
        if (!isValid) return;
        if (currentStep < 3) {
            setCreateBookingStep(currentStep + 1);
            const modalBody = document.querySelector('.bqm-modal-fixed-center .ant-modal-body');
            if (modalBody) modalBody.scrollTop = 0;
        }
    };

    const handleCreateBookingPrev = () => {
        if (createBookingStep > 0) {
            const currentValues = quotationForm.getFieldsValue();
            setFormValues({ ...formValues, ...currentValues });
            setCreateBookingStep(createBookingStep - 1);
        }
    };

    const getBaseEventDate = () => {
        const values = quotationForm.getFieldsValue();
        return values.event_date || formValues.event_date || null;
    };

    const getValidMealServices = () => mealServices.filter((meal) => {
        return safeNumber(meal.pax) > 0 &&
            safeNumber(meal.price_per_head) >= 0 &&
            (meal.package_id || meal.menu_item_id || meal.menu_name || meal.menu_description || meal.custom_items?.length > 0);
    });

    const updateMealService = (mealId, field, value) => {
        const currentMeal = mealServices.find(meal => meal.id === mealId);
        if (field === 'meal_type' && currentMeal) {
            const duplicateExists = mealServices.some(meal =>
                meal.id !== mealId &&
                safeNumber(meal.day_number, 1) === safeNumber(currentMeal.day_number, 1) &&
                normalizeMealLabel(meal.meal_type) === normalizeMealLabel(value)
            );
            if (duplicateExists) {
                message.warning(`${value} has already been added for Day ${currentMeal.day_number}.`);
                return;
            }
        }

        setMealServices(prev => prev.map(meal => {
            if (meal.id !== mealId) return meal;
            const next = { ...meal, [field]: value };
            if (field === 'menu_source') {
                next.menu_source = value;
                if (value === 'package') {
                    next.menu_item_id = null;
                    next.menu_name = '';
                    next.menu_description = '';
                    next.custom_items = [];
                } else {
                    next.package_id = null;
                }
            }
            if (field === 'package_id') {
                const selectedPkg = packagesList.find(p => String(p.package_id || p.id) === String(value));
                if (selectedPkg) {
                    next.package_id = value;
                    next.menu_name = selectedPkg.name || '';
                    next.menu_description = selectedPkg.description || '';
                    next.price_per_head = safeNumber(selectedPkg.base_price_per_pax);
                    const pkgItems = selectedPkg.menu_items || selectedPkg.items || [];
                    next.custom_items = pkgItems.map(item => ({
                        menu_item_id: item.menu_item_id || item.id,
                        item_name: item.name || 'Menu Item',
                        description: item.description || '',
                        quantity: 1,
                        unit_price: safeNumber(item.price || 0),
                        notes: ''
                    }));
                    const totalPrice = next.custom_items.reduce((sum, i) => sum + (safeNumber(i.unit_price) * safeNumber(i.quantity)), 0);
                    next.price_per_head = totalPrice;
                }
            }
            if (field === 'menu_item_id') {
                const selected = menuItemsList.find(item => String(item.menu_item_id || item.id) === String(value));
                if (selected) {
                    next.menu_item_id = value;
                    next.menu_name = selected.name || '';
                    const isTray = modalPricingType === 'tray';
                    if (isTray && selected.has_tray_pricing) {
                        next.tray_price = safeNumber(selected.tray_price, 0);
                        next.tray_servings = safeNumber(selected.tray_servings, 25);
                        next.tray_min_pax = safeNumber(selected.tray_min_pax, 20);
                        next.tray_max_pax = safeNumber(selected.tray_max_pax, 25);
                        next.tray_description = selected.tray_description || `Good for ${safeNumber(selected.tray_min_pax, 20)}–${safeNumber(selected.tray_max_pax, 25)} pax`;
                        next.price_per_head = safeNumber(selected.tray_price, 0);
                        next.pricing_type = 'tray';
                    } else {
                        next.price_per_head = safeNumber(selected.price || selected.unit_price || 0);
                        next.pricing_type = 'per_pax';
                    }
                }
            }
            if (field === 'tray_quantity') {
                next.tray_quantity = safeNumber(value, 1);
                if (next.pricing_type === 'tray') {
                    next.total_meal_amount = safeNumber(next.tray_price) * safeNumber(next.tray_quantity);
                }
            }
            if (['pax', 'price_per_head', 'menu_item_id', 'package_id'].includes(field)) {
                if (next.pricing_type === 'tray') {
                    next.total_meal_amount = safeNumber(next.tray_price) * safeNumber(next.tray_quantity, 1);
                } else {
                    next.total_meal_amount = safeNumber(next.pax) * safeNumber(next.price_per_head);
                }
            }
            if (field === 'meal_type') {
                next.serving_time = DEFAULT_MEAL_TIMES[value] || next.serving_time;
            }
            if (field === 'serving_time' || field === 'meal_type') {
                const effectiveServingTime = field === 'meal_type' ? next.serving_time : value;
                const timeIndex = timeOptions.indexOf(effectiveServingTime);
                next.preparation_time = timeIndex >= 2 ? timeOptions[timeIndex - 2] : next.preparation_time;
                next.dispatch_time = timeIndex >= 1 ? timeOptions[timeIndex - 1] : next.dispatch_time;
                next.arrival_time = timeIndex >= 1 ? timeOptions[timeIndex - 1] : next.arrival_time;
            }
            return next;
        }));
    };

    const normalizeCustomMealItem = (item) => {
        const isTray = modalPricingType === 'tray';
        const trayPrice = safeNumber(item.tray_price, 0);
        const perPaxPrice = safeNumber(item.price, 0);
        const price = (isTray && (item.pricing_type === 'tray' || item.pricing_type === 'both')) ? trayPrice : perPaxPrice;

        return {
            menu_item_id: item.menu_item_id || item.id,
            item_name: item.name || item.item_name || 'Menu Item',
            description: item.description || '',
            quantity: 1,
            unit_price: price,
            notes: item.notes || '',
            pricing_type: (isTray && (item.pricing_type === 'tray' || item.pricing_type === 'both')) ? 'tray' : 'per_pax',
            tray_price: trayPrice,
            tray_servings: safeNumber(item.tray_servings, 25),
            tray_min_pax: safeNumber(item.tray_min_pax, 20),
            tray_max_pax: safeNumber(item.tray_max_pax, 25),
            tray_description: item.tray_description || `Good for ${safeNumber(item.tray_min_pax, 20)}–${safeNumber(item.tray_max_pax, 25)} pax`,
            is_tray: (isTray && (item.pricing_type === 'tray' || item.pricing_type === 'both')),
            original_item: item
        };
    };

    const toggleGlobalPricingType = (type) => {
        setModalPricingType(type);
    };

    const calculateCustomItemsPrice = (items = []) => safeArray(items)
        .reduce((sum, item) => {
            const price = safeNumber(item.unit_price || item.price || 0);
            const qty = safeNumber(item.quantity, 1);
            return sum + (price * qty);
        }, 0);

    const setMealCustomItems = (mealId, selectedIds = []) => {
        setMealServices(prev => prev.map(meal => {
            if (meal.id !== mealId) return meal;
            const existingItems = safeArray(meal.custom_items);
            const nextItems = selectedIds.map(id => {
                const existing = existingItems.find(i => String(i.menu_item_id) === String(id));
                if (existing) return existing;
                const source = menuItemsList.find(item => String(item.menu_item_id || item.id) === String(id));
                if (!source) return null;
                return normalizeCustomMealItem(source);
            }).filter(Boolean);
            const pkgItems = meal.package_id ? packagesList
                .find(p => String(p.package_id || p.id) === String(meal.package_id))
                ?.menu_items?.map(item => normalizeCustomMealItem(item)) || [] : [];
            const allItems = [...pkgItems, ...nextItems];
            const uniqueItems = [];
            const seenIds = new Set();
            for (const item of allItems) {
                const id = String(item.menu_item_id || item.id);
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    uniqueItems.push(item);
                }
            }
            const hasTrayItems = uniqueItems.some(item => item.is_tray || item.pricing_type === 'tray');
            const totalPrice = calculateCustomItemsPrice(uniqueItems);
            return {
                ...meal,
                menu_source: 'custom',
                custom_items: uniqueItems,
                menu_item_id: uniqueItems.length === 1 ? uniqueItems[0].menu_item_id : null,
                menu_name: uniqueItems.map(i => i.item_name).join(', '),
                pricing_type: hasTrayItems ? 'tray' : 'per_pax',
                price_per_head: totalPrice,
                total_meal_amount: hasTrayItems
                    ? uniqueItems.reduce((sum, item) => sum + (safeNumber(item.unit_price) * safeNumber(item.tray_quantity || 1)), 0)
                    : safeNumber(meal.pax) * totalPrice
            };
        }));
    };

    const updateMealCustomItem = (mealId, menuItemId, field, value) => {
        setMealServices(prev => prev.map(meal => {
            if (meal.id !== mealId) return meal;
            const nextItems = safeArray(meal.custom_items).map(item =>
                String(item.menu_item_id) === String(menuItemId) ? { ...item, [field]: value } : item
            );
            const nextPrice = calculateCustomItemsPrice(nextItems);
            const hasTrayItems = nextItems.some(item => item.is_tray || item.pricing_type === 'tray');
            return {
                ...meal,
                custom_items: nextItems,
                menu_name: nextItems.map(i => i.item_name).join(', '),
                pricing_type: hasTrayItems ? 'tray' : 'per_pax',
                price_per_head: nextPrice,
                total_meal_amount: hasTrayItems
                    ? nextItems.reduce((sum, item) => sum + (safeNumber(item.unit_price) * safeNumber(item.tray_quantity || 1)), 0)
                    : safeNumber(meal.pax) * nextPrice
            };
        }));
    };

    const removeMealCustomItem = (mealId, menuItemId) => {
        setMealServices(prev => prev.map(meal => {
            if (meal.id !== mealId) return meal;
            const nextItems = safeArray(meal.custom_items).filter(item => String(item.menu_item_id) !== String(menuItemId));
            const nextPrice = calculateCustomItemsPrice(nextItems);
            const hasTrayItems = nextItems.some(item => item.is_tray || item.pricing_type === 'tray');
            return {
                ...meal,
                custom_items: nextItems,
                menu_item_id: nextItems.length === 1 ? nextItems[0].menu_item_id : null,
                menu_name: nextItems.map(i => i.item_name).join(', '),
                pricing_type: hasTrayItems ? 'tray' : 'per_pax',
                price_per_head: nextPrice,
                total_meal_amount: hasTrayItems
                    ? nextItems.reduce((sum, item) => sum + (safeNumber(item.unit_price) * safeNumber(item.tray_quantity || 1)), 0)
                    : safeNumber(meal.pax) * nextPrice
            };
        }));
    };

    const openAddMealModal = () => {
        setPendingMealDay(eventScope === 'regular' ? 1 : null);
        setPendingMealType(null);
        setAddMealModalVisible(true);
    };

    const addMealService = () => {
        const dayNumber = eventScope === 'regular' ? 1 : safeNumber(pendingMealDay, 0);
        if (!dayNumber || !pendingMealType) {
            message.warning(eventScope === 'multi_day' ? 'Select a day and meal type.' : 'Select a meal type.');
            return;
        }
        if (dayNumber > multiDayDays && eventScope === 'multi_day') {
            message.warning('Selected day is outside the configured event duration.');
            return;
        }
        const duplicateExists = mealServices.some(meal =>
            safeNumber(meal.day_number, 1) === dayNumber &&
            normalizeMealLabel(meal.meal_type) === normalizeMealLabel(pendingMealType)
        );
        if (duplicateExists) {
            message.warning(`${pendingMealType} has already been added for Day ${dayNumber}.`);
            return;
        }

        const baseDate = getBaseEventDate();
        const computedDate = baseDate ? dayjs(baseDate).add(dayNumber - 1, 'day') : null;
        const servingTime = DEFAULT_MEAL_TIMES[pendingMealType] || '12:00 PM';
        const servingIndex = timeOptions.indexOf(servingTime);
        setMealServices(prev => sortMealServicesChronologically([
            ...prev,
            createDefaultMealService({
                day_number: dayNumber,
                service_date: computedDate,
                meal_type: pendingMealType,
                serving_time: servingTime,
                preparation_time: servingIndex >= 2 ? timeOptions[servingIndex - 2] : '8:00 AM',
                dispatch_time: servingIndex >= 1 ? timeOptions[servingIndex - 1] : '8:00 AM',
                arrival_time: servingIndex >= 1 ? timeOptions[servingIndex - 1] : '8:00 AM',
                pax: safeNumber(quotationForm.getFieldValue('guests_count'), 10)
            })
        ]));
        setAddMealModalVisible(false);
        setPendingMealDay(null);
        setPendingMealType(null);
    };

    const generateMealServicesForDays = () => {
        const baseDate = getBaseEventDate();
        const defaultMeals = [...MEAL_SEQUENCE];
        const pax = safeNumber(quotationForm.getFieldValue('guests_count'), 10);
        const services = [];
        for (let day = 1; day <= (eventScope === 'multi_day' ? multiDayDays : 1); day += 1) {
            defaultMeals.forEach((mealType, index) => {
                const serving = DEFAULT_MEAL_TIMES[mealType] || '12:00 PM';
                services.push(createDefaultMealService({
                    day_number: day,
                    service_date: baseDate ? dayjs(baseDate).add(day - 1, 'day') : null,
                    meal_type: mealType,
                    serving_time: serving,
                    pax,
                    preparation_time: index === 0 ? '5:00 AM' : timeOptions[Math.max(0, timeOptions.indexOf(serving) - 2)] || '8:00 AM',
                    dispatch_time: timeOptions[Math.max(0, timeOptions.indexOf(serving) - 1)] || '8:00 AM',
                    arrival_time: timeOptions[Math.max(0, timeOptions.indexOf(serving) - 1)] || '8:00 AM'
                }));
            });
        }
        setMealServices(sortMealServicesChronologically(services));
        message.success('Meal schedule generated. Choose menu items and price for each meal.');
    };

    const removeMealService = (mealId) => {
        setMealServices(prev => prev.filter(meal => meal.id !== mealId));
    };

    const handleGuestCountChange = (value) => {
        const nextGuestCount = safeNumber(value, 1);
        const previousGuestCount = guestCountRef.current;
        guestCountRef.current = nextGuestCount;
        setMealServices(prev => prev.map(meal => {
            const shouldSync = safeNumber(meal.pax, previousGuestCount) === previousGuestCount;
            if (!shouldSync) return meal;
            if (meal.pricing_type === 'tray') {
                return {
                    ...meal,
                    pax: nextGuestCount,
                };
            }
            return {
                ...meal,
                pax: nextGuestCount,
                total_meal_amount: nextGuestCount * safeNumber(meal.price_per_head),
            };
        }));
    };

    const calculateMealServicesTotal = () => mealServices.reduce((sum, meal) => {
        if (meal.pricing_type === 'tray') {
            return sum + (safeNumber(meal.tray_price) * safeNumber(meal.tray_quantity, 1));
        }
        return sum + (safeNumber(meal.pax) * safeNumber(meal.price_per_head));
    }, 0);

    const calculateBillingAdjustmentsTotal = () => safeNumber(billingAdjustments.transportation_fee) + safeNumber(billingAdjustments.setup_fee) + safeNumber(billingAdjustments.service_crew_fee) + safeNumber(billingAdjustments.equipment_rental) + safeNumber(billingAdjustments.extra_food_fee);

    const calculateTotalAmount = () => {
        const mealTotal = calculateMealServicesTotal();
        let total = mealTotal > 0 ? mealTotal : selectedMenuItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
        total += calculateBillingAdjustmentsTotal();
        total = Math.max(0, total - safeNumber(billingAdjustments.discount));
        if (selectedPromo) {
            if (selectedPromo.discount_type === 'percentage') {
                total = total * (1 - selectedPromo.discount_value / 100);
            } else {
                total = Math.max(0, total - selectedPromo.discount_value);
            }
        }
        return total;
    };

    const openMenuSelection = (mealId) => {
        const meal = mealServices.find(m => m.id === mealId);
        const existingSelectedIds = meal?.custom_items?.map(item => String(item.menu_item_id || item.id)) || [];

        setSelectedMealId(mealId);
        setMenuSearchTerm('');
        setMenuCategoryFilter('all');
        setMenuViewMode('grid');
        setMenuSelectionMode('menu_items');

        setModalSelectedIds([...existingSelectedIds]);

        let currentPricingType = 'per_pax';
        if (meal?.custom_items && meal.custom_items.length > 0) {
            const hasTray = meal.custom_items.some(item => item.pricing_type === 'tray');
            if (hasTray) {
                currentPricingType = 'tray';
            }
        }
        setModalPricingType(currentPricingType);

        setMenuSelectionModalVisible(true);
    };

    const handleSelectMenuItems = () => {
        if (selectedMealId) {
            setMealCustomItems(selectedMealId, modalSelectedIds);
        }
        setMenuSelectionModalVisible(false);
        setSelectedMealId(null);
        setMenuSelectionMode('menu_items');
        setModalSelectedIds([]);
    };

    const handleCancelMenuSelection = () => {
        setModalSelectedIds([]);
        setMenuSelectionModalVisible(false);
        setSelectedMealId(null);
        setMenuSelectionMode('menu_items');
    };

    const handleSelectPackage = (packageId) => {
        const pkg = packagesList.find(p => String(p.package_id || p.id) === String(packageId));
        if (pkg && selectedMealId) {
            const pkgItems = pkg.menu_items || pkg.items || [];
            const itemIds = pkgItems.map(item => String(item.menu_item_id || item.id));
            setMealCustomItems(selectedMealId, itemIds);
            updateMealService(selectedMealId, 'package_id', packageId);
            updateMealService(selectedMealId, 'menu_source', 'package');
            const totalPrice = pkgItems.reduce((sum, item) => sum + safeNumber(item.price || 0), 0);
            updateMealService(selectedMealId, 'price_per_head', totalPrice);
        }
        setMenuSelectionModalVisible(false);
        setSelectedMealId(null);
        setMenuSelectionMode('menu_items');
        setModalSelectedIds([]);
        message.success('Package items added to meal');
    };

    const handleSelectPromo = (promoId) => {
        const promo = promosList.find(p => String(p.promotion_id || p.id) === String(promoId));
        if (promo) {
            setSelectedPromo(promo);
            message.success(`Promo ${promo.code} applied`);
        }
        setMenuSelectionModalVisible(false);
        setSelectedMealId(null);
        setMenuSelectionMode('menu_items');
        setModalSelectedIds([]);
    };

    const saveBooking = async (values) => {
        if (saveLockRef.current || isSaving) {
            console.log('⏳ Save already in progress, skipping...');
            return;
        }

        saveLockRef.current = true;
        setIsSaving(true);

        try {
            const allValues = { ...formValues, ...values };

            const formattedMealServices = sortedMealServices
                .filter(meal => meal.pax > 0 && (meal.package_id || meal.menu_item_id || meal.custom_items?.length > 0))
                .map(meal => ({
                    day_number: safeNumber(meal.day_number, 1),
                    service_date: meal.service_date ? dayjs(meal.service_date).format('YYYY-MM-DD') : null,
                    meal_type: meal.meal_type || 'Lunch',
                    serving_time: meal.serving_time || '12:00 PM',
                    preparation_time: meal.preparation_time || '10:00 AM',
                    dispatch_time: meal.dispatch_time || '11:00 AM',
                    arrival_time: meal.arrival_time || '11:30 AM',
                    pax: safeNumber(meal.pax),
                    menu_source: meal.menu_source || 'custom',
                    package_id: meal.package_id ? Number(meal.package_id) : null,
                    menu_item_id: meal.menu_item_id ? Number(meal.menu_item_id) : null,
                    menu_name: meal.menu_name || '',
                    menu_description: meal.menu_description || '',
                    filters: Array.isArray(meal.filters) ? meal.filters : [],
                    custom_items: safeArray(meal.custom_items).map(item => ({
                        menu_item_id: item.menu_item_id ? Number(item.menu_item_id) : null,
                        item_name: item.item_name || item.name || '',
                        description: item.description || '',
                        quantity: safeNumber(item.quantity, 1),
                        unit_price: safeNumber(item.unit_price || item.price, 0),
                        notes: item.notes || '',
                        pricing_type: item.pricing_type || 'per_pax',
                        tray_price: safeNumber(item.tray_price || 0, 0),
                        tray_servings: safeNumber(item.tray_servings || 25, 25),
                        tray_min_pax: safeNumber(item.tray_min_pax || 20, 20),
                        tray_max_pax: safeNumber(item.tray_max_pax || 25, 25),
                        tray_quantity: safeNumber(item.tray_quantity || 1, 1)
                    })),
                    price_per_head: safeNumber(meal.price_per_head, 0),
                    total_meal_amount: meal.pricing_type === 'tray'
                        ? safeNumber(meal.tray_price) * safeNumber(meal.tray_quantity, 1)
                        : safeNumber(meal.pax) * safeNumber(meal.price_per_head, 0),
                    notes: meal.notes || '',
                    meal_status: String(meal.meal_status || 'pending').toLowerCase().replaceAll(' ', '_'),
                    pricing_type: meal.pricing_type || 'per_pax',
                    tray_price: safeNumber(meal.tray_price, 0),
                    tray_servings: safeNumber(meal.tray_servings, 25),
                    tray_min_pax: safeNumber(meal.tray_min_pax, 20),
                    tray_max_pax: safeNumber(meal.tray_max_pax, 25),
                    tray_description: meal.tray_description || `Good for ${safeNumber(meal.tray_min_pax, 20)}–${safeNumber(meal.tray_max_pax, 25)} pax`,
                    tray_quantity: safeNumber(meal.tray_quantity, 1)
                }));

            const addressLine1 = allValues.address_line_1 || allValues.address || '';
            const city = allValues.city || '';
            const province = allValues.province || '';
            const postalCode = allValues.postal_code || '';
            const fullAddress = [addressLine1, city, province, postalCode, 'Philippines'].filter(Boolean).join(', ');

            const eventDateFormatted = allValues.event_date ? dayjs(allValues.event_date).format('YYYY-MM-DD') : null;
            let eventEndDate = eventDateFormatted;
            if (eventScope === 'multi_day' && eventDateFormatted) {
                eventEndDate = dayjs(eventDateFormatted).add(multiDayDays - 1, 'days').format('YYYY-MM-DD');
            }

            const mealTotal = calculateMealServicesTotal();
            const adjustmentTotal = calculateBillingAdjustmentsTotal();
            let totalAmount = mealTotal + adjustmentTotal;
            totalAmount = Math.max(0, totalAmount - safeNumber(billingAdjustments.discount));

            const totalBeforePromo = totalAmount;
            let promoDiscountAmount = 0;
            if (selectedPromo) {
                if (selectedPromo.discount_type === 'percentage') {
                    promoDiscountAmount = totalBeforePromo * (safeNumber(selectedPromo.discount_value) / 100);
                    totalAmount = totalAmount * (1 - safeNumber(selectedPromo.discount_value) / 100);
                } else {
                    promoDiscountAmount = Math.min(totalBeforePromo, safeNumber(selectedPromo.discount_value));
                    totalAmount = Math.max(0, totalAmount - safeNumber(selectedPromo.discount_value));
                }
            }

            const bookingData = {
                customer_name: allValues.customer_name || '',
                customer_email: allValues.customer_email || '',
                customer_phone: allValues.customer_phone || '',
                customer_address: fullAddress,
                address_line_1: addressLine1,
                city: city,
                province: province,
                postal_code: postalCode,
                country: 'Philippines',
                event_type_id: Number(allValues.event_type_id) || null,
                event_date: eventDateFormatted,
                event_end_date: eventEndDate,
                event_time: allValues.event_time || '12:00 PM',
                venue: allValues.venue || '',
                guests_count: Number(allValues.guests_count) || 0,
                total_amount: Number(totalAmount.toFixed(2)),
                transportation_fee: safeNumber(billingAdjustments.transportation_fee),
                setup_fee: safeNumber(billingAdjustments.setup_fee),
                service_crew_fee: safeNumber(billingAdjustments.service_crew_fee),
                equipment_rental: safeNumber(billingAdjustments.equipment_rental),
                extra_food_fee: safeNumber(billingAdjustments.extra_food_fee),
                discount: safeNumber(billingAdjustments.discount),
                down_payment: safeNumber(billingAdjustments.down_payment),
                special_requests: allValues.special_requests || '',
                service_type: serviceType,
                delivery_method: serviceType === 'buffet' ? 'delivery' : (allValues.delivery_method || 'pickup'),
                menu_selection_type: 'custom',
                meal_services: formattedMealServices,
                promo_id: selectedPromo ? Number(selectedPromo.promotion_id || selectedPromo.id) : null,
                promo_code: selectedPromo?.code || null,
                promo_name: selectedPromo?.name || null,
                promo_discount_type: selectedPromo?.discount_type || null,
                promo_discount_value: selectedPromo ? safeNumber(selectedPromo.discount_value) : null,
                promo_discount_amount: selectedPromo ? Number(promoDiscountAmount.toFixed(2)) : null,
                booking_status: 'pending_approval',
                booking_scope: eventScope === 'multi_day' ? 'multi_day' : 'regular',
            };

            Object.keys(bookingData).forEach(key => {
                if (bookingData[key] === undefined || bookingData[key] === null) {
                    delete bookingData[key];
                }
            });

            console.log('📝 Sending booking data:', JSON.stringify(bookingData, null, 2));

            const isUpdate = !!editingBooking?.booking_id;
            const url = isUpdate ? `/bookings/${editingBooking.booking_id}` : '/bookings';
            const method = isUpdate ? 'put' : 'post';

            const response = await api[method](url, bookingData, {
                timeout: 12000
            });

            const responsePayload = response?.data?.data || response?.data || {};
            const bookingNo = responsePayload?.booking_no || 'N/A';
            message.success({
                content: isUpdate ? ` Booking ${bookingNo} updated successfully!` : ` Booking ${bookingNo} created successfully!`,
                duration: 3,
            });

            quotationForm.resetFields();
            setSelectedMenuItems([]);
            setSelectedPackage(null);
            setSelectedPromo(null);
            setEditingBooking(null);
            setMealServices([]);
            setModalPricingType('per_pax');
            setModalSelectedIds([]);
            setBillingAdjustments({
                transportation_fee: 0,
                setup_fee: 0,
                service_crew_fee: 0,
                equipment_rental: 0,
                extra_food_fee: 0,
                discount: 0,
                down_payment: 0
            });
                     setFormValues({});
            setQuotationModalVisible(false);
            setCreateBookingStep(0);

            void refreshAllData(false);

            // ⭐⭐⭐ BUG FIX #3:
            // Tell every other open tab / window that this booking changed
            // so their React Query cache refetches.
            const changedBookingId =
                responsePayload?.booking_id ||
                responsePayload?.id ||
                editingBooking?.booking_id;

            if (changedBookingId) {
                broadcastBookingChanged(
                    changedBookingId,
                    isUpdate ? 'booking_updated' : 'booking_created'
                );
            }

        } catch (error) {
            console.error('❌ Booking creation error:', error);

            let errorMessage = 'Failed to create booking. Please check the form for errors.';

            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                errorMessage = '⏳ The request is taking longer than expected. Please check if the booking was created and refresh the page.';
            } else if (error?.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                if (status === 500) {
                    const msg = errorData?.message || '';
                    if (msg.includes('Duplicate entry') || msg.includes('1062')) {
                        errorMessage = '⚠️ Duplicate booking detected. Please check if this booking already exists.';
                    } else if (msg.includes('Integrity constraint')) {
                        errorMessage = '⚠️ Database constraint error. Please check all required fields are filled correctly.';
                    } else {
                        errorMessage = `⚠️ Server error: ${msg || 'Please try again.'}`;
                    }
                } else if (status === 422 && errorData.errors) {
                    const errors = errorData.errors;
                    const errorMessages = Object.keys(errors).map(key =>
                        `${key}: ${Array.isArray(errors[key]) ? errors[key].join(', ') : errors[key]}`
                    );
                    errorMessage = errorMessages.join('\n');
                } else if (errorData?.message) {
                    errorMessage = errorData.message;
                }
            } else if (error?.message === 'Network Error') {
                errorMessage = 'Cannot reach the API server. Make sure Laravel is running, the API URL is correct, and the backend did not crash while saving.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            message.error({
                content: errorMessage,
                duration: 6,
                style: { whiteSpace: 'pre-wrap' }
            });

               } finally {
            saveLockRef.current = false;
            setIsSaving(false);
        }
    };

    const renderCustomerEventStep = () => {
        const safeEventTypes = safeArray(eventTypes);

        return (
            <div className="bqm-step-professional">
                <div className="bqm-step-header-professional">
                    <div className="bqm-step-icon-professional">
                        <UserOutlined />
                    </div>
                    <div>
                        <h3 className="bqm-step-title-professional">Customer & Event Details</h3>
                        <p className="bqm-step-desc-professional">Enter the customer information and event specifics</p>
                    </div>
                </div>

                <div className="bqm-step-body-professional">
                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            <UserOutlined /> Customer Information
                        </div>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="customer_name"
                                    label="Full Name"
                                    rules={[{ required: true, message: 'Customer name is required' }]}
                                    validateStatus={fieldErrors.customer_name ? 'error' : ''}
                                    help={fieldErrors.customer_name}
                                >
                                    <Input
                                        placeholder="Enter full name"
                                        prefix={<UserOutlined className="bqm-input-icon" />}
                                        size="large"
                                        className="bqm-input-professional"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="customer_email"
                                    label="Email Address"
                                    rules={[
                                        { required: true, message: 'Email is required' },
                                        { type: 'email', message: 'Invalid email format' }
                                    ]}
                                    validateStatus={fieldErrors.customer_email ? 'error' : ''}
                                    help={fieldErrors.customer_email}
                                >
                                    <Input
                                        placeholder="Enter email address"
                                        prefix={<MailOutlined className="bqm-input-icon" />}
                                        size="large"
                                        className="bqm-input-professional"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="customer_phone"
                                    label="Phone Number"
                                    rules={[{ required: true, message: 'Phone number is required' }]}
                                    validateStatus={fieldErrors.customer_phone ? 'error' : ''}
                                    help={fieldErrors.customer_phone}
                                >
                                    <Input
                                        placeholder="Enter phone number"
                                        prefix={<PhoneOutlined className="bqm-input-icon" />}
                                        size="large"
                                        className="bqm-input-professional"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="venue"
                                    label="Event Venue"
                                    rules={[{ required: true, message: 'Venue is required' }]}
                                    validateStatus={fieldErrors.venue ? 'error' : ''}
                                    help={fieldErrors.venue}
                                >
                                    <Input
                                        placeholder="Enter venue name"
                                        prefix={<EnvironmentOutlined className="bqm-input-icon" />}
                                        size="large"
                                        className="bqm-input-professional"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            <EnvironmentOutlined /> Address Details
                        </div>
                        <Form.Item
                            name="address_line_1"
                            label="Street Address"
                            rules={[{ required: true, message: 'Address is required' }]}
                            validateStatus={fieldErrors.address_line_1 ? 'error' : ''}
                            help={fieldErrors.address_line_1}
                        >
                            <Input
                                placeholder="Enter street address"
                                size="large"
                                className="bqm-input-professional"
                            />
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item
                                    name="city"
                                    label="City"
                                    rules={[{ required: true, message: 'City is required' }]}
                                    validateStatus={fieldErrors.city ? 'error' : ''}
                                    help={fieldErrors.city}
                                >
                                    <Input placeholder="Enter city" size="large" className="bqm-input-professional" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="province"
                                    label="Province"
                                    rules={[{ required: true, message: 'Province is required' }]}
                                    validateStatus={fieldErrors.province ? 'error' : ''}
                                    help={fieldErrors.province}
                                >
                                    <Input placeholder="Enter province" size="large" className="bqm-input-professional" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="postal_code"
                                    label="Postal Code"
                                >
                                    <Input placeholder="Enter postal code" size="large" className="bqm-input-professional" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            <CalendarOutlined /> Event Details
                        </div>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="event_type_id"
                                    label="Event Type"
                                    rules={[{ required: true, message: 'Event type is required' }]}
                                    validateStatus={fieldErrors.event_type_id ? 'error' : ''}
                                    help={fieldErrors.event_type_id}
                                >
                                    <Select
                                        placeholder="Select event type"
                                        size="large"
                                        className="bqm-select-professional"
                                        showSearch
                                        optionFilterProp="children"
                                    >
                                        {safeEventTypes.map((type) => {
                                            const typeId = type.event_type_id || type.id;
                                            const typeName = type.name || 'Unknown Event Type';
                                            return (
                                                <Option key={typeId} value={typeId}>
                                                    {typeName}
                                                </Option>
                                            );
                                        })}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="guests_count"
                                    label="Number of Guests"
                                    rules={[
                                        { required: true, message: 'Guest count is required' },
                                        { type: 'number', min: 1, message: 'Must be at least 1' }
                                    ]}
                                    validateStatus={fieldErrors.guests_count ? 'error' : ''}
                                    help={fieldErrors.guests_count}
                                >
                                    <InputNumber
                                        min={1}
                                        onChange={handleGuestCountChange}
                                        style={{ width: '100%' }}
                                        placeholder="Enter guest count"
                                        size="large"
                                        className="bqm-input-professional"
                                        prefix={<TeamOutlined className="bqm-input-icon" />}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="event_date"
                                    label="Event Date"
                                    rules={[{ required: true, message: 'Event date is required' }]}
                                    validateStatus={fieldErrors.event_date ? 'error' : ''}
                                    help={fieldErrors.event_date}
                                >
                                    <DatePicker
                                        style={{ width: '100%' }}
                                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                                        format="YYYY-MM-DD"
                                        size="large"
                                        placeholder="Select event date"
                                        className="bqm-datepicker-professional"
                                        suffixIcon={<CalendarOutlined />}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="event_time"
                                    label="Event Time"
                                    rules={[{ required: true, message: 'Event time is required' }]}
                                    validateStatus={fieldErrors.event_time ? 'error' : ''}
                                    help={fieldErrors.event_time}
                                >
                                    <Select
                                        placeholder="Select event time"
                                        size="large"
                                        className="bqm-select-professional"
                                        suffixIcon={<ClockCircleOutlined />}
                                    >
                                        {timeOptions.map((time) => (
                                            <Option key={time} value={time}>{time}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </div>

                <div className="bqm-step-footer-professional">
                    <div className="bqm-step-progress-professional">
                        <Progress percent={25} showInfo={false} size="small" />
                    </div>
                    <div className="bqm-step-info-professional">
                        <span>Step 1 of 4</span>
                        <span>Customer & Event Info</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderServiceScopeStep = () => {
        return (
            <div className="bqm-step-professional">
                <div className="bqm-step-header-professional">
                    <div className="bqm-step-icon-professional">
                        <ScheduleOutlined />
                    </div>
                    <div>
                        <h3 className="bqm-step-title-professional">Service & Scope Configuration</h3>
                        <p className="bqm-step-desc-professional">Define how the event will be serviced</p>
                    </div>
                </div>

                <div className="bqm-step-body-professional">
                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            Service Type
                        </div>
                        <Radio.Group
                            value={serviceType}
                            onChange={(e) => {
                                const nextServiceType = e.target.value;
                                setServiceType(nextServiceType);
                                if (nextServiceType === 'buffet') {
                                    quotationForm.setFieldValue('delivery_method', 'delivery');
                                }
                            }}
                            className="bqm-service-radio-professional"
                            size="large"
                        >
                            {serviceTypeOptions.map(option => (
                                <Radio.Button key={option.value} value={option.value} className="bqm-service-option-professional">
                                    <div className="bqm-service-option-content">
                                        <div className="bqm-service-option-text">
                                            <div className="bqm-service-option-label">{option.label}</div>
                                            <div className="bqm-service-option-desc">{option.description}</div>
                                        </div>
                                    </div>
                                </Radio.Button>
                            ))}
                        </Radio.Group>
                    </div>

                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            Event Scope
                        </div>
                        <Radio.Group
                            value={eventScope}
                            onChange={(e) => setEventScope(e.target.value)}
                            className="bqm-scope-radio-professional"
                            size="large"
                        >
                            {eventScopeOptions.map(option => (
                                <Radio.Button key={option.value} value={option.value} className="bqm-scope-option-professional">
                                    <div className="bqm-scope-option-content">
                                        <div className="bqm-scope-option-text">
                                            <div className="bqm-scope-option-label">{option.label}</div>
                                            <div className="bqm-scope-option-desc">{option.description}</div>
                                        </div>
                                    </div>
                                </Radio.Button>
                            ))}
                        </Radio.Group>

                        {eventScope === 'multi_day' && (
                            <div className="bqm-multi-day-config-professional">
                                <div className="bqm-multi-day-label">Number of Days</div>
                                <Space size="middle" align="center">
                                    <InputNumber
                                        min={2}
                                        max={30}
                                        value={multiDayDays}
                                        onChange={(value) => setMultiDayDays(value || 2)}
                                        size="large"
                                        className="bqm-multi-day-input"
                                    />
                                    <span className="bqm-multi-day-text">days</span>
                                    <Tag color="blue" className="bqm-multi-day-badge">{multiDayDays} days total</Tag>
                                </Space>
                            </div>
                        )}
                    </div>

                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            Meal Services
                        </div>
                        <div className="bqm-meal-toolbar-professional">
                            <Button
                                size="large"
                                icon={<ScheduleOutlined />}
                                onClick={generateMealServicesForDays}
                                className="bqm-toolbar-btn"
                            >
                                Generate Schedule
                            </Button>
                            <Button
                                size="large"
                                type="primary"
                                ghost
                                icon={<PlusOutlined />}
                                onClick={openAddMealModal}
                                className="bqm-toolbar-btn"
                            >
                                Add Meal
                            </Button>
                        </div>

                        <div className="bqm-meal-list-professional">
                            {sortedMealServices.length === 0 && (
                                <Empty description="No meal services added yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                            {sortedMealServices.map((meal, index) => (
                                <Card key={meal.id} className="bqm-meal-card-professional"
                                    title={
                                        <div className="bqm-meal-card-title">
                                            <span className="bqm-meal-number">Meal #{index + 1}</span>
                                            <Tag color="blue" className="bqm-meal-day-tag">Day {meal.day_number}</Tag>
                                            {meal.package_id && (
                                                <Tag color="purple">Package: {packagesList.find(p => String(p.package_id || p.id) === String(meal.package_id))?.name || 'Package'}</Tag>
                                            )}
                                        </div>
                                    }
                                    extra={
                                        mealServices.length > 0 && (
                                            <Button
                                                danger
                                                size="small"
                                                type="text"
                                                icon={<DeleteOutlined />}
                                                onClick={() => removeMealService(meal.id)}
                                            />
                                        )
                                    }
                                >
                                    <Row gutter={[16, 12]}>
                                        <Col span={6}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Meal Type</span>
                                                <Select
                                                    value={meal.meal_type}
                                                    onChange={(value) => updateMealService(meal.id, 'meal_type', value)}
                                                    size="middle"
                                                    className="bqm-meal-select"
                                                    style={{ width: '100%' }}
                                                >
                                                    {mealTypeOptions.map(type => <Option key={type} value={type}>{type}</Option>)}
                                                </Select>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Serving Time</span>
                                                <Select
                                                    value={meal.serving_time}
                                                    onChange={(value) => updateMealService(meal.id, 'serving_time', value)}
                                                    size="middle"
                                                    className="bqm-meal-select"
                                                    style={{ width: '100%' }}
                                                >
                                                    {timeOptions.map(time => <Option key={time} value={time}>{time}</Option>)}
                                                </Select>
                                            </div>
                                        </Col>
                                        <Col span={4}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Pax</span>
                                                <InputNumber
                                                    min={1}
                                                    value={meal.pax}
                                                    onChange={(value) => updateMealService(meal.id, 'pax', value || 1)}
                                                    size="middle"
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        </Col>
                                        <Col span={4}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Price/Head</span>
                                                <InputNumber
                                                    min={0}
                                                    value={meal.price_per_head}
                                                    formatter={value => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                    parser={value => value?.replace(/₱\s?|(,*)/g, '')}
                                                    onChange={(value) => {
                                                        const newPrice = value || 0;
                                                        updateMealService(meal.id, 'price_per_head', newPrice);
                                                        const pax = safeNumber(meal.pax);
                                                        const total = pax * newPrice;
                                                        updateMealService(meal.id, 'total_meal_amount', total);
                                                    }}
                                                    size="middle"
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        </Col>
                                        <Col span={4}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Total</span>
                                                <div className="bqm-meal-total-professional">
                                                    {formatCurrency(safeNumber(meal.pax) * safeNumber(meal.price_per_head))}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col span={8}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Menu Selection</span>
                                                <Button
                                                    type="primary"
                                                    ghost
                                                    size="middle"
                                                    onClick={() => openMenuSelection(meal.id)}
                                                    icon={<MenuOutlined />}
                                                    style={{ width: '100%' }}
                                                >
                                                    {meal.custom_items?.length > 0
                                                        ? `${meal.custom_items.length} items selected`
                                                        : 'Select Menu Items'}
                                                </Button>
                                            </div>
                                        </Col>
                                        <Col span={16}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Notes</span>
                                                <Input
                                                    value={meal.notes}
                                                    onChange={(e) => updateMealService(meal.id, 'notes', e.target.value)}
                                                    placeholder="Special requests or notes..."
                                                    size="middle"
                                                />
                                            </div>
                                        </Col>
                                    </Row>
                                    {meal.custom_items?.length > 0 && (
                                        <div className="bqm-meal-selected-items">
                                            <div className="bqm-selected-items-label">Selected Items:</div>
                                            <div className="bqm-selected-items-list">
                                                {meal.custom_items.map((item, idx) => {
                                                    const isTray = item.is_tray || item.pricing_type === 'tray';
                                                    return (
                                                        <Tag key={idx} closable onClose={() => removeMealCustomItem(meal.id, item.menu_item_id)}>
                                                            {item.item_name}
                                                            {isTray
                                                                ? ` (Tray: ${formatCurrency(item.unit_price)} × ${safeNumber(item.tray_quantity || 1)})`
                                                                : ` (${formatCurrency(item.unit_price)})`}
                                                            {isTray && item.tray_description && (
                                                                <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>
                                                                    {item.tray_description}
                                                                </span>
                                                            )}
                                                        </Tag>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>

                        <div className="bqm-meal-summary-professional">
                            <Alert
                                type="info"
                                showIcon
                                message={
                                    <div className="bqm-meal-summary-content">
                                        <span>Meal Services Total:</span>
                                        <strong>{formatCurrency(calculateMealServicesTotal())}</strong>
                                    </div>
                                }
                                className="bqm-meal-summary-alert"
                            />
                        </div>
                    </div>

                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            Delivery Method
                        </div>
                        <Form.Item
                            name="delivery_method"
                            initialValue="delivery"
                            style={{ maxWidth: 300 }}
                        >
                            <Select
                                placeholder="Select delivery method"
                                size="large"
                                className="bqm-select-professional"
                                disabled={serviceType === 'buffet'}
                            >
                                <Option value="pickup">Pickup</Option>
                                <Option value="delivery">Delivery</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            Special Requests
                        </div>
                        <Form.Item name="special_requests">
                            <TextArea
                                rows={3}
                                placeholder="Any special requests, dietary restrictions, or additional notes..."
                                className="bqm-textarea-professional"
                                maxLength={500}
                                showCount
                            />
                        </Form.Item>
                    </div>
                </div>

                <div className="bqm-step-footer-professional">
                    <div className="bqm-step-progress-professional">
                        <Progress percent={50} showInfo={false} size="small" strokeColor="#8b5cf6" />
                    </div>
                    <div className="bqm-step-info-professional">
                        <span>Step 2 of 4</span>
                        <span>Service & Scope</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderPaymentStep = () => {
        const mealServicesTotal = calculateMealServicesTotal();
        const adjustmentTotal = calculateBillingAdjustmentsTotal();
        const grandTotal = Math.max(0, mealServicesTotal + adjustmentTotal - safeNumber(billingAdjustments.discount));

        return (
            <div className="bqm-step-professional">
                <div className="bqm-step-header-professional bqm-step-header-success">
                    <div className="bqm-step-icon-professional bqm-step-icon-success">
                        <WalletOutlined />
                    </div>
                    <div>
                        <h3 className="bqm-step-title-professional">Payment & Additional Charges</h3>
                        <p className="bqm-step-desc-professional">Review and configure payment details</p>
                    </div>
                </div>

                <div className="bqm-step-body-professional">
                    <div className="bqm-form-section-professional">
                        <div className="bqm-section-label-professional">
                            Additional Charges
                        </div>
                        <Row gutter={[16, 12]}>
                            {[
                                ['transportation_fee', 'Transportation Fee'],
                                ['setup_fee', 'Setup Fee'],
                                ['service_crew_fee', 'Service Crew Fee'],
                                ['equipment_rental', 'Equipment Rental'],
                                ['extra_food_fee', 'Extra Food Request'],
                                ['discount', 'Discount'],
                                ['down_payment', 'Down Payment']
                            ].map(([key, label]) => (
                                <Col span={6} key={key}>
                                    <div className="bqm-additional-field">
                                        <span className="bqm-additional-label">{label}</span>
                                        <InputNumber
                                            min={0}
                                            value={billingAdjustments[key]}
                                            formatter={value => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value?.replace(/₱\s?|(,*)/g, '')}
                                            onChange={(value) => setBillingAdjustments(prev => ({ ...prev, [key]: value || 0 }))}
                                            size="middle"
                                            style={{ width: '100%' }}
                                            className={key === 'discount' ? 'bqm-discount-input' : ''}
                                        />
                                    </div>
                                </Col>
                            ))}
                        </Row>
                    </div>

                    <div className="bqm-summary-cards-professional">
                        <Row gutter={16}>
                            <Col span={8}>
                                <Card className="bqm-summary-card-professional">
                                    <Statistic
                                        title="Meal Services"
                                        value={mealServicesTotal}
                                        prefix="₱"
                                        precision={2}
                                        valueStyle={{ color: '#3b82f6' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="bqm-summary-card-professional">
                                    <Statistic
                                        title="Additional Charges"
                                        value={adjustmentTotal}
                                        prefix="₱"
                                        precision={2}
                                        valueStyle={{ color: '#f59e0b' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="bqm-summary-card-professional bqm-summary-card-total">
                                    <Statistic
                                        title="Grand Total"
                                        value={grandTotal}
                                        prefix="₱"
                                        precision={2}
                                        valueStyle={{ color: '#10b981', fontWeight: 700 }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                        <Alert
                            type="info"
                            showIcon
                            message={`Balance after down payment: ${formatCurrency(Math.max(0, grandTotal - safeNumber(billingAdjustments.down_payment)))}`}
                            className="bqm-balance-alert"
                        />
                    </div>
                </div>

                <div className="bqm-step-footer-professional">
                    <div className="bqm-step-progress-professional">
                        <Progress percent={75} showInfo={false} size="small" strokeColor="#f59e0b" />
                    </div>
                    <div className="bqm-step-info-professional">
                        <span>Step 3 of 4</span>
                        <span>Payment Details</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderReviewStep = () => {
        const currentValues = quotationForm.getFieldsValue();
        const allValues = { ...formValues, ...currentValues };

        const safeReviewValue = (key, defaultValue = 'N/A') => {
            const val = allValues[key];
            if (val === undefined || val === null) return defaultValue;
            if (typeof val === 'string') return val;
            if (typeof val === 'number') return String(val);
            if (typeof val === 'object') return defaultValue;
            return String(val);
        };

        const safeNumberReview = (key, defaultValue = 0) => {
            const val = allValues[key];
            if (val === undefined || val === null) return defaultValue;
            const num = Number(val);
            return isNaN(num) ? defaultValue : num;
        };

        const formatDateReview = (dateValue) => {
            if (!dateValue) return 'N/A';
            try {
                if (typeof dateValue === 'string') {
                    const parsed = dayjs(dateValue);
                    return parsed.isValid() ? parsed.format('MMM DD, YYYY') : 'Invalid Date';
                }
                if (dayjs.isDayjs(dateValue)) {
                    return dateValue.format('MMM DD, YYYY');
                }
                return 'N/A';
            } catch (e) {
                return 'Invalid Date';
            }
        };

        const eventDate = allValues.event_date ? formatDateReview(allValues.event_date) : 'N/A';
        const endDate = eventScope === 'multi_day' && allValues.event_date
            ? formatDateReview(dayjs(allValues.event_date).add(multiDayDays - 1, 'days'))
            : eventDate;

        const mealServicesTotal = calculateMealServicesTotal();
        const subtotal = mealServicesTotal > 0 ? mealServicesTotal : selectedMenuItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
        let discount = 0;
        if (selectedPromo) {
            discount = selectedPromo.discount_type === 'percentage'
                ? subtotal * (selectedPromo.discount_value / 100)
                : selectedPromo.discount_value;
        }
        const adjustmentTotal = calculateBillingAdjustmentsTotal();
        const total = Math.max(0, subtotal + adjustmentTotal - safeNumber(billingAdjustments.discount) - discount);

        return (
            <div className="bqm-step-professional">
                <div className="bqm-step-header-professional bqm-step-header-success">
                    <div className="bqm-step-icon-professional bqm-step-icon-success">
                        <CheckCircleOutlined />
                    </div>
                    <div>
                        <h3 className="bqm-step-title-professional">Review & Confirm</h3>
                        <p className="bqm-step-desc-professional">Review all details before creating the booking</p>
                    </div>
                </div>

                <div className="bqm-step-body-professional">
                    <div className="bqm-review-grid-professional">
                        <div className="bqm-review-card-professional">
                            <div className="bqm-review-card-header">
                                <UserOutlined /> Customer
                            </div>
                            <div className="bqm-review-card-body">
                                <div className="bqm-review-item">
                                    <span>Name</span>
                                    <span className="bqm-review-value">{safeReviewValue('customer_name', 'Not provided')}</span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Email</span>
                                    <span className="bqm-review-value">{safeReviewValue('customer_email', 'Not provided')}</span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Phone</span>
                                    <span className="bqm-review-value">{safeReviewValue('customer_phone', 'N/A')}</span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Venue</span>
                                    <span className="bqm-review-value">{safeReviewValue('venue', 'Not provided')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bqm-review-card-professional">
                            <div className="bqm-review-card-header">
                                <CalendarOutlined /> Event
                            </div>
                            <div className="bqm-review-card-body">
                                <div className="bqm-review-item">
                                    <span>Type</span>
                                    <span className="bqm-review-value"><Tag color="blue">{getEventTypeName(allValues.event_type_id)}</Tag></span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Date</span>
                                    <span className="bqm-review-value">{eventDate}{eventScope === 'multi_day' && ` → ${endDate}`}</span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Time</span>
                                    <span className="bqm-review-value">{safeReviewValue('event_time', 'Not provided')}</span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Guests</span>
                                    <span className="bqm-review-value"><TeamOutlined /> {safeNumberReview('guests_count', 0)} PAX</span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Scope</span>
                                    <span className="bqm-review-value">
                                        <Tag color={eventScope === 'multi_day' ? 'purple' : 'green'}>
                                            {eventScope === 'multi_day' ? `Multi-Day (${multiDayDays} days)` : 'Regular'}
                                        </Tag>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bqm-review-card-professional">
                            <div className="bqm-review-card-header">
                                <ScheduleOutlined /> Service
                            </div>
                            <div className="bqm-review-card-body">
                                <div className="bqm-review-item">
                                    <span>Type</span>
                                    <span className="bqm-review-value"><Tag color="cyan">{serviceTypeOptions.find(s => s.value === serviceType)?.label || serviceType}</Tag></span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Delivery</span>
                                    <span className="bqm-review-value"><Tag color="geekblue">{allValues.delivery_method === 'delivery' ? 'Delivery' : 'Pickup'}</Tag></span>
                                </div>
                                <div className="bqm-review-item">
                                    <span>Menu Type</span>
                                    <span className="bqm-review-value">
                                        <Tag color={menuSelectionType === 'package' ? 'purple' : 'orange'}>
                                            {menuSelectionType === 'customize' ? 'Custom' : 'Package'}
                                        </Tag>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bqm-review-card-professional bqm-review-full-width">
                            <div className="bqm-review-card-header">
                                <ForkOutlined /> Meal Services
                                <span className="bqm-review-badge">{mealServices.length}</span>
                            </div>
                            <div className="bqm-review-card-body">
                                <Table
                                    size="small"
                                    pagination={false}
                                    rowKey="id"
                                    dataSource={sortedMealServices.slice(0, 4)}
                                    className="bqm-review-table"
                                    columns={[
                                        { title: 'Day', dataIndex: 'day_number', width: 60, render: (v) => `Day ${v}` },
                                        { title: 'Meal', dataIndex: 'meal_type', width: 90 },
                                        { title: 'Time', dataIndex: 'serving_time', width: 90 },
                                        { title: 'Pax', dataIndex: 'pax', width: 60 },
                                        { title: 'Items', width: 100, render: (_, r) => r.custom_items?.length || 0 },
                                        { title: 'Total', width: 100, render: (_, r) => formatCurrency(safeNumber(r.pax) * safeNumber(r.price_per_head)) }
                                    ]}
                                />
                                {mealServices.length > 4 && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>+{mealServices.length - 4} more meals</Text>
                                )}
                            </div>
                        </div>

                        <div className="bqm-review-card-professional bqm-review-full-width">
                            <div className="bqm-review-card-header">
                                <DollarOutlined /> Financial Summary
                            </div>
                            <div className="bqm-review-card-body">
                                <div className="bqm-review-total-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                {selectedPromo && (
                                    <div className="bqm-review-total-row bqm-review-discount">
                                        <span>Promo ({selectedPromo.code})</span>
                                        <span>-{formatCurrency(discount)}</span>
                                    </div>
                                )}
                                {adjustmentTotal > 0 && (
                                    <div className="bqm-review-total-row">
                                        <span>Additional Charges</span>
                                        <span>{formatCurrency(adjustmentTotal)}</span>
                                    </div>
                                )}
                                {safeNumber(billingAdjustments.discount) > 0 && (
                                    <div className="bqm-review-total-row bqm-review-discount">
                                        <span>Manual Discount</span>
                                        <span>-{formatCurrency(billingAdjustments.discount)}</span>
                                    </div>
                                )}
                                <div className="bqm-review-divider" />
                                <div className="bqm-review-total-row bqm-review-grand-total">
                                    <span><strong>Total</strong></span>
                                    <span><strong>{formatCurrency(total)}</strong></span>
                                </div>
                                {safeNumber(billingAdjustments.down_payment) > 0 && (
                                    <div className="bqm-review-total-row">
                                        <span>Balance</span>
                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(Math.max(0, total - safeNumber(billingAdjustments.down_payment)))}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {allValues.special_requests && typeof allValues.special_requests === 'string' && allValues.special_requests.trim() && (
                            <div className="bqm-review-card-professional bqm-review-full-width">
                                <div className="bqm-review-card-header">
                                    <MessageOutlined /> Special Requests
                                </div>
                                <div className="bqm-review-card-body">
                                    <div className="bqm-review-requests">{String(allValues.special_requests)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bqm-step-footer-professional">
                    <div className="bqm-step-progress-professional">
                        <Progress percent={100} showInfo={false} size="small" strokeColor="#10b981" />
                    </div>
                    <div className="bqm-step-info-professional">
                        <span>Step 4 of 4</span>
                        <span>Review & Confirm</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderAddMealModal = () => (
               <Modal
            title="Add Meal"
            open={addMealModalVisible}
            onCancel={() => {
                setAddMealModalVisible(false);
                setPendingMealDay(null);
                setPendingMealType(null);
            }}
            maskClosable={false}
            keyboard={false}
            rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
            destroyOnHidden={true}
            okText="Add Meal"
            onOk={addMealService}
        >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {eventScope === 'multi_day' && (
                    <div>
                        <Text strong>Event Day</Text>
                        <Select
                            value={pendingMealDay}
                            onChange={(value) => {
                                setPendingMealDay(value);
                                setPendingMealType(null);
                            }}
                            placeholder="Select a day"
                            style={{ width: '100%', marginTop: 8 }}
                        >
                            {Array.from({ length: multiDayDays }, (_, index) => index + 1).map(day => (
                                <Option key={day} value={day}>Day {day}</Option>
                            ))}
                        </Select>
                    </div>
                )}
                {(eventScope === 'regular' || pendingMealDay) && (
                    <div>
                        <Text strong>Meal Type</Text>
                        <Select
                            value={pendingMealType}
                            onChange={setPendingMealType}
                            placeholder="Select a meal type"
                            style={{ width: '100%', marginTop: 8 }}
                        >
                            {MEAL_SEQUENCE.map(type => {
                                const dayNumber = eventScope === 'regular' ? 1 : pendingMealDay;
                                const isAlreadyAdded = mealServices.some(meal =>
                                    safeNumber(meal.day_number, 1) === safeNumber(dayNumber, 1) &&
                                    normalizeMealLabel(meal.meal_type) === normalizeMealLabel(type)
                                );
                                return (
                                    <Option key={type} value={type} disabled={isAlreadyAdded}>
                                        {type}{isAlreadyAdded ? ' (Already added)' : ''}
                                    </Option>
                                );
                            })}
                        </Select>
                    </div>
                )}
            </Space>
        </Modal>
    );

    const renderMenuSelectionModal = () => {
        const meal = mealServices.find(m => m.id === selectedMealId);
        const selectedIds = modalSelectedIds;

        const categories = [...new Set(menuItemsList
            .map(item => {
                if (typeof item.category === 'string') return item.category;
                if (item.category && typeof item.category === 'object') {
                    return item.category.name || item.category.category_name || null;
                }
                return null;
            })
            .filter(Boolean)
        )];

        const filteredItems = menuItemsList.filter(item => {
            const itemCategory = typeof item.category === 'string'
                ? item.category
                : item.category?.name || item.category?.category_name || '';
            const matchesSearch = item.name?.toLowerCase().includes(menuSearchTerm.toLowerCase());
            const matchesCategory = menuCategoryFilter === 'all' || itemCategory === menuCategoryFilter;
            const matchesSelectedMeal = !meal?.meal_type || menuItemMatchesMealType(item, meal.meal_type);
            return matchesSearch && matchesCategory && matchesSelectedMeal;
        });

        const filteredPackages = packagesList.filter(pkg => {
            const name = pkg.name || '';
            return name.toLowerCase().includes(menuSearchTerm.toLowerCase());
        });

        const filteredPromos = promosList.filter(promo => {
            const name = promo.name || '';
            const code = promo.code || '';
            return name.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
                code.toLowerCase().includes(menuSearchTerm.toLowerCase());
        });

        const hasAnyTrayItems = filteredItems.some(item => item.pricing_type === 'tray' || item.pricing_type === 'both');

        return (
            <Modal
                title={
                    <div className="bqm-menu-modal-header">
                        <div className="bqm-menu-modal-title">
                            <MenuOutlined /> Select Menu Items
                        </div>
                        <div className="bqm-menu-modal-subtitle">
                            {meal && `Day ${meal.day_number} - ${meal.meal_type}`}
                        </div>
                    </div>
                }
                open={menuSelectionModalVisible}
                onCancel={handleCancelMenuSelection}
                maskClosable={false}
                keyboard={false}
                               width={950}
                className="bqm-menu-modal"
                rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                destroyOnHidden={true}
                footer={
                    <div className="bqm-menu-modal-footer">
                        <div className="bqm-menu-modal-selected-count">
                            {selectedIds.length} items selected
                            {modalPricingType === 'tray' && (
                                <Tag color="orange" style={{ marginLeft: 8 }}>Tray Pricing Mode</Tag>
                            )}
                            {modalPricingType === 'per_pax' && (
                                <Tag color="blue" style={{ marginLeft: 8 }}>Per Pax Pricing Mode</Tag>
                            )}
                        </div>
                        <Space>
                            <Button onClick={handleCancelMenuSelection}>
                                Cancel (Clear All)
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSelectMenuItems}
                                icon={<CheckCircleOutlined />}
                            >
                                Confirm Selection
                            </Button>
                        </Space>
                    </div>
                }
            >
                <div className="bqm-menu-modal-body">
                    <div className="bqm-menu-toolbar">
                        <Input
                            placeholder="Search menu items, packages, or promos..."
                            prefix={<SearchOutlined />}
                            value={menuSearchTerm}
                            onChange={(e) => setMenuSearchTerm(e.target.value)}
                            size="middle"
                            className="bqm-menu-search"
                            allowClear
                        />
                        <Select
                            value={menuCategoryFilter}
                            onChange={setMenuCategoryFilter}
                            size="middle"
                            className="bqm-menu-category-filter"
                            placeholder="Filter by category"
                        >
                            <Option value="all">All Categories</Option>
                            {categories.map(cat => (
                                <Option key={cat} value={cat}>{cat}</Option>
                            ))}
                        </Select>
                        <Radio.Group
                            value={menuViewMode}
                            onChange={(e) => setMenuViewMode(e.target.value)}
                            buttonStyle="solid"
                            size="middle"
                        >
                            <Radio.Button value="grid">
                                <AppstoreOutlined /> Grid
                            </Radio.Button>
                            <Radio.Button value="list">
                                <MenuOutlined /> List
                            </Radio.Button>
                        </Radio.Group>
                    </div>

                    <div className="bqm-pricing-global-toggle" style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        marginBottom: 12,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <Text strong>Pricing Type:</Text>
                            <Text style={{ marginLeft: 8, color: '#6b7280' }}>
                                {modalPricingType === 'tray' ? 'Tray Pricing' : 'Per Pax Pricing'}
                            </Text>
                            {modalPricingType === 'tray' && (
                                <Tag color="orange" style={{ marginLeft: 8 }}>All items will use tray prices</Tag>
                            )}
                            {modalPricingType === 'per_pax' && (
                                <Tag color="blue" style={{ marginLeft: 8 }}>All items will use per pax prices</Tag>
                            )}
                        </div>
                        <Radio.Group
                            value={modalPricingType}
                            onChange={(e) => toggleGlobalPricingType(e.target.value)}
                            buttonStyle="solid"
                            size="middle"
                        >
                            <Radio.Button value="per_pax">
                                <UserOutlined /> Per Pax
                            </Radio.Button>
                            <Radio.Button value="tray">
                                <AppstoreOutlined /> Tray
                            </Radio.Button>
                        </Radio.Group>
                    </div>

                    <Tabs
                        activeKey={menuSelectionMode}
                        onChange={(key) => setMenuSelectionMode(key)}
                        className="bqm-menu-selection-tabs"
                        items={[
                            {
                                key: 'menu_items',
                                label: <span><ForkOutlined /> Menu Items</span>,
                                children: (
                                    <div className="bqm-menu-items-container">
                                        {filteredItems.length === 0 ? (
                                            <Empty description="No menu items found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                        ) : menuViewMode === 'grid' ? (
                                            <div className="bqm-menu-grid">
                                                {filteredItems.map(item => {
                                                    const isSelected = selectedIds.includes(String(item.menu_item_id || item.id));
                                                    const itemCategory = typeof item.category === 'string'
                                                        ? item.category
                                                        : item.category?.name || item.category?.category_name || '';
                                                    const isTray = item.pricing_type === 'tray' || item.pricing_type === 'both';
                                                    const effectivePricingType = modalPricingType;
                                                    const isEffectiveTray = effectivePricingType === 'tray' && isTray;
                                                    const displayPrice = isEffectiveTray
                                                        ? safeNumber(item.tray_price, 0)
                                                        : safeNumber(item.price, 0);
                                                    const trayDesc = isEffectiveTray && item.tray_description
                                                        ? item.tray_description
                                                        : `Good for ${safeNumber(item.tray_min_pax, 20)}–${safeNumber(item.tray_max_pax, 25)} pax`;

                                                    return (
                                                        <div
                                                            key={item.menu_item_id || item.id}
                                                            className={`bqm-menu-grid-item ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setModalSelectedIds(prev => prev.filter(id => id !== String(item.menu_item_id || item.id)));
                                                                } else {
                                                                    setModalSelectedIds(prev => [...prev, String(item.menu_item_id || item.id)]);
                                                                }
                                                            }}
                                                        >
                                                            <div className="bqm-menu-item-check">
                                                                {isSelected ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <PlusOutlined />}
                                                            </div>
                                                            <div className="bqm-menu-item-image">
                                                                {item.image_url ? (
                                                                    <img src={item.image_url} alt={item.name} />
                                                                ) : (
                                                                    <div className="bqm-menu-item-placeholder">
                                                                        <ForkOutlined />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="bqm-menu-item-info">
                                                                <div className="bqm-menu-item-name">{item.name}</div>
                                                                <div className="bqm-menu-item-category">{itemCategory}</div>
                                                                <div className="bqm-menu-item-price">
                                                                    {isTray && (
                                                                        <div className="bqm-menu-item-pricing-toggle">
                                                                            <Tag color={isEffectiveTray ? 'orange' : 'blue'}>
                                                                                {isEffectiveTray ? 'Tray' : 'Per Pax'}
                                                                            </Tag>
                                                                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                                                {formatCurrency(displayPrice)} / {isEffectiveTray ? 'tray' : 'pax'}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {!isTray && (
                                                                        <div className="bqm-menu-item-pricing-toggle">
                                                                            <Tag color="blue">Per Pax</Tag>
                                                                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                                                {formatCurrency(item.price)} / pax
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isEffectiveTray && item.tray_description && (
                                                                    <div className="bqm-menu-item-tray-desc" style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                                                        {trayDesc}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <List
                                                className="bqm-menu-list"
                                                dataSource={filteredItems}
                                                renderItem={item => {
                                                    const isSelected = selectedIds.includes(String(item.menu_item_id || item.id));
                                                    const itemCategory = typeof item.category === 'string'
                                                        ? item.category
                                                        : item.category?.name || item.category?.category_name || '';
                                                    const isTray = item.pricing_type === 'tray' || item.pricing_type === 'both';
                                                    const effectivePricingType = modalPricingType;
                                                    const isEffectiveTray = effectivePricingType === 'tray' && isTray;
                                                    const displayPrice = isEffectiveTray
                                                        ? safeNumber(item.tray_price, 0)
                                                        : safeNumber(item.price, 0);
                                                    const trayDesc = isEffectiveTray && item.tray_description
                                                        ? item.tray_description
                                                        : `Good for ${safeNumber(item.tray_min_pax, 20)}–${safeNumber(item.tray_max_pax, 25)} pax`;

                                                    return (
                                                        <List.Item
                                                            className={`bqm-menu-list-item ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setModalSelectedIds(prev => prev.filter(id => id !== String(item.menu_item_id || item.id)));
                                                                } else {
                                                                    setModalSelectedIds(prev => [...prev, String(item.menu_item_id || item.id)]);
                                                                }
                                                            }}
                                                        >
                                                            <div className="bqm-menu-list-item-content">
                                                                <div className="bqm-menu-list-item-check">
                                                                    {isSelected ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <PlusOutlined />}
                                                                </div>
                                                                <div className="bqm-menu-list-item-info">
                                                                    <div className="bqm-menu-list-item-name">{item.name}</div>
                                                                    <div className="bqm-menu-list-item-meta">
                                                                        <Tag>{itemCategory}</Tag>
                                                                        {isTray && (
                                                                            <Tag color={isEffectiveTray ? 'orange' : 'blue'}>
                                                                                {isEffectiveTray ? 'Tray' : 'Per Pax'}
                                                                            </Tag>
                                                                        )}
                                                                        {!isTray && (
                                                                            <Tag color="blue">Per Pax</Tag>
                                                                        )}
                                                                        <span className="bqm-menu-list-item-price">
                                                                            {formatCurrency(displayPrice)} / {isEffectiveTray ? 'tray' : 'pax'}
                                                                        </span>
                                                                    </div>
                                                                    {isEffectiveTray && trayDesc && (
                                                                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                                                            {trayDesc}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </List.Item>
                                                    );
                                                }}
                                            />
                                        )}
                                    </div>
                                )
                            },
                            {
                                key: 'packages',
                                label: <span><AppstoreOutlined /> Packages</span>,
                                children: (
                                    <div className="bqm-menu-items-container">
                                        {filteredPackages.length === 0 ? (
                                            <Empty description="No packages found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                        ) : (
                                            <div className="bqm-menu-grid">
                                                {filteredPackages.map(pkg => {
                                                    const pkgId = pkg.package_id || pkg.id;
                                                    const isSelected = String(meal?.package_id) === String(pkgId);
                                                    return (
                                                        <div
                                                            key={pkgId}
                                                            className={`bqm-menu-grid-item ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => handleSelectPackage(pkgId)}
                                                        >
                                                            <div className="bqm-menu-item-check">
                                                                {isSelected ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <PlusOutlined />}
                                                            </div>
                                                            <div className="bqm-menu-item-image">
                                                                {pkg.image_url ? (
                                                                    <img src={pkg.image_url} alt={pkg.name} />
                                                                ) : (
                                                                    <div className="bqm-menu-item-placeholder">
                                                                        <AppstoreOutlined />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="bqm-menu-item-info">
                                                                <div className="bqm-menu-item-name">{pkg.name}</div>
                                                                <div className="bqm-menu-item-category">
                                                                    {pkg.menu_items?.length || pkg.items?.length || 0} items
                                                                </div>
                                                                <div className="bqm-menu-item-price">{formatCurrency(pkg.base_price_per_pax)} / pax</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            },
                            {
                                key: 'promos',
                                label: <span><TagOutlined /> Promotions</span>,
                                children: (
                                    <div className="bqm-menu-items-container">
                                        {filteredPromos.length === 0 ? (
                                            <Empty description="No promotions available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                        ) : (
                                            <div className="bqm-menu-grid">
                                                {filteredPromos.map(promo => {
                                                    const promoId = promo.promotion_id || promo.id;
                                                    const isSelected = String(selectedPromo?.promotion_id || selectedPromo?.id) === String(promoId);
                                                    return (
                                                        <div
                                                            key={promoId}
                                                            className={`bqm-menu-grid-item ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => handleSelectPromo(promoId)}
                                                        >
                                                            <div className="bqm-menu-item-check">
                                                                {isSelected ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <PlusOutlined />}
                                                            </div>
                                                            <div className="bqm-menu-item-info" style={{ padding: '12px 0' }}>
                                                                <div className="bqm-menu-item-name">{promo.name}</div>
                                                                <div className="bqm-menu-item-category">
                                                                    <Tag color="green">{promo.code}</Tag>
                                                                </div>
                                                                <div className="bqm-menu-item-price" style={{ fontSize: '13px' }}>
                                                                    {promo.discount_type === 'percentage'
                                                                        ? `${promo.discount_value}% OFF`
                                                                        : `₱${promo.discount_value} OFF`}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: 'var(--bqm-muted)', marginTop: '4px' }}>
                                                                    {promo.start_date && promo.end_date && (
                                                                        `${formatDateSafe(promo.start_date)} - ${formatDateSafe(promo.end_date)}`
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
            </Modal>
        );
    };

    const handleCalendarDayClick = (dateValue) => {
        const date = dayjs(dateValue);
        if (date.isBefore(dayjs().startOf('day'))) {
            message.warning('Cannot edit availability for past dates');
            return;
        }
        const existing = getCalendarAvailability(date);
        setSelectedCalendarDate(date);
        let status = 'available';
        let operationMode = 'normal';
        let maxBookings = null;
        let notes = '';
        if (existing) {
            status = existing.status || 'available';
            maxBookings = existing.max_bookings || null;
            operationMode = existing.operation_mode || (maxBookings ? 'limited_slot' : 'normal');
            notes = existing.notes || '';
        }
        availabilityForm.setFieldsValue({
            operation_mode: operationMode,
            status: status,
            max_bookings: maxBookings,
            notes: notes
        });
        setAvailabilityModalVisible(true);
    };

    const saveCalendarAvailability = (values) => {
        const date = selectedCalendarDate.format('YYYY-MM-DD');
        const status = safeString(values.status, 'available');
        const operationMode = safeString(values.operation_mode, 'normal');
        const maxBookings = operationMode === 'limited_slot' && values.max_bookings ? safeNumber(values.max_bookings) : null;
        const payload = {
            status: status,
            operation_mode: operationMode,
            max_bookings: maxBookings,
            notes: safeString(values.notes)
        };
        saveCalendarAvailabilityMutation.mutate({
            date: date,
            data: payload
        }, {
            onSuccess: () => {
                message.success(`Availability for ${date} updated to ${status}`);
                setAvailabilityModalVisible(false);
                availabilityForm.resetFields();
                refetchCalendarAvailability();
                refetchCalendarEvents();
            },
            onError: (error) => {
                console.error('Save availability error:', error);
                message.error(error?.response?.data?.message || 'Failed to update availability');
            }
        });
    };

    const resetCalendarAvailability = () => {
        const date = selectedCalendarDate.format('YYYY-MM-DD');
        modal.confirm({
            title: 'Reset Date Availability',
            content: `Reset ${date} to the default available state? This will remove any custom settings.`,
            okText: 'Reset',
            maskClosable: false,
            keyboard: false,
            onOk: () => {
                deleteCalendarAvailabilityMutation.mutate(date, {
                    onSuccess: () => {
                        message.success(`${date} reset to available`);
                        setAvailabilityModalVisible(false);
                        refetchCalendarAvailability();
                    },
                    onError: (error) => {
                        message.error(error?.response?.data?.message || 'Failed to reset availability');
                    }
                });
            }
        });
    };

    const approvedCalendarEvents = useMemo(() => {
        return events.filter((event) => {
            return ['confirmed', 'rescheduled'].includes(safeString(event.status));
        });
    }, [events]);

    const dateCellRender = (dateValue) => {
        const date = dateValue.format('YYYY-MM-DD');
        const dayEvents = approvedCalendarEvents.filter((event) => {
            return safeString(event.start).split('T')[0] === date;
        });
        const availability = getCalendarAvailability(dateValue);
        const isPast = dayjs(date).isBefore(dayjs().startOf('day'));

        const hasCustomSetting = availability !== undefined && availability !== null;
        const shouldShowBadge = hasCustomSetting && availability.status !== 'available';
        const hasLimitedSlots = hasCustomSetting &&
                               availability.status === 'available' &&
                               (availability.operation_mode === 'limited_slot' || availability.max_bookings !== null) &&
                               availability.max_bookings !== null &&
                               availability.max_bookings !== undefined;

        return (
            <div
                className="bqm-calendar-date-cell"
                onClick={(e) => {
                    e.stopPropagation();
                    if (isPast) {
                        message.warning('Cannot edit availability for past dates');
                        return;
                    }
                    handleCalendarDayClick(dateValue);
                }}
                style={{
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    opacity: isPast ? 0.7 : 1
                }}
            >
                {(shouldShowBadge || hasLimitedSlots) && (
                    <div
                        className="bqm-calendar-availability-badge"
                        style={{
                            backgroundColor: shouldShowBadge
                                ? getAvailabilityConfig(availability.status).background
                                : '#f0fdf4',
                            color: shouldShowBadge
                                ? getAvailabilityConfig(availability.status).color
                                : '#10b981',
                            borderLeft: `3px solid ${shouldShowBadge
                                ? getAvailabilityConfig(availability.status).color
                                : '#10b981'}`
                        }}
                    >
                        {shouldShowBadge ? getAvailabilityConfig(availability.status).icon : <UnlockOutlined />}
                        <span>
                            {shouldShowBadge
                                ? getAvailabilityConfig(availability.status).text
                                : `Limited: ${availability.max_bookings} slots`}
                        </span>
                    </div>
                )}

                <div className="bqm-calendar-events-wrapper">
                    {dayEvents.slice(0, 2).map((event) => (
                        <Tooltip key={event.id} title="Click to view booking details">
                            <button
                                type="button"
                                className="bqm-calendar-event-item"
                                onClick={(clickEvent) => {
                                    clickEvent.stopPropagation();
                                    openCalendarBookingDetails(event);
                                }}
                            >
                                <span className="bqm-calendar-event-time">
                                    {safeString(event.extendedProps?.event_time, 'Time TBD')}
                                </span>
                                <span className="bqm-calendar-event-name">
                                    {safeString(event.title).split(' - ')[0]}
                                </span>
                            </button>
                        </Tooltip>
                    ))}
                    {dayEvents.length > 2 && (
                        <div className="bqm-calendar-event-more">
                            +{dayEvents.length - 2} more
                        </div>
                    )}
                </div>

                {!isPast && (
                    <div className="bqm-calendar-date-hint">
                        <EditOutlined style={{ fontSize: 8, opacity: 0.5 }} />
                    </div>
                )}
            </div>
        );
    };

    const openCalendarBookingDetails = async (event) => {
        if (!event || !event.id) {
            message.warning('Invalid event data');
            return;
        }
        try {
            const response = await api.get(`/bookings/${event.id}`);
            const booking = response?.data?.data || response?.data || null;
            if (!booking) {
                message.warning('Booking details could not be loaded');
                return;
            }
            openBookingDetails(booking);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to load booking details');
        }
    };

     const openEditBooking = async (booking) => {
        if (!booking) {
            message.error('No booking selected for editing');
            return;
        }
        const bookingId = getBookingId(booking);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        try {
            const response = await api.get(`/bookings/${bookingId}`);
            const details = response?.data?.data || response?.data || booking;
            if (!details) {
                message.error('Failed to load booking details');
                return;
            }
            setEditingBooking(details);
            setSelectedBooking(details);
            setCreateBookingStep(0);
            const loadedServiceType = details.service_type || 'buffet';
            setServiceType(loadedServiceType);
            setEventScope(details.is_multi_day || details.booking_scope === 'multi_day' ? 'multi_day' : 'regular');
            guestCountRef.current = safeNumber(details.guests_count, 10);
            setMultiDayDays(safeNumber(details.days, 1) > 1 ? safeNumber(details.days, 1) : 2);

            const addressParts = splitAddressParts(details);
            quotationForm.setFieldsValue({
                customer_name: details.customer_name,
                customer_email: details.customer_email,
                customer_phone: details.customer_phone,
                venue: details.venue,
                event_type_id: details.event_type_id,
                guests_count: details.guests_count,
                event_date: details.event_date ? dayjs(details.event_date) : null,
                event_time: details.event_time,
                delivery_method: loadedServiceType === 'buffet' ? 'delivery' : (details.delivery_method || 'pickup'),
                special_requests: details.special_requests,
                address_line_1: addressParts.address_line_1,
                city: addressParts.city,
                province: addressParts.province,
                postal_code: addressParts.postal_code,
            });
            setBillingAdjustments({
                transportation_fee: safeNumber(details.billing_summary?.charges?.find?.(c => c.charge_type === 'transportation_fee')?.amount),
                setup_fee: safeNumber(details.billing_summary?.charges?.find?.(c => c.charge_type === 'setup_fee')?.amount),
                service_crew_fee: safeNumber(details.billing_summary?.charges?.find?.(c => c.charge_type === 'service_crew_fee')?.amount),
                equipment_rental: safeNumber(details.billing_summary?.charges?.find?.(c => c.charge_type === 'equipment_rental')?.amount),
                extra_food_fee: safeNumber(details.billing_summary?.charges?.find?.(c => c.charge_type === 'extra_food_fee')?.amount),
                discount: safeNumber(details.billing_summary?.discount),
                down_payment: 0
            });
            const loadedMeals = safeArray(details.meal_services).map(meal => createDefaultMealService({
                ...meal,
                id: `meal-edit-${meal.meal_service_id || Math.random()}`,
                service_date: meal.service_date ? dayjs(meal.service_date) : null,
                menu_source: meal.menu_source || (meal.package_id ? 'package' : 'custom'),
                filters: safeArray(meal.filters).map(f => f.filter_key || f),
                pricing_type: meal.pricing_type || 'per_pax',
                tray_price: safeNumber(meal.tray_price, 0),
                tray_servings: safeNumber(meal.tray_servings, 25),
                tray_min_pax: safeNumber(meal.tray_min_pax, 20),
                tray_max_pax: safeNumber(meal.tray_max_pax, 25),
                tray_description: meal.tray_description || `Good for ${safeNumber(meal.tray_min_pax, 20)}–${safeNumber(meal.tray_max_pax, 25)} pax`,
                tray_quantity: safeNumber(meal.tray_quantity, 1),
                custom_items: safeArray(meal.custom_items).map(item => ({
                    menu_item_id: item.menu_item_id,
                    item_name: item.item_name || item.name,
                    description: item.description,
                    quantity: safeNumber(item.quantity, 1),
                    unit_price: safeNumber(item.unit_price),
                    notes: item.notes || '',
                    pricing_type: item.pricing_type || meal.pricing_type || 'per_pax',
                    tray_price: safeNumber(item.tray_price || meal.tray_price, 0),
                    tray_servings: safeNumber(item.tray_servings || meal.tray_servings, 25),
                    tray_min_pax: safeNumber(item.tray_min_pax || meal.tray_min_pax, 20),
                    tray_max_pax: safeNumber(item.tray_max_pax || meal.tray_max_pax, 25),
                    tray_quantity: safeNumber(item.tray_quantity || meal.tray_quantity, 1)
                }))
            }));
            setMealServices(sortMealServicesChronologically(loadedMeals.length ? loadedMeals.map(meal => {
                const customItems = safeArray(meal.custom_items);
                const customPrice = customItems.length ? calculateCustomItemsPrice(customItems) : safeNumber(meal.price_per_head);
                return customItems.length ? { ...meal, menu_source: 'custom', price_per_head: customPrice, total_meal_amount: meal.pricing_type === 'tray'
                    ? safeNumber(meal.tray_price) * safeNumber(meal.tray_quantity, 1)
                    : safeNumber(meal.pax) * customPrice } : meal;
            }) : []));
            setQuotationModalVisible(true);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to load booking for editing');
        }
    };

      const handleTodayBookingApprove = async () => {
        if (!todayBookingData) return;
        const bookingId = getBookingId(todayBookingData);
        if (!bookingId) {
            message.error('Invalid booking ID');
            return;
        }
        const bookingNo = safeString(todayBookingData.booking_no);

              let cancelled = false;

        try {
            const signal = showLoadingLine('approve', bookingNo);

            await new Promise((resolve) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    cancelled = true;
                    resolve();
                });
            });

            if (cancelled) return;

            await confirmBookingMutation.mutateAsync(bookingId);

            message.success({
                content: `Booking ${bookingNo} confirmed successfully!`,
                duration: 4,
            });

            setTodayBookingModalVisible(false);
            setTodayBookingData(null);
            setTodayBookingAction(null);
            await refreshAllData();
        } catch (error) {
            if (
                error?.name === 'CanceledError' ||
                error?.name === 'AbortError' ||
                error?.code === 'ERR_CANCELED'
            ) {
                return;
            }
            console.error('Approval error:', error);
            const errorMsg = error?.response?.data?.message || error?.message || 'Failed to approve booking';
            message.error(errorMsg);
        } finally {
            hideLoadingLine();
        }
    };
    const handleTodayBookingReject = () => {
        if (!todayBookingData) return;
        setTodayBookingModalVisible(false);
        openRejectModal(todayBookingData);
    };

    // ============================================================
    // ⭐ BOOKING ACTIONS — WITH CUSTOMER RESCHEDULE RESPONSE
    // ============================================================
        // ============================================================
    // ⭐ CANCELABLE LOADING LINE (3s auto-dismiss)
    // ============================================================
      const showLoadingLine = useCallback((type, bookingNo) => {
        if (loadingLineTimerRef.current) {
            clearTimeout(loadingLineTimerRef.current);
            loadingLineTimerRef.current = null;
        }

        if (loadingLineRef.current?.controller) {
            try { loadingLineRef.current.controller.abort(); } catch (e) {}
        }

        const controller = new AbortController();

        const labels = {
            approve: 'Approving',
            reject: 'Rejecting',
            cancel: 'Cancelling',
            reschedule: 'Rescheduling',
        };

        const verb = labels[type] || 'Processing';

        const line = {
            type,
            bookingNo,
            message: `${verb} booking ${bookingNo}…`,
            controller,
        };

        loadingLineRef.current = line;
        setLoadingLine(line);
        loadingLineTimerRef.current = setTimeout(() => {
            setLoadingLine(null);
            loadingLineRef.current = null;
            loadingLineTimerRef.current = null;
        }, 5000);

        return controller.signal;
    }, []);

    const hideLoadingLine = useCallback(() => {
        if (loadingLineTimerRef.current) {
            clearTimeout(loadingLineTimerRef.current);
            loadingLineTimerRef.current = null;
        }
        loadingLineRef.current = null;
        setLoadingLine(null);
    }, []);

    const handleCancelLoading = useCallback(() => {
        const current = loadingLineRef.current;
        if (!current) return;

        try {
            current.controller.abort();
        } catch (e) {
            console.warn('Abort failed:', e);
        }

        message.info(`Cancelled ${current.type} action for ${current.bookingNo}`);
        hideLoadingLine();
    }, [hideLoadingLine, message]);

    useEffect(() => {
        return () => {
            if (loadingLineTimerRef.current) {
                clearTimeout(loadingLineTimerRef.current);
            }
        };
    }, []);

    /**
     * ⭐ Wraps any async action with the loading line + abort handling.
     * The loading line shows FIRST, waits 5 seconds (giving the user
     * time to Cancel), and ONLY THEN fires the backend request.
     */
    const runWithLoadingLine = useCallback(async (type, record, fn) => {
        const bookingNo = safeString(record?.booking_no || record?.order_number || record?.id || '');
        const signal = showLoadingLine(type, bookingNo);
        const HOLD_MS = 5000;

        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, HOLD_MS);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });

            const result = await fn(signal);
            return result;
        } catch (error) {
            if (
                error?.name === 'CanceledError' ||
                error?.name === 'AbortError' ||
                error?.code === 'ERR_CANCELED'
            ) {
                hideLoadingLine();
                return null;
            }
            throw error;
        } finally {
            hideLoadingLine();
        }
    }, [showLoadingLine, hideLoadingLine]);

    const renderBookingActions = (booking) => {
        if (!booking) return null;
        const status = safeString(booking.booking_status).toLowerCase();
        const isPending = ['pending', 'pending_approval', 'draft'].includes(status);
        const isOperational = ['confirmed', 'approved', 'ongoing'].includes(status);
        const isToday = isBookingToday(booking);
        const isConfirmedToday = isBookingConfirmedAndToday(booking);

        const refundPending = isRefundPending(booking);
        const refundApproved = isRefundApproved(booking);

        // ⭐ Detect pending admin reschedule proposal
        const hasPendingAdminReschedule =
            safeString(booking?.reschedule_status).toLowerCase() === 'pending' &&
            safeString(booking?.reschedule_proposed_by).toLowerCase() === 'admin';

        // ⭐ Detect pending customer reschedule request
        const hasPendingCustomerReschedule =
            safeString(booking?.reschedule_status).toLowerCase() === 'pending' &&
            safeString(booking?.reschedule_proposed_by).toLowerCase() === 'customer';

        const adminDirectCancelFlag =
            Boolean(booking?.refund_admin_direct) ||
            Boolean(booking?.refund_request_state?.admin_direct) ||
            Boolean(booking?.cancellation_in_progress);

        const refundNeedsAttention =
            refundPending ||
            refundApproved ||
            adminDirectCancelFlag;

        return (
            <div className="bqm-action-group">
                <Tooltip title="View details">
                    <button className="bqm-action-icon view" onClick={() => openBookingDetails(booking)}><EyeOutlined /></button>
                </Tooltip>

                {(isPending || (canApproveOperations && status === 'confirmed')) && (
                    <Tooltip title="Edit booking meals and information">
                        <button className="bqm-action-icon edit" onClick={() => openEditBooking(booking)}><EditOutlined /></button>
                    </Tooltip>
                )}

                {canApproveOperations && isPending && (
                    <>
                        <Tooltip title={isToday ? "⚠️ Booking scheduled for today" : "Approve booking"}>
                            <button
                                className={`bqm-action-icon confirm ${isToday ? 'bqm-today-warning' : ''}`}
                                onClick={() => confirmBooking(booking)}
                                style={isToday ? { borderColor: '#f97316', backgroundColor: '#fff7ed' } : {}}
                            >
                                {isToday ? <FireOutlined style={{ color: '#f97316' }} /> : <CheckCircleOutlined />}
                            </button>
                        </Tooltip>
                        <Tooltip title="Reject or reschedule booking">
                            <button className="bqm-action-icon reject" onClick={() => openRejectModal(booking)}>
                                <CloseCircleOutlined />
                            </button>
                        </Tooltip>
                    </>
                )}

                {isOperational && (
                    <>
                        {isConfirmedToday && canApproveOperations && (
                            <Tooltip title="🎯 Event starts today - Start now">
                                <button
                                    className="bqm-action-icon start-event"
                                    onClick={() => openStartEventModal(booking)}
                                    style={{ borderColor: '#10b981', backgroundColor: '#ecfdf5' }}
                                >
                                    <FireOutlined style={{ color: '#10b981' }} />
                                </button>
                            </Tooltip>
                        )}

                        {canApproveOperations && isDepositOverdue(booking) && (
                            <Tooltip title="⚠️ Deposit overdue — extend, waive, or cancel">
                                <button
                                    className="bqm-action-icon bqm-deposit-overdue"
                                    onClick={() => openDepositOverdueModal(booking)}
                                    style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}
                                >
                                    <WarningOutlined style={{ color: '#ef4444' }} />
                                </button>
                            </Tooltip>
                        )}

                        <Tooltip
                            title={
                                refundPending
                                    ? '⚠️ Refund request pending — review in Cancel modal'
                                    : refundApproved
                                        ? '⚠️ Refund approved — confirm and release'
                                        : adminDirectCancelFlag
                                            ? '⚠️ Cancellation/refund in progress — review in Cancel modal'
                                            : isDepositOverdue(booking)
                                                ? '⚠️ Deposit overdue — review in Cancel modal'
                                                : 'Cancel booking'
                            }
                        >
                            <button
                                className={`bqm-action-icon delete ${refundNeedsAttention ? 'bqm-cancel-pending-refund' : ''}`}
                                onClick={() => openCancelModal(booking)}
                            >
                                <StopOutlined />
                            </button>
                        </Tooltip>

                                               {/* ⭐ Reschedule button — hidden when reschedule is pending */}
                        {!hasPendingAdminReschedule && !hasPendingCustomerReschedule && (
                            <Tooltip title={isCashierOnly ? 'Request reschedule' : 'Reschedule booking'}>
                                <button className="bqm-action-icon edit" onClick={() => openRescheduleModal(booking)}>
                                    <SyncOutlined />
                                </button>
                            </Tooltip>
                        )}

                        {/* ⭐ Admin responds to CUSTOMER-initiated reschedule */}
                        {hasPendingCustomerReschedule && canApproveOperations && (
                            <>
                                <Tooltip title=" Approve the customer's proposed new schedule">
                                    <button
                                        className="bqm-action-icon confirm"
                                        onClick={() => handleApproveCustomerReschedule(booking)}
                                        style={{ borderColor: '#10b981', backgroundColor: '#ecfdf5' }}
                                    >
                                        <CheckCircleOutlined style={{ color: '#10b981' }} />
                                    </button>
                                </Tooltip>

                                <Tooltip title="❌ Reject the customer's reschedule request">
                                    <button
                                        className="bqm-action-icon reject"
                                        onClick={() => handleRejectCustomerReschedule(booking)}
                                    >
                                        <CloseCircleOutlined />
                                    </button>
                                </Tooltip>

                                <Tooltip title="🚫 Cancel / withdraw the customer's reschedule request">
                                    <button
                                        className="bqm-action-icon cancel-proposal"
                                        onClick={() => handleCancelCustomerRescheduleRequest(booking)}
                                        style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
                                    >
                                        <CloseCircleOutlined style={{ color: '#f59e0b' }} />
                                    </button>
                                </Tooltip>
                            </>
                        )}
                                              {/* ⭐ Cancel ADMIN's own pending reschedule proposal */}
                        {hasPendingAdminReschedule && canApproveOperations && (
                            <Tooltip title="Withdraw the pending reschedule proposal">
                                <button
                                    className="bqm-action-icon cancel-proposal"
                                    onClick={() => openCancelRescheduleModal(booking)}
                                    style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
                                >
                                    <CloseCircleOutlined style={{ color: '#f59e0b' }} />
                                </button>
                            </Tooltip>
                        )}

                        {canApproveOperations && (
                            <Tooltip title="Mark as completed">
                                <button className="bqm-action-icon confirm" onClick={() => handleCompleteBooking(booking)}>
                                    <CheckCircleOutlined />
                                </button>
                            </Tooltip>
                        )}
                    </>
                )}

                {canApproveOperations && refundPending && (
                    <Tooltip title="💰 Refund request pending approval — approve or reject">
                        <button
                            className="bqm-action-icon refund-approval"
                            onClick={() => openRefundApprovalModal(booking)}
                            style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
                        >
                            <DollarOutlined style={{ color: '#f59e0b' }} />
                        </button>
                    </Tooltip>
                )}

                {isCashierOnly && refundApproved && (
                    <Tooltip title="💵 Refund approved — confirm and release payment">
                        <button
                            className="bqm-action-icon refund-confirm"
                            onClick={() => openConfirmRefundModal(booking)}
                            style={{ borderColor: '#10b981', backgroundColor: '#ecfdf5' }}
                        >
                            <WalletOutlined style={{ color: '#10b981' }} />
                        </button>
                    </Tooltip>
                )}
            </div>
        );
    };

    const regularBookingColumns = [
         {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            fixed: 'left',
                    // ⭐ REQUEST #1: colour the booking ID by source.
            //   mobile  → pink
            //   walk_in / web → blue
            render: (value, record) => {
                const idColor = getBookingIdColor(record);
                return (
                    <span
                        className="bqm-id-text"
                        style={{
                            color: idColor.color,
                            background: idColor.background,
                            border: `1px solid ${idColor.borderColor}`,
                            borderRadius: 8,
                            padding: '2px 8px',
                            fontWeight: 600,
                            display: 'inline-block',
                        }}
                    >
                        {safeString(value)}
                    </span>
                );
            }
        },
        { title: 'CUSTOMER', dataIndex: 'customer_name', key: 'customer_name', width: 200, render: (value, record) => (
            <div className="bqm-customer-cell">
                <div className="bqm-customer-name">{safeString(value)}</div>
                <div className="bqm-customer-contact"><MailOutlined /> {safeString(record?.customer_email, 'No email')}</div>
                <div className="bqm-customer-contact"><PhoneOutlined /> {safeString(record?.customer_phone, 'No phone')}</div>
            </div>
        ) },
        {
            title: 'EVENT DATE & LOCATION',
            key: 'event_location',
            width: 220,
            render: (_, record) => {
                if (!record) return <span>N/A</span>;
                return (
                    <div className="bqm-event-location-cell">
                        <div className="bqm-event-date"><CalendarOutlined /> {safeString(record.event_date, 'N/A')}</div>
                        <div className="bqm-event-date"><ScheduleOutlined /> {safeString(record.event_time, 'N/A')}</div>
                        <div className="bqm-event-location"><EnvironmentOutlined /> {getBookingLocation(record)}</div>
                        {isBookingToday(record) && (
                            <Tag color="orange" className="bqm-today-tag"><FireOutlined /> Today</Tag>
                        )}
                    </div>
                );
            }
        },
        { title: 'SERVICE', key: 'service_type', width: 130, render: (_, record) => <span className="bqm-service-text">{getServiceType(record)}</span> },
        { title: 'EVENT TYPE', key: 'event_type', width: 130, render: (_, record) => <span className="bqm-event-type-text">{getEventTypeName(record?.event_type_id)}</span> },
        { title: 'PAX', dataIndex: 'guests_count', key: 'guests_count', width: 80, align: 'center', render: (value) => <span className="bqm-pax-number"><TeamOutlined /> {safeNumber(value)}</span> },
        { title: 'AMOUNT', dataIndex: 'total_amount', key: 'total_amount', width: 150, align: 'center', render: (value) => <span className="bqm-amount">{formatCurrency(value)}</span> },
                    { title: 'STATUS', dataIndex: 'booking_status', key: 'booking_status', width: 260, render: (value, record) => {
            const config = getStatusConfig(value);
            const refundConfig = getRefundStatusConfig(record?.refund_status);
            const depositConfig = getDepositStateLabel(record?.deposit_decision_status);
            const depositOverdue = isDepositOverdue(record);

            const rescheduleProposedBy = safeString(record?.reschedule_proposed_by).toLowerCase();
            const rescheduleStatus = safeString(record?.reschedule_status).toLowerCase();
            const hasPendingAdminProposal = rescheduleStatus === 'pending' && rescheduleProposedBy === 'admin';
            const hasPendingCustomerRequest = rescheduleStatus === 'pending' && rescheduleProposedBy === 'customer';

                     const depositDeadlinePassed = Boolean(record?.deposit_deadline_passed);

            return (
                <div className="bqm-status-stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{config.text}</span>

                    {hasPendingAdminProposal && (
                        <span className="bqm-status" style={{ color: '#9C27B0', background: '#F3E5F5' }}>
                            <SyncOutlined /> Date Proposed to Customer
                        </span>
                    )}

                    {hasPendingCustomerRequest && (
                        <span className="bqm-status" style={{ color: '#FF9800', background: '#FFF3E0' }}>
                            <ClockCircleOutlined /> Customer Reschedule Pending
                        </span>
                    )}

                    {/* ⭐ REQUEST #10: red highlight when approved + deposit deadline passed + unpaid */}
                    {depositDeadlinePassed && (
                        <span
                            className="bqm-status bqm-deposit-deadline-passed"
                            style={{ color: '#ffffff', background: '#dc2626', fontWeight: 700 }}
                        >
                            <WarningOutlined /> Deposit Deadline Passed
                        </span>
                    )}

                    {depositOverdue && (
                        <span className="bqm-status bqm-deposit-warning" style={{ color: '#ef4444', background: '#fef2f2' }}>
                            <WarningOutlined /> Deposit Overdue
                        </span>
                    )}
                    {depositConfig && (
                        <span className="bqm-status bqm-deposit-status" style={{ color: depositConfig.color, background: depositConfig.background }}>
                            {depositConfig.icon}{depositConfig.text}
                        </span>
                    )}
                    {refundConfig && (
                        <span className="bqm-status bqm-refund-status" style={{ color: refundConfig.color, background: refundConfig.background }}>
                            {refundConfig.icon}{refundConfig.text}
                        </span>
                    )}
                                 </div>
            );
        } },
        { title: 'ACTION', key: 'action', width: 300, fixed: 'right', render: (_, record) => renderBookingActions(record) }
    ];

      const multiDayColumns = [
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            fixed: 'left',
                         // ⭐ REQUEST #1: colour the booking ID by source.
            //   mobile  → pink
            //   walk_in / web → blue
            render: (value, record) => {
                const idColor = getBookingIdColor(record);
                return (
                    <span
                        className="bqm-id-text"
                        style={{
                            color: idColor.color,
                            background: idColor.background,
                            border: `1px solid ${idColor.borderColor}`,
                            borderRadius: 8,
                            padding: '2px 8px',
                            fontWeight: 600,
                            display: 'inline-block',
                        }}
                    >
                        {safeString(value)}
                    </span>
                );
            }
        },
        { title: 'CUSTOMER', dataIndex: 'customer_name', key: 'customer_name', width: 200, render: (value, record) => (
            <div className="bqm-customer-cell">
                <div className="bqm-customer-name">{safeString(value)}</div>
                <div className="bqm-customer-contact"><MailOutlined /> {safeString(record?.customer_email, 'No email')}</div>
            </div>
        ) },
        {
            title: 'EVENT PERIOD',
            key: 'event_period',
            width: 220,
            render: (_, record) => {
                if (!record) return <span>N/A</span>;
                return (
                    <div className="bqm-event-period-cell">
                        <div className="bqm-event-date"><CalendarOutlined /> {safeString(record.event_date, 'N/A')} - {safeString(record.event_end_date || record.end_date || record.event_date, 'N/A')}</div>
                        <div className="bqm-event-days"><ScheduleOutlined /> {safeString(record.event_time, 'N/A')} • {formatDays(record.event_date, record.event_end_date || record.end_date || record.event_date)} days</div>
                        {isBookingToday(record) && (
                            <Tag color="orange" className="bqm-today-tag"><FireOutlined /> Starts Today</Tag>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'LOCATION',
            key: 'location',
            width: 220,
            ellipsis: true,
            render: (_, record) => {
                if (!record) return <span>N/A</span>;
                return (
                    <div className="bqm-event-location-cell">
                        <EnvironmentOutlined /> {getBookingLocation(record)}
                    </div>
                );
            }
        },
        { title: 'PAX', dataIndex: 'guests_count', key: 'guests_count', width: 80, align: 'center', render: (value) => <span className="bqm-pax-number"><TeamOutlined /> {safeNumber(value)}</span> },
        { title: 'AMOUNT', dataIndex: 'total_amount', key: 'total_amount', width: 140, align: 'right', render: (value) => <span className="bqm-amount">{formatCurrency(value)}</span> },
                      { title: 'STATUS', dataIndex: 'booking_status', key: 'booking_status', width: 260, render: (value, record) => {
            const config = getStatusConfig(value);
            const refundConfig = getRefundStatusConfig(record?.refund_status);
            const depositConfig = getDepositStateLabel(record?.deposit_decision_status);
            const depositOverdue = isDepositOverdue(record);

            const rescheduleProposedBy = safeString(record?.reschedule_proposed_by).toLowerCase();
            const rescheduleStatus = safeString(record?.reschedule_status).toLowerCase();
            const hasPendingAdminProposal = rescheduleStatus === 'pending' && rescheduleProposedBy === 'admin';
            const hasPendingCustomerRequest = rescheduleStatus === 'pending' && rescheduleProposedBy === 'customer';

                   const depositDeadlinePassed = Boolean(record?.deposit_deadline_passed);

            return (
                <div className="bqm-status-stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{config.text}</span>
                    {hasPendingAdminProposal && (
                        <span className="bqm-status" style={{ color: '#9C27B0', background: '#F3E5F5' }}>
                            <SyncOutlined /> Date Proposed to Customer
                        </span>
                    )}
                    {hasPendingCustomerRequest && (
                        <span className="bqm-status" style={{ color: '#FF9800', background: '#FFF3E0' }}>
                            <ClockCircleOutlined /> Customer Reschedule Pending
                        </span>
                    )}

                    {/* ⭐ REQUEST #10 */}
                    {depositDeadlinePassed && (
                        <span
                            className="bqm-status bqm-deposit-deadline-passed"
                            style={{ color: '#ffffff', background: '#dc2626', fontWeight: 700 }}
                        >
                            <WarningOutlined /> Deposit Deadline Passed
                        </span>
                    )}

                    {depositOverdue && (
                        <span className="bqm-status bqm-deposit-warning" style={{ color: '#ef4444', background: '#fef2f2' }}>
                            <WarningOutlined /> Deposit Overdue
                        </span>
                    )}
                    {depositConfig && (
                        <span className="bqm-status bqm-deposit-status" style={{ color: depositConfig.color, background: depositConfig.background }}>
                            {depositConfig.icon}{depositConfig.text}
                        </span>
                    )}
                    {refundConfig && (
                        <span className="bqm-status bqm-refund-status" style={{ color: refundConfig.color, background: refundConfig.background }}>
                            {refundConfig.icon}{refundConfig.text}
                        </span>
                    )}

                                </div>
            );
        } },
        { title: 'ACTION', key: 'action', width: 300, fixed: 'right', render: (_, record) => renderBookingActions(record) }
    ];

            const historyColumns = [
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            // ⭐ REQUEST #1: colour the booking ID by source.
            render: (value, record) => {
                const idColor = getBookingIdColor(record);
                return (
                    <span
                        className="bqm-id-text"
                        style={{
                            color: idColor.color,
                            background: idColor.background,
                            border: `1px solid ${idColor.borderColor}`,
                            borderRadius: 8,
                            padding: '2px 8px',
                            fontWeight: 600,
                            display: 'inline-block',
                        }}
                    >
                        {safeString(value)}
                    </span>
                );
            }
        },
        { title: 'CUSTOMER', dataIndex: 'customer_name', key: 'customer_name', width: 200 },
        { title: 'EVENT DATE', dataIndex: 'event_date', key: 'event_date', width: 120, render: (value) => formatDateSafe(value) },
        { title: 'LOCATION', dataIndex: 'venue', key: 'venue', width: 180, ellipsis: true },
        { title: 'PAX', dataIndex: 'guests_count', key: 'guests_count', width: 80, align: 'center', render: (value) => <span className="bqm-pax-number">{safeNumber(value)}</span> },
        { title: 'AMOUNT', dataIndex: 'total_amount', key: 'total_amount', width: 140, align: 'right', render: (value) => <span className="bqm-amount">{formatCurrency(value)}</span> },
        { title: 'STATUS', dataIndex: 'booking_status', key: 'booking_status', width: 120, render: (value) => { const config = getStatusConfig(value); return <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{config.text}</span>; } },
        {
            title: 'ACTION',
            key: 'action',
            width: 100,
            fixed: 'right',
            render: (_, record) => (
                <div className="bqm-action-group">
                    <Tooltip title="View completed booking details">
                        <button className="bqm-action-icon view" onClick={() => openBookingDetails(record)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    const refundRequestColumns = useMemo(() => [
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            render: (value) => <span className="bqm-id-text">{safeString(value)}</span>,
        },
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 200,
            render: (value, record) => (
                <div className="bqm-customer-cell">
                    <div className="bqm-customer-name">{safeString(value)}</div>
                    <div className="bqm-customer-contact">
                        <MailOutlined /> {safeString(record?.customer_email, 'No email')}
                    </div>
                </div>
            ),
        },
        {
            title: 'EVENT DATE',
            dataIndex: 'event_date',
            key: 'event_date',
            width: 130,
            render: (value) => formatDateSafe(value),
        },
        {
            title: 'DEPOSIT',
            key: 'deposit',
            width: 130,
            align: 'right',
            render: (_, record) => (
                <span className="bqm-amount">{formatCurrency(getDepositAmount(record))}</span>
            ),
        },
        {
            title: 'STATUS',
            key: 'refund_status',
            width: 180,
            render: (_, record) => {
                const config = getRefundStatusConfig(record?.refund_status);
                if (!config) return <Tag>—</Tag>;
                return (
                    <span
                        className="bqm-status"
                        style={{ color: config.color, background: config.background }}
                    >
                        {config.icon}
                        {config.text}
                    </span>
                );
            },
        },
        {
            title: 'REQUESTED',
            key: 'requested_at',
            width: 180,
            render: (_, record) => (
                <span>{formatDateSafe(record?.refund_requested_at, 'MMM DD, YYYY hh:mm A')}</span>
            ),
        },
        {
            title: 'REASON',
            dataIndex: 'refund_reason',
            key: 'refund_reason',
            ellipsis: true,
            render: (value) => safeString(value, '—'),
        },
        {
            title: 'ACTION',
            key: 'action',
            width: 200,
            fixed: 'right',
            render: (_, record) => {
                const pending = isRefundPending(record);
                const approved = isRefundApproved(record);
                return (
                    <div className="bqm-action-group">
                        <Tooltip title="View booking details">
                            <button
                                className="bqm-action-icon view"
                                onClick={() => openBookingDetails(record)}
                            >
                                <EyeOutlined />
                            </button>
                        </Tooltip>
                        {pending && (
                            <Tooltip title="Review refund request">
                                <button
                                    className="bqm-action-icon refund-approval"
                                    onClick={() => openRefundApprovalModal(record)}
                                    style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
                                >
                                    <DollarOutlined style={{ color: '#f59e0b' }} />
                                </button>
                            </Tooltip>
                        )}
                        {approved && (
                            <Tooltip title="Awaiting cashier to release refund">
                                <button
                                    className="bqm-action-icon"
                                    style={{ borderColor: '#3b82f6', backgroundColor: '#eff6ff', cursor: 'default' }}
                                >
                                    <ClockCircleOutlined style={{ color: '#3b82f6' }} />
                                </button>
                            </Tooltip>
                        )}
                        <Tooltip title="Open cancellation sheet">
                            <button
                                className="bqm-action-icon delete"
                                onClick={() => openCancelModal(record)}
                            >
                                <StopOutlined />
                            </button>
                        </Tooltip>
                    </div>
                );
            },
        },
    ], [canApproveOperations]);

    const getQuotationLatestSend = (record) => {
        const history = safeArray(record.send_history);
        return safeObject(record.latest_send || history[0] || {});
    };

     const handleSendQuotation = (record) => {
        modal.confirm({
            title: 'Resend Quotation',
            content: `Resend the existing quotation ${safeString(record.quote_no)} through email and the connected mobile Messenger account?`,
            okText: 'Resend Quotation',
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                const hideLoading = message.loading(`Resending quotation ${safeString(record.quote_no)}...`, 0);
                try {
                    await sendQuotationMutation.mutateAsync(record.id);
                } catch (error) {
                    message.error(error?.response?.data?.message || 'Failed to resend quotation.');
                    throw error;
                } finally {
                    hideLoading();
                }
            }
        });
    };
    const handleRejectQuotation = (record) => {
        modal.confirm({
            title: 'Reject Quotation',
            content: `Reject quotation ${safeString(record.quote_no)}?`,
            okText: 'Reject',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
            onOk: () => rejectQuotationMutation.mutateAsync(record.id)
        });
    };

    const handleDeleteQuotation = (record) => {
        modal.confirm({
            title: 'Delete Quotation',
            content: `Delete quotation ${safeString(record.quote_no)}? This cannot be undone.`,
            okText: 'Delete',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
            onOk: () => deleteQuotationMutation.mutateAsync(record.id)
        });
    };

    const quotationColumns = [
        { title: 'QUOTE #', dataIndex: 'quote_no', key: 'quote_no', width: 140, render: (value) => <span className="bqm-id-text">{safeString(value)}</span> },
        { title: 'CUSTOMER', dataIndex: 'customer_name', key: 'customer_name', width: 200, render: (value, record) => (
            <div className="bqm-customer-cell">
                <div className="bqm-customer-name">{safeString(value)}</div>
                <div className="bqm-customer-contact"><MailOutlined /> {safeString(record.customer_email, 'No email')}</div>
            </div>
        ) },
        { title: 'EVENT DATE', dataIndex: 'event_date', key: 'event_date', width: 120, render: (value) => formatDateSafe(value) },
        { title: 'PAX', dataIndex: 'guests_count', key: 'guests_count', width: 80, align: 'center', render: (value) => <span className="bqm-pax-number">{safeNumber(value)}</span> },
        { title: 'AMOUNT', dataIndex: 'total_amount', key: 'total_amount', width: 140, align: 'right', render: (value) => <span className="bqm-amount">{formatCurrency(value)}</span> },
        { title: 'STATUS', dataIndex: 'status', key: 'status', width: 130, render: (value) => { const config = getStatusConfig(value); return <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{config.text}</span>; } },
        { title: 'DATE SENT', key: 'date_sent', width: 120, render: (_, record) => safeString(getQuotationLatestSend(record).date_sent, 'Not sent') },
        { title: 'TIME SENT', key: 'time_sent', width: 110, render: (_, record) => safeString(getQuotationLatestSend(record).time_sent, '—') },
        { title: 'DELIVERY', key: 'delivery_status', width: 130, render: (_, record) => {
            const status = safeString(getQuotationLatestSend(record).delivery_status, 'Pending');
            const config = getStatusConfig(status.toLowerCase());
            return <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{status}</span>;
        } },
        { title: 'ACTION', key: 'action', width: 150, render: (_, record) => (
            <div className="bqm-action-group">
                <Tooltip title="Resend quotation"><button className="bqm-action-icon send" onClick={() => handleSendQuotation(record)}><SendOutlined /></button></Tooltip>
                {canApproveOperations && (
                    <>
                        <Tooltip title="Reject quotation"><button className="bqm-action-icon reject" onClick={() => handleRejectQuotation(record)}><CloseCircleOutlined /></button></Tooltip>
                        <Tooltip title="Delete quotation"><button className="bqm-action-icon delete" onClick={() => handleDeleteQuotation(record)}><DeleteOutlined /></button></Tooltip>
                    </>
                )}
            </div>
        ) }
    ];

    const bookingSteps = [
        { title: 'Customer', icon: <UserOutlined /> },
        { title: 'Event', icon: <CalendarOutlined /> },
        { title: 'Meals', icon: <ForkOutlined /> },
        { title: 'Requests', icon: <MessageOutlined /> },
        { title: 'Summary', icon: <DollarOutlined /> }
    ];

    const renderBookingStepContent = () => {
        if (!selectedBooking) {
            return (
                <div className="bqm-step-content">
                    <Text type="secondary">No booking selected.</Text>
                </div>
            );
        }

        switch (bookingStep) {
            case 0:
                return (
                    <div className="bqm-step-content">
                        <div className="bqm-info-card">
                            <div className="bqm-info-row"><span className="bqm-info-label"><UserOutlined /> Customer Name</span><span className="bqm-info-value">{safeString(selectedBooking.customer_name)}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><MailOutlined /> Email Address</span><span className="bqm-info-value">{safeString(selectedBooking.customer_email)}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><PhoneOutlined /> Phone Number</span><span className="bqm-info-value">{safeString(selectedBooking.customer_phone, 'N/A')}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><EnvironmentOutlined /> Address</span><span className="bqm-info-value">{safeString(selectedBooking.customer_address, 'N/A')}</span></div>
                        </div>
                    </div>
                );
            case 1:
                return (
                    <div className="bqm-step-content">
                        <div className="bqm-info-card">
                            <div className="bqm-info-row"><span className="bqm-info-label"><TagOutlined /> Event Type</span><span className="bqm-info-value">{getEventTypeName(selectedBooking.event_type_id)}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><CalendarOutlined /> Event Date</span><span className="bqm-info-value">{formatDateTime(selectedBooking.event_date, selectedBooking.event_time)}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><EnvironmentOutlined /> Venue/Location</span><span className="bqm-info-value">{getBookingLocation(selectedBooking)}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><ForkOutlined /> Service Type</span><span className="bqm-info-value">{getServiceType(selectedBooking)}</span></div>
                            <div className="bqm-info-row"><span className="bqm-info-label"><TeamOutlined /> Number of Guests</span><span className="bqm-info-value">{safeNumber(selectedBooking.guests_count)} PAX</span></div>
                            {isBookingToday(selectedBooking) && (
                                <div className="bqm-info-row"><span className="bqm-info-label"><FireOutlined /> Status</span><span className="bqm-info-value"><Tag color="orange">Event is TODAY</Tag></span></div>
                            )}
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="bqm-step-content">
                        <div className="bqm-info-card">
                            <div className="bqm-info-row" style={{ borderBottom: 'none', marginBottom: 12 }}>
                                <span className="bqm-info-label"><MenuOutlined /> Menu Type</span>
                                <span className="bqm-info-value"><Tag color={getMenuType(selectedBooking) === 'Package' ? '#8b5cf6' : '#f59e0b'}>{getMenuType(selectedBooking)} Menu</Tag></span>
                            </div>
                            {renderMealServicesInModal(selectedBooking)}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="bqm-step-content">
                        <div className="bqm-info-card">
                            <div className="bqm-special-request-box">
                                <MessageOutlined style={{ fontSize: 32, color: '#3b82f6' }} />
                                <p>{getSpecialRequests(selectedBooking)}</p>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="bqm-step-content">
                        <div className="bqm-info-card">
                            <div className="bqm-price-summary">
                                <div className="bqm-price-summary-header">
                                    <DollarOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
                                    <span>Financial Summary</span>
                                </div>
                                <div className="bqm-price-row"><span>Total Amount</span><strong>{formatCurrency(selectedBooking.total_amount)}</strong></div>
                                <div className="bqm-price-row"><span>Status</span><Tag color={getStatusConfig(selectedBooking.booking_status).color}>{getStatusConfig(selectedBooking.booking_status).text}</Tag></div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const renderLateCancellationStrip = (booking) => {
        const withinCutoff = isBookingWithinCancellationCutoff(booking);
        const cutoffDays = getCancellationCutoffDays(booking);

        return (
            <>
                <div className="bqm-formal-strip">
                    <div className="bqm-formal-strip-item">
                        <span className="bqm-formal-strip-label">Customer</span>
                        <span className="bqm-formal-strip-value">{safeString(booking?.customer_name)}</span>
                    </div>
                    <div className="bqm-formal-strip-item">
                        <span className="bqm-formal-strip-label">Event Date</span>
                        <span className="bqm-formal-strip-value">{formatDateSafe(booking?.event_date)}</span>
                    </div>
                    <div className="bqm-formal-strip-item">
                        <span className="bqm-formal-strip-label">Deposit on File</span>
                        <span className="bqm-formal-strip-value bqm-formal-strip-value--money">
                            {formatCurrency(getDepositAmount(booking))}
                        </span>
                    </div>
                </div>

                {withinCutoff && (
                    <div className="bqm-formal-note bqm-formal-note--danger">
                        <WarningOutlined />
                        <span>
                            This booking is <strong>inside the {cutoffDays}-day cancellation
                            cutoff</strong>. The deposit is non-refundable by default —
                            an administrator may still choose to refund at their discretion.
                        </span>
                    </div>
                )}
            </>
        );
    };

    const renderAdminDecisionSheet = () => {
        const pending = isRefundPending(selectedBooking);
        const approved = isRefundApproved(selectedBooking);

        return (
            <>
                <div className="bqm-formal-section">
                    <div className="bqm-formal-section-head">
                        <span className="bqm-formal-section-index">01</span>
                        <span className="bqm-formal-section-title">Cancellation Reason</span>
                        <span className="bqm-formal-section-rule" />
                    </div>
                    <Form form={cancelWithRefundForm} layout="vertical" className="bqm-formal-form">
                        <Form.Item
                            name="reason"
                            rules={[{ required: true, message: 'Please provide a reason' }]}
                            style={{ marginBottom: 0 }}
                        >
                            <TextArea
                                rows={3}
                                placeholder="State the reason for cancellation. This will be recorded in the audit trail."
                                maxLength={500}
                                showCount
                            />
                        </Form.Item>
                    </Form>
                </div>

                <div className="bqm-formal-section">
                    <div className="bqm-formal-section-head">
                        <span className="bqm-formal-section-index">02</span>
                        <span className="bqm-formal-section-title">Administrative Decision</span>
                        <span className="bqm-formal-chip bqm-formal-chip--restricted">
                            Restricted · Admin
                        </span>
                    </div>

                    <Form
                        form={adminDepositForm}
                        layout="vertical"
                        className="bqm-formal-form"
                        initialValues={{
                            action: 'cancel',
                            notes: '',
                            refund_amount: 0,
                            refund_method: 'cash',
                            refund_reference: '',
                        }}
                    >
                        <Form.Item name="action" initialValue="cancel" hidden>
                            <Input />
                        </Form.Item>

                        <div className="bqm-formal-panel bqm-formal-panel--danger">
                            <div className="bqm-formal-panel-head">
                                <DollarOutlined />
                                <span>Refund Instructions</span>
                            </div>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item
                                        name="refund_amount"
                                        label="Refund Amount"
                                        rules={[
                                            { required: true, message: 'Enter the refund amount (0 for none).' },
                                            { type: 'number', min: 0, message: 'Cannot be negative.' },
                                        ]}
                                        tooltip="Enter 0 for cancel without refund."
                                    >
                                        <InputNumber
                                            min={0}
                                            step={0.01}
                                            size="large"
                                            style={{ width: '100%' }}
                                            placeholder="0.00"
                                            formatter={(v) => `₱ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={(v) => v?.replace(/₱\s?|(,*)/g, '')}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="refund_method" label="Disbursement Method">
                                        <Select size="large">
                                            <Option value="cash">Cash</Option>
                                            <Option value="gcash">GCash</Option>
                                            <Option value="maya">Maya</Option>
                                            <Option value="bank_transfer">Bank Transfer</Option>
                                            <Option value="card">Card</Option>
                                            <Option value="check">Check</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item
                                name="refund_reference"
                                label="Reference Number"
                                tooltip="Bank ref, GCash ref, cheque number, etc."
                                style={{ marginBottom: 0 }}
                            >
                                <Input size="large" placeholder="Optional" />
                            </Form.Item>
                        </div>

                        <Form.Item
                            name="notes"
                            label="Internal Note"
                            style={{ marginTop: 16, marginBottom: 16 }}
                        >
                            <TextArea
                                rows={2}
                                placeholder="Optional — recorded in the audit log"
                                maxLength={500}
                                showCount
                            />
                        </Form.Item>

                        <Button
                            type="primary"
                            block
                            size="large"
                            icon={<CheckCircleOutlined />}
                            className="bqm-formal-btn bqm-formal-btn--danger"
                            onClick={() => {
                                adminDepositForm.validateFields()
                                    .then(() => handleAdminDepositAction(adminDepositForm.getFieldsValue()))
                                    .catch(() => {});
                            }}
                        >
                            Confirm Cancellation &amp; Refund
                        </Button>
                    </Form>
                </div>

                {(pending || approved) && (
                    <div className="bqm-formal-section">
                        <div className="bqm-formal-section-head">
                            <span className="bqm-formal-section-index">03</span>
                            <span className="bqm-formal-section-title">Cashier's Cancellation Request</span>
                            <span className="bqm-formal-chip bqm-formal-chip--readonly">Read Only</span>
                        </div>
                        <div className="bqm-formal-dossier">
                            <div className="bqm-formal-dossier-row">
                                <span className="bqm-formal-dossier-label">Requested By</span>
                                <span className="bqm-formal-dossier-value">
                                    {safeString(
                                        selectedBooking?.refund_requested_by_name
                                        || selectedBooking?.refund_requested_by
                                        || 'Cashier',
                                    )}
                                </span>
                            </div>
                            <div className="bqm-formal-dossier-row">
                                <span className="bqm-formal-dossier-label">Requested At</span>
                                <span className="bqm-formal-dossier-value">
                                    {formatDateSafe(
                                        selectedBooking?.refund_requested_at,
                                        'MMM DD, YYYY • hh:mm A',
                                    )}
                                </span>
                            </div>
                            <div className="bqm-formal-dossier-row">
                                <span className="bqm-formal-dossier-label">Status</span>
                                <span className="bqm-formal-dossier-value">
                                    <span className={`bqm-formal-pill bqm-formal-pill--${pending ? 'warn' : 'info'}`}>
                                        {getRefundStatusConfig(selectedBooking?.refund_status)?.text || 'Pending'}
                                    </span>
                                </span>
                            </div>
                            <div className="bqm-formal-dossier-row bqm-formal-dossier-row--stack">
                                <span className="bqm-formal-dossier-label">Reason</span>
                                <span className="bqm-formal-dossier-value bqm-formal-dossier-value--block">
                                    {safeString(selectedBooking?.refund_reason, '—')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderCashierRequestForm = () => {
        const pending = isRefundPending(selectedBooking) || hasPendingRefundRequest(selectedBooking);
        const approved = isRefundApproved(selectedBooking);
        const finalized = isRefundFinalized(selectedBooking);
        const withinCutoff = isBookingWithinCancellationCutoff(selectedBooking);
        const locked = pending || approved || finalized;

        return (
            <div className="bqm-formal-section">
                <div className="bqm-formal-section-head">
                    <span className="bqm-formal-section-index">01</span>
                    <span className="bqm-formal-section-title">Cancellation Request</span>
                    <span className="bqm-formal-section-rule" />
                </div>

                {pending && (
                    <div className="bqm-formal-note">
                        <ClockCircleOutlined />
                        <span>
                            Your cancellation request is <strong>pending admin review</strong>.
                            You will be notified once it has been decided.
                        </span>
                    </div>
                )}
                {approved && (
                    <div className="bqm-formal-note bqm-formal-note--success">
                        <CheckCircleOutlined />
                        <span>
                            Your request was <strong>approved</strong>. Open the booking row
                            and use <strong>Confirm Refund</strong> to enter the amount and release it.
                        </span>
                    </div>
                )}
                {finalized && (
                    <div className="bqm-formal-note">
                        <InfoCircleOutlined />
                        <span>This cancellation has already been finalized.</span>
                    </div>
                )}

                <Form
                    form={cancelWithRefundForm}
                    layout="vertical"
                    className="bqm-formal-form"
                    disabled={locked}
                >
                    <Form.Item
                        name="reason"
                        label="Reason for Cancellation"
                        rules={[{ required: true, message: 'Please provide a reason' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="State the reason for cancelling this booking..."
                            maxLength={500}
                            showCount
                        />
                    </Form.Item>
                </Form>

                <div className="bqm-formal-options" style={{ marginTop: 16 }}>
                    {!withinCutoff && (
                        <button
                            type="button"
                            className={`bqm-formal-option bqm-formal-option--forfeit ${locked ? 'is-disabled' : ''}`}
                            disabled={locked}
                            onClick={() => {
                                cancelWithRefundForm.validateFields(['reason'])
                                    .then(() => handleCancelWithoutRefund(cancelWithRefundForm.getFieldsValue()))
                                    .catch(() => {});
                            }}
                        >
                            <div className="bqm-formal-option-head">
                                <StopOutlined className="bqm-formal-option-icon" />
                                <span className="bqm-formal-option-title">Cancel Without Refund</span>
                            </div>
                            <p className="bqm-formal-option-text">
                                Terminate immediately. Deposit is forfeited per policy.
                                No approval required.
                            </p>
                            <span className="bqm-formal-option-action">Proceed →</span>
                        </button>
                    )}

                    <button
                        type="button"
                        className={`bqm-formal-option bqm-formal-option--refund ${locked ? 'is-disabled' : ''}`}
                        disabled={locked}
                        onClick={() => {
                            cancelWithRefundForm.validateFields(['reason'])
                                .then(() => handleSubmitRefundRequest(cancelWithRefundForm.getFieldsValue()))
                                .catch(() => {});
                        }}
                    >
                        <div className="bqm-formal-option-head">
                            <SyncOutlined className="bqm-formal-option-icon" />
                            <span className="bqm-formal-option-title">
                                Submit Cancellation &amp; Refund Request
                            </span>
                        </div>
                        <p className="bqm-formal-option-text">
                            Route this to administration for review. If approved, you will be
                            prompted to enter the actual refund amount to release.
                        </p>
                        <span className="bqm-formal-option-action">
                            {pending
                                ? 'Request Pending'
                                : approved
                                    ? 'Awaiting Your Confirmation'
                                    : finalized
                                        ? 'Already Processed'
                                        : 'Route to Admin →'}
                        </span>
                    </button>
                </div>
            </div>
        );
    };

    const containerClass = `bqm-container ${isDarkMode ? 'bqm-dark-mode' : ''}`;
    const headerClass = `bqm-header ${isDarkMode ? 'bqm-header-dark' : ''}`;
    const mainCardClass = `bqm-main-card ${isDarkMode ? 'bqm-main-card-dark' : ''}`;
    const filtersClass = `bqm-filters ${isDarkMode ? 'bqm-filters-dark' : ''}`;
    const filterGroupClass = `bqm-filter-group ${isDarkMode ? 'bqm-filter-group-dark' : ''}`;
    const tableClass = `bqm-table ${isDarkMode ? 'bqm-table-dark' : ''}`;
    // Show skeleton ONLY on a true cold start — i.e. no tab has data yet.
    // As soon as ANY list resolves, render the real page and let the other
    // tabs finish loading in the background under their own tab spinners.
    const hasAnyData =
        Boolean(regularBookingsData) ||
        Boolean(multiDayBookingsData) ||
        Boolean(completedBookingsData) ||
        Boolean(quotationsData) ||
        Boolean(eventTypesData);

    // Hard timeout: never show the skeleton longer than 1.5s, even if the
    // network hangs. Render the page so React Query can stream data in.
    const [skeletonTimedOut, setSkeletonTimedOut] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setSkeletonTimedOut(true), 1500);
        return () => clearTimeout(t);
    }, []);

    const showSkeleton = !hasAnyData && !skeletonTimedOut;

    if (showSkeleton) {
        return <BookingSkeleton />;
    }
    return (
        <App>
            <ConfigProvider theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
                                      <div className={containerClass}>
                                    {loadingLine && (
                        <div className="bqm-loading-line" role="status" aria-live="polite">
                            <div className="bqm-loading-line-text">
                                {loadingLine.message}
                            </div>
                            <button
                                type="button"
                                className="bqm-loading-line-cancel"
                                onClick={handleCancelLoading}
                            >
                                Cancel
                            </button>
                                                       <div className="bqm-loading-line-track">
                                <div className="bqm-loading-line-fill" />
                            </div>
                        </div>
                    )}
                    <div className={headerClass}>
                        <div className="bqm-header-left">
                            <div className="bqm-logo-icon"><FaRegCalendarAlt /></div>
                            <div className="bqm-header-info">
                                <h1>Booking & Quotation Management</h1>
                                <span>ENTERPRISE SYSTEM</span>
                            </div>
                        </div>
                        <div className="bqm-header-right">
                                                 <div className="bqm-date-display"><CalendarOutlined /><span>{dayjs().format('dddd, MMMM DD, YYYY')}</span></div>
                            <Divider type="vertical" />
                            <Button icon={<ReloadOutlined />} onClick={() => refreshAllData(true)}>Refresh</Button>
                            <Button icon={<ExportOutlined />} onClick={() => {
                                if (activeBookingTab === 'regular') exportRegularBookings();
                                else if (activeBookingTab === 'multi_day') exportMultiDayBookings();
                                else if (activeMainTab === 'history') exportHistory();
                            }}>Export</Button>
                            <Button icon={<PrinterOutlined />} onClick={() => {
                                if (activeMainTab === 'history') printHistory();
                                else if (activeMainTab === 'bookings' && activeBookingTab === 'regular') printRegularBookings();
                                else if (activeMainTab === 'bookings' && activeBookingTab === 'multi_day') printMultiDayBookings();
                            }}>Print</Button>
                        </div>
                    </div>
                                     {/*
                      ⭐ REQUEST #3, #4, #5, #6, #7, #8: KPI cards.
                        - Approved Booking   (was: Total Booking)
                        - Pending Approvals
                        - Total Revenue      (approved only)
                        - Rejected           (was: Outstanding Balance)

                      Hide/Unhide rules:
                        • Admin sees a lock button on card hover only.
                        • Cashier sees no button, but sees the mask if admin hid it.
                        • Mask length matches the number of digits in the real value.
                        • Reads from effectiveVisibility so the persisted state is
                          honored even before localInsightVisibility initializes.
                    */}
                    <div className="bqm-kpi-grid">

                        {/* ============ Approved Booking ============ */}
                        <div className="bqm-kpi-card bqm-kpi-card-hideable">
                            {canToggleInsightVisibility && (
                                <button
                                    type="button"
                                    className="bqm-kpi-hide-btn"
                                    title={effectiveVisibility.total_approved ? 'Unhide value' : 'Hide value'}
                                    aria-label={effectiveVisibility.total_approved ? 'Unhide approved booking count' : 'Hide approved booking count'}
                                    onClick={() => handleToggleInsight('total_approved')}
                                >
                                    {effectiveVisibility.total_approved ? <EyeOutlined /> : <LockOutlined />}
                                </button>
                            )}
                            <div className="bqm-kpi-icon blue"><CheckCircleOutlined /></div>
                            <div className="bqm-kpi-stats">
                                <div className="bqm-kpi-value">
                                    {effectiveVisibility.total_approved
                                        ? <span className="bqm-kpi-masked-value">{maskMatchingValue(safeNumber(approvedBookingsCount))}</span>
                                        : safeNumber(approvedBookingsCount)}
                                </div>
                                <div className="bqm-kpi-label">Approved Booking</div>
                            </div>
                        </div>

                        {/* ============ Pending Approvals ============ */}
                        <div className="bqm-kpi-card">
                            <div className="bqm-kpi-icon orange"><ClockCircleOutlined /></div>
                            <div className="bqm-kpi-stats">
                                <div className="bqm-kpi-value">{safeNumber(stats.pending_approvals)}</div>
                                <div className="bqm-kpi-label">Pending Approvals</div>
                            </div>
                        </div>

                        {/* ============ Total Revenue ============ */}
                        <div className="bqm-kpi-card bqm-kpi-card-hideable">
                            {canToggleInsightVisibility && (
                                <button
                                    type="button"
                                    className="bqm-kpi-hide-btn"
                                    title={effectiveVisibility.total_revenue ? 'Unhide value' : 'Hide value'}
                                    aria-label={effectiveVisibility.total_revenue ? 'Unhide total revenue' : 'Hide total revenue'}
                                    onClick={() => handleToggleInsight('total_revenue')}
                                >
                                    {effectiveVisibility.total_revenue ? <EyeOutlined /> : <LockOutlined />}
                                </button>
                            )}
                            <div className="bqm-kpi-icon green"><WalletOutlined /></div>
                            <div className="bqm-kpi-stats">
                                <div className="bqm-kpi-value">
                                    {effectiveVisibility.total_revenue
                                        ? <span className="bqm-kpi-masked-value">{maskMatchingValue(formatCurrency(approvedRevenue))}</span>
                                        : formatCurrency(approvedRevenue)}
                                </div>
                                <div className="bqm-kpi-label">Total Revenue</div>
                            </div>
                        </div>

                        {/* ============ Rejected ============ */}
                        <div className="bqm-kpi-card bqm-kpi-card-hideable">
                            {canToggleInsightVisibility && (
                                <button
                                    type="button"
                                    className="bqm-kpi-hide-btn"
                                    title={effectiveVisibility.rejected ? 'Unhide value' : 'Hide value'}
                                    aria-label={effectiveVisibility.rejected ? 'Unhide rejected count' : 'Hide rejected count'}
                                    onClick={() => handleToggleInsight('rejected')}
                                >
                                    {effectiveVisibility.rejected ? <EyeOutlined /> : <LockOutlined />}
                                </button>
                            )}
                            <div className="bqm-kpi-icon red"><CloseCircleOutlined /></div>
                            <div className="bqm-kpi-stats">
                                <div className="bqm-kpi-value">
                                    {effectiveVisibility.rejected
                                        ? <span className="bqm-kpi-masked-value">{maskMatchingValue(safeNumber(rejectedBookingsCount))}</span>
                                        : safeNumber(rejectedBookingsCount)}
                                </div>
                                <div className="bqm-kpi-label">Rejected</div>
                            </div>
                        </div>
                    </div>
                    <Card className={mainCardClass} variant="borderless">
                        <Tabs
                            activeKey={activeMainTab}
                            onChange={setActiveMainTab}
                            className="bqm-tabs"
                            items={[
                                {
                                    key: 'bookings',
                                    label: <span><CalendarOutlined /> Bookings</span>,
                                    children: (
                                        <>
                                            <div className={filtersClass}>
                                                <div className={filterGroupClass}><FilterOutlined /><Select value={filterStatus} onChange={(value) => { setFilterStatus(value); }} className="bqm-filter-select" placeholder="Status">{bookingStatusOptions.map((option) => (<Option key={option.value} value={option.value}>{option.label}</Option>))}</Select></div>

                                                <div className={filterGroupClass}>
                                                    <CalendarOutlined />
                                                    <RangePicker
                                                        value={filterDateRange}
                                                        onChange={(value) => {
                                                            setFilterDateRange(value || []);
                                                        }}
                                                        format="YYYY-MM-DD"
                                                        allowClear
                                                        className="bqm-date-picker"
                                                        placeholder={['Start Date', 'End Date']}
                                                        style={{ minWidth: 220 }}
                                                    />
                                                </div>

                                                <div className={filterGroupClass}><AppstoreOutlined /><Select value={filterEventType} onChange={(value) => { setFilterEventType(value); }} className="bqm-filter-select" placeholder="Event Type"><Option value="all">All Event Types</Option>{eventTypes.map((eventType) => (<Option key={eventType.event_type_id || eventType.id} value={eventType.event_type_id || eventType.id}>{eventType.name}</Option>))}</Select></div>
                                                <div className={`${filterGroupClass} bqm-search`}><SearchOutlined /><Input value={searchText} onChange={(event) => { setSearchText(event.target.value); }} placeholder="Search booking or customer..." allowClear className="bqm-search-input" /></div>
                                                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateBookingModal}>Create Booking</Button>
                                            </div>
                                            <Tabs
                                                activeKey={activeBookingTab}
                                                onChange={setActiveBookingTab}
                                                className="bqm-inner-tabs"
                                                    items={[
                                                        {
                                                            key: 'regular',
                                                            label: <span><ForkOutlined /> Regular Bookings <Badge count={regularBookingsTotal} overflowCount={999} /></span>,
                                                            children: (
                                                                                                                               <div className="bqm-scrollable-table-wrapper">
                                                                                                                                  <Table
                                                                        columns={regularBookingColumns}
                                                                        dataSource={regularBookings}
                                                                        loading={regularBookingsLoading}
                                                                        rowKey={(record) => getBookingId(record)}
                                                                        className={tableClass}
                                                                        scroll={{ x: 1400, y: TABLE_SCROLL_HEIGHT }}
                                                                        pagination={false}
                                                                        bordered={false}
                                                                        size="middle"
                                                                        // ⭐ Red row border for the 3-day warning
                                                                        //    and deposit-deadline-passed conditions.
                                                                        rowClassName={(record) => getBookingRowDecorations(record).className}
                                                                        // ⭐ Hover anywhere on the row → tooltip
                                                                        onRow={(record) => {
                                                                            const { title } = getBookingRowDecorations(record);
                                                                            if (!title) return {};
                                                                            return {
                                                                                title, // native browser tooltip fallback
                                                                                style: { cursor: 'help' },
                                                                            };
                                                                        }}
                                                                        footer={() => (
                                                                            <div className="bqm-table-footer-info">
                                                                                <span>Showing {regularBookings.length} regular bookings</span>
                                                                                <span className="bqm-footer-divider">|</span>
                                                                                <span>Total Amount: {formatCurrency(regularBookings.reduce((sum, b) => sum + safeNumber(b.total_amount), 0))}</span>
                                                                            </div>
                                                                        )}
                                                                    />
                                                                </div>
                                                            )
                                                        },
                                                        {
                                                            key: 'multi_day',
                                                            label: <span><ScheduleOutlined /> Multi-Day Events <Badge count={multiDayBookingsTotal} overflowCount={999} /></span>,
                                                            children: (
                                                                                                                               <div className="bqm-scrollable-table-wrapper">
                                                                                                                                   <Table
                                                                        columns={multiDayColumns}
                                                                        dataSource={multiDayBookings}
                                                                        loading={multiDayBookingsLoading}
                                                                        rowKey={(record) => getBookingId(record)}
                                                                        className={tableClass}
                                                                        scroll={{ x: 1400, y: TABLE_SCROLL_HEIGHT }}
                                                                        pagination={false}
                                                                        bordered={false}
                                                                        size="middle"
                                                                        // ⭐ Same red row decorations as regular table.
                                                                        rowClassName={(record) => getBookingRowDecorations(record).className}
                                                                        // ⭐ Hover anywhere on the row → tooltip
                                                                        onRow={(record) => {
                                                                            const { title } = getBookingRowDecorations(record);
                                                                            if (!title) return {};
                                                                            return {
                                                                                title, // native browser tooltip fallback
                                                                                style: { cursor: 'help' },
                                                                            };
                                                                        }}
                                                                        footer={() => (
                                                                            <div className="bqm-table-footer-info">
                                                                                <span>Showing {multiDayBookings.length} multi-day events</span>
                                                                                <span className="bqm-footer-divider">|</span>
                                                                                <span>Total Amount: {formatCurrency(multiDayBookings.reduce((sum, b) => sum + safeNumber(b.total_amount), 0))}</span>
                                                                            </div>
                                                                        )}
                                                                    />
                                                                </div>
                                                            )
                                                        }
                                                                                                   ]}
                                            />
                                        </>
                                    )
                                },
                                {
                                    key: 'quotations',
                                    label: <span><FileTextOutlined /> Quotations</span>,
                                    children: (
                                        <div className="bqm-tab-content">
                                            <Alert message="Quotation Management" description="Create and manage customer quotations. Approved bookings are inserted into Order Management and Event Management only after admin confirmation." type="info" showIcon className="bqm-info-alert" />
                                            <div className="bqm-scrollable-table-wrapper">
                                                                                       <Table
                                                    columns={quotationColumns}
                                                    dataSource={quotations}
                                                    loading={quotationsLoading}
                                                    rowKey={(record) => record.id}
                                                    className={tableClass}
                                                    scroll={{ x: 1100, y: TABLE_SCROLL_HEIGHT }}
                                                    pagination={false}
                                                    bordered={false}
                                                    size="middle"
                                                    footer={() => (
                                                        <div className="bqm-table-footer-info">
                                                            <span>Showing {quotations.length} quotations</span>
                                                            <span className="bqm-footer-divider">|</span>
                                                            <span>Total Amount: {formatCurrency(quotations.reduce((sum, q) => sum + safeNumber(q.total_amount), 0))}</span>
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )
                                },
                                ...(canApproveOperations ? [{
                                    key: 'refund-requests',
                                    label: (
                                        <span>
                                            <DollarOutlined /> Refund Requests
                                            {refundRequestsPendingCount > 0 && (
                                                <Badge
                                                    count={refundRequestsPendingCount}
                                                    overflowCount={99}
                                                    style={{ marginLeft: 6 }}
                                                />
                                            )}
                                        </span>
                                    ),
                                    children: (
                                        <div className="bqm-tab-content">
                                            <Alert
                                                message="Cashier Cancellation & Refund Requests"
                                                description={
                                                    <span>
                                                        All cancellation/refund requests submitted by cashiers appear here.
                                                        Approve or reject pending requests, and monitor approved refunds
                                                        awaiting cashier release.
                                                    </span>
                                                }
                                                type="warning"
                                                showIcon
                                                className="bqm-info-alert"
                                                style={{ marginBottom: 16 }}
                                            />

                                            <div className={filtersClass} style={{ marginBottom: 12 }}>
                                                <Space size="middle" wrap>
                                                    <Tag color="orange">
                                                        Pending: {refundRequestsPendingCount}
                                                    </Tag>
                                                    <Tag color="blue">
                                                        Approved (awaiting cashier): {refundRequestsApprovedCount}
                                                    </Tag>
                                                    <Tag color="default">
                                                        Total: {refundRequests.length}
                                                    </Tag>
                                                </Space>
                                            </div>

                                            <div className="bqm-scrollable-table-wrapper">
                                                <Table
                                                    columns={refundRequestColumns}
                                                    dataSource={refundRequests}
                                                    rowKey={(record) => getBookingId(record)}
                                                    className={tableClass}
                                                    scroll={{ x: 1200, y: TABLE_SCROLL_HEIGHT }}
                                                    pagination={false}
                                                    bordered={false}
                                                    size="middle"
                                                    locale={{
                                                        emptyText: (
                                                            <Empty
                                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                                description="No refund requests at the moment."
                                                            />
                                                        ),
                                                    }}
                                                    footer={() => (
                                                        <div className="bqm-table-footer-info">
                                                            <span>Showing {refundRequests.length} refund requests</span>
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ),
                                }] : []),
                                {
                                    key: 'history',
                                    label: <span><CheckCircleOutlined /> Booking History</span>,
                                    children: (
                                        <div className="bqm-tab-content">
                                            <Alert
                                                message="Completed & Cancelled Booking History"
                                                description="Bookings marked as completed or cancelled are removed from the active tables and stored here for review."
                                                type="success"
                                                showIcon
                                                className="bqm-info-alert"
                                            />
                                            <div className={`${filtersClass} bqm-history-filters`}>
                                                <div className={filterGroupClass}><SearchOutlined /><Input value={historySearchText} onChange={(event) => { setHistorySearchText(event.target.value); }} placeholder="Quick search..." allowClear className="bqm-search-input" /></div>
                                                <div className={filterGroupClass}><FileTextOutlined /><Input value={historyBookingId} onChange={(event) => { setHistoryBookingId(event.target.value); }} placeholder="Booking ID" allowClear className="bqm-search-input" /></div>
                                                <div className={filterGroupClass}><UserOutlined /><Input value={historyCustomerName} onChange={(event) => { setHistoryCustomerName(event.target.value); }} placeholder="Customer Name" allowClear className="bqm-search-input" /></div>
                                                <div className={filterGroupClass}><FilterOutlined /><Select value={historyStatus} onChange={(value) => { setHistoryStatus(value); }} className="bqm-filter-select" placeholder="Booking Status">{bookingStatusOptions.map((option) => (<Option key={option.value} value={option.value}>{option.label}</Option>))}</Select></div>
                                                <div className={filterGroupClass}><AppstoreOutlined /><Select value={historyEventType} onChange={(value) => { setHistoryEventType(value); }} className="bqm-filter-select" placeholder="Event Type"><Option value="all">All Event Types</Option>{eventTypes.map((eventType) => (<Option key={eventType.event_type_id || eventType.id} value={eventType.event_type_id || eventType.id}>{eventType.name}</Option>))}</Select></div>
                                                <div className={filterGroupClass}><CalendarOutlined /><RangePicker value={historyDateRange} onChange={(value) => { setHistoryDateRange(value || []); }} format="YYYY-MM-DD" allowClear className="bqm-date-picker" placeholder={['Start Date', 'End Date']} /></div>
                                            </div>
                                            <div className="bqm-scrollable-table-wrapper">
                                                                                        <Table
                                                    columns={historyColumns}
                                                    dataSource={completedBookings}
                                                    loading={completedBookingsLoading}
                                                    rowKey={(record) => getBookingId(record)}
                                                    className={tableClass}
                                                    scroll={{ x: 1100, y: TABLE_SCROLL_HEIGHT }}
                                                    pagination={false}
                                                    bordered={false}
                                                    size="middle"
                                                    footer={() => (
                                                        <div className="bqm-table-footer-info">
                                                            <span>Showing {completedBookings.length} history records</span>
                                                            <span className="bqm-footer-divider">|</span>
                                                            <span>Total Amount: {formatCurrency(completedBookings.reduce((sum, b) => sum + safeNumber(b.total_amount), 0))}</span>
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    key: 'calendar',
                                    label: <span><ScheduleOutlined /> Calendar</span>,
                                    children: (
                                        <div className="bqm-tab-content bqm-calendar-tab-content">
                                            <div className="bqm-calendar-toolbar bqm-calendar-toolbar-compact">
                                                <div>
                                                    <Text strong>Event Calendar & Date Availability</Text>
                                                    <div>
                                                        <Text type="secondary">
                                                            <EditOutlined /> Click any date to edit availability (Available, Limited Slots, Fully Booked, or Unavailable)
                                                        </Text>
                                                    </div>
                                                </div>
                                                <Text type="secondary" className="bqm-calendar-header-note">
                                                    Use the calendar header to change month or year.
                                                </Text>
                                            </div>

                                            <div className="bqm-calendar-legend">
                                                <div className="bqm-legend-item">
                                                    <span className="bqm-legend-color available"></span>
                                                    <span>Available</span>
                                                </div>
                                                <div className="bqm-legend-item">
                                                    <span className="bqm-legend-color limited"></span>
                                                    <span>Limited Slots</span>
                                                </div>
                                                <div className="bqm-legend-item">
                                                    <span className="bqm-legend-color fully-booked"></span>
                                                    <span>Fully Booked</span>
                                                </div>
                                                <div className="bqm-legend-item">
                                                    <span className="bqm-legend-color unavailable"></span>
                                                    <span>Unavailable</span>
                                                </div>
                                                <div className="bqm-legend-item">
                                                    <span className="bqm-legend-color event"></span>
                                                    <span>Has Events</span>
                                                </div>
                                                <div className="bqm-legend-item">
                                                    <span className="bqm-legend-color clickable"></span>
                                                    <span>Click to Edit</span>
                                                </div>
                                            </div>

                                            <div className="bqm-calendar-wrapper bqm-calendar-wrapper-compact" style={{ overflow: 'auto' }}>
                                                <Calendar
                                                    value={calendarCursor}
                                                    mode={calendarMode}
                                                    cellRender={dateCellRender}
                                                    onPanelChange={(dateValue, mode) => {
                                                        setCalendarCursor(dateValue);
                                                        setCalendarMode(mode);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                }
                            ]}
                        />
                    </Card>

                    {/* THREE-DAY WARNING MODAL */}
                    <Modal
                        title={null}
                        open={threeDayWarningModalVisible}
                        onCancel={handleThreeDayWarningCancel}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={620}
                                             className="bqm-modal-clean bqm-pro-modal bqm-three-day-warning-modal"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        closable={true}
                    >
                        <div className="bqm-pro-modal-shell">
                            <div className="bqm-pro-modal-header bqm-pro-header-warning">
                                <div className="bqm-pro-modal-icon">
                                    <WarningOutlined />
                                </div>
                                <div className="bqm-pro-modal-header-text">
                                    <div className="bqm-pro-modal-eyebrow">Approval Deadline</div>
                                    <div className="bqm-pro-modal-title">Event is Within 3 Days</div>
                                    <div className="bqm-pro-modal-subtitle">
                                        This booking is very close to the event date. Please review before approving.
                                    </div>
                                </div>
                            </div>

                            <div className="bqm-pro-modal-body">
                                <div className="bqm-pro-highlight-card bqm-pro-highlight-warning">
                                    <div className="bqm-pro-highlight-message">
                                        <FireOutlined />
                                        <span>
                                            Approving will insert this booking into <strong>Orders &amp; Events</strong> immediately.
                                            Make sure all preparations can be completed in time.
                                        </span>
                                    </div>
                                </div>

                                <div className="bqm-pro-info-grid">
                                    <div className="bqm-pro-info-row">
                                        <span className="bqm-pro-info-label">Booking No.</span>
                                        <span className="bqm-pro-info-value bqm-mono">{safeString(threeDayWarningBooking?.booking_no)}</span>
                                    </div>
                                    <div className="bqm-pro-info-row">
                                        <span className="bqm-pro-info-label">Customer</span>
                                        <span className="bqm-pro-info-value">{safeString(threeDayWarningBooking?.customer_name)}</span>
                                    </div>
                                    <div className="bqm-pro-info-row">
                                        <span className="bqm-pro-info-label">Event Date</span>
                                        <span className="bqm-pro-info-value bqm-highlight">
                                            {formatDateSafe(threeDayWarningBooking?.event_date)}
                                        </span>
                                    </div>
                                    <div className="bqm-pro-info-row">
                                        <span className="bqm-pro-info-label">Days Remaining</span>
                                        <span className="bqm-pro-info-value bqm-countdown">
                                            {getDaysUntilEvent(threeDayWarningBooking)} day(s)
                                        </span>
                                    </div>
                                    <div className="bqm-pro-info-row bqm-pro-info-full">
                                        <span className="bqm-pro-info-label">Venue</span>
                                        <span className="bqm-pro-info-value">{getBookingLocation(threeDayWarningBooking)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bqm-pro-modal-footer">
                                <Button
                                    onClick={handleThreeDayWarningCancel}
                                    size="large"
                                    className="bqm-pro-btn-secondary"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={handleThreeDayWarningApprove}
                                    icon={<CheckCircleOutlined />}
                                    size="large"
                                    className="bqm-pro-btn-primary bqm-pro-btn-warning"
                                >
                                    Proceed with Approval
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* LATE BOOKING APPROVAL MODAL */}
                    <Modal
                        title={null}
                        open={lateApprovalModalVisible}
                        onCancel={closeLateBookingApprovalModal}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={720}
                                      className="bqm-modal-clean bqm-formal-modal bqm-late-approval-modal"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        closable={true}
                        centered
                    >
                        <div className="bqm-formal-shell">
                            <div className="bqm-formal-header bqm-formal-header--warning">
                                <div className="bqm-formal-header-icon">
                                    <WarningOutlined />
                                </div>
                                <div className="bqm-formal-header-body">
                                    <div className="bqm-formal-eyebrow">
                                        Booking Reference · {safeString(lateApprovalBooking?.booking_no)}
                                    </div>
                                    <h2 className="bqm-formal-title">Late Booking — Deposit Decision</h2>
                                    <p className="bqm-formal-subtitle">
                                        This booking was created inside the deposit window.
                                        Choose how to handle the deposit before confirming.
                                    </p>
                                </div>
                                <div className="bqm-formal-stamp bqm-formal-stamp--amber">
                                    <span className="bqm-formal-stamp-label">Days to Event</span>
                                    <span className="bqm-formal-stamp-value">
                                        {getDaysUntilEvent(lateApprovalBooking) ?? 0}
                                    </span>
                                </div>
                            </div>

                            <div className="bqm-formal-body">
                                <div className="bqm-formal-strip">
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Customer</span>
                                        <span className="bqm-formal-strip-value">
                                            {safeString(lateApprovalBooking?.customer_name)}
                                        </span>
                                    </div>
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Event Date</span>
                                        <span className="bqm-formal-strip-value">
                                            {formatDateSafe(lateApprovalBooking?.event_date)}
                                        </span>
                                    </div>
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Deposit Window</span>
                                        <span className="bqm-formal-strip-value">
                                            {getDepositPaymentDays(lateApprovalBooking)} days
                                        </span>
                                    </div>
                                </div>

                                <div className="bqm-formal-section">
                                    <div className="bqm-formal-section-head">
                                        <span className="bqm-formal-section-index">01</span>
                                        <span className="bqm-formal-section-title">Deposit Decision</span>
                                        <span className="bqm-formal-chip bqm-formal-chip--restricted">
                                            Restricted · Admin
                                        </span>
                                    </div>

                                    <div className="bqm-formal-choicegrid">
                                        <Radio.Group
                                            onChange={(e) => setLateApprovalAction(e.target.value)}
                                            className="bqm-formal-choicegrid-inner"
                                            value={lateApprovalAction}
                                        >
                                            <Radio.Button
                                                value="waive"
                                                className="bqm-formal-choice bqm-formal-choice--success"
                                            >
                                                <span className="bqm-formal-choice-label">Waive Deposit</span>
                                                <span className="bqm-formal-choice-hint">
                                                    Skip the deposit — proceed with full payment due
                                                </span>
                                            </Radio.Button>
                                            <Radio.Button
                                                value="extend"
                                                className="bqm-formal-choice bqm-formal-choice--info"
                                            >
                                                <span className="bqm-formal-choice-label">Extend Deadline</span>
                                                <span className="bqm-formal-choice-hint">
                                                    Give the customer extra days to pay
                                                </span>
                                            </Radio.Button>
                                        </Radio.Group>
                                    </div>

                                    {lateApprovalAction === 'waive' && (
                                        <div className="bqm-formal-panel bqm-formal-panel--success">
                                            <div className="bqm-formal-panel-head">
                                                <CheckCircleOutlined />
                                                <span>Deposit Requirement Waived</span>
                                            </div>
                                            <p className="bqm-formal-panel-text">
                                                The booking will be confirmed without requiring a deposit.
                                                The full amount becomes due per the standard payment schedule.
                                            </p>
                                        </div>
                                    )}

                                    {lateApprovalAction === 'extend' && (
                                        <div className="bqm-formal-panel bqm-formal-panel--info">
                                            <div className="bqm-formal-panel-head">
                                                <ScheduleOutlined />
                                                <span>Extension Details</span>
                                            </div>
                                            <div className="bqm-formal-panel-text" style={{ marginBottom: 12 }}>
                                                New deposit deadline will be set to <strong>today + {safeNumber(lateApprovalExtensionDays, 7)} day(s)</strong>.
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <InputNumber
                                                    min={1}
                                                    max={90}
                                                    size="large"
                                                    style={{ width: 160 }}
                                                    value={lateApprovalExtensionDays}
                                                    onChange={(value) => setLateApprovalExtensionDays(safeNumber(value, 7))}
                                                    placeholder="Days"
                                                />
                                                <Text type="secondary">day(s) from today</Text>
                                            </div>
                                        </div>
                                    )}

                                    <Form layout="vertical" className="bqm-formal-form" style={{ marginTop: 16 }}>
                                        <Form.Item label="Internal Note (Optional)" style={{ marginBottom: 0 }}>
                                            <TextArea
                                                rows={2}
                                                maxLength={500}
                                                showCount
                                                value={lateApprovalNotes}
                                                onChange={(e) => setLateApprovalNotes(e.target.value)}
                                                placeholder="Optional — recorded in the audit trail"
                                            />
                                        </Form.Item>
                                    </Form>
                                </div>
                            </div>

                            <div className="bqm-formal-footer bqm-formal-footer--split">
                                <div className="bqm-formal-footer-left">
                                    <Button
                                        size="large"
                                        className="bqm-formal-btn bqm-formal-btn--ghost"
                                        onClick={closeLateBookingApprovalModal}
                                        disabled={lateApprovalSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                                <div className="bqm-formal-footer-right">
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<CheckCircleOutlined />}
                                        loading={lateApprovalSubmitting}
                                        onClick={handleLateBookingApproval}
                                        className={
                                            lateApprovalAction === 'waive'
                                                ? 'bqm-formal-btn bqm-formal-btn--success'
                                                : 'bqm-formal-btn bqm-formal-btn--info'
                                        }
                                    >
                                        {lateApprovalAction === 'waive'
                                            ? 'Approve & Waive Deposit'
                                            : 'Approve & Extend Deadline'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Modal>

                    {/* LATE CANCELLATION NOTICE */}
                    <Modal
                        title={null}
                        open={cancelWithRefundModalVisible}
                        onCancel={closeCancelWithRefundModal}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={canApproveOperations ? 840 : 560}
                                         className="bqm-modal-clean bqm-formal-modal bqm-lc-sheet"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        closable={true}
                        centered
                    >
                        <div className="bqm-formal-shell">
                            <div className="bqm-formal-header bqm-formal-header--warning">
                                <div className="bqm-formal-header-icon">
                                    <WarningOutlined />
                                </div>
                                <div className="bqm-formal-header-body">
                                    <div className="bqm-formal-eyebrow">
                                        Booking Reference · {safeString(selectedBooking?.booking_no)}
                                    </div>
                                    <h2 className="bqm-formal-title">
                                        {canApproveOperations
                                            ? 'Late Cancellation Notice'
                                            : 'Cancellation Request'}
                                    </h2>
                                    <p className="bqm-formal-subtitle">
                                        {canApproveOperations
                                            ? `Policy window: ${getCancellationCutoffDays(selectedBooking)} days before event.`
                                            : 'Your request will be reviewed by an administrator.'}
                                    </p>
                                </div>
                                <div className="bqm-formal-stamp">
                                    <span className="bqm-formal-stamp-label">Days to Event</span>
                                    <span className="bqm-formal-stamp-value">
                                        {getDaysUntilEvent(selectedBooking)}
                                    </span>
                                </div>
                            </div>

                            <div className="bqm-formal-body">
                                {renderLateCancellationStrip(selectedBooking)}

                                {canApproveOperations
                                    ? renderAdminDecisionSheet()
                                    : renderCashierRequestForm()}
                            </div>

                            <div className="bqm-formal-footer">
                                <div className="bqm-formal-footer-note">
                                    Recorded to the booking audit trail upon submission.
                                </div>
                                <Button
                                    size="large"
                                    className="bqm-formal-btn bqm-formal-btn--ghost"
                                    onClick={closeCancelWithRefundModal}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* DEPOSIT OVERDUE MODAL */}
                    <Modal
                        title={null}
                        open={depositOverdueModalVisible}
                        onCancel={closeDepositOverdueModal}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={720}
                                           className="bqm-modal-clean bqm-formal-modal bqm-deposit-overdue-modal"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        closable={true}
                        centered
                    >
                        <div className="bqm-formal-shell">
                            <div className="bqm-formal-header bqm-formal-header--danger">
                                <div className="bqm-formal-header-icon">
                                    <WarningOutlined />
                                </div>
                                <div className="bqm-formal-header-body">
                                    <div className="bqm-formal-eyebrow">
                                        Booking Reference · {safeString(depositOverdueBooking?.booking_no)}
                                    </div>
                                    <h2 className="bqm-formal-title">Deposit Overdue</h2>
                                    <p className="bqm-formal-subtitle">
                                        The deposit deadline has passed. Choose how to resolve this booking.
                                    </p>
                                </div>
                                <div className="bqm-formal-stamp bqm-formal-stamp--danger">
                                    <span className="bqm-formal-stamp-label">Due Date</span>
                                    <span className="bqm-formal-stamp-value" style={{ fontSize: 14 }}>
                                        {formatDateSafe(depositOverdueBooking?.deposit_due_date, 'MMM DD')}
                                    </span>
                                </div>
                            </div>

                            <div className="bqm-formal-body">
                                <div className="bqm-formal-strip">
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Customer</span>
                                        <span className="bqm-formal-strip-value">
                                            {safeString(depositOverdueBooking?.customer_name)}
                                        </span>
                                    </div>
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Event Date</span>
                                        <span className="bqm-formal-strip-value">
                                            {formatDateSafe(depositOverdueBooking?.event_date)}
                                        </span>
                                    </div>
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Days to Event</span>
                                        <span className="bqm-formal-strip-value bqm-highlight">
                                            {getDaysUntilEvent(depositOverdueBooking)} day(s)
                                        </span>
                                    </div>
                                </div>

                                <div className="bqm-formal-section">
                                    <div className="bqm-formal-section-head">
                                        <span className="bqm-formal-section-index">01</span>
                                        <span className="bqm-formal-section-title">Administrative Decision</span>
                                        <span className="bqm-formal-chip bqm-formal-chip--restricted">
                                            Restricted · Admin
                                        </span>
                                    </div>

                                    <Form
                                        form={depositDecisionForm}
                                        layout="vertical"
                                        className="bqm-formal-form"
                                        initialValues={{
                                            action: 'extend',
                                            extension_days: 7,
                                            notes: '',
                                            refund_amount: 0,
                                            refund_method: 'cash',
                                            refund_reference: '',
                                        }}
                                    >
                                        <div className="bqm-formal-choicegrid">
                                            <Radio.Group
                                                onChange={(e) => setDepositDecisionAction(e.target.value)}
                                                className="bqm-formal-choicegrid-inner"
                                                value={depositDecisionAction}
                                            >
                                                <Radio.Button value="extend" className="bqm-formal-choice bqm-formal-choice--info">
                                                    <span className="bqm-formal-choice-label">Extend Deadline</span>
                                                    <span className="bqm-formal-choice-hint">
                                                        Give the customer more time to pay
                                                    </span>
                                                </Radio.Button>
                                                <Radio.Button value="waive" className="bqm-formal-choice bqm-formal-choice--success">
                                                    <span className="bqm-formal-choice-label">Waive Deposit</span>
                                                    <span className="bqm-formal-choice-hint">
                                                        Keep booking confirmed
                                                    </span>
                                                </Radio.Button>
                                                <Radio.Button value="cancel" className="bqm-formal-choice bqm-formal-choice--danger">
                                                    <span className="bqm-formal-choice-label">Cancel Booking</span>
                                                    <span className="bqm-formal-choice-hint">
                                                        Terminate and optionally refund
                                                    </span>
                                                </Radio.Button>
                                            </Radio.Group>
                                        </div>

                                        {depositDecisionAction === 'extend' && (
                                            <div className="bqm-formal-panel bqm-formal-panel--info">
                                                <div className="bqm-formal-panel-head">
                                                    <ScheduleOutlined />
                                                    <span>Extension Details</span>
                                                </div>
                                                <Form.Item
                                                    name="extension_days"
                                                    label="Extend By (Days)"
                                                    rules={[
                                                        { required: true, message: 'Please enter the extension days.' },
                                                        { type: 'number', min: 1, max: 90, message: 'Between 1 and 90 days.' },
                                                    ]}
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <InputNumber
                                                        min={1}
                                                        max={90}
                                                        size="large"
                                                        style={{ width: '100%' }}
                                                        placeholder="Number of days"
                                                    />
                                                </Form.Item>
                                            </div>
                                        )}

                                        {depositDecisionAction === 'waive' && (
                                            <div className="bqm-formal-panel bqm-formal-panel--success">
                                                <div className="bqm-formal-panel-head">
                                                    <CheckCircleOutlined />
                                                    <span>Deposit Requirement Waived</span>
                                                </div>
                                                <p className="bqm-formal-panel-text">
                                                    The booking remains confirmed. No deposit will be collected
                                                    from the customer.
                                                </p>
                                            </div>
                                        )}

                                        {depositDecisionAction === 'cancel' && (
                                            <div className="bqm-formal-panel bqm-formal-panel--danger">
                                                <div className="bqm-formal-panel-head">
                                                    <DollarOutlined />
                                                    <span>Refund Instructions</span>
                                                </div>
                                                <Row gutter={12}>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="refund_amount"
                                                            label="Refund Amount"
                                                            rules={[
                                                                { required: true, message: 'Enter the refund amount (0 for none).' },
                                                                { type: 'number', min: 0, message: 'Cannot be negative.' },
                                                            ]}
                                                            tooltip="Enter 0 for cancel without refund."
                                                        >
                                                            <InputNumber
                                                                min={0}
                                                                step={0.01}
                                                                size="large"
                                                                style={{ width: '100%' }}
                                                                placeholder="0.00"
                                                                formatter={(v) => `₱ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                                parser={(v) => v?.replace(/₱\s?|(,*)/g, '')}
                                                            />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item name="refund_method" label="Disbursement Method">
                                                            <Select size="large">
                                                                <Option value="cash">Cash</Option>
                                                                <Option value="gcash">GCash</Option>
                                                                <Option value="maya">Maya</Option>
                                                                <Option value="bank_transfer">Bank Transfer</Option>
                                                                <Option value="card">Card</Option>
                                                                <Option value="check">Check</Option>
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                </Row>
                                                <Form.Item
                                                    name="refund_reference"
                                                    label="Reference Number"
                                                    tooltip="Bank ref, GCash ref, cheque number, etc."
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <Input size="large" placeholder="Optional" />
                                                </Form.Item>
                                            </div>
                                        )}

                                        <Form.Item
                                            name="notes"
                                            label="Internal Note"
                                            style={{ marginTop: 16, marginBottom: 16 }}
                                        >
                                            <TextArea
                                                rows={2}
                                                placeholder="Optional — recorded in the audit log"
                                                maxLength={500}
                                                showCount
                                            />
                                        </Form.Item>

                                        <Button
                                            type="primary"
                                            block
                                            size="large"
                                            icon={<CheckCircleOutlined />}
                                            className={
                                                depositDecisionAction === 'extend'
                                                    ? 'bqm-formal-btn bqm-formal-btn--info'
                                                    : depositDecisionAction === 'waive'
                                                        ? 'bqm-formal-btn bqm-formal-btn--success'
                                                        : 'bqm-formal-btn bqm-formal-btn--danger'
                                            }
                                            onClick={() => {
                                                depositDecisionForm.validateFields()
                                                    .then((values) => {
                                                        return handleDepositDecision({
                                                            ...values,
                                                            action: depositDecisionAction,
                                                        });
                                                    })
                                                    .catch((err) => {
                                                        console.error('Deposit decision validation failed:', err);
                                                        if (err?.errorFields?.length > 0) {
                                                            message.error('Please fill in the required fields.');
                                                        }
                                                    });
                                            }}
                                        >
                                            {depositDecisionAction === 'extend'
                                                ? 'Confirm Extension'
                                                : depositDecisionAction === 'waive'
                                                    ? 'Confirm Waiver'
                                                    : 'Confirm Cancellation & Refund'}
                                        </Button>
                                    </Form>
                                </div>
                            </div>

                            <div className="bqm-formal-footer">
                                <div className="bqm-formal-footer-note">
                                    Recorded to the booking audit trail upon submission.
                                </div>
                                <Button
                                    size="large"
                                    className="bqm-formal-btn bqm-formal-btn--ghost"
                                    onClick={closeDepositOverdueModal}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* REFUND REQUEST — TREASURY REVIEW SHEET */}
                    <Modal
                        title={null}
                        open={refundApprovalModalVisible}
                        onCancel={() => {
                            setRefundApprovalModalVisible(false);
                            refundApprovalForm.resetFields();
                            setRefundApprovalAction('with_refund');
                        }}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={720}
                                            className="bqm-modal-clean bqm-formal-modal bqm-refund-review-sheet"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        closable={true}
                        centered
                    >
                        <div className="bqm-formal-shell">
                            <div className="bqm-formal-header bqm-formal-header--amber">
                                <div className="bqm-formal-header-icon">
                                    <DollarOutlined />
                                </div>
                                <div className="bqm-formal-header-body">
                                    <div className="bqm-formal-eyebrow">
                                        Booking Reference · {safeString(refundApprovalBooking?.booking_no)}
                                    </div>
                                    <h2 className="bqm-formal-title">Cashier Cancellation Request</h2>
                                    <p className="bqm-formal-subtitle">
                                        Review the reason below, then choose how to handle this request.
                                    </p>
                                </div>
                                <div className="bqm-formal-stamp bqm-formal-stamp--amber">
                                    <span className="bqm-formal-stamp-label">Status</span>
                                    <span className="bqm-formal-stamp-value">Pending</span>
                                </div>
                            </div>

                            <div className="bqm-formal-body">
                                <div className="bqm-formal-strip">
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Customer</span>
                                        <span className="bqm-formal-strip-value">
                                            {safeString(refundApprovalBooking?.customer_name)}
                                        </span>
                                    </div>
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Event Date</span>
                                        <span className="bqm-formal-strip-value">
                                            {formatDateSafe(refundApprovalBooking?.event_date)}
                                        </span>
                                    </div>
                                    <div className="bqm-formal-strip-item">
                                        <span className="bqm-formal-strip-label">Deposit on File</span>
                                        <span className="bqm-formal-strip-value bqm-formal-strip-value--money">
                                            {formatCurrency(getDepositAmount(refundApprovalBooking))}
                                        </span>
                                    </div>
                                </div>

                                <div className="bqm-formal-section">
                                    <div className="bqm-formal-section-head">
                                        <span className="bqm-formal-section-index">01</span>
                                        <span className="bqm-formal-section-title">Cashier's Request</span>
                                        <span className="bqm-formal-chip bqm-formal-chip--readonly">Read Only</span>
                                    </div>

                                    <div className="bqm-formal-dossier bqm-formal-dossier--tight">
                                        <div className="bqm-formal-dossier-row">
                                            <span className="bqm-formal-dossier-label">Requested By</span>
                                            <span className="bqm-formal-dossier-value">
                                                {safeString(
                                                    refundApprovalBooking?.refund_requested_by_name
                                                    || refundApprovalBooking?.refund_requested_by
                                                    || 'Cashier',
                                                )}
                                            </span>
                                        </div>
                                        <div className="bqm-formal-dossier-row">
                                            <span className="bqm-formal-dossier-label">Requested At</span>
                                            <span className="bqm-formal-dossier-value">
                                                {formatDateSafe(
                                                    refundApprovalBooking?.refund_requested_at,
                                                    'MMM DD, YYYY • hh:mm A',
                                                )}
                                            </span>
                                        </div>
                                        <div className="bqm-formal-dossier-row bqm-formal-dossier-row--stack">
                                            <span className="bqm-formal-dossier-label">Reason</span>
                                            <span className="bqm-formal-dossier-value bqm-formal-dossier-value--block">
                                                {safeString(refundApprovalBooking?.refund_reason, '—')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bqm-formal-section">
                                    <div className="bqm-formal-section-head">
                                        <span className="bqm-formal-section-index">02</span>
                                        <span className="bqm-formal-section-title">Administrative Decision</span>
                                        <span className="bqm-formal-chip bqm-formal-chip--restricted">
                                            Restricted · Admin
                                        </span>
                                    </div>

                                    <div className="bqm-refund-choicegrid">
                                        <button
                                            type="button"
                                            className={`bqm-refund-choice bqm-refund-choice--success ${refundApprovalAction === 'with_refund' ? 'is-selected' : ''}`}
                                            onClick={() => setRefundApprovalAction('with_refund')}
                                        >
                                            <div className="bqm-refund-choice-head">
                                                <CheckCircleOutlined className="bqm-refund-choice-icon" />
                                                <span className="bqm-refund-choice-title">Approve With Refund</span>
                                            </div>
                                            <p className="bqm-refund-choice-text">
                                                Cancel the booking and refund the customer. The cashier will
                                                enter the actual amount to release.
                                            </p>
                                            <span className="bqm-refund-choice-action">
                                                {refundApprovalAction === 'with_refund' ? '✓ Selected' : 'Select'}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`bqm-refund-choice bqm-refund-choice--danger ${refundApprovalAction === 'without_refund' ? 'is-selected' : ''}`}
                                            onClick={() => setRefundApprovalAction('without_refund')}
                                        >
                                            <div className="bqm-refund-choice-head">
                                                <StopOutlined className="bqm-refund-choice-icon" />
                                                <span className="bqm-refund-choice-title">Approve Without Refund</span>
                                            </div>
                                            <p className="bqm-refund-choice-text">
                                                Cancel the booking immediately. Deposit is forfeited per policy —
                                                no amount will be released.
                                            </p>
                                            <span className="bqm-refund-choice-action">
                                                {refundApprovalAction === 'without_refund' ? '✓ Selected' : 'Select'}
                                            </span>
                                        </button>
                                    </div>

                                    {refundApprovalAction === 'with_refund' && (
                                        <div className="bqm-formal-note bqm-formal-note--success">
                                            <InfoCircleOutlined />
                                            <span>
                                                After approval, the cashier will see a <strong>Confirm Refund</strong>
                                                {' '}button on their end to enter the amount and release it.
                                            </span>
                                        </div>
                                    )}
                                    {refundApprovalAction === 'without_refund' && (
                                        <div className="bqm-formal-note bqm-formal-note--danger">
                                            <WarningOutlined />
                                            <span>
                                                The booking will be <strong>cancelled immediately</strong> when you
                                                click the confirm button below. No refund will be issued.
                                            </span>
                                        </div>
                                    )}

                                    <Form
                                        form={refundApprovalForm}
                                        layout="vertical"
                                        className="bqm-formal-form"
                                        initialValues={{ notes: '' }}
                                        style={{ marginTop: 16 }}
                                    >
                                        <Form.Item
                                            name="notes"
                                            label="Decision Note"
                                            tooltip="Optional for approval, recommended for rejection."
                                            style={{ marginBottom: 0 }}
                                        >
                                            <TextArea
                                                rows={3}
                                                placeholder="State the basis for this decision. Recorded in the audit trail."
                                                maxLength={500}
                                                showCount
                                            />
                                        </Form.Item>
                                    </Form>
                                </div>
                            </div>

                            <div className="bqm-formal-footer bqm-formal-footer--split">
                                <div className="bqm-formal-footer-left">
                                    <Button
                                        size="large"
                                        icon={<CloseCircleOutlined />}
                                        className="bqm-formal-btn bqm-formal-btn--ghost-danger"
                                        onClick={() => {
                                            const notes = refundApprovalForm.getFieldValue('notes');
                                            handleRejectRefund({
                                                reason: (notes && safeString(notes).trim())
                                                    || 'Refund request rejected by admin.',
                                            });
                                        }}
                                    >
                                        Reject Request
                                    </Button>
                                </div>

                                <div className="bqm-formal-footer-right">
                                    {refundApprovalAction === 'with_refund' ? (
                                        <Button
                                            type="primary"
                                            size="large"
                                            icon={<CheckCircleOutlined />}
                                            className="bqm-formal-btn bqm-formal-btn--success"
                                            onClick={handleApproveRefundWithRefund}
                                        >
                                            Approve With Refund
                                        </Button>
                                    ) : (
                                        <Button
                                            type="primary"
                                            danger
                                            size="large"
                                            icon={<StopOutlined />}
                                            className="bqm-formal-btn bqm-formal-btn--danger"
                                            onClick={handleApproveRefundWithoutRefund}
                                        >
                                            Approve Without Refund
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Modal>

                    {/* CONFIRM REFUND MODAL */}
                    <Modal
                        title={null}
                        open={confirmRefundModalVisible}
                        onCancel={() => {
                            setConfirmRefundModalVisible(false);
                            confirmRefundForm.resetFields();
                            setConfirmRefundBooking(null);
                        }}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                                               width={640}
                        className="bqm-modal-clean bqm-pro-modal bqm-confirm-refund-modal"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        closable={true}
                    >
                        <div className="bqm-pro-modal-shell">
                            <div className="bqm-pro-modal-header bqm-pro-header-info">
                                <div className="bqm-pro-modal-icon">
                                    <WalletOutlined />
                                </div>
                                <div className="bqm-pro-modal-header-text">
                                    <div className="bqm-pro-modal-eyebrow">
                                        Booking {safeString(confirmRefundBooking?.booking_no)}
                                    </div>
                                    <div className="bqm-pro-modal-title">Confirm Refund</div>
                                    <div className="bqm-pro-modal-subtitle">
                                        Refund approved by admin — enter the amount to release.
                                    </div>
                                </div>
                            </div>

                            <div className="bqm-pro-modal-body">
                                <div className="bqm-pro-highlight-card bqm-pro-highlight-info">
                                    <div className="bqm-pro-highlight-message">
                                        <InfoCircleOutlined />
                                        <span>
                                            Enter the <strong>actual amount</strong> you are handing back
                                            to the customer. This will be recorded as a refund payment.
                                        </span>
                                    </div>
                                </div>

                                <div className="bqm-pro-info-grid">
                                    <div className="bqm-pro-info-row">
                                        <span className="bqm-pro-info-label">Customer</span>
                                        <span className="bqm-pro-info-value">{safeString(confirmRefundBooking?.customer_name)}</span>
                                    </div>
                                    <div className="bqm-pro-info-row">
                                        <span className="bqm-pro-info-label">Event Date</span>
                                        <span className="bqm-pro-info-value">
                                            {formatDateSafe(confirmRefundBooking?.event_date)}
                                        </span>
                                    </div>
                                    <div className="bqm-pro-info-row bqm-pro-info-full">
                                        <span className="bqm-pro-info-label">Deposit on file</span>
                                        <span className="bqm-pro-info-value bqm-amount-amber">
                                            {formatCurrency(getDepositAmount(confirmRefundBooking))}
                                        </span>
                                    </div>
                                </div>

                                <Form
                                    form={confirmRefundForm}
                                    layout="vertical"
                                    className="bqm-pro-form"
                                    initialValues={{ refund_amount: 0, payment_method: 'cash', reference_number: '', notes: '' }}
                                >
                                    <div className="bqm-pro-section">
                                        <div className="bqm-pro-section-title">
                                            <span className="bqm-pro-section-number">1</span>
                                            Refund Amount
                                        </div>
                                        <Form.Item
                                            name="refund_amount"
                                            rules={[
                                                { required: true, message: 'Please enter the refund amount.' },
                                                { type: 'number', min: 0.01, message: 'Amount must be greater than 0.' },
                                            ]}
                                        >
                                            <InputNumber
                                                min={0}
                                                step={0.01}
                                                size="large"
                                                style={{ width: '100%' }}
                                                placeholder="Enter refund amount to release"
                                                formatter={(value) => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                parser={(value) => value?.replace(/₱\s?|(,*)/g, '')}
                                            />
                                        </Form.Item>
                                    </div>

                                    <div className="bqm-pro-section">
                                        <div className="bqm-pro-section-title">
                                            <span className="bqm-pro-section-number">2</span>
                                            Payment Method
                                        </div>
                                        <Row gutter={12}>
                                            <Col span={12}>
                                                <Form.Item name="payment_method" rules={[{ required: true }]}>
                                                    <Select size="large" placeholder="Select method">
                                                        <Option value="cash">Cash</Option>
                                                        <Option value="gcash">GCash</Option>
                                                        <Option value="maya">Maya</Option>
                                                        <Option value="bank_transfer">Bank Transfer</Option>
                                                        <Option value="card">Card</Option>
                                                        <Option value="check">Check</Option>
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="reference_number">
                                                    <Input
                                                        size="large"
                                                        placeholder="Reference # (optional)"
                                                    />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    </div>

                                    <div className="bqm-pro-section">
                                        <div className="bqm-pro-section-title">
                                            <span className="bqm-pro-section-number">3</span>
                                            Notes (Optional)
                                        </div>
                                        <Form.Item name="notes" style={{ marginBottom: 0 }}>
                                            <TextArea
                                                rows={2}
                                                placeholder="Notes about this refund release..."
                                                maxLength={500}
                                                showCount
                                            />
                                        </Form.Item>
                                    </div>
                                </Form>
                            </div>

                            <div className="bqm-pro-modal-footer">
                                <Button
                                    size="large"
                                    className="bqm-pro-btn-secondary"
                                    onClick={() => {
                                        setConfirmRefundModalVisible(false);
                                        confirmRefundForm.resetFields();
                                        setConfirmRefundBooking(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<CheckCircleOutlined />}
                                    className="bqm-pro-btn-success"
                                    onClick={() => {
                                        confirmRefundForm.validateFields()
                                            .then(() => handleConfirmRefund(confirmRefundForm.getFieldsValue()))
                                            .catch(() => {});
                                    }}
                                >
                                    Release Refund
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* TODAY BOOKING MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><FireOutlined style={{ color: '#f97316' }} /></div>
                                <div className="bqm-modal-title-text">Booking Scheduled for Today</div>
                            </div>
                        }
                        open={todayBookingModalVisible}
                        onCancel={() => {
                            setTodayBookingModalVisible(false);
                            setTodayBookingData(null);
                            setTodayBookingAction(null);
                        }}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={550}
                                          className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            <Alert
                                type="warning"
                                showIcon
                                message="This booking is scheduled for today"
                                description={
                                    <div>
                                        <p><strong>Booking:</strong> {safeString(todayBookingData?.booking_no)}</p>
                                        <p><strong>Customer:</strong> {safeString(todayBookingData?.customer_name)}</p>
                                        <p><strong>Event Date:</strong> {safeString(todayBookingData?.event_date)} at {safeString(todayBookingData?.event_time)}</p>
                                        <p><strong>Venue:</strong> {getBookingLocation(todayBookingData)}</p>
                                        <p style={{ marginTop: 8 }}>Do you want to approve or reject this booking?</p>
                                    </div>
                                }
                                className="bqm-warning-alert"
                            />
                            <div className="bqm-modal-buttons-clean" style={{ marginTop: 20 }}>
                                <Button onClick={() => {
                                    setTodayBookingModalVisible(false);
                                    setTodayBookingData(null);
                                    setTodayBookingAction(null);
                                }}>Cancel</Button>
                                <Button danger onClick={handleTodayBookingReject}>
                                    <CloseCircleOutlined /> Reject Booking
                                </Button>
                                <Button type="primary" onClick={handleTodayBookingApprove} icon={<CheckCircleOutlined />}>
                                    Approve Booking
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* START EVENT MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><FireOutlined style={{ color: '#10b981' }} /></div>
                                <div className="bqm-modal-title-text">Event Starts Today</div>
                            </div>
                        }
                        open={startEventModalVisible}
                        onCancel={() => {
                            setStartEventModalVisible(false);
                            setStartEventBookingData(null);
                        }}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={550}
                                             className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            <Alert
                                type="success"
                                showIcon
                                message="This confirmed booking starts today"
                                description={
                                    <div>
                                        <p><strong>Booking:</strong> {safeString(startEventBookingData?.booking_no)}</p>
                                        <p><strong>Customer:</strong> {safeString(startEventBookingData?.customer_name)}</p>
                                        <p><strong>Event Date:</strong> {safeString(startEventBookingData?.event_date)} at {safeString(startEventBookingData?.event_time)}</p>
                                        <p><strong>Venue:</strong> {getBookingLocation(startEventBookingData)}</p>
                                        <p style={{ marginTop: 8 }}>Do you want to start the event now?</p>
                                    </div>
                                }
                                className="bqm-success-alert"
                            />
                            <div className="bqm-modal-buttons-clean" style={{ marginTop: 20 }}>
                                                             <Button onClick={() => {
                                    // ⭐ REQUEST #2: Remember "Later" so this
                                    // booking never re-triggers the auto-modal.
                                    try {
                                        const key = 'auto_start_later_bookings';
                                        const prev = JSON.parse(localStorage.getItem(key) || '[]');
                                        const id = getBookingId(startEventBookingData);
                                        if (id && !prev.includes(id)) {
                                            localStorage.setItem(key, JSON.stringify([...prev, id]));
                                        }
                                    } catch (e) {
                                        console.warn('Failed to persist Later dismissal:', e);
                                    }
                                    setStartEventModalVisible(false);
                                    setStartEventBookingData(null);
                                }}>Later</Button>
                                <Button type="primary" onClick={() => handleStartEvent(startEventBookingData)} icon={<FireOutlined />}>
                                    Start Event Now
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* BOOKING DETAILS MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><EyeOutlined /></div>
                                <div className="bqm-modal-title-text">Booking Details</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                                {selectedBooking && isBookingToday(selectedBooking) && (
                                    <Tag color="orange" className="bqm-today-tag"><FireOutlined /> Today</Tag>
                                )}
                            </div>
                        }
                        open={bookingDetailsModalVisible}
                        onCancel={() => setBookingDetailsModalVisible(false)}
                        maskClosable={false}
                        keyboard={false}
                        closable={true}
                        width={850}
                                           className="bqm-modal-clean bqm-modal-no-scroll"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        footer={
                            <div className="bqm-modal-footer-simple">
                                <div className="bqm-simple-buttons">
                                    {bookingStep > 0 && (
                                        <Button onClick={prevBookingStep} icon={<LeftOutlined />}>
                                            Previous
                                        </Button>
                                    )}
                                    {bookingStep < 4 ? (
                                        <Button type="primary" onClick={nextBookingStep} icon={<RightOutlined />} iconPosition="end">
                                            Next
                                        </Button>
                                    ) : (
                                        <Button type="primary" onClick={() => setBookingDetailsModalVisible(false)}>
                                            Close
                                        </Button>
                                    )}
                                </div>
                            </div>
                        }
                    >
                        <div className="bqm-modal-step-container">
                            <div className="bqm-modal-step-header">
                                <div className="bqm-step-icon">{bookingSteps[bookingStep].icon}</div>
                                <div>
                                    <div className="bqm-step-title">{bookingSteps[bookingStep].title}</div>
                                    <div className="bqm-step-desc">
                                        {bookingStep === 0 && 'Personal and contact information'}
                                        {bookingStep === 1 && 'Date, time, venue and guest count'}
                                        {bookingStep === 2 && 'Complete meal services by day and schedule'}
                                        {bookingStep === 3 && 'Additional notes and requirements'}
                                        {bookingStep === 4 && 'Payment overview and status'}
                                    </div>
                                </div>
                            </div>
                            <div className="bqm-modal-step-body">
                                {renderBookingStepContent()}
                            </div>
                        </div>
                    </Modal>

                    {/* CREATE BOOKING MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean bqm-create-header">
                                <div className="bqm-modal-title-icon">
                                    <PlusOutlined />
                                </div>
                                <div className="bqm-modal-title-text">
                                    {editingBooking ? 'Edit Booking' : 'Create New Booking'}
                                </div>
                                <div className="bqm-step-indicator">Step {createBookingStep + 1} of 4</div>
                            </div>
                        }
                        open={quotationModalVisible}
                                            onCancel={() => {
                            if (!isSaving) {
                                modal.confirm({
                                    title: 'Exit Booking Creation?',
                                    content: 'Your progress will be lost. Are you sure?',
                                    okText: 'Yes, exit',
                                    cancelText: 'Continue editing',
                                    maskClosable: false,
                                    keyboard: false,
                                    onOk: () => {
                                        setQuotationModalVisible(false);
                                        setCreateBookingStep(0);
                                        quotationForm.resetFields();
                                        setSelectedMenuItems([]);
                                        setSelectedPackage(null);
                                        setSelectedPromo(null);
                                        setModalPricingType('per_pax');
                                        setModalSelectedIds([]);
                                        setIsSaving(false);
                                    }
                                });
                            }
                        }}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={980}
                                      className="bqm-modal-clean bqm-modal-fixed-center"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        styles={{
                            body: {
                                padding: 0,
                                maxHeight: 'calc(100vh - 180px)',
                                overflowY: 'auto',
                                position: 'relative'
                            }
                        }}
                        centered={true}
                    >
                        <div className="bqm-modal-clean-content bqm-modal-content-fixed">
                            <div className="bqm-step-progress-fixed">
                                <Steps
                                    current={createBookingStep}
                                    size="small"
                                    className="bqm-steps-fixed"
                                    items={[
                                        { title: 'Customer', icon: <UserOutlined /> },
                                        { title: 'Service', icon: <ScheduleOutlined /> },
                                        { title: 'Payment', icon: <WalletOutlined /> },
                                        { title: 'Review', icon: <CheckCircleOutlined /> }
                                    ]}
                                />
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            <Form
                                form={quotationForm}
                                layout="vertical"
                                disabled={isSaving}
                                className="bqm-form-fixed"
                            >
                                <div className="bqm-step-content-fixed">
                                    {createBookingStep === 0 && renderCustomerEventStep()}
                                    {createBookingStep === 1 && renderServiceScopeStep()}
                                    {createBookingStep === 2 && renderPaymentStep()}
                                    {createBookingStep === 3 && renderReviewStep()}
                                </div>

                                <div className="bqm-modal-buttons-clean bqm-step-buttons-fixed">
                                    <div className="bqm-step-buttons-left">
                                        {createBookingStep > 0 && (
                                            <Button
                                                onClick={handleCreateBookingPrev}
                                                icon={<LeftOutlined />}
                                                disabled={isSaving}
                                                size="large"
                                            >
                                                Previous
                                            </Button>
                                        )}
                                    </div>
                                    <div className="bqm-step-buttons-right">
                                        <Button
                                                                                       onClick={() => {
                                                if (!isSaving) {
                                                    modal.confirm({
                                                        title: 'Exit Booking Creation?',
                                                        content: 'Your progress will be lost. Are you sure?',
                                                        okText: 'Yes, exit',
                                                        cancelText: 'Continue editing',
                                                        maskClosable: false,
                                                        keyboard: false,
                                                        onOk: () => {
                                                            setQuotationModalVisible(false);
                                                            setCreateBookingStep(0);
                                                            quotationForm.resetFields();
                                                            setSelectedMenuItems([]);
                                                            setSelectedPackage(null);
                                                            setSelectedPromo(null);
                                                            setModalPricingType('per_pax');
                                                            setModalSelectedIds([]);
                                                            setMealServices([]);
                                                            setBillingAdjustments({
                                                                transportation_fee: 0,
                                                                setup_fee: 0,
                                                                service_crew_fee: 0,
                                                                equipment_rental: 0,
                                                                extra_food_fee: 0,
                                                                discount: 0,
                                                                down_payment: 0
                                                            });
                                                            setIsSaving(false);
                                                        }
                                                    });
                                                }
                                            }}
                                            disabled={isSaving}
                                            size="large"
                                        >
                                            Cancel
                                        </Button>
                                        {createBookingStep < 3 ? (
                                            <Button
                                                type="primary"
                                                onClick={handleCreateBookingNext}
                                                icon={<RightOutlined />}
                                                iconPosition="end"
                                                disabled={isSaving}
                                                size="large"
                                            >
                                                Next
                                            </Button>
                                        ) : (
                                            <Button
                                                type="primary"
                                                onClick={async () => {
                                                    if (saveLockRef.current || isSaving) return;

                                                    try {
                                                        const values = await quotationForm.validateFields();
                                                        await saveBooking(values);
                                                    } catch (error) {
                                                        if (error.errorFields && error.errorFields.length > 0) {
                                                            const firstError = error.errorFields[0];
                                                            const fieldName = firstError.name[0];
                                                            const fieldLabels = {
                                                                customer_name: 'Customer Name',
                                                                customer_email: 'Email Address',
                                                                customer_phone: 'Phone Number',
                                                                venue: 'Event Venue',
                                                                address_line_1: 'Street Address',
                                                                city: 'City',
                                                                province: 'Province',
                                                                event_type_id: 'Event Type',
                                                                guests_count: 'Number of Guests',
                                                                event_date: 'Event Date',
                                                                event_time: 'Event Time'
                                                            };
                                                            const label = fieldLabels[fieldName] || fieldName;
                                                            message.error(`❌ ${label} is required`);

                                                            const errorElement = document.querySelector(`[name="${fieldName}"]`);
                                                            if (errorElement) {
                                                                errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }
                                                        } else {
                                                            message.error(error.message || 'Please check the form for errors.');
                                                        }
                                                    }
                                                }}
                                                loading={isSaving}
                                                icon={<CheckCircleOutlined />}
                                                className="bqm-create-booking-btn"
                                                size="large"
                                                disabled={isSaving}
                                            >
                                                {isSaving ? 'Saving...' : (editingBooking ? 'Update Booking' : 'Create Booking')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Form>
                        </div>
                    </Modal>

                    {renderAddMealModal()}
                    {renderMenuSelectionModal()}

                    {/* REJECT MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><CloseCircleOutlined /></div>
                                <div className="bqm-modal-title-text">Reject or Reschedule Booking</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                            </div>
                        }
                        open={rejectReasonModalVisible}
                        onCancel={() => setRejectReasonModalVisible(false)}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={500}
                                               className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            <Form form={rejectForm} layout="vertical" onFinish={handleRejectBooking}>
                                <Form.Item name="action" label="Action" rules={[{ required: true }]}>
                                    <Radio.Group>
                                        <Radio value="reject">Reject Booking</Radio>
                                        <Radio value="reschedule">Request Reschedule</Radio>
                                    </Radio.Group>
                                </Form.Item>
                                <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
                                    <TextArea rows={3} placeholder="Please provide a reason..." />
                                </Form.Item>
                                <div className="bqm-modal-buttons-clean">
                                    <Button onClick={() => setRejectReasonModalVisible(false)}>Cancel</Button>
                                    <Button type="primary" htmlType="submit">Submit</Button>
                                </div>
                            </Form>
                        </div>
                    </Modal>

                    {/* RESCHEDULE MODAL — Reason Required */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><SyncOutlined /></div>
                                <div className="bqm-modal-title-text">Propose New Schedule</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                            </div>
                        }
                        open={rescheduleModalVisible}
                        onCancel={() => {
                            setRescheduleModalVisible(false);
                            rescheduleForm.resetFields();
                        }}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={540}
                                          className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            <Alert
                                message="Propose a New Schedule"
                                description={`Current event: ${formatDateSafe(selectedBooking?.event_date)} at ${selectedBooking?.event_time || 'N/A'}`}
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />

                            <Form form={rescheduleForm} layout="vertical" onFinish={handleReschedule}>
                                <Form.Item
                                    name="new_date"
                                    label="Proposed New Date"
                                    rules={[{ required: true, message: 'Please select a new date.' }]}
                                    extra="Choose the date you want to propose to the customer."
                                >
                                    <DatePicker
                                        style={{ width: '100%' }}
                                        format="YYYY-MM-DD"
                                        placeholder="Select new date"
                                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="new_time"
                                    label="Proposed New Time"
                                    rules={[{ required: true, message: 'Please select a new time.' }]}
                                    extra="Choose the time slot for the proposed date."
                                >
                                    <Select placeholder="Select time" size="large">
                                        {timeOptions.map((time) => (
                                            <Option key={time} value={time}>{time}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    name="reason"
                                    label={
                                        <span>
                                            Reason for Reschedule{' '}
                                            <span style={{ color: '#ef4444' }}>*</span>
                                        </span>
                                    }
                                    rules={[
                                        { required: true, message: 'Please state the reason for the reschedule.' },
                                        { min: 5, message: 'Reason must be at least 5 characters.' },
                                        { max: 500, message: 'Reason must be 500 characters or fewer.' },
                                    ]}
                                    extra="This reason will be shown to the customer and recorded in the audit trail."
                                >
                                    <TextArea
                                        rows={4}
                                        placeholder="Explain why this booking needs to be rescheduled..."
                                        maxLength={500}
                                        showCount
                                    />
                                </Form.Item>

                                <Alert
                                    type="warning"
                                    showIcon
                                    icon={<WarningOutlined />}
                                    message="The customer will receive this proposal"
                                    description="They will have 24 hours to accept, counter-propose, or cancel the booking. If they do not respond within 24 hours, the booking will be automatically cancelled."
                                    style={{ marginBottom: 16 }}
                                />

                                <div className="bqm-modal-buttons-clean">
                                    <Button
                                        onClick={() => {
                                            setRescheduleModalVisible(false);
                                            rescheduleForm.resetFields();
                                        }}
                                        size="large"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        size="large"
                                        icon={<SendOutlined />}
                                    >
                                        Send Proposal
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </Modal>

                    {/* CANCEL RESCHEDULE PROPOSAL MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon">
                                    <CloseCircleOutlined style={{ color: '#f59e0b' }} />
                                </div>
                                <div className="bqm-modal-title-text">Cancel Reschedule Proposal</div>
                                <div className="bqm-modal-badge">
                                    {safeString(cancelRescheduleBooking?.booking_no)}
                                </div>
                            </div>
                        }
                        open={cancelRescheduleModalVisible}
                        onCancel={closeCancelRescheduleModal}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={560}
                                             className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            {cancelRescheduleBooking && (
                                <>
                                    <Alert
                                        message="Withdraw the pending reschedule proposal"
                                        description={
                                            <div>
                                                <p>
                                                    The customer will <strong>no longer see</strong> the proposed new date.
                                                </p>
                                                <p>
                                                    Your booking will return to <strong>Confirmed</strong> with the
                                                    original schedule:
                                                </p>
                                                <p style={{ marginTop: 8 }}>
                                                    <strong>
                                                        {formatDateSafe(
                                                            cancelRescheduleBooking?.original_event_date ||
                                                                cancelRescheduleBooking?.event_date
                                                        )}
                                                    </strong>
                                                    {' at '}
                                                    <strong>
                                                        {cancelRescheduleBooking?.original_event_time ||
                                                            cancelRescheduleBooking?.event_time ||
                                                            'N/A'}
                                                    </strong>
                                                </p>
                                            </div>
                                        }
                                        type="warning"
                                        showIcon
                                        icon={<WarningOutlined />}
                                        style={{ marginBottom: 16 }}
                                    />

                                    <Alert
                                        message="Previously Proposed Schedule"
                                        description={
                                            <div>
                                                <strong>New Date:</strong>{' '}
                                                {formatDateSafe(cancelRescheduleBooking?.requested_date)}{' '}
                                                <strong style={{ marginLeft: 12 }}>New Time:</strong>{' '}
                                                {cancelRescheduleBooking?.requested_time || 'N/A'}
                                                {cancelRescheduleBooking?.reschedule_reason && (
                                                    <>
                                                        <br />
                                                        <strong>Reason Given:</strong>{' '}
                                                        {cancelRescheduleBooking.reschedule_reason}
                                                    </>
                                                )}
                                            </div>
                                        }
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />

                                    <div style={{ marginBottom: 16 }}>
                                        <label
                                            style={{
                                                display: 'block',
                                                marginBottom: 6,
                                                fontWeight: 600,
                                                color: '#5A5A5E',
                                            }}
                                        >
                                            Reason for Withdrawing (optional)
                                        </label>
                                        <TextArea
                                            rows={3}
                                            placeholder="e.g., Customer confirmed original date works, found a better slot..."
                                            maxLength={500}
                                            showCount
                                            value={cancelRescheduleReason}
                                            onChange={(e) => setCancelRescheduleReason(e.target.value)}
                                            disabled={cancelRescheduleSubmitting}
                                        />
                                    </div>

                                    <div className="bqm-modal-buttons-clean">
                                        <Button
                                            onClick={closeCancelRescheduleModal}
                                            disabled={cancelRescheduleSubmitting}
                                            size="large"
                                        >
                                            Keep Proposal
                                        </Button>
                                        <Button
                                            type="primary"
                                            danger
                                            onClick={handleCancelRescheduleProposal}
                                            loading={cancelRescheduleSubmitting}
                                            icon={<CloseCircleOutlined />}
                                            size="large"
                                        >
                                            Cancel Proposal
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </Modal>

                    {/* CANCEL MODAL */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><StopOutlined /></div>
                                <div className="bqm-modal-title-text">Cancel Booking</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                            </div>
                        }
                        open={cancelReasonModalVisible}
                        onCancel={() => setCancelReasonModalVisible(false)}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={500}
                                              className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            <Form form={cancelForm} layout="vertical" onFinish={handleCancelBooking}>
                                <Form.Item name="reason" label="Cancellation Reason" rules={[{ required: true }]}>
                                    <TextArea rows={3} placeholder="Please provide a reason for cancellation..." />
                                </Form.Item>
                                <div className="bqm-modal-buttons-clean">
                                    <Button onClick={() => setCancelReasonModalVisible(false)}>Cancel</Button>
                                    <Button type="primary" danger htmlType="submit">Confirm Cancellation</Button>
                                </div>
                            </Form>
                        </div>
                    </Modal>

                    {/* CALENDAR AVAILABILITY MODAL */}
                                     <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><EditOutlined /></div>
                                <div className="bqm-modal-title-text">Edit Date Availability</div>
                                <div className="bqm-modal-badge">{selectedCalendarDate.format('MMM DD, YYYY')}</div>
                            </div>
                        }
                        open={availabilityModalVisible}
                        onCancel={() => setAvailabilityModalVisible(false)}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={560}
                                              className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                        // ⭐ Keep the form instance attached to the DOM so
                        // Ant Design does not log
                        // "Instance created by useForm is not connected
                        //  to any Form element."
                        forceRender
                    >
                        <div className="bqm-modal-clean-content">
                            <Alert
                                message="Date Availability Control"
                                description="Set this date's booking availability. This will control how many bookings can be accepted for this date."
                                type="info"
                                showIcon
                                style={{ marginBottom: 20 }}
                            />
                            <Form form={availabilityForm} layout="vertical" onFinish={saveCalendarAvailability} initialValues={{ operation_mode: 'normal', status: 'available' }}>
                                <Form.Item
                                    name="operation_mode"
                                    label="Operation Mode"
                                    rules={[{ required: true }]}
                                    extra="Normal Operation accepts unlimited bookings. Limited Slot enforces a maximum booking limit."
                                >
                                    <Radio.Group buttonStyle="solid">
                                        {availabilityOperationOptions.map((option) => (
                                            <Radio.Button key={option.value} value={option.value}>{option.label}</Radio.Button>
                                        ))}
                                    </Radio.Group>
                                </Form.Item>

                                <Form.Item
                                    name="status"
                                    label="Availability Status"
                                    rules={[{ required: true }]}
                                    extra="Choose how this date should be treated for new bookings"
                                >
                                    <Select>
                                        {availabilityStatusOptions.map((option) => (
                                            <Option key={option.value} value={option.value}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {getAvailabilityConfig(option.value).icon}
                                                    <span>{option.label}</span>
                                                </div>
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Form.Item shouldUpdate={(prev, current) => prev.operation_mode !== current.operation_mode || prev.status !== current.status} noStyle>
                                    {({ getFieldValue }) => (
                                        getFieldValue('operation_mode') === 'limited_slot' && getFieldValue('status') === 'available' ? (
                                            <Form.Item
                                                name="max_bookings"
                                                label="Maximum Bookings Limit"
                                                rules={[{ required: true, message: 'Please enter the maximum bookings limit for Limited Slot mode.' }]}
                                                extra="This limit is applied only while Limited Slot mode is selected."
                                            >
                                                <InputNumber
                                                    min={1}
                                                    style={{ width: '100%' }}
                                                    placeholder="Enter maximum number of bookings"
                                                />
                                            </Form.Item>
                                        ) : null
                                    )}
                                </Form.Item>

                                <Form.Item
                                    name="notes"
                                    label="Admin Notes"
                                    extra="Internal notes about why this date has restrictions"
                                >
                                    <TextArea
                                        rows={3}
                                        placeholder="E.g., Holiday surcharge applies, Limited staff available, etc."
                                    />
                                </Form.Item>

                                <div className="bqm-modal-buttons-clean">
                                    <Button danger onClick={resetCalendarAvailability}>Reset to Available</Button>
                                    <Button onClick={() => setAvailabilityModalVisible(false)}>Cancel</Button>
                                    <Button type="primary" htmlType="submit">Save Settings</Button>
                                </div>
                            </Form>
                        </div>
                    </Modal>
                </div>
            </ConfigProvider>
        </App>
    );
};

export default BookingQuotationManagement;