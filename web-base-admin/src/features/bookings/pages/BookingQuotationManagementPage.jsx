// src/components/BookingQuotationManagement.jsx - COMPLETE FIXED VERSION
// ENHANCEMENTS:
// 1. Table footer with cleaner summary layout
// 2. All table text uses black font color
// 3. MEAL SERVICES column hidden from tables
// 4. View modal enhanced with organized meal services by day
// 5. Package items automatically expanded in view modal

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    normalizeListResponse
} from '../../../hooks/useBookingQuotation';

import '../../../features/bookings/styles/Sales.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// Remove pagination - fetch all records
const FETCH_ALL_LIMIT = 9999;
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
    const dateValue = dayjs(booking?.event_date);
    if (!dateValue.isValid()) return Number.MAX_SAFE_INTEGER;
    return dateValue.startOf('day').valueOf() + (parseTimeToMinutes(booking?.event_time) * 60 * 1000);
};

const sortBookingsChronologically = (bookings = []) => [...safeArray(bookings)].sort((a, b) => {
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

// UPDATED: Select Menu Items now displays all available menu items for every meal type.
// Meal type is still retained for labeling/sorting, but it no longer filters available menus.
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
// MAIN COMPONENT
// ============================================================
const BookingQuotationManagement = () => {
    const location = useLocation();
    const { user } = useAuth();
    const canApproveOperations = hasAllowedRole(user, ADMIN_ROLES);
    const isCashierOnly = hasAllowedRole(user, CASHIER_ROLES) && !canApproveOperations;
    const isMounted = useRef(true);
    const { message, modal } = App.useApp();

    const [activeMainTab, setActiveMainTab] = useState('bookings');
    const [activeBookingTab, setActiveBookingTab] = useState('regular');

    useEffect(() => {
        const requestedView = new URLSearchParams(location.search).get('view');
        if (['bookings', 'quotations', 'history', 'calendar'].includes(requestedView)) {
            setActiveMainTab(requestedView);
        }
    }, [location.search]);

    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEventType, setFilterEventType] = useState('all');
    
    // Date filter now supports range
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

    const [isDarkMode, setIsDarkMode] = useState(false);

    const [selectedBooking, setSelectedBooking] = useState(null);
    const [editingBooking, setEditingBooking] = useState(null);
    const [bookingStep, setBookingStep] = useState(0);

    const [bookingDetailsModalVisible, setBookingDetailsModalVisible] = useState(false);
    const [quotationModalVisible, setQuotationModalVisible] = useState(false);
    const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
    const [rejectReasonModalVisible, setRejectReasonModalVisible] = useState(false);
    const [cancelReasonModalVisible, setCancelReasonModalVisible] = useState(false);
    const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);

    // Meal and Menu Selection Modals
    const [addMealModalVisible, setAddMealModalVisible] = useState(false);
    const [pendingMealDay, setPendingMealDay] = useState(null);
    const [pendingMealType, setPendingMealType] = useState(null);
    const [menuSelectionModalVisible, setMenuSelectionModalVisible] = useState(false);
    const [selectedMealId, setSelectedMealId] = useState(null);
    const [menuSearchTerm, setMenuSearchTerm] = useState('');
    const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
    const [menuViewMode, setMenuViewMode] = useState('grid');
    const [menuSelectionMode, setMenuSelectionMode] = useState('menu_items');

    // ========================================================
    // STATE FOR ENHANCED CREATE BOOKING
    // ========================================================
    const [createBookingStep, setCreateBookingStep] = useState(0);
    const [serviceType, setServiceType] = useState('buffet');
    const [eventScope, setEventScope] = useState('regular');
    const [multiDayDays, setMultiDayDays] = useState(2);

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

    // Menu selection states
    const [menuSelectionType, setMenuSelectionType] = useState('customize');
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [selectedPromo, setSelectedPromo] = useState(null);
    const [selectedMenuItems, setSelectedMenuItems] = useState([]);
    const [menuItemsList, setMenuItemsList] = useState([]);
    const [packagesList, setPackagesList] = useState([]);
    const [promosList, setPromosList] = useState([]);
    const [isLoadingMenuData, setIsLoadingMenuData] = useState(false);

    // Store form values for review step
    const [formValues, setFormValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const saveLockRef = useRef(false);

    // Use useForm for all forms
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

    // Build params with date range support - fetch all records
    const buildBookingParams = (scope, status = filterStatus) => {
        const params = {
            booking_scope: scope,
            sort: 'event_schedule',
            per_page: FETCH_ALL_LIMIT  // Fetch all records
        };

        if (status !== 'all') {
            params.status = status;
        } else {
            params.status_not_in = ACTIVE_BOOKING_STATUS_EXCLUSIONS;
        }

        if (filterEventType !== 'all') {
            params.event_type_id = filterEventType;
        }

        if (searchText.trim()) {
            params.search = searchText.trim();
        }

        // Date range support
        if (filterDateRange?.length === 2) {
            params.date_from = dayjs(filterDateRange[0]).format('YYYY-MM-DD');
            params.date_to = dayjs(filterDateRange[1]).format('YYYY-MM-DD');
        }

        return params;
    };

    // History params with date range
    const buildHistoryParams = () => {
        const combinedSearch = [historySearchText, historyBookingId, historyCustomerName]
            .map((value) => safeString(value).trim())
            .filter(Boolean)
            .join(' ');

        const params = {
            per_page: FETCH_ALL_LIMIT  // Fetch all records
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
    };

    // ========================================================
    // DATABASE QUERIES
    // ========================================================
    const {
        data: regularBookingsData,
        isLoading: regularBookingsLoading,
        refetch: refetchRegularBookings
    } = useBookings(
        buildBookingParams('regular')
    );

    const {
        data: multiDayBookingsData,
        isLoading: multiDayBookingsLoading,
        refetch: refetchMultiDayBookings
    } = useBookings(
        buildBookingParams('multi_day')
    );

    const {
        data: completedBookingsData,
        isLoading: completedBookingsLoading,
        refetch: refetchCompletedBookings
    } = useBookings(buildHistoryParams());

    const { data: statistics, refetch: refetchStatistics } = useBookingStatistics();

    const {
        data: quotationsData,
        isLoading: quotationsLoading,
        refetch: refetchQuotations
    } = useQuotations({
        per_page: FETCH_ALL_LIMIT,
        status_in: 'pending,approved',
        search: searchText.trim() || undefined
    });
    const { data: eventTypesData } = useEventTypes();
    const { data: calendarEvents, refetch: refetchCalendarEvents } = useCalendarEvents(calendarRange);
    const { data: calendarAvailabilityData, refetch: refetchCalendarAvailability } = useCalendarAvailability(calendarRange);

    // ========================================================
    // DATABASE MUTATIONS
    // ========================================================
    const confirmBookingMutation = useConfirmBooking();
    const rejectBookingMutation = useRejectBooking();
    const createQuotationMutation = useCreateQuotation();
    const rejectQuotationMutation = useRejectQuotation();
    const sendQuotationMutation = useSendQuotation();
    const deleteQuotationMutation = useDeleteQuotation();
    const saveCalendarAvailabilityMutation = useSaveCalendarAvailability();
    const deleteCalendarAvailabilityMutation = useDeleteCalendarAvailability();

    // ========================================================
    // NORMALIZED DATABASE DATA
    // ========================================================
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

    // ========================================================
    // THEME
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
    // EVENT LISTENERS
    // ========================================================
    useEffect(() => {
        const handleBookingEvent = (event) => {
            console.log('📢 Booking event received:', event.detail);
            refreshAllData(false);
        };

        window.addEventListener('booking-approved', handleBookingEvent);
        window.addEventListener('booking-cancelled', handleBookingEvent);
        window.addEventListener('booking-reschedule-requested', handleBookingEvent);

        return () => {
            window.removeEventListener('booking-approved', handleBookingEvent);
            window.removeEventListener('booking-cancelled', handleBookingEvent);
            window.removeEventListener('booking-reschedule-requested', handleBookingEvent);
        };
    }, []);

    // ========================================================
    // LOAD MENU DATA
    // ========================================================
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
            setMenuItemsList(Array.isArray(menuData) ? menuData : []);

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

    // ========================================================
    // DATA HELPERS
    // ========================================================
    const getEventTypeName = (eventTypeId) => {
        const found = eventTypes.find((eventType) => Number(eventType.event_type_id || eventType.id) === Number(eventTypeId));
        return found?.name || 'Unknown';
    };

    const getCalendarAvailability = (dateValue) => {
        const date = dayjs(dateValue).format('YYYY-MM-DD');
        return calendarAvailability.find((item) => safeString(item.availability_date || item.date) === date);
    };

    const getBookingLocation = (booking) => booking.location || booking.venue || booking.delivery_address || 'N/A';
    const getServiceType = (booking) => booking.service_type || booking.fulfillment_type || booking.delivery_type || 'Catering Service';
    const getBookingId = (booking) => booking.id || booking.booking_id;

    const getMenuItems = (booking) => {
        const items = safeArray(booking.menu_items || booking.items || booking.selected_items, []);
        return items.map(item => ({
            name: safeString(item.name),
            quantity: safeNumber(item.quantity || item.total_quantity || item.qty, 1),
            price: safeNumber(item.price, 0),
            subtotal: safeNumber(item.total_price, safeNumber(item.price, 0) * safeNumber(item.quantity || item.total_quantity, 1))
        }));
    };

    const getMenuType = (booking) => booking.menu_selection_type === 'package' ? 'Package' : 'Customize';
    const getSpecialRequests = (booking) => safeString(booking.special_requests, 'No special requests');
    const getPackageInfo = (booking) => booking.package_summary || booking.selected_package || null;

    const splitAddressParts = (details = {}) => {
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

    // ========================================================
    // ENHANCED MEAL SERVICES RENDERER FOR VIEW MODAL
    // ========================================================
    const renderMealServicesInModal = (booking) => {
        const mealServices = safeArray(booking.meal_services);
        
        if (mealServices.length === 0) {
            return (
                <div className="bqm-no-meals-message">
                    <Text type="secondary">No meal services configured for this booking.</Text>
                </div>
            );
        }

        // Group meals by day
        const mealsByDay = {};
        mealServices.forEach(meal => {
            const day = meal.day_number || 1;
            if (!mealsByDay[day]) {
                mealsByDay[day] = [];
            }
            mealsByDay[day].push(meal);
        });

        // Sort days
        const sortedDays = Object.keys(mealsByDay).sort((a, b) => Number(a) - Number(b));

        return (
            <div className="bqm-meal-services-view">
                {sortedDays.map((day) => {
                    const dayMeals = mealsByDay[day];
                    
                    // Sort meals by meal type order: Breakfast, Lunch, Snacks, Dinner
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
                                // Get menu items for this meal
                                let menuItems = [];
                                
                                // Check if this is a package meal
                                if (meal.menu_source === 'package' || meal.package_id) {
                                    // Try to get package items
                                    const packageItems = safeArray(meal.custom_items);
                                    if (packageItems.length > 0) {
                                        menuItems = packageItems.map(item => ({
                                            name: item.item_name || item.name || 'Menu Item',
                                            quantity: safeNumber(item.quantity, 1),
                                            price: safeNumber(item.unit_price || item.price, 0),
                                            subtotal: safeNumber(item.quantity, 1) * safeNumber(item.unit_price || item.price, 0)
                                        }));
                                    } else {
                                        // Fallback: show package name with note
                                        const packageName = meal.menu_name || meal.package_name || 'Package';
                                        menuItems = [{
                                            name: `${packageName} (Package - items will be expanded in production)`,
                                            quantity: 1,
                                            price: safeNumber(meal.price_per_head, 0),
                                            subtotal: safeNumber(meal.price_per_head, 0)
                                        }];
                                    }
                                } else {
                                    // Custom menu items
                                    menuItems = safeArray(meal.custom_items).map(item => ({
                                        name: item.item_name || item.name || 'Menu Item',
                                        quantity: safeNumber(item.quantity, 1),
                                        price: safeNumber(item.unit_price || item.price, 0),
                                        subtotal: safeNumber(item.quantity, 1) * safeNumber(item.unit_price || item.price, 0)
                                    }));
                                    
                                    // If no custom items but we have a menu name, use it
                                    if (menuItems.length === 0 && meal.menu_name) {
                                        menuItems = [{
                                            name: meal.menu_name,
                                            quantity: 1,
                                            price: safeNumber(meal.price_per_head, 0),
                                            subtotal: safeNumber(meal.price_per_head, 0)
                                        }];
                                    }
                                }

                                // Calculate totals
                                const totalItems = menuItems.reduce((sum, item) => sum + safeNumber(item.quantity), 0);
                                const totalPrice = menuItems.reduce((sum, item) => sum + safeNumber(item.subtotal), 0);

                                return (
                                    <div key={index} className="bqm-meal-schedule-group">
                                        <div className="bqm-meal-schedule-header">
                                            <div className="bqm-meal-schedule-title">
                                                <Tag color="green" className="bqm-meal-type-tag">
                                                    {meal.meal_type || 'Meal'}
                                                </Tag>
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

    // ========================================================
    // REFRESH
    // ========================================================
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

    // ========================================================
    // EXPORT FUNCTIONS
    // ========================================================
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

    // ========================================================
    // BOOKING ACTIONS
    // ========================================================
    const handleCompleteBooking = async (booking) => {
        const balance = safeNumber(
            booking.balance ?? booking.outstanding_balance ?? booking.billing_summary?.remaining_balance,
            Math.max(0, safeNumber(booking.total_amount) - safeNumber(booking.paid_amount))
        );
        if (balance > 0.01) {
            message.error('Please pay the remaining balance before completing this booking.');
            return;
        }

        Modal.confirm({
            title: 'Mark Booking as Completed',
            content: `Move ${safeString(booking.booking_no)} to booking history?`,
            okText: 'Mark as Completed',
            maskClosable: false,
            keyboard: false,
            onOk: async () => {
                const bookingId = getBookingId(booking);
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
        try {
            await api.post(`/bookings/${bookingId}/cancel-with-reason`, { reason: values.reason });
            message.success('Booking cancelled and moved to history');
            setCancelReasonModalVisible(false);
            cancelForm.resetFields();
            await refreshAllData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to cancel booking');
        }
    };

    const openCancelModal = (booking) => {
        setSelectedBooking(booking);
        cancelForm.resetFields();
        setCancelReasonModalVisible(true);
    };

    const handleRejectBooking = (values) => {
        const bookingId = getBookingId(selectedBooking);
        if (values.action === 'reject') {
            rejectBookingMutation.mutate(bookingId, {
                onSuccess: () => {
                    setRejectReasonModalVisible(false);
                    rejectForm.resetFields();
                }
            });
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
        setSelectedBooking(booking);
        rejectForm.resetFields();
        setRejectReasonModalVisible(true);
    };

    const handleReschedule = (values) => {
        const bookingId = getBookingId(selectedBooking);
        const newDate = values.new_date ? values.new_date.format('YYYY-MM-DD') : selectedBooking.event_date;
        const newTime = values.new_time || selectedBooking.event_time;

        api.post(`/bookings/${bookingId}/request-reschedule`, {
            requested_date: newDate,
            requested_time: newTime,
            reason: values.reason,
            booking_status: 'reschedule_requested'
        }).then(() => {
            message.success('Reschedule request submitted to customer');
            setRescheduleModalVisible(false);
            rescheduleForm.resetFields();
            refreshAllData();
            notifyRescheduleRequest(bookingId, newDate, newTime);
        }).catch(error => {
            message.error(error?.response?.data?.message || 'Failed to submit reschedule request');
        });
    };

    const openRescheduleModal = (booking) => {
        setSelectedBooking(booking);
        rescheduleForm.setFieldsValue({
            new_date: dayjs(booking.event_date),
            new_time: booking.event_time,
            reason: ''
        });
        setRescheduleModalVisible(true);
    };

    const openBookingDetails = (booking) => {
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

    // ========================================================
    // CONFIRM BOOKING
    // ========================================================
    const isBookingSchedulePassed = (booking) => {
        const eventDate = safeString(booking?.event_date);
        const eventTime = safeString(booking?.event_time);

        if (!eventDate) return false;

        const scheduledDate = dayjs(`${eventDate} ${eventTime}`);

        if (!scheduledDate.isValid()) {
            return false;
        }

        return scheduledDate.isBefore(dayjs());
    };

    const autoCancelExpiredBooking = async (booking) => {
        const bookingId = getBookingId(booking);

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

    const confirmBooking = (booking) => {
        const bookingId = getBookingId(booking);
        const bookingNo = safeString(booking.booking_no);

        if (isBookingSchedulePassed(booking)) {
            autoCancelExpiredBooking(booking);
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
                const hideLoading = message.loading(`Processing booking ${bookingNo}...`, 0);
                try {
                    await confirmBookingMutation.mutateAsync(bookingId);
                } catch (error) {
                    console.error('Approval error:', error);
                    const errorMsg = error?.response?.data?.message || error?.message || 'Failed to approve booking';
                    message.error(errorMsg);
                    throw error;
                } finally {
                    hideLoading();
                }
            }
        });
    };

    // ========================================================
    // CHECK FOR DUPLICATE BOOKING
    // ========================================================
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

    // ========================================================
    // OPEN CREATE BOOKING MODAL
    // ========================================================
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

    // ========================================================
    // VALIDATE STEP
    // ========================================================
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
                    next.price_per_head = safeNumber(selected.price || selected.unit_price || 0);
                }
            }
            if (['pax', 'price_per_head', 'menu_item_id', 'package_id'].includes(field)) {
                next.total_meal_amount = safeNumber(next.pax) * safeNumber(next.price_per_head);
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

    const normalizeCustomMealItem = (item) => ({
        menu_item_id: item.menu_item_id || item.id,
        item_name: item.name || item.item_name || 'Menu Item',
        description: item.description || '',
        quantity: 1,
        unit_price: safeNumber(item.price || item.unit_price || item.base_price || 0),
        notes: item.notes || ''
    });

    const calculateCustomItemsPrice = (items = []) => safeArray(items)
        .reduce((sum, item) => sum + (safeNumber(item.unit_price) * safeNumber(item.quantity, 1)), 0);

    const setMealCustomItems = (mealId, selectedIds = []) => {
        setMealServices(prev => prev.map(meal => {
            if (meal.id !== mealId) return meal;
            const existingItems = safeArray(meal.custom_items);
            const nextItems = selectedIds.map(id => {
                const existing = existingItems.find(i => String(i.menu_item_id) === String(id));
                if (existing) return existing;
                const source = menuItemsList.find(item => String(item.menu_item_id || item.id) === String(id));
                return source ? normalizeCustomMealItem(source) : null;
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
            const totalPrice = calculateCustomItemsPrice(uniqueItems);
            return {
                ...meal,
                menu_source: 'custom',
                custom_items: uniqueItems,
                menu_item_id: uniqueItems.length === 1 ? uniqueItems[0].menu_item_id : null,
                menu_name: uniqueItems.map(i => i.item_name).join(', '),
                price_per_head: totalPrice,
                total_meal_amount: safeNumber(meal.pax) * totalPrice
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
            return {
                ...meal,
                custom_items: nextItems,
                menu_name: nextItems.map(i => i.item_name).join(', '),
                price_per_head: nextPrice,
                total_meal_amount: safeNumber(meal.pax) * nextPrice
            };
        }));
    };

    const removeMealCustomItem = (mealId, menuItemId) => {
        setMealServices(prev => prev.map(meal => {
            if (meal.id !== mealId) return meal;
            const nextItems = safeArray(meal.custom_items).filter(item => String(item.menu_item_id) !== String(menuItemId));
            const nextPrice = calculateCustomItemsPrice(nextItems);
            return {
                ...meal,
                custom_items: nextItems,
                menu_item_id: nextItems.length === 1 ? nextItems[0].menu_item_id : null,
                menu_name: nextItems.map(i => i.item_name).join(', '),
                price_per_head: nextPrice,
                total_meal_amount: safeNumber(meal.pax) * nextPrice
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
            return {
                ...meal,
                pax: nextGuestCount,
                total_meal_amount: nextGuestCount * safeNumber(meal.price_per_head),
            };
        }));
    };

    const calculateMealServicesTotal = () => mealServices.reduce((sum, meal) => sum + (safeNumber(meal.pax) * safeNumber(meal.price_per_head)), 0);
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

    // ========================================================
    // OPEN MENU SELECTION
    // ========================================================
    const openMenuSelection = (mealId) => {
        setSelectedMealId(mealId);
        setMenuSearchTerm('');
        setMenuCategoryFilter('all');
        setMenuViewMode('grid');
        setMenuSelectionMode('menu_items');
        setMenuSelectionModalVisible(true);
    };

    const handleSelectMenuItems = (selectedIds) => {
        if (selectedMealId) {
            setMealCustomItems(selectedMealId, selectedIds);
        }
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
    };

    // ============================================================
    // SAVE BOOKING
    // ============================================================
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
                        notes: item.notes || ''
                    })),
                    price_per_head: safeNumber(meal.price_per_head, 0),
                    total_meal_amount: safeNumber(meal.pax) * safeNumber(meal.price_per_head, 0),
                    notes: meal.notes || '',
                    meal_status: String(meal.meal_status || 'pending').toLowerCase().replaceAll(' ', '_')
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
                content: isUpdate ? `✅ Booking ${bookingNo} updated successfully!` : `✅ Booking ${bookingNo} created successfully!`,
                duration: 3,
            });

            quotationForm.resetFields();
            setSelectedMenuItems([]);
            setSelectedPackage(null);
            setSelectedPromo(null);
            setEditingBooking(null);
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
            setFormValues({});
            setQuotationModalVisible(false);
            setCreateBookingStep(0);
            
            void refreshAllData(false);

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
            if (isMounted.current) {
                setIsSaving(false);
            }
        }
    };

    // ========================================================
    // STEP RENDER FUNCTIONS - Simplified for readability
    // ========================================================

    // Step 1: Customer & Event Information
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

    // Step 2: Service & Scope Configuration
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
                                        <Col span={6}>
                                            <div className="bqm-meal-field">
                                                <span className="bqm-meal-label">Price per Head</span>
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
                                        <Col span={14}>
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
                                                {meal.custom_items.map((item, idx) => (
                                                    <Tag key={idx} closable onClose={() => removeMealCustomItem(meal.id, item.menu_item_id)}>
                                                        {item.item_name} (₱{item.unit_price})
                                                    </Tag>
                                                ))}
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

    // Step 3: Payment & Additional Charges
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

    // Step 4: Review & Confirm
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
                                        { title: 'Items', width: 120, render: (_, r) => r.custom_items?.length || 0 },
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

    // ========================================================
    // ADD MEAL MODAL
    // ========================================================
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

    // ========================================================
    // MENU SELECTION MODAL
    // ========================================================
    const renderMenuSelectionModal = () => {
        const meal = mealServices.find(m => m.id === selectedMealId);
        const selectedIds = meal?.custom_items?.map(item => String(item.menu_item_id || item.id)) || [];

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
                onCancel={() => setMenuSelectionModalVisible(false)}
                maskClosable={false}
                keyboard={false}
                width={950}
                className="bqm-menu-modal"
                destroyOnHidden={true}
                footer={
                    <div className="bqm-menu-modal-footer">
                        <div className="bqm-menu-modal-selected-count">
                            {selectedIds.length} items selected
                        </div>
                        <Space>
                            <Button onClick={() => setMenuSelectionModalVisible(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => handleSelectMenuItems(selectedIds)}
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
                                                    return (
                                                        <div
                                                            key={item.menu_item_id || item.id}
                                                            className={`bqm-menu-grid-item ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setMealCustomItems(selectedMealId, selectedIds.filter(id => id !== String(item.menu_item_id || item.id)));
                                                                } else {
                                                                    setMealCustomItems(selectedMealId, [...selectedIds, String(item.menu_item_id || item.id)]);
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
                                                                <div className="bqm-menu-item-price">{formatCurrency(item.price)}</div>
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
                                                    return (
                                                        <List.Item
                                                            className={`bqm-menu-list-item ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setMealCustomItems(selectedMealId, selectedIds.filter(id => id !== String(item.menu_item_id || item.id)));
                                                                } else {
                                                                    setMealCustomItems(selectedMealId, [...selectedIds, String(item.menu_item_id || item.id)]);
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
                                                                        <span className="bqm-menu-list-item-price">{formatCurrency(item.price)}</span>
                                                                    </div>
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

    // ========================================================
    // CALENDAR AVAILABILITY
    // ========================================================
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
        Modal.confirm({
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

    // ========================================================
    // CALENDAR DATE CELL RENDER
    // ========================================================
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
        const bookingId = getBookingId(booking);
        try {
            const response = await api.get(`/bookings/${bookingId}`);
            const details = response?.data?.data || response?.data || booking;
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
                custom_items: safeArray(meal.custom_items).map(item => ({
                    menu_item_id: item.menu_item_id,
                    item_name: item.item_name || item.name,
                    description: item.description,
                    quantity: safeNumber(item.quantity, 1),
                    unit_price: safeNumber(item.unit_price),
                    notes: item.notes || ''
                }))
            }));
            setMealServices(sortMealServicesChronologically(loadedMeals.length ? loadedMeals.map(meal => {
                const customItems = safeArray(meal.custom_items);
                const customPrice = customItems.length ? calculateCustomItemsPrice(customItems) : safeNumber(meal.price_per_head);
                return customItems.length ? { ...meal, menu_source: 'custom', price_per_head: customPrice, total_meal_amount: safeNumber(meal.pax) * customPrice } : meal;
            }) : []));
            setQuotationModalVisible(true);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to load booking for editing');
        }
    };

    // ========================================================
    // ACTION BUTTONS
    // ========================================================
    const renderBookingActions = (booking) => {
        const status = safeString(booking.booking_status).toLowerCase();
        const isPending = ['pending', 'pending_approval', 'draft'].includes(status);
        const isOperational = ['confirmed', 'approved', 'ongoing'].includes(status);

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
                {canApproveOperations && status === 'pending_approval' && (
                    <>
                        <Tooltip title="Approve booking">
                            <button className="bqm-action-icon confirm" onClick={() => confirmBooking(booking)}>
                                <CheckCircleOutlined />
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
                        {canApproveOperations && (
                            <Tooltip title="Cancel booking">
                                <button className="bqm-action-icon delete" onClick={() => openCancelModal(booking)}>
                                    <StopOutlined />
                                </button>
                            </Tooltip>
                        )}
                        <Tooltip title={isCashierOnly ? 'Request reschedule' : 'Reschedule booking'}>
                            <button className="bqm-action-icon edit" onClick={() => openRescheduleModal(booking)}>
                                <SyncOutlined />
                            </button>
                        </Tooltip>
                        {canApproveOperations && (
                            <Tooltip title="Mark as completed">
                                <button className="bqm-action-icon confirm" onClick={() => handleCompleteBooking(booking)}>
                                    <CheckCircleOutlined />
                                </button>
                            </Tooltip>
                        )}
                    </>
                )}
            </div>
        );
    };

    // ========================================================
    // TABLE COLUMNS - MEAL SERVICES COLUMN REMOVED
    // ========================================================
    const regularBookingColumns = [
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            fixed: 'left',
            render: (value) => <span className="bqm-id-text">{safeString(value)}</span>
        },
        { title: 'CUSTOMER', dataIndex: 'customer_name', key: 'customer_name', width: 200, render: (value, record) => (
            <div className="bqm-customer-cell">
                <div className="bqm-customer-name">{safeString(value)}</div>
                <div className="bqm-customer-contact"><MailOutlined /> {safeString(record.customer_email, 'No email')}</div>
                <div className="bqm-customer-contact"><PhoneOutlined /> {safeString(record.customer_phone, 'No phone')}</div>
            </div>
        ) },
        {
            title: 'EVENT DATE & LOCATION',
            key: 'event_location',
            width: 220,
            render: (_, record) => (
                <div className="bqm-event-location-cell">
                    <div className="bqm-event-date"><CalendarOutlined /> {safeString(record.event_date, 'N/A')}</div>
                    <div className="bqm-event-date"><ScheduleOutlined /> {safeString(record.event_time, 'N/A')}</div>
                    <div className="bqm-event-location"><EnvironmentOutlined /> {getBookingLocation(record)}</div>
                </div>
            )
        },
        // MEAL SERVICES COLUMN REMOVED
        { title: 'SERVICE', key: 'service_type', width: 130, render: (_, record) => <span className="bqm-service-text">{getServiceType(record)}</span> },
        { title: 'EVENT TYPE', key: 'event_type', width: 130, render: (_, record) => <span className="bqm-event-type-text">{getEventTypeName(record.event_type_id)}</span> },
        { title: 'PAX', dataIndex: 'guests_count', key: 'guests_count', width: 80, align: 'center', render: (value) => <span className="bqm-pax-number"><TeamOutlined /> {safeNumber(value)}</span> },
        { title: 'AMOUNT', dataIndex: 'total_amount', key: 'total_amount', width: 150, align: 'center', render: (value) => <span className="bqm-amount">{formatCurrency(value)}</span> },
        { title: 'STATUS', dataIndex: 'booking_status', key: 'booking_status', width: 140, render: (value) => { const config = getStatusConfig(value); return <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{config.text}</span>; } },
        { title: 'ACTION', key: 'action', width: 200, fixed: 'right', render: (_, record) => renderBookingActions(record) }
    ];

    const multiDayColumns = [
        { title: 'BOOKING #', dataIndex: 'booking_no', key: 'booking_no', width: 140, fixed: 'left', render: (value) => <span className="bqm-id-text">{safeString(value)}</span> },
        { title: 'CUSTOMER', dataIndex: 'customer_name', key: 'customer_name', width: 200, render: (value, record) => (
            <div className="bqm-customer-cell">
                <div className="bqm-customer-name">{safeString(value)}</div>
                <div className="bqm-customer-contact"><MailOutlined /> {safeString(record.customer_email, 'No email')}</div>
            </div>
        ) },
        {
            title: 'EVENT PERIOD',
            key: 'event_period',
            width: 220,
            render: (_, record) => (
                <div className="bqm-event-period-cell">
                    <div className="bqm-event-date"><CalendarOutlined /> {safeString(record.event_date, 'N/A')} - {safeString(record.event_end_date || record.end_date || record.event_date, 'N/A')}</div>
                    <div className="bqm-event-days"><ScheduleOutlined /> {safeString(record.event_time, 'N/A')} • {formatDays(record.event_date, record.event_end_date || record.end_date || record.event_date)} days</div>
                </div>
            )
        },
        // MEAL SERVICES COLUMN REMOVED
        {
            title: 'LOCATION',
            key: 'location',
            width: 220,
            ellipsis: true,
            render: (_, record) => (
                <div className="bqm-event-location-cell">
                    <EnvironmentOutlined /> {getBookingLocation(record)}
                </div>
            )
        },
        { title: 'PAX', dataIndex: 'guests_count', key: 'guests_count', width: 80, align: 'center', render: (value) => <span className="bqm-pax-number"><TeamOutlined /> {safeNumber(value)}</span> },
        { title: 'AMOUNT', dataIndex: 'total_amount', key: 'total_amount', width: 140, align: 'right', render: (value) => <span className="bqm-amount">{formatCurrency(value)}</span> },
        { title: 'STATUS', dataIndex: 'booking_status', key: 'booking_status', width: 140, render: (value) => { const config = getStatusConfig(value); return <span className="bqm-status" style={{ color: config.color, background: config.background }}>{config.icon}{config.text}</span>; } },
        { title: 'ACTION', key: 'action', width: 200, fixed: 'right', render: (_, record) => renderBookingActions(record) }
    ];

    const historyColumns = [
        { title: 'BOOKING #', dataIndex: 'booking_no', key: 'booking_no', width: 140, render: (value) => <span className="bqm-id-text">{safeString(value)}</span> },
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

    const getQuotationLatestSend = (record) => {
        const history = safeArray(record.send_history);
        return safeObject(record.latest_send || history[0] || {});
    };

    const handleSendQuotation = (record) => {
        Modal.confirm({
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
        Modal.confirm({
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
        Modal.confirm({
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

    // ========================================================
    // BOOKING DETAILS STEPS - ENHANCED WITH MEAL SERVICES
    // ========================================================
    const bookingSteps = [
        { title: 'Customer', icon: <UserOutlined /> },
        { title: 'Event', icon: <CalendarOutlined /> },
        { title: 'Meals', icon: <ForkOutlined /> },
        { title: 'Requests', icon: <MessageOutlined /> },
        { title: 'Summary', icon: <DollarOutlined /> }
    ];

    const renderBookingStepContent = () => {
        if (!selectedBooking) return null;

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
                            {/* ENHANCED MEAL SERVICES RENDERER */}
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

    // ========================================================
    // UI CLASSES
    // ========================================================
    const containerClass = `bqm-container ${isDarkMode ? 'bqm-dark-mode' : ''}`;
    const headerClass = `bqm-header ${isDarkMode ? 'bqm-header-dark' : ''}`;
    const mainCardClass = `bqm-main-card ${isDarkMode ? 'bqm-main-card-dark' : ''}`;
    const filtersClass = `bqm-filters ${isDarkMode ? 'bqm-filters-dark' : ''}`;
    const filterGroupClass = `bqm-filter-group ${isDarkMode ? 'bqm-filter-group-dark' : ''}`;
    const tableClass = `bqm-table ${isDarkMode ? 'bqm-table-dark' : ''}`;
    const isLoading = regularBookingsLoading || multiDayBookingsLoading || completedBookingsLoading || quotationsLoading;

    // ========================================================
    // RENDER
    // ========================================================
    return (
        <App>
            <ConfigProvider theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
                <div className={containerClass}>
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

                    <div className="bqm-kpi-grid">
                        <div className="bqm-kpi-card"><div className="bqm-kpi-icon blue"><CalendarOutlined /></div><div className="bqm-kpi-stats"><div className="bqm-kpi-value">{safeNumber(stats.total_bookings)}</div><div className="bqm-kpi-label">Total Bookings</div></div></div>
                        <div className="bqm-kpi-card"><div className="bqm-kpi-icon orange"><ClockCircleOutlined /></div><div className="bqm-kpi-stats"><div className="bqm-kpi-value">{safeNumber(stats.pending_approvals)}</div><div className="bqm-kpi-label">Pending Approvals</div></div></div>
                        <div className="bqm-kpi-card"><div className="bqm-kpi-icon green"><WalletOutlined /></div><div className="bqm-kpi-stats"><div className="bqm-kpi-value">{formatCurrency(stats.total_revenue)}</div><div className="bqm-kpi-label">Total Revenue</div></div></div>
                        <div className="bqm-kpi-card"><div className="bqm-kpi-icon red"><WarningOutlined /></div><div className="bqm-kpi-stats"><div className="bqm-kpi-value">{formatCurrency(stats.total_outstanding)}</div><div className="bqm-kpi-label">Outstanding Balance</div></div></div>
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

                                            <Spin spinning={isLoading} indicator={<LoadingOutlined spin />}>
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
                                                                        rowKey={(record) => getBookingId(record)}
                                                                        className={tableClass}
                                                                        scroll={{ x: 1200, y: TABLE_SCROLL_HEIGHT }}
                                                                        pagination={false}
                                                                        bordered={false}
                                                                        size="middle"
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
                                                                        rowKey={(record) => getBookingId(record)}
                                                                        className={tableClass}
                                                                        scroll={{ x: 1200, y: TABLE_SCROLL_HEIGHT }}
                                                                        pagination={false}
                                                                        bordered={false}
                                                                        size="middle"
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
                                            </Spin>
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

                    {/* ====================================================
                        BOOKING DETAILS MODAL - ENHANCED
                    ==================================================== */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><EyeOutlined /></div>
                                <div className="bqm-modal-title-text">Booking Details</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                            </div>
                        }
                        open={bookingDetailsModalVisible}
                        onCancel={() => setBookingDetailsModalVisible(false)}
                        maskClosable={false}
                        keyboard={false}
                        closable={true}
                        width={850}
                        className="bqm-modal-clean bqm-modal-no-scroll"
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

                    {/* ====================================================
                        CREATE BOOKING MODAL - FIXED SUBMIT BUTTON
                    ==================================================== */}
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
                                Modal.confirm({
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
                                                    Modal.confirm({
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

                    {/* ====================================================
                        ADD MEAL / MENU SELECTION MODALS
                    ==================================================== */}
                    {renderAddMealModal()}
                    {renderMenuSelectionModal()}

                    {/* ====================================================
                        REJECT MODAL
                    ==================================================== */}
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

                    {/* ====================================================
                        RESCHEDULE MODAL
                    ==================================================== */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><SyncOutlined /></div>
                                <div className="bqm-modal-title-text">Request Reschedule</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                            </div>
                        }
                        open={rescheduleModalVisible}
                        onCancel={() => setRescheduleModalVisible(false)}
                        maskClosable={false}
                        keyboard={false}
                        footer={null}
                        width={500}
                        className="bqm-modal-clean"
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content">
                            <Alert
                                message="Customer-Requested Reschedule"
                                description={`Current event date: ${formatDateSafe(selectedBooking?.event_date)} at ${selectedBooking?.event_time}`}
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Form form={rescheduleForm} layout="vertical" onFinish={handleReschedule}>
                                <Form.Item
                                    name="new_date"
                                    label="Requested New Date"
                                    rules={[{ required: true }]}
                                    extra="This is the date the customer has requested"
                                >
                                    <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current < dayjs().startOf('day')} />
                                </Form.Item>
                                <Form.Item
                                    name="new_time"
                                    label="Requested New Time"
                                    rules={[{ required: true }]}
                                    extra="This is the time the customer has requested"
                                >
                                    <Select placeholder="Select time">
                                        {timeOptions.map(time => <Option key={time} value={time}>{time}</Option>)}
                                    </Select>
                                </Form.Item>
                                <Form.Item name="reason" label="Reason for Reschedule" rules={[{ required: true }]}>
                                    <TextArea rows={3} placeholder="Please provide a reason for the reschedule..." />
                                </Form.Item>
                                <div className="bqm-modal-buttons-clean">
                                    <Button onClick={() => setRescheduleModalVisible(false)}>Cancel</Button>
                                    <Button type="primary" htmlType="submit">Submit Reschedule Request</Button>
                                </div>
                            </Form>
                        </div>
                    </Modal>

                    {/* ====================================================
                        CANCEL MODAL
                    ==================================================== */}
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

                    {/* ====================================================
                        CALENDAR AVAILABILITY MODAL
                    ==================================================== */}
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
                        destroyOnHidden={true}
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