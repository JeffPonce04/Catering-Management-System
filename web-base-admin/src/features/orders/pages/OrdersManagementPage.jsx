// src/components/OrderManagement.jsx - COMPLETE FIXED
import React, { useState, useEffect, useRef } from 'react';
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
    Alert,
    DatePicker,
    Empty,
    Dropdown,
    ConfigProvider,
    theme as antdTheme,
    Popconfirm,
    Spin,
    Form,
    Row,
    Col,
    Badge,
    Statistic,
    Pagination,
    Checkbox
} from 'antd';
import {
    ShoppingOutlined,
    EyeOutlined,
    SearchOutlined,
    CalendarOutlined,
    HistoryOutlined,
    ReloadOutlined,
    TrophyOutlined,
    PrinterOutlined,
    ExportOutlined,
    TruckOutlined,
    PlayCircleOutlined,
    StockOutlined,
    MenuOutlined,
    WalletOutlined,
    MailOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    ScheduleOutlined,
    OrderedListOutlined,
    MoreOutlined,
    EditOutlined,
    DeleteOutlined,
    RiseOutlined,
    PercentageOutlined,
    FilterOutlined,
    PlusOutlined,
    ShoppingCartOutlined,
    SaveOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    DollarOutlined,
    TeamOutlined,
    UserOutlined,
    LoadingOutlined,
    WarningOutlined,
    InfoCircleOutlined,
    ContainerOutlined,
    CoffeeOutlined,
    ForkOutlined,
    CrownOutlined,
    LeftOutlined,
    RightOutlined
} from '@ant-design/icons';
import { useOrders, useOrderStatistics, useKitchenOrders, useDeliveryOrders, useAddToKitchen, useRemoveFromKitchen, useAddToDelivery, useRemoveFromDelivery, useUpdateOrderStatus, useUpdateKitchenTask, useUpdateDeliveryItem, useAddToShoppingList, useDeleteOrder, useCreateOrder, useUpdateOrder } from '../../../hooks/useOrders';
import { useShoppingList, useMarkShoppingItemPurchased } from '../../../hooks/useShoppingList';
import api from '../../../services/api';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import '../styles/OrdersManagement.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

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
    return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// ============================================================
