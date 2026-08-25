// src/components/EventManagement.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Input,
    InputNumber,
    Select,
    Modal,
    Tabs,
    Tag,
    message,
    Divider,
    Tooltip,
    Typography,
    Timeline,
    Progress,
    Row,
    Col,
    Descriptions,
    Alert,
    DatePicker,
    TimePicker,
    Popconfirm,
    Badge,
    Empty,
    Form,
    Dropdown,
    List,
    Steps,
    Radio,
    ConfigProvider,
    theme as antdTheme,
    Switch,
    Collapse,
    Statistic,
    notification,
    Pagination,
    Checkbox
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
    VideoCameraOutlined,
    FileTextOutlined,
    BarChartOutlined,
    WarningOutlined,
    ToolOutlined,
    SwapOutlined,
    UnorderedListOutlined,
    SyncOutlined,
    StopOutlined,
    AimOutlined,
    TagOutlined,
    CarOutlined,
    HomeOutlined,
    FieldTimeOutlined,
    LeftOutlined,
    RightOutlined,
    RiseOutlined,
    DollarOutlined
} from '@ant-design/icons';

import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import '../styles/EventsManagement.css';
import { eventAPI, employeeAPI, equipmentAPI } from '../../../services/api';
import {
    useEvents,
    useEventTypes,
    useEvent,
    useEventStaff,
    useEventChecklist,
    useEventDeliveries,
    useEventEquipment,
    useEventProgress,
    useEventLiveStatus,
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
    useUpdateDailyProgress,
    useAdvanceToNextDay,
    useUpdateAttendance,
    useCompleteEvent,
    useUpdateLiveStatus,
} from '../../../hooks/useEvents';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

// ==================== CONSTANTS ====================
const MEAL_STATUS_OPTIONS = ['pending', 'preparing', 'ready_for_delivery', 'dispatched', 'delivered', 'serving', 'served', 'completed', 'cancelled'];

