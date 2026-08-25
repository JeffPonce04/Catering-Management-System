// src/components/UnifiedOrderEventsManagement.jsx
// COMPLETE VERSION - All features fully functional with all fixes

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    App,
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    Col,
    ConfigProvider,
    DatePicker,
    Divider,
    Dropdown,
    Empty,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Pagination,
    Popconfirm,
    Progress,
    Row,
    Select,
    Space,
    Spin,
    Statistic,
    Table,
    Tabs,
    Tag,
    TimePicker,
    Tooltip,
    Typography,
    theme as antdTheme,
} from 'antd';

import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    EyeOutlined,
    SearchOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    UserOutlined,
    MoreOutlined,
    TeamOutlined,
    CloseCircleOutlined,
    SaveOutlined,
    PrinterOutlined,
    ExportOutlined,
    TruckOutlined,
    PlayCircleOutlined,
    EnvironmentOutlined,
    ScheduleOutlined,
    PhoneOutlined,
    MailOutlined,
    FlagOutlined,
    FilterOutlined,
    DashboardOutlined,
    OrderedListOutlined,
    PlusCircleOutlined,
    UserAddOutlined,
    CheckSquareOutlined,
    FileTextOutlined,
    WarningOutlined,
    SwapOutlined,
    SyncOutlined,
    CarOutlined,
    HomeOutlined,
    LeftOutlined,
    RightOutlined,
    DollarOutlined,
    AppstoreOutlined,
    HistoryOutlined,
    ShoppingOutlined,
    WalletOutlined,
    StockOutlined,
    CoffeeOutlined,
    ForkOutlined,
    CrownOutlined,
    DownOutlined,
} from '@ant-design/icons';

import { MdEventNote } from "react-icons/md";

import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import '../styles/UnifiedOrderEvents.css';

import {
    useBookings,
    useBookingStatistics,
    useEventTypes,
    useConfirmBooking,
    useRejectBooking,
    syncBookingInCache,
} from '../../../hooks/useBookingQuotation';

import {
    useOrders,
    useOrderStatistics,
    useKitchenOrders,
    useDeliveryOrders,
    useAddToKitchen,
    useRemoveFromKitchen,
    useAddToDelivery,
    useRemoveFromDelivery,
    useUpdateOrderStatus,
    useUpdateKitchenTask,
    useUpdateDeliveryItem,
    useAddToShoppingList,
    useDeleteOrder,
    useCreateOrder,
    useUpdateOrder,
} from '../../../hooks/useOrders';

import {
    useEvents,
    useEventStaff,
    useEventChecklist,
    useEventDeliveries,
    useEventEquipment,
    useEventProgress,
    useAssignStaff,
    useUpdateStaffStatus,
    useRemoveStaff,
    useAddChecklistItem,
    useUpdateChecklistItem,
    useDeleteChecklistItem,
    useAddDelivery,
    useUpdateDeliveryStatus,
    useApproveSelectedEquipment,
    useApproveAllEquipment,
    useReturnEquipment,
    useCompleteEvent,
} from '../../../hooks/useEvents';