// STATUS CONFIG
// ============================================================
const getStatusConfig = (status) => {
    const config = {
        pending: { color: '#f97316', text: 'Pending', icon: <ClockCircleOutlined />, bg: '#fff7ed' },
        preparing: { color: '#3b82f6', text: 'Preparing', icon: <SyncOutlined spin />, bg: '#eff6ff' },
        ready: { color: '#10b981', text: 'Ready', icon: <CheckCircleOutlined />, bg: '#ecfdf5' },
        ongoing: { color: '#8b5cf6', text: 'Ongoing', icon: <TruckOutlined />, bg: '#f5f3ff' },
        completed: { color: '#059669', text: 'Completed', icon: <CheckCircleOutlined />, bg: '#ecfdf5' },
        cancelled: { color: '#ef4444', text: 'Cancelled', icon: <CloseCircleOutlined />, bg: '#fef2f2' }
    };
    return config[status] || config.pending;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const OrderManagement = () => {
    // ==================== STATE ====================
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedDate, setSelectedDate] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [activeMainTab, setActiveMainTab] = useState('orders');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });

    // Modal states
    const [orderDetailsModalVisible, setOrderDetailsModalVisible] = useState(false);
    const [editOrderModalVisible, setEditOrderModalVisible] = useState(false);
    const [statusUpdateModalVisible, setStatusUpdateModalVisible] = useState(false);
    const [kitchenModalVisible, setKitchenModalVisible] = useState(false);
    const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
    const [ingredientsModalVisible, setIngredientsModalVisible] = useState(false);
    const [createOrderModalVisible, setCreateOrderModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [kitchenTasks, setKitchenTasks] = useState([]);
    const [deliveryItems, setDeliveryItems] = useState([]);
    const [selectedOrderForIngredients, setSelectedOrderForIngredients] = useState(null);
    const [computedIngredients, setComputedIngredients] = useState([]);
    const [isComputingIngredients, setIsComputingIngredients] = useState(false);
    const [isMarkingPurchased, setIsMarkingPurchased] = useState(false);
    const [showAddDeliveryItem, setShowAddDeliveryItem] = useState(false);
    const [availableEquipment, setAvailableEquipment] = useState([]);
    const [selectedEquipment, setSelectedEquipment] = useState({});
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [equipmentSearch, setEquipmentSearch] = useState('');
    const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
    const [fullEventIngredients, setFullEventIngredients] = useState([]);
    const [ingredientViewTitle, setIngredientViewTitle] = useState('Full Event Ingredients Summary');

    // Pagination states
    const [kitchenCurrentPage, setKitchenCurrentPage] = useState(1);
    const [kitchenPageSize, setKitchenPageSize] = useState(5);
    const [deliveryCurrentPage, setDeliveryCurrentPage] = useState(1);
    const [deliveryPageSize, setDeliveryPageSize] = useState(5);

    // Forms
    const [createOrderForm] = Form.useForm();
    const [editOrderForm] = Form.useForm();
    const [deliveryItemForm] = Form.useForm();

    // ==================== API HOOKS ====================
    const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useOrders({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: searchText || undefined,
        event_date: selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : undefined,
        page: currentPage,
        per_page: pageSize
    });

    const { data: statistics, refetch: refetchStatistics } = useOrderStatistics();
    const { data: kitchenOrders, refetch: refetchKitchenOrders } = useKitchenOrders();
    const { data: deliveryOrders, refetch: refetchDeliveryOrders } = useDeliveryOrders();
    const { data: shoppingList, refetch: refetchShoppingList } = useShoppingList();

    // Mutations
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

    const isMounted = useRef(true);

    // ==================== THEME ====================
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
        };
    }, []);

    // ==================== AUTO-REFRESH ====================
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeMainTab === 'orders') {
                refetchOrders();
                refetchStatistics();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [activeMainTab, refetchOrders, refetchStatistics]);

    // ==================== DATA ====================
    const orders = safeArray(ordersData?.data);
    const stats = statistics || {
        total_orders: 0,
        total_revenue: 0,
        completed_orders: 0,
        pending_purchases: 0,
        preparing_orders: 0,
        ready_orders: 0,
        ongoing_orders: 0,
        cancelled_orders: 0,
        pending_orders: 0,
        outstanding_balance: 0
    };

    const totalOrders = stats.total_orders;
    const totalRevenue = stats.total_revenue;
    const completionRate = totalOrders > 0 ? (stats.completed_orders || 0) / totalOrders * 100 : 0;
    const pendingPurchases = stats.pending_purchases || 0;

    // ==================== HELPER FUNCTIONS ====================
    const getMenuItems = (order) => {
        const items = safeArray(order.menu_items);
        return items.map(item => ({
            menu_item_id: item.menu_item_id || item.id,
            meal_service_id: item.meal_service_id,
            meal_type: item.meal_type,
            service_date: item.service_date,
            serving_time: item.serving_time,
            name: safeString(item.name),
            quantity: safeNumber(item.quantity, 1),
            price: safeNumber(item.price, 0),
            subtotal: safeNumber(item.price, 0) * safeNumber(item.quantity, 1),
            ingredients: safeArray(item.ingredients)
        }));
    };

    const getTotalMenuAmount = (order) => {
        return getMenuItems(order).reduce((sum, item) => sum + item.subtotal, 0);
    };

    const groupMenuItemsByDay = (order) => {
        const groups = {};
        getMenuItems(order).forEach((item) => {
            const dayKey = item.service_date || item.meal_type || 'General';
            const label = item.service_date
                ? `${item.service_date} • ${item.meal_type || 'Meal'}${item.serving_time ? ` • ${item.serving_time}` : ''}`
                : `${item.meal_type || 'General'}`;
            if (!groups[dayKey]) groups[dayKey] = { label, items: [] };
            groups[dayKey].items.push(item);
        });
        return Object.values(groups);
    };

    const groupKitchenTasksByMeal = (tasks) => {
        const groups = {};
        safeArray(tasks).filter(t => !t.is_header).forEach((task) => {
            const label = task.meal_label || `${task.service_date || ''} ${task.meal_type || ''} ${task.serving_time || ''}`.trim() || 'General Tasks';
            const key = `${task.service_date || ''}-${task.meal_type || label}`;
            if (!groups[key]) groups[key] = { label, tasks: [] };
            groups[key].tasks.push(task);
        });
        return Object.values(groups);
    };

    // ==================== EXPORT FUNCTIONS ====================
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
                    exportRow[col.title] = getStatusConfig(row.order_status).text;
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

    const exportOrders = () => {
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
        exportToExcel(orders, 'Orders_Report', columns);
    };

    // ==================== PRINT FUNCTIONS ====================
    const printKitchenTasks = (tasks) => {
        const printableTasks = safeArray(tasks).filter(task => !task.is_header);
        if (printableTasks.length === 0) {
            message.warning('No kitchen tasks to print');
            return;
        }
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Kitchen Preparation List - ${selectedOrder?.booking_no}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #ffffff; color: #111827; }
                    .print-container { max-width: 1100px; margin: 0 auto; }
                    h1 { text-align: center; font-size: 24px; margin-bottom: 8px; }
                    .header { text-align: center; margin-bottom: 24px; }
                    .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; font-size: 13px; }
                    .details div { border: 1px solid #d1d5db; padding: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #111827; padding: 10px; text-align: left; font-size: 13px; }
                    th { background: #f3f4f6; font-weight: 700; }
                    .checkbox-cell { text-align: center; font-size: 18px; }
                    .no-print { text-align: center; margin-top: 20px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <h1>Kitchen Preparation List</h1>
                    <div class="header"><strong>Booking Code:</strong> ${formatBookingId(selectedOrder?.booking_no)}</div>
                    <div class="details">
                        <div><strong>Customer:</strong> ${selectedOrder?.customer_name || '-'}</div>
                        <div><strong>Event Date:</strong> ${selectedOrder?.event_date || '-'}</div>
                        <div><strong>Event Time:</strong> ${selectedOrder?.event_time || '-'}</div>
                        <div><strong>Venue:</strong> ${selectedOrder?.venue || '-'}</div>
                        <div><strong>Pax:</strong> ${selectedOrder?.guests_count || '-'}</div>
                        <div><strong>Prepared By:</strong> __________________</div>
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Task</th><th>Qty</th><th>Start</th><th>Out for Delivery</th><th>Assigned To</th><th>Done</th></tr></thead>
                        <tbody>
        `;
        printableTasks.forEach((task, idx) => {
            htmlContent += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${safeString(task.task || task.name, '-')}</td>
                    <td>${task.quantity || '-'}</td>
                    <td>${task.start_time || '-'}</td>
                    <td>${task.out_for_delivery || task.end_time || task.deadline || '-'}</td>
                    <td>${task.assigned_to || 'Kitchen Team'}</td>
                    <td class="checkbox-cell">□</td>
                </tr>
            `;
        });
        htmlContent += `
                        </tbody>
                    </table>
                    <div class="no-print"><button onclick="window.print()">Print</button> <button onclick="window.close()">Close</button></div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const printDeliveryItems = (items) => {
        const printableItems = safeArray(items);
        if (printableItems.length === 0) {
            message.warning('No delivery items to print');
            return;
        }
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Delivery Preparation List - ${selectedOrder?.booking_no}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #ffffff; color: #111827; }
                    .print-container { max-width: 1000px; margin: 0 auto; }
                    h1 { text-align: center; font-size: 24px; margin-bottom: 8px; }
                    .header { text-align: center; margin-bottom: 24px; }
                    .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 16px 0; font-size: 13px; }
                    .details div { border: 1px solid #d1d5db; padding: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #111827; padding: 10px; text-align: left; font-size: 13px; }
                    th { background: #f3f4f6; font-weight: 700; }
                    .checkbox-cell { text-align: center; font-size: 18px; }
                    .no-print { text-align: center; margin-top: 20px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <h1>Delivery Preparation List</h1>
                    <div class="header"><strong>Booking Code:</strong> ${formatBookingId(selectedOrder?.booking_no)}</div>
                    <div class="details">
                        <div><strong>Customer Name:</strong> ${selectedOrder?.customer_name || '-'}</div>
                        <div><strong>Event Date:</strong> ${selectedOrder?.event_date || '-'}</div>
                        <div><strong>Delivery Address:</strong> ${selectedOrder?.delivery_address || selectedOrder?.venue || '-'}</div>
                        <div><strong>Checked By:</strong> __________________</div>
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Items</th><th>Quantity</th><th>Ready</th></tr></thead>
                        <tbody>
        `;
        printableItems.forEach((item, idx) => {
            htmlContent += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${safeString(item.item || item.name, '-')}</td>
                    <td>${item.quantity || 0}</td>
                    <td class="checkbox-cell">□</td>
                </tr>
            `;
        });
        htmlContent += `
                        </tbody>
                    </table>
                    <div class="no-print"><button onclick="window.print()">Print</button> <button onclick="window.close()">Close</button></div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // ==================== ORDER FUNCTIONS ====================
    const handleViewOrderDetails = (record) => {
        setSelectedOrder(record);
        setOrderDetailsModalVisible(true);
    };

    const handleEditOrder = (record) => {
        setSelectedOrder(record);
        editOrderForm.setFieldsValue({
            customer_name: record.customer_name,
            customer_email: record.customer_email,
            customer_phone: record.customer_phone,
            customer_address: record.customer_address,
            event_type: record.event_type,
            event_date: record.event_date ? dayjs(record.event_date) : null,
            event_time: record.event_time,
            venue: record.venue,
            guests_count: record.guests_count,
            total_amount: record.total_amount,
            special_requests: record.special_requests
        });
        setEditOrderModalVisible(true);
    };

    const handleUpdateOrder = async (values) => {
        try {
            await updateOrderMutation.mutateAsync({
                id: selectedOrder.id,
                data: values
            });
            message.success('Order updated successfully');
            setEditOrderModalVisible(false);
            refetchOrders();
            refetchStatistics();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to update order');
        }
    };

    const handleUpdateStatus = (record) => {
        setSelectedOrder(record);
        setStatusUpdateModalVisible(true);
    };

    const handleConfirmStatusUpdate = async (status) => {
        if (!selectedOrder) return;
        try {
            await updateStatusMutation.mutateAsync({
                id: selectedOrder.id,
                data: { status }
            });
            message.success(`Status updated to ${status} for Booking ${formatBookingId(selectedOrder.booking_no)}`);
            setStatusUpdateModalVisible(false);
            refetchOrders();
            refetchStatistics();
            refetchKitchenOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error('Failed to update status');
        }
    };

    const handleDeleteOrder = async (record) => {
        try {
            await deleteOrderMutation.mutateAsync(record.id);
            message.success(`Order for Booking ${formatBookingId(record.booking_no)} deleted`);
            refetchOrders();
            refetchStatistics();
            refetchKitchenOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error('Failed to delete order');
        }
    };

    const handleCreateOrder = async (values) => {
        try {
            await createOrderMutation.mutateAsync({
                ...values,
                total_amount: values.total_amount,
                event_date: values.event_date ? values.event_date.format('YYYY-MM-DD') : null
            });
            message.success('Order created successfully');
            setCreateOrderModalVisible(false);
            createOrderForm.resetFields();
            refetchOrders();
            refetchStatistics();
        } catch (error) {
            message.error('Failed to create order');
        }
    };

    // ==================== KITCHEN FUNCTIONS ====================
    const normalizeKitchenTasksFromBackend = (order) => {
        const tasks = safeArray(order?.kitchen_preparation);
        return tasks.map((task, idx) => ({
            id: task.id || task.task_id || `kitchen-${idx}`,
            type: task.type || 'menu_item',
            task: safeString(task.task || task.name, 'Kitchen task').replace(/^[^\w\d]+\s*/u, ''),
            quantity: task.quantity || task.qty || '',
            start_time: task.start_time || task.start || '',
            out_for_delivery: task.out_for_delivery || task.end_time || task.deadline || '',
            assigned_to: task.assigned_to || 'Kitchen Team',
            notes: task.notes || '',
            status: task.status || (task.is_done ? 'completed' : 'pending'),
            is_done: Boolean(task.is_done || task.status === 'completed'),
            is_header: Boolean(task.is_header),
            meal_type: task.meal_type || task.meal || '',
            service_date: task.service_date || task.date || '',
            serving_time: task.serving_time || '',
            meal_label: task.service_date || task.meal_type || task.serving_time
                ? `${task.service_date || ''} ${task.meal_type || ''} ${task.serving_time || ''}`.trim()
                : ''
        }));
    };

    const normalizeDeliveryItemsFromBackend = (order) => {
        return safeArray(order?.delivery_preparation).map((item, idx) => ({
            id: item.id || item.delivery_item_id || item.equipment_id || `delivery-${idx}`,
            equipment_id: item.equipment_id || null,
            item: safeString(item.item || item.name, 'Delivery item').replace(/^[^\w\d]+\s*/u, ''),
            quantity: safeNumber(item.quantity || item.qty, 1),
            scheduled_time: item.scheduled_time || item.dispatch_time || '',
            notes: item.notes || '',
            status: item.status || (item.is_ready ? 'ready' : 'pending'),
            is_ready: Boolean(item.is_ready || item.status === 'ready' || item.status === 'completed'),
            available_quantity: item.available_quantity || item.available || 0,
            total_quantity: item.total_quantity || 0
        }));
    };

    const handleAddToKitchen = async (record) => {
        try {
            await addToKitchenMutation.mutateAsync(record.id);
            message.success(`Kitchen Preparation refreshed for ${formatBookingId(record.booking_no)}`);
            refetchOrders();
            refetchKitchenOrders();
        } catch (error) {
            message.error('Failed to refresh kitchen preparation');
        }
    };

    const handleViewKitchenPrep = (record) => {
        setSelectedOrder(record);
        setKitchenTasks(normalizeKitchenTasksFromBackend(record));
        setKitchenCurrentPage(1);
        setKitchenModalVisible(true);
    };

    const handleRemoveFromKitchenPrep = async (record) => {
        try {
            await removeFromKitchenMutation.mutateAsync(record.id);
            message.success(`Booking ${formatBookingId(record.booking_no)} removed from Kitchen Preparation`);
            refetchOrders();
            refetchKitchenOrders();
        } catch (error) {
            message.error('Failed to remove from kitchen');
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

            await updateKitchenTaskMutation.mutateAsync({
                orderId: selectedOrder?.id,
                data: { tasks: updatedTasks }
            });
            message.success('Kitchen checklist updated');
            refetchOrders();
            refetchKitchenOrders();
        } catch (error) {
            message.error('Failed to update kitchen task');
        }
    };

    // ==================== DELIVERY FUNCTIONS ====================
    const loadAvailableEquipment = async () => {
        setLoadingEquipment(true);
        try {
            const response = await api.get('/equipment', {
                params: {
                    active: 1,
                    per_page: 500,
                    search: equipmentSearch || undefined,
                    date: selectedOrder?.event_date || undefined,
                    start_time: selectedOrder?.event_time || undefined,
                    end_time: selectedOrder?.event_time || undefined,
                    booking_id: selectedOrder?.booking_id || undefined
                }
            });
            const payload = response?.data?.data || response?.data || [];
            const list = Array.isArray(payload) ? payload : (payload.data || payload.equipment || []);
            
            const mappedList = safeArray(list).map(item => ({
                ...item,
                id: item.id || item.equipment_id,
                equipment_id: item.equipment_id || item.id,
                available_quantity: item.available_quantity ?? item.available ?? item.quantity ?? 0,
                total_quantity: item.total_quantity || 0,
                name: item.name || item.item_name || item.equipment_name || 'Equipment'
            }));
            
            setAvailableEquipment(mappedList);
        } catch (error) {
            message.error('Failed to load inventory equipment');
        } finally {
            setLoadingEquipment(false);
        }
    };

    const handleAddToDelivery = async (record) => {
        try {
            await addToDeliveryMutation.mutateAsync(record.id);
            message.success(`Delivery Preparation refreshed for ${formatBookingId(record.booking_no)}`);
            refetchOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error('Failed to refresh delivery preparation');
        }
    };

    const handleViewDeliveryPrep = (record) => {
        setSelectedOrder(record);
        setDeliveryItems(normalizeDeliveryItemsFromBackend(record));
        setDeliveryCurrentPage(1);
        setDeliveryModalVisible(true);
        setShowAddDeliveryItem(false);
        setSelectedEquipment({});
    };

    const handleRemoveFromDeliveryPrep = async (record) => {
        try {
            await removeFromDeliveryMutation.mutateAsync(record.id);
            message.success(`Booking ${formatBookingId(record.booking_no)} removed from Delivery Preparation`);
            refetchOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error('Failed to remove from delivery');
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

            await updateDeliveryItemMutation.mutateAsync({
                orderId: selectedOrder?.id,
                data: { items: updatedItems }
            });
            message.success('Delivery checklist updated');
            refetchOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to update delivery item');
        }
    };

    const toggleEquipmentSelection = (equipment, checked) => {
        const id = equipment.id || equipment.equipment_id;
        setSelectedEquipment(prev => {
            const next = { ...prev };
            if (!checked) {
                delete next[id];
            } else {
                next[id] = {
                    equipment_id: id,
                    item: equipment.name || equipment.item_name || equipment.equipment_name,
                    quantity: next[id]?.quantity || 1,
                    available_quantity: equipment.available_quantity ?? equipment.available ?? equipment.quantity ?? 0
                };
            }
            return next;
        });
    };

    const updateSelectedEquipmentQty = (equipment, quantity) => {
        const id = equipment.id || equipment.equipment_id;
        setSelectedEquipment(prev => ({
            ...prev,
            [id]: {
                equipment_id: id,
                item: equipment.name || equipment.item_name || equipment.equipment_name,
                quantity: safeNumber(quantity, 1),
                available_quantity: equipment.available_quantity ?? equipment.available ?? equipment.quantity ?? 0
            }
        }));
    };

    const handleAddDeliveryItem = async () => {
        const selectedItems = Object.values(selectedEquipment).filter(item => safeNumber(item.quantity) > 0);
        if (selectedItems.length === 0) {
            message.warning('Please select at least one equipment item');
            return;
        }
        try {
            const response = await api.post(`/orders/${selectedOrder?.id}/delivery-item`, { items: selectedItems });
            const updatedItems = response?.data?.data?.items || response?.data?.items;
            if (Array.isArray(updatedItems)) {
                setDeliveryItems(updatedItems);
            }
            setSelectedEquipment({});
            setShowAddDeliveryItem(false);
            message.success(`${selectedItems.length} equipment item(s) added to Delivery Preparation`);
            refetchOrders();
            refetchDeliveryOrders();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to add equipment item');
        }
    };

    // ==================== INGREDIENTS FUNCTIONS ====================
    const computeIngredientsForOrder = async (order) => {
        try {
            const bookingId = order?.booking_id;
            if (bookingId) {
                try {
                    const response = await api.get(`/bookings/${bookingId}/ingredients-details`);
                    const detail = response?.data?.data || response?.data;
                    if (detail?.all_ingredients) {
                        setSelectedOrderForIngredients(prev => ({
                            ...prev,
                            ...detail,
                            total_amount: order.total_amount || prev?.total_amount || 0,
                            menu_items: detail.menu_items || prev?.menu_items || []
                        }));
                        return detail.all_ingredients;
                    }
                } catch (error) {
                    console.warn('Backend ingredient details failed, using local recipe computation:', error);
                }
            }

            const menuItems = safeArray(order.menu_items);
            const ingredientsMap = new Map();

            for (const menuItem of menuItems) {
                const menuItemId = menuItem.menu_item_id || menuItem.id;
                if (!menuItemId) continue;

                try {
                    const recipeResponse = await api.get(`/recipes/${menuItemId}`);
                    let recipeData = recipeResponse.data?.data || recipeResponse.data;

                    let recipeIngredients = [];
                    if (recipeData?.recipe_ingredients) {
                        recipeIngredients = recipeData.recipe_ingredients;
                    } else if (recipeData?.recipeIngredients) {
                        recipeIngredients = recipeData.recipeIngredients;
                    } else if (Array.isArray(recipeData)) {
                        recipeIngredients = recipeData;
                    } else if (recipeData?.data && Array.isArray(recipeData.data)) {
                        recipeIngredients = recipeData.data;
                    }

                    if (!recipeIngredients || recipeIngredients.length === 0) {
                        console.warn(`No recipe ingredients found for ${menuItem.name}`);
                        continue;
                    }

                    for (const ingredient of recipeIngredients) {
                        const ingredientId = ingredient.ingredient_id;
                        const quantityPerPax = parseFloat(ingredient.quantity_per_pax) || 0;
                        const requiredQty = quantityPerPax * (menuItem.quantity || 1);

                        if (ingredientsMap.has(ingredientId)) {
                            const existing = ingredientsMap.get(ingredientId);
                            existing.quantity_needed += requiredQty;
                            existing.menu_items.push({
                                name: menuItem.name,
                                quantity: menuItem.quantity,
                                per_pax: quantityPerPax
                            });
                        } else {
                            let currentStock = 0;
                            let reservedStock = 0;
                            let unitCost = 0;
                            let ingredientName = ingredient.ingredient?.name || ingredient.name || 'Unknown Ingredient';
                            let unit = ingredient.unit || 'kg';

                            try {
                                const stockResponse = await api.get(`/ingredients/${ingredientId}`);
                                const stockData = stockResponse.data?.data || stockResponse.data;
                                currentStock = parseFloat(stockData?.current_quantity) || 0;
                                reservedStock = parseFloat(stockData?.reserved_quantity) || 0;
                                unitCost = parseFloat(stockData?.unit_cost) || 0;
                                ingredientName = stockData?.name || ingredientName;
                                unit = stockData?.unit || unit;
                            } catch (e) {
                                console.warn(`No stock found for ingredient ${ingredientId}`);
                            }

                            ingredientsMap.set(ingredientId, {
                                ingredient_id: ingredientId,
                                name: ingredientName,
                                unit: unit,
                                per_pax: quantityPerPax,
                                quantity_needed: requiredQty,
                                current_stock: currentStock,
                                reserved_quantity: reservedStock,
                                available_stock: currentStock - reservedStock,
                                unit_cost: unitCost,
                                menu_items: [{
                                    name: menuItem.name,
                                    quantity: menuItem.quantity,
                                    per_pax: quantityPerPax
                                }]
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch recipe for ${menuItem.name}:`, error);
                }
            }

            const computed = Array.from(ingredientsMap.values()).map(ing => {
                const shortage = Math.max(0, ing.quantity_needed - ing.available_stock);
                return {
                    ...ing,
                    shortage: Math.round(shortage * 100) / 100,
                    need_to_buy: shortage > 0,
                    status: shortage > 0 ? 'insufficient' : (ing.available_stock < ing.quantity_needed * 1.2 ? 'low' : 'sufficient')
                };
            });

            return computed;
        } catch (error) {
            console.error('Failed to compute ingredients:', error);
            message.error('Failed to fetch ingredient requirements');
            return [];
        }
    };

    const handleViewIngredients = async (record) => {
        setSelectedOrderForIngredients(record);
        setIngredientsModalVisible(true);
        setComputedIngredients([]);
        setFullEventIngredients([]);
        setSelectedIngredientIds([]);
        setIngredientViewTitle('Full Event Ingredients Summary');
        setIsComputingIngredients(true);

        try {
            const computed = await computeIngredientsForOrder(record);
            setComputedIngredients(computed);
            setFullEventIngredients(computed);

            const itemsNeedingPurchase = computed.filter(i => i.need_to_buy);
            if (itemsNeedingPurchase.length > 0) {
                message.info(`${itemsNeedingPurchase.length} ingredients need to be purchased. Click "Add to Purchase List" to create requests.`);
            } else {
                message.success('All ingredients are sufficiently stocked!');
            }
        } catch (error) {
            console.error('Failed to compute ingredients:', error);
            message.error('Failed to fetch ingredient requirements');
        } finally {
            setIsComputingIngredients(false);
        }
    };

    const handleShowFullIngredientSummary = () => {
        setComputedIngredients(fullEventIngredients);
        setIngredientViewTitle('Full Event Ingredients Summary');
        setSelectedIngredientIds([]);
    };

    const handleShowMenuIngredients = async (menuItem) => {
        const bookingId = selectedOrderForIngredients?.booking_id;
        if (!bookingId || !menuItem?.menu_item_id) {
            message.warning('This menu item has no ingredient record yet.');
            return;
        }
        setIsComputingIngredients(true);
        setSelectedIngredientIds([]);
        try {
            const response = await api.get(`/bookings/${bookingId}/menu-item/${menuItem.menu_item_id}/ingredients`);
            const detail = response?.data?.data || response?.data;
            setComputedIngredients(safeArray(detail?.ingredients));
            setIngredientViewTitle(`${menuItem.name} Ingredients`);
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to load menu item ingredients');
        } finally {
            setIsComputingIngredients(false);
        }
    };

    const handleMarkSelectedIngredientsPurchased = async () => {
        const bookingId = selectedOrderForIngredients?.booking_id;
        if (!bookingId || selectedIngredientIds.length === 0) {
            message.warning('Please select ingredients first');
            return;
        }
        setIsMarkingPurchased(true);
        try {
            await api.post(`/bookings/${bookingId}/ingredients-mark-purchased`, {
                ingredient_ids: selectedIngredientIds
            });
            setComputedIngredients(prev => prev.map(ing => selectedIngredientIds.includes(ing.ingredient_id) ? { ...ing, purchased: true, need_to_buy: false, status: 'purchased' } : ing));
            setFullEventIngredients(prev => prev.map(ing => selectedIngredientIds.includes(ing.ingredient_id) ? { ...ing, purchased: true, need_to_buy: false, status: 'purchased' } : ing));
            message.success(`${selectedIngredientIds.length} ingredient(s) marked as purchased`);
            setSelectedIngredientIds([]);
            await refetchOrders();
            await refetchShoppingList();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to mark selected ingredients as purchased');
        } finally {
            setIsMarkingPurchased(false);
        }
    };

    const handleMarkAllIngredientsPurchased = async () => {
        const bookingId = selectedOrderForIngredients?.booking_id;
        if (!bookingId) return;
        setIsMarkingPurchased(true);
        try {
            await api.post(`/bookings/${bookingId}/ingredients-mark-all-purchased`);
            setComputedIngredients(prev => prev.map(ing => ({ ...ing, purchased: true, need_to_buy: false, status: 'purchased' })));
            setFullEventIngredients(prev => prev.map(ing => ({ ...ing, purchased: true, need_to_buy: false, status: 'purchased' })));
            setSelectedIngredientIds([]);
            message.success('All booking ingredients marked as purchased');
            await refetchOrders();
            await refetchShoppingList();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to mark all ingredients as purchased');
        } finally {
            setIsMarkingPurchased(false);
        }
    };

    const handleAddToShoppingList = async (orderId, ingredients) => {
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
                        console.warn('Missing ingredient_id for:', ingredient);
                        failedCount++;
                        continue;
                    }

                    const quantityToBuy = Math.ceil((ingredient.shortage || 0) * 1.1);

                    if (quantityToBuy <= 0) {
                        continue;
                    }

                    const response = await api.post('/inventory/purchase-requests', {
                        ingredient_id: ingredientId,
                        quantity: quantityToBuy,
                        urgency: ingredient.shortage > 50 ? 'critical' : (ingredient.shortage > 20 ? 'urgent' : 'normal'),
                        booking_id: selectedOrderForIngredients?.booking_id,
                        notes: `Auto-generated from order ${formatBookingId(selectedOrderForIngredients?.booking_no)} - Needed: ${ingredient.quantity_needed} ${ingredient.unit}, Available: ${ingredient.available_stock}, Shortage: ${ingredient.shortage}`
                    });

                    if (response.data?.success !== false) {
                        addedCount++;
                        console.log(`✅ Added ${ingredient.name} (${quantityToBuy} ${ingredient.unit}) to purchase list`);
                    } else {
                        failedCount++;
                        console.warn(`Failed to add ${ingredient.name}:`, response.data?.message);
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
                await refetchShoppingList();
                await refetchOrders();
                await refetchStatistics();
            } else {
                message.error('Failed to add items to purchase list. Please check ingredient IDs.');
            }
        } catch (error) {
            console.error('Failed to add to shopping list:', error);
            message.error(error.response?.data?.message || 'Failed to add to shopping list');
        }
    };

    const handleMarkAsPurchased = async (itemId) => {
        if (!itemId) {
            message.error('Invalid item ID');
            return;
        }

        setIsMarkingPurchased(true);

        try {
            let purchaseRequest = null;
            try {
                const response = await api.get(`/inventory/purchase-requests/${itemId}`);
                purchaseRequest = response.data?.data || response.data;
            } catch (e) {
                const item = shoppingList.find(i => i.id === itemId || i.item_id === itemId || i.purchase_request_id === itemId);
                if (item) {
                    purchaseRequest = item;
                }
            }

            if (!purchaseRequest) {
                message.error('Purchase request not found');
                setIsMarkingPurchased(false);
                return;
            }

            const ingredientId = purchaseRequest.ingredient_id || purchaseRequest.ingredient?.ingredient_id;
            const requestedQuantity = parseFloat(purchaseRequest.quantity || purchaseRequest.quantity_needed || 0);

            if (!ingredientId || requestedQuantity <= 0) {
                message.error('Invalid purchase request data');
                setIsMarkingPurchased(false);
                return;
            }

            try {
                const response = await api.post(`/shopping-list/items/${itemId}/purchased`);

                if (response.data?.success !== false) {
                    message.success('✅ Item marked as purchased and stock updated');
                    await refetchShoppingList();
                    await refetchOrders();
                    await refetchStatistics();
                } else {
                    message.error(response.data?.message || 'Failed to mark as purchased');
                }
            } catch (error) {
                console.error('Failed to mark as purchased:', error);

                try {
                    await api.put(`/inventory/purchase-requests/${itemId}`, {
                        status: 'received'
                    });
                    message.success('✅ Item marked as purchased');
                    await refetchShoppingList();
                    await refetchOrders();
                    await refetchStatistics();
                } catch (e) {
                    console.error('Alternative mark as purchased failed:', e);
                    message.error(error.response?.data?.message || 'Failed to mark as purchased');
                }
            }
        } catch (error) {
            console.error('Mark as purchased error:', error);
            message.error(error.response?.data?.message || 'Failed to mark as purchased');
        } finally {
            setIsMarkingPurchased(false);
        }
    };

    // ==================== DROPDOWN MENU ====================
    const getActionMenuItems = (record) => [
        {
            key: 'ingredients',
            label: 'Ingredient Requirements',
            icon: <StockOutlined />,
            onClick: () => handleViewIngredients(record)
        },
        {
            key: 'kitchen',
            label: 'View Kitchen Prep',
            icon: <MenuOutlined />,
            onClick: () => handleViewKitchenPrep(record)
        },
        {
            key: 'delivery',
            label: 'View Delivery Prep',
            icon: <TruckOutlined />,
            onClick: () => handleViewDeliveryPrep(record)
        },
        { type: 'divider' },
        {
            key: 'status',
            label: 'Update Status',
            icon: <PlayCircleOutlined />,
            onClick: () => handleUpdateStatus(record)
        },
        { type: 'divider' },
        {
            key: 'edit',
            label: 'Edit Order',
            icon: <EditOutlined />,
            onClick: () => handleEditOrder(record)
        },
        {
            key: 'delete',
            label: 'Delete Order',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDeleteOrder(record)
        }
    ];

    // ==================== TABLE COLUMNS ====================
    const orderColumns = [
        {
            title: 'BOOKING ID',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            fixed: 'left',
            render: (text) => <span className="om-id-text">{formatBookingId(text)}</span>
        },
        {
            title: 'CUSTOMER',
            key: 'customer',
            width: 220,
            render: (_, record) => (
                <div className="om-customer-cell">
                    <div className="om-customer-name">{safeString(record.customer_name)}</div>
                    <div className="om-customer-contact"><MailOutlined /> {safeString(record.customer_email, 'No email')}</div>
                    <div className="om-customer-contact"><PhoneOutlined /> {safeString(record.customer_phone, 'No phone')}</div>
                </div>
            )
        },
        {
            title: 'EVENT DETAILS',
            key: 'event',
            width: 220,
            render: (_, record) => (
                <div className="om-event-cell">
                    <div><CalendarOutlined /> {safeString(record.event_date)}</div>
                    <div><ScheduleOutlined /> {safeString(record.event_time)}</div>
                    <div><EnvironmentOutlined /> {safeString(record.venue, 'N/A')}</div>
                </div>
            )
        },
        {
            title: 'PAX',
            dataIndex: 'guests_count',
            key: 'pax',
            width: 80,
            align: 'center',
            render: (v) => <span className="om-pax-number"><TeamOutlined /> {safeNumber(v)}</span>
        },
        {
            title: 'AMOUNT',
            dataIndex: 'total_amount',
            key: 'amount',
            width: 140,
            align: 'right',
            render: (v, record) => {
                const total = safeNumber(v);
                const paid = safeNumber(record.paid_amount, 0);
                const balance = safeNumber(record.balance, Math.max(total - paid, 0));
                return (
                    <div style={{ textAlign: 'right' }}>
                        <div className="om-amount" style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(total)}</div>
                        {paid > 0 && <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>- {formatCurrency(paid)}</div>}
                        {balance > 0 && <div style={{ color: '#dc2626', fontSize: 11 }}>Balance: {formatCurrency(balance)}</div>}
                    </div>
                );
            }
        },
        {
            title: 'STATUS',
            dataIndex: 'order_status',
            key: 'status',
            width: 140,
            align: 'center',
            render: (s) => {
                const config = getStatusConfig(s);
                return (
                    <span className="om-status" style={{ color: config.color, background: config.bg }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        {
            title: 'ACTION',
            key: 'actions',
            width: 160,
            fixed: 'right',
            render: (_, record) => (
                <div className="om-action-group">
                    <Tooltip title="View Details">
                        <button className="om-action-icon view" onClick={() => handleViewOrderDetails(record)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit Order">
                        <button className="om-action-icon edit" onClick={() => handleEditOrder(record)}>
                            <EditOutlined />
                        </button>
                    </Tooltip>
                    <Dropdown menu={{ items: getActionMenuItems(record) }} placement="bottomRight">
                        <button className="om-action-icon more">
                            <MoreOutlined />
                        </button>
                    </Dropdown>
                </div>
            )
        }
    ];

    const kitchenPrepColumns = [
        {
            title: 'BOOKING ID',
            key: 'booking_id',
            width: 140,
            render: (_, record) => <span className="om-id-text">{formatBookingId(record.booking_no)}</span>
        },
        { title: 'Customer', dataIndex: 'customer_name', width: 180 },
        { title: 'Event Date', dataIndex: 'event_date', width: 110 },
        { title: 'Event Time', dataIndex: 'event_time', width: 100 },
        { title: 'Venue', dataIndex: 'venue', width: 200, ellipsis: true },
        { title: 'Pax', dataIndex: 'guests_count', width: 70, align: 'center', render: (v) => <span className="om-pax-number">{safeNumber(v)}</span> },
        {
            title: 'Action',
            width: 150,
            render: (_, r) => (
                <div className="om-action-group">
                    <Tooltip title="View Kitchen Prep Tasks">
                        <button className="om-action-icon view" onClick={() => handleViewKitchenPrep(r)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Remove from Kitchen">
                        <button className="om-action-icon delete" onClick={() => handleRemoveFromKitchenPrep(r)}>
                            <DeleteOutlined />
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    const deliveryPrepColumns = [
        {
            title: 'BOOKING ID',
            key: 'booking_id',
            width: 140,
            render: (_, record) => <span className="om-id-text">{formatBookingId(record.booking_no)}</span>
        },
        { title: 'Customer', dataIndex: 'customer_name', width: 180 },
        { title: 'Delivery Date', dataIndex: 'event_date', width: 110 },
        { title: 'Delivery Address', dataIndex: 'delivery_address', width: 200, ellipsis: true, render: (v, record) => v || record.venue },
        { title: 'Contact', dataIndex: 'delivery_contact_phone', width: 120 },
        {
            title: 'Action',
            width: 150,
            render: (_, r) => (
                <div className="om-action-group">
                    <Tooltip title="View Delivery Prep Items">
                        <button className="om-action-icon view" onClick={() => handleViewDeliveryPrep(r)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Remove from Delivery">
                        <button className="om-action-icon delete" onClick={() => handleRemoveFromDeliveryPrep(r)}>
                            <DeleteOutlined />
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    // ==================== PAGINATION RENDER ====================
    const renderPaginationItem = (_, type, originalElement) => {
        if (type === 'prev') {
            return (
                <Button className="om-pagination-navigation-button" size="small" icon={<LeftOutlined />}>
                    Previous
                </Button>
            );
        }

        if (type === 'next') {
            return (
                <Button className="om-pagination-navigation-button" size="small">
                    Next <RightOutlined />
                </Button>
            );
        }

        return originalElement;
    };

    const renderEmptyPaginationFooter = (label) => {
        return (
            <div className="om-empty-pagination-footer">
                <span className="om-empty-pagination-total">Total 0 {label}</span>
                <div className="om-empty-pagination-controls">
                    <Button className="om-pagination-navigation-button" size="small" icon={<LeftOutlined />} disabled>
                        Previous
                    </Button>
                    <button type="button" className="om-empty-pagination-current-page" disabled>1</button>
                    <Button className="om-pagination-navigation-button" size="small" disabled>
                        Next <RightOutlined />
                    </Button>
                </div>
            </div>
        );
    };

    // ==================== CSS CLASSES ====================
    const containerClass = `om-container ${isDarkMode ? 'om-dark-mode' : ''}`;
    const headerClass = `om-header ${isDarkMode ? 'om-header-dark' : ''}`;
    const mainCardClass = `om-main-card ${isDarkMode ? 'om-main-card-dark' : ''}`;
    const filtersClass = `om-filters ${isDarkMode ? 'om-filters-dark' : ''}`;
    const filterGroupClass = `om-filter-group ${isDarkMode ? 'om-filter-group-dark' : ''}`;
    const dateDisplayClass = `om-date-display ${isDarkMode ? 'om-date-display-dark' : ''}`;
    const tableClass = `om-table ${isDarkMode ? 'om-table-dark' : ''}`;
    const kpiCardClass = `om-kpi-card ${isDarkMode ? 'om-kpi-card-dark' : ''}`;
    const shoppingListClass = `om-shopping-list-section ${isDarkMode ? 'om-shopping-list-section-dark' : ''}`;
    const alertClass = `om-info-alert ${isDarkMode ? 'om-alert-dark' : ''}`;
    const modalClass = `om-modal-clean ${isDarkMode ? 'om-modal-dark' : ''}`;
    const isLoading = ordersLoading;

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
                    <div className="om-header-left">
                        <Tooltip title="Order Management System">
                            <div className="om-logo-icon"><TrophyOutlined /></div>
                        </Tooltip>
                        <div className="om-header-info">
                            <h1>Order Management System</h1>
                            <span>ENTERPRISE OPERATIONS</span>
                        </div>
                    </div>
                    <div className="om-header-right">
                        <div className={dateDisplayClass}>
                            <CalendarOutlined />
                            <span>{formattedDate}</span>
                        </div>
                        <Divider type="vertical" style={{ height: 28 }} />
                        <Tooltip title="Refresh all data">
                            <Button icon={<ReloadOutlined />} onClick={() => {
                                refetchOrders();
                                refetchStatistics();
                                refetchKitchenOrders();
                                refetchDeliveryOrders();
                                refetchShoppingList();
                                message.success('Data refreshed');
                            }}>Refresh</Button>
                        </Tooltip>
                        <Tooltip title="Export to Excel">
                            <Button icon={<ExportOutlined />} onClick={exportOrders}>Export</Button>
                        </Tooltip>
                        <Tooltip title="Print current view">
                            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                        </Tooltip>
                    </div>
                </div>

                {/* ==================== KPI CARDS ==================== */}
                <div className="om-kpi-grid">
                    <div className={kpiCardClass}>
                        <div className="om-kpi-icon blue"><ShoppingOutlined /></div>
                        <div className="om-kpi-stats">
                            <div className="om-kpi-value">{totalOrders}</div>
                            <div className="om-kpi-label">Total Bookings</div>
                        </div>
                        <div className="om-kpi-trend up">+12%</div>
                    </div>
                    <div className={kpiCardClass}>
                        <div className="om-kpi-icon orange"><ClockCircleOutlined /></div>
                        <div className="om-kpi-stats">
                            <div className="om-kpi-value">{stats.pending_orders || 0}</div>
                            <div className="om-kpi-label">Pending Approvals</div>
                        </div>
                        <div className="om-kpi-trend warning">Needs attention</div>
                    </div>
                    <div className={kpiCardClass}>
                        <div className="om-kpi-icon green"><WalletOutlined /></div>
                        <div className="om-kpi-stats">
                            <div className="om-kpi-value">{formatCurrency(totalRevenue)}</div>
                            <div className="om-kpi-label">Total Revenue</div>
                        </div>
                        <div className="om-kpi-trend up">+8%</div>
                    </div>
                    <div className={kpiCardClass}>
                        <div className="om-kpi-icon purple"><DollarOutlined /></div>
                        <div className="om-kpi-stats">
                            <div className="om-kpi-value">{formatCurrency(stats.outstanding_balance || 0)}</div>
                            <div className="om-kpi-label">Outstanding Balance</div>
                        </div>
                        <div className="om-kpi-trend warning">Pending</div>
                    </div>
                </div>

                {/* ==================== MAIN CARD ==================== */}
                <Card className={mainCardClass} variant="borderless">
                    <Tabs
                        activeKey={activeMainTab}
                        onChange={(key) => {
                            setActiveMainTab(key);
                            if (key === 'orders') {
                                refetchOrders();
                                refetchStatistics();
                            } else if (key === 'kitchen') {
                                refetchKitchenOrders();
                            } else if (key === 'delivery') {
                                refetchDeliveryOrders();
                            } else if (key === 'ingredients') {
                                refetchShoppingList();
                            }
                        }}
                        className="om-tabs"
                        destroyInactiveTabPane={true}
                    >
                        {/* ==================== ORDERS TAB ==================== */}
                        <TabPane tab={<span><OrderedListOutlined /> All Orders</span>} key="orders">
                            <div className="om-tab-content">
                                <div className={filtersClass}>
                                    <div className={filterGroupClass}>
                                        <FilterOutlined />
                                        <Select value={filterStatus} onChange={setFilterStatus} className="om-filter-select" placeholder="Status">
                                            <Option value="all">All Status</Option>
                                            <Option value="pending">Pending</Option>
                                            <Option value="preparing">Preparing</Option>
                                            <Option value="ready">Ready</Option>
                                            <Option value="ongoing">Ongoing</Option>
                                            <Option value="completed">Completed</Option>
                                            <Option value="cancelled">Cancelled</Option>
                                        </Select>
                                    </div>
                                    <div className={filterGroupClass}>
                                        <CalendarOutlined />
                                        <DatePicker onChange={setSelectedDate} placeholder="Select Date" format="YYYY-MM-DD" allowClear className="om-date-picker" />
                                    </div>
                                    <div className={`${filterGroupClass} om-search`}>
                                        <SearchOutlined />
                                        <Input
                                            placeholder="Search by Booking ID or customer name..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            allowClear
                                            className="om-search-input"
                                        />
                                    </div>
                                </div>

                                <div className="om-table-container">
                                    <Spin spinning={isLoading} indicator={<LoadingOutlined spin />}>
                                        <Table
                                            columns={orderColumns}
                                            dataSource={orders}
                                            rowKey="id"
                                            className={tableClass}
                                            scroll={{ x: 1300 }}
                                            footer={
                                                orders.length === 0
                                                    ? () => renderEmptyPaginationFooter('orders')
                                                    : undefined
                                            }
                                            pagination={{
                                                current: currentPage,
                                                pageSize,
                                                total: ordersData?.total || orders.length,
                                                showSizeChanger: false,
                                                showTotal: (total) => `Total ${total} orders`,
                                                itemRender: renderPaginationItem,
                                                onChange: (page, size) => { setCurrentPage(page); if (size) setPageSize(size); }
                                            }}
                                        />
                                    </Spin>
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== KITCHEN PREP TAB ==================== */}
                        <TabPane tab={<span><MenuOutlined /> Kitchen Preparation</span>} key="kitchen">
                            <div className="om-tab-content">
                                <Alert
                                    message="Kitchen Production Management"
                                    description="Track and manage all kitchen preparation activities. Approved bookings appear here automatically as kitchen preparation checklists."
                                    type="info"
                                    showIcon
                                    className={alertClass}
                                />
                                <div className="om-table-container">
                                    {(!kitchenOrders || kitchenOrders.length === 0) ? (
                                        <Empty description="No active kitchen preparation records yet. Approved bookings will appear here automatically." />
                                    ) : (
                                        <Table
                                            dataSource={kitchenOrders}
                                            columns={kitchenPrepColumns}
                                            rowKey="id"
                                            className={tableClass}
                                            footer={
                                                kitchenOrders.length === 0
                                                    ? () => renderEmptyPaginationFooter('kitchen orders')
                                                    : undefined
                                            }
                                            pagination={{
                                                current: kitchenCurrentPage,
                                                pageSize: 5,
                                                total: kitchenOrders.length,
                                                showSizeChanger: false,
                                                showTotal: (total) => `Total ${total} orders`,
                                                itemRender: renderPaginationItem,
                                                onChange: (page, size) => { setKitchenCurrentPage(page); if (size) setKitchenPageSize(size); }
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== DELIVERY PREP TAB ==================== */}
                        <TabPane tab={<span><TruckOutlined /> Delivery Preparation</span>} key="delivery">
                            <div className="om-tab-content">
                                <Alert
                                    message="Delivery Coordination Center"
                                    description="Monitor delivery schedules and equipment readiness. Approved bookings appear here automatically. Add only the equipment/items needed for each event."
                                    type="info"
                                    showIcon
                                    className={alertClass}
                                />
                                <div className="om-table-container">
                                    {(!deliveryOrders || deliveryOrders.length === 0) ? (
                                        <Empty description="No active delivery preparation records yet. Approved bookings will appear here automatically." />
                                    ) : (
                                        <Table
                                            dataSource={deliveryOrders}
                                            columns={deliveryPrepColumns}
                                            rowKey="id"
                                            className={tableClass}
                                            footer={
                                                deliveryOrders.length === 0
                                                    ? () => renderEmptyPaginationFooter('delivery orders')
                                                    : undefined
                                            }
                                            pagination={{
                                                current: deliveryCurrentPage,
                                                pageSize: 5,
                                                total: deliveryOrders.length,
                                                showSizeChanger: false,
                                                showTotal: (total) => `Total ${total} orders`,
                                                itemRender: renderPaginationItem,
                                                onChange: (page, size) => { setDeliveryCurrentPage(page); if (size) setDeliveryPageSize(size); }
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </TabPane>

                        {/* ==================== INGREDIENTS TAB ==================== */}
                        <TabPane tab={<span><StockOutlined /> Ingredients Management</span>} key="ingredients">
                            <div className="om-tab-content">
                                <Alert
                                    message="Ingredients Management by Booking"
                                    description="Each approved booking has its own ingredient file. Open View to see the full event summary and the separate ingredients for each menu item."
                                    type="info"
                                    showIcon
                                    className={alertClass}
                                />

                                <div className={shoppingListClass}>
                                    <div className="om-section-header">
                                        <div className="om-section-header-left">
                                            <Title level={5}><ShoppingCartOutlined /> Booking Ingredient Files</Title>
                                        </div>
                                        <div className="om-section-header-right">
                                            <Badge
                                                count={orders.filter(order => order.has_unpurchased_ingredients).length}
                                                style={{ backgroundColor: '#ef4444' }}
                                                className="om-section-badge"
                                            />
                                            <Button
                                                size="small"
                                                icon={<ReloadOutlined />}
                                                onClick={() => { refetchOrders(); refetchShoppingList(); }}
                                                style={{ marginLeft: 8 }}
                                            >
                                                Refresh
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="om-shopping-table-wrapper">
                                        {orders && orders.length > 0 ? (
                                            <Table
                                                dataSource={orders}
                                                rowKey="id"
                                                columns={[
                                                    {
                                                        title: 'Booking ID',
                                                        width: 150,
                                                        render: (_, record) => <span className="om-id-text">{formatBookingId(record.booking_no)}</span>
                                                    },
                                                    {
                                                        title: 'Customer Name',
                                                        dataIndex: 'customer_name',
                                                        width: 200
                                                    },
                                                    {
                                                        title: 'Event Date',
                                                        dataIndex: 'event_date',
                                                        width: 130
                                                    },
                                                    {
                                                        title: 'Menu Items',
                                                        width: 120,
                                                        render: (_, record) => `${getMenuItems(record).length} item(s)`
                                                    },
                                                    {
                                                        title: 'Warning',
                                                        width: 120,
                                                        align: 'center',
                                                        render: (_, record) => record.has_unpurchased_ingredients ? (
                                                            <Tooltip title="Warning: Some ingredients for this booking are not yet purchased.">
                                                                <Tag color="error" icon={<WarningOutlined />}>Unpurchased</Tag>
                                                            </Tooltip>
                                                        ) : <Tag color="success">OK</Tag>
                                                    },
                                                    {
                                                        title: 'Action',
                                                        width: 120,
                                                        align: 'center',
                                                        render: (_, record) => (
                                                            <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => handleViewIngredients(record)}>
                                                                View
                                                            </Button>
                                                        )
                                                    }
                                                ]}
                                                pagination={{ pageSize: 8, showSizeChanger: false }}
                                                className={tableClass}
                                            />
                                        ) : (
                                            <Empty description="No approved booking ingredient files yet." />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabPane>

                    </Tabs>
                </Card>

                {/* ============================================================
                    ORDER DETAILS MODAL
                ============================================================ */}
                <Modal
                    title={
                        <div className="om-modal-header-clean">
                            <div className="om-modal-title-icon"><EyeOutlined /></div>
                            <div className="om-modal-title-text">Order Details</div>
                            <div className="om-modal-badge">{formatBookingId(selectedOrder?.booking_no)}</div>
                        </div>
                    }
                    open={orderDetailsModalVisible}
                    onCancel={() => setOrderDetailsModalVisible(false)}
                    width={800}
                    className={modalClass}
                    footer={
                        <div className="om-modal-footer-simple">
                            <Button type="primary" onClick={() => setOrderDetailsModalVisible(false)}>
                                Close
                            </Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedOrder && (
                        <div className="om-modal-clean-content">
                            {/* Header Tags */}
                            <div className="om-modal-header-tags">
                                <span className="om-id-text">{formatBookingId(selectedOrder.booking_no)}</span>
                                <span className="om-status" style={{ color: getStatusConfig(selectedOrder.order_status).color, background: getStatusConfig(selectedOrder.order_status).bg }}>
                                    {getStatusConfig(selectedOrder.order_status).icon} {getStatusConfig(selectedOrder.order_status).text}
                                </span>
                            </div>

                            {/* Customer Information */}
                            <div className="om-clean-section">
                                <div className="om-clean-section-title"><UserOutlined /> Customer Information</div>
                                <div className="om-clean-grid">
                                    <div><span className="om-clean-label">Name:</span> {selectedOrder.customer_name}</div>
                                    <div><span className="om-clean-label">Email:</span> {selectedOrder.customer_email}</div>
                                    <div><span className="om-clean-label">Phone:</span> {selectedOrder.customer_phone}</div>
                                    <div><span className="om-clean-label">Address:</span> {selectedOrder.customer_address || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Event Information */}
                            <div className="om-clean-section">
                                <div className="om-clean-section-title"><CalendarOutlined /> Event Information</div>
                                <div className="om-clean-grid">
                                    <div><span className="om-clean-label">Event Type:</span> {selectedOrder.event_type}</div>
                                    <div><span className="om-clean-label">Event Date:</span> {selectedOrder.event_date} at {selectedOrder.event_time}</div>
                                    <div><span className="om-clean-label">Venue:</span> {selectedOrder.venue}</div>
                                    <div><span className="om-clean-label">Guests:</span> {selectedOrder.guests_count} PAX</div>
                                </div>
                            </div>

                            {selectedOrder.package_details && (
                                <div className="om-clean-section">
                                    <div className="om-clean-section-title"><ShoppingOutlined /> Package Details: {selectedOrder.package_details.name}</div>
                                    <div className="om-menu-items-table">
                                        <div className="om-menu-header">
                                            <span>Menu Item</span>
                                            <span>Quantity</span>
                                            <span>Category</span>
                                            <span>Package Association</span>
                                        </div>
                                        {safeArray(selectedOrder.package_details.menu_items).map((item, idx) => (
                                            <div key={`${item.menu_item_id || idx}-package-item`} className="om-menu-row">
                                                <span className="om-menu-name">{item.name}</span>
                                                <span>{item.quantity}</span>
                                                <span>{item.category || 'N/A'}</span>
                                                <span>{item.package_association || selectedOrder.package_details.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Menu Items - grouped by day and meal type */}
                            <div className="om-clean-section">
                                <div className="om-clean-section-title"><ShoppingOutlined /> Menu Items by Day / Meal Type</div>
                                {groupMenuItemsByDay(selectedOrder).map((group, groupIndex) => (
                                    <div key={group.label || groupIndex} className="om-menu-items-table" style={{ marginBottom: 16 }}>
                                        <div style={{ padding: '8px 12px', fontWeight: 700, background: '#f8fafc', border: '1px solid #e5e7eb', borderBottom: 0 }}>
                                            {group.label}
                                        </div>
                                        <div className="om-menu-header">
                                            <span>Meal Type</span>
                                            <span>Item Name</span>
                                            <span>Quantity</span>
                                            <span>Unit Price</span>
                                            <span>Subtotal</span>
                                        </div>
                                        {group.items.map((item, idx) => (
                                            <div key={idx} className="om-menu-row">
                                                <span className="om-menu-name">{item.meal_type || 'General'}</span>
                                                <span className="om-menu-name">{item.name}</span>
                                                <span className="om-menu-qty">{item.quantity}</span>
                                                <span className="om-menu-price">{formatCurrency(item.price)}</span>
                                                <span className="om-menu-subtotal">{formatCurrency(item.subtotal)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <div className="om-menu-total" style={{ background: '#f0f9ff', padding: '12px 20px', border: '2px solid #3b82f6', borderRadius: 8, marginTop: 8 }}>
                                    <span style={{ fontSize: 16, fontWeight: 600 }}>Total Order Amount</span>
                                    <strong style={{ fontSize: 20, color: '#1a56db' }}>{formatCurrency(selectedOrder.total_amount)}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* ============================================================
                    EDIT ORDER MODAL
                ============================================================ */}
                <Modal
                    title={
                        <div className="om-modal-header-clean">
                            <div className="om-modal-title-icon"><EditOutlined /></div>
                            <div className="om-modal-title-text">Edit Order</div>
                            <div className="om-modal-badge">{formatBookingId(selectedOrder?.booking_no)}</div>
                        </div>
                    }
                    open={editOrderModalVisible}
                    onCancel={() => {
                        setEditOrderModalVisible(false);
                        setSelectedOrder(null);
                        editOrderForm.resetFields();
                    }}
                    width={700}
                    className={modalClass}
                    footer={
                        <div className="om-modal-footer-simple">
                            <Button onClick={() => {
                                setEditOrderModalVisible(false);
                                setSelectedOrder(null);
                                editOrderForm.resetFields();
                            }}>Cancel</Button>
                            <Button type="primary" onClick={() => editOrderForm.submit()}>Save Changes</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="om-modal-clean-content">
                        <Form form={editOrderForm} layout="vertical" onFinish={handleUpdateOrder}>
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
                                    <Form.Item name="customer_address" label="Address">
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item name="event_type" label="Event Type" rules={[{ required: true }]}>
                                        <Select>
                                            <Option value="Wedding">Wedding</Option>
                                            <Option value="Birthday">Birthday</Option>
                                            <Option value="Corporate">Corporate</Option>
                                            <Option value="Anniversary">Anniversary</Option>
                                            <Option value="Seminar">Seminar</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="event_date" label="Event Date" rules={[{ required: true }]}>
                                        <DatePicker style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
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
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="venue" label="Venue" rules={[{ required: true }]}>
                                        <Input placeholder="Event location" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="guests_count" label="Number of Guests" rules={[{ required: true }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} placeholder="Total pax" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="total_amount" label="Total Amount" rules={[{ required: true }]}>
                                <InputNumber min={0} style={{ width: '100%' }} prefix="₱" placeholder="0.00" step={0.01} />
                            </Form.Item>
                            <Form.Item name="special_requests" label="Special Requests">
                                <TextArea rows={3} placeholder="Any special requests or notes..." />
                            </Form.Item>
                        </Form>
                    </div>
                </Modal>

                {/* ============================================================
                    KITCHEN PREP MODAL - FIXED UI ALIGNMENT
                ============================================================ */}
                <Modal
                    title={
                        <div className="om-modal-header-clean">
                            <div className="om-modal-title-icon"><MenuOutlined /></div>
                            <div className="om-modal-title-text">Kitchen Production Tasks</div>
                            <div className="om-modal-badge">{formatBookingId(selectedOrder?.booking_no)}</div>
                        </div>
                    }
                    open={kitchenModalVisible}
                    onCancel={() => setKitchenModalVisible(false)}
                    width={1100}
                    className={modalClass}
                    footer={
                        <div className="om-modal-footer-simple">
                            <Button type="primary" icon={<PrinterOutlined />} onClick={() => printKitchenTasks(kitchenTasks)}>
                                Print Tasks
                            </Button>
                            <Button onClick={() => setKitchenModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="om-modal-clean-content" style={{ padding: 0, background: 'transparent' }}>
                        {/* ===== HEADER SECTION ===== */}
                        {kitchenTasks.filter(t => t.is_header).map((header, idx) => (
                            <div key={idx} className="om-kitchen-header-card" style={{ margin: '0 20px 20px 20px' }}>
                                <div className="om-kitchen-header-icon"><CrownOutlined /></div>
                                <div className="om-kitchen-header-info">
                                    <h3 className="om-kitchen-header-title">{header.task}</h3>
                                    <div className="om-kitchen-header-meta">
                                        <span><UserOutlined /> {header.customer}</span>
                                        <span><CalendarOutlined /> {header.event_date}</span>
                                        <span><ScheduleOutlined /> {header.event_time}</span>
                                        <span><EnvironmentOutlined /> {header.venue}</span>
                                        <span><TeamOutlined /> {header.guests} PAX</span>
                                    </div>
                                </div>
                                <div className="om-kitchen-header-status">
                                    <Badge status="processing" text="In Progress" />
                                    <span className="om-task-count">
                                        {kitchenTasks.filter(t => !t.is_header).length} Tasks
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* ===== TASKS TABLES BY DAY / MEAL TYPE ===== */}
                        {groupKitchenTasksByMeal(kitchenTasks).map((group, groupIndex) => (
                            <div key={group.label || groupIndex} className="om-kitchen-table-wrapper" style={{ margin: '0 20px 20px 20px' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    padding: '10px 16px', 
                                    fontWeight: 700, 
                                    background: isDarkMode ? '#1e293b' : '#f8fafc',
                                    borderBottom: '1px solid var(--om-border)',
                                    fontSize: '14px',
                                    color: 'var(--om-text)'
                                }}>
                                    <span>{group.label}</span>
                                    <Button size="small" icon={<PrinterOutlined />} onClick={() => printKitchenTasks(group.tasks)}>
                                        Print this file
                                    </Button>
                                </div>
                                
                                {/* ===== TABLE HEADER ===== */}
                                <div className="om-kitchen-table-header" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 0.7fr 0.9fr 0.9fr 1.2fr 0.8fr',
                                    background: isDarkMode ? '#0f172a' : '#f1f5f9',
                                    padding: '8px 16px',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    color: 'var(--om-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    borderBottom: '2px solid var(--om-primary)'
                                }}>
                                    <span>TASK</span>
                                    <span>QTY</span>
                                    <span>START</span>
                                    <span>OUT FOR DELIVERY</span>
                                    <span>ASSIGNED TO</span>
                                    <span>DONE</span>
                                </div>
                                
                                {/* ===== TABLE BODY ===== */}
                                <div className="om-kitchen-table-body" style={{ overflow: 'visible' }}>
                                    {group.tasks.map((task, idx) => (
                                        <div key={task.id || idx} className={`om-kitchen-table-row ${task.type === 'completion' ? 'completion-row' : ''}`} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 0.7fr 0.9fr 0.9fr 1.2fr 0.8fr',
                                            padding: '10px 16px',
                                            borderBottom: '1px solid var(--om-border)',
                                            alignItems: 'center',
                                            transition: 'background 0.2s ease',
                                            background: isDarkMode ? '#1e293b' : '#ffffff'
                                        }}>
                                            <div className="om-col-task" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                <span className="om-task-name" style={{ fontWeight: 500, fontSize: '13px', color: 'var(--om-text)' }}>{task.task}</span>
                                            </div>
                                            <div className="om-col-qty" style={{ fontSize: '13px', color: 'var(--om-text)' }}>{task.quantity || '-'}</div>
                                            <div className="om-col-time" style={{ fontSize: '13px', color: 'var(--om-text)' }}>{task.start_time || '-'}</div>
                                            <div className="om-col-time" style={{ fontSize: '13px', color: 'var(--om-text)' }}>{task.out_for_delivery || task.end_time || task.deadline || '-'}</div>
                                            <div className="om-col-assignee" style={{ fontSize: '13px', color: 'var(--om-text)' }}>{task.assigned_to || 'Kitchen Team'}</div>
                                            <div className="om-col-action" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Checkbox 
                                                    checked={Boolean(task.is_done || task.status === 'completed')} 
                                                    onChange={(e) => handleUpdateKitchenTask(task.id, { is_done: e.target.checked, status: e.target.checked ? 'completed' : 'pending' })} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>

                {/* ============================================================
                    DELIVERY PREP MODAL - FIXED UI ALIGNMENT
                ============================================================ */}
                <Modal
                    title={
                        <div className="om-modal-header-clean">
                            <div className="om-modal-title-icon"><TruckOutlined /></div>
                            <div className="om-modal-title-text">Delivery Preparation Items</div>
                            <div className="om-modal-badge">{formatBookingId(selectedOrder?.booking_no)}</div>
                        </div>
                    }
                    open={deliveryModalVisible}
                    onCancel={() => {
                        setDeliveryModalVisible(false);
                        setShowAddDeliveryItem(false);
                    }}
                    width={1100}
                    className={modalClass}
                    footer={
                        <div className="om-modal-footer-simple">
                            <Button icon={<PrinterOutlined />} onClick={() => printDeliveryItems(deliveryItems)}>
                                Print Delivery List
                            </Button>
                            <Button onClick={() => setDeliveryModalVisible(false)}>Close</Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="om-modal-clean-content" style={{ padding: 0, background: 'transparent' }}>
                        {/* ===== ADD DELIVERY SECTION ===== */}
                        <div className="om-add-delivery-section" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 20px',
                            background: isDarkMode ? '#1e293b' : '#f8fafc',
                            border: '1px solid var(--om-border)',
                            borderRadius: '12px',
                            margin: '0 20px 16px 20px',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div className="om-add-delivery-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <PlusOutlined className="om-add-icon" style={{ fontSize: '18px', color: 'var(--om-primary)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--om-primary-soft)', borderRadius: '8px' }} />
                                <span className="om-add-title" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--om-text)' }}>Add Delivery Item</span>
                            </div>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    setShowAddDeliveryItem(true);
                                    loadAvailableEquipment();
                                }}
                            >
                                Add Item
                            </Button>
                        </div>

                        {/* ===== INVENTORY SELECTION MODAL ===== */}
                        <Modal
                            title="Select Inventory Items"
                            open={showAddDeliveryItem}
                            onCancel={() => { setShowAddDeliveryItem(false); setSelectedEquipment({}); }}
                            footer={null}
                            width={900}
                            destroyOnHidden={false}
                        >
                            <div className="om-add-delivery-form" style={{
                                padding: '16px 20px',
                                background: 'var(--om-surface)',
                                border: '1px solid var(--om-border)',
                                borderRadius: '12px',
                                margin: 0
                            }}>
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Choose equipment from Inventory"
                                    description="Equipment is reserved for this booking date/time first. Total inventory is not deducted until the event is completed or equipment is released."
                                    style={{ marginBottom: 12 }}
                                />
                                <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                                    <Input.Search
                                        placeholder="Search equipment..."
                                        value={equipmentSearch}
                                        onChange={(e) => setEquipmentSearch(e.target.value)}
                                        onSearch={loadAvailableEquipment}
                                        style={{ width: 280 }}
                                    />
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
                                                return (
                                                    <Checkbox
                                                        checked={Boolean(selectedEquipment[id])}
                                                        onChange={(e) => toggleEquipmentSelection(equipment, e.target.checked)}
                                                    />
                                                );
                                            }
                                        },
                                        {
                                            title: 'Equipment',
                                            render: (_, equipment) => equipment.name || equipment.item_name || equipment.equipment_name || 'Equipment'
                                        },
                                        {
                                            title: 'Total Qty',
                                            width: 100,
                                            render: (_, equipment) => equipment.total_quantity || 0
                                        },
                                        {
                                            title: 'Available',
                                            width: 100,
                                            render: (_, equipment) => equipment.available_quantity ?? equipment.available ?? 0
                                        },
                                        {
                                            title: 'Qty Needed',
                                            width: 140,
                                            render: (_, equipment) => {
                                                const id = equipment.id || equipment.equipment_id;
                                                return (
                                                    <InputNumber
                                                        min={1}
                                                        max={equipment.available_quantity ?? equipment.available ?? 999}
                                                        value={selectedEquipment[id]?.quantity || 1}
                                                        onChange={(value) => updateSelectedEquipmentQty(equipment, value)}
                                                        onFocus={() => !selectedEquipment[id] && toggleEquipmentSelection(equipment, true)}
                                                        style={{ width: '100%' }}
                                                    />
                                                );
                                            }
                                        }
                                    ]}
                                />
                                <div style={{ marginTop: 12, textAlign: 'right' }}>
                                    <Button style={{ marginRight: 8 }} onClick={() => { setShowAddDeliveryItem(false); setSelectedEquipment({}); }}>
                                        Cancel
                                    </Button>
                                    <Button type="primary" icon={<SaveOutlined />} onClick={handleAddDeliveryItem}>
                                        Save Selected Equipment
                                    </Button>
                                </div>
                            </div>
                        </Modal>

                        {/* ===== DELIVERY TABLE ===== */}
                        <div className="om-delivery-table-wrapper" style={{ margin: '0 20px 16px 20px' }}>
                            {/* ===== TABLE HEADER ===== */}
                            <div className="om-delivery-table-header" style={{
                                display: 'grid',
                                gridTemplateColumns: '1.8fr 0.9fr 0.9fr 0.9fr 0.7fr 0.8fr',
                                background: isDarkMode ? '#0f172a' : '#f1f5f9',
                                padding: '8px 16px',
                                fontWeight: 600,
                                fontSize: '12px',
                                color: 'var(--om-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                borderBottom: '2px solid var(--om-primary)'
                            }}>
                                <span>ITEM</span>
                                <span>QTY</span>
                                <span>SCHEDULED</span>
                                <span>AVAILABLE</span>
                                <span>READY</span>
                                <span>DELETE</span>
                            </div>
                            
                            {/* ===== TABLE BODY ===== */}
                            <div className="om-delivery-table-body" style={{ overflow: 'visible' }}>
                                {deliveryItems.length === 0 ? (
                                    <div className="om-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                                        <Empty description="No delivery items added. Click 'Add Item' to add delivery items." />
                                    </div>
                                ) : (
                                    deliveryItems
                                        .slice((deliveryCurrentPage - 1) * deliveryPageSize, deliveryCurrentPage * deliveryPageSize)
                                        .map((item, idx) => (
                                            <div key={item.id || idx} className="om-delivery-table-row" style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1.8fr 0.9fr 0.9fr 0.9fr 0.7fr 0.8fr',
                                                padding: '10px 16px',
                                                borderBottom: '1px solid var(--om-border)',
                                                alignItems: 'center',
                                                transition: 'background 0.2s ease',
                                                background: isDarkMode ? '#1e293b' : '#ffffff'
                                            }}>
                                                <div className="om-col-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    <span className="om-item-name" style={{ fontWeight: 500, fontSize: '13px', color: 'var(--om-text)' }}>{item.item}</span>
                                                </div>
                                                <div className="om-col-qty" style={{ fontSize: '13px', color: 'var(--om-text)' }}>{item.quantity}</div>
                                                <div className="om-col-time" style={{ fontSize: '13px', color: 'var(--om-text)' }}>{item.scheduled_time || '-'}</div>
                                                <div className="om-col-available" style={{ fontSize: '13px', color: (item.available_quantity || 0) > 0 ? '#10b981' : '#ef4444' }}>
                                                    {item.available_quantity ?? item.total_quantity ?? '-'}
                                                </div>
                                                <div className="om-col-action" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Checkbox
                                                        checked={Boolean(item.is_ready || item.status === 'ready' || item.status === 'completed')}
                                                        onChange={(e) => handleUpdateDeliveryItem(item.id, { is_ready: e.target.checked, status: e.target.checked ? 'ready' : 'pending' })}
                                                    />
                                                </div>
                                                <div className="om-col-action" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Popconfirm
                                                        title="Remove this item?"
                                                        onConfirm={() => {
                                                            const updatedItems = deliveryItems.filter(i => i.id !== item.id);
                                                            setDeliveryItems(updatedItems);
                                                            updateDeliveryItemMutation.mutateAsync({
                                                                orderId: selectedOrder?.id,
                                                                data: { items: updatedItems }
                                                            });
                                                        }}
                                                    >
                                                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                                    </Popconfirm>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        {/* ===== PAGINATION ===== */}
                        {deliveryItems.length > 0 && (
                            <div className="om-delivery-pagination" style={{ margin: '0 20px 16px 20px', textAlign: 'right', padding: '8px 0' }}>
                                <Pagination
                                    current={deliveryCurrentPage}
                                    pageSize={deliveryPageSize}
                                    total={deliveryItems.length}
                                    onChange={(page, size) => {
                                        setDeliveryCurrentPage(page);
                                        if (size) setDeliveryPageSize(size);
                                    }}
                                    showSizeChanger={false}
                                    showTotal={(total) => `Total ${total} items`}
                                />
                            </div>
                        )}
                    </div>
                </Modal>

                {/* ============================================================
                    INGREDIENT COMPUTATION MODAL
                ============================================================ */}
                <Modal
                    title={
                        <div className="om-modal-header-clean">
                            <div className="om-modal-title-icon"><StockOutlined /></div>
                            <div className="om-modal-title-text">Ingredient Requirements</div>
                            <div className="om-modal-badge">{formatBookingId(selectedOrderForIngredients?.booking_no)}</div>
                        </div>
                    }
                    open={ingredientsModalVisible}
                    onCancel={() => setIngredientsModalVisible(false)}
                    width={950}
                    className={modalClass}
                    footer={
                        <div className="om-modal-footer-simple">
                            <Button onClick={() => setIngredientsModalVisible(false)}>Close</Button>
                            <Button
                                icon={<CheckCircleOutlined />}
                                onClick={handleMarkSelectedIngredientsPurchased}
                                loading={isMarkingPurchased}
                                disabled={selectedIngredientIds.length === 0}
                            >
                                Mark Selected Purchased ({selectedIngredientIds.length})
                            </Button>
                            <Button
                                icon={<CheckCircleOutlined />}
                                onClick={handleMarkAllIngredientsPurchased}
                                loading={isMarkingPurchased}
                                disabled={computedIngredients.length === 0 || !computedIngredients.some(i => i.need_to_buy)}
                            >
                                Mark All Purchased
                            </Button>
                            <Button
                                type="primary"
                                icon={<ShoppingCartOutlined />}
                                onClick={() => handleAddToShoppingList(selectedOrderForIngredients?.id, computedIngredients)}
                                loading={addToShoppingListMutation.isLoading}
                                disabled={computedIngredients.length === 0 || !computedIngredients.some(i => i.need_to_buy)}
                            >
                                Add to Purchase List ({computedIngredients.filter(i => i.need_to_buy).length})
                            </Button>
                            <Button icon={<ExportOutlined />} onClick={() => {
                                const columns = [
                                    { title: 'INGREDIENT', dataIndex: 'name' },
                                    { title: 'QUANTITY NEEDED', dataIndex: 'quantity_needed' },
                                    { title: 'UNIT', dataIndex: 'unit' },
                                    { title: 'CURRENT STOCK', dataIndex: 'current_stock' },
                                    { title: 'SHORTAGE', dataIndex: 'shortage' },
                                    { title: 'STATUS', dataIndex: 'status' }
                                ];
                                exportToExcel(computedIngredients, 'Ingredient_Requirements', columns);
                            }} disabled={computedIngredients.length === 0}>
                                Export
                            </Button>
                        </div>
                    }
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedOrderForIngredients && (
                        <div className="om-modal-clean-content">
                            <div className="om-order-summary">
                                <Row gutter={16}>
                                    <Col span={6}>
                                        <div className="om-summary-box">
                                            <span className="om-summary-label">Booking ID</span>
                                            <span className="om-summary-value">
                                                <span className="om-id-text">{formatBookingId(selectedOrderForIngredients.booking_no)}</span>
                                            </span>
                                        </div>
                                    </Col>
                                    <Col span={6}>
                                        <div className="om-summary-box">
                                            <span className="om-summary-label">Customer</span>
                                            <span className="om-summary-value">{selectedOrderForIngredients.customer_name}</span>
                                        </div>
                                    </Col>
                                    <Col span={6}>
                                        <div className="om-summary-box">
                                            <span className="om-summary-label">Event Date</span>
                                            <span className="om-summary-value">{selectedOrderForIngredients.event_date}</span>
                                        </div>
                                    </Col>
                                    <Col span={6}>
                                        <div className="om-summary-box">
                                            <span className="om-summary-label">Total Guests</span>
                                            <span className="om-summary-value">{selectedOrderForIngredients.guests_count} PAX</span>
                                        </div>
                                    </Col>
                                </Row>
                            </div>

                            <div className="om-clean-section">
                                <div className="om-clean-section-title"><ShoppingOutlined /> Menu Items Ordered</div>
                                <div className="om-menu-items-table">
                                    <div className="om-menu-header">
                                        <span>Meal Type / Day</span>
                                        <span>Menu Item</span>
                                        <span>Quantity</span>
                                        <span>Unit Price</span>
                                        <span>Subtotal</span>
                                        <span>Action</span>
                                    </div>
                                    {getMenuItems(selectedOrderForIngredients).map((item, idx) => (
                                        <div key={idx} className="om-menu-row">
                                            <span className="om-menu-name">{item.meal_type ? `${item.service_date || ''} ${item.meal_type} ${item.serving_time || ''}` : 'General'}</span>
                                            <span className="om-menu-name">{item.name}</span>
                                            <span className="om-menu-qty">{item.quantity}</span>
                                            <span className="om-menu-price">{formatCurrency(item.price)}</span>
                                            <span className="om-menu-subtotal">{formatCurrency(item.subtotal)}</span>
                                            <span>
                                                <Button size="small" icon={<EyeOutlined />} onClick={() => handleShowMenuIngredients(item)}>
                                                    View Ingredients
                                                </Button>
                                            </span>
                                        </div>
                                    ))}
                                    <div className="om-menu-total">
                                        <span>Total Order Amount</span>
                                        <strong>{formatCurrency(selectedOrderForIngredients.total_amount)}</strong>
                                    </div>
                                </div>
                            </div>

                            <Divider />

                            <div className="om-clean-section">
                                <div className="om-clean-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span><StockOutlined /> {ingredientViewTitle}</span>
                                    {ingredientViewTitle !== 'Full Event Ingredients Summary' && (
                                        <Button size="small" onClick={handleShowFullIngredientSummary}>Show Full Summary</Button>
                                    )}
                                </div>
                                {isComputingIngredients ? (
                                    <div className="om-loading-container" style={{ padding: '40px', textAlign: 'center' }}>
                                        <Spin tip="Computing ingredient requirements..." />
                                        <p style={{ marginTop: 16, color: '#64748b' }}>Please wait while we calculate all required ingredients...</p>
                                    </div>
                                ) : computedIngredients.length === 0 ? (
                                    <Empty
                                        description="No ingredients computed yet. Click 'Ingredient Requirements' from the order to calculate."
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                ) : (
                                    <div className="om-ingredients-table">
                                        <div className="om-ingredients-header">
                                            <span>Select</span>
                                            <span>Ingredient</span>
                                            <span>Meal Type</span>
                                            <span>Per Pax</span>
                                            <span>Total Needed</span>
                                            <span>Current Stock</span>
                                            <span>Reserved</span>
                                            <span>Available</span>
                                            <span>Shortage</span>
                                            <span>Status</span>
                                        </div>
                                        {computedIngredients.map((ing, idx) => (
                                            <div key={ing.ingredient_id || idx} className={`om-ingredients-row ${ing.status}`}>
                                                <span>
                                                    <Checkbox
                                                        checked={selectedIngredientIds.includes(ing.ingredient_id)}
                                                        disabled={!ing.need_to_buy || ing.purchased}
                                                        onChange={(e) => {
                                                            setSelectedIngredientIds(prev => e.target.checked
                                                                ? [...new Set([...prev, ing.ingredient_id])]
                                                                : prev.filter(id => id !== ing.ingredient_id)
                                                            );
                                                        }}
                                                    />
                                                </span>
                                                <span className="om-ingredient-name">{ing.name}</span>
                                                <span>{safeArray(ing.menu_items).map(mi => mi.meal_type).filter(Boolean).join(', ') || '-'}</span>
                                                <span>{ing.per_pax} {ing.unit}</span>
                                                <span className="om-ingredient-needed">{Math.round(ing.quantity_needed * 100) / 100} {ing.unit}</span>
                                                <span>{Math.round(ing.current_stock * 100) / 100} {ing.unit}</span>
                                                <span>{Math.round(ing.reserved_quantity * 100) / 100} {ing.unit}</span>
                                                <span className={ing.available_stock >= ing.quantity_needed ? 'om-available' : 'om-unavailable'}>
                                                    {Math.round(ing.available_stock * 100) / 100} {ing.unit}
                                                </span>
                                                <span>
                                                    {ing.shortage > 0 ?
                                                        <span className="om-shortage">{Math.round(ing.shortage * 100) / 100} {ing.unit}</span> :
                                                        <span className="om-sufficient">Sufficient</span>
                                                    }
                                                </span>
                                                <span>
                                                    {ing.purchased ?
                                                        <Tag color="success">Purchased</Tag> :
                                                        ing.need_to_buy ?
                                                            <Tag color="error">Need to Buy</Tag> :
                                                            <Tag color="success">In Stock</Tag>
                                                    }
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {computedIngredients.length > 0 && !isComputingIngredients && (
                                    <div className="om-ingredients-summary" style={{ marginTop: 16, padding: 12, background: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
                                        <Row gutter={16}>
                                            <Col span={8}>
                                                <Statistic
                                                    title="Total Ingredients"
                                                    value={computedIngredients.length}
                                                    suffix="items"
                                                />
                                            </Col>
                                            <Col span={8}>
                                                <Statistic
                                                    title="Need to Buy"
                                                    value={computedIngredients.filter(i => i.need_to_buy).length}
                                                    suffix="items"
                                                    valueStyle={{ color: '#ef4444' }}
                                                />
                                            </Col>
                                            <Col span={8}>
                                                <Statistic
                                                    title="Total Shortage"
                                                    value={computedIngredients.reduce((sum, i) => sum + (i.shortage || 0), 0)}
                                                    suffix="units"
                                                    valueStyle={{ color: '#f97316' }}
                                                />
                                            </Col>
                                        </Row>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* ============================================================
                    STATUS UPDATE MODAL
                ============================================================ */}
                <Modal
                    title={
                        <div className="om-modal-header-clean">
                            <div className="om-modal-title-icon"><PlayCircleOutlined /></div>
                            <div className="om-modal-title-text">Update Order Status</div>
                            <div className="om-modal-badge">{formatBookingId(selectedOrder?.booking_no)}</div>
                        </div>
                    }
                    open={statusUpdateModalVisible}
                    onCancel={() => setStatusUpdateModalVisible(false)}
                    width={450}
                    className={modalClass}
                    footer={null}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="om-modal-clean-content">
                        <div className="om-status-buttons">
                            {['pending', 'preparing', 'ready', 'ongoing', 'completed', 'cancelled'].map(status => {
                                const config = getStatusConfig(status);
                                return (
                                    <button
                                        key={status}
                                        className={`om-status-btn ${selectedOrder?.order_status === status ? 'active' : ''}`}
                                        onClick={() => handleConfirmStatusUpdate(status)}
                                        style={{ borderColor: config.color, color: config.color, background: config.bg }}
                                    >
                                        {config.icon} {config.text}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="om-status-cancel">
                            <Button onClick={() => setStatusUpdateModalVisible(false)}>Cancel</Button>
                        </div>
                    </div>
                </Modal>

            </div>
        </ConfigProvider>
    );
};

export default OrderManagement;