const EventManagement = () => {
    // ==================== STATE MANAGEMENT ====================
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCustomer, setFilterCustomer] = useState('all');
    const [filterEventType, setFilterEventType] = useState('all');
    const [selectedDate, setSelectedDate] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    const [activeMainTab, setActiveMainTab] = useState('events');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });
    
    // Ongoing Events Monitoring states
    const [selectedOngoingEvent, setSelectedOngoingEvent] = useState(null);
    
    // Modal states
    const [eventDetailsModalVisible, setEventDetailsModalVisible] = useState(false);
    const [editEventModalVisible, setEditEventModalVisible] = useState(false);
    
    // Staff Assignment states
    const [staffAssignmentModalVisible, setStaffAssignmentModalVisible] = useState(false);
    const [selectedEventForStaff, setSelectedEventForStaff] = useState(null);
    const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
    const [staffForm] = Form.useForm();
    const [selectedEquipmentList, setSelectedEquipmentList] = useState([]);
    const [selectedEquipmentRowKeys, setSelectedEquipmentRowKeys] = useState([]);

    // Staff List state
    const [staffList, setStaffList] = useState([]);

    // Event Checklist states
    const [checklistModalVisible, setChecklistModalVisible] = useState(false);
    const [selectedEventForChecklist, setSelectedEventForChecklist] = useState(null);
    const [checklist, setChecklist] = useState([]);
    
    // Delivery Tracking states
    const [deliveryTrackingModalVisible, setDeliveryTrackingModalVisible] = useState(false);
    const [selectedEventForDelivery, setSelectedEventForDelivery] = useState(null);
    const [deliveryTrackings, setDeliveryTrackings] = useState([]);
    const [addDeliveryModalVisible, setAddDeliveryModalVisible] = useState(false);
    const [addDeliveryForm] = Form.useForm();
    
    // Live Event Status states
    const [liveStatusModalVisible, setLiveStatusModalVisible] = useState(false);
    
    // Equipment Check-In/Check-Out Tracking per Booking states
    const [equipmentTrackingModalVisible, setEquipmentTrackingModalVisible] = useState(false);
    const [selectedEventForEquipment, setSelectedEventForEquipment] = useState(null);
    const [equipmentCheckoutModalVisible, setEquipmentCheckoutModalVisible] = useState(false);
    const [equipmentReturnModalVisible, setEquipmentReturnModalVisible] = useState(false);
    const [selectedEquipmentItem, setSelectedEquipmentItem] = useState(null);
    const [equipmentForm] = Form.useForm();
    const [availableEquipmentList, setAvailableEquipmentList] = useState([]);
    const [equipmentTrackingData, setEquipmentTrackingData] = useState([]);
    
    // Event Form
    const [eventForm] = Form.useForm();

    const isMounted = useRef(true);
    const refreshInterval = useRef(null);

    // ==================== REACT QUERY HOOKS ====================
    const { data: eventsData = [], refetch: refetchEvents, isLoading: eventsLoading } = useEvents({ per_page: 100 });
    const { data: eventTypes = [], refetch: refetchEventTypes } = useEventTypes();

    // ==================== THEME DETECTION ====================
    useEffect(() => {
        isMounted.current = true;
        
        const updateTheme = () => {
            if (isMounted.current) {
                const isDark = document.body.classList.contains('dark-mode');
                setIsDarkMode(isDark);
            }
        };
        
        const observer = new MutationObserver(() => {
            updateTheme();
        });
        
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        
        const handleThemeChange = (e) => {
            if (isMounted.current) {
                setIsDarkMode(e.detail.isDark);
            }
        };
        
        const handleStorageChange = (e) => {
            if (e.key === 'theme' && isMounted.current) {
                const isDark = e.newValue === 'dark';
                setIsDarkMode(isDark);
            }
        };
        
        window.addEventListener('themeChange', handleThemeChange);
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            isMounted.current = false;
            observer.disconnect();
            window.removeEventListener('themeChange', handleThemeChange);
            window.removeEventListener('storage', handleStorageChange);
            if (refreshInterval.current) {
                clearInterval(refreshInterval.current);
            }
        };
    }, []);

    // ==================== LOAD STAFF DATA ====================
    useEffect(() => {
        const loadStaff = async () => {
            try {
                const response = await employeeAPI.getActive();
                const staffData = response?.data?.data || response?.data || [];
                if (isMounted.current) {
                    setStaffList(Array.isArray(staffData) ? staffData : []);
                }
            } catch (error) {
                console.error('Failed to load staff:', error);
                if (isMounted.current) {
                    setStaffList([]);
                }
            }
        };
        loadStaff();
    }, []);

    // ==================== LOAD EQUIPMENT TRACKING DATA ====================
    useEffect(() => {
        const loadEquipmentTracking = async () => {
            try {
                const response = await eventAPI.getEvents({ per_page: 100 });
                const eventsData = response.data?.data?.data || response.data?.data || [];
                
                const trackingData = [];
                eventsData.forEach(event => {
                    const equipmentList = event.equipment_in_out || event.equipment || [];
                    if (equipmentList.length > 0) {
                        equipmentList.forEach(eq => {
                            trackingData.push({
                                ...eq,
                                id: eq.id || eq.booking_equipment_id || `eq-${event.booking_id || event.id}-${eq.equipment_id}`,
                                equipment_name: eq.equipment?.name || eq.equipment_name || eq.name || 'Unknown',
                                booking_no: event.booking_no || `BK-${event.id}`,
                                booking_id: event.booking_id || event.id,
                                customer_name: event.customer_name || 'Unknown',
                                event_name: event.event_name || 'Event',
                                event_date: event.date || event.event_date,
                                status: eq.status || 'reserved',
                                checked_out_date: eq.checked_out_date || eq.checkout_date,
                                rental_end_date: eq.rental_end_date || eq.expected_return_date,
                                quantity_reserved: eq.quantity_reserved || eq.quantity || 1,
                                quantity_used: eq.quantity_used || 0,
                                quantity_damaged: eq.quantity_damaged || 0,
                                quantity_missing: eq.quantity_missing || 0,
                                is_out_approved: eq.is_out_approved || false,
                                condition_notes_out: eq.condition_notes_out || '',
                                condition_notes_in: eq.condition_notes_in || '',
                                checked_out_by: eq.checked_out_by || '',
                                returned_by: eq.returned_by || '',
                                return_notes: eq.return_notes || ''
                            });
                        });
                    }
                });
                
                if (isMounted.current) {
                    setEquipmentTrackingData(trackingData);
                }
            } catch (error) {
                console.error('Failed to load equipment tracking:', error);
                if (isMounted.current) {
                    setEquipmentTrackingData([]);
                }
            }
        };
        
        loadEquipmentTracking();
    }, [activeMainTab, refetchEvents]);

    // ==================== DATA PROCESSING ====================
    const processedEvents = useMemo(() => {
        if (!eventsData || !Array.isArray(eventsData)) return [];
        
        return eventsData.map(record => ({
            ...record,
            booking_id: record.booking_id || record.id,
            booking_no: record.booking_no || `BK-${record.id}`,
            display_name: record.display_name || `${record.customer_name || 'Unknown'} - ${record.event_name || 'Event'}`,
            customer_name: record.customer_name || 'Unknown',
            total_days: record.total_days || 1,
            current_day: record.current_day || 1,
            customer_email: record.customer_email || '',
            customer_phone: record.customer_phone || '',
            issues: record.issues || [],
            live_notes: record.live_notes || '',
            meal_services: record.meal_services || record.meal_schedule || [],
            assigned_staff: record.assigned_staff || [],
            equipment_in_out: record.equipment_in_out || [],
            delivery_tracking: record.delivery_tracking || [],
            total_amount: record.total_amount || 0,
            paid_amount: record.paid_amount || 0,
            balance: record.balance || 0,
            payment_status: record.payment_status || 'pending',
            progress: record.progress || 0,
            daily_progress: record.daily_progress || [],
            guests_count: record.guests_count || 0,
            event_name: record.event_name || 'Event',
            location: record.location || record.venue || 'TBD',
            date: record.date || record.event_date,
            end_date: record.end_date || record.event_end_date || record.date,
            time: record.time || record.event_time,
            event_type: record.event_type || record.eventType?.name || 'General',
            status: record.status || record.booking_status || 'upcoming'
        }));
    }, [eventsData]);

    // Filter active events
    const activeEvents = useMemo(() => {
        return processedEvents.filter(e => !['completed', 'cancelled', 'rejected'].includes(String(e.status || '').toLowerCase()));
    }, [processedEvents]);

    // Get unique customers for filter
    const uniqueCustomers = useMemo(() => {
        return [...new Set(activeEvents.map(e => e.customer_name).filter(Boolean))];
    }, [activeEvents]);

    // Get ongoing events
    const ongoingEvents = useMemo(() => {
        return activeEvents.filter(e => String(e.status || '').toLowerCase() === 'ongoing');
    }, [activeEvents]);

    // ==================== MUTATIONS ====================
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
    const updateDailyProgressMutation = useUpdateDailyProgress();
    const advanceToNextDayMutation = useAdvanceToNextDay();
    const updateAttendanceMutation = useUpdateAttendance();
    const completeEventMutation = useCompleteEvent();
    const updateLiveStatusMutation = useUpdateLiveStatus();

    // ==================== AUTO-REFRESH ====================
    useEffect(() => {
        if (refreshInterval.current) {
            clearInterval(refreshInterval.current);
        }
        
        refreshInterval.current = setInterval(() => {
            if (isMounted.current && activeMainTab === 'ongoing') {
                refetchEvents();
            }
        }, 30000);
        
        return () => {
            if (refreshInterval.current) {
                clearInterval(refreshInterval.current);
            }
        };
    }, [activeMainTab, refetchEvents]);

    // ==================== HELPER FUNCTIONS ====================
    const getStatusConfig = useCallback((status) => {
        const config = {
            upcoming: { color: '#3b82f6', text: 'Upcoming', icon: <ClockCircleOutlined />, bg: 'rgba(59, 130, 246, 0.1)' },
            ongoing: { color: '#f59e0b', text: 'Ongoing', icon: <PlayCircleOutlined />, bg: 'rgba(245, 158, 11, 0.1)' },
            completed: { color: '#10b981', text: 'Completed', icon: <CheckCircleOutlined />, bg: 'rgba(16, 185, 129, 0.1)' },
            cancelled: { color: '#ef4444', text: 'Cancelled', icon: <StopOutlined />, bg: 'rgba(239, 68, 68, 0.1)' }
        };
        return config[status] || config.upcoming;
    }, []);

    const getDeliveryStatusConfig = useCallback((status) => {
        const config = {
            pending: { color: 'default', text: 'Pending' },
            departed: { color: 'processing', text: 'Departed' },
            en_route: { color: 'warning', text: 'En Route' },
            arrived: { color: 'success', text: 'Arrived' },
            completed: { color: 'success', text: 'Completed' },
            cancelled: { color: 'error', text: 'Cancelled' }
        };
        return config[status] || config.pending;
    }, []);

    const getEquipmentStatusConfig = useCallback((status) => {
        const config = {
            reserved: { color: 'processing', text: 'Reserved' },
            checked_out: { color: 'warning', text: 'Checked Out' },
            returned: { color: 'success', text: 'Returned' },
            damaged: { color: 'error', text: 'Damaged' },
            missing: { color: 'error', text: 'Missing' }
        };
        return config[status] || config.reserved;
    }, []);

    const normalizeMealStatus = (status) => String(status || 'pending').toLowerCase().replaceAll(' ', '_');

    const getMealStatusConfig = useCallback((status) => {
        const key = normalizeMealStatus(status);
        const config = {
            pending: { color: 'default', text: 'Pending' },
            preparing: { color: 'processing', text: 'Preparing' },
            ready_for_delivery: { color: 'cyan', text: 'Ready for Delivery' },
            dispatched: { color: 'geekblue', text: 'Dispatched' },
            delivered: { color: 'blue', text: 'Delivered' },
            serving: { color: 'warning', text: 'Serving' },
            served: { color: 'purple', text: 'Served' },
            completed: { color: 'success', text: 'Completed' },
            cancelled: { color: 'error', text: 'Cancelled' },
        };
        return config[key] || config.pending;
    }, []);

    // ==================== TAB CHANGE HANDLER ====================
    const handleTabChange = useCallback((key) => {
        setActiveMainTab(key);
        if (key === 'events' || key === 'ongoing' || key === 'checklist' || key === 'delivery') {
            refetchEvents();
        }
        if (key === 'equipment') {
            // Refresh equipment tracking when equipment tab is clicked
            const loadEquipmentTracking = async () => {
                try {
                    const response = await eventAPI.getEvents({ per_page: 100 });
                    const eventsData = response.data?.data?.data || response.data?.data || [];
                    
                    const trackingData = [];
                    eventsData.forEach(event => {
                        const equipmentList = event.equipment_in_out || event.equipment || [];
                        if (equipmentList.length > 0) {
                            equipmentList.forEach(eq => {
                                trackingData.push({
                                    ...eq,
                                    id: eq.id || eq.booking_equipment_id || `eq-${event.booking_id || event.id}-${eq.equipment_id}`,
                                    equipment_name: eq.equipment?.name || eq.equipment_name || eq.name || 'Unknown',
                                    booking_no: event.booking_no || `BK-${event.id}`,
                                    booking_id: event.booking_id || event.id,
                                    customer_name: event.customer_name || 'Unknown',
                                    event_name: event.event_name || 'Event',
                                    event_date: event.date || event.event_date,
                                    status: eq.status || 'reserved',
                                    checked_out_date: eq.checked_out_date || eq.checkout_date,
                                    rental_end_date: eq.rental_end_date || eq.expected_return_date,
                                    quantity_reserved: eq.quantity_reserved || eq.quantity || 1,
                                    quantity_used: eq.quantity_used || 0,
                                    quantity_damaged: eq.quantity_damaged || 0,
                                    quantity_missing: eq.quantity_missing || 0,
                                    is_out_approved: eq.is_out_approved || false,
                                    condition_notes_out: eq.condition_notes_out || '',
                                    condition_notes_in: eq.condition_notes_in || '',
                                    checked_out_by: eq.checked_out_by || '',
                                    returned_by: eq.returned_by || '',
                                    return_notes: eq.return_notes || ''
                                });
                            });
                        }
                    });
                    
                    if (isMounted.current) {
                        setEquipmentTrackingData(trackingData);
                    }
                } catch (error) {
                    console.error('Failed to load equipment tracking:', error);
                    if (isMounted.current) {
                        setEquipmentTrackingData([]);
                    }
                }
            };
            loadEquipmentTracking();
        }
    }, [refetchEvents]);

    // ==================== START EVENT ====================
    const handleStartEvent = useCallback(async (record) => {
        const scheduledDate = record.date || record.event_date;
        const isScheduledToday = scheduledDate ? dayjs(scheduledDate).isSame(dayjs(), 'day') : true;
        Modal.confirm({
            title: 'Start Event',
            content: isScheduledToday
                ? `Mark "${record.display_name || record.event_name}" (Booking: ${record.booking_no}) as ongoing?`
                : `This event is scheduled for ${scheduledDate ? dayjs(scheduledDate).format('MMMM D, YYYY') : 'another date'}. Starting it today requires a reason.`,
            okText: 'Start Event',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const reason = isScheduledToday ? '' : window.prompt('Enter the reason for manually starting this event outside its scheduled date:');
                    if (!isScheduledToday && !reason?.trim()) {
                        message.warning('Start cancelled. A reason is required.');
                        return Promise.reject(new Error('Reason required'));
                    }
                    await eventAPI.startEvent(record.id || record.booking_id, {
                        force_start: !isScheduledToday,
                        reason: reason || 'Started from Events Management',
                    });
                    message.success(`Event "${record.display_name || record.event_name}" has started`);
                    await refetchEvents();
                    notification.success({
                        message: 'Event Started',
                        description: `${record.display_name || record.event_name} is now in ongoing events.`,
                        placement: 'topRight',
                    });
                } catch (error) {
                    console.error('Start event error:', error);
                    message.error(error.response?.data?.message || 'Failed to start event');
                }
            }
        });
    }, [refetchEvents]);

    // ==================== STAFF FUNCTIONS ====================
    const handleStaffAssignment = useCallback((record) => {
        setSelectedEventForStaff(record);
        const defaultStart = record?.time ? dayjs(record.time, ['HH:mm', 'HH:mm:ss', 'h:mm A']) : dayjs('08:00', 'HH:mm');
        const defaultEnd = defaultStart.isValid() ? defaultStart.add(8, 'hour') : dayjs('17:00', 'HH:mm');
        staffForm.setFieldsValue({
            start_time: defaultStart.isValid() ? defaultStart : dayjs('08:00', 'HH:mm'),
            end_time: defaultEnd.isValid() ? defaultEnd : dayjs('17:00', 'HH:mm'),
            schedule: `${record?.time || '08:00'} - 17:00`,
            phone: record?.customer_phone || '',
            email: record?.customer_email || ''
        });
        setStaffAssignmentModalVisible(true);
    }, [staffForm]);

    const handleAddStaffToEvent = useCallback(async (values) => {
        try {
            const event = selectedEventForStaff;
            
            let staffIds = values.staff_id;
            
            if (!staffIds || (Array.isArray(staffIds) && staffIds.length === 0)) {
                message.error('Please select at least one staff member');
                return;
            }
            
            if (!Array.isArray(staffIds)) {
                staffIds = [staffIds];
            }
            
            staffIds = staffIds.filter(id => id !== null && id !== undefined && id !== '');
            
            if (staffIds.length === 0) {
                message.error('Please select at least one staff member');
                return;
            }
            
            const startTime = values.start_time?.format ? values.start_time.format('HH:mm') : '08:00';
            const endTime = values.end_time?.format ? values.end_time.format('HH:mm') : '17:00';
            const staffData = {
                staff_ids: staffIds,
                role: values.role,
                start_time: startTime,
                end_time: endTime,
                schedule: `${startTime} - ${endTime}`,
                phone: values.phone || event?.customer_phone || '',
                email: values.email || event?.customer_email || '',
                status: 'confirmed'
            };
            
            await assignStaffMutation.mutateAsync({
                eventId: event.id,
                data: staffData
            });
            
            message.success(`${staffIds.length} staff member(s) assigned to ${event.display_name || event.event_name}`);
            setAddStaffModalVisible(false);
            setStaffAssignmentModalVisible(false);
            staffForm.resetFields();
            await refetchEvents();
        } catch (error) {
            console.error('Staff assignment error:', error);
            message.error(error.response?.data?.message || 'Failed to assign staff');
        }
    }, [assignStaffMutation, selectedEventForStaff, staffForm, refetchEvents]);

    const handleRemoveStaff = useCallback(async (eventId, staffId) => {
        try {
            await removeStaffMutation.mutateAsync({ eventId, staffId });
            message.success('Staff removed from event');
            await refetchEvents();
        } catch (error) {
            message.error('Failed to remove staff');
        }
    }, [removeStaffMutation, refetchEvents]);

    const handleUpdateStaffStatus = useCallback(async (eventId, staffId, status) => {
        try {
            await updateStaffStatusMutation.mutateAsync({
                eventId,
                staffId,
                data: { status }
            });
            message.success(`Staff status updated to ${status}`);
            await refetchEvents();
        } catch (error) {
            message.error('Failed to update staff status');
        }
    }, [updateStaffStatusMutation, refetchEvents]);

    // ==================== CHECKLIST FUNCTIONS ====================
    const handleViewChecklist = useCallback(async (record) => {
        setSelectedEventForChecklist(record);
        try {
            const response = await eventAPI.getChecklist(record.id);
            const payload = response.data?.data ?? response.data ?? [];
            const checklistRows = Array.isArray(payload) ? payload : (payload.checklist || []);
            setChecklist(checklistRows.map(item => ({
                ...item,
                completed: Boolean(item.completed ?? item.status === 'completed'),
            })));
            setChecklistModalVisible(true);
        } catch (error) {
            console.error('Failed to load checklist data:', error);
            message.error(error.response?.data?.message || 'Failed to load checklist data');
        }
    }, []);

    const handleAddChecklistItem = useCallback(async (values) => {
        try {
            const task = values.task || values;
            const assignedTo = values.assigned_to || 'Unassigned';
            const newItem = {
                task_key: `manual-${Date.now()}`,
                task: typeof task === 'string' ? task : task.task,
                assigned_to: assignedTo,
                status: 'pending',
                source_type: 'manual'
            };
            
            await addChecklistItemMutation.mutateAsync({
                eventId: selectedEventForChecklist.id,
                data: newItem
            });
            message.success('Checklist item added');
            await handleViewChecklist(selectedEventForChecklist);
        } catch (error) {
            console.error('Failed to add checklist item:', error);
            message.error('Failed to add checklist item');
        }
    }, [addChecklistItemMutation, selectedEventForChecklist, handleViewChecklist]);

    const handleUpdateChecklistItem = useCallback(async (itemId, completed) => {
        try {
            await updateChecklistItemMutation.mutateAsync({
                eventId: selectedEventForChecklist.id,
                itemId,
                data: {
                    completed,
                    status: completed ? 'completed' : 'pending',
                }
            });

            await handleViewChecklist(selectedEventForChecklist);
            await refetchEvents();
        } catch (error) {
            console.error('Update checklist error:', error);
            message.error(error.response?.data?.message || 'Failed to update checklist');
        }
    }, [selectedEventForChecklist, updateChecklistItemMutation, handleViewChecklist, refetchEvents]);

    const handleDeleteChecklistItem = useCallback(async (eventId, itemId) => {
        try {
            const item = checklist.find(i => i.id === itemId || i.task_key === itemId);
            if (item?.is_delivery) {
                message.warning('This item is managed from Delivery Preparation section');
                return;
            }
            await deleteChecklistItemMutation.mutateAsync({ eventId, itemId });
            message.success('Checklist item deleted');
            setChecklist(prev => prev.filter(i => i.id !== itemId && i.task_key !== itemId));
            await refetchEvents();
        } catch (error) {
            message.error('Failed to delete checklist item');
        }
    }, [checklist, deleteChecklistItemMutation, refetchEvents]);

    // ==================== DELIVERY FUNCTIONS ====================
    const handleViewDeliveryTracking = useCallback((record) => {
        setSelectedEventForDelivery(record);
        const deliveries = record.delivery_tracking || record.deliveries || [];
        setDeliveryTrackings(deliveries);
        setDeliveryTrackingModalVisible(true);
    }, []);

    const handleAddDeliverySubmit = useCallback(async (values) => {
        try {
            const selectedBooking = activeEvents.find(event => String(event.booking_id || event.id || event.booking_no) === String(values.booking_id || selectedEventForDelivery?.booking_id || selectedEventForDelivery?.id || selectedEventForDelivery?.booking_no)) || selectedEventForDelivery;
            const newDelivery = {
                booking_id: values.booking_id || selectedBooking?.booking_id || selectedBooking?.id || null,
                delivery_type: values.delivery_type || selectedBooking?.service_type || 'buffet',
                delivery_date: values.delivery_date ? values.delivery_date.format('YYYY-MM-DD') : (selectedBooking?.date || selectedBooking?.event_date),
                delivery_time: values.delivery_time || selectedBooking?.event_time || '',
                return_time: values.return_time || '',
                venue: values.venue || selectedBooking?.location || selectedBooking?.venue || '',
                vehicle: values.vehicle || '',
                driver: values.driver,
                driver_phone: values.driver_phone || '',
                status: 'pending',
                items: values.items || '',
                notes: values.notes || '',
                created_at: new Date().toISOString()
            };
            await addDeliveryMutation.mutateAsync({
                eventId: selectedBooking.id || selectedEventForDelivery.id,
                data: newDelivery
            });
            message.success('Delivery added successfully');
            setAddDeliveryModalVisible(false);
            addDeliveryForm.resetFields();
            await refetchEvents();
        } catch (error) {
            console.error('Add delivery error:', error);
            message.error(error.response?.data?.message || 'Failed to add delivery');
        }
    }, [activeEvents, selectedEventForDelivery, addDeliveryMutation, addDeliveryForm, refetchEvents]);

    const handleUpdateDeliveryStatus = useCallback(async (deliveryId, status, location = null) => {
        try {
            await updateDeliveryStatusMutation.mutateAsync({
                eventId: selectedEventForDelivery.id,
                deliveryId,
                data: { status, location }
            });
            message.success(`Delivery status updated to ${status}`);
            await refetchEvents();
            setDeliveryTrackings(prev => 
                prev.map(d => d.id === deliveryId ? { ...d, status, location: location || d.location } : d)
            );
        } catch (error) {
            console.error('Update delivery error:', error);
            message.error(error.response?.data?.message || 'Failed to update delivery status');
        }
    }, [selectedEventForDelivery, updateDeliveryStatusMutation, refetchEvents]);

    // ==================== EQUIPMENT FUNCTIONS ====================
    const refreshSelectedEquipment = useCallback(async (event) => {
        const eventId = event?.id || event?.booking_id;
        if (!eventId) return;
        const response = await eventAPI.getEquipment(eventId);
        const payload = response.data?.data ?? response.data ?? [];
        const rows = Array.isArray(payload) ? payload : (payload.equipment || []);
        setSelectedEquipmentList(rows.map(eq => ({
            ...eq,
            id: eq.id || eq.booking_equipment_id,
            equipment_name: eq.equipment?.name || eq.equipment_name || eq.name || 'Unknown',
        })));
    }, []);

    const handleCheckoutEquipment = useCallback(async (values) => {
        try {
            const eventId = selectedEventForEquipment?.id || selectedEventForEquipment?.booking_id;
            if (!eventId) {
                message.error('No event selected');
                return;
            }
            if (selectedEquipmentRowKeys.length === 0) {
                message.warning('Select at least one reserved equipment item to approve.');
                return;
            }

            const payload = {
                equipment_item_ids: selectedEquipmentRowKeys,
                expected_return_date: values.expected_return_date?.format('YYYY-MM-DD'),
                condition_out: values.condition_out || 'Good',
                notes: values.notes || '',
                checked_out_by: values.checked_out_by || 'Event Management'
            };

            await approveSelectedEquipmentMutation.mutateAsync({
                eventId,
                data: payload
            });

            setEquipmentCheckoutModalVisible(false);
            setSelectedEquipmentRowKeys([]);
            equipmentForm.resetFields();
            await Promise.all([
                refreshSelectedEquipment(selectedEventForEquipment),
                refetchEvents(),
            ]);
        } catch (error) {
            console.error('Equipment approval error:', error);
            message.error(error.response?.data?.message || 'Failed to approve selected equipment');
        }
    }, [selectedEventForEquipment, selectedEquipmentRowKeys, approveSelectedEquipmentMutation, equipmentForm, refreshSelectedEquipment, refetchEvents]);

    const handleApproveAllEquipment = useCallback((record) => {
        Modal.confirm({
            title: 'Approve All Reserved Equipment',
            content: `Approve every pending equipment item for ${record.display_name || record.event_name || record.booking_no}? Already-approved items will be skipped.`,
            okText: 'Approve All',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await approveAllEquipmentMutation.mutateAsync({
                        eventId: record.id || record.booking_id,
                        data: { checked_out_by: 'Event Management' }
                    });
                    if ((selectedEventForEquipment?.id || selectedEventForEquipment?.booking_id) === (record.id || record.booking_id)) {
                        await refreshSelectedEquipment(record);
                    }
                    await refetchEvents();
                } catch (error) {
                    message.error(error.response?.data?.message || 'Failed to approve reserved equipment');
                }
            }
        });
    }, [approveAllEquipmentMutation, selectedEventForEquipment, refreshSelectedEquipment, refetchEvents]);

    const handleReturnEquipment = useCallback(async (values) => {
        try {
            if (!selectedEquipmentItem) {
                message.error('No equipment selected for return');
                return;
            }
            
            const payload = {
                condition_in: values.condition_in || 'Good',
                quantity_used: values.quantity_used || 0,
                quantity_damaged: values.quantity_damaged || 0,
                quantity_missing: values.quantity_missing || 0,
                returned_by: values.returned_by || 'System',
                notes: values.return_notes || ''
            };
            
            await returnEquipmentMutation.mutateAsync({
                eventId: selectedEventForEquipment?.id || selectedEventForEquipment?.booking_id || selectedEquipmentItem.booking_id,
                transactionId: selectedEquipmentItem.id,
                data: payload
            });
            
            message.success('✅ Equipment returned successfully');
            setEquipmentReturnModalVisible(false);
            setSelectedEquipmentItem(null);
            equipmentForm.resetFields();
            await refetchEvents();
            notification.success({
                message: 'Equipment Returned',
                description: `Equipment checked in successfully.`,
                placement: 'topRight',
                duration: 3,
            });
        } catch (error) {
            console.error('Equipment return error:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to return equipment';
            message.error(errorMsg);
        }
    }, [selectedEquipmentItem, selectedEventForEquipment, returnEquipmentMutation, equipmentForm, refetchEvents]);

    // ==================== ONGOING EVENT FUNCTIONS ====================
    const handleViewOngoingEvent = useCallback((record) => {
        setSelectedOngoingEvent(record);
        setLiveStatusModalVisible(true);
    }, []);

    const handleMarkEventOngoing = useCallback(async (record) => {
        try {
            await eventAPI.startEvent(record.id || record.booking_id, {
                force_start: true,
                reason: 'Marked ongoing from Events Management',
            });
            message.success(`Event ${record.display_name || record.event_name} marked as ongoing`);
            await refetchEvents();
        } catch (error) {
            console.error('Mark ongoing error:', error);
            message.error(error.response?.data?.message || 'Failed to update event status');
        }
    }, [refetchEvents]);

    const handleUpdateDailyProgress = useCallback(async (day, completion, notes) => {
        try {
            await updateDailyProgressMutation.mutateAsync({
                eventId: selectedOngoingEvent.id,
                dayNumber: day,
                data: { completion, notes }
            });
            message.success(`Day ${day} progress updated`);
            await refetchEvents();
            setSelectedOngoingEvent(prev => {
                const updated = { ...prev };
                if (!updated.daily_progress) updated.daily_progress = [];
                updated.daily_progress[day - 1] = { ...updated.daily_progress[day - 1], completion, notes };
                const total = updated.daily_progress.length;
                const sum = updated.daily_progress.reduce((acc, dp) => acc + (dp.completion || 0), 0);
                updated.progress = Math.round(sum / total);
                return updated;
            });
        } catch (error) {
            console.error('Update daily progress error:', error);
            message.error('Failed to update daily progress');
        }
    }, [selectedOngoingEvent, updateDailyProgressMutation, refetchEvents]);

    const handleUpdateAttendance = useCallback(async (day, present) => {
        try {
            await updateAttendanceMutation.mutateAsync({
                eventId: selectedOngoingEvent.id,
                day,
                present
            });
            message.success(`Day ${day} attendance updated`);
            await refetchEvents();
            setSelectedOngoingEvent(prev => {
                const updated = { ...prev };
                if (!updated.attendance) updated.attendance = [];
                const registered = updated.attendance[day - 1]?.registered || updated.guests_count || 0;
                updated.attendance[day - 1] = { 
                    ...updated.attendance[day - 1], 
                    present, 
                    registered,
                    attendance_rate: Math.round((present / registered) * 100)
                };
                return updated;
            });
        } catch (error) {
            console.error('Update attendance error:', error);
            message.error('Failed to update attendance');
        }
    }, [selectedOngoingEvent, updateAttendanceMutation, refetchEvents]);

    const handleAdvanceToNextDay = useCallback(async () => {
        try {
            await advanceToNextDayMutation.mutateAsync(selectedOngoingEvent.id);
            message.success('Advanced to next day');
            await refetchEvents();
        } catch (error) {
            message.error('Failed to advance to next day');
        }
    }, [selectedOngoingEvent, advanceToNextDayMutation, refetchEvents]);

    const handleCompleteEvent = useCallback(async (record) => {
        Modal.confirm({
            title: 'Complete Event',
            content: `Mark "${record.display_name || record.event_name}" (Booking: ${record.booking_no}) as completed?`,
            okText: 'Complete',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await completeEventMutation.mutateAsync(record.id);
                    message.success('Event marked as completed');
                    setLiveStatusModalVisible(false);
                    await refetchEvents();
                } catch (error) {
                    console.error('Complete event error:', error);
                    message.error(error.response?.data?.message || 'Failed to complete event');
                }
            }
        });
    }, [completeEventMutation, refetchEvents]);

    const handleUpdateMealServiceStatus = useCallback(async (eventRecord, mealRecord, status) => {
        try {
            await eventAPI.updateMealServiceStatus(eventRecord.id, mealRecord.meal_service_id || mealRecord.id, { meal_status: normalizeMealStatus(status) });
            message.success(`${mealRecord.meal_type} marked as ${status}`);
            await refetchEvents();
            setSelectedEvent(prev => prev ? {
                ...prev,
                meal_services: (prev.meal_services || []).map(meal => (meal.meal_service_id || meal.id) === (mealRecord.meal_service_id || mealRecord.id) ? { ...meal, meal_status: normalizeMealStatus(status) } : meal)
            } : prev);
        } catch (error) {
            console.error('Meal service status update error:', error);
            message.error(error.response?.data?.message || 'Failed to update meal service status');
        }
    }, [refetchEvents]);

    // ==================== GENERAL EVENT FUNCTIONS ====================
    const handleViewEventDetails = useCallback((record) => {
        setSelectedEvent(record);
        setEventDetailsModalVisible(true);
    }, []);

    const handleEditEvent = useCallback((record) => {
        setSelectedEvent(record);
        eventForm.setFieldsValue({
            ...record,
            date: record.date ? dayjs(record.date) : null,
            end_date: record.end_date ? dayjs(record.end_date) : null
        });
        setEditEventModalVisible(true);
    }, [eventForm]);

    const handleUpdateEvent = useCallback(async (values) => {
        try {
            await eventAPI.updateEvent(selectedEvent.id, {
                customer_name: values.customer_name,
                event_name: values.event_name,
                event_type: values.event_type,
                date: values.date.format('YYYY-MM-DD'),
                end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : values.date.format('YYYY-MM-DD'),
                time: values.time,
                location: values.location,
                guests_count: values.guests_count
            });
            message.success('Event updated successfully');
            setEditEventModalVisible(false);
            await refetchEvents();
        } catch (error) {
            message.error('Failed to update event');
        }
    }, [selectedEvent, refetchEvents]);

    // ==================== EXPORT FUNCTIONS ====================
    const exportToExcel = useCallback((data, filename, columns) => {
        const worksheetData = data.map(row => {
            const exportRow = {};
            columns.forEach(col => {
                if (col.dataIndex) {
                    exportRow[col.title] = row[col.dataIndex];
                } else if (col.render) {
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
    }, []);

    const exportEvents = useCallback(() => {
        const columns = [
            { title: 'BOOKING ID', dataIndex: 'booking_no' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'EVENT', dataIndex: 'event_name' },
            { title: 'DATE', dataIndex: 'date' },
            { title: 'TIME', dataIndex: 'time' },
            { title: 'LOCATION', dataIndex: 'location' },
            { title: 'GUESTS', dataIndex: 'guests_count' },
            { title: 'STATUS', dataIndex: 'status' }
        ];
        exportToExcel(activeEvents, 'Events_Report', columns);
    }, [activeEvents, exportToExcel]);

    // ==================== PAGINATION ====================
    const renderPaginationItem = useCallback((_, type, originalElement) => {
        if (type === 'prev') {
            return (
                <Button className="em-pagination-navigation-button" size="small" icon={<LeftOutlined />}>
                    Previous
                </Button>
            );
        }
        if (type === 'next') {
            return (
                <Button className="em-pagination-navigation-button" size="small">
                    Next <RightOutlined />
                </Button>
            );
        }
        return originalElement;
    }, []);

    const renderEmptyPaginationFooter = useCallback((label) => {
        return (
            <div className="em-empty-pagination-footer">
                <span className="em-empty-pagination-total">Total 0 {label}</span>
                <div className="em-empty-pagination-controls">
                    <Button className="em-pagination-navigation-button" size="small" icon={<LeftOutlined />} disabled>
                        Previous
                    </Button>
                    <button type="button" className="em-empty-pagination-current-page" disabled>1</button>
                    <Button className="em-pagination-navigation-button" size="small" disabled>
                        Next <RightOutlined />
                    </Button>
                </div>
            </div>
        );
    }, []);

    // ==================== DROPDOWN MENU ====================
    const getActionMenuItems = useCallback((record) => {
        const items = [
            { 
                key: 'staff', 
                label: 'Staff Assignment', 
                icon: <TeamOutlined />, 
                onClick: () => handleStaffAssignment(record) 
            },
            { 
                key: 'checklist', 
                label: 'View Checklist', 
                icon: <CheckCircleOutlined />, 
                onClick: () => handleViewChecklist(record) 
            },
            { 
                key: 'delivery', 
                label: 'Delivery Tracking', 
                icon: <TruckOutlined />, 
                onClick: () => handleViewDeliveryTracking(record) 
            },
            { 
                key: 'livestatus', 
                label: 'Live Status', 
                icon: <DashboardOutlined />, 
                onClick: () => handleViewOngoingEvent(record) 
            },
            { type: 'divider' },
        ];
        
        if (record.status === 'upcoming' || record.status === 'confirmed') {
            items.push({
                key: 'start', 
                label: '▶ Start Event', 
                icon: <PlayCircleOutlined style={{ color: '#10b981' }} />, 
                onClick: () => handleStartEvent(record)
            });
        }
        
        items.push({
            key: 'checkout', 
            label: 'Approve Equipment Out', 
            icon: <PlusCircleOutlined style={{ color: '#3b82f6' }} />, 
            onClick: () => {
                setSelectedEventForEquipment(record);
                equipmentForm.resetFields();
                setEquipmentCheckoutModalVisible(true);
            }
        });

        items.push({
            key: 'approveAllEquipment',
            label: 'Approve All Equipment',
            icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
            onClick: () => handleApproveAllEquipment(record)
        });
        
        if (record.status === 'upcoming' || record.status === 'confirmed') {
            items.push({
                key: 'ongoing', 
                label: 'Mark as Ongoing', 
                icon: <SyncOutlined style={{ color: '#f59e0b' }} />, 
                onClick: () => handleMarkEventOngoing(record)
            });
        }
        
        items.push({ type: 'divider' });
        
        items.push({
            key: 'complete', 
            label: 'Complete Event', 
            icon: <FlagOutlined />, 
            onClick: () => handleCompleteEvent(record), 
            disabled: record.status === 'completed' 
        });
        
        items.push({
            key: 'edit', 
            label: 'Edit Event', 
            icon: <EditOutlined />, 
            onClick: () => handleEditEvent(record) 
        });
        
        return items;
    }, [
        handleStaffAssignment, handleViewChecklist, handleViewDeliveryTracking, 
        handleViewOngoingEvent, handleStartEvent, handleApproveAllEquipment, 
        handleMarkEventOngoing, handleCompleteEvent, handleEditEvent,
        equipmentForm
    ]);

    // ==================== TABLE COLUMNS ====================
    const eventColumns = useMemo(() => [
        { 
            title: 'BOOKING ID', 
            dataIndex: 'booking_no', 
            key: 'booking_no', 
            width: 140, 
            fixed: 'left',
            render: (text) => <span className="em-id-text">{text || 'N/A'}</span>
        },
        { 
            title: 'CUSTOMER', 
            dataIndex: 'customer_name', 
            key: 'customer_name', 
            width: 180,
            render: (text, record) => (
                <div className="em-customer-cell">
                    <div className="em-customer-name">{text || 'Unknown'}</div>
                    {record.customer_email && (
                        <div className="em-customer-contact"><MailOutlined /> {record.customer_email}</div>
                    )}
                    {record.customer_phone && (
                        <div className="em-customer-contact"><PhoneOutlined /> {record.customer_phone}</div>
                    )}
                </div>
            )
        },
        { 
            title: 'EVENT', 
            key: 'event', 
            width: 180,
            render: (_, record) => (
                <div>
                    {/* <div className="em-event-name">{record.event_name || 'N/A'}</div> */}
                    {record.event_type && <Tag color="blue" style={{ marginTop: 4 , marginLeft: 30}}>{record.event_type}</Tag>}
                    {record.total_days > 1 && <Tag color="purple" style={{ marginTop: 4, marginLeft: 30}}>Multi-Day</Tag>}
                </div>
            )
        },
        { 
            title: 'DATE & TIME', 
            key: 'datetime', 
            width: 180,
            render: (_, record) => {
                const formatTimeWithAMPM = (time) => {
                    if (!time) return 'Not specified';
                    if (time.includes('AM') || time.includes('PM')) return time;
                    try {
                        const parsed = dayjs(`2000-01-01 ${time}`, 'YYYY-MM-DD HH:mm');
                        if (parsed.isValid()) {
                            return parsed.format('h:mm A');
                        }
                        const parsed2 = dayjs(`2000-01-01 ${time}`, 'YYYY-MM-DD h:mm');
                        if (parsed2.isValid()) {
                            return parsed2.format('h:mm A');
                        }
                    } catch (e) {}
                    return time;
                };
                
                return (
                    <div className="em-datetime-cell">
                        <div><CalendarOutlined /> {record.date}</div>
                        <div><ClockCircleOutlined /> {formatTimeWithAMPM(record.time)}</div>
                        {record.total_days > 1 && record.end_date && (
                            <div><ScheduleOutlined /> to {record.end_date}</div>
                        )}
                    </div>
                );
            }
        },
        { 
            title: 'MEALS', 
            key: 'meals', 
            width: 90, 
            align: 'center',
            render: (_, record) => <Badge count={record.meal_services?.length || record.meal_schedule?.length || 0} showZero style={{ backgroundColor: '#8b5cf6' }} />
        },
        { 
            title: 'LOCATION', 
            dataIndex: 'location', 
            key: 'location', 
            width: 180, 
            ellipsis: true,
            render: (text) => <div><EnvironmentOutlined /> {text || 'N/A'}</div>
        },
        { 
            title: 'GUESTS', 
            dataIndex: 'guests_count', 
            key: 'guests_count', 
            width: 80, 
            align: 'center',
            render: (v) => <span className="em-pax-number"><TeamOutlined /> {v || 0}</span>
        },
        { 
            title: 'STAFF', 
            key: 'staff', 
            width: 80, 
            align: 'center',
            render: (_, record) => <Badge count={record.assigned_staff?.length || 0} showZero style={{ backgroundColor: '#3b82f6' }} />
        },
        { 
            title: 'STATUS', 
            dataIndex: 'status', 
            key: 'status', 
            width: 120, 
            align: 'center',
            render: (status) => {
                const config = getStatusConfig(status);
                return (
                    <span className="em-status" style={{ color: config.color, background: config.bg }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        { 
            title: 'PROGRESS', 
            key: 'progress', 
            width: 120,
            render: (_, record) => <Progress percent={record.progress || 0} size="small" strokeColor="#3b82f6" />
        },
        { 
            title: 'ACTIONS', 
            key: 'actions', 
            width: 130, 
            fixed: 'right',
            render: (_, record) => (
                <div className="em-action-group">
                    <Tooltip title="View Details">
                        <button className="em-action-icon view" onClick={() => handleViewEventDetails(record)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit Event">
                        <button className="em-action-icon edit" onClick={() => handleEditEvent(record)}>
                            <EditOutlined />
                        </button>
                    </Tooltip>
                    <Dropdown menu={{ items: getActionMenuItems(record) }} placement="bottomRight">
                        <button className="em-action-icon more">
                            <MoreOutlined />
                        </button>
                    </Dropdown>
                </div>
            )
        }
    ], [getStatusConfig, getActionMenuItems, handleViewEventDetails, handleEditEvent]);

    // ==================== EQUIPMENT TRACKING BY BOOKING COLUMNS ====================
    const equipmentTrackingByBookingColumns = useMemo(() => [
        { 
            title: 'Booking #', 
            dataIndex: 'booking_no', 
            key: 'booking_no',
            render: (text) => <span className="em-id-text">{text || 'N/A'}</span>
        },
        { 
            title: 'Customer', 
            dataIndex: 'customer_name', 
            key: 'customer_name',
            render: (text) => <span className="em-customer-name">{text || 'Unknown'}</span>
        },
        { 
            title: 'Event Name', 
            dataIndex: 'event_name', 
            key: 'event_name',
            render: (text) => <Tag color="blue">{text || 'N/A'}</Tag>
        },
        { 
            title: 'Checkout Date', 
            key: 'checkout_date',
            render: (_, record) => {
                const date = record.checked_out_date || record.created_at;
                return date ? dayjs(date).format('MMM DD, YYYY') : '-';
            }
        },
        { 
            title: 'Expected Return', 
            key: 'return_date',
            render: (_, record) => {
                const date = record.rental_end_date || record.expected_return_date;
                if (!date) return '-';
                const isOverdue = dayjs(date).isBefore(dayjs()) && record.status !== 'returned';
                return (
                    <span style={{ color: isOverdue ? '#ef4444' : 'inherit' }}>
                        {dayjs(date).format('MMM DD, YYYY')}
                        {isOverdue && <Tag color="error" style={{ marginLeft: 4 }}>Overdue</Tag>}
                    </span>
                );
            }
        },
        { 
            title: 'Status', 
            key: 'status',
            render: (_, record) => {
                const hasReserved = record.equipment_items?.some(eq => eq.status === 'reserved' && !eq.is_out_approved);
                const hasCheckedOut = record.equipment_items?.some(eq => eq.status === 'checked_out' || eq.is_out_approved);
                const hasReturned = record.equipment_items?.every(eq => eq.status === 'returned');
                
                if (hasReturned) return <Tag color="success">All Returned</Tag>;
                if (hasCheckedOut) return <Tag color="warning">Some Checked Out</Tag>;
                if (hasReserved) return <Tag color="processing">Pending Approval</Tag>;
                return <Tag color="default">No Equipment</Tag>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button 
                    size="small" 
                    type="primary" 
                    icon={<EyeOutlined />}
                    onClick={() => {
                        const bookingEquipment = equipmentTrackingData.filter(eq => eq.booking_no === record.booking_no);
                        setSelectedEventForEquipment(record);
                        setSelectedEquipmentList(bookingEquipment);
                        setSelectedEquipmentRowKeys([]);
                        setEquipmentTrackingModalVisible(true);
                    }}
                >
                    View Equipment
                </Button>
            )
        }
    ], [equipmentTrackingData]);

    const ongoingEventsColumns = useMemo(() => [
        { 
            title: 'BOOKING ID', 
            dataIndex: 'booking_no', 
            key: 'booking_no', 
            width: 140,
            render: (text) => <span className="em-id-text">{text || 'N/A'}</span>
        },
        { 
            title: 'CUSTOMER', 
            dataIndex: 'customer_name', 
            key: 'customer_name', 
            width: 160,
            render: (text) => <span className="em-customer-name">{text || 'Unknown'}</span>
        },
        { 
            title: 'EVENT', 
            dataIndex: 'event_name', 
            key: 'event_name', 
            width: 160,
            render: (text) => <Tag color="cyan">{text || 'N/A'}</Tag>
        },
        { 
            title: 'DATES', 
            key: 'dates', 
            width: 160,
            render: (_, r) => `${r.date} to ${r.end_date || r.date}`
        },
        { 
            title: 'CURRENT DAY', 
            key: 'current_day', 
            width: 120,
            align: 'center',
            render: (_, r) => <Tag color="processing">Day {r.current_day} of {r.total_days || 1}</Tag>
        },
        { 
            title: 'PROGRESS', 
            key: 'progress', 
            width: 200,
            render: (_, r) => (
                <div>
                    {r.daily_progress?.map((dp, idx) => (
                        <div key={idx} style={{ marginBottom: 4 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Day {idx + 1}:</Text>
                            <Progress percent={dp?.completion || 0} size="small" strokeColor={dp?.completion === 100 ? '#10b981' : '#3b82f6'} />
                        </div>
                    ))}
                </div>
            )
        },
        { 
            title: 'ACTIONS', 
            key: 'actions', 
            width: 120,
            render: (_, record) => (
                <Button size="small" type="primary" icon={<EyeOutlined />} onClick={() => handleViewOngoingEvent(record)}>
                    Monitor
                </Button>
            )
        }
    ], [handleViewOngoingEvent]);

    // ==================== DETAILED EQUIPMENT MODAL COLUMNS ====================
    const detailedEquipmentColumns = useMemo(() => [
        {
            title: 'Name',
            dataIndex: 'equipment_name',
            key: 'name',
            render: (text, record) => {
                const name = record.equipment?.name || record.equipment_name || record.name || 'Unknown';
                return <span className="em-equipment-name">{name}</span>;
            }
        },
        {
            title: 'Quantity',
            dataIndex: 'quantity_reserved',
            key: 'qty',
            align: 'center',
            render: (v) => <span className="em-equipment-qty">{v || 0}</span>
        },
        {
            title: 'Damaged',
            dataIndex: 'quantity_damaged',
            key: 'damaged',
            align: 'center',
            render: (v) => <span style={{ color: v > 0 ? '#ef4444' : 'inherit' }}>{v || 0}</span>
        },
        {
            title: 'Missing',
            dataIndex: 'quantity_missing',
            key: 'missing',
            align: 'center',
            render: (v) => <span style={{ color: v > 0 ? '#ef4444' : 'inherit' }}>{v || 0}</span>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status, record) => {
                const config = getEquipmentStatusConfig(status);
                return (
                    <Space direction="vertical" size={2}>
                        <Tag color={config.color}>{config.text}</Tag>
                        {record.is_out_approved && <Tag color="green">Out Approved</Tag>}
                        {status === 'reserved' && !record.is_out_approved && <Tag color="orange">Waiting Approval</Tag>}
                    </Space>
                );
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => {
                if (record.status === 'reserved' && !record.is_out_approved) {
                    return (
                        <Button
                            size="small"
                            type="primary"
                            onClick={() => {
                                setSelectedEquipmentRowKeys([record.id || record.booking_equipment_id]);
                                equipmentForm.setFieldsValue({
                                    expected_return_date: record.rental_end_date ? dayjs(record.rental_end_date) : dayjs().add(7, 'days'),
                                    condition_out: 'Good',
                                    checked_out_by: record.checked_out_by || 'Event Management',
                                    notes: `Approved out for ${record.booking_no}`
                                });
                                setEquipmentCheckoutModalVisible(true);
                            }}
                        >
                            Approve Out
                        </Button>
                    );
                }

                if (record.status === 'checked_out' || record.is_out_approved) {
                    return (
                        <Button 
                            size="small" 
                            type="primary"
                            onClick={() => {
                                setSelectedEquipmentItem(record);
                                equipmentForm.setFieldsValue({
                                    equipment_name: record.equipment?.name || record.equipment_name || record.name,
                                    quantity: record.quantity_reserved || 0,
                                    condition_in: record.condition_notes_in || '',
                                    quantity_used: record.quantity_used || 0,
                                    quantity_damaged: record.quantity_damaged || 0,
                                    quantity_missing: record.quantity_missing || 0,
                                    returned_by: record.returned_by || '',
                                    return_notes: record.return_notes || ''
                                });
                                setEquipmentReturnModalVisible(true);
                            }}
                        >
                            Check In / Return
                        </Button>
                    );
                }

                if (record.status === 'returned') {
                    return <Tag color="success">Returned</Tag>;
                }

                return <Tag color="default">Complete</Tag>;
            }
        }
    ], [getEquipmentStatusConfig, equipmentForm]);

    // Get equipment by booking
    const getEquipmentByBooking = useCallback(() => {
        const bookingMap = {};
        equipmentTrackingData.forEach(item => {
            const key = item.booking_no || item.booking_id;
            if (!bookingMap[key]) {
                bookingMap[key] = {
                    id: item.booking_id,
                    booking_no: key,
                    booking_id: item.booking_id,
                    customer_name: item.customer_name || 'Unknown',
                    event_name: item.event_name || 'Event',
                    event_date: item.event_date,
                    checked_out_date: item.checked_out_date,
                    rental_end_date: item.rental_end_date,
                    status: item.status,
                    equipment_items: []
                };
            }
            bookingMap[key].equipment_items.push(item);
        });
        return Object.values(bookingMap);
    }, [equipmentTrackingData]);

    const renderDeliveryTrackingColumns = useCallback((includeAction = false) => {
        const columns = [
            {
                title: 'Meal / Date',
                key: 'meal_date',
                render: (_, record) => (
                    <div>
                        <div><strong>{record.meal_type ? record.meal_type.replace(/_/g, ' ') : (record.delivery_type || 'Delivery')}</strong></div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{record.delivery_date || record.event_date || record.service_date || '-'}</div>
                    </div>
                )
            },
            { title: 'Type', dataIndex: 'delivery_type', key: 'delivery_type', render: (v) => <Tag color="blue">{(v || 'buffet').replace(/_/g, ' ')}</Tag> },
            {
                title: 'Schedule',
                key: 'schedule',
                render: (_, record) => (
                    <div>
                        <div>Deliver: {record.delivery_time || record.eta || '-'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Return: {record.return_time || '-'}</div>
                    </div>
                )
            },
            { title: 'Venue', dataIndex: 'venue', key: 'venue', render: (v, r) => v || r.location || '-' },
            {
                title: 'Driver',
                key: 'driver',
                render: (_, record) => (
                    <div>
                        <div>{record.driver || '-'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{record.driver_phone || '-'}</div>
                    </div>
                )
            },
            { title: 'Items', dataIndex: 'items', key: 'items', ellipsis: true, render: (v) => v || '-' },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={getDeliveryStatusConfig(s).color}>{getDeliveryStatusConfig(s).text}</Tag> }
        ];

        if (includeAction) {
            columns.push({
                title: 'Action',
                key: 'action',
                render: (_, record) => (
                    <Space>
                        <Select value={record.status} size="small" onChange={(val) => handleUpdateDeliveryStatus(record.id, val)} style={{ width: 125 }}>
                            <Option value="pending">Pending</Option>
                            <Option value="departed">Departed</Option>
                            <Option value="en_route">En Route</Option>
                            <Option value="arrived">Arrived</Option>
                            <Option value="completed">DONE</Option>
                        </Select>
                        {record.status !== 'completed' && record.status !== 'arrived' && (
                            <Button size="small" type="text" onClick={() => {
                                const location = prompt('Enter current location or venue update:');
                                if (location) handleUpdateDeliveryStatus(record.id, record.status, location);
                            }}>Update Location</Button>
                        )}
                    </Space>
                )
            });
        }

        return columns;
    }, [getDeliveryStatusConfig, handleUpdateDeliveryStatus]);

    // ==================== STATS ====================
    const stats = useMemo(() => [
        { title: 'Total Events', value: activeEvents.length, icon: <CalendarOutlined />, color: 'blue' },
        { title: 'Upcoming', value: activeEvents.filter(e => e.status === 'upcoming').length, icon: <ClockCircleOutlined />, color: 'cyan' },
        { title: 'Ongoing', value: activeEvents.filter(e => e.status === 'ongoing').length, icon: <PlayCircleOutlined />, color: 'orange' },
        { title: 'Equipment Out', value: activeEvents.reduce((sum, e) => sum + (e.equipment_in_out?.filter(eq => eq.status === 'checked_out').length || 0), 0), icon: <SwapOutlined />, color: 'purple' }
    ], [activeEvents]);

    // ==================== CSS CLASSES ====================
    const containerClass = `em-event-container ${isDarkMode ? 'em-dark-mode' : ''}`;
    const headerClass = `em-header ${isDarkMode ? 'em-header-dark' : ''}`;
    const dateDisplayClass = `em-date-display ${isDarkMode ? 'em-date-display-dark' : ''}`;
    const mainCardClass = `em-main-card ${isDarkMode ? 'em-main-card-dark' : ''}`;
    const filtersClass = `em-filters ${isDarkMode ? 'em-filters-dark' : ''}`;
    const filterGroupClass = `em-filter-group ${isDarkMode ? 'em-filter-group-dark' : ''}`;
    const tableClass = `em-table ${isDarkMode ? 'em-table-dark' : ''}`;
    const kpiCardClass = `em-kpi-card ${isDarkMode ? 'em-kpi-card-dark' : ''}`;
    const tabContentClass = `em-tab-content ${isDarkMode ? 'em-tab-content-dark' : ''}`;
    const modalClass = `em-modal-clean ${isDarkMode ? 'em-modal-dark' : ''}`;
    const alertClass = isDarkMode ? 'em-alert-dark' : '';

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Filtered events
    const filteredEvents = useMemo(() => {
        return activeEvents.filter(event => {
            if (searchText && !event.display_name?.toLowerCase().includes(searchText.toLowerCase()) && 
                !event.event_name?.toLowerCase().includes(searchText.toLowerCase()) &&
                !event.customer_name?.toLowerCase().includes(searchText.toLowerCase()) &&
                !event.booking_no?.toLowerCase().includes(searchText.toLowerCase())) {
                return false;
            }
            if (filterStatus !== 'all' && event.status !== filterStatus) return false;
            if (filterCustomer !== 'all' && event.customer_name !== filterCustomer) return false;
            if (filterEventType !== 'all' && event.event_type !== filterEventType) return false;
            if (selectedDate) {
                const eventDate = dayjs(event.date);
                const filterDate = dayjs(selectedDate);
                if (!eventDate.isSame(filterDate, 'day')) return false;
            }
            return true;
        });
    }, [activeEvents, searchText, filterStatus, filterCustomer, filterEventType, selectedDate]);

    // ============================================================
    // RENDER
    // ============================================================
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
                    Card: {
                        borderRadiusLG: 16,
                    },
                    Modal: {
                        borderRadiusLG: 20,
                    },
                    Button: {
                        borderRadius: 10,
                    },
                    Input: {
                        borderRadius: 10,
                    },
                    Select: {
                        borderRadius: 10,
                    },
                }
            }}
        >
            <div className={containerClass}>
                {/* ==================== HEADER ==================== */}
                <div className={headerClass}>
                    <div className="em-header-left">
                        <Tooltip title="Event Management System">
                            <div className="em-logo-icon"><CalendarOutlined /></div>
                        </Tooltip>
                        <div className="em-header-info">
                            <h1>Event Management System</h1>
                            <span>Complete Event Operations</span>
                        </div>
                    </div>
                    <div className="em-header-right">
                        <div className={dateDisplayClass}>
                            <CalendarOutlined />
                            <span>{formattedDate}</span>
                        </div>
                        <Divider type="vertical" style={{ height: 28 }} />
                        <Tooltip title="Refresh all data">
                            <Button icon={<ReloadOutlined />} onClick={() => refetchEvents()}>Refresh</Button>
                        </Tooltip>
                        <Tooltip title="Export to Excel">
                            <Button icon={<ExportOutlined />} onClick={exportEvents}>Export</Button>
                        </Tooltip>
                        <Tooltip title="Print current view">
                            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                        </Tooltip>
                    </div>
                </div>

                {/* ==================== KPI CARDS ==================== */}
                <div className="em-kpi-grid">
                    {stats.map((stat, index) => (
                        <div key={index} className={kpiCardClass}>
                            <div className={`em-kpi-icon ${stat.color}`}>
                                {stat.icon}
                            </div>
                            <div className="em-kpi-stats">
                                <div className="em-kpi-value">{stat.value}</div>
                                <div className="em-kpi-label">{stat.title}</div>
                            </div>
                            <div className={`em-kpi-trend ${stat.value > 0 ? 'up' : 'warning'}`}>
                                {stat.value > 0 ? <RiseOutlined /> : <ClockCircleOutlined />}
                                {stat.value > 0 ? ` ${stat.value} active` : ' No active'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ==================== MAIN CARD ==================== */}
                <Card className={mainCardClass} variant="borderless">
                    <Tabs 
                        activeKey={activeMainTab} 
                        onChange={handleTabChange}
                        className="em-tabs"
                        destroyInactiveTabPane={true}
                    >
                        {/* ==================== EVENTS TAB ==================== */}
                        <TabPane tab={<span><CalendarOutlined /> All Events</span>} key="events">
                            <div className="em-tab-content">
                                <div className={filtersClass}>
                                    <div className={filterGroupClass}>
                                        <FilterOutlined />
                                        <Select value={filterStatus} onChange={setFilterStatus} className="em-filter-select" placeholder="Status">
                                            <Option value="all">All Status</Option>
                                            <Option value="upcoming">Upcoming</Option>
                                            <Option value="ongoing">Ongoing</Option>
                                            <Option value="completed">DONE</Option>
                                        </Select>
                                    </div>
                                    <div className={filterGroupClass}>
                                        <UserOutlined />
                                        <Select 
                                            value={filterCustomer} 
                                            onChange={setFilterCustomer} 
                                            className="em-filter-select" 
                                            placeholder="Filter by Customer"
                                            showSearch
                                            optionFilterProp="children"
                                        >
                                            <Option value="all">All Customers</Option>
                                            {uniqueCustomers.map(customer => (
                                                <Option key={customer} value={customer}>{customer}</Option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className={filterGroupClass}>
                                        <TagOutlined />
                                        <Select 
                                            value={filterEventType} 
                                            onChange={setFilterEventType} 
                                            className="em-filter-select" 
                                            placeholder="Filter by Event Type"
                                            showSearch
                                            optionFilterProp="children"
                                        >
                                            <Option value="all">All Event Types</Option>
                                            {eventTypes.map(type => (
                                                <Option key={type.value} value={type.value}>{type.label}</Option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className={filterGroupClass}>
                                        <CalendarOutlined />
                                        <DatePicker onChange={setSelectedDate} placeholder="Select Date" format="YYYY-MM-DD" allowClear className="em-date-picker" />
                                    </div>
                                    <div className={`${filterGroupClass} em-search`}>
                                        <SearchOutlined />
                                        <Input 
                                            placeholder="Search by booking ID, customer or event name..." 
                                            value={searchText} 
                                            onChange={(e) => setSearchText(e.target.value)} 
                                            allowClear 
                                            className="em-search-input"
                                        />
                                    </div>
                                </div>

                                <div className="em-table-container">
                                    <Table 
                                        columns={eventColumns} 
                                        dataSource={filteredEvents} 
                                        rowKey="id" 
                                        loading={eventsLoading} 
                                        className={tableClass}
                                        scroll={{ x: 1500 }}
                                        footer={
                                            filteredEvents.length === 0
                                                ? () => renderEmptyPaginationFooter('events')
                                                : undefined
                                        }
                                        pagination={{
                                            current: currentPage,
                                            pageSize: 10,
                                            total: filteredEvents.length,
                                            showSizeChanger: false,
                                            showTotal: (total) => `Total ${total} events`,
                                            itemRender: renderPaginationItem,
                                            onChange: (page) => { setCurrentPage(page); }
                                        }}
                                    />
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== ONGOING EVENTS TAB ==================== */}
                        <TabPane tab={<span><DashboardOutlined /> Ongoing Events</span>} key="ongoing">
                            <div className={tabContentClass}>
                                <Alert 
                                    message="Multi-Day Event Monitoring" 
                                    description="Monitor and manage ongoing multi-day events including seminars, workshops, and conferences." 
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 20 }}
                                    className={alertClass}
                                />
                                <div className="em-table-container">
                                    {ongoingEvents.length === 0 ? (
                                        <Empty description="No ongoing multi-day events at the moment" />
                                    ) : (
                                        <Table 
                                            columns={ongoingEventsColumns} 
                                            dataSource={ongoingEvents} 
                                            rowKey="id" 
                                            className={tableClass}
                                            scroll={{ x: 1100 }}
                                            pagination={{ 
                                                pageSize: 10,
                                                showTotal: (total) => `Total ${total} ongoing events`,
                                                itemRender: renderPaginationItem
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== STAFF TAB - COMPACT ==================== */}
                        <TabPane tab={<span><TeamOutlined /> Staff Management</span>} key="staff">
                            <div className={tabContentClass}>
                                <Alert 
                                    message="Staff Assignment Management" 
                                    description="Assign and manage staff members for each event." 
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 20 }}
                                    className={alertClass}
                                />
                                <div className="em-table-container">
                                    <Table
                                        dataSource={activeEvents}
                                        rowKey="id"
                                        columns={[
                                            { 
                                                title: 'Booking ID', 
                                                dataIndex: 'booking_no', 
                                                width: 110, 
                                                render: (text) => <span className="em-id-text">{text || 'N/A'}</span> 
                                            },
                                            { 
                                                title: 'Customer', 
                                                dataIndex: 'customer_name', 
                                                width: 130, 
                                                render: (text) => <span className="em-customer-name">{text || 'Unknown'}</span> 
                                            },
                                            { 
                                                title: 'Event', 
                                                dataIndex: 'event_name', 
                                                width: 140, 
                                                render: (text) => <Tag color="blue" style={{ maxWidth: 120 }} ellipsis>{text}</Tag> 
                                            },
                                            { 
                                                title: 'Date', 
                                                dataIndex: 'date', 
                                                width: 100 
                                            },
                                            { 
                                                title: 'Staff', 
                                                render: (_, r) => <Badge count={r.assigned_staff?.length || 0} style={{ backgroundColor: '#3b82f6' }} />,
                                                width: 70,
                                                align: 'center'
                                            },
                                            { 
                                                title: 'Action', 
                                                width: 120, 
                                                render: (_, r) => (
                                                    <Button size="small" type="primary" icon={<TeamOutlined />} onClick={() => handleStaffAssignment(r)}>
                                                        Manage
                                                    </Button>
                                                ) 
                                            }
                                        ]}
                                        pagination={{ pageSize: 10, size: 'small' }}
                                        className={tableClass}
                                        size="small"
                                    />
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== EQUIPMENT TAB ==================== */}
                        <TabPane tab={<span><SwapOutlined /> Equipment In/Out</span>} key="equipment">
                            <div className={tabContentClass}>
                                <Alert 
                                    message="Equipment Check-In/Check-Out Tracking per Booking" 
                                    description="View all equipment per booking. Click 'View Equipment' to see detailed equipment items with Approve Out and Return actions." 
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 20 }}
                                    className={alertClass}
                                />
                                
                                <div style={{ marginBottom: 16 }}>
                                    <Button 
                                        type="primary" 
                                        icon={<PlusCircleOutlined />}
                                        onClick={() => {
                                            if (activeEvents.length > 0) {
                                                setSelectedEventForEquipment(activeEvents[0]);
                                                equipmentForm.resetFields();
                                                setEquipmentCheckoutModalVisible(true);
                                            } else {
                                                message.warning('No events available');
                                            }
                                        }}
                                    >
                                        Approve Equipment Out
                                    </Button>
                                    <Button 
                                        style={{ marginLeft: 8 }}
                                        icon={<ReloadOutlined />} 
                                        onClick={() => {
                                            refetchEvents();
                                            // Also reload equipment tracking
                                            const loadEquipmentTracking = async () => {
                                                try {
                                                    const response = await eventAPI.getEvents({ per_page: 100 });
                                                    const eventsData = response.data?.data?.data || response.data?.data || [];
                                                    const trackingData = [];
                                                    eventsData.forEach(event => {
                                                        const equipmentList = event.equipment_in_out || event.equipment || [];
                                                        if (equipmentList.length > 0) {
                                                            equipmentList.forEach(eq => {
                                                                trackingData.push({
                                                                    ...eq,
                                                                    id: eq.id || eq.booking_equipment_id || `eq-${event.booking_id || event.id}-${eq.equipment_id}`,
                                                                    equipment_name: eq.equipment?.name || eq.equipment_name || eq.name || 'Unknown',
                                                                    booking_no: event.booking_no || `BK-${event.id}`,
                                                                    booking_id: event.booking_id || event.id,
                                                                    customer_name: event.customer_name || 'Unknown',
                                                                    event_name: event.event_name || 'Event',
                                                                    event_date: event.date || event.event_date,
                                                                    status: eq.status || 'reserved',
                                                                    checked_out_date: eq.checked_out_date || eq.checkout_date,
                                                                    rental_end_date: eq.rental_end_date || eq.expected_return_date,
                                                                    quantity_reserved: eq.quantity_reserved || eq.quantity || 1,
                                                                    quantity_used: eq.quantity_used || 0,
                                                                    quantity_damaged: eq.quantity_damaged || 0,
                                                                    quantity_missing: eq.quantity_missing || 0,
                                                                    is_out_approved: eq.is_out_approved || false,
                                                                    condition_notes_out: eq.condition_notes_out || '',
                                                                    condition_notes_in: eq.condition_notes_in || '',
                                                                    checked_out_by: eq.checked_out_by || '',
                                                                    returned_by: eq.returned_by || '',
                                                                    return_notes: eq.return_notes || ''
                                                                });
                                                            });
                                                        }
                                                    });
                                                    if (isMounted.current) {
                                                        setEquipmentTrackingData(trackingData);
                                                    }
                                                } catch (error) {
                                                    console.error('Failed to load equipment tracking:', error);
                                                }
                                            };
                                            loadEquipmentTracking();
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </div>
                                
                                <div className="em-table-container">
                                    {equipmentTrackingData.length === 0 ? (
                                        <Empty 
                                            description="No equipment out yet. Use Approve Equipment Out after Delivery Preparation lists the needed equipment."
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        >
                                            <Button 
                                                type="primary" 
                                                icon={<PlusCircleOutlined />}
                                                onClick={() => {
                                                    if (activeEvents.length > 0) {
                                                        setSelectedEventForEquipment(activeEvents[0]);
                                                        equipmentForm.resetFields();
                                                        setEquipmentCheckoutModalVisible(true);
                                                    } else {
                                                        message.warning('No events available');
                                                    }
                                                }}
                                            >
                                                Approve Equipment Out
                                            </Button>
                                        </Empty>
                                    ) : (
                                        <Table
                                            dataSource={getEquipmentByBooking()}
                                            rowKey="booking_no"
                                            columns={equipmentTrackingByBookingColumns}
                                            pagination={{ pageSize: 10, size: 'small' }}
                                            className={tableClass}
                                            size="small"
                                        />
                                    )}
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== CHECKLIST TAB ==================== */}
                        <TabPane tab={<span><CheckCircleOutlined /> Checklists</span>} key="checklist">
                            <div className={tabContentClass}>
                                <Alert 
                                    message="Event Checklist Management" 
                                    description="Track task completion status for each event. Default tasks are auto-populated." 
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 20 }}
                                    className={alertClass}
                                />
                                <div className="em-table-container">
                                    <Table
                                        dataSource={activeEvents}
                                        rowKey="id"
                                        columns={[
                                            { 
                                                title: 'Booking ID', 
                                                dataIndex: 'booking_no', 
                                                width: 110, 
                                                render: (text) => <span className="em-id-text">{text || 'N/A'}</span> 
                                            },
                                            { 
                                                title: 'Customer', 
                                                dataIndex: 'customer_name', 
                                                width: 130, 
                                                render: (text) => <span className="em-customer-name">{text || 'Unknown'}</span> 
                                            },
                                            { 
                                                title: 'Event', 
                                                dataIndex: 'event_name', 
                                                width: 140, 
                                                render: (text) => <Tag color="blue">{text}</Tag> 
                                            },
                                            { 
                                                title: 'Date', 
                                                dataIndex: 'date', 
                                                width: 100 
                                            },
                                            { 
                                                title: 'Progress', 
                                                width: 120, 
                                                render: (_, r) => {
                                                    const completed = r.checklist?.filter(i => i.status === 'completed').length || 0;
                                                    const total = r.checklist?.length || 0;
                                                    const percent = (completed / total) * 100;
                                                    return <Progress percent={Math.round(percent)} size="small" strokeColor="#3b82f6" />
                                                }
                                            },
                                            { 
                                                title: 'Action', 
                                                width: 110, 
                                                render: (_, r) => (
                                                    <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleViewChecklist(r)}>
                                                        View
                                                    </Button>
                                                ) 
                                            }
                                        ]}
                                        pagination={{ pageSize: 10, size: 'small' }}
                                        className={tableClass}
                                        size="small"
                                    />
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== DELIVERY TAB ==================== */}
                        <TabPane tab={<span><TruckOutlined /> Delivery Tracking</span>} key="delivery">
                            <div className={tabContentClass}>
                                <Alert 
                                    message="Delivery Tracking System" 
                                    description="Monitor delivery vehicles and real-time location status" 
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 20 }}
                                    className={alertClass}
                                />
                                <div className="em-table-container">
                                    <Table
                                        dataSource={activeEvents}
                                        rowKey="id"
                                        columns={[
                                            { 
                                                title: 'Booking ID', 
                                                dataIndex: 'booking_no', 
                                                width: 110, 
                                                render: (text) => <span className="em-id-text">{text || 'N/A'}</span> 
                                            },
                                            { 
                                                title: 'Customer', 
                                                dataIndex: 'customer_name', 
                                                width: 130, 
                                                render: (text) => <span className="em-customer-name">{text || 'Unknown'}</span> 
                                            },
                                            { 
                                                title: 'Event', 
                                                dataIndex: 'event_name', 
                                                width: 140, 
                                                render: (text) => <Tag color="blue">{text}</Tag> 
                                            },
                                            { 
                                                title: 'Date', 
                                                dataIndex: 'date', 
                                                width: 100 
                                            },
                                            { 
                                                title: 'Venue', 
                                                dataIndex: 'location', 
                                                width: 150, 
                                                ellipsis: true, 
                                                render: (text) => text || 'N/A' 
                                            },
                                            { 
                                                title: 'Action', 
                                                width: 110, 
                                                render: (_, r) => (
                                                    <Button size="small" type="primary" icon={<TruckOutlined />} onClick={() => handleViewDeliveryTracking(r)}>
                                                        Track
                                                    </Button>
                                                ) 
                                            }
                                        ]}
                                        pagination={{ pageSize: 10, size: 'small' }}
                                        className={tableClass}
                                        size="small"
                                    />
                                </div>
                            </div>
                        </TabPane>
                    </Tabs>
                </Card>

                {/* ============================================================
                    MODALS - Including Enhanced Live Event Monitor
                ============================================================ */}

                {/* ==================== EVENT DETAILS MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><EyeOutlined /></div>
                            <div className="em-modal-title-text">Event Details</div>
                            <div className="em-modal-badge">{selectedEvent?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={eventDetailsModalVisible}
                    onCancel={() => setEventDetailsModalVisible(false)}
                    width={900}
                    className={modalClass}
                    centered={true}
                    footer={
                        <div className="em-modal-footer-simple">
                            <Button type="primary" onClick={() => setEventDetailsModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedEvent && (
                        <div className="em-modal-clean-content">
                            <div className="em-modal-header-tags">
                                <span className="em-id-text">{selectedEvent.booking_no || 'N/A'}</span>
                                <span className="em-status" style={{ color: getStatusConfig(selectedEvent.status).color, background: getStatusConfig(selectedEvent.status).bg }}>
                                    {getStatusConfig(selectedEvent.status).icon} {getStatusConfig(selectedEvent.status).text}
                                </span>
                                {selectedEvent.total_days > 1 && <Tag color="purple">Multi-Day ({selectedEvent.total_days} days)</Tag>}
                            </div>

                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><UserOutlined /> Customer Information</div>
                                <div className="em-clean-grid">
                                    <div><span className="em-clean-label">Name:</span> {selectedEvent.customer_name || 'Unknown'}</div>
                                    <div><span className="em-clean-label">Email:</span> {selectedEvent.customer_email || 'N/A'}</div>
                                    <div><span className="em-clean-label">Phone:</span> {selectedEvent.customer_phone || 'N/A'}</div>
                                </div>
                            </div>

                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><CalendarOutlined /> Event Information</div>
                                <div className="em-clean-grid">
                                    <div><span className="em-clean-label">Event Name:</span> {selectedEvent.event_name || 'N/A'}</div>
                                    <div><span className="em-clean-label">Event Type:</span> {selectedEvent.event_type || 'N/A'}</div>
                                    <div><span className="em-clean-label">Start Date:</span> {selectedEvent.date}</div>
                                    <div><span className="em-clean-label">End Date:</span> {selectedEvent.end_date || selectedEvent.date}</div>
                                    <div><span className="em-clean-label">Time:</span> {selectedEvent.time || 'Not specified'}</div>
                                    <div><span className="em-clean-label">Location:</span> {selectedEvent.location || 'N/A'}</div>
                                    <div><span className="em-clean-label">Guests:</span> {selectedEvent.guests_count || 0} PAX</div>
                                    <div><span className="em-clean-label">Progress:</span> <Progress percent={selectedEvent.progress || 0} size="small" strokeColor="#3b82f6" style={{ width: 120 }} /></div>
                                </div>
                            </div>

                            <Divider />

                            {/* Meal Schedule */}
                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><ScheduleOutlined /> Meal Schedule / Service Schedule</div>
                                {selectedEvent.meal_services?.length > 0 || selectedEvent.meal_schedule?.length > 0 ? (
                                    <Table
                                        dataSource={selectedEvent.meal_services || selectedEvent.meal_schedule || []}
                                        rowKey={(row) => row.meal_service_id || row.id}
                                        pagination={false}
                                        size="small"
                                        className={tableClass}
                                        columns={[
                                            { title: 'Day', dataIndex: 'day_number', width: 70, render: (v) => `Day ${v || 1}` },
                                            { title: 'Date', dataIndex: 'date', width: 110, render: (v, r) => v || r.service_date || 'TBD' },
                                            { title: 'Meal Type', dataIndex: 'meal_type', width: 120 },
                                            { title: 'Serving Time', dataIndex: 'serving_time', width: 110 },
                                            { title: 'Pax', dataIndex: 'pax', width: 70 },
                                            { title: 'Menu', dataIndex: 'menu_name', ellipsis: true, render: (v) => v || 'Custom / TBD' },
                                            { title: 'Amount', dataIndex: 'total_meal_amount', width: 110, render: (v) => `₱${Number(v || 0).toLocaleString()}` },
                                            { title: 'Status', dataIndex: 'meal_status', width: 150, render: (status, row) => (
                                                <Select size="small" value={status || 'pending'} style={{ width: 135 }} onChange={(value) => handleUpdateMealServiceStatus(selectedEvent, row, value)}>
                                                    {MEAL_STATUS_OPTIONS.map(option => (
                                                        <Option key={option} value={option}>{getMealStatusConfig(option).text}</Option>
                                                    ))}
                                                </Select>
                                            )}
                                        ]}
                                    />
                                ) : (
                                    <Empty description="No meal services added" />
                                )}
                            </div>

                            <Divider />

                            {/* Event Timeline */}
                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><FieldTimeOutlined /> Event Timeline</div>
                                {selectedEvent.timeline?.length > 0 ? (
                                    <Timeline
                                        items={selectedEvent.timeline.map((item) => ({
                                            color: getMealStatusConfig(item.status).color === 'success' ? 'green' : getMealStatusConfig(item.status).color === 'error' ? 'red' : 'blue',
                                            children: <span><strong>{item.time || 'TBD'}</strong> — {item.activity} <Tag color={getMealStatusConfig(item.status).color}>{getMealStatusConfig(item.status).text}</Tag></span>
                                        }))}
                                    />
                                ) : (
                                    <Empty description="No event timeline yet" />
                                )}
                            </div>

                            <Divider />

                            {/* Assigned Staff */}
                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><TeamOutlined /> Assigned Staff</div>
                                {selectedEvent.assigned_staff?.length > 0 ? (
                                    <Table 
                                        dataSource={selectedEvent.assigned_staff} 
                                        rowKey="staff_id" 
                                        columns={[
                                            { title: 'Name', dataIndex: 'name' },
                                            { title: 'Role', dataIndex: 'role' },
                                            { title: 'Schedule', dataIndex: 'schedule' },
                                            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'confirmed' ? 'success' : 'warning'}>{s}</Tag> }
                                        ]}
                                        pagination={false} 
                                        size="small" 
                                        className={tableClass}
                                    />
                                ) : (
                                    <Empty description="No staff assigned" />
                                )}
                            </div>

                            <Divider />

                            {/* Equipment In/Out History */}
                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><SwapOutlined /> Equipment In/Out History</div>
                                {selectedEvent.equipment_in_out?.length > 0 ? (
                                    <Table 
                                        dataSource={selectedEvent.equipment_in_out} 
                                        columns={detailedEquipmentColumns}
                                        pagination={false} 
                                        size="small" 
                                        className={tableClass}
                                    />
                                ) : (
                                    <Empty description="No equipment transactions" />
                                )}
                            </div>

                            <Divider />

                            {/* Delivery Tracking */}
                            <div className="em-clean-section">
                                <div className="em-clean-section-title"><TruckOutlined /> Delivery Tracking</div>
                                {selectedEvent.delivery_tracking?.length > 0 ? (
                                    <Table 
                                        dataSource={selectedEvent.delivery_tracking} 
                                        columns={renderDeliveryTrackingColumns(false)}
                                        pagination={false} 
                                        size="small" 
                                        className={tableClass}
                                    />
                                ) : (
                                    <Empty description="No deliveries" />
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* ==================== STAFF ASSIGNMENT MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><TeamOutlined /></div>
                            <div className="em-modal-title-text">Staff Assignment</div>
                            <div className="em-modal-badge">{selectedEventForStaff?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={staffAssignmentModalVisible}
                    onCancel={() => setStaffAssignmentModalVisible(false)}
                    width={800}
                    className={modalClass}
                    footer={
                        <div className="em-modal-footer-simple">
                            <Button onClick={() => setStaffAssignmentModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedEventForStaff && (
                        <div className="em-modal-clean-content">
                            <div className="em-modal-header-tags">
                                <span className="em-id-text">{selectedEventForStaff.booking_no || 'N/A'}</span>
                                <span className="em-customer-name">{selectedEventForStaff.display_name || selectedEventForStaff.event_name}</span>
                                <Tag color="blue">{selectedEventForStaff.date} at {selectedEventForStaff.time}</Tag>
                            </div>

                            <div style={{ marginBottom: 16, textAlign: 'right' }}>
                                <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddStaffModalVisible(true)}>
                                    Assign Staff
                                </Button>
                            </div>

                            <Table
                                dataSource={selectedEventForStaff.assigned_staff || []}
                                rowKey="staff_id"
                                columns={[
                                    { title: 'Name', dataIndex: 'name' },
                                    { title: 'Role', dataIndex: 'role' },
                                    { title: 'Schedule', dataIndex: 'schedule' },
                                    { title: 'Phone', dataIndex: 'phone' },
                                    { 
                                        title: 'Status', 
                                        dataIndex: 'status', 
                                        render: (status, record) => (
                                            <Select value={status} size="small" onChange={(val) => handleUpdateStaffStatus(selectedEventForStaff.id, record.staff_id, val)} style={{ width: 100 }}>
                                                <Option value="pending">Pending</Option>
                                                <Option value="confirmed">Confirmed</Option>
                                                <Option value="declined">Declined</Option>
                                            </Select>
                                        ) 
                                    },
                                    { 
                                        title: 'Action', 
                                        render: (_, record) => (
                                            <Popconfirm title="Remove staff?" onConfirm={() => handleRemoveStaff(selectedEventForStaff.id, record.staff_id)}>
                                                <Button type="text" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        ) 
                                    }
                                ]}
                                pagination={false}
                                size="small"
                                className={tableClass}
                            />
                        </div>
                    )}
                </Modal>

                {/* ==================== ADD STAFF MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><UserAddOutlined /></div>
                            <div className="em-modal-title-text">Assign Staff to Event</div>
                            <div className="em-modal-badge">{selectedEventForStaff?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={addStaffModalVisible}
                    onCancel={() => {
                        setAddStaffModalVisible(false);
                        staffForm.resetFields();
                    }}
                    width={580}
                    className={modalClass}
                    footer={null}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="em-modal-clean-content">
                        <div className="em-modal-event-summary" style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px 16px',
                            padding: '16px',
                            background: isDarkMode ? '#1e293b' : '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid var(--om-border)'
                        }}>
                            <div className="em-summary-row" style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Event</span>
                                <span style={{ fontWeight: 600, color: 'var(--om-text)' }}>{selectedEventForStaff?.display_name || selectedEventForStaff?.event_name || 'N/A'}</span>
                            </div>
                            <div className="em-summary-row" style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Date & Time</span>
                                <span style={{ fontWeight: 600, color: 'var(--om-text)' }}>{selectedEventForStaff?.date} at {selectedEventForStaff?.time || 'TBD'}</span>
                            </div>
                            <div className="em-summary-row" style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Location</span>
                                <span style={{ fontWeight: 600, color: 'var(--om-text)' }}>{selectedEventForStaff?.location || 'TBD'}</span>
                            </div>
                            <div className="em-summary-row" style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Guests</span>
                                <span style={{ fontWeight: 600, color: 'var(--om-text)' }}>{selectedEventForStaff?.guests_count || 0} PAX</span>
                            </div>
                        </div>

                        <Divider style={{ margin: '12px 0 16px 0' }} />

                        <Form 
                            form={staffForm} 
                            layout="vertical" 
                            onFinish={handleAddStaffToEvent}
                            initialValues={{
                                schedule: selectedEventForStaff?.time ? `${selectedEventForStaff.time} - ${dayjs(selectedEventForStaff.time, 'h:mm A').add(8, 'hour').format('h:mm A')}` : '08:00 AM - 05:00 PM',
                                phone: selectedEventForStaff?.customer_phone || '',
                                email: selectedEventForStaff?.customer_email || ''
                            }}
                        >
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item 
                                        name="staff_id" 
                                        label="Select Staff Members" 
                                        rules={[
                                            { required: true, message: 'Please select at least one staff member' },
                                            { 
                                                validator: (_, value) => {
                                                    if (!value || (Array.isArray(value) && value.length === 0)) {
                                                        return Promise.reject(new Error('Please select at least one staff member'));
                                                    }
                                                    return Promise.resolve();
                                                }
                                            }
                                        ]}
                                    >
                                        <div>
                                            <Select 
                                                placeholder="Search and select staff members..." 
                                                showSearch 
                                                mode="multiple"
                                                notFoundContent="No staff available"
                                                maxTagCount={3}
                                                className="em-select-enhanced"
                                                optionFilterProp="children"
                                                onChange={(values) => {
                                                    const selected = values || [];
                                                    staffForm.setFieldsValue({ staff_id: selected });
                                                }}
                                            >
                                                {staffList && staffList.length > 0 ? (
                                                    staffList.map(staff => (
                                                        <Option key={staff.employee_id || staff.id} value={staff.employee_id || staff.id}>
                                                            <div className="em-staff-option" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span className="em-staff-name" style={{ fontWeight: 500 }}>{staff.full_name || staff.name || 'Unknown'}</span>
                                                                <span className="em-staff-position" style={{ fontSize: '12px', color: '#64748b' }}>{staff.position?.title || staff.position || 'Staff'}</span>
                                                            </div>
                                                        </Option>
                                                    ))
                                                ) : (
                                                    <Option value="" disabled>No staff members found</Option>
                                                )}
                                            </Select>
                                            <small className="em-form-hint" style={{ display: 'block', marginTop: '4px', color: '#64748b' }}>
                                                <TeamOutlined style={{ marginRight: '4px' }} /> Select multiple staff members to assign to this event
                                            </small>
                                        </div>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item 
                                        name="role" 
                                        label="Role" 
                                        rules={[{ required: true, message: 'Please enter a role' }]}
                                    >
                                        <Input 
                                            placeholder="e.g., Event Coordinator" 
                                            className="em-input-enhanced"
                                            prefix={<UserOutlined />}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item 
                                        name="start_time" 
                                        label="Start Time" 
                                        rules={[{ required: true, message: 'Please select start time' }]}
                                    >
                                        <TimePicker use12Hours format="h:mm A" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item 
                                        name="end_time" 
                                        label="End Time" 
                                        rules={[{ required: true, message: 'Please select end time' }]}
                                    >
                                        <TimePicker use12Hours format="h:mm A" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="phone" label="Contact Number">
                                        <div>
                                            <Input 
                                                placeholder="Phone number" 
                                                className="em-input-enhanced"
                                                prefix={<PhoneOutlined />}
                                            />
                                            <small className="em-form-hint" style={{ display: 'block', marginTop: '4px', color: '#64748b' }}>
                                                Auto-filled from event contact
                                            </small>
                                        </div>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="email" label="Email Address">
                                        <div>
                                            <Input 
                                                placeholder="Email address" 
                                                className="em-input-enhanced"
                                                prefix={<MailOutlined />}
                                            />
                                            <small className="em-form-hint" style={{ display: 'block', marginTop: '4px', color: '#64748b' }}>
                                                Auto-filled from event contact
                                            </small>
                                        </div>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <div className="em-modal-footer-simple" style={{ padding: '16px 0 0 0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <Button onClick={() => {
                                    setAddStaffModalVisible(false);
                                    staffForm.resetFields();
                                }}>Cancel</Button>
                                <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}>
                                    Assign Staff
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== CHECKLIST MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><CheckCircleOutlined /></div>
                            <div className="em-modal-title-text">Event Checklist</div>
                            <div className="em-modal-badge">{selectedEventForChecklist?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={checklistModalVisible}
                    onCancel={() => setChecklistModalVisible(false)}
                    width={800}
                    className={modalClass}
                    footer={
                        <div className="em-modal-footer-simple">
                            <Button 
                                type="primary" 
                                icon={<PlusOutlined />} 
                                onClick={() => {
                                    const task = prompt('Enter task description:');
                                    const assignedTo = prompt('Assign to:');
                                    if (task) {
                                        handleAddChecklistItem({ task, assigned_to: assignedTo || 'Unassigned' });
                                    }
                                }}
                            >
                                Add Task
                            </Button>
                            <Button onClick={() => setChecklistModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedEventForChecklist && (
                        <div className="em-modal-clean-content">
                            <div className="em-modal-header-tags">
                                <span className="em-id-text">{selectedEventForChecklist.booking_no || 'N/A'}</span>
                                <span className="em-customer-name">{selectedEventForChecklist.display_name || selectedEventForChecklist.event_name}</span>
                                <Tag color="blue">{selectedEventForChecklist.date}</Tag>
                            </div>

                            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Tag color="blue">📋 System Tasks</Tag>
                                <Tag color="green">📦 Delivery Items</Tag>
                                <Tag color="purple">✏️ Custom Tasks</Tag>
                            </div>

                            <List
                                dataSource={checklist}
                                rowKey={(item) => item.id || item.task_key}
                                renderItem={item => (
                                    <List.Item
                                        className="em-checklist-item"
                                        actions={[
                                            <Checkbox
                                                key="completed"
                                                checked={Boolean(item.completed ?? item.status === 'completed')}
                                                disabled={updateChecklistItemMutation.isPending}
                                                onChange={(event) => handleUpdateChecklistItem(item.id, event.target.checked)}
                                            >
                                                Completed
                                            </Checkbox>,
                                            !item.is_delivery && item.source_type !== 'system' && (
                                                <Popconfirm key="delete" title="Delete this item?" onConfirm={() => handleDeleteChecklistItem(selectedEventForChecklist.id, item.id || item.task_key)}>
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
                        </div>
                    )}
                </Modal>

                {/* ==================== DELIVERY TRACKING MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><TruckOutlined /></div>
                            <div className="em-modal-title-text">Delivery Tracking</div>
                            <div className="em-modal-badge">{selectedEventForDelivery?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={deliveryTrackingModalVisible}
                    onCancel={() => setDeliveryTrackingModalVisible(false)}
                    width={900}
                    className={modalClass}
                    footer={
                        <div className="em-modal-footer-simple">
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                addDeliveryForm.resetFields();
                                addDeliveryForm.setFieldsValue({
                                    booking_id: selectedEventForDelivery?.booking_id || selectedEventForDelivery?.id || selectedEventForDelivery?.booking_no,
                                    venue: selectedEventForDelivery?.location || selectedEventForDelivery?.venue || '',
                                    delivery_date: selectedEventForDelivery?.date ? dayjs(selectedEventForDelivery.date) : null,
                                    delivery_time: selectedEventForDelivery?.event_time || ''
                                });
                                setAddDeliveryModalVisible(true);
                            }}>
                                Add Delivery
                            </Button>
                            <Button onClick={() => setDeliveryTrackingModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedEventForDelivery && (
                        <div className="em-modal-clean-content">
                            <div className="em-modal-header-tags">
                                <span className="em-id-text">{selectedEventForDelivery.booking_no || 'N/A'}</span>
                                <span className="em-customer-name">{selectedEventForDelivery.display_name || selectedEventForDelivery.event_name}</span>
                                <Tag color="blue">{selectedEventForDelivery.location || 'Venue TBD'}</Tag>
                            </div>

                            <Table
                                dataSource={deliveryTrackings}
                                rowKey="id"
                                columns={renderDeliveryTrackingColumns(true)}
                                pagination={false}
                                size="small"
                                className={tableClass}
                            />
                        </div>
                    )}
                </Modal>

                {/* ==================== ADD DELIVERY MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><PlusOutlined /></div>
                            <div className="em-modal-title-text">Add New Delivery</div>
                            <div className="em-modal-badge">{selectedEventForDelivery?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={addDeliveryModalVisible}
                    onCancel={() => {
                        setAddDeliveryModalVisible(false);
                        addDeliveryForm.resetFields();
                    }}
                    width={500}
                    className={modalClass}
                    footer={null}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="em-modal-clean-content">
                        <Form form={addDeliveryForm} layout="vertical" onFinish={handleAddDeliverySubmit}>
                            <Form.Item name="booking_id" label="Booking ID" rules={[{ required: true, message: 'Please select a booking' }]}>
                                <Select
                                    showSearch
                                    placeholder="Select Booking ID"
                                    optionFilterProp="children"
                                    onChange={(value) => {
                                        const selectedBooking = activeEvents.find(event => String(event.booking_id || event.id || event.booking_no) === String(value));
                                        if (selectedBooking) {
                                            setSelectedEventForDelivery(selectedBooking);
                                            addDeliveryForm.setFieldsValue({
                                                venue: selectedBooking.location || selectedBooking.venue || '',
                                                delivery_date: selectedBooking.date ? dayjs(selectedBooking.date) : null,
                                                delivery_time: selectedBooking.event_time || ''
                                            });
                                        }
                                    }}
                                >
                                    {activeEvents.map(event => (
                                        <Option key={event.booking_id || event.id || event.booking_no} value={event.booking_id || event.id || event.booking_no}>
                                            {event.booking_no || `Booking #${event.booking_id || event.id}`} - {event.display_name || event.event_name || 'Event'}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
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
                                <TextArea rows={2} placeholder="Food, equipment, buffet setup, utensils, drinks, etc." />
                            </Form.Item>
                            <Form.Item name="notes" label="Delivery Notes">
                                <TextArea rows={2} placeholder="Special delivery instructions" />
                            </Form.Item>
                            <div className="em-modal-footer-simple" style={{ padding: '16px 0 0 0' }}>
                                <Button onClick={() => {
                                    setAddDeliveryModalVisible(false);
                                    addDeliveryForm.resetFields();
                                }}>Cancel</Button>
                                <Button type="primary" htmlType="submit">Add Delivery</Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== EQUIPMENT CHECKOUT MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><PlusCircleOutlined /></div>
                            <div className="em-modal-title-text">Approve Equipment Out</div>
                            <div className="em-modal-badge">{selectedEventForEquipment?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={equipmentCheckoutModalVisible}
                    onCancel={() => setEquipmentCheckoutModalVisible(false)}
                    width={500}
                    className={modalClass}
                    footer={null}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="em-modal-clean-content">
                        <Form form={equipmentForm} layout="vertical" onFinish={handleCheckoutEquipment}>
                            <Form.Item 
                                name="expected_return_date" 
                                label="Expected Return Date" 
                                rules={[{ required: true }]}
                            >
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item name="condition_out" label="Condition (Out)" rules={[{ required: true }]}>
                                <Select placeholder="Select condition">
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
                            <div className="em-modal-footer-simple" style={{ padding: '16px 0 0 0' }}>
                                <Button onClick={() => setEquipmentCheckoutModalVisible(false)}>Cancel</Button>
                                <Button type="primary" htmlType="submit">Approve Equipment Out</Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== EQUIPMENT RETURN MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><SwapOutlined /></div>
                            <div className="em-modal-title-text">Return Equipment</div>
                            <div className="em-modal-badge">{selectedEventForEquipment?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={equipmentReturnModalVisible}
                    onCancel={() => {
                        setEquipmentReturnModalVisible(false);
                        setSelectedEquipmentItem(null);
                        equipmentForm.resetFields();
                    }}
                    width={580}
                    className={modalClass}
                    footer={null}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="em-modal-clean-content">
                        <div className="em-modal-equipment-summary">
                            <div className="em-summary-row">
                                <span className="em-summary-label">Equipment:</span>
                                <span className="em-summary-value"><strong>{selectedEquipmentItem?.equipment?.name || selectedEquipmentItem?.equipment_name || 'N/A'}</strong></span>
                            </div>
                            <div className="em-summary-row">
                                <span className="em-summary-label">Quantity:</span>
                                <span className="em-summary-value">{selectedEquipmentItem?.quantity_reserved || selectedEquipmentItem?.quantity || 0} units</span>
                            </div>
                            <div className="em-summary-row">
                                <span className="em-summary-label">Checkout Date:</span>
                                <span className="em-summary-value">{selectedEquipmentItem?.checked_out_date ? dayjs(selectedEquipmentItem.checked_out_date).format('MMM DD, YYYY') : 'N/A'}</span>
                            </div>
                            <div className="em-summary-row">
                                <span className="em-summary-label">Expected Return:</span>
                                <span className="em-summary-value" style={{ color: selectedEquipmentItem?.rental_end_date && dayjs(selectedEquipmentItem.rental_end_date).isBefore(dayjs()) && selectedEquipmentItem.status !== 'returned' ? '#ef4444' : 'inherit' }}>
                                    {selectedEquipmentItem?.rental_end_date ? dayjs(selectedEquipmentItem.rental_end_date).format('MMM DD, YYYY') : 'N/A'}
                                    {selectedEquipmentItem?.rental_end_date && dayjs(selectedEquipmentItem.rental_end_date).isBefore(dayjs()) && selectedEquipmentItem.status !== 'returned' && (
                                        <Tag color="error" style={{ marginLeft: 8 }}>OVERDUE</Tag>
                                    )}
                                </span>
                            </div>
                        </div>

                        <Divider style={{ margin: '12px 0 16px 0' }} />

                        <Form form={equipmentForm} layout="vertical" onFinish={handleReturnEquipment}>
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item 
                                        name="equipment_name" 
                                        label="Equipment"
                                    >
                                        <Input disabled className="em-input-enhanced" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item 
                                        name="quantity" 
                                        label="Quantity"
                                    >
                                        <InputNumber disabled style={{ width: '100%' }} className="em-input-enhanced" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item 
                                        name="condition_in" 
                                        label="Condition (In)" 
                                        rules={[{ required: true, message: 'Please select condition' }]}
                                    >
                                        <Select placeholder="Select condition" className="em-select-enhanced">
                                            <Option value="Excellent">⭐ Excellent</Option>
                                            <Option value="Good">✅ Good</Option>
                                            <Option value="Fair">⚠️ Fair</Option>
                                            <Option value="Poor">❌ Poor</Option>
                                            <Option value="Damaged">🔧 Damaged</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item name="quantity_used" label="Quantity Used">
                                        <InputNumber min={0} style={{ width: '100%' }} placeholder="0" className="em-input-enhanced" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="quantity_damaged" label="Quantity Damaged">
                                        <InputNumber min={0} style={{ width: '100%' }} placeholder="0" className="em-input-enhanced" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="quantity_missing" label="Quantity Missing">
                                        <InputNumber min={0} style={{ width: '100%' }} placeholder="0" className="em-input-enhanced" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="returned_by" label="Returned By">
                                        <Input placeholder="Name of person returning" className="em-input-enhanced" prefix={<UserOutlined />} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="return_date" label="Return Date">
                                        <DatePicker style={{ width: '100%' }} className="em-input-enhanced" defaultValue={dayjs()} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item name="return_notes" label="Return Notes">
                                        <TextArea rows={3} placeholder="Notes about return condition, issues, or additional information..." className="em-input-enhanced" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <div className="em-modal-footer-simple" style={{ padding: '16px 0 0 0' }}>
                                <Button onClick={() => {
                                    setEquipmentReturnModalVisible(false);
                                    setSelectedEquipmentItem(null);
                                    equipmentForm.resetFields();
                                }}>Cancel</Button>
                                <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>
                                    Confirm Return
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== DETAILED EQUIPMENT TRACKING MODAL ==================== */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><SwapOutlined /></div>
                            <div className="em-modal-title-text">Equipment Details</div>
                            <div className="em-modal-badge">{selectedEventForEquipment?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={equipmentTrackingModalVisible}
                    onCancel={() => {
                        setEquipmentTrackingModalVisible(false);
                        setSelectedEquipmentRowKeys([]);
                    }}
                    width={1100}
                    className={modalClass}
                    footer={
                        <div className="em-modal-footer-simple">
                            <Button type="primary" onClick={() => setEquipmentTrackingModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="em-modal-clean-content">
                        <div className="em-modal-header-tags">
                            <span className="em-id-text">{selectedEventForEquipment?.booking_no || 'N/A'}</span>
                            <span className="em-customer-name">{selectedEventForEquipment?.customer_name || 'Unknown'}</span>
                            <Tag color="blue">{selectedEventForEquipment?.event_name || 'Event'}</Tag>
                            {selectedEventForEquipment?.event_date && <Tag color="green">{selectedEventForEquipment.event_date}</Tag>}
                        </div>

                        <Space wrap style={{ marginBottom: 16 }}>
                            <Button
                                type="primary"
                                icon={<CheckSquareOutlined />}
                                disabled={selectedEquipmentRowKeys.length === 0}
                                onClick={() => {
                                    equipmentForm.setFieldsValue({
                                        expected_return_date: dayjs().add(7, 'days'),
                                        condition_out: 'Good',
                                        checked_out_by: 'Event Management',
                                    });
                                    setEquipmentCheckoutModalVisible(true);
                                }}
                            >
                                Approve Selected ({selectedEquipmentRowKeys.length})
                            </Button>
                            <Button
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleApproveAllEquipment(selectedEventForEquipment)}
                            >
                                Approve All
                            </Button>
                        </Space>

                        <Table
                            dataSource={selectedEquipmentList}
                            rowKey={(record) => record.id || record.booking_equipment_id}
                            rowSelection={{
                                selectedRowKeys: selectedEquipmentRowKeys,
                                onChange: setSelectedEquipmentRowKeys,
                                getCheckboxProps: (record) => ({
                                    disabled: Boolean(record.is_out_approved) || record.status === 'returned' || record.status === 'checked_out',
                                }),
                            }}
                            columns={detailedEquipmentColumns}
                            pagination={{ pageSize: 10, size: 'small' }}
                            className={tableClass}
                            size="small"
                        />
                    </div>
                </Modal>

                {/* ============================================================
                    ==================== ENHANCED LIVE STATUS MODAL ====================
                    FULLY CONNECTED TO BACKEND DATABASE
                ============================================================ */}
                <Modal
                    title={
                        <div className="em-modal-header-clean">
                            <div className="em-modal-title-icon"><DashboardOutlined /></div>
                            <div className="em-modal-title-text">Live Event Monitor</div>
                            <div className="em-modal-badge">{selectedOngoingEvent?.booking_no || 'N/A'}</div>
                        </div>
                    }
                    open={liveStatusModalVisible}
                    onCancel={() => setLiveStatusModalVisible(false)}
                    width={1100}
                    className={modalClass}
                    footer={
                        <div className="em-modal-footer-simple">
                            <Button icon={<ReloadOutlined />} onClick={() => refetchEvents()}>
                                Refresh
                            </Button>
                            <Button type="primary" onClick={() => setLiveStatusModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedOngoingEvent && (
                        <div className="em-modal-clean-content">
                            {/* ==================== EVENT SUMMARY ==================== */}
                            <div className="em-live-event-summary" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px 20px',
                                background: isDarkMode ? '#1e293b' : '#f8fafc',
                                borderRadius: '16px',
                                border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                                marginBottom: 16,
                                flexWrap: 'wrap',
                                gap: 12
                            }}>
                                <div className="em-summary-left" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div className="em-event-title" style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                                        {selectedOngoingEvent.event_name || 'Event'}
                                    </div>
                                    <div className="em-event-meta" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#64748b' }}>
                                        <span><UserOutlined /> {selectedOngoingEvent.customer_name || 'Unknown'}</span>
                                        <span><EnvironmentOutlined /> {selectedOngoingEvent.location || 'TBD'}</span>
                                        <span><CalendarOutlined /> {selectedOngoingEvent.date}</span>
                                    </div>
                                </div>
                                <div className="em-summary-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                    <Tag color="purple">Day {selectedOngoingEvent.current_day || 1} of {selectedOngoingEvent.total_days || 1}</Tag>
                                    <span className="em-status" style={{ color: getStatusConfig(selectedOngoingEvent.status).color, background: getStatusConfig(selectedOngoingEvent.status).bg }}>
                                        {getStatusConfig(selectedOngoingEvent.status).icon} {getStatusConfig(selectedOngoingEvent.status).text}
                                    </span>
                                    <Progress 
                                        type="circle" 
                                        percent={selectedOngoingEvent.progress || 0} 
                                        width={48} 
                                        strokeColor="#3b82f6" 
                                        format={percent => `${percent}%`}
                                    />
                                </div>
                            </div>

                            {/* ==================== SUMMARY CARDS ==================== */}
                            <div className="em-live-summary-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 12,
                                marginBottom: 16
                            }}>
                                <div className="em-summary-card" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px 16px',
                                    background: isDarkMode ? '#1e293b' : '#f8fafc',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`
                                }}>
                                    <div className="em-summary-icon meals" style={{ color: '#3b82f6', fontSize: 20 }}><ScheduleOutlined /></div>
                                    <div className="em-summary-content">
                                        <div className="em-summary-label" style={{ fontSize: 12, color: '#64748b' }}>Meals</div>
                                        <div className="em-summary-value" style={{ fontSize: 16, fontWeight: 600, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                                            {selectedOngoingEvent.meal_services?.filter(m => m.meal_status === 'served' || m.meal_status === 'completed').length || 0} / {selectedOngoingEvent.meal_services?.length || 0} Done
                                        </div>
                                    </div>
                                </div>
                                <div className="em-summary-card" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px 16px',
                                    background: isDarkMode ? '#1e293b' : '#f8fafc',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`
                                }}>
                                    <div className="em-summary-icon staff" style={{ color: '#8b5cf6', fontSize: 20 }}><TeamOutlined /></div>
                                    <div className="em-summary-content">
                                        <div className="em-summary-label" style={{ fontSize: 12, color: '#64748b' }}>Staff Tasks</div>
                                        <div className="em-summary-value" style={{ fontSize: 16, fontWeight: 600, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                                            {selectedOngoingEvent.assigned_staff?.filter(s => s.status === 'confirmed').length || 0} / {selectedOngoingEvent.assigned_staff?.length || 0} Confirmed
                                        </div>
                                    </div>
                                </div>
                                <div className="em-summary-card" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px 16px',
                                    background: isDarkMode ? '#1e293b' : '#f8fafc',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`
                                }}>
                                    <div className="em-summary-icon equipment" style={{ color: '#f59e0b', fontSize: 20 }}><SwapOutlined /></div>
                                    <div className="em-summary-content">
                                        <div className="em-summary-label" style={{ fontSize: 12, color: '#64748b' }}>Equipment</div>
                                        <div className="em-summary-value" style={{ fontSize: 16, fontWeight: 600, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                                            {selectedOngoingEvent.equipment_in_out?.filter(e => e.status === 'returned').length || 0} / {selectedOngoingEvent.equipment_in_out?.length || 0} Returned
                                        </div>
                                    </div>
                                </div>
                                <div className="em-summary-card" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px 16px',
                                    background: isDarkMode ? '#1e293b' : '#f8fafc',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`
                                }}>
                                    <div className="em-summary-icon issues" style={{ color: '#ef4444', fontSize: 20 }}><WarningOutlined /></div>
                                    <div className="em-summary-content">
                                        <div className="em-summary-label" style={{ fontSize: 12, color: '#64748b' }}>Issues</div>
                                        <div className="em-summary-value" style={{ fontSize: 16, fontWeight: 600, color: (selectedOngoingEvent.issues?.length || 0) > 0 ? '#ef4444' : '#10b981' }}>
                                            {selectedOngoingEvent.issues?.length || 0} {selectedOngoingEvent.issues?.length > 0 ? 'Active' : 'None'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ==================== TABS SECTION ==================== */}
                            <Tabs defaultActiveKey="overview" className="em-live-tabs" style={{ marginTop: 8 }}>
                                {/* ==================== OVERVIEW TAB ==================== */}
                                <TabPane tab={<span><DashboardOutlined /> Overview</span>} key="overview">
                                    <div className="em-overview-tab">
                                        <Row gutter={[16, 16]}>
                                            <Col span={12}>
                                                <Card title="📊 Overall Progress" size="small">
                                                    <Progress percent={selectedOngoingEvent.progress || 0} strokeColor="#8b5cf6" />
                                                    <div style={{ marginTop: 12 }}>
                                                        <Text type="secondary">Total Days: {selectedOngoingEvent.total_days || 1}</Text>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col span={12}>
                                                <Card title="👥 Attendance Overview" size="small">
                                                    {[...Array(selectedOngoingEvent.total_days || 1)].map((_, idx) => {
                                                        const dayData = selectedOngoingEvent.daily_progress?.[idx] || {};
                                                        const date = dayjs(selectedOngoingEvent.date).add(idx, 'day');
                                                        const isToday = date.isSame(dayjs(), 'day');
                                                        return (
                                                            <div key={idx} className="em-attendance-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                                <span>Day {idx + 1} {isToday && <Tag color="red">Today</Tag>}</span>
                                                                <span>{dayData.present || 0} / {selectedOngoingEvent.guests_count || 0}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </Card>
                                            </Col>
                                        </Row>
                                    </div>
                                </TabPane>

                                {/* ==================== MEAL SERVICES TAB ==================== */}
                                <TabPane tab={<span><ScheduleOutlined /> Meal Services</span>} key="meals">
                                    <div className="em-live-table-container">
                                        <Table
                                            dataSource={selectedOngoingEvent.meal_services || selectedOngoingEvent.meal_schedule || []}
                                            rowKey={(row) => row.meal_service_id || row.id}
                                            columns={[
                                                { title: 'Day', dataIndex: 'day_number', width: 70, render: (v) => `Day ${v || 1}` },
                                                { title: 'Date', dataIndex: 'date', width: 110, render: (v, r) => v || r.service_date || 'TBD' },
                                                { title: 'Meal', dataIndex: 'meal_type', width: 130, render: (v) => v ? v.replace(/_/g, ' ') : 'N/A' },
                                                { title: 'Serving Time', dataIndex: 'serving_time', width: 110, render: (v) => v || 'TBD' },
                                                { title: 'PAX', dataIndex: 'pax', width: 70 },
                                                { title: 'Menu', dataIndex: 'menu_name', ellipsis: true, render: (v) => v || 'Custom' },
                                                { 
                                                    title: 'Status', 
                                                    dataIndex: 'meal_status', 
                                                    width: 150, 
                                                    render: (status, row) => (
                                                        <Select 
                                                            size="small" 
                                                            value={status || 'pending'} 
                                                            style={{ width: 135 }} 
                                                            onChange={(value) => handleUpdateMealServiceStatus(selectedOngoingEvent, row, value)}
                                                        >
                                                            {MEAL_STATUS_OPTIONS.map(option => (
                                                                <Option key={option} value={option}>{getMealStatusConfig(option).text}</Option>
                                                            ))}
                                                        </Select>
                                                    )
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                            className={tableClass}
                                        />
                                    </div>
                                </TabPane>

                                {/* ==================== STAFF TASKS TAB ==================== */}
                                <TabPane tab={<span><TeamOutlined /> Staff Tasks</span>} key="staff">
                                    <div className="em-live-table-container">
                                        <Table
                                            dataSource={selectedOngoingEvent.assigned_staff || []}
                                            rowKey="staff_id"
                                            columns={[
                                                { title: 'Name', dataIndex: 'name', width: 120 },
                                                { title: 'Role', dataIndex: 'role', width: 120 },
                                                { title: 'Schedule', dataIndex: 'schedule', width: 120 },
                                                { title: 'Phone', dataIndex: 'phone', width: 110 },
                                                { 
                                                    title: 'Status', 
                                                    dataIndex: 'status', 
                                                    width: 110,
                                                    render: (status, record) => (
                                                        <Select 
                                                            value={status} 
                                                            size="small" 
                                                            onChange={(val) => handleUpdateStaffStatus(selectedOngoingEvent.id, record.staff_id, val)} 
                                                            style={{ width: 100 }}
                                                        >
                                                            <Option value="pending">Pending</Option>
                                                            <Option value="confirmed">Confirmed</Option>
                                                            <Option value="declined">Declined</Option>
                                                        </Select>
                                                    ) 
                                                },
                                                { 
                                                    title: 'Action', 
                                                    width: 70,
                                                    render: (_, record) => (
                                                        <Popconfirm title="Remove staff?" onConfirm={() => handleRemoveStaff(selectedOngoingEvent.id, record.staff_id)}>
                                                            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                                        </Popconfirm>
                                                    ) 
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                            className={tableClass}
                                        />
                                    </div>
                                </TabPane>

                                {/* ==================== EQUIPMENT TAB ==================== */}
                                <TabPane tab={<span><SwapOutlined /> Equipment</span>} key="equipment">
                                    <div className="em-live-table-container">
                                        <Table
                                            dataSource={selectedOngoingEvent.equipment_in_out || []}
                                            rowKey="id"
                                            columns={[
                                                { title: 'Name', dataIndex: 'equipment_name', render: (v, r) => v || r.equipment?.name || 'N/A', width: 140 },
                                                { title: 'Qty', dataIndex: 'quantity_reserved', width: 60, align: 'center' },
                                                { title: 'Used', dataIndex: 'quantity_used', width: 60, align: 'center' },
                                                { title: 'Damaged', dataIndex: 'quantity_damaged', width: 70, align: 'center' },
                                                { title: 'Missing', dataIndex: 'quantity_missing', width: 70, align: 'center' },
                                                { 
                                                    title: 'Status', 
                                                    dataIndex: 'status', 
                                                    width: 110,
                                                    render: (status) => {
                                                        const config = getEquipmentStatusConfig(status);
                                                        return <Tag color={config.color}>{config.text}</Tag>;
                                                    }
                                                },
                                                { 
                                                    title: 'Action', 
                                                    width: 90,
                                                    render: (_, record) => {
                                                        if (record.status !== 'returned') {
                                                            return (
                                                                <Button 
                                                                    size="small" 
                                                                    type="primary" 
                                                                    onClick={() => {
                                                                        setSelectedEquipmentItem(record);
                                                                        equipmentForm.setFieldsValue({
                                                                            equipment_name: record.equipment?.name || record.equipment_name,
                                                                            quantity: record.quantity_reserved || 0,
                                                                            condition_in: record.condition_notes_in || '',
                                                                            quantity_used: record.quantity_used || 0,
                                                                            quantity_damaged: record.quantity_damaged || 0,
                                                                            quantity_missing: record.quantity_missing || 0,
                                                                            returned_by: record.returned_by || '',
                                                                            return_notes: record.return_notes || ''
                                                                        });
                                                                        setEquipmentReturnModalVisible(true);
                                                                    }}
                                                                >
                                                                    Return
                                                                </Button>
                                                            );
                                                        }
                                                        return <Tag color="success">Returned</Tag>;
                                                    }
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                            className={tableClass}
                                        />
                                    </div>
                                </TabPane>

                                {/* ==================== PAYMENTS TAB ==================== */}
                                <TabPane tab={<span><DollarOutlined /> Payments</span>} key="payments">
                                    <div className="em-live-payments">
                                        <Card size="small" className="em-payment-summary">
                                            <div className="em-payment-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                                                <div>
                                                    <Text type="secondary">Total Amount</Text>
                                                    <div><Text strong style={{ fontSize: 18, color: '#3b82f6' }}>₱{selectedOngoingEvent.total_amount?.toLocaleString() || '0.00'}</Text></div>
                                                </div>
                                                <div>
                                                    <Text type="secondary">Paid</Text>
                                                    <div><Text strong style={{ fontSize: 18, color: '#10b981' }}>₱{selectedOngoingEvent.paid_amount?.toLocaleString() || '0.00'}</Text></div>
                                                </div>
                                                <div>
                                                    <Text type="secondary">Balance</Text>
                                                    <div><Text strong style={{ fontSize: 18, color: selectedOngoingEvent.balance > 0 ? '#ef4444' : '#10b981' }}>₱{selectedOngoingEvent.balance?.toLocaleString() || '0.00'}</Text></div>
                                                </div>
                                                <div>
                                                    <Text type="secondary">Status</Text>
                                                    <div>
                                                        <Tag color={selectedOngoingEvent.payment_status === 'paid' ? 'success' : 'warning'}>
                                                            {selectedOngoingEvent.payment_status || 'Pending'}
                                                        </Tag>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </TabPane>

                                {/* ==================== ISSUES / NOTES TAB ==================== */}
                                <TabPane tab={<span><WarningOutlined /> Issues / Notes</span>} key="issues">
                                    <div className="em-live-issues">
                                        <div style={{ marginBottom: 16 }}>
                                            <TextArea 
                                                value={selectedOngoingEvent.live_notes || ''} 
                                                onChange={(e) => {
                                                    const updatedEvent = { ...selectedOngoingEvent, live_notes: e.target.value };
                                                    setSelectedOngoingEvent(updatedEvent);
                                                }}
                                                rows={4}
                                                placeholder="Add notes about event progress, issues, or announcements..."
                                            />
                                        </div>
                                        <Card title="Reported Issues" size="small">
                                            {selectedOngoingEvent.issues?.length > 0 ? (
                                                <List
                                                    dataSource={selectedOngoingEvent.issues}
                                                    renderItem={(issue) => (
                                                        <List.Item>
                                                            <div>
                                                                <Text>{issue.message}</Text>
                                                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                                                    <Tag color={issue.severity === 'critical' ? 'red' : 'orange'}>{issue.severity || 'warning'}</Tag>
                                                                    {issue.reported_at}
                                                                </div>
                                                            </div>
                                                        </List.Item>
                                                    )}
                                                />
                                            ) : (
                                                <Empty description="No issues reported" />
                                            )}
                                        </Card>
                                    </div>
                                </TabPane>

                                {/* ==================== COMPLETION REVIEW TAB ==================== */}
                                <TabPane tab={<span><CheckCircleOutlined /> Completion Review</span>} key="completion">
                                    <div className="em-completion-review">
                                        <Alert 
                                            message="Event Completion Checklist" 
                                            description="Ensure all items below are completed before marking this event as done." 
                                            type="info" 
                                            showIcon 
                                            style={{ marginBottom: 16 }}
                                        />
                                        
                                        <Card size="small">
                                            <div className="em-completion-items" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {/* Meals Check */}
                                                <div className="em-completion-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                    <div>
                                                        <CheckCircleOutlined style={{ color: selectedOngoingEvent.meal_services?.every(m => m.meal_status === 'served' || m.meal_status === 'completed') ? '#10b981' : '#f59e0b', marginRight: 8 }} />
                                                        <Text>All Meals Served</Text>
                                                    </div>
                                                    <Tag color={selectedOngoingEvent.meal_services?.every(m => m.meal_status === 'served' || m.meal_status === 'completed') ? 'success' : 'warning'}>
                                                        {selectedOngoingEvent.meal_services?.every(m => m.meal_status === 'served' || m.meal_status === 'completed') ? 'Done' : 'In Progress'}
                                                    </Tag>
                                                </div>

                                                {/* Staff Tasks Check */}
                                                <div className="em-completion-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                    <div>
                                                        <TeamOutlined style={{ color: selectedOngoingEvent.assigned_staff?.every(s => s.status === 'confirmed') ? '#10b981' : '#f59e0b', marginRight: 8 }} />
                                                        <Text>All Staff Tasks Completed</Text>
                                                    </div>
                                                    <Tag color={selectedOngoingEvent.assigned_staff?.every(s => s.status === 'confirmed') ? 'success' : 'warning'}>
                                                        {selectedOngoingEvent.assigned_staff?.every(s => s.status === 'confirmed') ? 'Done' : 'In Progress'}
                                                    </Tag>
                                                </div>

                                                {/* Equipment Check */}
                                                <div className="em-completion-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                    <div>
                                                        <SwapOutlined style={{ color: selectedOngoingEvent.equipment_in_out?.every(e => e.status === 'returned') ? '#10b981' : '#f59e0b', marginRight: 8 }} />
                                                        <Text>All Equipment Returned</Text>
                                                    </div>
                                                    <Tag color={selectedOngoingEvent.equipment_in_out?.every(e => e.status === 'returned') ? 'success' : 'warning'}>
                                                        {selectedOngoingEvent.equipment_in_out?.every(e => e.status === 'returned') ? 'Done' : 'In Progress'}
                                                    </Tag>
                                                </div>

                                                {/* Damages Recorded */}
                                                <div className="em-completion-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                    <div>
                                                        <WarningOutlined style={{ color: selectedOngoingEvent.equipment_in_out?.some(e => e.quantity_damaged > 0) ? '#ef4444' : '#10b981', marginRight: 8 }} />
                                                        <Text>Damages Recorded & Charged</Text>
                                                    </div>
                                                    <Tag color={selectedOngoingEvent.equipment_in_out?.some(e => e.quantity_damaged > 0) ? 'error' : 'success'}>
                                                        {selectedOngoingEvent.equipment_in_out?.some(e => e.quantity_damaged > 0) ? 'Pending' : 'None'}
                                                    </Tag>
                                                </div>

                                                {/* Payment Check */}
                                                <div className="em-completion-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                    <div>
                                                        <DollarOutlined style={{ color: selectedOngoingEvent.payment_status === 'paid' ? '#10b981' : '#f59e0b', marginRight: 8 }} />
                                                        <Text>Full Payment Received</Text>
                                                    </div>
                                                    <Tag color={selectedOngoingEvent.payment_status === 'paid' ? 'success' : 'warning'}>
                                                        {selectedOngoingEvent.payment_status === 'paid' ? 'Paid' : 'Pending'}
                                                    </Tag>
                                                </div>

                                                {/* Issues Resolved */}
                                                <div className="em-completion-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--em-border)' }}>
                                                    <div>
                                                        <CheckCircleOutlined style={{ color: (selectedOngoingEvent.issues?.length || 0) === 0 ? '#10b981' : '#ef4444', marginRight: 8 }} />
                                                        <Text>All Issues Resolved</Text>
                                                    </div>
                                                    <Tag color={(selectedOngoingEvent.issues?.length || 0) === 0 ? 'success' : 'error'}>
                                                        {(selectedOngoingEvent.issues?.length || 0) === 0 ? 'Clear' : `${selectedOngoingEvent.issues?.length || 0} Active`}
                                                    </Tag>
                                                </div>
                                            </div>
                                        </Card>

                                        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                                            <Button 
                                                type="primary" 
                                                size="large"
                                                icon={<FlagOutlined />}
                                                onClick={() => handleCompleteEvent(selectedOngoingEvent)}
                                                disabled={selectedOngoingEvent.status === 'completed'}
                                                style={{ minWidth: 200 }}
                                            >
                                                {selectedOngoingEvent.status === 'completed' ? 'Event Completed' : 'Mark Event as Completed'}
                                            </Button>
                                        </div>
                                    </div>
                                </TabPane>
                            </Tabs>
                        </div>
                    )}
                </Modal>

            </div>
        </ConfigProvider>
    );
};

export default EventManagement;