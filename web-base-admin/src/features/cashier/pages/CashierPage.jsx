// src/features/cashier/pages/CashierPage.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Card,
  Tabs,
  Button,
  Input,
  Select,
  DatePicker,
  Badge,
  message,
  Modal,
  Form,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Space,
  Divider,
  Alert,
  Progress,
  Statistic,
  Row,
  Col,
  App,
  ConfigProvider,
  theme as antdTheme,
  Steps,
  Radio,
  InputNumber,
  List,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  EditOutlined,
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ExportOutlined,
  PrinterOutlined,
  WalletOutlined,
  ScheduleOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  TagOutlined,
  AppstoreOutlined,
  ForkOutlined,
  MenuOutlined,
  MessageOutlined,
  LeftOutlined,
  RightOutlined,
  DeleteOutlined,
  StopOutlined,
  SyncOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

import api from '../../../services/api';
import {
  useBookings,
  useBookingStatistics,
  useEventTypes,
  normalizeListResponse,
} from '../../../hooks/useBookingQuotation';
import { useAuth } from '../../../contexts/AuthContext';

import '../styles/CashierPage.css';
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// ============================================================
// SAFE VALUE HELPERS
// ============================================================
const safeString = (value, defaultValue = '') => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return defaultValue;
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

const getStatusConfig = (status) => {
  const config = {
    pending: { text: 'Pending', color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
    pending_approval: { text: 'Pending Approval', color: '#f97316', background: '#fff7ed', icon: <ClockCircleOutlined /> },
    confirmed: { text: 'Confirmed', color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
    completed: { text: 'Completed', color: '#10b981', background: '#ecfdf5', icon: <CheckCircleOutlined /> },
    rejected: { text: 'Rejected', color: '#ef4444', background: '#fef2f2', icon: <CloseCircleOutlined /> },
    cancelled: { text: 'Cancelled', color: '#ef4444', background: '#fef2f2', icon: <StopOutlined /> },
    rescheduled: { text: 'Rescheduled', color: '#8b5cf6', background: '#f5f3ff', icon: <SyncOutlined /> },
    reschedule_requested: { text: 'Reschedule Requested', color: '#f59e0b', background: '#fffbeb', icon: <SyncOutlined /> },
  };
  return config[status] || config.pending;
};

// ============================================================
// TIME OPTIONS
// ============================================================
const timeOptions = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
  '7:00 PM', '8:00 PM'
];

const mealTypeOptions = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

const serviceTypeOptions = [
  { value: 'buffet', label: 'Buffet Service', description: 'Buffet setup with serving stations' },
  { value: 'packed', label: 'Packed Meals', description: 'Individually packed meals' },
  { value: 'tray', label: 'Tray Service', description: 'Tray service with plated meals' }
];

const eventScopeOptions = [
  { value: 'regular', label: 'Regular (1 Day)', description: 'Single day event' },
  { value: 'multi_day', label: 'Multi-Day Event', description: 'Multiple days' }
];

// ============================================================
// MAIN COMPONENT
// ============================================================
const CashierPage = () => {
  const { message, modal } = App.useApp();
  const { user } = useAuth();
  const isMounted = useRef(true);

  // ==================== STATE ====================
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEventType, setFilterEventType] = useState('all');
  const [filterDate, setFilterDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [createStep, setCreateStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);

  // Form instances
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Create booking state
  const [serviceType, setServiceType] = useState('buffet');
  const [eventScope, setEventScope] = useState('regular');
  const [multiDayDays, setMultiDayDays] = useState(2);
  const [mealServices, setMealServices] = useState([createDefaultMealService()]);
  const [billingAdjustments, setBillingAdjustments] = useState({
    transportation_fee: 0,
    setup_fee: 0,
    service_crew_fee: 0,
    equipment_rental: 0,
    extra_food_fee: 0,
    discount: 0,
    down_payment: 0
  });
  const [menuItemsList, setMenuItemsList] = useState([]);
  const [packagesList, setPackagesList] = useState([]);
  const [promosList, setPromosList] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  // Menu selection modal
  const [menuSelectionModalVisible, setMenuSelectionModalVisible] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState(null);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
  const [menuViewMode, setMenuViewMode] = useState('grid');
  const [menuSelectionMode, setMenuSelectionMode] = useState('menu_items');

  // ==================== HELPER FUNCTIONS ====================
  function createDefaultMealService(overrides = {}) {
    return {
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
    };
  }

  const getEventTypeName = (eventTypeId, eventTypes) => {
    const found = safeArray(eventTypes).find(
      (type) => Number(type.event_type_id || type.id) === Number(eventTypeId)
    );
    return found?.name || 'Unknown';
  };

  const getBookingLocation = (booking) => booking.location || booking.venue || booking.delivery_address || 'N/A';
  const getServiceType = (booking) => booking.service_type || booking.fulfillment_type || booking.delivery_type || 'Catering Service';
  const getBookingId = (booking) => booking.id || booking.booking_id;

  // ==================== THEME DETECTION ====================
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

  // ==================== DATA FETCHING ====================
  const buildBookingParams = useCallback(() => {
    const params = {
      page: currentPage,
      per_page: pageSize,
    };

    if (filterStatus !== 'all') {
      params.status = filterStatus;
    } else {
      params.status_not_in = 'completed,cancelled,rejected';
    }

    if (filterEventType !== 'all') {
      params.event_type_id = filterEventType;
    }

    if (searchText.trim()) {
      params.search = searchText.trim();
    }

    if (filterDate) {
      params.event_date = dayjs(filterDate).format('YYYY-MM-DD');
    }

    return params;
  }, [currentPage, pageSize, filterStatus, filterEventType, searchText, filterDate]);

  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useBookings(buildBookingParams());

  const { data: statistics, refetch: refetchStatistics } = useBookingStatistics();
  const { data: eventTypesData } = useEventTypes();

  const bookingsDataNormalized = normalizeListResponse(bookingsData);
  const bookings = safeArray(bookingsDataNormalized?.data);
  const bookingsTotal = safeNumber(bookingsDataNormalized?.total, bookings.length);
  const bookingsCurrentPage = safeNumber(bookingsDataNormalized?.current_page, 1);
  const bookingsLastPage = safeNumber(bookingsDataNormalized?.last_page, 1);
  const bookingsPerPage = safeNumber(bookingsDataNormalized?.per_page, 10);

  const eventTypes = safeArray(eventTypesData?.data);
  const stats = safeObject(statistics?.data || statistics, {
    total_bookings: 0,
    pending_approvals: 0,
    total_revenue: 0,
    total_paid: 0,
    total_outstanding: 0,
    regular_bookings: 0,
    multi_day_events: 0
  });

  // ==================== REFRESH ====================
  const refreshAllData = useCallback(async (showNotification = true) => {
    try {
      await Promise.all([
        refetchBookings(),
        refetchStatistics(),
      ]);
      if (showNotification) {
        message.success('Data refreshed successfully');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      if (showNotification) {
        message.error('Failed to refresh data');
      }
    }
  }, [refetchBookings, refetchStatistics, message]);

  // ==================== LOAD MENU DATA ====================
  const loadMenuData = useCallback(async () => {
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
    }
  }, []);

  // ==================== CREATE BOOKING FUNCTIONS ====================
  const getBaseEventDate = () => {
    const values = createForm.getFieldsValue();
    return values.event_date || formValues.event_date || null;
  };

  const calculateMealServicesTotal = () => {
    return mealServices.reduce((sum, meal) => sum + (safeNumber(meal.pax) * safeNumber(meal.price_per_head)), 0);
  };

  const calculateBillingAdjustmentsTotal = () => {
    return safeNumber(billingAdjustments.transportation_fee) +
      safeNumber(billingAdjustments.setup_fee) +
      safeNumber(billingAdjustments.service_crew_fee) +
      safeNumber(billingAdjustments.equipment_rental) +
      safeNumber(billingAdjustments.extra_food_fee);
  };

  const calculateTotalAmount = () => {
    const mealTotal = calculateMealServicesTotal();
    let total = mealTotal;
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

  const addMealService = (dayNumber = 1) => {
    const baseDate = getBaseEventDate();
    const computedDate = baseDate ? dayjs(baseDate).add(dayNumber - 1, 'day') : null;
    setMealServices(prev => [
      ...prev,
      createDefaultMealService({
        day_number: dayNumber,
        service_date: computedDate,
        pax: safeNumber(createForm.getFieldValue('guests_count'), 10)
      })
    ]);
  };

  const removeMealService = (mealId) => {
    setMealServices(prev => prev.length <= 1 ? prev : prev.filter(meal => meal.id !== mealId));
  };

  const updateMealService = (mealId, field, value) => {
    setMealServices(prev => prev.map(meal => {
      if (meal.id !== mealId) return meal;
      const next = { ...meal, [field]: value };
      if (['pax', 'price_per_head'].includes(field)) {
        next.total_meal_amount = safeNumber(next.pax) * safeNumber(next.price_per_head);
      }
      return next;
    }));
  };

  const openMenuSelection = (mealId) => {
    setSelectedMealId(mealId);
    setMenuSearchTerm('');
    setMenuCategoryFilter('all');
    setMenuViewMode('grid');
    setMenuSelectionMode('menu_items');
    setMenuSelectionModalVisible(true);
  };

  const setMealCustomItems = (mealId, selectedIds = []) => {
    setMealServices(prev => prev.map(meal => {
      if (meal.id !== mealId) return meal;
      const items = selectedIds.map(id => {
        const source = menuItemsList.find(item => String(item.menu_item_id || item.id) === String(id));
        return source ? {
          menu_item_id: source.menu_item_id || source.id,
          item_name: source.name || 'Menu Item',
          description: source.description || '',
          quantity: 1,
          unit_price: safeNumber(source.price || source.unit_price || 0),
          notes: ''
        } : null;
      }).filter(Boolean);
      const totalPrice = items.reduce((sum, item) => sum + (safeNumber(item.unit_price) * safeNumber(item.quantity)), 0);
      return {
        ...meal,
        custom_items: items,
        menu_name: items.map(i => i.item_name).join(', '),
        price_per_head: totalPrice,
        total_meal_amount: safeNumber(meal.pax) * totalPrice
      };
    }));
  };

  const removeMealCustomItem = (mealId, menuItemId) => {
    setMealServices(prev => prev.map(meal => {
      if (meal.id !== mealId) return meal;
      const nextItems = safeArray(meal.custom_items).filter(item => String(item.menu_item_id) !== String(menuItemId));
      const nextPrice = nextItems.reduce((sum, item) => sum + (safeNumber(item.unit_price) * safeNumber(item.quantity)), 0);
      return {
        ...meal,
        custom_items: nextItems,
        menu_name: nextItems.map(i => i.item_name).join(', '),
        price_per_head: nextPrice,
        total_meal_amount: safeNumber(meal.pax) * nextPrice
      };
    }));
  };

  const generateMealServicesForDays = () => {
    const baseDate = getBaseEventDate();
    const defaultMeals = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
    const pax = safeNumber(createForm.getFieldValue('guests_count'), 10);
    const services = [];
    for (let day = 1; day <= (eventScope === 'multi_day' ? multiDayDays : 1); day += 1) {
      defaultMeals.forEach((mealType) => {
        const serving = mealType === 'Breakfast' ? '7:00 AM' :
          mealType === 'Lunch' ? '12:00 PM' :
            mealType === 'Snacks' ? '3:00 PM' : '6:00 PM';
        services.push(createDefaultMealService({
          day_number: day,
          service_date: baseDate ? dayjs(baseDate).add(day - 1, 'day') : null,
          meal_type: mealType,
          serving_time: serving,
          pax,
        }));
      });
    }
    setMealServices(services);
    message.success('Meal schedule generated successfully');
  };

  // ==================== SAVE BOOKING ====================
  const saveBooking = async (values, isEdit = false) => {
    if (saveLockRef.current || isSaving) {
      console.log('⏳ Save already in progress, skipping...');
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);

    try {
      const allValues = { ...formValues, ...values };

      const formattedMealServices = mealServices
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

      let promoDiscountAmount = 0;
      if (selectedPromo) {
        if (selectedPromo.discount_type === 'percentage') {
          promoDiscountAmount = totalAmount * (safeNumber(selectedPromo.discount_value) / 100);
          totalAmount = totalAmount * (1 - safeNumber(selectedPromo.discount_value) / 100);
        } else {
          promoDiscountAmount = Math.min(totalAmount, safeNumber(selectedPromo.discount_value));
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
        delivery_method: allValues.delivery_method || 'pickup',
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

      const url = isEdit ? `/bookings/${editingBooking.booking_id || editingBooking.id}` : '/bookings';
      const method = isEdit ? 'put' : 'post';

      const response = await api[method](url, bookingData, { timeout: 12000 });
      const responsePayload = response?.data?.data || response?.data || {};
      const bookingNo = responsePayload?.booking_no || 'N/A';

      message.success({
        content: isEdit ? `✅ Booking ${bookingNo} updated successfully!` : `✅ Booking ${bookingNo} created successfully!`,
        duration: 3,
      });

      // Reset state
      createForm.resetFields();
      setSelectedPromo(null);
      setEditingBooking(null);
      setMealServices([createDefaultMealService()]);
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
      setCreateModalVisible(false);
      setEditModalVisible(false);
      setCreateStep(0);

      void refreshAllData(false);

    } catch (error) {
      console.error('❌ Booking error:', error);

      let errorMessage = 'Failed to save booking. Please check the form for errors.';

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = '⏳ The request is taking longer than expected. Please check if the booking was saved and refresh.';
      } else if (error?.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 500) {
          const msg = errorData?.message || '';
          if (msg.includes('Duplicate entry') || msg.includes('1062')) {
            errorMessage = '⚠️ Duplicate booking detected. Please check if this booking already exists.';
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
        errorMessage = 'Cannot reach the API server. Please check your connection.';
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

  // ==================== HANDLE EDIT ====================
  const handleEditBooking = async (booking) => {
    const bookingId = getBookingId(booking);
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const details = response?.data?.data || response?.data || booking;
      setEditingBooking(details);
      setSelectedBooking(details);
      setCreateStep(0);
      setServiceType(details.service_type || 'buffet');
      setEventScope(details.is_multi_day || details.booking_scope === 'multi_day' ? 'multi_day' : 'regular');
      setMultiDayDays(safeNumber(details.days, 1) > 1 ? safeNumber(details.days, 1) : 2);

      const addressLine1 = details.address_line_1 || details.address || '';
      const city = details.city || '';
      const province = details.province || '';
      const postalCode = details.postal_code || '';

      editForm.setFieldsValue({
        customer_name: details.customer_name,
        customer_email: details.customer_email,
        customer_phone: details.customer_phone,
        venue: details.venue,
        event_type_id: details.event_type_id,
        guests_count: details.guests_count,
        event_date: details.event_date ? dayjs(details.event_date) : null,
        event_time: details.event_time,
        delivery_method: details.delivery_method || 'pickup',
        special_requests: details.special_requests,
        address_line_1: addressLine1,
        city: city,
        province: province,
        postal_code: postalCode,
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

      setMealServices(loadedMeals.length ? loadedMeals : [createDefaultMealService()]);
      setEditModalVisible(true);
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to load booking for editing');
    }
  };

  // ==================== EXPORT FUNCTIONS ====================
  const exportToExcel = useCallback(() => {
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

    const exportData = bookings.map(b => ({
      ...b,
      service_type: getServiceType(b),
      event_type: getEventTypeName(b.event_type_id, eventTypes),
      event_date: formatDateSafe(b.event_date),
      total_amount: formatCurrency(b.total_amount),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    XLSX.writeFile(wb, `Cashier_Bookings_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Bookings exported successfully');
  }, [bookings, eventTypes, message]);

  // ==================== VIEW BOOKING DETAILS ====================
  const viewBookingDetails = async (booking) => {
    const bookingId = getBookingId(booking);
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const details = response?.data?.data || response?.data || booking;
      setSelectedBooking(details);
      setViewModalVisible(true);
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to load booking details');
    }
  };

  // ==================== RENDER FUNCTIONS ====================

  // Step 1: Customer & Event Information
  const renderCustomerEventStep = (form) => {
    const safeEventTypes = safeArray(eventTypes);

    return (
      <div className="cashier-step-professional">
        <div className="cashier-step-header-professional">
          <div className="cashier-step-icon-professional">
            <UserOutlined />
          </div>
          <div>
            <h3 className="cashier-step-title-professional">Customer & Event Details</h3>
            <p className="cashier-step-desc-professional">Enter the customer information and event specifics</p>
          </div>
        </div>

        <div className="cashier-step-body-professional">
          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              <UserOutlined /> Customer Information
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="customer_name"
                  label="Full Name"
                  rules={[{ required: true, message: 'Customer name is required' }]}
                >
                  <Input placeholder="Enter full name" size="large" className="cashier-input-professional" />
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
                >
                  <Input placeholder="Enter email address" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="customer_phone"
                  label="Phone Number"
                  rules={[{ required: true, message: 'Phone number is required' }]}
                >
                  <Input placeholder="Enter phone number" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="venue"
                  label="Event Venue"
                  rules={[{ required: true, message: 'Venue is required' }]}
                >
                  <Input placeholder="Enter venue name" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              <EnvironmentOutlined /> Address Details
            </div>
            <Form.Item
              name="address_line_1"
              label="Street Address"
              rules={[{ required: true, message: 'Address is required' }]}
            >
              <Input placeholder="Enter street address" size="large" className="cashier-input-professional" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="city"
                  label="City"
                  rules={[{ required: true, message: 'City is required' }]}
                >
                  <Input placeholder="Enter city" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="province"
                  label="Province"
                  rules={[{ required: true, message: 'Province is required' }]}
                >
                  <Input placeholder="Enter province" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="postal_code" label="Postal Code">
                  <Input placeholder="Enter postal code" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              <CalendarOutlined /> Event Details
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="event_type_id"
                  label="Event Type"
                  rules={[{ required: true, message: 'Event type is required' }]}
                >
                  <Select placeholder="Select event type" size="large" className="cashier-select-professional" showSearch>
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
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter guest count" size="large" className="cashier-input-professional" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="event_date"
                  label="Event Date"
                  rules={[{ required: true, message: 'Event date is required' }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                    format="YYYY-MM-DD"
                    size="large"
                    placeholder="Select event date"
                    className="cashier-datepicker-professional"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="event_time"
                  label="Event Time"
                  rules={[{ required: true, message: 'Event time is required' }]}
                >
                  <Select placeholder="Select event time" size="large" className="cashier-select-professional">
                    {timeOptions.map((time) => (
                      <Option key={time} value={time}>{time}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </div>
        </div>

        <div className="cashier-step-footer-professional">
          <div className="cashier-step-progress-professional">
            <Progress percent={25} showInfo={false} size="small" />
          </div>
          <div className="cashier-step-info-professional">
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
      <div className="cashier-step-professional">
        <div className="cashier-step-header-professional">
          <div className="cashier-step-icon-professional">
            <ScheduleOutlined />
          </div>
          <div>
            <h3 className="cashier-step-title-professional">Service & Scope Configuration</h3>
            <p className="cashier-step-desc-professional">Define how the event will be serviced</p>
          </div>
        </div>

        <div className="cashier-step-body-professional">
          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              Service Type
            </div>
            <Radio.Group
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="cashier-service-radio-professional"
              size="large"
            >
              {serviceTypeOptions.map(option => (
                <Radio.Button key={option.value} value={option.value} className="cashier-service-option-professional">
                  <div className="cashier-service-option-content">
                    <div className="cashier-service-option-text">
                      <div className="cashier-service-option-label">{option.label}</div>
                      <div className="cashier-service-option-desc">{option.description}</div>
                    </div>
                  </div>
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              Event Scope
            </div>
            <Radio.Group
              value={eventScope}
              onChange={(e) => setEventScope(e.target.value)}
              className="cashier-scope-radio-professional"
              size="large"
            >
              {eventScopeOptions.map(option => (
                <Radio.Button key={option.value} value={option.value} className="cashier-scope-option-professional">
                  <div className="cashier-scope-option-content">
                    <div className="cashier-scope-option-text">
                      <div className="cashier-scope-option-label">{option.label}</div>
                      <div className="cashier-scope-option-desc">{option.description}</div>
                    </div>
                  </div>
                </Radio.Button>
              ))}
            </Radio.Group>

            {eventScope === 'multi_day' && (
              <div className="cashier-multi-day-config-professional">
                <div className="cashier-multi-day-label">Number of Days</div>
                <Space size="middle" align="center">
                  <InputNumber
                    min={2}
                    max={30}
                    value={multiDayDays}
                    onChange={(value) => setMultiDayDays(value || 2)}
                    size="large"
                    className="cashier-multi-day-input"
                  />
                  <span className="cashier-multi-day-text">days</span>
                  <Tag color="blue" className="cashier-multi-day-badge">{multiDayDays} days total</Tag>
                </Space>
              </div>
            )}
          </div>

          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              Meal Services
            </div>
            <div className="cashier-meal-toolbar-professional">
              <Button
                size="large"
                icon={<ScheduleOutlined />}
                onClick={generateMealServicesForDays}
                className="cashier-toolbar-btn"
              >
                Generate Schedule
              </Button>
              <Button
                size="large"
                type="primary"
                ghost
                icon={<PlusOutlined />}
                onClick={() => addMealService(eventScope === 'multi_day' ? multiDayDays : 1)}
                className="cashier-toolbar-btn"
              >
                Add Meal
              </Button>
            </div>

            <div className="cashier-meal-list-professional">
              {mealServices.map((meal, index) => (
                <Card key={meal.id} className="cashier-meal-card-professional"
                  title={
                    <div className="cashier-meal-card-title">
                      <span className="cashier-meal-number">Meal #{index + 1}</span>
                      <Tag color="blue" className="cashier-meal-day-tag">Day {meal.day_number}</Tag>
                    </div>
                  }
                  extra={
                    mealServices.length > 1 && (
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
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Meal Type</span>
                        <Select
                          value={meal.meal_type}
                          onChange={(value) => updateMealService(meal.id, 'meal_type', value)}
                          size="middle"
                          style={{ width: '100%' }}
                        >
                          {mealTypeOptions.map(type => <Option key={type} value={type}>{type}</Option>)}
                        </Select>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Serving Time</span>
                        <Select
                          value={meal.serving_time}
                          onChange={(value) => updateMealService(meal.id, 'serving_time', value)}
                          size="middle"
                          style={{ width: '100%' }}
                        >
                          {timeOptions.map(time => <Option key={time} value={time}>{time}</Option>)}
                        </Select>
                      </div>
                    </Col>
                    <Col span={4}>
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Pax</span>
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
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Menu Selection</span>
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
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Price per Head</span>
                        <InputNumber
                          min={0}
                          value={meal.price_per_head}
                          formatter={value => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value?.replace(/₱\s?|(,*)/g, '')}
                          onChange={(value) => {
                            const newPrice = value || 0;
                            updateMealService(meal.id, 'price_per_head', newPrice);
                          }}
                          size="middle"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </Col>
                    <Col span={4}>
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Total</span>
                        <div className="cashier-meal-total-professional">
                          {formatCurrency(safeNumber(meal.pax) * safeNumber(meal.price_per_head))}
                        </div>
                      </div>
                    </Col>
                    <Col span={14}>
                      <div className="cashier-meal-field">
                        <span className="cashier-meal-label">Notes</span>
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
                    <div className="cashier-meal-selected-items">
                      <div className="cashier-selected-items-label">Selected Items:</div>
                      <div className="cashier-selected-items-list">
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

            <div className="cashier-meal-summary-professional">
              <Alert
                type="info"
                showIcon
                message={
                  <div className="cashier-meal-summary-content">
                    <span>Meal Services Total:</span>
                    <strong>{formatCurrency(calculateMealServicesTotal())}</strong>
                  </div>
                }
                className="cashier-meal-summary-alert"
              />
            </div>
          </div>

          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              Delivery Method
            </div>
            <Form.Item name="delivery_method" initialValue="pickup" style={{ maxWidth: 300 }}>
              <Select placeholder="Select delivery method" size="large" className="cashier-select-professional">
                <Option value="pickup">Pickup</Option>
                <Option value="delivery">Delivery</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
              Special Requests
            </div>
            <Form.Item name="special_requests">
              <TextArea
                rows={3}
                placeholder="Any special requests, dietary restrictions, or additional notes..."
                className="cashier-textarea-professional"
                maxLength={500}
                showCount
              />
            </Form.Item>
          </div>
        </div>

        <div className="cashier-step-footer-professional">
          <div className="cashier-step-progress-professional">
            <Progress percent={50} showInfo={false} size="small" strokeColor="#8b5cf6" />
          </div>
          <div className="cashier-step-info-professional">
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
      <div className="cashier-step-professional">
        <div className="cashier-step-header-professional cashier-step-header-success">
          <div className="cashier-step-icon-professional cashier-step-icon-success">
            <WalletOutlined />
          </div>
          <div>
            <h3 className="cashier-step-title-professional">Payment & Additional Charges</h3>
            <p className="cashier-step-desc-professional">Review and configure payment details</p>
          </div>
        </div>

        <div className="cashier-step-body-professional">
          <div className="cashier-form-section-professional">
            <div className="cashier-section-label-professional">
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
                  <div className="cashier-additional-field">
                    <span className="cashier-additional-label">{label}</span>
                    <InputNumber
                      min={0}
                      value={billingAdjustments[key]}
                      formatter={value => `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value?.replace(/₱\s?|(,*)/g, '')}
                      onChange={(value) => setBillingAdjustments(prev => ({ ...prev, [key]: value || 0 }))}
                      size="middle"
                      style={{ width: '100%' }}
                      className={key === 'discount' ? 'cashier-discount-input' : ''}
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </div>

          <div className="cashier-summary-cards-professional">
            <Row gutter={16}>
              <Col span={8}>
                <Card className="cashier-summary-card-professional">
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
                <Card className="cashier-summary-card-professional">
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
                <Card className="cashier-summary-card-professional cashier-summary-card-total">
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
              className="cashier-balance-alert"
            />
          </div>
        </div>

        <div className="cashier-step-footer-professional">
          <div className="cashier-step-progress-professional">
            <Progress percent={75} showInfo={false} size="small" strokeColor="#f59e0b" />
          </div>
          <div className="cashier-step-info-professional">
            <span>Step 3 of 4</span>
            <span>Payment Details</span>
          </div>
        </div>
      </div>
    );
  };

  // Step 4: Review & Confirm
  const renderReviewStep = () => {
    const currentValues = createForm.getFieldsValue();
    const allValues = { ...formValues, ...currentValues };

    const eventDate = allValues.event_date ? formatDateSafe(allValues.event_date) : 'N/A';
    const endDate = eventScope === 'multi_day' && allValues.event_date
      ? formatDateSafe(dayjs(allValues.event_date).add(multiDayDays - 1, 'days'))
      : eventDate;

    const mealServicesTotal = calculateMealServicesTotal();
    const adjustmentTotal = calculateBillingAdjustmentsTotal();
    let discount = 0;
    if (selectedPromo) {
      discount = selectedPromo.discount_type === 'percentage'
        ? mealServicesTotal * (selectedPromo.discount_value / 100)
        : selectedPromo.discount_value;
    }
    const total = Math.max(0, mealServicesTotal + adjustmentTotal - safeNumber(billingAdjustments.discount) - discount);

    return (
      <div className="cashier-step-professional">
        <div className="cashier-step-header-professional cashier-step-header-success">
          <div className="cashier-step-icon-professional cashier-step-icon-success">
            <CheckCircleOutlined />
          </div>
          <div>
            <h3 className="cashier-step-title-professional">Review & Confirm</h3>
            <p className="cashier-step-desc-professional">Review all details before creating the booking</p>
          </div>
        </div>

        <div className="cashier-step-body-professional">
          <div className="cashier-review-grid-professional">
            <div className="cashier-review-card-professional">
              <div className="cashier-review-card-header">
                <UserOutlined /> Customer
              </div>
              <div className="cashier-review-card-body">
                <div className="cashier-review-item">
                  <span>Name</span>
                  <span className="cashier-review-value">{allValues.customer_name || 'Not provided'}</span>
                </div>
                <div className="cashier-review-item">
                  <span>Email</span>
                  <span className="cashier-review-value">{allValues.customer_email || 'Not provided'}</span>
                </div>
                <div className="cashier-review-item">
                  <span>Phone</span>
                  <span className="cashier-review-value">{allValues.customer_phone || 'N/A'}</span>
                </div>
                <div className="cashier-review-item">
                  <span>Venue</span>
                  <span className="cashier-review-value">{allValues.venue || 'Not provided'}</span>
                </div>
              </div>
            </div>

            <div className="cashier-review-card-professional">
              <div className="cashier-review-card-header">
                <CalendarOutlined /> Event
              </div>
              <div className="cashier-review-card-body">
                <div className="cashier-review-item">
                  <span>Type</span>
                  <span className="cashier-review-value"><Tag color="blue">{getEventTypeName(allValues.event_type_id, eventTypes)}</Tag></span>
                </div>
                <div className="cashier-review-item">
                  <span>Date</span>
                  <span className="cashier-review-value">{eventDate}{eventScope === 'multi_day' && ` → ${endDate}`}</span>
                </div>
                <div className="cashier-review-item">
                  <span>Time</span>
                  <span className="cashier-review-value">{allValues.event_time || 'Not provided'}</span>
                </div>
                <div className="cashier-review-item">
                  <span>Guests</span>
                  <span className="cashier-review-value"><TeamOutlined /> {safeNumber(allValues.guests_count, 0)} PAX</span>
                </div>
              </div>
            </div>

            <div className="cashier-review-card-professional cashier-review-full-width">
              <div className="cashier-review-card-header">
                <ForkOutlined /> Meal Services
                <span className="cashier-review-badge">{mealServices.length}</span>
              </div>
              <div className="cashier-review-card-body">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={mealServices.slice(0, 4)}
                  className="cashier-review-table"
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

            <div className="cashier-review-card-professional cashier-review-full-width">
              <div className="cashier-review-card-header">
                <DollarOutlined /> Financial Summary
              </div>
              <div className="cashier-review-card-body">
                <div className="cashier-review-total-row">
                  <span>Subtotal</span>
                  <span>{formatCurrency(mealServicesTotal)}</span>
                </div>
                {selectedPromo && (
                  <div className="cashier-review-total-row cashier-review-discount">
                    <span>Promo ({selectedPromo.code})</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {adjustmentTotal > 0 && (
                  <div className="cashier-review-total-row">
                    <span>Additional Charges</span>
                    <span>{formatCurrency(adjustmentTotal)}</span>
                  </div>
                )}
                {safeNumber(billingAdjustments.discount) > 0 && (
                  <div className="cashier-review-total-row cashier-review-discount">
                    <span>Manual Discount</span>
                    <span>-{formatCurrency(billingAdjustments.discount)}</span>
                  </div>
                )}
                <div className="cashier-review-divider" />
                <div className="cashier-review-total-row cashier-review-grand-total">
                  <span><strong>Total</strong></span>
                  <span><strong>{formatCurrency(total)}</strong></span>
                </div>
                {safeNumber(billingAdjustments.down_payment) > 0 && (
                  <div className="cashier-review-total-row">
                    <span>Balance</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(Math.max(0, total - safeNumber(billingAdjustments.down_payment)))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="cashier-step-footer-professional">
          <div className="cashier-step-progress-professional">
            <Progress percent={100} showInfo={false} size="small" strokeColor="#10b981" />
          </div>
          <div className="cashier-step-info-professional">
            <span>Step 4 of 4</span>
            <span>Review & Confirm</span>
          </div>
        </div>
      </div>
    );
  };

  // ==================== RENDER MENU SELECTION MODAL ====================
  const renderMenuSelectionModal = () => {
    const meal = mealServices.find(m => m.id === selectedMealId);
    const selectedIds = meal?.custom_items?.map(item => String(item.menu_item_id || item.id)) || [];

    return (
      <Modal
        title={
          <div className="cashier-menu-modal-header">
            <div className="cashier-menu-modal-title">
              <MenuOutlined /> Select Menu Items
            </div>
            <div className="cashier-menu-modal-subtitle">
              {meal && `Day ${meal.day_number} - ${meal.meal_type}`}
            </div>
          </div>
        }
        open={menuSelectionModalVisible}
        onCancel={() => setMenuSelectionModalVisible(false)}
        width={950}
        className="cashier-menu-modal"
        destroyOnHidden={true}
        footer={
          <div className="cashier-menu-modal-footer">
            <div className="cashier-menu-modal-selected-count">
              {selectedIds.length} items selected
            </div>
            <Space>
              <Button onClick={() => setMenuSelectionModalVisible(false)}>Cancel</Button>
              <Button type="primary" onClick={() => {
                setMealCustomItems(selectedMealId, selectedIds);
                setMenuSelectionModalVisible(false);
                setSelectedMealId(null);
              }} icon={<CheckCircleOutlined />}>
                Confirm Selection
              </Button>
            </Space>
          </div>
        }
      >
        <div className="cashier-menu-modal-body">
          <div className="cashier-menu-toolbar">
            <Input
              placeholder="Search menu items..."
              prefix={<SearchOutlined />}
              value={menuSearchTerm}
              onChange={(e) => setMenuSearchTerm(e.target.value)}
              size="middle"
              className="cashier-menu-search"
              allowClear
            />
            <Radio.Group
              value={menuViewMode}
              onChange={(e) => setMenuViewMode(e.target.value)}
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="grid"><AppstoreOutlined /> Grid</Radio.Button>
              <Radio.Button value="list"><MenuOutlined /> List</Radio.Button>
            </Radio.Group>
          </div>

          <div className="cashier-menu-items-container">
            {menuItemsList.length === 0 ? (
              <Empty description="No menu items found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : menuViewMode === 'grid' ? (
              <div className="cashier-menu-grid">
                {menuItemsList.filter(item => {
                  const name = item.name || '';
                  return name.toLowerCase().includes(menuSearchTerm.toLowerCase());
                }).map(item => {
                  const isSelected = selectedIds.includes(String(item.menu_item_id || item.id));
                  return (
                    <div
                      key={item.menu_item_id || item.id}
                      className={`cashier-menu-grid-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          const newIds = selectedIds.filter(id => id !== String(item.menu_item_id || item.id));
                          setMealCustomItems(selectedMealId, newIds);
                        } else {
                          setMealCustomItems(selectedMealId, [...selectedIds, String(item.menu_item_id || item.id)]);
                        }
                      }}
                    >
                      <div className="cashier-menu-item-check">
                        {isSelected ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <PlusOutlined />}
                      </div>
                      <div className="cashier-menu-item-info">
                        <div className="cashier-menu-item-name">{item.name}</div>
                        <div className="cashier-menu-item-price">{formatCurrency(item.price)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <List
                className="cashier-menu-list"
                dataSource={menuItemsList.filter(item => {
                  const name = item.name || '';
                  return name.toLowerCase().includes(menuSearchTerm.toLowerCase());
                })}
                renderItem={item => {
                  const isSelected = selectedIds.includes(String(item.menu_item_id || item.id));
                  return (
                    <List.Item
                      className={`cashier-menu-list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          const newIds = selectedIds.filter(id => id !== String(item.menu_item_id || item.id));
                          setMealCustomItems(selectedMealId, newIds);
                        } else {
                          setMealCustomItems(selectedMealId, [...selectedIds, String(item.menu_item_id || item.id)]);
                        }
                      }}
                    >
                      <div className="cashier-menu-list-item-content">
                        <div className="cashier-menu-list-item-check">
                          {isSelected ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <PlusOutlined />}
                        </div>
                        <div className="cashier-menu-list-item-info">
                          <div className="cashier-menu-list-item-name">{item.name}</div>
                          <div className="cashier-menu-list-item-meta">
                            <span className="cashier-menu-list-item-price">{formatCurrency(item.price)}</span>
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </div>
      </Modal>
    );
  };

  // ==================== VIEW DETAILS MODAL ====================
  const renderViewDetailsModal = () => {
    if (!selectedBooking) return null;

    const statusConfig = getStatusConfig(selectedBooking.booking_status);

    return (
      <Modal
        title={
          <div className="cashier-modal-header-clean">
            <div className="cashier-modal-title-icon"><EyeOutlined /></div>
            <div className="cashier-modal-title-text">Booking Details</div>
            <div className="cashier-modal-badge">{safeString(selectedBooking.booking_no)}</div>
          </div>
        }
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        maskClosable={false}
        width={700}
        className="cashier-modal-clean"
        footer={
          <div className="cashier-modal-buttons-clean">
            <Button onClick={() => setViewModalVisible(false)}>Close</Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setViewModalVisible(false);
                handleEditBooking(selectedBooking);
              }}
            >
              Edit Booking
            </Button>
          </div>
        }
      >
        <div className="cashier-modal-clean-content">
          <div className="cashier-details-grid">
            <div className="cashier-details-section">
              <div className="cashier-details-header">
                <UserOutlined /> Customer Information
              </div>
              <div className="cashier-details-row">
                <span>Name</span>
                <span>{safeString(selectedBooking.customer_name)}</span>
              </div>
              <div className="cashier-details-row">
                <span>Email</span>
                <span>{safeString(selectedBooking.customer_email)}</span>
              </div>
              <div className="cashier-details-row">
                <span>Phone</span>
                <span>{safeString(selectedBooking.customer_phone, 'N/A')}</span>
              </div>
            </div>

            <div className="cashier-details-section">
              <div className="cashier-details-header">
                <CalendarOutlined /> Event Information
              </div>
              <div className="cashier-details-row">
                <span>Type</span>
                <span><Tag color="blue">{getEventTypeName(selectedBooking.event_type_id, eventTypes)}</Tag></span>
              </div>
              <div className="cashier-details-row">
                <span>Date</span>
                <span>{formatDateSafe(selectedBooking.event_date)}</span>
              </div>
              <div className="cashier-details-row">
                <span>Time</span>
                <span>{selectedBooking.event_time || 'N/A'}</span>
              </div>
              <div className="cashier-details-row">
                <span>Venue</span>
                <span>{getBookingLocation(selectedBooking)}</span>
              </div>
              <div className="cashier-details-row">
                <span>Guests</span>
                <span><TeamOutlined /> {safeNumber(selectedBooking.guests_count)} PAX</span>
              </div>
            </div>

            <div className="cashier-details-section cashier-details-full">
              <div className="cashier-details-header">
                <DollarOutlined /> Financial Summary
              </div>
              <div className="cashier-details-row">
                <span>Total Amount</span>
                <span><strong>{formatCurrency(selectedBooking.total_amount)}</strong></span>
              </div>
              <div className="cashier-details-row">
                <span>Status</span>
                <span>
                  <span className="cashier-status" style={{ color: statusConfig.color, background: statusConfig.background }}>
                    {statusConfig.icon} {statusConfig.text}
                  </span>
                </span>
              </div>
            </div>

            {selectedBooking.special_requests && (
              <div className="cashier-details-section cashier-details-full">
                <div className="cashier-details-header">
                  <MessageOutlined /> Special Requests
                </div>
                <div className="cashier-details-row">
                  <span>{safeString(selectedBooking.special_requests)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  };

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'BOOKING #',
      dataIndex: 'booking_no',
      key: 'booking_no',
      width: 140,
      fixed: 'left',
      render: (value) => <span className="cashier-id-text">{safeString(value)}</span>
    },
    {
      title: 'CUSTOMER',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 200,
      render: (value, record) => (
        <div className="cashier-customer-cell">
          <div className="cashier-customer-name">{safeString(value)}</div>
          <div className="cashier-customer-contact"><MailOutlined /> {safeString(record.customer_email, 'No email')}</div>
        </div>
      )
    },
    {
      title: 'EVENT DATE',
      dataIndex: 'event_date',
      key: 'event_date',
      width: 130,
      render: (value) => formatDateSafe(value)
    },
    {
      title: 'VENUE',
      dataIndex: 'venue',
      key: 'venue',
      width: 180,
      ellipsis: true,
      render: (value) => <span><EnvironmentOutlined /> {safeString(value, 'N/A')}</span>
    },
    {
      title: 'PAX',
      dataIndex: 'guests_count',
      key: 'guests_count',
      width: 80,
      align: 'center',
      render: (value) => <span className="cashier-pax-number"><TeamOutlined /> {safeNumber(value)}</span>
    },
    {
      title: 'AMOUNT',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 140,
      align: 'right',
      render: (value) => <span className="cashier-amount">{formatCurrency(value)}</span>
    },
    {
      title: 'STATUS',
      dataIndex: 'booking_status',
      key: 'booking_status',
      width: 150,
      render: (value) => {
        const config = getStatusConfig(value);
        return (
          <span className="cashier-status" style={{ color: config.color, background: config.background }}>
            {config.icon} {config.text}
          </span>
        );
      }
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <div className="cashier-action-group">
          <Tooltip title="View details">
            <button className="cashier-action-icon view" onClick={() => viewBookingDetails(record)}>
              <EyeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Edit booking">
            <button className="cashier-action-icon edit" onClick={() => handleEditBooking(record)}>
              <EditOutlined />
            </button>
          </Tooltip>
        </div>
      )
    }
  ];

  // ==================== PAGINATION ITEM RENDER ====================
  const renderPaginationItem = (_, type, originalElement) => {
    if (type === 'prev') {
      return (
        <Button className="cashier-pagination-navigation-button" size="small" icon={<LeftOutlined />}>
          Previous
        </Button>
      );
    }
    if (type === 'next') {
      return (
        <Button className="cashier-pagination-navigation-button" size="small">
          Next <RightOutlined />
        </Button>
      );
    }
    return originalElement;
  };

  // ==================== MAIN RENDER ====================
  return (
    <App>
      <ConfigProvider theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
        <div className={`cashier-container ${isDarkMode ? 'cashier-dark-mode' : ''}`}>
          {/* Header */}
          <div className="cashier-header">
            <div className="cashier-header-left">
              <div className="cashier-logo-icon">
                <WalletOutlined />
              </div>
              <div className="cashier-header-info">
                <h1>Cashier Dashboard</h1>
                <span>BOOKING MANAGEMENT</span>
              </div>
            </div>
            <div className="cashier-header-right">
              <div className="cashier-date-display">
                <CalendarOutlined />
                <span>{dayjs().format('dddd, MMMM DD, YYYY')}</span>
              </div>
              <Divider type="vertical" />
              <Button icon={<ReloadOutlined />} onClick={() => refreshAllData(true)}>
                Refresh
              </Button>
              <Button icon={<ExportOutlined />} onClick={exportToExcel}>
                Export
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setCreateStep(0);
                  setServiceType('buffet');
                  setEventScope('regular');
                  setMultiDayDays(2);
                  setMealServices([createDefaultMealService()]);
                  setBillingAdjustments({
                    transportation_fee: 0,
                    setup_fee: 0,
                    service_crew_fee: 0,
                    equipment_rental: 0,
                    extra_food_fee: 0,
                    discount: 0,
                    down_payment: 0
                  });
                  setSelectedPromo(null);
                  setEditingBooking(null);
                  createForm.resetFields();
                  setCreateModalVisible(true);
                  loadMenuData();
                }}
              >
                Create Booking
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="cashier-kpi-grid">
            <div className="cashier-kpi-card">
              <div className="cashier-kpi-icon blue"><CalendarOutlined /></div>
              <div className="cashier-kpi-stats">
                <div className="cashier-kpi-value">{safeNumber(stats.total_bookings)}</div>
                <div className="cashier-kpi-label">Total Bookings</div>
              </div>
            </div>
            <div className="cashier-kpi-card">
              <div className="cashier-kpi-icon orange"><ClockCircleOutlined /></div>
              <div className="cashier-kpi-stats">
                <div className="cashier-kpi-value">{safeNumber(stats.pending_approvals)}</div>
                <div className="cashier-kpi-label">Pending Approvals</div>
              </div>
            </div>
            <div className="cashier-kpi-card">
              <div className="cashier-kpi-icon green"><DollarOutlined /></div>
              <div className="cashier-kpi-stats">
                <div className="cashier-kpi-value">{formatCurrency(stats.total_revenue)}</div>
                <div className="cashier-kpi-label">Total Revenue</div>
              </div>
            </div>
            <div className="cashier-kpi-card">
              <div className="cashier-kpi-icon red"><WalletOutlined /></div>
              <div className="cashier-kpi-stats">
                <div className="cashier-kpi-value">{formatCurrency(stats.total_outstanding)}</div>
                <div className="cashier-kpi-label">Outstanding Balance</div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <Card className="cashier-main-card" variant="borderless">
            {/* Filters */}
            <div className="cashier-filters">
              <div className="cashier-filter-group">
                <SearchOutlined />
                <Input
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search booking or customer..."
                  allowClear
                  className="cashier-search-input"
                />
              </div>
              <div className="cashier-filter-group">
                <FilterOutlined />
                <Select
                  value={filterStatus}
                  onChange={(value) => {
                    setFilterStatus(value);
                    setCurrentPage(1);
                  }}
                  className="cashier-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Statuses</Option>
                  <Option value="pending_approval">Pending Approval</Option>
                  <Option value="confirmed">Confirmed</Option>
                  <Option value="rescheduled">Rescheduled</Option>
                  <Option value="reschedule_requested">Reschedule Requested</Option>
                </Select>
              </div>
              <div className="cashier-filter-group">
                <CalendarOutlined />
                <DatePicker
                  value={filterDate}
                  onChange={(value) => {
                    setFilterDate(value);
                    setCurrentPage(1);
                  }}
                  format="YYYY-MM-DD"
                  allowClear
                  className="cashier-date-picker"
                  placeholder="Filter by date"
                />
              </div>
            </div>

            {/* Table */}
            <Spin spinning={bookingsLoading} indicator={<ClockCircleOutlined spin />}>
              <Table
                columns={columns}
                dataSource={bookings}
                rowKey={(record) => getBookingId(record)}
                className="cashier-table"
                scroll={{ x: 1200 }}
                pagination={{
                  current: currentPage,
                  pageSize: pageSize,
                  total: bookingsTotal,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} bookings`,
                  itemRender: renderPaginationItem,
                  onChange: (page, size) => {
                    setCurrentPage(page);
                    if (size) setPageSize(size);
                  },
                  pageSizeOptions: ['5', '10', '20', '50']
                }}
              />
            </Spin>
          </Card>
        </div>

        {/* ==================== CREATE BOOKING MODAL ==================== */}
        <Modal
          title={
            <div className="cashier-modal-header-clean cashier-create-header">
              <div className="cashier-modal-title-icon"><PlusOutlined /></div>
              <div className="cashier-modal-title-text">
                {editingBooking ? 'Edit Booking' : 'Create New Booking'}
              </div>
              <div className="cashier-step-indicator">Step {createStep + 1} of 4</div>
            </div>
          }
          open={createModalVisible}
          onCancel={() => {
            if (!isSaving) {
              Modal.confirm({
                title: 'Exit Booking Creation?',
                content: 'Your progress will be lost. Are you sure?',
                okText: 'Yes, exit',
                cancelText: 'Continue editing',
                onOk: () => {
                  setCreateModalVisible(false);
                  setCreateStep(0);
                  createForm.resetFields();
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
          className="cashier-modal-clean cashier-modal-fixed-center"
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
          <div className="cashier-modal-clean-content">
            <div className="cashier-step-progress-fixed">
              <Steps
                current={createStep}
                size="small"
                className="cashier-steps-fixed"
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
              form={createForm}
              layout="vertical"
              disabled={isSaving}
              className="cashier-form-fixed"
            >
              <div className="cashier-step-content-fixed">
                {createStep === 0 && renderCustomerEventStep(createForm)}
                {createStep === 1 && renderServiceScopeStep()}
                {createStep === 2 && renderPaymentStep()}
                {createStep === 3 && renderReviewStep()}
              </div>

              <div className="cashier-modal-buttons-clean cashier-step-buttons-fixed">
                <div className="cashier-step-buttons-left">
                  {createStep > 0 && (
                    <Button
                      onClick={() => setCreateStep(createStep - 1)}
                      icon={<LeftOutlined />}
                      disabled={isSaving}
                      size="large"
                    >
                      Previous
                    </Button>
                  )}
                </div>
                <div className="cashier-step-buttons-right">
                  <Button
                    onClick={() => {
                      if (!isSaving) {
                        Modal.confirm({
                          title: 'Exit Booking Creation?',
                          content: 'Your progress will be lost. Are you sure?',
                          okText: 'Yes, exit',
                          cancelText: 'Continue editing',
                          onOk: () => {
                            setCreateModalVisible(false);
                            setCreateStep(0);
                            createForm.resetFields();
                            setSelectedPromo(null);
                            setMealServices([createDefaultMealService()]);
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
                  {createStep < 3 ? (
                    <Button
                      type="primary"
                      onClick={async () => {
                        try {
                          await createForm.validateFields();
                          setCreateStep(createStep + 1);
                          const modalBody = document.querySelector('.cashier-modal-fixed-center .ant-modal-body');
                          if (modalBody) modalBody.scrollTop = 0;
                        } catch (error) {
                          if (error.errorFields) {
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
                          }
                        }
                      }}
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
                          const values = await createForm.validateFields();
                          await saveBooking(values, !!editingBooking);
                        } catch (error) {
                          if (error.errorFields) {
                            const firstError = error.errorFields[0];
                            const fieldName = firstError.name[0];
                            message.error(`❌ ${fieldName} is required`);
                          } else {
                            message.error(error.message || 'Please check the form for errors.');
                          }
                        }
                      }}
                      loading={isSaving}
                      icon={<CheckCircleOutlined />}
                      className="cashier-create-booking-btn"
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

        {/* ==================== EDIT BOOKING MODAL ==================== */}
        <Modal
          title={
            <div className="cashier-modal-header-clean cashier-create-header">
              <div className="cashier-modal-title-icon"><EditOutlined /></div>
              <div className="cashier-modal-title-text">Edit Booking</div>
              <div className="cashier-modal-badge">{safeString(editingBooking?.booking_no)}</div>
            </div>
          }
          open={editModalVisible}
          onCancel={() => {
            if (!isSaving) {
              Modal.confirm({
                title: 'Exit Edit?',
                content: 'Your changes will be lost. Are you sure?',
                okText: 'Yes, exit',
                cancelText: 'Continue editing',
                onOk: () => {
                  setEditModalVisible(false);
                  setCreateStep(0);
                  editForm.resetFields();
                  setSelectedPromo(null);
                  setIsSaving(false);
                  setEditingBooking(null);
                }
              });
            }
          }}
          maskClosable={false}
          keyboard={false}
          footer={null}
          width={980}
          className="cashier-modal-clean cashier-modal-fixed-center"
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
          <div className="cashier-modal-clean-content">
            <div className="cashier-step-progress-fixed">
              <Steps
                current={createStep}
                size="small"
                className="cashier-steps-fixed"
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
              form={editForm}
              layout="vertical"
              disabled={isSaving}
              className="cashier-form-fixed"
            >
              <div className="cashier-step-content-fixed">
                {createStep === 0 && renderCustomerEventStep(editForm)}
                {createStep === 1 && renderServiceScopeStep()}
                {createStep === 2 && renderPaymentStep()}
                {createStep === 3 && renderReviewStep()}
              </div>

              <div className="cashier-modal-buttons-clean cashier-step-buttons-fixed">
                <div className="cashier-step-buttons-left">
                  {createStep > 0 && (
                    <Button
                      onClick={() => setCreateStep(createStep - 1)}
                      icon={<LeftOutlined />}
                      disabled={isSaving}
                      size="large"
                    >
                      Previous
                    </Button>
                  )}
                </div>
                <div className="cashier-step-buttons-right">
                  <Button
                    onClick={() => {
                      if (!isSaving) {
                        Modal.confirm({
                          title: 'Exit Edit?',
                          content: 'Your changes will be lost. Are you sure?',
                          okText: 'Yes, exit',
                          cancelText: 'Continue editing',
                          onOk: () => {
                            setEditModalVisible(false);
                            setCreateStep(0);
                            editForm.resetFields();
                            setSelectedPromo(null);
                            setMealServices([createDefaultMealService()]);
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
                            setEditingBooking(null);
                          }
                        });
                      }
                    }}
                    disabled={isSaving}
                    size="large"
                  >
                    Cancel
                  </Button>
                  {createStep < 3 ? (
                    <Button
                      type="primary"
                      onClick={async () => {
                        try {
                          await editForm.validateFields();
                          setCreateStep(createStep + 1);
                          const modalBody = document.querySelector('.cashier-modal-fixed-center .ant-modal-body');
                          if (modalBody) modalBody.scrollTop = 0;
                        } catch (error) {
                          if (error.errorFields) {
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
                          }
                        }
                      }}
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
                          const values = await editForm.validateFields();
                          await saveBooking(values, true);
                        } catch (error) {
                          if (error.errorFields) {
                            const firstError = error.errorFields[0];
                            const fieldName = firstError.name[0];
                            message.error(`❌ ${fieldName} is required`);
                          } else {
                            message.error(error.message || 'Please check the form for errors.');
                          }
                        }
                      }}
                      loading={isSaving}
                      icon={<CheckCircleOutlined />}
                      className="cashier-create-booking-btn"
                      size="large"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Update Booking'}
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== VIEW DETAILS MODAL ==================== */}
        {renderViewDetailsModal()}

        {/* ==================== MENU SELECTION MODAL ==================== */}
        {renderMenuSelectionModal()}
      </ConfigProvider>
    </App>
  );
};

export default CashierPage;