import { useShoppingList } from '../../../hooks/useShoppingList';
import api from '../../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// ============================================================
// CONSTANTS
// ============================================================
const MEAL_STATUS_OPTIONS = ['pending', 'preparing', 'ready_for_delivery', 'dispatched', 'delivered', 'serving', 'served', 'completed', 'cancelled'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const formatBookingId = (bookingNo) => {
    if (!bookingNo) return 'N/A';
    if (bookingNo.match(/^BK-\d+$/i)) return bookingNo.toUpperCase();
    if (/^\d+$/.test(bookingNo)) return `BK-${bookingNo.padStart(4, '0')}`;
    if (bookingNo.toUpperCase().startsWith('BK')) {
        const numbers = bookingNo.match(/\d+/g);
        if (numbers) return `BK-${numbers[0].padStart(4, '0')}`;
    }
    return bookingNo;
};

const formatCurrency = (value) => {
    if (!value && value !== 0) return '₱0.00';
    return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
};

const safeString = (value, defaultValue = '') => {
    if (value === null || value === undefined) return defaultValue;
    return String(value);
};

const safeArray = (value, defaultValue = []) => {
    if (Array.isArray(value)) return value;
    return defaultValue;
};

const normalizeApiResponse = (response) => {
    if (!response) return null;
    if (response.success !== undefined) return response.data || response;
    if (response.data && response.data.success !== undefined) return response.data.data || response.data;
    if (response.data && response.data.data !== undefined) return response.data;
    return response;
};

const normalizeBookingCollection = (bookingsData) => {
    const rawData = bookingsData?.data || bookingsData || [];
    let dataArray = [];

    if (rawData && typeof rawData === 'object') {
        if (Array.isArray(rawData.data)) {
            dataArray = rawData.data;
        } else if (Array.isArray(rawData)) {
            dataArray = rawData;
        } else if (rawData.data && Array.isArray(rawData.data.data)) {
            dataArray = rawData.data.data;
        }
    }

    return safeArray(dataArray).map((raw) => {
        const event = raw.serviceEvent || raw.service_event || {};
        const person = event.customer?.person || {};
        const payments = safeArray(raw.payments);
        const totalAmount = safeNumber(raw.total_amount || raw.quotation?.total_amount || 0);
        const paidFromPayments = payments
            .filter((payment) => payment.status === 'completed')
            .reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
        const paidAmount = safeNumber(raw.paid_amount, paidFromPayments);
        const balance = safeNumber(raw.balance, Math.max(0, totalAmount - paidAmount));
        const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ');

        return {
            id: raw.booking_id || raw.id,
            booking_id: raw.booking_id || raw.id,
            booking_no: raw.booking_no || 'N/A',
            booking_status: raw.booking_status || raw.status || 'pending',
            customer_name: raw.customer_name || fullName || 'Unknown',
            customer_email: raw.customer_email || person.email,
            customer_phone: raw.customer_phone || person.phone,
            customer_address: raw.customer_address || person.address_line_1,
            event_type_id: event.event_type_id || raw.event_type_id,
            event_type_name: event.eventType?.name || event.event_type?.name || raw.event_type_name,
            booking_scope: event.booking_scope || raw.booking_scope || 'regular',
            event_date: event.event_date || raw.event_date,
            event_time: event.event_time || raw.event_time,
            venue: event.venue || raw.venue,
            guests_count: event.guests_count || raw.guests_count || 0,
            service_type: event.service_type || raw.service_type,
            delivery_method: event.delivery_method || raw.delivery_method,
            special_requests: event.special_requests || raw.special_requests,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            balance,
            payments,
            meal_services: raw.meal_services || [],
            assigned_staff: raw.assigned_staff || [],
            assigned_staff_count: safeNumber(raw.assigned_staff_count, safeArray(raw.assigned_staff).length),
            total_staff_required: safeNumber(raw.total_staff_required, safeArray(raw.assigned_staff).length),
            event_completed: Boolean(raw.event_completed),
            event_done: Boolean(raw.event_done),
            event_done_at: raw.event_done_at || null,
            debt_booking_event: Boolean(raw.debt_booking_event),
            was_debt_booking_event: Boolean(raw.was_debt_booking_event || raw.debt_booking_event),
            completion_override_reason: raw.completion_override_reason || null,
            outstanding_balance: safeNumber(raw.outstanding_balance, balance),
            equipment_in_out: raw.equipment_in_out || raw.equipment || [],
            order: raw.order,
            invoice: raw.invoice,
            quotation: raw.quotation,
            kitchen_preparation: raw.kitchen_preparation || [],
            delivery_preparation: raw.delivery_preparation || [],
            delivery_tracking: raw.delivery_tracking || raw.deliveryTrackings || [],
            tracking: raw.tracking || [],
            progress: safeNumber(raw.progress, 0),
            menu_items: raw.menu_items || raw.items || [],
            created_at: raw.created_at,
            completed_at: raw.completed_at,
            _raw: raw,
        };
    }).filter(Boolean);
};

const extractKitchenTaskName = (value) => safeString(value, 'Kitchen task')
    .replace(/^\s*Day\s*\d+\s*-\s*[^:]+:\s*/i, '')
    .replace(/^\s*DAY\s*\d+\s*[:|-]\s*/i, '')
    .trim();

const extractKitchenDayNumber = (task, fallback = 1) => {
    const explicitDay = safeNumber(task?.day_number || task?.day || task?.event_day, 0);
    if (explicitDay > 0) return explicitDay;
    const originalTask = safeString(task?.task || task?.name);
    const match = originalTask.match(/Day\s*(\d+)/i);
    return match ? safeNumber(match[1], fallback) : fallback;
};

const formatKitchenServingTime = (value) => {
    const text = safeString(value).trim();
    if (!text) return '';
    if (/\b(?:AM|PM)\b/i.test(text)) return text.toUpperCase();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return text;
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const twelveHour = hour % 12 || 12;
    return `${twelveHour}:${minute} ${suffix}`;
};

const formatKitchenMealType = (value) => {
    const text = safeString(value, 'Meal').replace(/_/g, ' ').trim();
    return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const toTimePickerValue = (value, fallbackHour = 8) => {
    const text = safeString(value).trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);

    let hour = fallbackHour;
    let minute = 0;

    if (match) {
        hour = Math.min(23, Math.max(0, Number(match[1])));
        minute = Math.min(59, Math.max(0, Number(match[2])));
        const meridiem = match[3]?.toUpperCase();

        if (meridiem === 'AM' && hour === 12) hour = 0;
        if (meridiem === 'PM' && hour < 12) hour += 12;
    }

    return dayjs().hour(hour).minute(minute).second(0).millisecond(0);
};

const formatKitchenGroupTitle = (task) => {
    const serviceDate = task?.service_date || task?.date || 'Date TBD';
    const mealType = formatKitchenMealType(task?.meal_type || task?.meal || 'Meal');
    const servingTime = formatKitchenServingTime(task?.serving_time || task?.time);
    const dayNumber = extractKitchenDayNumber(task, 1);
    return `${serviceDate} ${mealType}${servingTime ? ` ${servingTime}` : ''} - DAY ${dayNumber}`;
};

const normalizeKitchenTask = (task, index = 0, booking = null) => ({
    ...task,
    id: task?.id || task?.task_id || `kitchen-${index}`,
    task: extractKitchenTaskName(task?.task || task?.name),
    quantity: task?.quantity || task?.qty || '',
    start_time: task?.start_time || task?.start || '',
    out_for_delivery: task?.out_for_delivery || task?.end_time || task?.deadline || '',
    assigned_to: task?.assigned_to || 'Kitchen Team',
    notes: task?.notes || '',
    status: task?.status || (task?.is_done ? 'completed' : 'pending'),
    is_done: Boolean(task?.is_done || task?.status === 'completed'),
    is_header: Boolean(task?.is_header),
    meal_type: task?.meal_type || task?.meal || 'Meal',
    service_date: task?.service_date || task?.date || booking?.event_date || '',
    serving_time: task?.serving_time || task?.time || '',
    day_number: extractKitchenDayNumber(task, 1),
});

// ============================================================
// STATUS CONFIGURATION
// ============================================================
const getStatusConfig = (status) => {
    const config = {
        pending: { color: '#f97316', text: 'Pending', icon: <ClockCircleOutlined />, bg: '#fff7ed' },
        pending_approval: { color: '#f97316', text: 'Pending Approval', icon: <ClockCircleOutlined />, bg: '#fff7ed' },
        confirmed: { color: '#22c55e', text: 'Confirmed', icon: <CheckCircleOutlined />, bg: '#f0fdf4' },
        rescheduled: { color: '#8b5cf6', text: 'Rescheduled', icon: <SyncOutlined />, bg: '#f5f3ff' },
        reschedule_requested: { color: '#f59e0b', text: 'Reschedule Requested', icon: <SyncOutlined />, bg: '#fffbeb' },
        preparing: { color: '#3b82f6', text: 'Preparing', icon: <SyncOutlined spin />, bg: '#eff6ff' },
        ready: { color: '#10b981', text: 'Ready', icon: <CheckCircleOutlined />, bg: '#ecfdf5' },
        ongoing: { color: '#f59e0b', text: 'Ongoing', icon: <PlayCircleOutlined />, bg: '#fffbeb' },
        done: { color: '#0f766e', text: 'Done', icon: <CheckCircleOutlined />, bg: '#ccfbf1' },
        completed: { color: '#10b981', text: 'Completed', icon: <CheckCircleOutlined />, bg: '#ecfdf5' },
        cancelled: { color: '#ef4444', text: 'Cancelled', icon: <CloseCircleOutlined />, bg: '#fef2f2' },
        rejected: { color: '#ef4444', text: 'Rejected', icon: <CloseCircleOutlined />, bg: '#fef2f2' },
        approved: { color: '#22c55e', text: 'Approved', icon: <CheckCircleOutlined />, bg: '#f0fdf4' },
        upcoming: { color: '#3b82f6', text: 'Upcoming', icon: <ClockCircleOutlined />, bg: '#eff6ff' },
        reserved: { color: '#8b5cf6', text: 'Reserved', icon: <ClockCircleOutlined />, bg: '#f5f3ff' },
        checked_out: { color: '#f59e0b', text: 'In Use', icon: <PlayCircleOutlined />, bg: '#fffbeb' },
        in_use: { color: '#f59e0b', text: 'In Use', icon: <PlayCircleOutlined />, bg: '#fffbeb' },
        returned: { color: '#10b981', text: 'Available', icon: <CheckCircleOutlined />, bg: '#ecfdf5' },
        available: { color: '#10b981', text: 'Available', icon: <CheckCircleOutlined />, bg: '#ecfdf5' },
    };
    return config[status] || config.pending;
};

const getBookingDisplayStatus = (booking) => {
    if (!booking) return 'pending';

    const backendStatus = safeString(booking.booking_status || booking.status, 'pending').toLowerCase();

    if (booking.event_completed || backendStatus === 'completed') return 'completed';
    if (booking.event_done) return 'done';

    return backendStatus;
};

const getEventTypeName = (eventTypeId, eventTypes) => {
    if (!eventTypes || !Array.isArray(eventTypes)) return 'Unknown';
    const found = eventTypes.find(e => Number(e.event_type_id || e.id) === Number(eventTypeId));
    return found?.name || 'Unknown';
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const UnifiedOrderEventsManagement = () => {
    const isMounted = useRef(true);
    const { message } = App.useApp();
    const queryClient = useQueryClient();

    // ========================================================
    // STATE
    // ========================================================
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });

    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEventType, setFilterEventType] = useState('all');
    const [selectedDate, setSelectedDate] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeTab, setActiveTab] = useState('orders');

    const [historySearchText, setHistorySearchText] = useState('');
    const [historyFilterStatus, setHistoryFilterStatus] = useState('all');
    const [historyDateRange, setHistoryDateRange] = useState([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);

    const [selectedBooking, setSelectedBooking] = useState(null);
    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [statusUpdateModalVisible, setStatusUpdateModalVisible] = useState(false);

    const [ingredientsModalVisible, setIngredientsModalVisible] = useState(false);
    const [computedIngredients, setComputedIngredients] = useState([]);
    const [isComputingIngredients, setIsComputingIngredients] = useState(false);
    const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
    const [ingredientMenuItems, setIngredientMenuItems] = useState([]);
    const [selectedIngredientMenuItemIds, setSelectedIngredientMenuItemIds] = useState([]);

    const [kitchenModalVisible, setKitchenModalVisible] = useState(false);
    const [kitchenTasks, setKitchenTasks] = useState([]);
    const [kitchenLoading, setKitchenLoading] = useState(false);

    const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
    const [deliveryItems, setDeliveryItems] = useState([]);
    const [deliveryCurrentPage, setDeliveryCurrentPage] = useState(1);
    const [deliveryPageSize, setDeliveryPageSize] = useState(5);
    const [showAddDeliveryItem, setShowAddDeliveryItem] = useState(false);
    const [availableEquipment, setAvailableEquipment] = useState([]);
    const [availableInventoryItems, setAvailableInventoryItems] = useState([]);
    const [selectedEquipment, setSelectedEquipment] = useState({});
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [equipmentSearch, setEquipmentSearch] = useState('');

    const [staffAssignmentModalVisible, setStaffAssignmentModalVisible] = useState(false);
    const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
    const [staffList, setStaffList] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffForm] = Form.useForm();
    const [assignedStaff, setAssignedStaff] = useState([]);

    const [checklistModalVisible, setChecklistModalVisible] = useState(false);
    const [checklist, setChecklist] = useState([]);
    const [checklistLoading, setChecklistLoading] = useState(false);

    const [deliveryTrackingModalVisible, setDeliveryTrackingModalVisible] = useState(false);
    const [deliveryTrackings, setDeliveryTrackings] = useState([]);
    const [deliveryTrackingLoading, setDeliveryTrackingLoading] = useState(false);
    const [addDeliveryModalVisible, setAddDeliveryModalVisible] = useState(false);
    const [addDeliveryForm] = Form.useForm();
    const [editingDelivery, setEditingDelivery] = useState(null);

    const [equipmentCheckoutModalVisible, setEquipmentCheckoutModalVisible] = useState(false);
    const [equipmentReturnModalVisible, setEquipmentReturnModalVisible] = useState(false);
    const [selectedEquipmentItem, setSelectedEquipmentItem] = useState(null);
    const [equipmentForm] = Form.useForm();

    const [liveStatusModalVisible, setLiveStatusModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentForm] = Form.useForm();
    const [editForm] = Form.useForm();

    // Equipment Details Modal State
    const [equipmentDetailsModalVisible, setEquipmentDetailsModalVisible] = useState(false);
    const [equipmentDetailsData, setEquipmentDetailsData] = useState([]);
    const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);

    // View Modal - All in One
    const [viewModalData, setViewModalData] = useState(null);

    // ========================================================
    // API HOOKS - CONNECTED TO BACKEND
    // ========================================================
    const {
        data: activeBookingsData,
        isLoading: activeBookingsLoading,
        refetch: refetchActiveBookings,
    } = useBookings({
        status_in: 'confirmed,rescheduled,approved,ongoing',
        search: searchText || undefined,
        event_type_id: filterEventType !== 'all' ? filterEventType : undefined,
        event_date: selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : undefined,
        page: 1,
        per_page: 100,
    });

    const {
        data: historyBookingsData,
        isLoading: historyBookingsLoading,
        refetch: refetchHistoryBookings,
    } = useBookings({
        status: historyFilterStatus !== 'all' ? historyFilterStatus : undefined,
        status_in: historyFilterStatus === 'all' ? 'completed,cancelled,rejected' : undefined,
        search: historySearchText || undefined,
        date_from: historyDateRange?.[0] ? dayjs(historyDateRange[0]).format('YYYY-MM-DD') : undefined,
        date_to: historyDateRange?.[1] ? dayjs(historyDateRange[1]).format('YYYY-MM-DD') : undefined,
        page: 1,
        per_page: 100,
    });

    const bookingsLoading = activeBookingsLoading || historyBookingsLoading;
    const refetchBookings = useCallback(() => Promise.allSettled([
        refetchActiveBookings(),
        refetchHistoryBookings(),
    ]), [refetchActiveBookings, refetchHistoryBookings]);

    const { data: statistics, refetch: refetchStatistics } = useBookingStatistics();
    const { data: eventTypesData, refetch: refetchEventTypes } = useEventTypes();
    const eventTypes = safeArray(eventTypesData);

    const { data: kitchenOrders, refetch: refetchKitchenOrders } = useKitchenOrders();
    const { data: deliveryOrders, refetch: refetchDeliveryOrders } = useDeliveryOrders();
    const { data: shoppingList, refetch: refetchShoppingList } = useShoppingList();

    const confirmBookingMutation = useConfirmBooking();
    const rejectBookingMutation = useRejectBooking();
    const addToKitchenMutation = useAddToKitchen();
    const removeFromKitchenMutation = useRemoveFromKitchen();
    const addToDeliveryMutation = useAddToDelivery();
    const removeFromDeliveryMutation = useRemoveFromDelivery();
    const updateStatusMutation = useUpdateOrderStatus();
    const updateKitchenTaskMutation = useUpdateKitchenTask();
    const updateDeliveryItemMutation = useUpdateDeliveryItem();
    const addToShoppingListMutation = useAddToShoppingList();
    const deleteOrderMutation = useDeleteOrder();
    const createOrderMutation = useCreateOrder();
    const updateOrderMutation = useUpdateOrder();
    const assignStaffMutation = useAssignStaff();
    const updateStaffStatusMutation = useUpdateStaffStatus();
    const removeStaffMutation = useRemoveStaff();
    const addChecklistItemMutation = useAddChecklistItem();
    const updateChecklistItemMutation = useUpdateChecklistItem();
    const deleteChecklistItemMutation = useDeleteChecklistItem();
    const addDeliveryMutation = useAddDelivery();
    const updateDeliveryStatusMutation = useUpdateDeliveryStatus();
    const approveSelectedEquipmentMutation = useApproveSelectedEquipment();
    const approveAllEquipmentMutation = useApproveAllEquipment();
    const returnEquipmentMutation = useReturnEquipment();
    const completeEventMutation = useCompleteEvent();

    // ========================================================
    // THEME DETECTION
    // ========================================================
    useEffect(() => {
        isMounted.current = true;
        const updateTheme = () => {
            if (isMounted.current) {
                const isDark = document.body.classList.contains('dark-mode');
                setIsDarkMode(isDark);
            }
        };
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        const handleThemeChange = (e) => {
            if (isMounted.current) {
                setIsDarkMode(e.detail.isDark);
            }
        };
        const handleStorageChange = (e) => {
            if (e.key === 'theme' && isMounted.current) {
                setIsDarkMode(e.newValue === 'dark');
            }
        };
        window.addEventListener('themeChange', handleThemeChange);
        window.addEventListener('storage', handleStorageChange);
        return () => {
            isMounted.current = false;
            observer.disconnect();
            window.removeEventListener('themeChange', handleThemeChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // ========================================================
    // LOAD STAFF DATA FROM BACKEND
    // ========================================================
    useEffect(() => {
        const loadStaff = async () => {
            setStaffLoading(true);
            try {
                const response = await api.get('/employees/active');
                const staffData = normalizeApiResponse(response);
                if (isMounted.current) {
                    setStaffList(Array.isArray(staffData) ? staffData : []);
                }
            } catch (error) {
                console.error('Failed to load staff:', error);
                if (isMounted.current) {
                    setStaffList([]);
                }
            } finally {
                setStaffLoading(false);
            }
        };
        loadStaff();
    }, []);

    // ========================================================
    // DATA PROCESSING - CONNECTED TO BACKEND
    // ========================================================
    const allBookings = useMemo(
        () => normalizeBookingCollection(activeBookingsData),
        [activeBookingsData]
    );

    const historyBookings = useMemo(
        () => normalizeBookingCollection(historyBookingsData),
        [historyBookingsData]
    );

    const confirmedBookings = useMemo(() => {
        const activeRows = allBookings.filter((booking) => {
            const status = safeString(booking.booking_status).toLowerCase();
            return ['confirmed', 'rescheduled', 'approved', 'ongoing'].includes(status) && !booking.event_completed;
        });

        if (filterStatus === 'all') return activeRows;
        return activeRows.filter((booking) => getBookingDisplayStatus(booking) === filterStatus);
    }, [allBookings, filterStatus]);

    const ongoingBookings = useMemo(
        () => allBookings.filter((booking) => (
            safeString(booking.booking_status).toLowerCase() === 'ongoing'
            && !booking.event_done
            && !booking.event_completed
        )),
        [allBookings]
    );

    const completedBookings = useMemo(
        () => historyBookings.filter((booking) => {
            const status = String(booking.booking_status || '').toLowerCase();
            return ['completed', 'cancelled', 'rejected'].includes(status) || booking.event_completed;
        }),
        [historyBookings]
    );

    const stats = useMemo(() => {
        const combinedBookings = [...allBookings, ...completedBookings];
        const confirmed = allBookings.filter((booking) => {
            const status = String(booking.booking_status || '').toLowerCase();
            return ['confirmed', 'rescheduled', 'approved', 'ongoing'].includes(status) && !booking.event_completed;
        }).length;
        const ongoing = ongoingBookings.length;
        const completed = completedBookings.filter((booking) => String(booking.booking_status || '').toLowerCase() === 'completed' || booking.event_completed).length;
        const totalRevenue = combinedBookings.reduce((sum, booking) => sum + safeNumber(booking.total_amount), 0);
        const outstandingBalance = combinedBookings.reduce((sum, booking) => sum + safeNumber(booking.balance || 0), 0);

        return {
            confirmed_bookings: confirmed,
            ongoing,
            completed,
            total_revenue: totalRevenue,
            outstanding_balance: outstandingBalance,
        };
    }, [allBookings, ongoingBookings, completedBookings]);

    // ========================================================
    // EVENT HANDLERS - CONNECTED TO BACKEND
    // ========================================================
    const handleRefresh = () => {
        refetchBookings();
        refetchStatistics();
        refetchKitchenOrders();
        refetchDeliveryOrders();
        refetchShoppingList();
        refetchEventTypes();
        message.success('Data refreshed');
    };

    const handleViewDetails = (record) => {
        setSelectedBooking(record);
        setViewModalData(record);
        setViewModalVisible(true);
    };

    const handleEdit = (record) => {
        setSelectedBooking(record);
        editForm.setFieldsValue({
            customer_name: record.customer_name,
            customer_email: record.customer_email,
            customer_phone: record.customer_phone,
            venue: record.venue,
            event_type_id: record.event_type_id,
            guests_count: record.guests_count,
            event_date: record.event_date ? dayjs(record.event_date) : null,
            event_time: record.event_time,
            special_requests: record.special_requests,
        });
        setEditModalVisible(true);
    };

    const handleUpdateBooking = async (values) => {
        try {
            await api.put(`/bookings/${selectedBooking.id}`, values);
            message.success('Booking updated successfully');
            setEditModalVisible(false);
            refetchBookings();
            refetchStatistics();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to update booking');
        }
    };

    const handleUpdateStatus = (record) => {
        setSelectedBooking(record);
        setStatusUpdateModalVisible(true);
    };

    const handleConfirmStatusUpdate = async (status) => {
        if (!selectedBooking) return;
        try {
            await api.put(`/bookings/${selectedBooking.id}`, { booking_status: status });
            message.success(`Status updated to ${status} for Booking ${formatBookingId(selectedBooking.booking_no)}`);
            setStatusUpdateModalVisible(false);
            refetchBookings();
            refetchStatistics();
            refetchKitchenOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error('Failed to update status');
        }
    };

    const openPaymentForBooking = (record, amount = null, paymentType = null) => {
        const totalAmount = safeNumber(record.total_amount, 0);
        const paidAmount = safeNumber(record.paid_amount, 0);
        const completedPayments = safeArray(record.payments).filter((payment) => payment.status === 'completed');
        const hasReceivedPayment = paidAmount > 0 || completedPayments.length > 0;
        const balance = safeNumber(record.balance, Math.max(0, totalAmount - paidAmount));
        const suggestedType = paymentType || (hasReceivedPayment ? 'partial' : 'deposit');
        const suggestedAmount = amount === null || amount === undefined
            ? (hasReceivedPayment ? balance : Math.min(balance, totalAmount * 0.30))
            : safeNumber(amount, 0);

        setSelectedBooking(record);
        paymentForm.setFieldsValue({
            amount: Math.max(0, suggestedAmount),
            payment_type: suggestedType,
            payment_method: 'cash',
            notes: suggestedType === 'deposit' ? '30% event deposit' : 'Remaining event balance',
        });
        setPaymentModalVisible(true);
    };

    const requestOverrideReason = ({ title, warning, onConfirm }) => {
        let reason = '';
        Modal.confirm({
            title,
            content: (
                <div>
                    <Alert type="warning" showIcon message={warning} style={{ marginBottom: 12 }} />
                    <TextArea
                        rows={4}
                        maxLength={1000}
                        placeholder="Enter the reason for this override"
                        onChange={(event) => { reason = event.target.value; }}
                    />
                </div>
            ),
            okText: 'Confirm Override',
            cancelText: 'Cancel',
            okButtonProps: { danger: true },
            maskClosable: false,
            onOk: async () => {
                if (!reason.trim()) {
                    message.warning('A reason is required.');
                    return Promise.reject(new Error('Reason required'));
                }
                return onConfirm(reason.trim());
            },
        });
    };

    const refreshIntegratedModules = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['bookings', 'statistics'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['kitchen-orders'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['delivery-orders'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['shopping-list'], refetchType: 'active' });
        return Promise.allSettled([
            refetchActiveBookings(),
            refetchHistoryBookings(),
            refetchStatistics(),
            refetchKitchenOrders(),
            refetchDeliveryOrders(),
            refetchShoppingList(),
        ]);
    }, [
        queryClient,
        refetchActiveBookings,
        refetchHistoryBookings,
        refetchStatistics,
        refetchKitchenOrders,
        refetchDeliveryOrders,
        refetchShoppingList,
    ]);

    const submitStartEvent = async (record, reason = '', forceStart = false, options = {}) => {
        await api.post(`/events/${record.id}/start`, {
            force_start: forceStart,
            reason: reason || null,
        });

        const updatedBooking = {
            ...record,
            booking_status: 'ongoing',
            event_completed: false,
            event_done: false,
            event_done_at: null,
            progress: Math.max(10, safeNumber(record.progress, 0)),
        };
        syncBookingInCache(queryClient, updatedBooking);
        setSelectedBooking(updatedBooking);
        message.success(`Event "${record.customer_name || 'Event'}" has started`);

        queryClient.invalidateQueries({ queryKey: ['bookings', 'statistics'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'active' });
        refetchActiveBookings();

        if (options.openLiveStatusAfterStart) {
            setLiveStatusModalVisible(true);
        }
    };

    const handleStartEvent = async (record, options = {}) => {
        const scheduledDate = record.event_date;
        const isScheduledToday = scheduledDate ? dayjs(scheduledDate).isSame(dayjs(), 'day') : true;

        try {
            const response = await api.get(`/bookings/${record.id}/payment-summary`);
            const summary = normalizeApiResponse(response) || {};
            const totalAmount = safeNumber(summary.total_amount, record.total_amount);
            const totalPaid = safeNumber(summary.total_paid, record.paid_amount);
            const requiredDeposit = safeNumber(summary.required_deposit, totalAmount * 0.30);
            const depositBalance = Math.max(0, requiredDeposit - totalPaid);

            if (depositBalance > 0.01) {
                Modal.confirm({
                    title: '30% Deposit Required',
                    content: (
                        <div>
                            <p>The required deposit is <strong>{formatCurrency(requiredDeposit)}</strong>.</p>
                            <p>Paid: <strong>{formatCurrency(totalPaid)}</strong></p>
                            <p>Deposit balance: <strong style={{ color: '#ef4444' }}>{formatCurrency(depositBalance)}</strong></p>
                            <Alert
                                type="warning"
                                showIcon
                                message="Starting without the required deposit will be logged with the approver and reason."
                            />
                        </div>
                    ),
                    okText: 'Start Event Anyway',
                    cancelText: 'Pay Deposit',
                    okButtonProps: { danger: true },
                    maskClosable: false,
                    keyboard: false,
                    onCancel: () => openPaymentForBooking(record, depositBalance, 'deposit'),
                    onOk: () => requestOverrideReason({
                        title: 'Start Event Without Deposit',
                        warning: 'This approval will be saved in event history.',
                        onConfirm: (reason) => submitStartEvent(record, reason, true, options),
                    }),
                });
                return;
            }

            if (!isScheduledToday) {
                requestOverrideReason({
                    title: 'Start Outside Scheduled Date',
                    warning: `This event is scheduled for ${dayjs(record.event_date).format('MMMM D, YYYY')}.`,
                    onConfirm: (reason) => submitStartEvent(record, reason, true, options),
                });
                return;
            }

            if (options.skipFinalConfirmation) {
                await submitStartEvent(record, '', false, options);
                return;
            }

            Modal.confirm({
                title: 'Start Event',
                content: `Mark "${record.customer_name || 'Event'}" (${formatBookingId(record.booking_no)}) as ongoing?`,
                okText: 'Start Event',
                cancelText: 'Cancel',
                maskClosable: false,
                onOk: () => submitStartEvent(record, '', false, options),
            });
        } catch (error) {
            console.error('Failed to validate event start:', error);
            message.error(error.response?.data?.message || 'Failed to validate the deposit before starting the event');
        }
    };

    const handleOpenLiveStatus = (record) => {
        const status = safeString(record.booking_status).toLowerCase();

        if (record.event_completed || status === 'completed') {
            message.info('This event is already Complete and is available in Event History.');
            return;
        }

        if (record.event_done) {
            message.info('This event is marked as Done. Use Complete Event when it is ready to move to Event History.');
            return;
        }

        if (status === 'ongoing') {
            setSelectedBooking(record);
            setLiveStatusModalVisible(true);
            return;
        }

        Modal.confirm({
            title: 'The event has not started yet.',
            content: 'Would you like to start the event?',
            okText: 'Yes',
            cancelText: 'No',
            maskClosable: false,
            onOk: () => handleStartEvent(record, {
                openLiveStatusAfterStart: true,
                skipFinalConfirmation: true,
            }),
        });
    };

    const handleMarkEventDone = async (record) => {
        if (record.event_done) {
            message.info('This event is already marked as Done.');
            return;
        }

        Modal.confirm({
            title: 'Mark Event as Done',
            content: 'Mark the operational work as Done? The booking will remain in Confirmed Bookings but will be removed from Ongoing Events until it is marked Complete.',
            okText: 'Mark as Done',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await api.put(`/events/${record.id}/live-status`, {
                        is_done: true,
                        progress: 100,
                    });

                    const updatedBooking = {
                        ...record,
                        // The backend keeps the operational status as "ongoing" and stores
                        // the Done state in event metadata. The UI derives the visible
                        // status from event_done so existing backend validation is preserved.
                        booking_status: 'ongoing',
                        event_done: true,
                        event_done_at: new Date().toISOString(),
                        event_completed: false,
                        progress: 100,
                    };

                    syncBookingInCache(queryClient, updatedBooking);
                    setSelectedBooking(updatedBooking);
                    setLiveStatusModalVisible(false);
                    message.success('Event marked as Done and removed from Ongoing Events.');

                    queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'active' });
                    queryClient.invalidateQueries({ queryKey: ['bookings', 'statistics'], refetchType: 'active' });
                    refetchActiveBookings();
                } catch (error) {
                    console.error('Mark event as Done error:', error);
                    message.error(error.response?.data?.message || 'Failed to mark the event as Done');
                    throw error;
                }
            },
        });
    };

    const submitCompleteEvent = async (record, reason = '', forceComplete = false) => {
        await api.post(`/events/${record.id}/complete`, {
            force_complete: forceComplete,
            reason: reason || null,
        });

        const updatedBooking = {
            ...record,
            booking_status: 'completed',
            event_completed: true,
            event_done: true,
            event_done_at: record.event_done_at || new Date().toISOString(),
            completed_at: new Date().toISOString(),
            debt_booking_event: forceComplete && safeNumber(record.balance, 0) > 0.01,
            was_debt_booking_event: forceComplete || record.was_debt_booking_event,
            progress: 100,
        };
        syncBookingInCache(queryClient, updatedBooking);
        setSelectedBooking(updatedBooking);
        setLiveStatusModalVisible(false);
        message.success(forceComplete
            ? 'Event completed and moved to Event History with its outstanding balance recorded'
            : 'Event completed and moved to Event History');

        queryClient.invalidateQueries({ queryKey: ['bookings', 'statistics'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' });
        Promise.allSettled([refetchActiveBookings(), refetchHistoryBookings()]);
    };

    const handleCompleteEvent = async (record) => {
        try {
            const response = await api.get(`/bookings/${record.id}/payment-summary`);
            const summary = normalizeApiResponse(response) || {};
            const balance = safeNumber(summary.balance, record.balance);

            if (balance > 0.01) {
                Modal.confirm({
                    title: 'Remaining Balance Detected',
                    content: (
                        <div>
                            <p>Outstanding balance: <strong style={{ color: '#ef4444' }}>{formatCurrency(balance)}</strong></p>
                            <Alert
                                type="warning"
                                showIcon
                                message="Completing now will move the event to Event History and record the unpaid balance as a Debt Booking Event."
                            />
                        </div>
                    ),
                    okText: 'Complete Event Anyway',
                    cancelText: 'Pay Remaining Balance',
                    okButtonProps: { danger: true },
                    maskClosable: false,
                    keyboard: false,
                    onCancel: () => openPaymentForBooking(record, balance, 'full'),
                    onOk: () => requestOverrideReason({
                        title: 'Complete as Debt Booking Event',
                        warning: 'The unpaid balance, reason, approver, and completion time will be saved in Event History.',
                        onConfirm: (reason) => submitCompleteEvent({ ...record, balance }, reason, true),
                    }),
                });
                return;
            }

            Modal.confirm({
                title: 'Complete Event',
                content: `Mark "${record.customer_name || 'Event'}" (${formatBookingId(record.booking_no)}) as completed and move it to Event History?`,
                okText: 'Complete',
                cancelText: 'Cancel',
                maskClosable: false,
                onOk: () => submitCompleteEvent(record),
            });
        } catch (error) {
            console.error('Complete event validation error:', error);
            message.error(error.response?.data?.message || 'Failed to validate event completion');
        }
    };

    // ========================================================
    // EQUIPMENT DETAILS HANDLER
    // ========================================================
    const handleViewEquipmentDetails = (record) => {
        setSelectedBooking(record);
        const equipment = safeArray(record.equipment_in_out);
        setEquipmentDetailsData(equipment);
        setSelectedEquipmentIds([]);
        setEquipmentDetailsModalVisible(true);
    };

    const handleSelectEquipment = (id, checked) => {
        setSelectedEquipmentIds(prev => 
            checked ? [...prev, id] : prev.filter(itemId => itemId !== id)
        );
    };

    const handleSelectAllEquipment = (checked) => {
        if (checked) {
            setSelectedEquipmentIds(equipmentDetailsData
                .filter((item) => !item.is_out_approved && !['checked_out', 'returned'].includes(item.status))
                .map((item) => item.id));
        } else {
            setSelectedEquipmentIds([]);
        }
    };

    const applyEquipmentResponse = (response, fallbackStatus = null) => {
        const responsePayload = normalizeApiResponse(response) || {};
        const equipmentPayload = responsePayload.equipment || responsePayload;
        const responseRows = safeArray(equipmentPayload?.equipment || equipmentPayload);
        const nextRows = responseRows.length > 0
            ? responseRows
            : equipmentDetailsData.map((item) => (
                fallbackStatus && selectedEquipmentIds.includes(item.id)
                    ? { ...item, status: fallbackStatus, is_out_approved: fallbackStatus === 'checked_out' }
                    : item
            ));

        setEquipmentDetailsData(nextRows);
        const updatedBooking = {
            ...selectedBooking,
            equipment_in_out: nextRows,
        };
        setSelectedBooking(updatedBooking);
        syncBookingInCache(queryClient, updatedBooking);
        queryClient.invalidateQueries({ queryKey: ['events', selectedBooking.id, 'equipment'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['inventory', 'equipment'], refetchType: 'active' });
        return nextRows;
    };

    const handleApproveSelectedEquipmentFromDetails = async () => {
        if (selectedEquipmentIds.length === 0) {
            message.warning('Please select at least one equipment item to approve');
            return;
        }
        try {
            const response = await approveSelectedEquipmentMutation.mutateAsync({
                eventId: selectedBooking.id,
                data: {
                    equipment_item_ids: selectedEquipmentIds,
                    checked_out_by: 'Event Management',
                },
            });
            applyEquipmentResponse(response, 'checked_out');
            setSelectedEquipmentIds([]);
        } catch (error) {
            // The React Query hook displays the backend error message.
        }
    };

    const handleApproveAllEquipmentFromDetails = async (formValues = {}) => {
        try {
            const response = await approveAllEquipmentMutation.mutateAsync({
                eventId: selectedBooking.id,
                data: {
                    checked_out_by: formValues.checked_out_by || 'Event Management',
                    expected_return_date: formValues.expected_return_date?.format?.('YYYY-MM-DD') || formValues.expected_return_date,
                    condition_out: formValues.condition_out,
                    notes: formValues.notes,
                },
            });
            const responsePayload = normalizeApiResponse(response) || {};
            const equipmentPayload = responsePayload.equipment || responsePayload;
            const responseRows = safeArray(equipmentPayload?.equipment || equipmentPayload);
            const nextRows = responseRows.length > 0
                ? responseRows
                : equipmentDetailsData.map((item) => (
                    item.status === 'returned' ? item : { ...item, status: 'checked_out', is_out_approved: true }
                ));
            setEquipmentDetailsData(nextRows);
            const updatedBooking = { ...selectedBooking, equipment_in_out: nextRows };
            setSelectedBooking(updatedBooking);
            syncBookingInCache(queryClient, updatedBooking);
            setEquipmentCheckoutModalVisible(false);
            equipmentForm.resetFields();
            queryClient.invalidateQueries({ queryKey: ['inventory', 'equipment'], refetchType: 'active' });
        } catch (error) {
            // The React Query hook displays the backend error message.
        }
    };

    const handleApproveAllEquipment = async (record) => {
        setSelectedBooking(record);
        try {
            const response = await approveAllEquipmentMutation.mutateAsync({
                eventId: record.id,
                data: { checked_out_by: 'Event Management' },
            });
            const responsePayload = normalizeApiResponse(response) || {};
            const equipmentPayload = responsePayload.equipment || responsePayload;
            const responseRows = safeArray(equipmentPayload?.equipment || equipmentPayload);
            if (responseRows.length > 0) {
                const updatedBooking = { ...record, equipment_in_out: responseRows };
                syncBookingInCache(queryClient, updatedBooking);
            }
            queryClient.invalidateQueries({ queryKey: ['inventory', 'equipment'], refetchType: 'active' });
        } catch (error) {
            // The React Query hook displays the backend error message.
        }
    };

    const handleReturnEquipmentFromDetails = async (item) => {
        setSelectedEquipmentItem(item);
        equipmentForm.resetFields();
        setEquipmentReturnModalVisible(true);
    };

    const handleReturnEquipment = async (values) => {
        if (!selectedEquipmentItem) {
            await handleApproveAllEquipmentFromDetails(values);
            return;
        }

        try {
            const response = await returnEquipmentMutation.mutateAsync({
                eventId: selectedBooking.id,
                transactionId: selectedEquipmentItem.id || selectedEquipmentItem.booking_equipment_id,
                data: {
                    ...values,
                    notes: values.return_notes || values.notes || null,
                    quantity_used: safeNumber(values.quantity_used, selectedEquipmentItem.quantity_reserved),
                },
            });
            const responsePayload = normalizeApiResponse(response) || {};
            const returnedRow = responsePayload.booking_equipment_id || responsePayload.id
                ? responsePayload
                : { ...selectedEquipmentItem, status: 'returned', ...values };
            const nextRows = equipmentDetailsData.map((item) => (
                String(item.id) === String(selectedEquipmentItem.id)
                    ? { ...item, ...returnedRow, status: 'returned' }
                    : item
            ));
            setEquipmentDetailsData(nextRows);
            const updatedBooking = { ...selectedBooking, equipment_in_out: nextRows };
            setSelectedBooking(updatedBooking);
            syncBookingInCache(queryClient, updatedBooking);
            setEquipmentReturnModalVisible(false);
            setSelectedEquipmentItem(null);
            equipmentForm.resetFields();
            queryClient.invalidateQueries({ queryKey: ['inventory', 'equipment'], refetchType: 'active' });
        } catch (error) {
            // The React Query hook displays the backend error message.
        }
    };

    // ========================================================
    // KITCHEN FUNCTIONS WITH PRINT
    // ========================================================
    const groupKitchenTasksByMeal = (tasks) => {
        const groups = {};
        safeArray(tasks).filter((task) => !task.is_header).forEach((task, index) => {
            const normalizedTask = normalizeKitchenTask(task, index, selectedBooking);
            const key = [
                normalizedTask.service_date,
                normalizedTask.day_number,
                normalizedTask.meal_type,
                normalizedTask.serving_time,
            ].join('|');
            if (!groups[key]) {
                groups[key] = {
                    label: formatKitchenGroupTitle(normalizedTask),
                    tasks: [],
                };
            }
            groups[key].tasks.push(normalizedTask);
        });
        return Object.values(groups);
    };

    const normalizeKitchenTasksFromBackend = (booking) => {
        const directTasks = safeArray(booking?.kitchen_preparation);
        const rawTasks = directTasks.length > 0
            ? directTasks
            : safeArray(booking?._raw?.kitchen_preparation);

        if (rawTasks.length > 0) {
            return rawTasks.map((task, index) => normalizeKitchenTask(task, index, booking));
        }

        return safeArray(booking?.menu_items).map((item, index) => normalizeKitchenTask({
            ...item,
            id: item.id || `menu-${index}`,
            task: item.name || item.item_name || 'Menu item',
            quantity: safeNumber(item.quantity || item.total_quantity, 1),
            servings: safeNumber(item.quantity || item.total_quantity || booking?.guests_count, 1),
            meal_type: item.meal_type || 'Meal',
            service_date: item.service_date || booking?.event_date,
            serving_time: item.serving_time || '',
            day_number: item.day_number || item.day || 1,
            assigned_to: 'Kitchen Team',
            status: 'pending',
            is_done: false,
            is_header: false,
            start_time: item.preparation_time || '',
            out_for_delivery: item.dispatch_time || '',
        }, index, booking));
    };

    const handleViewKitchenPrep = async (record) => {
        setSelectedBooking(record);
        setKitchenLoading(true);
        setKitchenModalVisible(true);
        try {
            const orderId = record?.order?.order_id || record?.order?.id;
            let tasks = [];
            if (orderId) {
                const response = await api.get(`/orders/${orderId}/kitchen-tasks`);
                tasks = safeArray(normalizeApiResponse(response))
                    .map((task, index) => normalizeKitchenTask(task, index, record));
            }
            if (tasks.length === 0) tasks = normalizeKitchenTasksFromBackend(record);
            setKitchenTasks(tasks);
        } catch (error) {
            console.error('Failed to load kitchen tasks:', error);
            setKitchenTasks(normalizeKitchenTasksFromBackend(record));
        } finally {
            setKitchenLoading(false);
        }
    };

    const handleAddToKitchen = async (record) => {
        try {
            const orderId = record?.order?.order_id || record?.order?.id;
            if (!orderId) throw new Error('This booking does not have an order record yet.');
            await addToKitchenMutation.mutateAsync(orderId);
            message.success(`Kitchen Preparation refreshed for ${formatBookingId(record.booking_no)}`);
            await handleViewKitchenPrep(record);
            refetchBookings();
            refetchKitchenOrders();
        } catch (error) {
            message.error(error.response?.data?.message || error.message || 'Failed to refresh kitchen preparation');
        }
    };

    const handleUpdateKitchenTask = async (taskId, updates) => {
        try {
            const normalizedUpdates = {
                ...updates,
                status: updates.is_done ? 'completed' : updates.status || 'pending'
            };
            const updatedTasks = kitchenTasks.map(task =>
                task.id === taskId ? { ...task, ...normalizedUpdates } : task
            );
            setKitchenTasks(updatedTasks);

            const orderId = selectedBooking?.order?.order_id || selectedBooking?.order?.id;
            if (orderId) {
                await updateKitchenTaskMutation.mutateAsync({
                    orderId,
                    data: { tasks: updatedTasks }
                });
            }
            message.success('Kitchen checklist updated');
            refetchBookings();
            refetchKitchenOrders();
        } catch (error) {
            console.error('Update kitchen task error:', error);
            message.error('Failed to update kitchen task');
            handleViewKitchenPrep(selectedBooking);
        }
    };

    // ========================================================
    // KITCHEN PRINT FUNCTIONS
    // ========================================================
    const generateKitchenPrintHTML = (booking, groups, title) => {
        const customerName = booking?.customer_name || 'Unknown';
        const eventDate = booking?.event_date || 'N/A';
        const eventTime = booking?.event_time || 'N/A';
        const venue = booking?.venue || 'N/A';
        const pax = booking?.guests_count || 0;
        const bookingNo = booking?.booking_no || 'N/A';
        const currentDate = dayjs().format('MMMM D, YYYY');

        let tasksHTML = '';

        let allTasks = [];
        if (groups && groups.length > 0) {
            groups.forEach((group) => {
                group.tasks.forEach((task) => {
                    allTasks.push({
                        ...task,
                        meal_label: group.label
                    });
                });
            });
        } else {
            allTasks = kitchenTasks.filter(t => !t.is_header);
        }

        if (allTasks.length === 0) {
            tasksHTML = `
                <div class="empty-state">
                    <p>No kitchen tasks available for this booking.</p>
                </div>
            `;
        } else {
            const groupedByMeal = {};
            allTasks.forEach((task) => {
                const normalizedTask = normalizeKitchenTask(task, 0, booking);
                const key = formatKitchenGroupTitle(normalizedTask);
                if (!groupedByMeal[key]) groupedByMeal[key] = [];
                groupedByMeal[key].push(normalizedTask);
            });

            Object.keys(groupedByMeal).forEach(mealLabel => {
                const tasks = groupedByMeal[mealLabel];
                tasksHTML += `
                    <div class="meal-group">
                        <div class="meal-group-header">${mealLabel}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>TASK</th>
                                    <th>QTY</th>
                                    <th>START</th>
                                    <th>OUT FOR DELIVERY</th>
                                    <th>ASSIGNED TO</th>
                                    <th>DONE</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                tasks.forEach((task) => {
                    const isDone = task.is_done || task.status === 'completed';
                    const taskName = task.task || task.name || 'Task';
                    const quantity = task.quantity || task.servings || task.qty || 1;
                    const startTime = task.start_time || task.prepare_time || '-';
                    const outForDelivery = task.out_for_delivery || task.dispatch_time || '-';
                    const assignedTo = task.assigned_to || 'Kitchen Team';

                    tasksHTML += `
                        <tr>
                            <td>${taskName}</td>
                            <td>${quantity}</td>
                            <td>${startTime}</td>
                            <td>${outForDelivery}</td>
                            <td>${assignedTo}</td>
                            <td>${isDone ? '✓' : '☐'}</td>
                        </tr>
                    `;
                });

                tasksHTML += `
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Kitchen Preparation List - ${bookingNo}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                        padding: 30px;
                        color: #1e293b;
                        background: #ffffff;
                    }
                    .print-container { 
                        max-width: 1000px; 
                        margin: 0 auto; 
                        background: #ffffff;
                        padding: 20px;
                    }
                    .print-header {
                        text-align: center;
                        border-bottom: 2px solid #3b82f6;
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    .print-header h1 {
                        font-size: 24px;
                        color: #1a7ab5;
                        margin-bottom: 2px;
                        font-weight: 700;
                    }
                    .print-header .subtitle {
                        font-size: 12px;
                        color: #64748b;
                    }
                    .print-meta {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 8px;
                        background: #f8fafc;
                        padding: 12px 16px;
                        border-radius: 6px;
                        margin-bottom: 16px;
                        border: 1px solid #e2e8f0;
                    }
                    .print-meta .meta-item { 
                        display: flex; 
                        flex-direction: column; 
                    }
                    .print-meta .meta-label {
                        font-size: 9px;
                        font-weight: 600;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                    }
                    .print-meta .meta-value {
                        font-size: 13px;
                        font-weight: 600;
                        color: #1e293b;
                        margin-top: 1px;
                    }
                    .print-meta .meta-value.booking-code {
                        color: #3b82f6;
                        font-family: 'Courier New', monospace;
                    }
                    .meal-group { margin-bottom: 16px; }
                    .meal-group-header {
                        font-size: 14px;
                        font-weight: 600;
                        color: #1e293b;
                        padding: 6px 10px;
                        background: #eff6ff;
                        border-radius: 4px 4px 0 0;
                        border-bottom: 2px solid #3b82f6;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                    }
                    thead th {
                        background: #f1f5f9;
                        color: #475569;
                        font-weight: 600;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        padding: 8px 10px;
                        text-align: left;
                        border-bottom: 2px solid #cbd5e1;
                    }
                    tbody td {
                        padding: 6px 10px;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 12px;
                    }
                    tbody tr:last-child td { border-bottom: none; }
                    .empty-state {
                        text-align: center;
                        padding: 30px;
                        color: #94a3b8;
                    }
                    .print-footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 12px;
                        border-top: 1px solid #e2e8f0;
                        font-size: 10px;
                        color: #94a3b8;
                    }
                    @media print {
                        body { padding: 10px; }
                        thead th {
                            background: #e2e8f0 !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .meal-group-header {
                            background: #eff6ff !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .print-meta {
                            background: #f8fafc !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="print-header">
                        <h1>Kitchen Preparation List</h1>
                        <div class="subtitle">Generated on ${currentDate}</div>
                    </div>
                    <div class="print-meta">
                        <div class="meta-item">
                            <span class="meta-label">Booking Code</span>
                            <span class="meta-value booking-code">${bookingNo}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Customer</span>
                            <span class="meta-value">${customerName}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Event Date</span>
                            <span class="meta-value">${eventDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Event Time</span>
                            <span class="meta-value">${eventTime}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Venue</span>
                            <span class="meta-value">${venue}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Pax</span>
                            <span class="meta-value">${pax}</span>
                        </div>
                    </div>

                    ${tasksHTML}

                    <div class="print-footer">
                        <span>This is a system-generated kitchen preparation list.</span>
                        <br />
                        <span style="font-size: 9px; color: #cbd5e1;">Dear Bab's Catering</span>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    const printKitchenTasks = (mode = 'all', groupIndex = null, dayIndex = null, taskIdentifier = null) => {
        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!printWindow) {
            message.error('Please allow popups to print');
            return;
        }

        const booking = selectedBooking;

        let tasksToPrint = [];
        let title = '';

        if (mode === 'all') {
            tasksToPrint = kitchenTasks.filter(t => !t.is_header);
            title = 'All Kitchen Production Tasks';
        } else if (mode === 'meal' && groupIndex !== null) {
            const allGroups = groupKitchenTasksByMeal(kitchenTasks);
            if (allGroups[groupIndex]) {
                tasksToPrint = allGroups[groupIndex].tasks;
                title = allGroups[groupIndex].label;
            } else {
                message.error('Meal group not found');
                printWindow.close();
                return;
            }
        } else if (mode === 'day' && dayIndex !== null) {
            const allGroups = groupKitchenTasksByMeal(kitchenTasks);
            const dayGroups = {};
            allGroups.forEach((group) => {
                const dayKey = group.tasks[0]?.service_date || 'Unknown Day';
                if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
                dayGroups[dayKey].push(group);
            });
            const dayKeys = Object.keys(dayGroups);
            if (dayKeys[dayIndex]) {
                const dayGroup = dayGroups[dayKeys[dayIndex]];
                tasksToPrint = dayGroup.flatMap(g => g.tasks);
                title = `Kitchen Tasks - ${dayKeys[dayIndex]}`;
            } else {
                message.error('Day not found');
                printWindow.close();
                return;
            }
        } else if (mode === 'item' && taskIdentifier !== null) {
            const printableTasks = kitchenTasks.filter(task => !task.is_header);
            const selectedTask = printableTasks.find((task, index) => (
                String(task.id ?? task.kitchen_task_id ?? index) === String(taskIdentifier)
            ));
            if (selectedTask) {
                tasksToPrint = [selectedTask];
                title = selectedTask.task || selectedTask.menu_item || 'Kitchen Menu Item';
            } else {
                message.error('Kitchen menu item not found');
                printWindow.close();
                return;
            }
        }

        const groupedTasks = {};
        tasksToPrint.forEach((task) => {
            const normalizedTask = normalizeKitchenTask(task, 0, booking);
            const key = formatKitchenGroupTitle(normalizedTask);
            if (!groupedTasks[key]) groupedTasks[key] = [];
            groupedTasks[key].push(normalizedTask);
        });

        const groupedArray = Object.keys(groupedTasks).map(key => ({
            label: key,
            tasks: groupedTasks[key]
        }));

        const printContent = generateKitchenPrintHTML(booking, groupedArray, title);
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const getKitchenPrintMenuItems = () => {
        const groups = groupKitchenTasksByMeal(kitchenTasks);
        const items = [];

        const mealGroups = {};
        groups.forEach((group, index) => {
            const mealType = group.tasks[0]?.meal_type || 'General';
            if (!mealGroups[mealType]) mealGroups[mealType] = [];
            mealGroups[mealType].push({ group, index });
        });

        Object.keys(mealGroups).forEach((mealType) => {
            mealGroups[mealType].forEach(({ group, index }) => {
                const label = group.label || formatKitchenGroupTitle(group.tasks[0] || { meal_type: mealType });
                items.push({
                    key: `meal-${index}`,
                    label: label,
                    onClick: () => printKitchenTasks('meal', index),
                });
            });
        });

        items.push({ type: 'divider' });

        const dayGroups = {};
        groups.forEach((group, index) => {
            const dayKey = group.tasks[0]?.service_date || 'Unknown Day';
            if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
            dayGroups[dayKey].push({ group, index });
        });

        Object.keys(dayGroups).forEach((day, dayIndex) => {
            const dayLabel = day !== 'Unknown Day' ? day : 'Uncategorized';
            items.push({
                key: `day-${dayIndex}`,
                label: `📅 ${dayLabel}`,
                onClick: () => printKitchenTasks('day', null, dayIndex),
            });
        });

        const printableTasks = kitchenTasks.filter(task => !task.is_header);
        if (printableTasks.length > 0) {
            items.push({ type: 'divider' });
            printableTasks.forEach((task, index) => {
                const taskIdentifier = task.id ?? task.kitchen_task_id ?? index;
                items.push({
                    key: `item-${taskIdentifier}-${index}`,
                    label: `🍽 ${extractKitchenTaskName(task.task || task.menu_item || 'Menu item')}`,
                    onClick: () => printKitchenTasks('item', null, null, taskIdentifier),
                });
            });
        }

        return items;
    };

    // ========================================================
    // DELIVERY FUNCTIONS - CONNECTED TO BACKEND
    // ========================================================
    const normalizeDeliveryItemsFromBackend = (booking) => {
        const items = safeArray(booking?.delivery_preparation);
        if (items.length === 0) {
            const rawItems = booking?._raw?.delivery_preparation || [];
            if (rawItems.length > 0) {
                return rawItems.map((item, idx) => ({
                    id: item.id || item.delivery_item_id || item.equipment_id || `delivery-${idx}`,
                    equipment_id: item.equipment_id || null,
                    item: safeString(item.item || item.name, 'Delivery item'),
                    quantity: safeNumber(item.quantity || item.qty, 1),
                    scheduled_time: item.scheduled_time || item.dispatch_time || '',
                    notes: item.notes || '',
                    status: item.status || (item.is_ready ? 'ready' : 'pending'),
                    is_ready: Boolean(item.is_ready || item.status === 'ready' || item.status === 'completed'),
                    available_quantity: item.available_quantity || item.available || 0,
                    total_quantity: item.total_quantity || 0
                }));
            }
            const equipment = safeArray(booking.equipment_in_out);
            if (equipment.length > 0) {
                return equipment.map((eq, idx) => ({
                    id: eq.id || eq.booking_equipment_id || `delivery-${idx}`,
                    equipment_id: eq.equipment_id,
                    item: eq.equipment?.name || eq.equipment_name || 'Equipment',
                    quantity: eq.quantity_reserved || 1,
                    scheduled_time: booking.event_date || '',
                    notes: eq.condition_notes_out || '',
                    status: eq.status === 'checked_out' ? 'ready' : 'pending',
                    is_ready: eq.status === 'checked_out',
                    available_quantity: eq.available_quantity || 0,
                    total_quantity: eq.total_quantity || 0
                }));
            }
            return [];
        }
        return items;
    };

    const handleViewDeliveryPrep = async (record) => {
        setSelectedBooking(record);
        try {
            const orderId = record?.order?.order_id || record?.order?.id;
            let items = [];
            if (orderId) {
                const response = await api.get(`/orders/${orderId}/delivery-items`);
                items = safeArray(normalizeApiResponse(response));
            }
            if (items.length === 0) items = normalizeDeliveryItemsFromBackend(record);
            setDeliveryItems(items);
        } catch (error) {
            console.error('Failed to load delivery preparation:', error);
            setDeliveryItems(normalizeDeliveryItemsFromBackend(record));
        }
        setDeliveryCurrentPage(1);
        setDeliveryModalVisible(true);
        setShowAddDeliveryItem(false);
        setSelectedEquipment({});
    };

    const handleAddToDelivery = async (record) => {
        try {
            const orderId = record?.order?.order_id || record?.order?.id;
            if (!orderId) throw new Error('This booking does not have an order record yet.');
            await addToDeliveryMutation.mutateAsync(orderId);
            message.success(`Delivery Preparation refreshed for ${formatBookingId(record.booking_no)}`);
            await handleViewDeliveryPrep(record);
            refetchBookings();
            refetchDeliveryOrders();
        } catch (error) {
            message.error(error.response?.data?.message || error.message || 'Failed to refresh delivery preparation');
        }
    };

    const handleUpdateDeliveryItem = async (itemId, updates) => {
        try {
            const normalizedUpdates = {
                ...updates,
                status: updates.is_ready ? 'ready' : updates.status || 'pending'
            };
            const updatedItems = deliveryItems.map(item =>
                item.id === itemId ? { ...item, ...normalizedUpdates } : item
            );
            setDeliveryItems(updatedItems);

            const orderId = selectedBooking?.order?.order_id || selectedBooking?.order?.id;
            if (orderId) {
                await updateDeliveryItemMutation.mutateAsync({
                    orderId,
                    data: { items: updatedItems }
                });
            }
            message.success('Delivery item updated');
            refetchBookings();
            refetchDeliveryOrders();
        } catch (error) {
            console.error('Update delivery item error:', error);
            message.error('Failed to update delivery item');
            handleViewDeliveryPrep(selectedBooking);
        }
    };

    const handleRemoveDeliveryPreparationItem = async (itemId) => {
        try {
            const orderId = selectedBooking?.order?.order_id || selectedBooking?.order?.id;
            if (!orderId) throw new Error('Order record is missing.');
            const updatedItems = deliveryItems.filter(item => item.id !== itemId);
            await updateDeliveryItemMutation.mutateAsync({ orderId, data: { items: updatedItems } });
            setDeliveryItems(updatedItems);
            message.success('Delivery item removed');
            refetchBookings();
            refetchDeliveryOrders();
        } catch (error) {
            message.error(error.response?.data?.message || error.message || 'Failed to remove delivery item');
        }
    };

    // ========================================================
    // LOAD EQUIPMENT FROM BACKEND
    // ========================================================
    const loadAvailableEquipment = async () => {
        setLoadingEquipment(true);
        try {
            const [equipmentResponse, inventoryResponse] = await Promise.all([
                api.get('/equipment', {
                    params: {
                        is_active: 1,
                        per_page: 500,
                        search: equipmentSearch || undefined,
                    },
                }),
                api.get('/products', {
                    params: {
                        is_active: 1,
                        per_page: 500,
                        search: equipmentSearch || undefined,
                    },
                }),
            ]);

            const equipmentPayload = normalizeApiResponse(equipmentResponse);
            const equipmentList = Array.isArray(equipmentPayload)
                ? equipmentPayload
                : (equipmentPayload?.data || equipmentPayload?.equipment || []);
            const inventoryPayload = normalizeApiResponse(inventoryResponse);
            const inventoryList = Array.isArray(inventoryPayload)
                ? inventoryPayload
                : (inventoryPayload?.data || inventoryPayload?.products || []);

            setAvailableEquipment(safeArray(equipmentList).map((item) => ({
                ...item,
                id: item.id || item.equipment_id,
                equipment_id: item.equipment_id || item.id,
                available_quantity: safeNumber(item.available_quantity ?? item.available ?? item.quantity, 0),
                total_quantity: safeNumber(item.total_quantity ?? item.quantity, 0),
                name: item.name || item.item_name || item.equipment_name || 'Equipment',
            })));

            setAvailableInventoryItems(safeArray(inventoryList).map((item) => ({
                ...item,
                id: item.id || item.ingredient_id || item.product_id,
                name: item.name || item.product_name || 'Inventory Item',
                type: item.type || item.ingredient_type || 'Inventory',
                available_quantity: safeNumber(item.available_quantity ?? item.current_quantity ?? item.current_stock ?? item.stock, 0),
                unit: item.unit || '-',
            })));
        } catch (error) {
            console.error('Failed to load delivery preparation inventory:', error);
            message.error('Failed to load available equipment and inventory items');
        } finally {
            setLoadingEquipment(false);
        }
    };

    const toggleEquipmentSelection = (equipment, checked) => {
        const id = equipment.id || equipment.equipment_id;
        const availableQuantity = safeNumber(
            equipment.available_quantity ?? equipment.available ?? equipment.quantity,
            0
        );

        if (checked && availableQuantity < 1) {
            message.warning('Requested quantity exceeds the available equipment stock.');
            return;
        }

        setSelectedEquipment((previous) => {
            const next = { ...previous };
            if (!checked) {
                delete next[id];
            } else {
                next[id] = {
                    equipment_id: id,
                    item: equipment.name || equipment.item_name || equipment.equipment_name,
                    quantity: Math.min(previous[id]?.quantity || 1, availableQuantity),
                    available_quantity: availableQuantity,
                };
            }
            return next;
        });
    };

    const updateSelectedEquipmentQty = (equipment, quantity) => {
        const id = equipment.id || equipment.equipment_id;
        const requestedQuantity = safeNumber(quantity, 1);
        const availableQuantity = safeNumber(
            equipment.available_quantity ?? equipment.available ?? equipment.quantity,
            0
        );

        if (requestedQuantity > availableQuantity) {
            message.warning('Requested quantity exceeds the available equipment stock.');
            return;
        }

        setSelectedEquipment((previous) => ({
            ...previous,
            [id]: {
                equipment_id: id,
                item: equipment.name || equipment.item_name || equipment.equipment_name,
                quantity: requestedQuantity,
                available_quantity: availableQuantity,
            },
        }));
    };

    const handleAddDeliveryItem = async () => {
        const selectedItems = Object.values(selectedEquipment).filter((item) => safeNumber(item.quantity) > 0);
        if (selectedItems.length === 0) {
            message.warning('Please select at least one equipment item');
            return;
        }

        const invalidLocalSelection = selectedItems.find(
            (item) => safeNumber(item.quantity) > safeNumber(item.available_quantity)
        );
        if (invalidLocalSelection) {
            message.warning('Requested quantity exceeds the available equipment stock.');
            return;
        }

        try {
            const availabilityResponses = await Promise.all(selectedItems.map((item) => api.get('/equipment/availability', {
                params: {
                    equipment_id: item.equipment_id,
                    date: selectedBooking?.event_date || dayjs().format('YYYY-MM-DD'),
                },
            })));

            const invalidIndex = availabilityResponses.findIndex((availabilityResponse, index) => {
                const payload = normalizeApiResponse(availabilityResponse) || {};
                const available = safeNumber(payload.available ?? availabilityResponse.data?.data?.available, 0);
                return available < safeNumber(selectedItems[index].quantity);
            });

            if (invalidIndex >= 0) {
                message.warning('Requested quantity exceeds the available equipment stock.');
                return;
            }

            const orderId = selectedBooking?.order?.order_id || selectedBooking?.order?.id;
            if (!orderId) throw new Error('This booking does not have an order record yet.');

            await api.post(`/orders/${orderId}/delivery-item`, {
                items: selectedItems.map((item) => ({
                    equipment_id: item.equipment_id,
                    quantity: item.quantity,
                })),
            });

            message.success(`${selectedItems.length} equipment item(s) added to Delivery Preparation`);
            await handleViewDeliveryPrep(selectedBooking);
            setSelectedEquipment({});
            setShowAddDeliveryItem(false);
            queryClient.invalidateQueries({ queryKey: ['delivery-orders'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'equipment'], refetchType: 'active' });
            refetchActiveBookings();
            refetchDeliveryOrders();
        } catch (error) {
            console.error('Add delivery item error:', error);
            message.error(error.response?.data?.message || 'Failed to add equipment item');
        }
    };

    // ========================================================
    // STAFF, CHECKLIST, AND DELIVERY TRACKING HANDLERS
    // ========================================================
    const getEventId = useCallback((record = selectedBooking) => (
        record?.booking_id || record?.id || null
    ), [selectedBooking]);

    const updateBookingStaffCache = useCallback((record, rows) => {
        if (!record) return;

        const normalizedRows = safeArray(rows);
        const updatedBooking = {
            ...record,
            assigned_staff: normalizedRows,
            assigned_staff_count: normalizedRows.length,
        };

        setSelectedBooking(updatedBooking);
        syncBookingInCache(queryClient, updatedBooking);
    }, [queryClient]);

    const fetchAssignedStaff = useCallback(async (record) => {
        const eventId = record?.booking_id || record?.id;
        if (!eventId) {
            setAssignedStaff([]);
            return [];
        }

        const response = await api.get(`/events/${eventId}/staff`);
        const payload = normalizeApiResponse(response);
        const rows = safeArray(payload?.staff || payload).map((staff) => ({
            ...staff,
            staff_id: staff.staff_id || staff.employee_id || staff.id,
            name: staff.name || staff.full_name || `Staff #${staff.staff_id || staff.employee_id || staff.id}`,
            role: staff.role || staff.position || 'Staff',
            schedule: staff.schedule || [staff.start_time, staff.end_time].filter(Boolean).join(' - ') || '-',
            status: staff.status || 'confirmed',
        }));

        setAssignedStaff(rows);
        updateBookingStaffCache(record, rows);
        return rows;
    }, [updateBookingStaffCache]);

    const handleStaffAssignment = useCallback(async (record) => {
        if (!record) {
            message.warning('No booking selected.');
            return;
        }

        const startTime = toTimePickerValue(record.event_time, 8);
        const endTime = startTime.add(8, 'hour');

        setSelectedBooking(record);
        setAssignedStaff(safeArray(record.assigned_staff));
        staffForm.setFieldsValue({
            start_time: startTime,
            end_time: endTime,
            role: undefined,
            phone: record.customer_phone || '',
            email: record.customer_email || '',
        });
        setStaffAssignmentModalVisible(true);
        setStaffLoading(true);

        try {
            await fetchAssignedStaff(record);
        } catch (error) {
            console.error('Failed to load assigned staff:', error);
            setAssignedStaff(safeArray(record.assigned_staff));
            message.error(error.response?.data?.message || 'Failed to load assigned staff.');
        } finally {
            setStaffLoading(false);
        }
    }, [fetchAssignedStaff, staffForm]);

    const handleAddStaffToEvent = useCallback(async (values) => {
        const eventId = getEventId();
        if (!eventId || !selectedBooking) {
            message.warning('No booking selected.');
            return;
        }

        const staffIds = safeArray(values.staff_id)
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0);

        if (staffIds.length === 0) {
            message.warning('Please select at least one staff member.');
            return;
        }

        const startTime = values.start_time?.format?.('HH:mm');
        const endTime = values.end_time?.format?.('HH:mm');

        if (!startTime || !endTime) {
            message.warning('Please provide a valid start and end time.');
            return;
        }

        if (values.end_time && values.start_time && !values.end_time.isAfter(values.start_time)) {
            message.warning('End time must be later than start time.');
            return;
        }

        try {
            const response = await assignStaffMutation.mutateAsync({
                eventId,
                data: {
                    staff_ids: staffIds,
                    role: safeString(values.role).trim(),
                    start_time: startTime,
                    end_time: endTime,
                    schedule: `${startTime} - ${endTime}`,
                    phone: values.phone || selectedBooking.customer_phone || null,
                    email: values.email || selectedBooking.customer_email || null,
                },
            });

            const responsePayload = normalizeApiResponse(response);
            const responseRows = safeArray(responsePayload?.staff || responsePayload);

            if (responseRows.length > 0) {
                updateBookingStaffCache(selectedBooking, responseRows);
            } else {
                await fetchAssignedStaff(selectedBooking);
            }

            setAddStaffModalVisible(false);
            staffForm.resetFields();
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['events', eventId, 'staff'], refetchType: 'active' });
            refetchActiveBookings();
        } catch (error) {
            console.error('Staff assignment error:', error);
            // useAssignStaff already displays the backend validation message.
        }
    }, [
        assignStaffMutation,
        fetchAssignedStaff,
        getEventId,
        queryClient,
        refetchActiveBookings,
        selectedBooking,
        staffForm,
        updateBookingStaffCache,
    ]);

    const handleUpdateStaffStatus = useCallback(async (eventId, staffId, status) => {
        const resolvedEventId = eventId || getEventId();
        if (!resolvedEventId || !staffId) {
            message.warning('Unable to identify the selected staff assignment.');
            return;
        }

        try {
            await updateStaffStatusMutation.mutateAsync({
                eventId: resolvedEventId,
                staffId,
                data: { status },
            });

            const nextRows = assignedStaff.map((staff) => (
                String(staff.staff_id || staff.employee_id || staff.id) === String(staffId)
                    ? { ...staff, status }
                    : staff
            ));
            setAssignedStaff(nextRows);
            updateBookingStaffCache(selectedBooking, nextRows);
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
        } catch (error) {
            console.error('Update staff status error:', error);
            await fetchAssignedStaff(selectedBooking).catch(() => undefined);
        }
    }, [
        assignedStaff,
        fetchAssignedStaff,
        getEventId,
        queryClient,
        selectedBooking,
        updateBookingStaffCache,
        updateStaffStatusMutation,
    ]);

    const handleRemoveStaff = useCallback(async (eventId, staffId) => {
        const resolvedEventId = eventId || getEventId();
        if (!resolvedEventId || !staffId) {
            message.warning('Unable to identify the selected staff assignment.');
            return;
        }

        try {
            await removeStaffMutation.mutateAsync({
                eventId: resolvedEventId,
                staffId,
            });

            const nextRows = assignedStaff.filter(
                (staff) => String(staff.staff_id || staff.employee_id || staff.id) !== String(staffId)
            );
            setAssignedStaff(nextRows);
            updateBookingStaffCache(selectedBooking, nextRows);
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
            refetchActiveBookings();
        } catch (error) {
            console.error('Remove staff error:', error);
            await fetchAssignedStaff(selectedBooking).catch(() => undefined);
        }
    }, [
        assignedStaff,
        fetchAssignedStaff,
        getEventId,
        queryClient,
        refetchActiveBookings,
        removeStaffMutation,
        selectedBooking,
        updateBookingStaffCache,
    ]);

    const handleViewChecklist = useCallback(async (record) => {
        const eventId = record?.booking_id || record?.id;
        if (!eventId) {
            message.warning('No booking selected.');
            return;
        }

        setSelectedBooking(record);
        setChecklistModalVisible(true);
        setChecklistLoading(true);

        try {
            const response = await api.get(`/events/${eventId}/checklist`);
            const payload = normalizeApiResponse(response);
            const rows = safeArray(payload?.checklist || payload).map((item, index) => ({
                ...item,
                id: item.id || item.event_checklist_item_id || item.task_key || `checklist-${index}`,
                completed: Boolean(item.completed ?? item.status === 'completed'),
            }));
            setChecklist(rows);
        } catch (error) {
            console.error('Failed to load checklist:', error);
            setChecklist([]);
            message.error(error.response?.data?.message || 'Failed to load checklist.');
        } finally {
            setChecklistLoading(false);
        }
    }, []);

    const handleDeleteChecklistItem = useCallback(async (item) => {
        const eventId = getEventId();
        const itemId = item?.id || item?.event_checklist_item_id || item?.task_key;

        if (!eventId || !itemId) {
            message.warning('Unable to identify the checklist item.');
            return;
        }

        try {
            await deleteChecklistItemMutation.mutateAsync({ eventId, itemId });
            setChecklist((previous) => previous.filter((row) => (
                String(row.id || row.event_checklist_item_id || row.task_key) !== String(itemId)
            )));
        } catch (error) {
            console.error('Delete checklist item error:', error);
        }
    }, [deleteChecklistItemMutation, getEventId]);

    const fetchDeliveryTrackings = useCallback(async (record) => {
        const eventId = record?.booking_id || record?.id;
        if (!eventId) {
            setDeliveryTrackings([]);
            return [];
        }

        const response = await api.get(`/events/${eventId}/deliveries`);
        const payload = normalizeApiResponse(response);
        const rows = safeArray(payload?.deliveries || payload).map((delivery, index) => ({
            ...delivery,
            id: delivery.id || delivery.event_delivery_tracking_id || `delivery-${index}`,
            status: delivery.status || 'pending',
        }));
        setDeliveryTrackings(rows);
        return rows;
    }, []);

    const handleViewDeliveryTracking = useCallback(async (record) => {
        if (!record) {
            message.warning('No booking selected.');
            return;
        }

        setSelectedBooking(record);
        setDeliveryTrackings(safeArray(
            record.delivery_tracking || record.deliveryTrackings || record.deliveries
        ));
        setDeliveryTrackingModalVisible(true);
        setDeliveryTrackingLoading(true);

        try {
            await fetchDeliveryTrackings(record);
        } catch (error) {
            console.error('Failed to load delivery tracking:', error);
            message.error(error.response?.data?.message || 'Failed to load delivery tracking.');
        } finally {
            setDeliveryTrackingLoading(false);
        }
    }, [fetchDeliveryTrackings]);

    const handleAddDeliverySubmit = useCallback(async (values) => {
        const eventId = getEventId();
        if (!eventId || !selectedBooking) {
            message.warning('No booking selected.');
            return;
        }

        const data = {
            delivery_type: values.delivery_type || selectedBooking.service_type || 'buffet',
            delivery_date: values.delivery_date?.format?.('YYYY-MM-DD') || selectedBooking.event_date || null,
            delivery_time: values.delivery_time || selectedBooking.event_time || null,
            return_time: values.return_time || null,
            venue: values.venue || selectedBooking.venue || null,
            vehicle: values.vehicle || null,
            driver: values.driver || null,
            driver_phone: values.driver_phone || null,
            items: values.items || null,
            notes: values.notes || null,
        };

        try {
            if (editingDelivery) {
                const deliveryId = editingDelivery.id || editingDelivery.event_delivery_tracking_id;
                await api.put(`/events/${eventId}/deliveries/${deliveryId}`, data);
            } else {
                await addDeliveryMutation.mutateAsync({ eventId, data });
            }

            setAddDeliveryModalVisible(false);
            setEditingDelivery(null);
            addDeliveryForm.resetFields();
            await fetchDeliveryTrackings(selectedBooking);
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
            refetchActiveBookings();
        } catch (error) {
            console.error('Save delivery error:', error);
            if (editingDelivery) {
                message.error(error.response?.data?.message || 'Failed to update delivery.');
            }
            // useAddDelivery displays its own backend error for create requests.
        }
    }, [
        addDeliveryForm,
        addDeliveryMutation,
        editingDelivery,
        fetchDeliveryTrackings,
        getEventId,
        queryClient,
        refetchActiveBookings,
        selectedBooking,
    ]);

    const handleUpdateDeliveryStatus = useCallback(async (deliveryId, status, location = null) => {
        const eventId = getEventId();
        if (!eventId || !deliveryId) {
            message.warning('Unable to identify the delivery record.');
            return;
        }

        const previousRows = deliveryTrackings;
        const nextRows = previousRows.map((delivery) => (
            String(delivery.id || delivery.event_delivery_tracking_id) === String(deliveryId)
                ? { ...delivery, status, location: location ?? delivery.location }
                : delivery
        ));
        setDeliveryTrackings(nextRows);

        try {
            await updateDeliveryStatusMutation.mutateAsync({
                eventId,
                deliveryId,
                data: { status, location },
            });
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
        } catch (error) {
            console.error('Update delivery status error:', error);
            setDeliveryTrackings(previousRows);
        }
    }, [
        deliveryTrackings,
        getEventId,
        queryClient,
        updateDeliveryStatusMutation,
    ]);

    const handleEditDelivery = useCallback((delivery) => {
        if (!delivery) return;

        setEditingDelivery(delivery);
        addDeliveryForm.setFieldsValue({
            delivery_type: delivery.delivery_type || 'buffet',
            delivery_date: delivery.delivery_date && dayjs(delivery.delivery_date).isValid()
                ? dayjs(delivery.delivery_date)
                : null,
            delivery_time: delivery.delivery_time || '',
            return_time: delivery.return_time || '',
            venue: delivery.venue || delivery.location || selectedBooking?.venue || '',
            vehicle: delivery.vehicle || '',
            driver: delivery.driver || '',
            driver_phone: delivery.driver_phone || '',
            items: delivery.items || '',
            notes: delivery.notes || '',
        });
        setAddDeliveryModalVisible(true);
    }, [addDeliveryForm, selectedBooking]);

    const handleClearDeliveryData = useCallback(async (delivery, field) => {
        const eventId = getEventId();
        const deliveryId = delivery?.id || delivery?.event_delivery_tracking_id;

        if (!eventId || !deliveryId) {
            message.warning('Unable to identify the delivery record.');
            return;
        }

        const updates = field === 'driver'
            ? { driver: '', driver_phone: '' }
            : { items: '' };

        try {
            await api.put(`/events/${eventId}/deliveries/${deliveryId}`, updates);
            setDeliveryTrackings((previous) => previous.map((row) => (
                String(row.id || row.event_delivery_tracking_id) === String(deliveryId)
                    ? { ...row, ...updates }
                    : row
            )));
            message.success(field === 'driver' ? 'Assigned driver removed.' : 'Delivery items removed.');
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
        } catch (error) {
            console.error('Clear delivery data error:', error);
            message.error(error.response?.data?.message || 'Failed to update the delivery record.');
        }
    }, [getEventId, queryClient]);

    const handleDeleteDelivery = useCallback(async (deliveryId) => {
        const eventId = getEventId();
        if (!eventId || !deliveryId) {
            message.warning('Unable to identify the delivery record.');
            return;
        }

        try {
            await api.delete(`/events/${eventId}/deliveries/${deliveryId}`);
            setDeliveryTrackings((previous) => previous.filter((delivery) => (
                String(delivery.id || delivery.event_delivery_tracking_id) !== String(deliveryId)
            )));
            message.success('Delivery record removed.');
            queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'active' });
            refetchActiveBookings();
        } catch (error) {
            console.error('Delete delivery error:', error);
            message.error(error.response?.data?.message || 'Failed to remove the delivery record.');
        }
    }, [getEventId, queryClient, refetchActiveBookings]);

    const handleAddChecklistItem = async (values) => {
        try {
            const task = values.task || values;
            const assignedTo = values.assigned_to || 'Unassigned';
            const newItem = {
                task: typeof task === 'string' ? task : task.task,
                assigned_to: assignedTo,
                status: 'pending',
                notes: values.notes || '',
            };
            await addChecklistItemMutation.mutateAsync({
                eventId: selectedBooking.id,
                data: newItem
            });
            message.success('Checklist item added');
            await handleViewChecklist(selectedBooking);
        } catch (error) {
            console.error('Failed to add checklist item:', error);
            message.error('Failed to add checklist item');
        }
    };

    const handleUpdateChecklistItem = async (itemId, completed) => {
        try {
            await updateChecklistItemMutation.mutateAsync({
                eventId: selectedBooking.id,
                itemId,
                data: {
                    completed,
                    status: completed ? 'completed' : 'pending',
                }
            });
            await handleViewChecklist(selectedBooking);
            refetchBookings();
        } catch (error) {
            console.error('Update checklist error:', error);
            message.error(error.response?.data?.message || 'Failed to update checklist');
        }
    };

    // ========================================================
    // INGREDIENTS FUNCTIONS - CONNECTED TO BACKEND
    // ========================================================
    const aggregateMenuItemIngredients = (menuItems, selectedMenuItemIds = []) => {
        const selectedIdSet = new Set(safeArray(selectedMenuItemIds).map((id) => String(id)));
        const selectedMenuItems = safeArray(menuItems).filter((menuItem) => {
            const menuItemId = menuItem?.menu_item_id ?? menuItem?.id;
            return selectedIdSet.size === 0 || selectedIdSet.has(String(menuItemId));
        });

        const ingredientMap = new Map();

        selectedMenuItems.forEach((menuItem) => {
            const menuItemId = menuItem?.menu_item_id ?? menuItem?.id;
            const menuItemName = safeString(menuItem?.name, 'Menu Item');

            safeArray(menuItem?.ingredients).forEach((ingredient) => {
                const ingredientKey = String(
                    ingredient?.ingredient_id
                    ?? ingredient?.id
                    ?? ingredient?.name
                );

                const quantityNeeded = safeNumber(ingredient?.quantity_needed);
                const perPax = safeNumber(ingredient?.per_pax);
                const existing = ingredientMap.get(ingredientKey);

                const menuItemReference = {
                    menu_item_id: menuItemId,
                    name: menuItemName,
                    quantity: safeNumber(menuItem?.quantity, 1),
                    per_pax: perPax,
                    required: quantityNeeded,
                };

                if (!existing) {
                    ingredientMap.set(ingredientKey, {
                        ...ingredient,
                        ingredient_id: ingredient?.ingredient_id ?? ingredient?.id ?? ingredientKey,
                        name: safeString(ingredient?.name, 'Unknown Ingredient'),
                        unit: safeString(ingredient?.unit, ''),
                        per_pax: perPax,
                        quantity_needed: quantityNeeded,
                        current_stock: safeNumber(ingredient?.current_stock),
                        reserved_quantity: safeNumber(ingredient?.reserved_quantity),
                        available_stock: safeNumber(ingredient?.available_stock),
                        purchased: Boolean(ingredient?.purchased),
                        menu_items: [menuItemReference],
                    });
                    return;
                }

                existing.per_pax = safeNumber(existing.per_pax) + perPax;
                existing.quantity_needed = safeNumber(existing.quantity_needed) + quantityNeeded;
                existing.purchased = Boolean(existing.purchased || ingredient?.purchased);
                existing.menu_items = [...safeArray(existing.menu_items), menuItemReference];
            });
        });

        return Array.from(ingredientMap.values())
            .map((ingredient) => {
                const availableStock = safeNumber(ingredient.available_stock);
                const quantityNeeded = safeNumber(ingredient.quantity_needed);
                const shortage = Math.max(0, quantityNeeded - availableStock);

                return {
                    ...ingredient,
                    per_pax: Math.round(safeNumber(ingredient.per_pax) * 10000) / 10000,
                    quantity_needed: Math.round(quantityNeeded * 100) / 100,
                    shortage: Math.round(shortage * 100) / 100,
                    need_to_buy: !ingredient.purchased && shortage > 0,
                };
            })
            .sort((a, b) => safeString(a.name).localeCompare(safeString(b.name)));
    };

    const computeIngredientsForOrder = async (booking) => {
        const bookingId = booking?.booking_id || booking?.id;
        if (!bookingId) {
            throw new Error('Booking ID is required to calculate ingredients.');
        }

        const response = await api.get(`/bookings/${bookingId}/ingredients-details`);
        const detail = normalizeApiResponse(response) || {};
        const menuItems = safeArray(detail?.menu_items);
        const menuItemIds = menuItems
            .map((menuItem) => menuItem?.menu_item_id ?? menuItem?.id)
            .filter((id) => id !== null && id !== undefined)
            .map((id) => String(id));

        const ingredients = menuItems.length > 0
            ? aggregateMenuItemIngredients(menuItems, menuItemIds)
            : safeArray(detail?.all_ingredients);

        return {
            menuItems,
            selectedMenuItemIds: menuItemIds,
            ingredients,
        };
    };

    const handleRecalculateIngredients = () => {
        if (selectedIngredientMenuItemIds.length === 0) {
            message.warning('Select at least one menu item to calculate.');
            setComputedIngredients([]);
            setSelectedIngredientIds([]);
            return;
        }

        setIsComputingIngredients(true);
        try {
            const overallSummary = aggregateMenuItemIngredients(
                ingredientMenuItems,
                selectedIngredientMenuItemIds
            );
            setComputedIngredients(overallSummary);
            setSelectedIngredientIds([]);
        } finally {
            setIsComputingIngredients(false);
        }
    };

    const handleCalculateIngredients = async (record) => {
        setSelectedBooking(record);
        setIngredientsModalVisible(true);
        setComputedIngredients([]);
        setSelectedIngredientIds([]);
        setIngredientMenuItems([]);
        setSelectedIngredientMenuItemIds([]);
        setIsComputingIngredients(true);

        try {
            const calculation = await computeIngredientsForOrder(record);
            setIngredientMenuItems(calculation.menuItems);
            setSelectedIngredientMenuItemIds(calculation.selectedMenuItemIds);
            setComputedIngredients(calculation.ingredients);
        } catch (error) {
            console.error('Failed to compute ingredients:', error);
            message.error(error.response?.data?.message || error.message || 'Failed to fetch ingredient requirements');
        } finally {
            setIsComputingIngredients(false);
        }
    };

    const handleAddToShoppingList = async (bookingId, ingredients) => {
        try {
            const itemsToAdd = ingredients.filter(i => i.need_to_buy === true && i.shortage > 0);
            if (itemsToAdd.length === 0) {
                message.info('All ingredients are sufficiently stocked. No purchases needed.');
                return;
            }

            let addedCount = 0;
            let failedCount = 0;
            const hideLoading = message.loading(`Adding ${itemsToAdd.length} items to purchase list...`, 0);

            for (const ingredient of itemsToAdd) {
                try {
                    const ingredientId = ingredient.ingredient_id;
                    if (!ingredientId) {
                        failedCount++;
                        continue;
                    }
                    const quantityToBuy = Math.ceil((ingredient.shortage || 0) * 1.1);
                    if (quantityToBuy <= 0) continue;

                    const response = await api.post('/inventory/purchase-requests', {
                        ingredient_id: ingredientId,
                        quantity: quantityToBuy,
                        urgency: ingredient.shortage > 50 ? 'critical' : (ingredient.shortage > 20 ? 'urgent' : 'normal'),
                        booking_id: selectedBooking?.booking_id || selectedBooking?.id,
                        notes: `Auto-generated from order ${formatBookingId(selectedBooking?.booking_no)}`
                    });

                    if (response.data?.success !== false) {
                        addedCount++;
                    } else {
                        failedCount++;
                    }
                } catch (e) {
                    console.warn(`Failed to create purchase request for ${ingredient.name}:`, e);
                    failedCount++;
                }
            }

            hideLoading();

            if (addedCount > 0) {
                message.success(`✅ Added ${addedCount} items to purchase list${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
                setIngredientsModalVisible(false);
                refetchShoppingList();
                refetchBookings();
                refetchStatistics();
            } else {
                message.error('Failed to add items to purchase list.');
            }
        } catch (error) {
            console.error('Failed to add to shopping list:', error);
            message.error(error.response?.data?.message || 'Failed to add to shopping list');
        }
    };

    // ========================================================
    // GET ACTION MENU ITEMS
    // ========================================================
    const getActionMenuItems = useCallback((record) => {
        const status = String(record.booking_status || '').toLowerCase();
        /** @type {any[]} */
        const items = [
            {
                key: 'ingredients',
                label: 'Calculate Ingredients',
                icon: <StockOutlined />,
                onClick: () => handleCalculateIngredients(record)
            },
            {
                key: 'kitchen',
                label: 'Kitchen Production Tasks',
                icon: <CoffeeOutlined />,
                onClick: () => handleViewKitchenPrep(record)
            },
            {
                key: 'delivery',
                label: 'Delivery Preparation Items',
                icon: <TruckOutlined />,
                onClick: () => handleViewDeliveryPrep(record)
            },
            {
                key: 'staff',
                label: 'Staff Assignment',
                icon: <TeamOutlined />,
                onClick: () => handleStaffAssignment(record)
            },
            {
                key: 'delivery_tracking',
                label: 'Delivery Tracking',
                icon: <CarOutlined />,
                onClick: () => handleViewDeliveryTracking(record)
            },
            {
                key: 'checklist',
                label: 'Event Checklist',
                icon: <CheckSquareOutlined />,
                onClick: () => handleViewChecklist(record)
            },
            {
                key: 'equipment_details',
                label: 'Equipment Details',
                icon: <PlusCircleOutlined />,
                onClick: () => handleViewEquipmentDetails(record)
            },
            { type: 'divider' },
        ];

        if (!['completed', 'cancelled', 'rejected'].includes(status)) {
            if (['upcoming', 'confirmed', 'pending_approval', 'rescheduled', 'approved'].includes(status)) {
                items.push({
                    key: 'start',
                    label: 'Start Event',
                    icon: <PlayCircleOutlined style={{ color: '#10b981' }} />,
                    onClick: () => handleStartEvent(record)
                });
            }
            if (status === 'ongoing') {
                items.push(
                    {
                        key: 'done',
                        label: record.event_done ? 'Marked as Done' : 'Mark as Done',
                        disabled: Boolean(record.event_done),
                        icon: <CheckSquareOutlined style={{ color: '#10b981' }} />,
                        onClick: () => handleMarkEventDone(record),
                    },
                    {
                        key: 'complete',
                        label: 'Complete Event',
                        icon: <FlagOutlined style={{ color: '#3b82f6' }} />,
                        onClick: () => handleCompleteEvent(record),
                    }
                );
            }
        }

        items.push(
            {
                key: 'approve_equipment',
                label: 'Approve Equipment Out',
                icon: <PlusCircleOutlined style={{ color: '#3b82f6' }} />,
                onClick: () => {
                    setSelectedBooking(record);
                    equipmentForm.resetFields();
                    setEquipmentCheckoutModalVisible(true);
                }
            },
            {
                key: 'approve_all_equipment',
                label: 'Approve All Equipment',
                icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
                onClick: () => handleApproveAllEquipment(record)
            },
            { type: 'divider' },
            {
                key: 'payment',
                label: 'Payment',
                icon: <WalletOutlined />,
                onClick: () => openPaymentForBooking(record)
            },
            {
                key: 'edit',
                label: 'Edit Booking',
                icon: <EditOutlined />,
                onClick: () => handleEdit(record)
            },
            {
                key: 'livestatus',
                label: 'Live Status',
                icon: <DashboardOutlined />,
                onClick: () => handleOpenLiveStatus(record)
            },
        );

        return items;
    }, [
        handleCalculateIngredients, handleViewKitchenPrep, handleViewDeliveryPrep,
        handleStaffAssignment, handleViewDeliveryTracking, handleViewChecklist,
        handleViewEquipmentDetails, handleStartEvent, handleMarkEventDone, handleCompleteEvent,
        handleApproveAllEquipment, handleEdit, handleOpenLiveStatus, openPaymentForBooking
    ]);

    // ========================================================
    // TABLE COLUMNS - WITH STAFF COUNT FIXED
    // ========================================================
    const columns = [
        {
            title: 'BOOKING ID',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 90,
            fixed: 'left',
            render: (text) => <span className="ue-id-text">{formatBookingId(text)}</span>
        },
        {
            title: 'CUSTOMER',
            key: 'customer',
            width: 180,
            render: (_, record) => (
                <div className="ue-customer-cell">
                    <div className="ue-customer-name">{safeString(record.customer_name)}</div>
                    <div className="ue-customer-contact"><MailOutlined /> {safeString(record.customer_email, 'No email')}</div>
                </div>
            )
        },
        {
            title: 'EVENT TYPE',
            dataIndex: 'event_type_id',
            key: 'event_type',
            width: 170,
            render: (value, record) => {
                const name = record.event_type_name || getEventTypeName(value, eventTypes) || 'N/A';
                return <Tag color="blue">{name}</Tag>;
            }
        },
        {
            title: 'EVENT DETAILS',
            key: 'event',
            width: 180,
            render: (_, record) => (
                <div className="ue-event-cell">
                    <div><CalendarOutlined /> {record.event_date}</div>
                    <div><ScheduleOutlined /> {record.event_time}</div>
                    <div><EnvironmentOutlined /> {safeString(record.venue, 'N/A')}</div>
                </div>
            )
        },
        {
            title: 'PAX',
            dataIndex: 'guests_count',
            key: 'pax',
            width: 60,
            align: 'center',
            render: (v) => <span className="ue-pax-number">{safeNumber(v)}</span>
        },
        {
            title: 'AMOUNT',
            key: 'amount',
            width: 140,
            align: 'right',
            render: (_, record) => {
                const total = safeNumber(record.total_amount);
                const paid = safeNumber(record.paid_amount || 0);
                const balance = safeNumber(record.balance || 0);
                return (
                    <div className="ue-amount-cell">
                        <div className="ue-amount-total">{formatCurrency(total)}</div>
                        {balance > 0 && (
                            <div className="ue-amount-balance" style={{ color: '#ef4444', fontSize: '11px' }}>
                                Balance: {formatCurrency(balance)}
                            </div>
                        )}
                        {paid > 0 && balance <= 0 && (
                            <div className="ue-amount-paid" style={{ color: '#10b981', fontSize: '11px' }}>
                                Fully Paid
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'MEALS',
            key: 'meals',
            width: 60,
            align: 'center',
            render: (_, record) => <Badge count={safeArray(record.meal_services).length} showZero style={{ backgroundColor: '#8b5cf6' }} />
        },
        {
            title: 'STAFF',
            key: 'staff',
            width: 80,
            align: 'center',
            render: (_, record) => {
                const staffCount = safeNumber(record.total_staff_required, safeArray(record.assigned_staff).length);
                return (
                    <Badge 
                        count={staffCount} 
                        showZero 
                        style={{ 
                            backgroundColor: staffCount > 0 ? '#3b82f6' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: 500
                        }} 
                    />
                );
            }
        },
        {
            title: 'STATUS',
            dataIndex: 'booking_status',
            key: 'status',
            width: 130,
            align: 'center',
            render: (status, record) => {
                const displayStatus = getBookingDisplayStatus(record);
                const config = getStatusConfig(displayStatus);
                return (
                    <span className="ue-status" style={{ color: config.color, background: config.bg }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <div className="ue-action-group">
                    <Tooltip title="View Details">
                        <button className="ue-action-icon view" onClick={() => handleViewDetails(record)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit Booking">
                        <button className="ue-action-icon edit" onClick={() => handleEdit(record)}>
                            <EditOutlined />
                        </button>
                    </Tooltip>
                    <Dropdown menu={{ items: getActionMenuItems(record) }} placement="bottomRight">
                        <button className="ue-action-icon more">
                            <MoreOutlined />
                        </button>
                    </Dropdown>
                </div>
            )
        }
    ];

    // ========================================================
    // HISTORY COLUMNS
    // ========================================================
    const historyColumns = [
        {
            title: 'BOOKING ID',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 120,
            render: (text) => <span className="ue-id-text">{formatBookingId(text)}</span>
        },
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 160,
            render: (text) => <span className="ue-customer-name">{safeString(text)}</span>
        },
        {
            title: 'EVENT DATE',
            dataIndex: 'event_date',
            key: 'event_date',
            width: 110
        },
        {
            title: 'VENUE',
            dataIndex: 'venue',
            key: 'venue',
            width: 140,
            ellipsis: true,
            render: (text) => safeString(text, 'N/A')
        },
        {
            title: 'PAX',
            dataIndex: 'guests_count',
            key: 'pax',
            width: 60,
            align: 'center',
            render: (v) => safeNumber(v)
        },
        {
            title: 'REVENUE',
            dataIndex: 'total_amount',
            key: 'revenue',
            width: 120,
            align: 'right',
            render: (v) => formatCurrency(v)
        },
        {
            title: 'PAYMENT',
            key: 'payment',
            width: 100,
            align: 'center',
            render: (_, record) => {
                const paid = safeNumber(record.paid_amount || 0);
                const total = safeNumber(record.total_amount || 0);
                const isPaid = paid >= total;
                return (
                    <Tag color={isPaid ? 'success' : (record.debt_booking_event ? 'error' : 'warning')}>
                        {isPaid ? 'Paid' : (record.debt_booking_event ? 'Debt Booking' : 'Partial')}
                    </Tag>
                );
            }
        },
        {
            title: 'STATUS',
            dataIndex: 'booking_status',
            key: 'status',
            width: 110,
            align: 'center',
            render: (status, record) => {
                if (record.debt_booking_event && safeNumber(record.balance) > 0.01) {
                    return <Tag color="error">Event Completed · Balance Due</Tag>;
                }
                if (record.event_completed && safeNumber(record.balance) <= 0.01 && String(record.booking_status).toLowerCase() !== 'completed') {
                    return <Tag color="processing">Event Completed · Ready to Close</Tag>;
                }
                const config = getStatusConfig(status);
                return (
                    <span className="ue-status" style={{ color: config.color, background: config.bg }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 80,
            fixed: 'right',
            render: (_, record) => (
                <Tooltip title="View Details">
                    <button className="ue-action-icon view" onClick={() => handleViewDetails(record)}>
                        <EyeOutlined />
                    </button>
                </Tooltip>
            )
        }
    ];

    // ========================================================
    // ONGOING COLUMNS
    // ========================================================
    const ongoingColumns = [
        {
            title: 'BOOKING ID',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 120,
            render: (text) => <span className="ue-id-text">{formatBookingId(text)}</span>
        },
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 150,
            render: (text) => <span className="ue-customer-name">{safeString(text)}</span>
        },
        {
            title: 'EVENT',
            key: 'event',
            width: 140,
            render: (_, record) => <Tag color="cyan">{getEventTypeName(record.event_type_id, eventTypes)}</Tag>
        },
        {
            title: 'VENUE',
            dataIndex: 'venue',
            key: 'venue',
            width: 130,
            ellipsis: true,
            render: (text) => safeString(text, 'N/A')
        },
        {
            title: 'START TIME',
            dataIndex: 'event_time',
            key: 'start_time',
            width: 100
        },
        {
            title: 'PAX',
            dataIndex: 'guests_count',
            key: 'pax',
            width: 60,
            align: 'center',
            render: (v) => safeNumber(v)
        },
        {
            title: 'AMOUNT',
            key: 'amount',
            width: 120,
            align: 'right',
            render: (_, record) => formatCurrency(record.total_amount)
        },
        {
            title: 'STAFF',
            key: 'staff',
            width: 80,
            align: 'center',
            render: (_, record) => {
                const staffCount = safeArray(record.assigned_staff).length;
                return (
                    <Badge 
                        count={staffCount} 
                        showZero 
                        style={{ 
                            backgroundColor: staffCount > 0 ? '#3b82f6' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: 500
                        }} 
                    />
                );
            }
        },
        {
            title: 'KITCHEN',
            key: 'kitchen',
            width: 90,
            align: 'center',
            render: (_, record) => {
                const tasks = safeArray(record.kitchen_preparation);
                const done = tasks.filter(t => t.is_done || t.status === 'completed').length;
                const total = tasks.length || 1;
                return <Progress percent={Math.round((done / total) * 100)} size="small" strokeColor="#8b5cf6" />
            }
        },
        {
            title: 'PROGRESS',
            key: 'progress',
            width: 100,
            render: (_, record) => <Progress percent={record.progress || 0} size="small" strokeColor="#3b82f6" />
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 80,
            render: (_, record) => (
                <Button size="small" type="primary" icon={<EyeOutlined />} onClick={() => handleOpenLiveStatus(record)}>
                    Monitor
                </Button>
            )
        }
    ];

    // ========================================================
    // PAGINATION RENDER
    // ========================================================
    const renderPaginationItem = (_, type, originalElement) => {
        if (type === 'prev') {
            return (
                <Button className="ue-pagination-navigation" size="small" icon={<LeftOutlined />}>
                    Previous
                </Button>
            );
        }
        if (type === 'next') {
            return (
                <Button className="ue-pagination-navigation" size="small">
                    Next <RightOutlined />
                </Button>
            );
        }
        return originalElement;
    };

    // ========================================================
    // EXPORT FUNCTIONS
    // ========================================================
    const exportToExcel = (data, filename, columns) => {
        const worksheetData = data.map(row => {
            const exportRow = {};
            columns.forEach(col => {
                if (col.dataIndex) {
                    let value = row[col.dataIndex];
                    if (col.dataIndex === 'total_amount' || col.dataIndex === 'amount') {
                        value = formatCurrency(value);
                    }
                    exportRow[col.title] = value;
                } else if (col.key === 'status') {
                    exportRow[col.title] = getStatusConfig(getBookingDisplayStatus(row)).text;
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

    const exportAllOrders = () => {
        const columns = [
            { title: 'BOOKING ID', dataIndex: 'booking_no' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'EVENT DATE', dataIndex: 'event_date' },
            { title: 'EVENT TIME', dataIndex: 'event_time' },
            { title: 'VENUE', dataIndex: 'venue' },
            { title: 'PAX', dataIndex: 'guests_count' },
            { title: 'TOTAL AMOUNT', dataIndex: 'total_amount' },
            { title: 'STATUS', key: 'status' }
        ];
        exportToExcel(confirmedBookings, 'Confirmed_Bookings_Report', columns);
    };

    const exportHistory = () => {
        const columns = [
            { title: 'BOOKING ID', dataIndex: 'booking_no' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'EVENT DATE', dataIndex: 'event_date' },
            { title: 'VENUE', dataIndex: 'venue' },
            { title: 'PAX', dataIndex: 'guests_count' },
            { title: 'REVENUE', dataIndex: 'total_amount' },
            { title: 'STATUS', key: 'status' }
        ];
        exportToExcel(completedBookings, 'Event_History_Report', columns);
    };

    // ========================================================
    // RENDER STATS
    // ========================================================
    const renderStats = () => (
        <div className="ue-stats-grid">
            <div className="ue-stat-card">
                <div className="ue-stat-icon green"><CheckCircleOutlined /></div>
                <div>
                    <div className="ue-stat-label">Confirmed Bookings</div>
                    <div className="ue-stat-value">{stats.confirmed_bookings}</div>
                </div>
            </div>
            <div className="ue-stat-card">
                <div className="ue-stat-icon cyan"><PlayCircleOutlined /></div>
                <div>
                    <div className="ue-stat-label">Ongoing</div>
                    <div className="ue-stat-value">{stats.ongoing}</div>
                </div>
            </div>
            <div className="ue-stat-card">
                <div className="ue-stat-icon blue"><CheckCircleOutlined /></div>
                <div>
                    <div className="ue-stat-label">Completed</div>
                    <div className="ue-stat-value">{stats.completed}</div>
                </div>
            </div>
            <div className="ue-stat-card">
                <div className="ue-stat-icon purple"><DollarOutlined /></div>
                <div>
                    <div className="ue-stat-label">Total Revenue</div>
                    <div className="ue-stat-value">{formatCurrency(stats.total_revenue)}</div>
                </div>
            </div>
            <div className="ue-stat-card">
                <div className="ue-stat-icon gold"><WalletOutlined /></div>
                <div>
                    <div className="ue-stat-label">Outstanding Balance</div>
                    <div className="ue-stat-value">{formatCurrency(stats.outstanding_balance)}</div>
                </div>
            </div>
        </div>
    );

    // ========================================================
    // EQUIPMENT DETAILS MODAL
    // ========================================================
    const renderEquipmentDetailsModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><PlusCircleOutlined /></div>
                    <div className="ue-modal-title">Equipment Details</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={equipmentDetailsModalVisible}
            onCancel={() => setEquipmentDetailsModalVisible(false)}
            width={900}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button onClick={() => setEquipmentDetailsModalVisible(false)}>Close</Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                {selectedBooking && (
                    <>
                        <div className="ue-equipment-header">
                            <div className="ue-equipment-booking-info">
                                <div className="ue-equipment-booking-id">
                                    <span className="ue-id-text">{formatBookingId(selectedBooking.booking_no)}</span>
                                </div>
                                <div className="ue-equipment-customer-name">{selectedBooking.customer_name}</div>
                                <div className="ue-equipment-event-type">{getEventTypeName(selectedBooking.event_type_id, eventTypes)}</div>
                                <div className="ue-equipment-event-date">{selectedBooking.event_date}</div>
                            </div>
                        </div>

                        <div className="ue-equipment-actions">
                            <Space>
                                <Checkbox 
                                    checked={selectedEquipmentIds.length === equipmentDetailsData.length && equipmentDetailsData.length > 0}
                                    indeterminate={selectedEquipmentIds.length > 0 && selectedEquipmentIds.length < equipmentDetailsData.length}
                                    onChange={(e) => handleSelectAllEquipment(e.target.checked)}
                                >
                                    Approve Selected ({selectedEquipmentIds.length})
                                </Checkbox>
                                <Button 
                                    type="primary" 
                                    size="small"
                                    onClick={handleApproveSelectedEquipmentFromDetails}
                                    disabled={selectedEquipmentIds.length === 0}
                                >
                                    Approve Selected
                                </Button>
                                <Button 
                                    type="primary" 
                                    size="small"
                                    onClick={handleApproveAllEquipmentFromDetails}
                                >
                                    Approve All
                                </Button>
                            </Space>
                        </div>

                        <Table
                            dataSource={equipmentDetailsData}
                            rowKey={(record) => record.id}
                            size="small"
                            pagination={false}
                            columns={[
                                {
                                    title: '',
                                    width: 40,
                                    render: (_, record) => (
                                        <Checkbox 
                                            checked={selectedEquipmentIds.includes(record.id)}
                                            onChange={(e) => handleSelectEquipment(record.id, e.target.checked)}
                                            disabled={record.is_out_approved || ['checked_out', 'returned'].includes(record.status)}
                                        />
                                    )
                                },
                                {
                                    title: 'NAME',
                                    dataIndex: 'equipment_name',
                                    render: (v, r) => v || r.equipment?.name || 'N/A'
                                },
                                {
                                    title: 'QUANTITY',
                                    dataIndex: 'quantity_reserved',
                                    align: 'center',
                                    render: (v) => safeNumber(v)
                                },
                                {
                                    title: 'DAMAGED',
                                    dataIndex: 'quantity_damaged',
                                    align: 'center',
                                    render: (v) => safeNumber(v)
                                },
                                {
                                    title: 'MISSING',
                                    dataIndex: 'quantity_missing',
                                    align: 'center',
                                    render: (v) => safeNumber(v)
                                },
                                {
                                    title: 'STATUS',
                                    dataIndex: 'status',
                                    align: 'center',
                                    render: (status) => {
                                        const config = getStatusConfig(status);
                                        return (
                                            <span className="ue-status" style={{ color: config.color, background: config.bg }}>
                                                {config.text}
                                            </span>
                                        );
                                    }
                                },
                                {
                                    title: 'ACTION',
                                    key: 'action',
                                    align: 'center',
                                    render: (_, record) => {
                                        const isCheckedOut = record.status === 'checked_out';
                                        const isReturned = record.status === 'returned';
                                        if (isReturned) {
                                            return <Tag color="success">Returned</Tag>;
                                        }
                                        if (isCheckedOut) {
                                            return (
                                                <Button 
                                                    size="small" 
                                                    type="primary"
                                                    onClick={() => handleReturnEquipmentFromDetails(record)}
                                                >
                                                    Check In / Return
                                                </Button>
                                            );
                                        }
                                        return (
                                            <Tag color="default">{record.status || 'Pending'}</Tag>
                                        );
                                    }
                                }
                            ]}
                        />

                        <div className="ue-equipment-footer">
                            <div className="ue-equipment-booking-label">
                                <strong>BOOKING</strong> {formatBookingId(selectedBooking.booking_no)}
                            </div>
                            <div className="ue-equipment-date">
                                {dayjs().format('dddd, MMMM D, YYYY')}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER VIEW DETAILS MODAL - ALL IN ONE, NO SCROLLING
    // ========================================================
    const renderViewDetailsModal = () => {
        if (!viewModalData) return null;
        const record = viewModalData;
        
        return (
            <Modal
                title={
                    <div className="ue-modal-header">
                        <div className="ue-modal-icon"><EyeOutlined /></div>
                        <div className="ue-modal-title">Booking Details</div>
                        <div className="ue-modal-badge">{formatBookingId(record.booking_no)}</div>
                    </div>
                }
                open={viewModalVisible}
                onCancel={() => setViewModalVisible(false)}
                width={1100}
                className="ue-modal-clean"
                maskClosable={false}
                footer={
                    <div className="ue-modal-footer">
                        <Button onClick={() => setViewModalVisible(false)}>Close</Button>
                    </div>
                }
                destroyOnHidden={true}
                bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
            >
                <div className="ue-modal-body" style={{ padding: '16px 0' }}>
                    {/* Row 1: Customer & Event Info */}
                    <Row gutter={[16, 16]}>
                        <Col span={12}>
                            <div className="ue-info-card">
                                <div className="ue-info-label"><UserOutlined /> Customer Information</div>
                                <div className="ue-info-value" style={{ fontWeight: 600 }}>{record.customer_name}</div>
                                <div style={{ fontSize: 13, color: '#64748b' }}>
                                    <div><MailOutlined /> {record.customer_email || 'N/A'}</div>
                                    <div><PhoneOutlined /> {record.customer_phone || 'N/A'}</div>
                                    <div><HomeOutlined /> {record.customer_address || 'N/A'}</div>
                                </div>
                            </div>
                        </Col>
                        <Col span={12}>
                            <div className="ue-info-card">
                                <div className="ue-info-label"><CalendarOutlined /> Event Information</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                                    <div><span style={{ color: '#64748b' }}>Type:</span> <Tag color="blue">{getEventTypeName(record.event_type_id, eventTypes)}</Tag></div>
                                    {(() => {
                                        const statusConfig = getStatusConfig(getBookingDisplayStatus(record));
                                        return (
                                            <div>
                                                <span style={{ color: '#64748b' }}>Status:</span>{' '}
                                                <span className="ue-status" style={{ color: statusConfig.color, background: statusConfig.bg }}>
                                                    {statusConfig.icon} {statusConfig.text}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                    <div><span style={{ color: '#64748b' }}>Date:</span> {record.event_date}</div>
                                    <div><span style={{ color: '#64748b' }}>Time:</span> {record.event_time}</div>
                                    <div><span style={{ color: '#64748b' }}>Venue:</span> {record.venue || 'N/A'}</div>
                                    <div><span style={{ color: '#64748b' }}>Guests:</span> {record.guests_count} PAX</div>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Row 2: Payment Summary */}
                    <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                        <Col span={24}>
                            <div className="ue-info-card">
                                <div className="ue-info-label"><WalletOutlined /> Payment Summary</div>
                                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                                    <div><span style={{ color: '#64748b' }}>Total:</span> <strong>{formatCurrency(record.total_amount)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Paid:</span> <strong style={{ color: '#10b981' }}>{formatCurrency(record.paid_amount || 0)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Balance:</span> <strong style={{ color: (record.balance || 0) > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(record.balance || 0)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Status:</span> <Tag color={(record.balance || 0) <= 0 ? 'success' : 'warning'}>{(record.balance || 0) <= 0 ? 'Paid' : 'Partial'}</Tag></div>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Row 3: Quick Actions - All buttons in one row */}
                    <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                        <Col span={24}>
                            <div className="ue-info-card" style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Button size="small" icon={<StockOutlined />} onClick={() => handleCalculateIngredients(record)}>Calculate Ingredients</Button>
                                    <Button size="small" icon={<CoffeeOutlined />} onClick={() => handleViewKitchenPrep(record)}>Kitchen</Button>
                                    <Button size="small" icon={<TruckOutlined />} onClick={() => handleViewDeliveryPrep(record)}>Delivery</Button>
                                    <Button size="small" icon={<TeamOutlined />} onClick={() => handleStaffAssignment(record)}>Staff</Button>
                                    <Button size="small" icon={<CarOutlined />} onClick={() => handleViewDeliveryTracking(record)}>Tracking</Button>
                                    <Button size="small" icon={<CheckSquareOutlined />} onClick={() => handleViewChecklist(record)}>Checklist</Button>
                                    <Button size="small" icon={<PlusCircleOutlined />} onClick={() => handleViewEquipmentDetails(record)}>Equipment</Button>
                                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
                                    <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleStartEvent(record)}>Start</Button>
                                    <Button size="small" danger icon={<FlagOutlined />} onClick={() => handleCompleteEvent(record)}>Complete</Button>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Row 4: Orders/Meals Summary */}
                    <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                        <Col span={24}>
                            <div className="ue-info-card">
                                <div className="ue-info-label"><ForkOutlined /> Orders Summary ({safeArray(record.meal_services).length} meals)</div>
                                <div style={{ maxHeight: '120px', overflow: 'auto' }}>
                                    {safeArray(record.meal_services).slice(0, 5).map((meal, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                            <span><Tag color="blue" size="small">{meal.meal_type}</Tag> {meal.menu_name || meal.menuItem?.name || 'Meal'}</span>
                                            <span>{meal.pax || 0} PAX</span>
                                        </div>
                                    ))}
                                    {safeArray(record.meal_services).length > 5 && (
                                        <div style={{ color: '#64748b', fontSize: 12, padding: '4px 0' }}>
                                            + {safeArray(record.meal_services).length - 5} more meals
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Row 5: Staff Summary */}
                    <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                        <Col span={24}>
                            <div className="ue-info-card">
                                <div className="ue-info-label"><TeamOutlined /> Staff Assigned ({safeArray(record.assigned_staff).length})</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {safeArray(record.assigned_staff).slice(0, 6).map((staff, idx) => (
                                        <Tag key={idx} color={staff.status === 'confirmed' ? 'green' : 'orange'}>
                                            {staff.name || 'Staff'} {staff.role ? `(${staff.role})` : ''}
                                        </Tag>
                                    ))}
                                    {safeArray(record.assigned_staff).length > 6 && (
                                        <Tag>+{safeArray(record.assigned_staff).length - 6} more</Tag>
                                    )}
                                    {safeArray(record.assigned_staff).length === 0 && (
                                        <span style={{ color: '#94a3b8', fontSize: 13 }}>No staff assigned</span>
                                    )}
                                </div>
                            </div>
                        </Col>
                    </Row>
                </div>
            </Modal>
        );
    };

    // ========================================================
    // RENDER ONGOING EVENT WARNING
    // ========================================================
    const renderOngoingWarning = () => {
        const today = dayjs().format('YYYY-MM-DD');
        const ongoingEvents = allBookings.filter((booking) => {
            const status = safeString(booking.booking_status).toLowerCase();
            const eventDate = booking.event_date ? dayjs(booking.event_date).format('YYYY-MM-DD') : null;

            if (booking.event_done || booking.event_completed || status === 'completed') {
                return false;
            }

            return status === 'ongoing' || (status === 'confirmed' && eventDate === today);
        });

        if (ongoingEvents.length === 0) return null;

        return (
            <Alert
                message={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <WarningOutlined style={{ color: '#f59e0b' }} />
                        <span style={{ fontWeight: 600 }}>Event In Progress</span>
                    </div>
                }
                description={
                    <div>
                        {ongoingEvents.map(event => (
                            <div key={event.id} style={{ marginBottom: 4 }}>
                                <strong>{event.customer_name}</strong> - Booking: {formatBookingId(event.booking_no)}
                                {event.event_date && ` (${dayjs(event.event_date).format('MMMM D, YYYY')})`}
                            </div>
                        ))}
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            Please monitor meal services, staff, equipment, and payments throughout the event.
                        </div>
                    </div>
                }
                type="warning"
                showIcon={false}
                style={{ marginBottom: 16, borderLeftColor: '#f59e0b' }}
                className="ue-ongoing-warning"
            />
        );
    };

    // ========================================================
    // RENDER ONGOING EVENT TABS
    // ========================================================
    const renderOngoingTabs = (record) => {
        if (!record) return null;

        const status = safeString(record.booking_status).toLowerCase();
        if (status !== 'ongoing' || record.event_done || record.event_completed) return null;

        return (
            <div className="ue-ongoing-dashboard">
                <Tabs defaultActiveKey="overview" className="ue-ongoing-tabs" size="small">
                    <Tabs.TabPane tab="Overview" key="overview">
                        <div className="ue-ongoing-overview">
                            <Row gutter={[16, 16]}>
                                <Col span={8}>
                                    <div className="ue-stat-card">
                                        <div className="ue-stat-label">Status</div>
                                        <div className="ue-stat-value">
                                            <Tag color="processing">Ongoing</Tag>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={8}>
                                    <div className="ue-stat-card">
                                        <div className="ue-stat-label">Progress</div>
                                        <div className="ue-stat-value">{record.progress || 0}%</div>
                                    </div>
                                </Col>
                                <Col span={8}>
                                    <div className="ue-stat-card">
                                        <div className="ue-stat-label">Guest Count</div>
                                        <div className="ue-stat-value">{record.guests_count} PAX</div>
                                    </div>
                                </Col>
                            </Row>
                            <Divider orientation="left">Timeline</Divider>
                            <div className="ue-timeline">
                                <div className="ue-timeline-item">
                                    <div className="ue-timeline-dot success"></div>
                                    <div className="ue-timeline-content">
                                        <div className="ue-timeline-title">Booking Confirmed</div>
                                        <div className="ue-timeline-time">{record.created_at || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="ue-timeline-item">
                                    <div className="ue-timeline-dot processing"></div>
                                    <div className="ue-timeline-content">
                                        <div className="ue-timeline-title">Event Started</div>
                                        <div className="ue-timeline-time">{dayjs().format('MMMM D, YYYY HH:mm')}</div>
                                    </div>
                                </div>
                                <div className="ue-timeline-item">
                                    <div className="ue-timeline-dot pending"></div>
                                    <div className="ue-timeline-content">
                                        <div className="ue-timeline-title">Event Completion</div>
                                        <div className="ue-timeline-time">Pending</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Meal Services" key="meals">
                        <div className="ue-ongoing-meals">
                            {safeArray(record.meal_services).map((meal, idx) => (
                                <div key={idx} className="ue-meal-progress">
                                    <div className="ue-meal-progress-header">
                                        <span className="ue-meal-type">{meal.meal_type}</span>
                                        <Tag color={meal.meal_status === 'completed' ? 'success' : 'warning'}>
                                            {meal.meal_status || 'Pending'}
                                        </Tag>
                                    </div>
                                    <Progress
                                        percent={meal.meal_status === 'completed' ? 100 : 50}
                                        size="small"
                                        strokeColor={meal.meal_status === 'completed' ? '#10b981' : '#f59e0b'}
                                    />
                                </div>
                            ))}
                        </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Staff Tasks" key="staff">
                        <Table
                            dataSource={safeArray(record.assigned_staff)}
                            rowKey={(record, index) => record.staff_id || index}
                            size="small"
                            pagination={false}
                            columns={[
                                { title: 'Staff', dataIndex: 'name' },
                                { title: 'Role', dataIndex: 'role' },
                                { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'confirmed' ? 'success' : 'warning'}>{s}</Tag> },
                            ]}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Equipment" key="equipment">
                        <Table
                            dataSource={safeArray(record.equipment_in_out)}
                            rowKey={(record, index) => record.id || index}
                            size="small"
                            pagination={false}
                            columns={[
                                { title: 'Equipment', dataIndex: 'equipment_name', render: (v, r) => v || r.equipment?.name || 'N/A' },
                                { title: 'Quantity', dataIndex: 'quantity_reserved', align: 'center' },
                                { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'returned' ? 'success' : 'warning'}>{s}</Tag> },
                            ]}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Payments" key="payments">
                        <div className="ue-payment-summary-grid">
                            <div className="ue-payment-card">
                                <div className="ue-payment-label">Paid</div>
                                <div className="ue-payment-value" style={{ color: '#10b981' }}>
                                    {formatCurrency(safeNumber(record.paid_amount))}
                                </div>
                            </div>
                            <div className="ue-payment-card">
                                <div className="ue-payment-label">Balance</div>
                                <div className="ue-payment-value" style={{ color: safeNumber(record.balance) > 0 ? '#ef4444' : '#10b981' }}>
                                    {formatCurrency(safeNumber(record.balance))}
                                </div>
                            </div>
                            <div className="ue-payment-card">
                                <div className="ue-payment-label">Status</div>
                                <div className="ue-payment-value">
                                    <Tag color={safeNumber(record.balance) <= 0 ? 'success' : 'warning'}>
                                        {safeNumber(record.balance) <= 0 ? 'Paid' : 'Partial'}
                                    </Tag>
                                </div>
                            </div>
                        </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Issues / Notes" key="issues">
                        <div className="ue-ongoing-notes">
                            <TextArea
                                rows={4}
                                placeholder="Add notes or report issues..."
                                style={{ marginBottom: 12 }}
                            />
                            <Button type="primary">Add Note</Button>
                            <Divider orientation="left">Recent Notes</Divider>
                            <Empty description="No notes yet" />
                        </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Client Requests" key="requests">
                        <Empty description="No client requests" />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Completion Review" key="completion">
                        <div className="ue-completion-review">
                            <Alert
                                message="Before completing this event, please confirm:"
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <div className="ue-completion-checklist">
                                <div className="ue-completion-item">
                                    <Checkbox>All meals have been served</Checkbox>
                                </div>
                                <div className="ue-completion-item">
                                    <Checkbox>All equipment has been returned</Checkbox>
                                </div>
                                <div className="ue-completion-item">
                                    <Checkbox>All staff have completed their tasks</Checkbox>
                                </div>
                                <div className="ue-completion-item">
                                    <Checkbox>Payment has been completed</Checkbox>
                                </div>
                                <div className="ue-completion-item">
                                    <Checkbox>Final notes have been recorded</Checkbox>
                                </div>
                            </div>
                            <Space style={{ marginTop: 16 }} wrap>
                                <Button
                                    type="primary"
                                    icon={<CheckSquareOutlined />}
                                    disabled={Boolean(record.event_done)}
                                    onClick={() => handleMarkEventDone(record)}
                                >
                                    {record.event_done ? 'Marked as Done' : 'Mark as Done'}
                                </Button>
                                <Button
                                    type="primary"
                                    danger
                                    icon={<FlagOutlined />}
                                    onClick={() => handleCompleteEvent(record)}
                                >
                                    Complete Event
                                </Button>
                            </Space>
                        </div>
                    </Tabs.TabPane>
                </Tabs>
            </div>
        );
    };

    // ========================================================
    // RENDER LIVE STATUS MODAL
    // ========================================================
    const renderLiveStatusModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><DashboardOutlined /></div>
                    <div className="ue-modal-title">Event Live Status</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={liveStatusModalVisible}
            onCancel={() => setLiveStatusModalVisible(false)}
            width={1000}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Refresh</Button>
                    <Button type="primary" onClick={() => setLiveStatusModalVisible(false)}>Close</Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                {selectedBooking && renderOngoingTabs(selectedBooking)}
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER KITCHEN MODAL
    // ========================================================
    const renderKitchenModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><CoffeeOutlined /></div>
                    <div className="ue-modal-title">Kitchen Production Tasks</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={kitchenModalVisible}
            onCancel={() => setKitchenModalVisible(false)}
            width={1100}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Space>
                        <Button 
                            icon={<PrinterOutlined />} 
                            onClick={() => printKitchenTasks('all')}
                            type="primary"
                        >
                            Print Tasks
                        </Button>
                        <Dropdown
                            menu={{
                                items: getKitchenPrintMenuItems(),
                            }}
                            placement="topRight"
                        >
                            <Button icon={<PrinterOutlined />}>
                                Print by Meal, Day, or Item <DownOutlined />
                            </Button>
                        </Dropdown>
                        <Button onClick={() => setKitchenModalVisible(false)}>Close</Button>
                    </Space>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Spin spinning={kitchenLoading} tip="Loading kitchen tasks...">
                    <div id="kitchen-print-area">
                        {groupKitchenTasksByMeal(kitchenTasks).map((group, idx) => {
                            const headerLabel = group.label;

                            return (
                                <div key={idx} className="ue-kitchen-group">
                                    <div className="ue-kitchen-group-title">{headerLabel}</div>
                                    <div className="ue-kitchen-table">
                                        <div className="ue-kitchen-header-row">
                                            <span>TASK</span>
                                            <span>QTY</span>
                                            <span>START</span>
                                            <span>OUT FOR DELIVERY</span>
                                            <span>ASSIGNED TO</span>
                                            <span>DONE</span>
                                        </div>
                                        {group.tasks.map((task, taskIdx) => (
                                            <div key={task.id || taskIdx} className="ue-kitchen-row">
                                                <span className="ue-task-name">{task.task}</span>
                                                <span>{task.quantity || '-'}</span>
                                                <span>
                                                    <Input 
                                                        size="small" 
                                                        value={task.start_time || '-'} 
                                                        onChange={(e) => {
                                                            const updated = [...kitchenTasks];
                                                            const index = updated.findIndex(t => t.id === task.id);
                                                            if (index !== -1) {
                                                                updated[index].start_time = e.target.value;
                                                                setKitchenTasks(updated);
                                                            }
                                                        }}
                                                        onBlur={() => handleUpdateKitchenTask(task.id, { start_time: task.start_time })}
                                                        style={{ width: 100, fontSize: 12 }}
                                                        placeholder="Start"
                                                    />
                                                </span>
                                                <span>
                                                    <Input 
                                                        size="small" 
                                                        value={task.out_for_delivery || '-'} 
                                                        onChange={(e) => {
                                                            const updated = [...kitchenTasks];
                                                            const index = updated.findIndex(t => t.id === task.id);
                                                            if (index !== -1) {
                                                                updated[index].out_for_delivery = e.target.value;
                                                                setKitchenTasks(updated);
                                                            }
                                                        }}
                                                        onBlur={() => handleUpdateKitchenTask(task.id, { out_for_delivery: task.out_for_delivery })}
                                                        style={{ width: 100, fontSize: 12 }}
                                                        placeholder="Out"
                                                    />
                                                </span>
                                                <span>{task.assigned_to || 'Kitchen Team'}</span>
                                                <span>
                                                    <Checkbox 
                                                        checked={Boolean(task.is_done || task.status === 'completed')} 
                                                        onChange={(e) => handleUpdateKitchenTask(task.id, { is_done: e.target.checked })}
                                                    />
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {kitchenTasks.length === 0 && (
                            <Empty description="No kitchen tasks found. Click 'Refresh Kitchen' to generate tasks." />
                        )}
                    </div>
                </Spin>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER DELIVERY MODAL - PROPERLY ALIGNED
    // ========================================================
    const renderDeliveryModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><TruckOutlined /></div>
                    <div className="ue-modal-title">Delivery Preparation Items</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={deliveryModalVisible}
            onCancel={() => {
                setDeliveryModalVisible(false);
                setShowAddDeliveryItem(false);
            }}
            width={1100}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print Delivery List</Button>
                    <Button onClick={() => setDeliveryModalVisible(false)}>Close</Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <div className="ue-delivery-header">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                        setShowAddDeliveryItem(true);
                        loadAvailableEquipment();
                    }}>
                        Add Item
                    </Button>
                    <Button 
                        icon={<SyncOutlined />} 
                        onClick={() => handleAddToDelivery(selectedBooking)}
                        style={{ marginLeft: 8 }}
                    >
                        Refresh
                    </Button>
                </div>

                <Modal
                    title="Select Inventory Items"
                    open={showAddDeliveryItem}
                    onCancel={() => { setShowAddDeliveryItem(false); setSelectedEquipment({}); }}
                    footer={null}
                    width={900}
                    maskClosable={false}
                    destroyOnHidden={false}
                >
                    <div className="ue-add-delivery">
                        <Alert type="info" showIcon message="Choose equipment and review available inventory items" description="Equipment quantities are validated against available stock before they can be reserved." style={{ marginBottom: 12 }} />
                        <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                            <Input.Search placeholder="Search equipment..." value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} onSearch={loadAvailableEquipment} style={{ width: 280 }} />
                            <Text strong>{Object.keys(selectedEquipment).length} selected</Text>
                        </Space>
                        <Table
                            size="small"
                            loading={loadingEquipment}
                            dataSource={availableEquipment}
                            rowKey={(record) => record.id || record.equipment_id}
                            pagination={{ pageSize: 5 }}
                            columns={[
                                { 
                                    title: '', 
                                    width: 48, 
                                    render: (_, equipment) => {
                                        const id = equipment.id || equipment.equipment_id;
                                        const isChecked = Boolean(selectedEquipment[id]) && selectedEquipment[id].quantity > 0;
                                        const available = safeNumber(equipment.available_quantity ?? equipment.available, 0);
                                        return (
                                            <Checkbox
                                                checked={isChecked}
                                                disabled={available <= 0}
                                                onChange={(event) => toggleEquipmentSelection(equipment, event.target.checked)}
                                            />
                                        );
                                    }
                                },
                                { 
                                    title: 'Equipment', 
                                    render: (_, equipment) => equipment.name || equipment.item_name || equipment.equipment_name || 'Equipment' 
                                },
                                { 
                                    title: 'Total', 
                                    width: 80, 
                                    align: 'center',
                                    render: (_, equipment) => equipment.total_quantity || 0 
                                },
                                { 
                                    title: 'Available', 
                                    width: 80, 
                                    align: 'center',
                                    render: (_, equipment) => {
                                        const id = equipment.id || equipment.equipment_id;
                                        return selectedEquipment[id]?.available_quantity ?? equipment.available_quantity ?? equipment.available ?? 0;
                                    }
                                },
                                { 
                                    title: 'Reserved', 
                                    width: 80, 
                                    align: 'center',
                                    render: (_, equipment) => {
                                        const total = equipment.total_quantity || 0;
                                        const available = equipment.available_quantity ?? equipment.available ?? 0;
                                        return total - available;
                                    }
                                },
                                { 
                                    title: 'Qty Needed', 
                                    width: 120, 
                                    render: (_, equipment) => {
                                        const id = equipment.id || equipment.equipment_id;
                                        const currentQty = selectedEquipment[id]?.quantity || 1;
                                        const maxQty = selectedEquipment[id]?.available_quantity ?? equipment.available_quantity ?? equipment.available ?? 0;
                                        return (
                                            <InputNumber
                                                min={1}
                                                max={maxQty}
                                                disabled={maxQty <= 0}
                                                value={currentQty}
                                                onChange={(value) => updateSelectedEquipmentQty(equipment, value)}
                                                style={{ width: '100%' }}
                                            />
                                        );
                                    }
                                }
                            ]}
                        />
                        <Divider orientation="left">Available Inventory Items</Divider>
                        <Table
                            size="small"
                            loading={loadingEquipment}
                            dataSource={availableInventoryItems}
                            rowKey={(record) => record.id}
                            pagination={{ pageSize: 5 }}
                            columns={[
                                { title: 'Inventory Item', dataIndex: 'name' },
                                { title: 'Type', dataIndex: 'type', width: 160 },
                                { title: 'Available', dataIndex: 'available_quantity', width: 110, align: 'center' },
                                { title: 'Unit', dataIndex: 'unit', width: 90, align: 'center' },
                            ]}
                        />
                        <div style={{ marginTop: 12, textAlign: 'right' }}>
                            <Button style={{ marginRight: 8 }} onClick={() => { setShowAddDeliveryItem(false); setSelectedEquipment({}); }}>Cancel</Button>
                            <Button type="primary" icon={<SaveOutlined />} onClick={handleAddDeliveryItem}>Save Selected Equipment</Button>
                        </div>
                    </div>
                </Modal>

                <Table
                    className="ue-delivery-table"
                    dataSource={deliveryItems}
                    rowKey={(item, index) => item.id || index}
                    size="small"
                    pagination={{
                        current: deliveryCurrentPage,
                        pageSize: deliveryPageSize,
                        onChange: (page, size) => {
                            setDeliveryCurrentPage(page);
                            if (size) setDeliveryPageSize(size);
                        },
                        showSizeChanger: true,
                        pageSizeOptions: [5, 10, 20],
                        showTotal: (total) => `Total ${total} items`,
                    }}
                    scroll={{ x: 760 }}
                    columns={[
                        { title: 'Item', dataIndex: 'item', width: 210, fixed: 'left', render: (value) => <Text strong>{value || 'Delivery item'}</Text> },
                        { title: 'Quantity', dataIndex: 'quantity', width: 110, align: 'center', render: (value, item) => (
                            <InputNumber min={1} value={safeNumber(value, 1)} onChange={(quantity) => handleUpdateDeliveryItem(item.id, { quantity: safeNumber(quantity, 1) })} style={{ width: 80 }} />
                        ) },
                        { title: 'Scheduled', dataIndex: 'scheduled_time', width: 140, render: (value) => value || selectedBooking?.event_date || '-' },
                        { title: 'Available', dataIndex: 'available_quantity', width: 100, align: 'center', render: (value) => value ?? '-' },
                        { title: 'Ready', dataIndex: 'is_ready', width: 90, align: 'center', render: (_, item) => (
                            <Checkbox checked={Boolean(item.is_ready || item.status === 'ready')} onChange={(event) => handleUpdateDeliveryItem(item.id, { is_ready: event.target.checked })} />
                        ) },
                        { title: 'Action', key: 'action', width: 90, align: 'center', fixed: 'right', render: (_, item) => (
                            <Popconfirm title="Remove this delivery preparation item?" onConfirm={() => handleRemoveDeliveryPreparationItem(item.id)}>
                                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                            </Popconfirm>
                        ) },
                    ]}
                    locale={{ emptyText: <Empty description="No delivery items added. Click '+ Add Item' to add delivery items." /> }}
                />
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER STAFF ASSIGNMENT MODAL
    // ========================================================
    const renderStaffAssignmentModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><TeamOutlined /></div>
                    <div className="ue-modal-title">Staff Assignment</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={staffAssignmentModalVisible}
            onCancel={() => setStaffAssignmentModalVisible(false)}
            width={900}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button onClick={() => setStaffAssignmentModalVisible(false)}>Close</Button>
                    <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddStaffModalVisible(true)}>
                        Assign Staff
                    </Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={24} md={8}><Card size="small"><Text type="secondary">Event Location</Text><div><EnvironmentOutlined /> {selectedBooking?.venue || 'N/A'}</div></Card></Col>
                    <Col xs={12} md={8}><Card size="small"><Text type="secondary">Event Date</Text><div><CalendarOutlined /> {selectedBooking?.event_date || 'N/A'}</div></Card></Col>
                    <Col xs={12} md={8}><Card size="small"><Text type="secondary">Event Time</Text><div><ClockCircleOutlined /> {selectedBooking?.event_time || 'N/A'}</div></Card></Col>
                </Row>
                {assignedStaff.length > 0 ? (
                    <Table
                        dataSource={assignedStaff}
                        rowKey={(record, index) => record.staff_id || index}
                        size="small"
                        pagination={false}
                        columns={[
                            { title: 'Employee', dataIndex: 'name', width: 150 },
                            { title: 'Role', dataIndex: 'role', width: 120 },
                            { title: 'Schedule', dataIndex: 'schedule', width: 120 },
                            { title: 'Time In', dataIndex: 'start_time', width: 100 },
                            { title: 'Time Out', dataIndex: 'end_time', width: 100 },
                            { title: 'Status', dataIndex: 'status', width: 120, render: (s, record) => (
                                <Select value={s} size="small" onChange={(val) => handleUpdateStaffStatus(selectedBooking?.id, record.staff_id, val)} style={{ width: 100 }}>
                                    <Option value="pending">Pending</Option>
                                    <Option value="confirmed">Confirmed</Option>
                                    <Option value="declined">Declined</Option>
                                </Select>
                            )},
                            { title: 'Actions', width: 100, render: (_, record) => (
                                <Popconfirm title="Remove staff?" onConfirm={() => handleRemoveStaff(selectedBooking?.id, record.staff_id)}>
                                    <Button type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            )}
                        ]}
                    />
                ) : (
                    <Empty description="No staff assigned to this event" />
                )}
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER ADD STAFF MODAL
    // ========================================================
    const renderAddStaffModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><UserAddOutlined /></div>
                    <div className="ue-modal-title">Assign Staff to Event</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={addStaffModalVisible}
            onCancel={() => { setAddStaffModalVisible(false); staffForm.resetFields(); }}
            width={580}
            className="ue-modal-clean"
            maskClosable={false}
            footer={null}
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Form form={staffForm} layout="vertical" onFinish={handleAddStaffToEvent}>
                    <Form.Item name="staff_id" label="Select Staff Members" rules={[{ required: true }]}>
                        <Select mode="multiple" showSearch placeholder="Search and select staff members..." optionFilterProp="children" loading={staffLoading}>
                            {staffList.map(staff => (
                                <Option key={staff.employee_id || staff.id} value={staff.employee_id || staff.id}>
                                    {staff.full_name || staff.name || 'Unknown'} - {staff.position?.title || staff.position || 'Staff'}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                        <Input placeholder="e.g., Event Coordinator" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_time" label="Start Time" rules={[{ required: true }]}>
                                <TimePicker use12Hours format="h:mm A" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="end_time" label="End Time" rules={[{ required: true }]}>
                                <TimePicker use12Hours format="h:mm A" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="phone" label="Contact Number">
                        <Input placeholder="Phone number" />
                    </Form.Item>
                    <Form.Item name="email" label="Email Address">
                        <Input placeholder="Email address" />
                    </Form.Item>
                    <div className="ue-modal-footer">
                        <Button onClick={() => { setAddStaffModalVisible(false); staffForm.resetFields(); }}>Cancel</Button>
                        <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}>Assign Staff</Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER DELIVERY TRACKING MODAL
    // ========================================================
    const renderDeliveryTrackingModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><CarOutlined /></div>
                    <div className="ue-modal-title">Delivery Tracking</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={deliveryTrackingModalVisible}
            onCancel={() => setDeliveryTrackingModalVisible(false)}
            width={900}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                        setEditingDelivery(null);
                        addDeliveryForm.resetFields();
                        addDeliveryForm.setFieldsValue({
                            booking_id: selectedBooking?.booking_id || selectedBooking?.id,
                            venue: selectedBooking?.venue || '',
                            delivery_date: selectedBooking?.event_date ? dayjs(selectedBooking.event_date) : null,
                            delivery_time: selectedBooking?.event_time || ''
                        });
                        setAddDeliveryModalVisible(true);
                    }}>Add Delivery</Button>
                    <Button onClick={() => setDeliveryTrackingModalVisible(false)}>Close</Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Spin spinning={deliveryTrackingLoading} tip="Loading delivery tracking...">
                    <Table
                        dataSource={deliveryTrackings}
                        rowKey={(record) => record.id}
                        columns={[
                            { title: 'Meal / Date', key: 'meal_date', render: (_, record) => <div><strong>{record.meal_type || record.delivery_type || 'Delivery'}</strong><div style={{ fontSize: 12, color: '#64748b' }}>{record.delivery_date || record.event_date || '-'}</div></div> },
                            { title: 'Venue', dataIndex: 'venue', render: (v, r) => v || r.location || '-' },
                            { title: 'Driver', key: 'driver', render: (_, record) => <div>{record.driver || '-'}<div style={{ fontSize: 12, color: '#64748b' }}>{record.driver_phone || '-'}</div></div> },
                            { title: 'Items', dataIndex: 'items', ellipsis: true, render: (v) => v || '-' },
                            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={getStatusConfig(s).color}>{getStatusConfig(s).text}</Tag> },
                            { title: 'Action', key: 'action', width: 320, render: (_, record) => (
                                <Space size={4}>
                                    <Select value={record.status} size="small" onChange={(val) => handleUpdateDeliveryStatus(record.id, val)} style={{ width: 115 }}>
                                        <Option value="pending">Pending</Option>
                                        <Option value="departed">Departed</Option>
                                        <Option value="en_route">En Route</Option>
                                        <Option value="arrived">Arrived</Option>
                                        <Option value="completed">DONE</Option>
                                    </Select>
                                    <Tooltip title="Edit driver or delivery items">
                                        <Button size="small" icon={<EditOutlined />} onClick={() => handleEditDelivery(record)} />
                                    </Tooltip>
                                    <Popconfirm title="Remove the assigned driver?" onConfirm={() => handleClearDeliveryData(record, 'driver')} disabled={!record.driver && !record.driver_phone}>
                                        <Tooltip title="Remove driver">
                                            <Button size="small" icon={<UserOutlined />} disabled={!record.driver && !record.driver_phone} />
                                        </Tooltip>
                                    </Popconfirm>
                                    <Popconfirm title="Remove the listed delivery items?" onConfirm={() => handleClearDeliveryData(record, 'items')} disabled={!record.items}>
                                        <Tooltip title="Remove delivery items">
                                            <Button size="small" icon={<OrderedListOutlined />} disabled={!record.items} />
                                        </Tooltip>
                                    </Popconfirm>
                                    <Popconfirm title="Remove this delivery record?" onConfirm={() => handleDeleteDelivery(record.id)}>
                                        <Tooltip title="Delete delivery record">
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Tooltip>
                                    </Popconfirm>
                                </Space>
                            )}
                        ]}
                        pagination={false}
                        size="small"
                    />
                </Spin>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER CHECKLIST MODAL
    // ========================================================
    const renderChecklistModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><CheckSquareOutlined /></div>
                    <div className="ue-modal-title">Event Checklist</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={checklistModalVisible}
            onCancel={() => setChecklistModalVisible(false)}
            width={800}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                        const task = prompt('Enter task description:');
                        const assignedTo = prompt('Assign to:');
                        if (task) handleAddChecklistItem({ task, assigned_to: assignedTo || 'Unassigned' });
                    }}>+ Add Task</Button>
                    <Button onClick={() => setChecklistModalVisible(false)}>Close</Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Spin spinning={checklistLoading} tip="Loading checklist...">
                    <div className="ue-checklist-header">
                        <span className="ue-id-text">{formatBookingId(selectedBooking?.booking_no)}</span>
                        <span className="ue-customer-name">{selectedBooking?.customer_name}</span>
                        <Tag color="blue">{selectedBooking?.event_date}</Tag>
                    </div>

                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Tag color="blue">📋 System Tasks</Tag>
                        <Tag color="green">📦 Delivery Items</Tag>
                        <Tag color="purple">✏️ Custom Tasks</Tag>
                    </div>

                    <List
                        dataSource={checklist}
                        rowKey={(item) => item.id}
                        renderItem={item => (
                            <List.Item
                                className="ue-checklist-item"
                                actions={[
                                    <Checkbox key="completed" checked={Boolean(item.completed ?? item.status === 'completed')} onChange={(e) => handleUpdateChecklistItem(item.id, e.target.checked)}>
                                        Completed
                                    </Checkbox>,
                                    !item.is_delivery && item.source_type !== 'system' && (
                                        <Popconfirm key="delete" title="Delete this item?" onConfirm={() => handleDeleteChecklistItem(item)}>
                                            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                        </Popconfirm>
                                    )
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        Boolean(item.completed ?? item.status === 'completed')
                                            ? <CheckCircleOutlined style={{ color: '#10b981', fontSize: 18 }} />
                                            : <ClockCircleOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
                                    }
                                    title={
                                        <div>
                                            <span>{item.task}</span>
                                            {item.is_delivery && <Tag color="blue" size="small" style={{ marginLeft: 8 }}>Delivery</Tag>}
                                            {item.source_type === 'system' && <Tag color="green" size="small" style={{ marginLeft: 8 }}>System</Tag>}
                                            {item.source_type === 'manual' && <Tag color="purple" size="small" style={{ marginLeft: 8 }}>Custom</Tag>}
                                        </div>
                                    }
                                    description={`Assigned to: ${item.assigned_to || 'Unassigned'}${item.notes ? ` | ${item.notes}` : ''}`}
                                />
                            </List.Item>
                        )}
                    />

                    <Progress 
                        percent={Math.round((checklist.filter(i => Boolean(i.completed ?? i.status === 'completed')).length / Math.max(checklist.length, 1)) * 100)} 
                        strokeColor="#3b82f6" 
                        style={{ marginTop: 20 }} 
                    />
                </Spin>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER INGREDIENTS MODAL - OVERALL EVENT SUMMARY ONLY
    // ========================================================
    const renderIngredientsModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><StockOutlined /></div>
                    <div className="ue-modal-title">Calculate Ingredients</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={ingredientsModalVisible}
            onCancel={() => setIngredientsModalVisible(false)}
            width={1000}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button onClick={() => setIngredientsModalVisible(false)}>Close</Button>
                    <Button
                        icon={<ShoppingOutlined />}
                        type="primary"
                        onClick={() => handleAddToShoppingList(selectedBooking?.id, computedIngredients)}
                        loading={addToShoppingListMutation.isLoading}
                        disabled={computedIngredients.length === 0 || !computedIngredients.some(i => i.need_to_buy)}
                    >
                        Add to Purchase List ({computedIngredients.filter(i => i.need_to_buy).length})
                    </Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                {selectedBooking && (
                    <>
                        {/* Total Book Section */}
                        <div className="ue-ingredients-total-book">
                            <div className="ue-total-book-header">
                                <h2>Total Book</h2>
                            </div>
                            <div className="ue-total-book-content">
                                <div className="ue-total-book-row">
                                    <span className="ue-total-book-label">Booking ID:</span>
                                    <span className="ue-total-book-value ue-id-text">{formatBookingId(selectedBooking.booking_no)}</span>
                                </div>
                                <div className="ue-total-book-row">
                                    <span className="ue-total-book-label">Customer:</span>
                                    <span className="ue-total-book-value">{selectedBooking.customer_name}</span>
                                </div>
                                <div className="ue-total-book-row">
                                    <span className="ue-total-book-label">Event Date:</span>
                                    <span className="ue-total-book-value">{selectedBooking.event_date}</span>
                                </div>
                                <div className="ue-total-book-row">
                                    <span className="ue-total-book-label">Total Guests:</span>
                                    <span className="ue-total-book-value">{selectedBooking.guests_count} PAX</span>
                                </div>
                            </div>
                        </div>

                        {/* Menu Item Selection - calculations remain combined in one summary */}
                        <div className="ue-modal-section">
                            <div className="ue-modal-section-title"><ForkOutlined /> Menu Items to Calculate</div>
                            <Row gutter={[12, 12]} align="middle">
                                <Col flex="auto">
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        showSearch
                                        value={selectedIngredientMenuItemIds}
                                        placeholder="Select one or more menu items"
                                        optionFilterProp="label"
                                        style={{ width: '100%' }}
                                        onChange={(values) => setSelectedIngredientMenuItemIds(
                                            safeArray(values).map((value) => String(value))
                                        )}
                                        options={ingredientMenuItems.map((menuItem) => ({
                                            value: String(menuItem.menu_item_id ?? menuItem.id),
                                            label: `${menuItem.name || 'Menu Item'}${menuItem.quantity ? ` (${menuItem.quantity} serving${safeNumber(menuItem.quantity) === 1 ? '' : 's'})` : ''}`,
                                        }))}
                                    />
                                </Col>
                                <Col>
                                    <Button
                                        type="primary"
                                        icon={<StockOutlined />}
                                        onClick={handleRecalculateIngredients}
                                        loading={isComputingIngredients}
                                        disabled={ingredientMenuItems.length === 0 || selectedIngredientMenuItemIds.length === 0}
                                    >
                                        Calculate Selected
                                    </Button>
                                </Col>
                            </Row>
                            <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
                                Select a specific dish, such as Adobo, or select several dishes. Ingredient requirements are combined and shown only in the full event summary below.
                            </div>
                        </div>

                        {/* Full Event Ingredients Summary Section */}
                        <div className="ue-modal-section">
                            <div className="ue-modal-section-title">
                                <StockOutlined /> Full Event Ingredients Summary
                                {selectedIngredientMenuItemIds.length > 0 && (
                                    <Tag color="blue" style={{ marginLeft: 8 }}>
                                        {selectedIngredientMenuItemIds.length} menu item{selectedIngredientMenuItemIds.length === 1 ? '' : 's'}
                                    </Tag>
                                )}
                            </div>
                            {isComputingIngredients ? (
                                <div className="ue-loading"><Spin tip="Computing ingredient requirements..." /></div>
                            ) : computedIngredients.length === 0 ? (
                                <Empty description="No ingredients computed yet." />
                            ) : (
                                <Table
                                    dataSource={computedIngredients}
                                    rowKey={(record) => record.ingredient_id}
                                    size="small"
                                    pagination={{ pageSize: 10 }}
                                    columns={[
                                        { 
                                            title: 'Select', 
                                            key: 'select', 
                                            width: 50, 
                                            render: (_, record) => (
                                                <Checkbox 
                                                    checked={selectedIngredientIds.includes(record.ingredient_id)}
                                                    disabled={!record.need_to_buy}
                                                    onChange={(e) => {
                                                        setSelectedIngredientIds(prev => e.target.checked
                                                            ? [...prev, record.ingredient_id]
                                                            : prev.filter(id => id !== record.ingredient_id)
                                                        );
                                                    }}
                                                />
                                            )
                                        },
                                        { 
                                            title: 'Ingredient', 
                                            dataIndex: 'name', 
                                            render: (v) => <span className="ue-ingredient-name">{v}</span> 
                                        },
                                        { 
                                            title: 'Meal Type', 
                                            key: 'meal_type', 
                                            render: (_, record) => safeArray(record.menu_items).map(mi => mi.meal_type).filter(Boolean).join(', ') || '-' 
                                        },
                                        { 
                                            title: 'Per Pax', 
                                            key: 'per_pax', 
                                            render: (_, record) => `${record.per_pax} ${record.unit}` 
                                        },
                                        { 
                                            title: 'Total Needed', 
                                            key: 'needed', 
                                            render: (_, record) => `${Math.round(record.quantity_needed * 100) / 100} ${record.unit}` 
                                        },
                                        { 
                                            title: 'Current Stock', 
                                            key: 'stock', 
                                            render: (_, record) => `${Math.round(record.current_stock * 100) / 100} ${record.unit}` 
                                        },
                                        { 
                                            title: 'Reserved', 
                                            key: 'reserved', 
                                            render: (_, record) => `${Math.round(record.reserved_quantity * 100) / 100} ${record.unit}` 
                                        },
                                        { 
                                            title: 'Available', 
                                            key: 'available', 
                                            render: (_, record) => `${Math.round(record.available_stock * 100) / 100} ${record.unit}` 
                                        },
                                        { 
                                            title: 'Shortage', 
                                            key: 'shortage', 
                                            render: (_, record) => record.shortage > 0 ? 
                                                <span className="ue-shortage">{Math.round(record.shortage * 100) / 100} {record.unit}</span> : 
                                                <span className="ue-sufficient">Sufficient</span> 
                                        },
                                        { 
                                            title: 'Status', 
                                            key: 'status', 
                                            render: (_, record) => record.need_to_buy ? 
                                                <Tag color="error">Need to Buy</Tag> : 
                                                <Tag color="success">In Stock</Tag> 
                                        },
                                    ]}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER EDIT MODAL
    // ========================================================
    const renderEditModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><EditOutlined /></div>
                    <div className="ue-modal-title">Edit Booking</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={editModalVisible}
            onCancel={() => { setEditModalVisible(false); editForm.resetFields(); }}
            width={700}
            className="ue-modal-clean"
            maskClosable={false}
            footer={
                <div className="ue-modal-footer">
                    <Button onClick={() => setEditModalVisible(false)}>Cancel</Button>
                    <Button type="primary" onClick={() => editForm.submit()}>Save Changes</Button>
                </div>
            }
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Form form={editForm} layout="vertical" onFinish={handleUpdateBooking}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="customer_name" label="Customer Name" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="customer_email" label="Email" rules={[{ required: true, type: 'email' }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="customer_phone" label="Phone">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="venue" label="Venue" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="event_type_id" label="Event Type" rules={[{ required: true }]}>
                                <Select>
                                    {safeArray(eventTypes).map(type => (
                                        <Option key={type.event_type_id || type.id} value={type.event_type_id || type.id}>
                                            {type.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="guests_count" label="Number of Guests" rules={[{ required: true }]}>
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="event_date" label="Event Date" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="event_time" label="Event Time" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="8:00 AM">8:00 AM</Option>
                                    <Option value="9:00 AM">9:00 AM</Option>
                                    <Option value="10:00 AM">10:00 AM</Option>
                                    <Option value="11:00 AM">11:00 AM</Option>
                                    <Option value="12:00 PM">12:00 PM</Option>
                                    <Option value="1:00 PM">1:00 PM</Option>
                                    <Option value="2:00 PM">2:00 PM</Option>
                                    <Option value="3:00 PM">3:00 PM</Option>
                                    <Option value="4:00 PM">4:00 PM</Option>
                                    <Option value="5:00 PM">5:00 PM</Option>
                                    <Option value="6:00 PM">6:00 PM</Option>
                                    <Option value="7:00 PM">7:00 PM</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="special_requests" label="Special Requests">
                        <TextArea rows={3} placeholder="Any special requests or notes..." />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER STATUS UPDATE MODAL
    // ========================================================
    const renderStatusUpdateModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><SyncOutlined /></div>
                    <div className="ue-modal-title">Update Status</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={statusUpdateModalVisible}
            onCancel={() => setStatusUpdateModalVisible(false)}
            width={450}
            className="ue-modal-clean"
            maskClosable={false}
            footer={null}
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <div className="ue-status-buttons">
                    {['pending_approval', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rescheduled'].map(status => {
                        const config = getStatusConfig(status);
                        return (
                            <button
                                key={status}
                                className={`ue-status-btn ${selectedBooking?.booking_status === status ? 'active' : ''}`}
                                onClick={() => handleConfirmStatusUpdate(status)}
                                style={{ borderColor: config.color, color: config.color, background: config.bg }}
                            >
                                {config.icon} {config.text}
                            </button>
                        );
                    })}
                </div>
                <div className="ue-status-cancel">
                    <Button onClick={() => setStatusUpdateModalVisible(false)}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER PAYMENT MODAL
    // ========================================================
    const renderPaymentModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><WalletOutlined /></div>
                    <div className="ue-modal-title">Payment</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={paymentModalVisible}
            onCancel={() => { setPaymentModalVisible(false); paymentForm.resetFields(); }}
            width={500}
            className="ue-modal-clean"
            maskClosable={false}
            footer={null}
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <div className="ue-payment-summary">
                    <div><span>Total Amount:</span> <strong>{formatCurrency(selectedBooking?.total_amount)}</strong></div>
                    <div><span>Paid:</span> <strong>{formatCurrency(selectedBooking?.paid_amount || 0)}</strong></div>
                    <div><span>Balance:</span> <strong style={{ color: safeNumber(selectedBooking?.balance || 0) > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(selectedBooking?.balance || 0)}</strong></div>
                </div>
                <Form form={paymentForm} layout="vertical">
                    <Form.Item name="payment_type" hidden>
                        <Input />
                    </Form.Item>
                    <Form.Item name="amount" label="Payment Amount" rules={[{ required: true }]}>
                        <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            placeholder="Enter payment amount"
                            step={0.01}
                            onFocus={() => {
                                if (safeNumber(paymentForm.getFieldValue('amount'), 0) === 0) {
                                    paymentForm.setFieldValue('amount', undefined);
                                }
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="payment_method" label="Payment Method" rules={[{ required: true }]}>
                        <Select>
                            <Option value="cash">Cash</Option>
                            <Option value="card">Credit Card</Option>
                            <Option value="bank_transfer">Bank Transfer</Option>
                            <Option value="gcash">GCash</Option>
                            <Option value="maya">Maya</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="notes" label="Notes">
                        <TextArea rows={2} placeholder="Payment notes..." />
                    </Form.Item>
                    <div className="ue-modal-footer">
                        <Button onClick={() => setPaymentModalVisible(false)}>Cancel</Button>
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => {
                            const values = paymentForm.getFieldsValue();
                            handleRecordPayment(values);
                        }}>Record Payment</Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER EQUIPMENT CHECKOUT MODAL
    // ========================================================
    const renderEquipmentCheckoutModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><PlusCircleOutlined /></div>
                    <div className="ue-modal-title">Approve Equipment Out</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={equipmentCheckoutModalVisible}
            onCancel={() => setEquipmentCheckoutModalVisible(false)}
            width={500}
            className="ue-modal-clean"
            maskClosable={false}
            footer={null}
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Form form={equipmentForm} layout="vertical" onFinish={handleApproveAllEquipmentFromDetails}>
                    <Form.Item name="expected_return_date" label="Expected Return Date" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="condition_out" label="Condition (Out)" rules={[{ required: true }]}>
                        <Select>
                            <Option value="Excellent">Excellent</Option>
                            <Option value="Good">Good</Option>
                            <Option value="Fair">Fair</Option>
                            <Option value="Poor">Poor</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="checked_out_by" label="Checked Out By">
                        <Input placeholder="Name of person checking out" />
                    </Form.Item>
                    <Form.Item name="notes" label="Notes">
                        <TextArea rows={3} placeholder="Additional notes" />
                    </Form.Item>
                    <div className="ue-modal-footer">
                        <Button onClick={() => setEquipmentCheckoutModalVisible(false)}>Cancel</Button>
                        <Button type="primary" htmlType="submit">Approve Equipment Out</Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER EQUIPMENT RETURN MODAL
    // ========================================================
    const renderEquipmentReturnModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><SwapOutlined /></div>
                    <div className="ue-modal-title">Return Equipment</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={equipmentReturnModalVisible}
            onCancel={() => {
                setEquipmentReturnModalVisible(false);
                setSelectedEquipmentItem(null);
                equipmentForm.resetFields();
            }}
            width={500}
            className="ue-modal-clean"
            maskClosable={false}
            footer={null}
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                {selectedEquipmentItem && (
                    <div>
                        <div className="ue-return-summary">
                            <div><strong>Equipment:</strong> {selectedEquipmentItem.equipment?.name || 'N/A'}</div>
                            <div><strong>Quantity:</strong> {selectedEquipmentItem.quantity_reserved || 0}</div>
                            <div><strong>Status:</strong> <Tag color={getStatusConfig(selectedEquipmentItem.status).color}>{getStatusConfig(selectedEquipmentItem.status).text}</Tag></div>
                        </div>
                        <Divider />
                        <Form form={equipmentForm} layout="vertical" onFinish={handleReturnEquipment}>
                            <Form.Item name="condition_in" label="Condition (In)" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="Excellent">Excellent</Option>
                                    <Option value="Good">Good</Option>
                                    <Option value="Fair">Fair</Option>
                                    <Option value="Poor">Poor</Option>
                                </Select>
                            </Form.Item>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item name="quantity_used" label="Used">
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="quantity_damaged" label="Damaged">
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="quantity_missing" label="Missing">
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="returned_by" label="Returned By">
                                <Input placeholder="Name of person returning" />
                            </Form.Item>
                            <Form.Item name="return_notes" label="Notes">
                                <TextArea rows={3} placeholder="Return notes..." />
                            </Form.Item>
                            <div className="ue-modal-footer">
                                <Button onClick={() => setEquipmentReturnModalVisible(false)}>Cancel</Button>
                                <Button type="primary" htmlType="submit">Confirm Return</Button>
                            </div>
                        </Form>
                    </div>
                )}
            </div>
        </Modal>
    );

    // ========================================================
    // RENDER ADD DELIVERY MODAL
    // ========================================================
    const renderAddDeliveryModal = () => (
        <Modal
            title={
                <div className="ue-modal-header">
                    <div className="ue-modal-icon"><PlusOutlined /></div>
                    <div className="ue-modal-title">{editingDelivery ? 'Edit Delivery' : 'Add New Delivery'}</div>
                    <div className="ue-modal-badge">{formatBookingId(selectedBooking?.booking_no)}</div>
                </div>
            }
            open={addDeliveryModalVisible}
            onCancel={() => { setAddDeliveryModalVisible(false); setEditingDelivery(null); addDeliveryForm.resetFields(); }}
            width={500}
            className="ue-modal-clean"
            maskClosable={false}
            footer={null}
            destroyOnHidden={true}
        >
            <div className="ue-modal-body">
                <Form form={addDeliveryForm} layout="vertical" onFinish={handleAddDeliverySubmit}>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="delivery_type" label="Delivery Type" initialValue="buffet" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="buffet">Buffet</Option>
                                    <Option value="packlunch">Pack Lunch</Option>
                                    <Option value="food_tray">Food Tray</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="delivery_date" label="Delivery Date">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="delivery_time" label="Delivery Time" rules={[{ required: true }]}>
                                <Input placeholder="e.g., 10:00 AM" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="return_time" label="Return Time">
                                <Input placeholder="e.g., 3:00 PM" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="venue" label="Venue / Delivery Address" rules={[{ required: true }]}>
                        <Input placeholder="Venue or delivery address" />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="vehicle" label="Vehicle">
                                <Input placeholder="Vehicle number/name" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="driver" label="Driver" rules={[{ required: true }]}>
                                <Input placeholder="Driver name" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="driver_phone" label="Driver Phone">
                        <Input placeholder="Contact number" />
                    </Form.Item>
                    <Form.Item name="items" label="Items to Deliver">
                        <TextArea rows={2} placeholder="Food, equipment, buffet setup, etc." />
                    </Form.Item>
                    <Form.Item name="notes" label="Delivery Notes">
                        <TextArea rows={2} placeholder="Special delivery instructions" />
                    </Form.Item>
                    <div className="ue-modal-footer">
                        <Button onClick={() => { setAddDeliveryModalVisible(false); setEditingDelivery(null); addDeliveryForm.resetFields(); }}>Cancel</Button>
                        <Button type="primary" htmlType="submit">{editingDelivery ? 'Save Changes' : 'Add Delivery'}</Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );

    // ========================================================
    // HANDLE RECORD PAYMENT
    // ========================================================
    const handleRecordPayment = async (values) => {
        try {
            const validatedValues = await paymentForm.validateFields();
            await api.post(`/bookings/${selectedBooking.id}/record-payment`, {
                ...validatedValues,
                ...values,
            });
            message.success('Payment recorded successfully');
            setPaymentModalVisible(false);
            paymentForm.resetFields();
            queryClient.invalidateQueries({ queryKey: ['bookings', 'payment-summary', selectedBooking.id], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['bookings', 'statistics'], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['payments'], refetchType: 'active' });
            Promise.allSettled([
                refetchActiveBookings(),
                refetchHistoryBookings(),
                refetchStatistics(),
            ]);
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to record payment');
        }
    };

    // ========================================================
    // MAIN RENDER
    // ========================================================
    const containerClass = `ue-container ${isDarkMode ? 'ue-dark-mode' : ''}`;
    const tableClass = `ue-table ${isDarkMode ? 'ue-table-dark' : ''}`;

    const tabItems = [
        {
            key: 'orders',
            label: <span><CheckCircleOutlined /> Confirmed Bookings ({confirmedBookings.length})</span>,
            children: (
                <div className="ue-tab-content">
                    {renderOngoingWarning()}
                    <div className="ue-filters">
                        <div className="ue-filter-group">
                            <FilterOutlined />
                            <Select value={filterStatus} onChange={setFilterStatus} className="ue-filter-select" placeholder="Status">
                                <Option value="confirmed">Confirmed</Option>
                                <Option value="ongoing">Ongoing</Option>
                                <Option value="done">Done</Option>
                                <Option value="rescheduled">Rescheduled</Option>
                                <Option value="all">All Status</Option>
                            </Select>
                        </div>
                        <div className="ue-filter-group">
                            <AppstoreOutlined />
                            <Select value={filterEventType} onChange={setFilterEventType} className="ue-filter-select" placeholder="Event Type">
                                <Option value="all">All Types</Option>
                                {safeArray(eventTypes).map(type => (
                                    <Option key={type.event_type_id || type.id} value={type.event_type_id || type.id}>
                                        {type.name}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                        <div className="ue-filter-group">
                            <CalendarOutlined />
                            <DatePicker onChange={setSelectedDate} placeholder="Select Date" format="YYYY-MM-DD" allowClear className="ue-date-picker" />
                        </div>
                        <div className={`ue-filter-group ue-search`}>
                            <SearchOutlined />
                            <Input placeholder="Search by Booking ID, customer..." value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear className="ue-search-input" />
                        </div>
                    </div>

                    <div className="ue-table-container">
                        <Table
                            columns={columns}
                            dataSource={confirmedBookings}
                            rowKey={(record) => record.id}
                            loading={bookingsLoading}
                            className={tableClass}
                            scroll={{ x: 1400 }}
                            pagination={{
                                current: currentPage,
                                pageSize: pageSize,
                                total: confirmedBookings.length,
                                showSizeChanger: true,
                                pageSizeOptions: ['5', '10', '20', '50'],
                                showTotal: (total) => `Total ${total} confirmed bookings`,
                                itemRender: renderPaginationItem,
                                onChange: (page, size) => {
                                    setCurrentPage(page);
                                    if (size) setPageSize(size);
                                }
                            }}
                        />
                    </div>
                </div>
            )
        },
        {
            key: 'ongoing',
            label: <span><DashboardOutlined /> Ongoing ({ongoingBookings.length})</span>,
            children: (
                <div className="ue-tab-content">
                    <Alert
                        message="Ongoing Events Monitoring"
                        description="Monitor and manage ongoing events. Click 'Monitor' on any row to view detailed status."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <div className="ue-table-container">
                        <Table
                            columns={ongoingColumns}
                            dataSource={ongoingBookings}
                            rowKey={(record) => record.id}
                            className={tableClass}
                            scroll={{ x: 1300 }}
                            pagination={{
                                pageSize: 10,
                                showTotal: (total) => `Total ${total} ongoing events`,
                                itemRender: renderPaginationItem
                            }}
                        />
                    </div>
                </div>
            )
        },
        {
            key: 'history',
            label: <span><HistoryOutlined /> History ({completedBookings.length})</span>,
            children: (
                <div className="ue-tab-content">
                    <Alert
                        message="Completed & Cancelled Booking History"
                        description="Bookings marked as completed or cancelled are stored here for review."
                        type="success"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <div className="ue-filters">
                        <div className="ue-filter-group ue-search">
                            <SearchOutlined />
                            <Input placeholder="Search..." value={historySearchText} onChange={(e) => setHistorySearchText(e.target.value)} allowClear className="ue-search-input" />
                        </div>
                        <div className="ue-filter-group">
                            <FilterOutlined />
                            <Select value={historyFilterStatus} onChange={setHistoryFilterStatus} className="ue-filter-select" placeholder="Status">
                                <Option value="all">All Status</Option>
                                <Option value="completed">Completed</Option>
                                <Option value="cancelled">Cancelled</Option>
                                <Option value="rejected">Rejected</Option>
                            </Select>
                        </div>
                        <div className="ue-filter-group">
                            <CalendarOutlined />
                            <RangePicker value={historyDateRange} onChange={setHistoryDateRange} format="YYYY-MM-DD" allowClear className="ue-date-picker" />
                        </div>
                    </div>
                    <div className="ue-table-container">
                        <Table
                            columns={historyColumns}
                            dataSource={completedBookings}
                            rowKey={(record) => record.id}
                            className={tableClass}
                            scroll={{ x: 1300 }}
                            pagination={{
                                current: historyPage,
                                pageSize: historyPageSize,
                                total: completedBookings.length,
                                showSizeChanger: true,
                                pageSizeOptions: ['5', '10', '20', '50'],
                                showTotal: (total) => `Total ${total} history records`,
                                itemRender: renderPaginationItem,
                                onChange: (page, size) => {
                                    setHistoryPage(page);
                                    if (size) setHistoryPageSize(size);
                                }
                            }}
                        />
                    </div>
                </div>
            )
        }
    ];

    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    colorPrimary: '#3b82f6',
                    colorBgContainer: isDarkMode ? '#1e293b' : '#ffffff',
                    colorBorderSecondary: isDarkMode ? '#334155' : '#e2e8f0',
                    colorText: isDarkMode ? '#e2e8f0' : '#1e293b',
                    colorTextSecondary: isDarkMode ? '#94a3b8' : '#64748b',
                    borderRadius: 12,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                },
                components: {
                    Table: {
                        headerBg: isDarkMode ? '#0f172a' : '#f8fafc',
                        headerColor: isDarkMode ? '#cbd5e1' : '#1e293b',
                        headerBorderRadius: 0,
                    },
                    Card: { borderRadiusLG: 16 },
                    Modal: { borderRadiusLG: 20 },
                    Button: { borderRadius: 10 },
                    Input: { borderRadius: 10 },
                    Select: { borderRadius: 10 },
                }
            }}
        >
            <App>
                <div className={containerClass}>
                    {/* HEADER */}
                    <div className="ue-header">
                        <div className="ue-header-left">
                            <div className="ue-logo-icon"><MdEventNote /></div>
                            <div className="ue-header-info">
                                <h1>Order & Events Management</h1>
                                <span>UNIFIED OPERATIONS</span>
                            </div>
                        </div>
                        <div className="ue-header-right">
                            <div className="ue-date-display">
                                <CalendarOutlined />
                                <span>{dayjs().format('dddd, MMMM DD, YYYY')}</span>
                            </div>
                            <Divider type="vertical" style={{ height: 28 }} />
                            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Refresh</Button>
                            <Button icon={<ExportOutlined />} onClick={activeTab === 'history' ? exportHistory : exportAllOrders}>Export</Button>
                            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                        </div>
                    </div>

                    {/* STATS */}
                    {renderStats()}

                    {/* MAIN CONTENT */}
                    <Card className="ue-main-card" variant="borderless">
                        <Tabs activeKey={activeTab} onChange={setActiveTab} className="ue-tabs" destroyOnHidden={true} items={tabItems} />
                    </Card>

                    {/* ALL MODALS */}
                    {renderViewDetailsModal()}
                    {renderLiveStatusModal()}
                    {renderKitchenModal()}
                    {renderDeliveryModal()}
                    {renderStaffAssignmentModal()}
                    {renderAddStaffModal()}
                    {renderDeliveryTrackingModal()}
                    {renderAddDeliveryModal()}
                    {renderChecklistModal()}
                    {renderIngredientsModal()}
                    {renderEditModal()}
                    {renderStatusUpdateModal()}
                    {renderPaymentModal()}
                    {renderEquipmentCheckoutModal()}
                    {renderEquipmentReturnModal()}
                    {renderEquipmentDetailsModal()}
                </div>
            </App>
        </ConfigProvider>
    );
};

export default UnifiedOrderEventsManagement;
