import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import {
    Alert,
    Button,
    Calendar,
    Card,
    ConfigProvider,
    DatePicker,
    message,
    Modal,
    Tag,
    Form,
    Progress,
    Radio,
    Select,
    Space,
    Input,
    InputNumber,
    Typography,
    Tooltip,
    Empty,
    App,
    theme as antdTheme,
    Divider,
} from 'antd';

import {
    CalendarOutlined,
    ScheduleOutlined,
    EditOutlined,
    FullscreenOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    LockOutlined,
    UnlockOutlined,
    TeamOutlined,
    FireOutlined,
    SearchOutlined,
    FilterOutlined,
    ClockCircleOutlined,
    AppstoreOutlined,
    ReloadOutlined,
    EyeOutlined,        // ⭐ ADDED THIS
} from '@ant-design/icons';
import { FaRegCalendarAlt } from "react-icons/fa";

import dayjs from 'dayjs';

import api from '../../../services/api';

import {
    useCalendarAvailability,
    useCalendarEvents,
    useDeleteCalendarAvailability,
    useSaveCalendarAvailability,
    useBookingChangeSync,
} from '../../../hooks/useBookingQuotation';

import '../../../features/bookings/styles/Sales.css';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ============================================================
// SAFE VALUE HELPERS (same as BookingQuotationManagement)
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

// ============================================================
// UI CONFIGURATION (copied from BookingQuotationManagement)
// ============================================================
const availabilityOperationOptions = [
    { value: 'normal', label: 'Normal Operation' },
    { value: 'limited_slot', label: 'Limited Slot' }
];

const availabilityStatusOptions = [
    { value: 'available', label: 'Available' },
    { value: 'fully_booked', label: 'Fully Booked (No more bookings)' },
    { value: 'unavailable', label: 'Unavailable (Closed/Blocked)' }
];

const getAvailabilityConfig = (status) => {
    const config = {
        available:     { text: 'Available',    status: 'success', color: '#10b981', background: '#ecfdf5', icon: <UnlockOutlined /> },
        fully_booked:  { text: 'Fully Booked', status: 'warning', color: '#f97316', background: '#fff7ed', icon: <TeamOutlined /> },
        unavailable:   { text: 'Unavailable',  status: 'error',   color: '#ef4444', background: '#fef2f2', icon: <LockOutlined /> },
    };
    return config[status] || config.available;
};

// ============================================================
// SKELETON (Calendar-only skeleton)
// ============================================================
const CalendarSkeleton = () => (
    <div className="bqm-container bqm-skeleton-container">
        <div className="bqm-header">
            <div className="bqm-header-left">
                <div className="bqm-logo-icon bqm-logo-icon-skeleton">
                    <FaRegCalendarAlt style={{ color: 'transparent' }} />
                </div>
                <div className="bqm-header-info">
                    <div className="bqm-skeleton-text" style={{ width: 260, height: 20, marginBottom: 6 }} />
                    <div className="bqm-skeleton-text" style={{ width: 120, height: 10 }} />
                </div>
            </div>
        </div>
        <div className="bqm-main-card" style={{ padding: 24 }}>
            <div className="bqm-skeleton-block" style={{ height: 600, borderRadius: 12 }} />
        </div>
    </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const BookingCalendarPage = () => {
    const location = useLocation();
    const { message, modal } = App.useApp();

    // ---------- Dark mode (synced with Navigation) ----------
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = (localStorage.getItem('theme') || '').toLowerCase();
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });

    useEffect(() => {
        const resolveDark = () => {
            const saved = (localStorage.getItem('theme') || '').toLowerCase();
            if (saved === 'dark') return true;
            if (saved === 'light') return false;
            return document.body.classList.contains('dark-mode');
        };
        setIsDarkMode(resolveDark());
        const t1 = setTimeout(() => setIsDarkMode(resolveDark()), 0);
        const t2 = setTimeout(() => setIsDarkMode(resolveDark()), 100);
        const handleThemeChange = (e) => setIsDarkMode(Boolean(e?.detail?.isDark));
        const handleStorage = (e) => {
            if (e.key === 'theme') {
                setIsDarkMode((e.newValue || '').toLowerCase() === 'dark');
            }
        };
        window.addEventListener('themeChange', handleThemeChange);
        window.addEventListener('storage', handleStorage);
        return () => {
            clearTimeout(t1); clearTimeout(t2);
            window.removeEventListener('themeChange', handleThemeChange);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

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

    // ---------- Calendar state ----------
    const [calendarMode, setCalendarMode] = useState('month');
    const [calendarCursor, setCalendarCursor] = useState(dayjs());
    const [selectedCalendarDate, setSelectedCalendarDate] = useState(dayjs());
    const [calendarZoom, setCalendarZoom] = useState(100);
    const [calendarFullscreen, setCalendarFullscreen] = useState(false);

    // ⭐ SIDE PANEL (Monthly Event List) — search / filter / sort / day filter
    const [eventListSearch, setEventListSearch] = useState('');
    const [eventListStatusFilter, setEventListStatusFilter] = useState('all');
    const [eventListDayFilter, setEventListDayFilter] = useState(null); // dayjs | null
    const [eventListSort, setEventListSort] = useState('date_asc');

    const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
    const [availabilityForm] = Form.useForm();

       const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookingDetailsModalVisible, setBookingDetailsModalVisible] = useState(false);

    // ⭐ NEW: State for the Daily Timeline View
    const [dayDetailsModalVisible, setDayDetailsModalVisible] = useState(false);
    const [selectedDayEvents, setSelectedDayEvents] = useState({ date: null, events: [] });
    const calendarRange = useMemo(() => ({
        start: calendarCursor.startOf('month').subtract(7, 'day').format('YYYY-MM-DD'),
        end: calendarCursor.endOf('month').add(7, 'day').format('YYYY-MM-DD'),
    }), [calendarCursor]);

       // ---------- Data ----------
    const {
        data: calendarEvents,
        refetch: refetchCalendarEvents,
    } = useCalendarEvents(calendarRange);

    const {
        data: calendarAvailabilityData,
        refetch: refetchCalendarAvailability,
    } = useCalendarAvailability(calendarRange);

    const saveCalendarAvailabilityMutation = useSaveCalendarAvailability();
    const deleteCalendarAvailabilityMutation = useDeleteCalendarAvailability();

    // Cross-tab sync (same as Bookings page)
    useBookingChangeSync();

    useEffect(() => {
        const handleBookingEvent = () => {
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

    // ---------- Derived data ----------
    const events = safeArray(calendarEvents);
    const calendarAvailability = safeArray(calendarAvailabilityData?.data);

    const approvedCalendarEvents = useMemo(
        () => events.filter((event) => ['approved', 'confirmed', 'rescheduled', 'ongoing', 'completed'].includes(safeString(event.status))),
        [events]
    );

    // ─────────────────────────────────────────────────────────
    // ⭐ MONTHLY EVENT LIST — the side panel that mirrors every
    //    approved/scheduled booking for the currently visible month.
    // ─────────────────────────────────────────────────────────
    const monthEvents = useMemo(() => {
        const monthStart = calendarCursor.startOf('month').format('YYYY-MM-DD');
        const monthEnd = calendarCursor.endOf('month').format('YYYY-MM-DD');

        return approvedCalendarEvents
            .filter((event) => {
                const start = safeString(event.start).split('T')[0];
                const end = safeString(event.end || event.start).split('T')[0];
                return start <= monthEnd && end >= monthStart;
            })
            .map((event) => {
                const props = safeObject(event.extendedProps);
                return {
                    id: event.id,
                    booking_no: safeString(props.booking_no || safeString(event.title).split(' - ')[0]),
                    customer_name: safeString(
                        props.customer_name || safeString(event.title).split(' - ').slice(1).join(' - ')
                    ),
                    customer_phone: safeString(props.customer_phone),
                    event_date: safeString(props.event_date || event.start).split('T')[0],
                    event_end_date: safeString(props.event_end_date || event.end || event.start).split('T')[0],
                    event_time: safeString(props.event_time, 'Time TBD'),
                    event_type_name: safeString(props.event_type_name, 'Event'),
                    venue: safeString(props.venue, 'Venue TBD'),
                    guests_count: safeNumber(props.guests_count),
                    service_type: safeString(props.service_type),
                    days: safeNumber(props.days, 1),
                    is_multi_day: Boolean(props.is_multi_day),
                    progress: Math.min(100, safeNumber(props.progress)),
                    total_amount: safeNumber(props.total_amount),
                    paid_amount: safeNumber(props.paid_amount),
                    balance: safeNumber(props.balance),
                    booking_status: safeString(event.status || props.booking_status, 'confirmed').toLowerCase(),
                    event_completed: Boolean(props.event_completed),
                    assigned_staff_count: safeNumber(props.assigned_staff_count),
                                       booking_source: safeString(props.booking_source, 'walk_in'),
                    // ⭐ Service type for calendar colour coding
                    service_type: safeString(props.service_type || 'buffet').toLowerCase(),
                    raw: event,
                };
            });
    }, [approvedCalendarEvents, calendarCursor]);

    // ⭐ SERVICE TYPE COLOURS — BLUE (Buffet), PURPLE (Packed), YELLOW (Tray)
    const getServiceTypeCalendarColor = (serviceType) => {
        const svc = String(serviceType || 'buffet').toLowerCase();
        if (svc === 'packed') {
            return { border: '#8b5cf6', background: '#f5f3ff', text: '#6d28d9' };
        }
        if (svc === 'tray') {
            return { border: '#eab308', background: '#fef9c3', text: '#a16207' };
        }
        return { border: '#3b82f6', background: '#eff6ff', text: '#1d4ed8' };
    };
    const filteredMonthEvents = useMemo(() => {
        let rows = monthEvents;

        if (eventListDayFilter) {
            const day = eventListDayFilter.format('YYYY-MM-DD');
            rows = rows.filter((row) => row.event_date <= day && row.event_end_date >= day);
        }

        if (eventListStatusFilter !== 'all') {
            rows = rows.filter((row) => row.booking_status === eventListStatusFilter.toLowerCase());
        }

        const needle = eventListSearch.trim().toLowerCase();
        if (needle) {
            rows = rows.filter((row) => {
                const haystack = [
                    row.booking_no,
                    row.customer_name,
                    row.customer_phone,
                    row.event_type_name,
                    row.venue,
                    row.event_date,
                ].join(' ').toLowerCase();
                return haystack.includes(needle);
            });
        }

        rows = [...rows].sort((a, b) => {
            switch (eventListSort) {
                case 'date_desc':
                    return b.event_date.localeCompare(a.event_date) || b.event_time.localeCompare(a.event_time);
                case 'customer_asc':
                    return a.customer_name.localeCompare(b.customer_name);
                case 'progress_desc':
                    return b.progress - a.progress;
                case 'date_asc':
                default:
                    return a.event_date.localeCompare(b.event_date) || a.event_time.localeCompare(b.event_time);
            }
        });

        return rows;
    }, [monthEvents, eventListDayFilter, eventListStatusFilter, eventListSearch, eventListSort]);

    const monthSummary = useMemo(() => {
        const totalEvents = filteredMonthEvents.length;
        const totalGuests = filteredMonthEvents.reduce((sum, row) => sum + row.guests_count, 0);
        const totalRevenue = filteredMonthEvents.reduce((sum, row) => sum + row.total_amount, 0);
        const totalPaid = filteredMonthEvents.reduce((sum, row) => sum + row.paid_amount, 0);
        const completedCount = filteredMonthEvents.filter((row) => row.event_completed || row.booking_status === 'completed').length;
        return { totalEvents, totalGuests, totalRevenue, totalPaid, completedCount };
    }, [filteredMonthEvents]);
    const getCalendarAvailability = useCallback((dateValue) => {
        const date = dayjs(dateValue).format('YYYY-MM-DD');
        return calendarAvailability.find((item) => safeString(item.availability_date || item.date) === date);
    }, [calendarAvailability]);

    // ---------- Handlers ----------
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
            status,
            max_bookings: maxBookings,
            notes,
        });
        setAvailabilityModalVisible(true);
    };

    const saveCalendarAvailability = (values) => {
        const date = selectedCalendarDate.format('YYYY-MM-DD');
        const status = safeString(values.status, 'available');
        const operationMode = safeString(values.operation_mode, 'normal');
        const maxBookings = operationMode === 'limited_slot' && values.max_bookings
            ? safeNumber(values.max_bookings)
            : null;

        const payload = {
            status,
            operation_mode: operationMode,
            max_bookings: maxBookings,
            notes: safeString(values.notes),
        };

        saveCalendarAvailabilityMutation.mutate(
            { date, data: payload },
            {
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
                },
            }
        );
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
                    },
                });
            },
        });
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
            setSelectedBooking(booking);
            setBookingDetailsModalVisible(true);

            // ⭐ Auto-jump the calendar so the user sees the highlighted day
            //    in context. This is critical when the event was opened from
            //    a multi-day row that spans into the previous/next month.
            if (booking.event_date) {
                const eventMonth = dayjs(booking.event_date);
                if (!eventMonth.isSame(calendarCursor, 'month')) {
                    setCalendarCursor(eventMonth);
                }
                setSelectedCalendarDate(eventMonth);
            }
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to load booking details');
        }
    };
    // ---------- Cell renderer (same as Bookings page) ----------
    const dateCellRender = (dateValue) => {
        const date = dateValue.format('YYYY-MM-DD');
           // ⭐ FIX — A multi-day event must appear on EVERY day it spans,
        //    not only on its start date. Without this, a 3-day booking
        //    starting Nov 29 would disappear from Nov 30 and Dec 1.
        const dayEvents = approvedCalendarEvents.filter((event) => {
            const start = safeString(event.start).split('T')[0];
            const end   = safeString(event.end || event.start).split('T')[0];
            return start <= date && end >= date;
        });
        const availability = getCalendarAvailability(dateValue);
        const isPast = dayjs(date).isBefore(dayjs().startOf('day'));

        const hasCustomSetting = availability !== undefined && availability !== null;
        const shouldShowBadge = hasCustomSetting && availability.status !== 'available';
        const hasLimitedSlots =
            hasCustomSetting &&
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
                style={{ cursor: isPast ? 'not-allowed' : 'pointer', opacity: isPast ? 0.7 : 1 }}
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
                                : '#10b981'}`,
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
                                       {dayEvents.slice(0, 2).map((event) => {
                        // ⭐ Colour-coded by service type (Buffet/Packed/Tray).
                        const svcType = String(event.extendedProps?.service_type || 'buffet').toLowerCase();
                        const colors = getServiceTypeCalendarColor(svcType);
                        return (
                            <Tooltip key={event.id} title="Click to view booking details">
                                <button
                                    type="button"
                                    className="bqm-calendar-event-item"
                                    style={{
                                        borderLeft: `3px solid ${colors.border}`,
                                        background: colors.background,
                                        color: colors.text,
                                    }}
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
                        );
                    })}
                    {dayEvents.length > 2 && (
                        <div className="bqm-calendar-event-more">+{dayEvents.length - 2} more</div>
                    )}
                </div>
                {/* ⭐ HOVER ACTION BUTTONS */}
                <div 
                    className="bqm-date-hover-actions" 
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        display: 'flex',
                        gap: 4,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        pointerEvents: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent cell click
                >
                    {dayEvents.length > 0 && (
                        <Tooltip title="View Day Timeline">
                            <Button 
                                size="small" 
                                type="primary" 
                                icon={<EyeOutlined />} 
                                onClick={(e) => openDayTimeline(e, dateValue)}
                                style={{ padding: '0 6px', height: 22, fontSize: 11 }}
                            />
                        </Tooltip>
                    )}
                    {!isPast && (
                        <Tooltip title="Edit Availability">
                            <Button 
                                size="small" 
                                icon={<EditOutlined />} 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCalendarDayClick(dateValue);
                                }}
                                style={{ padding: '0 6px', height: 22, fontSize: 11 }}
                            />
                        </Tooltip>
                    )}
                </div>
            </div>
        );
    };

    // ⭐ NEW: Helper to open the timeline view
    const openDayTimeline = (e, dateValue) => {
        e.stopPropagation();
        const dateStr = dayjs(dateValue).format('YYYY-MM-DD');
        const dayEvents = approvedCalendarEvents
            .filter((event) => {
                const start = safeString(event.start).split('T')[0];
                const end = safeString(event.end || event.start).split('T')[0];
                return start <= dateStr && end >= dateStr;
            })
            .map((event) => {
                const props = safeObject(event.extendedProps);
                return {
                    ...props,
                    id: event.id,
                    title: event.title,
                    event_time: safeString(props.event_time, 'Time TBD'),
                    raw: event
                };
            })
            // Sort by time
            .sort((a, b) => {
                const timeA = dayjs(`2000-01-01 ${a.event_time}`).isValid() ? dayjs(`2000-01-01 ${a.event_time}`).valueOf() : 0;
                const timeB = dayjs(`2000-01-01 ${b.event_time}`).isValid() ? dayjs(`2000-01-01 ${b.event_time}`).valueOf() : 0;
                return timeA - timeB;
            });

        setSelectedDayEvents({ date: dateValue, events: dayEvents });
        setDayDetailsModalVisible(true);
    };

    const containerClass = `bqm-container ${isDarkMode ? 'bqm-dark-mode' : ''}`;    const headerClass = `bqm-header ${isDarkMode ? 'bqm-header-dark' : ''}`;
    const mainCardClass = `bqm-main-card ${isDarkMode ? 'bqm-main-card-dark' : ''}`;

    // Show a soft skeleton until data resolves
    const hasAnyData = Boolean(calendarEvents) || Boolean(calendarAvailabilityData);
    const [skeletonTimedOut, setSkeletonTimedOut] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setSkeletonTimedOut(true), 1500);
        return () => clearTimeout(t);
    }, []);

    if (!hasAnyData && !skeletonTimedOut) {
        return <CalendarSkeleton />;
    }

    return (
        <App>
            <ConfigProvider
                theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}
            >
                <div className={containerClass}>
                    {/* ================= HEADER ================= */}
                    <div className={headerClass}>
                        <div className="bqm-header-left">
                            <div className="bqm-logo-icon"><FaRegCalendarAlt /></div>
                            <div className="bqm-header-info">
                                <h1>Event Calendar & Availability</h1>
                                <span>ENTERPRISE SYSTEM</span>
                            </div>
                        </div>
                        <div className="bqm-header-right">
                            <div className="bqm-date-display">
                                <CalendarOutlined />
                                <span>{dayjs().format('dddd, MMMM DD, YYYY')}</span>
                            </div>
                            <Divider type="vertical" />
                            <Button
                                icon={<CalendarOutlined />}
                                onClick={() => {
                                    refetchCalendarEvents();
                                    refetchCalendarAvailability();
                                    message.success('Calendar refreshed');
                                }}
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>
                    {/* ================= MAIN CARD ================= */}
                    <Card 
                        className={mainCardClass} 
                        variant="borderless"
                        style={{ marginTop: '24px', marginBottom: '24px' }} // ⭐ Equal top and bottom margins
                    >
                        {/* ⭐ Added explicit top and bottom padding to match spacing */}
                                             <div 
                            className="bqm-tab-content bqm-calendar-tab-content" 
                            style={{ 
                                paddingTop: '32px', 
                                paddingBottom: '32px', // ⭐ Changed to match top padding
                                paddingLeft: '24px',
                                paddingRight: '24px'
                            }}
                        >
                            <div className="bqm-calendar-toolbar bqm-calendar-toolbar-compact" style={{ marginBottom: 24 }}>
                                <div>
                                    <Text strong>Event Calendar & Date Availability</Text>
                                    <div>
                                        <Text type="secondary">
                                            <EditOutlined /> Click any date to edit availability (Available, Limited Slots, Fully Booked, or Unavailable)
                                        </Text>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="bqm-calendar-zoom-controls">
                                        <Button
                                            size="small"
                                            icon={<ZoomOutOutlined />}
                                            onClick={() => setCalendarZoom(Math.max(50, calendarZoom - 10))}
                                            title="Zoom Out"
                                        />
                                        <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center', color: 'var(--bqm-text)' }}>
                                            {calendarZoom}%
                                        </span>
                                        <Button
                                            size="small"
                                            icon={<ZoomInOutlined />}
                                            onClick={() => setCalendarZoom(Math.min(150, calendarZoom + 10))}
                                            title="Zoom In"
                                        />
                                        <Button size="small" onClick={() => setCalendarZoom(100)} title="Reset Zoom">
                                            Reset
                                        </Button>
                                        <Button
                                            size="small"
                                            type="primary"
                                            ghost
                                            icon={<FullscreenOutlined />}
                                            onClick={() => setCalendarFullscreen(true)}
                                            title="Focus Calendar (Fullscreen)"
                                        >
                                            Focus
                                        </Button>
                                    </div>
                                </div>
                            </div>

                                             {/* Legend */}
                                                       <div className="bqm-calendar-legend">
                                <div className="bqm-legend-item"><span className="bqm-legend-color available"></span><span>Available</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color limited"></span><span>Limited Slots</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color fully-booked"></span><span>Fully Booked</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color unavailable"></span><span>Unavailable</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color event"></span><span>Has Events</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color clickable"></span><span>Click to Edit</span></div>
                                {/* ⭐ Service Type colours */}
                                <div className="bqm-legend-item"><span className="bqm-legend-color" style={{ background: '#3b82f6' }}></span><span>Buffet</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color" style={{ background: '#8b5cf6' }}></span><span>Packed</span></div>
                                <div className="bqm-legend-item"><span className="bqm-legend-color" style={{ background: '#eab308' }}></span><span>Tray</span></div>
                            </div>

                            {/* ⭐ Calendar + Monthly Event List side panel */}
                            <div
                                className="bqm-calendar-with-sidebar"
                                style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}
                            >
                                {/* ── LEFT: Calendar ── */}
                                <div style={{ flex: '1 1 620px', minWidth: 0 }}>
                                    <div className="bqm-calendar-wrapper bqm-calendar-wrapper-compact bqm-scroll-hidden">                                        <div
                                            className="bqm-calendar-zoom-inner"
                                            style={{
                                                transform: `scale(${calendarZoom / 100})`,
                                                transformOrigin: 'top center',
                                                transition: 'transform 0.2s ease',
                                                width: '100%',
                                            }}
                                        >
                                            <Calendar
                                                value={calendarCursor}
                                                mode={calendarMode}
                                                cellRender={dateCellRender}
                                                onPanelChange={(dateValue, mode) => {
                                                    setCalendarCursor(dateValue);
                                                    setCalendarMode(mode);
                                                    setEventListDayFilter(null);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── RIGHT: Monthly Event List ── */}
                                <div
                                    className="bqm-calendar-side-panel"
                                                                  style={{
                                        flex: '0 0 340px',
                                        width: 340,
                                        maxWidth: '100%',
                                        background: isDarkMode ? '#111827' : '#ffffff',
                                        borderRadius: 12,
                                        border: `1px solid ${isDarkMode ? '#1f2937' : '#e5e7eb'}`,
                                        padding: 14,
                                                                           position: 'sticky',
                                        top: 12,
                                        // ⭐ ADJUSTED: Account for the new 32px bottom padding (120px + 32px = 152px)
                                        maxHeight: 'calc(100vh - 152px)',
                                        height: 'calc(100vh - 152px)',
                                        overflow: 'hidden', 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: isDarkMode ? '#f9fafb' : '#111827' }}>
                                                Events — {calendarCursor.format('MMMM YYYY')}
                                            </div>
                                            <div style={{ fontSize: 11, color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                                                Approved &amp; scheduled bookings
                                            </div>
                                        </div>
                                        <Tooltip title="Refresh calendar &amp; list">
                                            <Button
                                                size="small"
                                                icon={<ReloadOutlined />}
                                                onClick={() => {
                                                    refetchCalendarEvents();
                                                    refetchCalendarAvailability();
                                                }}
                                            />
                                        </Tooltip>
                                    </div>

                                    {/* Summary stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                                        <div style={{ padding: '8px 10px', borderRadius: 8, background: isDarkMode ? '#0f172a' : '#eff6ff', border: `1px solid ${isDarkMode ? '#1e293b' : '#bfdbfe'}` }}>
                                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontWeight: 600 }}>Events</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: isDarkMode ? '#f9fafb' : '#111827' }}>{monthSummary.totalEvents}</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', borderRadius: 8, background: isDarkMode ? '#0f172a' : '#ecfdf5', border: `1px solid ${isDarkMode ? '#1e293b' : '#bbf7d0'}` }}>
                                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: isDarkMode ? '#86efac' : '#047857', fontWeight: 600 }}>Guests</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: isDarkMode ? '#f9fafb' : '#111827' }}>{monthSummary.totalGuests.toLocaleString()}</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', borderRadius: 8, background: isDarkMode ? '#0f172a' : '#fef3c7', border: `1px solid ${isDarkMode ? '#1e293b' : '#fde68a'}` }}>
                                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: isDarkMode ? '#fcd34d' : '#b45309', fontWeight: 600 }}>Revenue</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#f9fafb' : '#111827' }}>
                                                ₱{monthSummary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </div>
                                        </div>
                                        <div style={{ padding: '8px 10px', borderRadius: 8, background: isDarkMode ? '#0f172a' : '#f3e8ff', border: `1px solid ${isDarkMode ? '#1e293b' : '#e9d5ff'}` }}>
                                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: isDarkMode ? '#d8b4fe' : '#7c3aed', fontWeight: 600 }}>Completed</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: isDarkMode ? '#f9fafb' : '#111827' }}>{monthSummary.completedCount}</div>
                                        </div>
                                    </div>

                                    {/* Filters */}
                                    <Space direction="vertical" size={6} style={{ width: '100%', marginBottom: 10 }}>
                                        <Input
                                            size="small"
                                            placeholder="Search customer, booking #, venue..."
                                            prefix={<SearchOutlined />}
                                            value={eventListSearch}
                                            onChange={(e) => setEventListSearch(e.target.value)}
                                            allowClear
                                        />
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <Select
                                                size="small"
                                                value={eventListStatusFilter}
                                                onChange={setEventListStatusFilter}
                                                style={{ flex: 1 }}
                                                suffixIcon={<FilterOutlined />}
                                            >
                                                <Select.Option value="all">All statuses</Select.Option>
                                                <Select.Option value="confirmed">Confirmed</Select.Option>
                                                <Select.Option value="ongoing">Ongoing</Select.Option>
                                                <Select.Option value="completed">Completed</Select.Option>
                                            </Select>
                                            <Select
                                                size="small"
                                                value={eventListSort}
                                                onChange={setEventListSort}
                                                style={{ width: 128 }}
                                            >
                                                <Select.Option value="date_asc">Date ↑</Select.Option>
                                                <Select.Option value="date_desc">Date ↓</Select.Option>
                                                <Select.Option value="customer_asc">Customer A→Z</Select.Option>
                                                <Select.Option value="progress_desc">Progress</Select.Option>
                                            </Select>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <DatePicker
                                                size="small"
                                                style={{ flex: 1 }}
                                                placeholder="Filter by date"
                                                value={eventListDayFilter}
                                                onChange={(d) => setEventListDayFilter(d || null)}
                                                allowClear
                                            />
                                            {eventListDayFilter && (
                                                <Button size="small" onClick={() => setEventListDayFilter(null)}>
                                                    Clear
                                                </Button>
                                            )}
                                        </div>
                                    </Space>
                                                                        {/* Event list */}
                                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginRight: -4, paddingRight: 4, paddingBottom: 24 }}>
                                        {filteredMonthEvents.length === 0 ? (
                                            <Empty
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                description={
                                                    <span style={{ fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                                                        No approved events for {calendarCursor.format('MMMM YYYY')}
                                                    </span>
                                                }
                                                style={{ marginTop: 40 }}
                                            />
                                        ) : (
                                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                {filteredMonthEvents.map((row) => {
                                                    const statusColor = {
                                                        confirmed: 'blue',
                                                        approved: 'blue',
                                                        ongoing: 'gold',
                                                        completed: 'green',
                                                        rescheduled: 'purple',
                                                    }[row.booking_status] || 'default';

                                                    return (
                                                        <div
                                                            key={row.id}
                                                            onClick={() => openCalendarBookingDetails(row.raw)}
                                                            style={{
                                                                padding: 10,
                                                                borderRadius: 8,
                                                                background: isDarkMode ? '#0f172a' : '#f8fafc',
                                                                border: `1px solid ${isDarkMode ? '#1f2937' : '#e5e7eb'}`,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.borderColor = '#3b82f6';
                                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.borderColor = isDarkMode ? '#1f2937' : '#e5e7eb';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                                                                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                <span style={{ fontWeight: 600, fontSize: 12, color: isDarkMode ? '#93c5fd' : '#1d4ed8' }}>
                                                                    {row.booking_no}
                                                                </span>
                                                                <Space size={4}>
                                                                    {/* ⭐ Service type chip */}
                                                                    <Tag
                                                                        color={row.service_type === 'packed' ? 'purple' : row.service_type === 'tray' ? 'gold' : 'blue'}
                                                                        style={{ margin: 0, fontSize: 10, fontWeight: 600 }}
                                                                    >
                                                                        {row.service_type === 'packed' ? 'Packed' : row.service_type === 'tray' ? 'Tray' : 'Buffet'}
                                                                    </Tag>
                                                                    <Tag color={statusColor} style={{ margin: 0, fontSize: 10 }}>
                                                                        {row.booking_status.toUpperCase()}
                                                                    </Tag>
                                                                </Space>
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#f9fafb' : '#111827', marginBottom: 4 }}>
                                                                {row.customer_name || 'Unknown'}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: 4, flexWrap: 'wrap' }}>
                                                                <ClockCircleOutlined />
                                                                <span>{dayjs(row.event_date).format('MMM DD, YYYY')}</span>
                                                                <span>•</span>
                                                                <span>{row.event_time}</span>
                                                                {row.days > 1 && (
                                                                    <Tag color="purple" style={{ margin: 0, fontSize: 9 }}>
                                                                        {row.days} days
                                                                    </Tag>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: 4, flexWrap: 'wrap' }}>
                                                                <AppstoreOutlined />
                                                                <span>{row.event_type_name}</span>
                                                                <span>•</span>
                                                                <TeamOutlined />
                                                                <span>{row.guests_count} pax</span>
                                                            </div>
                                                            <div style={{ marginTop: 6 }}>
                                                                <Progress
                                                                    percent={row.progress}
                                                                    size="small"
                                                                    strokeColor={row.progress >= 100 ? '#10b981' : row.progress > 0 ? '#f59e0b' : '#9ca3af'}
                                                                    showInfo={false}
                                                                    style={{ margin: 0 }}
                                                                />
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: isDarkMode ? '#6b7280' : '#9ca3af', marginTop: 2 }}>
                                                                    <span>Progress</span>
                                                                    <span>{row.progress}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </Space>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* ================= FULLSCREEN CALENDAR ================= */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="bqm-modal-title-icon" style={{ background: '#3b82f6', color: '#fff' }}>
                                    <ScheduleOutlined />
                                </div>
                                <div className="bqm-modal-title-text">Event Calendar</div>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="bqm-calendar-zoom-controls">
                                        <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setCalendarZoom(Math.max(50, calendarZoom - 10))} />
                                        <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>{calendarZoom}%</span>
                                        <Button size="small" icon={<ZoomInOutlined />} onClick={() => setCalendarZoom(Math.min(200, calendarZoom + 10))} />
                                        <Button size="small" onClick={() => setCalendarZoom(100)}>Reset</Button>
                                    </div>
                                    <Button icon={<FullscreenOutlined />} onClick={() => { setCalendarFullscreen(false); setCalendarZoom(100); }}>
                                        Exit Fullscreen
                                    </Button>
                                </div>
                            </div>
                        }
                        open={calendarFullscreen}
                        onCancel={() => { setCalendarFullscreen(false); setCalendarZoom(100); }}
                        width="95%"
                        style={{ maxWidth: 1400, top: 20 }}
                        className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        centered={false}
                        maskClosable={false}
                        destroyOnHidden={true}
                        footer={null}
                        styles={{
                            body: {
                                padding: '20px',
                                background: isDarkMode ? '#0a0e1a' : '#f0f2f5',
                                maxHeight: 'calc(100vh - 120px)',
                                overflow: 'auto',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'flex-start',
                            },
                        }}
                    >
                        <div
                            className="bqm-calendar-zoom-inner"
                            style={{
                                transform: `scale(${calendarZoom / 100})`,
                                transformOrigin: 'top center',
                                transition: 'transform 0.2s ease',
                                width: '100%',
                                background: '#ffffff',
                                borderRadius: '8px',
                                padding: '10px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                            }}
                        >
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
                    </Modal>

                    {/* ================= DAY TIMELINE MODAL ================= */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon" style={{ background: '#8b5cf6', color: '#fff' }}>
                                    <ScheduleOutlined />
                                </div>
                                <div className="bqm-modal-title-text">Day Timeline</div>
                                <div className="bqm-modal-badge">{selectedDayEvents.date?.format('MMM DD, YYYY')}</div>
                            </div>
                        }
                        open={dayDetailsModalVisible}
                        onCancel={() => setDayDetailsModalVisible(false)}
                        footer={null}
                        width={500}
                        className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        <div className="bqm-modal-clean-content" style={{ paddingTop: 10 }}>
                            {selectedDayEvents.events.length === 0 ? (
                                <Empty description="No events scheduled for this day" />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {selectedDayEvents.events.map((evt, index) => (
                                        <div 
                                            key={evt.id} 
                                            onClick={() => {
                                                setDayDetailsModalVisible(false);
                                                openCalendarBookingDetails(evt.raw);
                                            }}
                                            style={{ 
                                                display: 'flex', 
                                                gap: 16, 
                                                cursor: 'pointer',
                                                padding: '12px',
                                                borderRadius: 8,
                                                background: isDarkMode ? '#1f2937' : '#f9fafb',
                                                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`
                                            }}
                                        >
                                            {/* Timeline Column */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ 
                                                    width: 10, height: 10, borderRadius: '50%', 
                                                    background: '#3b82f6', 
                                                    boxShadow: '0 0 0 3px rgba(59,130,246,0.2)' 
                                                }} />
                                                {index !== selectedDayEvents.events.length - 1 && (
                                                    <div style={{ 
                                                        width: 2, flexGrow: 1, background: '#e5e7eb', 
                                                        marginTop: 4, marginBottom: 4 
                                                    }} />
                                                )}
                                            </div>

                                            {/* Content Column */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontWeight: 700, color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontSize: 13 }}>
                                                        {evt.booking_no}
                                                    </span>
                                                    <Tag color="blue" style={{ margin: 0 }}>
                                                        {evt.event_time}
                                                    </Tag>
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: isDarkMode ? '#f3f4f6' : '#111827', marginBottom: 4 }}>
                                                    {evt.customer_name}
                                                </div>
                                                <div style={{ fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <TeamOutlined /> {evt.guests_count} pax 
                                                    <span>•</span> 
                                                    {evt.event_type_name}
                                                </div>
                                                <div style={{ fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: 4 }}>
                                                    {evt.venue}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Modal>

                    {/* ================= AVAILABILITY MODAL ================= */}                    <Modal
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
                            <Form
                                form={availabilityForm}
                                layout="vertical"
                                onFinish={saveCalendarAvailability}
                                initialValues={{ operation_mode: 'normal', status: 'available' }}
                            >
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

                                <Form.Item
                                    shouldUpdate={(prev, current) =>
                                        prev.operation_mode !== current.operation_mode || prev.status !== current.status
                                    }
                                    noStyle
                                >
                                    {({ getFieldValue }) =>
                                        getFieldValue('operation_mode') === 'limited_slot' &&
                                        getFieldValue('status') === 'available' ? (
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
                                    }
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

                    {/* ================= BOOKING DETAILS MODAL (read-only) ================= */}
                    <Modal
                        title={
                            <div className="bqm-modal-header-clean">
                                <div className="bqm-modal-title-icon"><CalendarOutlined /></div>
                                <div className="bqm-modal-title-text">Booking Details</div>
                                <div className="bqm-modal-badge">{safeString(selectedBooking?.booking_no)}</div>
                            </div>
                        }
                        open={bookingDetailsModalVisible}
                        onCancel={() => { setBookingDetailsModalVisible(false); setSelectedBooking(null); }}
                        maskClosable={false}
                        keyboard={false}
                        footer={[
                            <Button key="close" onClick={() => { setBookingDetailsModalVisible(false); setSelectedBooking(null); }}>
                                Close
                            </Button>,
                        ]}
                        width={600}
                        className="bqm-modal-clean"
                        rootClassName={isDarkMode ? 'bqm-modal-dark-root' : ''}
                        destroyOnHidden={true}
                    >
                        {selectedBooking ? (
                            <div className="bqm-modal-clean-content">
                                <div className="bqm-details-grid-rows">
                                    <div className="bqm-detail-row">
                                        <span className="bqm-detail-label">Customer</span>
                                        <span className="bqm-detail-val">{safeString(selectedBooking.customer_name, 'N/A')}</span>
                                    </div>
                                    <div className="bqm-detail-row">
                                        <span className="bqm-detail-label">Event Date</span>
                                        <span className="bqm-detail-val">{safeString(selectedBooking.event_date, 'N/A')}</span>
                                    </div>
                                    <div className="bqm-detail-row">
                                        <span className="bqm-detail-label">Time</span>
                                        <span className="bqm-detail-val">{safeString(selectedBooking.event_time, 'N/A')}</span>
                                    </div>
                                    <div className="bqm-detail-row">
                                        <span className="bqm-detail-label">Venue</span>
                                        <span className="bqm-detail-val">
                                            {safeString(
                                                selectedBooking.venue ||
                                                selectedBooking.location ||
                                                selectedBooking.delivery_address,
                                                'N/A'
                                            )}
                                        </span>
                                    </div>
                                    <div className="bqm-detail-row">
                                        <span className="bqm-detail-label">Guests</span>
                                        <span className="bqm-detail-val"><TeamOutlined /> {safeNumber(selectedBooking.guests_count)} PAX</span>
                                    </div>
                                    <div className="bqm-detail-row">
                                        <span className="bqm-detail-label">Status</span>
                                        <span className="bqm-detail-val">
                                            <Tag color="blue">{safeString(selectedBooking.booking_status, 'N/A').toUpperCase()}</Tag>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Empty description="No booking loaded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </Modal>
                </div>
            </ConfigProvider>
        </App>
    );
};

export default BookingCalendarPage;