// src/features/notifications/pages/NotificationPage.jsx - REDESIGNED PROFESSIONAL UI

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Badge, Button, Avatar, Empty, Typography, Space, Tag, Tooltip, 
    Checkbox, Input, Select, Pagination, Modal, message, Dropdown, 
    Tabs, Divider, ConfigProvider, theme as antdTheme, Spin, Card, 
    Row, Col, Statistic, Alert, Progress, Switch, Collapse,
    DatePicker, Slider, Radio, Drawer, Timeline
} from 'antd';
import { 
    BellOutlined, CheckCircleOutlined, CloseCircleOutlined, 
    InfoCircleOutlined, WarningOutlined, DeleteOutlined, CheckOutlined, 
    StarOutlined, StarFilled, MailOutlined, InboxOutlined, 
    ClockCircleOutlined, SearchOutlined, MoreOutlined, EyeOutlined, 
    FlagOutlined, FilterOutlined, ReloadOutlined, SettingOutlined,
    ShoppingOutlined, CalendarOutlined, TeamOutlined, DollarOutlined,
    FileTextOutlined, TruckOutlined, UserOutlined, ToolOutlined,
    LockOutlined, SyncOutlined, ShoppingCartOutlined, ExportOutlined,
    MenuFoldOutlined, MenuUnfoldOutlined, ThunderboltOutlined,
    UpOutlined, DownOutlined, LeftOutlined, RightOutlined,
    RiseOutlined, TrophyOutlined, CrownOutlined, GiftOutlined,
    AppstoreOutlined, TagOutlined, FireOutlined, SoundOutlined,
    PushpinOutlined, ReadOutlined, ClearOutlined,
    BookOutlined, FolderOpenOutlined, CloudDownloadOutlined,
    NotificationOutlined
} from '@ant-design/icons';
import api from '../../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import '../styles/notification.css';
import { 
    useNotifications, 
    useUnreadCount, 
    useMarkNotificationRead, 
    useDeleteNotification, 
    useMarkAllRead, 
    useToggleStar 
} from '../../../hooks/useNotificationQueries';

dayjs.extend(relativeTime);

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ==================== HELPERS ====================
const getNotificationId = (notification) => {
    return notification?.notification_id || notification?.id;
};

const isNewNotification = (createdAt) => {
    if (!createdAt) return false;
    const now = dayjs();
    const created = dayjs(createdAt);
    const diffMinutes = now.diff(created, 'minutes');
    return diffMinutes < 5;
};

// ==================== ICON CONFIG ====================
const getNotificationIcon = (type, priority) => {
    const iconStyle = { fontSize: 20 };
    
    if (!type) return <InfoCircleOutlined style={{ ...iconStyle, color: '#1a7ab5' }} />;
    
    const typeLower = type.toLowerCase();
    
    // Booking related
    if (typeLower.includes('booking') || typeLower === 'booking_request' || typeLower === 'booking_submitted') 
        return <CalendarOutlined style={{ ...iconStyle, color: '#1a7ab5' }} />;
    if (typeLower === 'booking_approved' || typeLower === 'booking_confirmed') 
        return <CheckCircleOutlined style={{ ...iconStyle, color: '#10b981' }} />;
    if (typeLower === 'booking_rejected' || typeLower === 'booking_cancelled') 
        return <CloseCircleOutlined style={{ ...iconStyle, color: '#ef4444' }} />;
    if (typeLower === 'booking_rescheduled') 
        return <SyncOutlined style={{ ...iconStyle, color: '#f59e0b' }} />;
    
    // Inventory related
    if (typeLower.includes('inventory') || typeLower === 'low_stock' || typeLower === 'critical_stock') 
        return <WarningOutlined style={{ ...iconStyle, color: '#f59e0b' }} />;
    if (typeLower === 'out_of_stock') 
        return <CloseCircleOutlined style={{ ...iconStyle, color: '#ef4444' }} />;
    if (typeLower === 'purchase_request_generated' || typeLower === 'insufficient_inventory') 
        return <ShoppingCartOutlined style={{ ...iconStyle, color: '#ef4444' }} />;
    
    // Equipment
    if (typeLower.includes('equipment')) 
        return <ToolOutlined style={{ ...iconStyle, color: '#1a7ab5' }} />;
    
    // Orders
    if (typeLower === 'order_ready') 
        return <CheckCircleOutlined style={{ ...iconStyle, color: '#10b981' }} />;
    
    // Events
    if (typeLower.includes('event')) 
        return <CalendarOutlined style={{ ...iconStyle, color: '#f59e0b' }} />;
    
    // Staff & Schedule
    if (typeLower.includes('schedule') || typeLower.includes('staff')) 
        return <TeamOutlined style={{ ...iconStyle, color: '#1a7ab5' }} />;
    
    // Payroll
    if (typeLower.includes('payroll') || typeLower.includes('overtime')) 
        return <DollarOutlined style={{ ...iconStyle, color: '#10b981' }} />;
    
    // Payments
    if (typeLower.includes('payment')) 
        return <DollarOutlined style={{ ...iconStyle, color: '#10b981' }} />;
    
    // Reviews
    if (typeLower === 'customer_review') 
        return <StarOutlined style={{ ...iconStyle, color: '#f59e0b' }} />;
    
    // Security
    if (typeLower === 'failed_login') 
        return <LockOutlined style={{ ...iconStyle, color: '#ef4444' }} />;
    
    return <InfoCircleOutlined style={{ ...iconStyle, color: '#1a7ab5' }} />;
};

const getPriorityColor = (priority) => {
    const colors = { critical: '#ef4444', high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    return colors[priority] || '#1a7ab5';
};

const getPriorityBg = (priority) => {
    const colors = { critical: '#fef2f2', high: '#fef2f2', medium: '#fffbeb', low: '#ecfdf5' };
    return colors[priority] || '#e8f4fd';
};

const getPriorityLabel = (priority) => {
    const labels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
    return labels[priority] || 'Normal';
};

// ==================== NOTIFICATION ITEM ====================
const NotificationItem = React.memo(({ 
    notification, 
    onToggleStar, 
    onMarkAsRead, 
    onDelete, 
    selected, 
    onSelect, 
    isDarkMode,
    onOpenDetails
}) => {
    const [showActions, setShowActions] = useState(false);
    const [isMarkingRead, setIsMarkingRead] = useState(false);
    const hasMarkedReadRef = useRef(false);
    const markTimeoutRef = useRef(null);
    
    const notificationId = getNotificationId(notification);
    const isNew = !notification.read_at && isNewNotification(notification.created_at);
    const isAlreadyRead = notification.read_at !== null;
    
    if (!notificationId) return null;
    
    const priorityColor = getPriorityColor(notification.priority);
    const priorityBg = getPriorityBg(notification.priority);
    
    useEffect(() => {
        return () => {
            if (markTimeoutRef.current) {
                clearTimeout(markTimeoutRef.current);
            }
        };
    }, []);
    
    const handleMarkAsRead = useCallback(async (e) => {
        if (e) e.stopPropagation();
        if (isAlreadyRead || isMarkingRead || hasMarkedReadRef.current) return;
        
        setIsMarkingRead(true);
        hasMarkedReadRef.current = true;
        
        markTimeoutRef.current = setTimeout(() => {
            setIsMarkingRead(false);
            hasMarkedReadRef.current = false;
        }, 3000);
        
        try {
            await onMarkAsRead(notificationId);
            if (markTimeoutRef.current) {
                clearTimeout(markTimeoutRef.current);
            }
        } catch (error) {
            console.error('Failed to mark as read:', error);
            setIsMarkingRead(false);
            hasMarkedReadRef.current = false;
        }
    }, [notificationId, isAlreadyRead, isMarkingRead, onMarkAsRead]);
    
    return (
        <div 
            className={`np-item ${!notification.read_at ? 'np-item-unread' : ''} ${notification.starred ? 'np-item-starred' : ''}`}
            data-is-new={isNew ? "true" : "false"}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            onClick={handleMarkAsRead}
        >
            <div className="np-item-content">
                {/* Checkbox */}
                <div className="np-item-checkbox">
                    <Checkbox 
                        checked={selected} 
                        onChange={(e) => onSelect(notificationId, e.target.checked)} 
                        onClick={(e) => e.stopPropagation()} 
                    />
                </div>
                
                {/* Star */}
                <div className="np-item-star" onClick={(e) => { e.stopPropagation(); onToggleStar(notificationId); }}>
                    {notification.starred ? 
                        <StarFilled style={{ color: '#f59e0b' }} /> : 
                        <StarOutlined style={{ color: '#cbd5e1' }} />
                    }
                </div>
                
                {/* Icon */}
                <div className="np-item-icon">
                    {getNotificationIcon(notification.type, notification.priority)}
                </div>
                
                {/* Content */}
                <div className="np-item-body">
                    <div className="np-item-header">
                        <div className="np-item-sender">
                            <span className="np-item-sender-name">
                                {notification.sender_name || 'System'}
                            </span>
                            <span className="np-item-priority" style={{ backgroundColor: priorityBg, color: priorityColor }}>
                                <ThunderboltOutlined style={{ fontSize: 10, marginRight: 4 }} />
                                {getPriorityLabel(notification.priority)}
                            </span>
                            {!notification.read_at && (
                                <>
                                    <span className="np-item-unread-dot"></span>
                                    {isNew && <span className="np-item-new-badge">NEW</span>}
                                </>
                            )}
                            {notification.starred && <StarFilled style={{ color: '#f59e0b', fontSize: 12, marginLeft: 4 }} />}
                        </div>
                        <Tooltip title={dayjs(notification.created_at).format('YYYY-MM-DD HH:mm:ss')}>
                            <span className="np-item-time">
                                <ClockCircleOutlined style={{ fontSize: 11, marginRight: 4 }} />
                                {dayjs(notification.created_at).fromNow()}
                            </span>
                        </Tooltip>
                    </div>
                    
                    <div className={`np-item-title ${!notification.read_at ? 'np-item-title-unread' : ''}`}>
                        {notification.title}
                    </div>
                    
                    <div className="np-item-message">
                        {notification.message}
                    </div>
                    
                    {notification.action_url && (
                        <div className="np-item-action">
                            <Button 
                                type="link" 
                                size="small" 
                                className="np-item-action-link"
                                onClick={(e) => { e.stopPropagation(); onOpenDetails(notification); }}
                            >
                                View Details →
                            </Button>
                        </div>
                    )}
                </div>
                
                {/* Actions */}
                {showActions && (
                    <div className="np-item-actions">
                        <Dropdown 
                            popupRender={() => (
                                <div className="np-dropdown-menu">
                                    <div className="np-dropdown-item" onClick={() => onOpenDetails(notification)}>
                                        <EyeOutlined /> View Details
                                    </div>
                                    <div className="np-dropdown-item" onClick={(e) => { e.stopPropagation(); onToggleStar(notificationId); }}>
                                        {notification.starred ? <StarOutlined /> : <StarFilled style={{ color: '#f59e0b' }} />}
                                        {notification.starred ? 'Unstar' : 'Star'}
                                    </div>
                                    <div className="np-dropdown-divider" />
                                    <div className="np-dropdown-item np-dropdown-item-danger" onClick={(e) => { e.stopPropagation(); onDelete(notificationId); }}>
                                        <DeleteOutlined /> Delete
                                    </div>
                                </div>
                            )} 
                            trigger={['click']}
                        >
                            <Button type="text" icon={<MoreOutlined />} size="small" onClick={(e) => e.stopPropagation()} />
                        </Dropdown>
                    </div>
                )}
            </div>
        </div>
    );
});

NotificationItem.displayName = 'NotificationItem';

const normalizeNotificationDestination = (notification) => {
    const type = String(notification?.type || '').toLowerCase();
    const raw = notification?.destination_url || notification?.action_url || notification?.data?.destination_url || '';

    const knownRoutes = [
        '/dashboard', '/booking', '/orders&events/orders', '/orders&events/events', '/inventory',
        '/billing', '/staff/attendance', '/staff/schedule', '/staff/payroll', '/staff/directory',
        '/settings', '/reports', '/menu', '/customer-feedback', '/notifications', '/login'
    ];

    if (knownRoutes.includes(raw)) return raw;

    const lower = String(raw).toLowerCase();
    if (lower.includes('booking') || lower.includes('quotation') || type.includes('booking') || type.includes('quotation')) return '/booking';
    if (lower.includes('order') || lower.includes('kitchen') || lower.includes('ingredient') || lower.includes('purchase') || type.includes('order') || type.includes('kitchen') || type.includes('ingredient') || type.includes('purchase')) return '/orders&events/orders';
    if (lower.includes('event') || lower.includes('delivery') || lower.includes('equipment') || type.includes('event') || type.includes('delivery') || type.includes('equipment')) return '/orders&events/events';
    if (lower.includes('inventory') || lower.includes('stock') || type.includes('inventory') || type.includes('stock')) return '/inventory';
    if (lower.includes('payment') || lower.includes('invoice') || lower.includes('billing') || type.includes('payment') || type.includes('invoice') || type.includes('account')) return '/billing';
    if (lower.includes('payroll') || type.includes('payroll') || type.includes('payslip')) return '/staff/payroll';
    if (lower.includes('attendance') || lower.includes('time') || type.includes('attendance') || type.includes('timeout') || type.includes('overtime')) return '/staff/attendance';
    if (lower.includes('schedule') || lower.includes('leave') || lower.includes('employee') || lower.includes('staff') || type.includes('schedule') || type.includes('leave') || type.includes('employee')) return '/staff/schedule';
    if (lower.includes('customer') || lower.includes('review') || lower.includes('message') || type.includes('customer') || type.includes('review') || type.includes('rating') || type.includes('message')) return '/customer-feedback';
    if (lower.includes('audit') || lower.includes('security') || lower.includes('setting') || type.includes('audit') || type.includes('security') || type.includes('permission') || type.includes('password') || type.includes('backup') || type.includes('session')) return '/settings';
    if (lower.includes('report') || type.includes('report') || type.includes('summary') || type.includes('revenue') || type.includes('sales')) return '/reports';
    if (lower.includes('menu') || lower.includes('promotion') || type.includes('menu') || type.includes('promotion')) return '/menu';
    if (raw.startsWith('/')) return raw;
    return '/dashboard';
};

// ==================== MAIN COMPONENT ====================
const NotificationPage = () => {
    const navigate = useNavigate();
    // ==================== STATE ====================
    const [activeTab, setActiveTab] = useState('all');
    const [selectedIds, setSelectedIds] = useState([]);
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [filterDate, setFilterDate] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [messageApi, contextHolder] = message.useMessage();
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [compactView, setCompactView] = useState(false);

    // ==================== QUERY PARAMS ====================
    const queryParams = useMemo(() => {
        const params = { page: currentPage, per_page: pageSize };
        
        if (activeTab === 'unread') {
            params.unread = true;
        } else if (activeTab === 'starred') {
            params.starred = true;
        }
        
        if (filterType !== 'all') {
            params.type = filterType;
        }
        
        if (filterPriority !== 'all') {
            params.priority = filterPriority;
        }
        
        if (searchTerm) {
            params.search = searchTerm;
        }
        
        if (filterDate && filterDate[0] && filterDate[1]) {
            params.start_date = filterDate[0].format('YYYY-MM-DD');
            params.end_date = filterDate[1].format('YYYY-MM-DD');
        }
        
        return params;
    }, [currentPage, pageSize, activeTab, filterType, filterPriority, searchTerm, filterDate]);

    // ==================== HOOKS ====================
    const { 
        data: notificationsData, 
        isLoading: notificationsLoading,
        refetch: refetchNotifications
    } = useNotifications(queryParams);
    
    const { 
        data: unreadCount = 0, 
        refetch: refetchUnreadCount 
    } = useUnreadCount();

    const markReadMutation = useMarkNotificationRead();
    const deleteMutation = useDeleteNotification();
    const markAllReadMutation = useMarkAllRead();
    const toggleStarMutation = useToggleStar();

    // ==================== DATA EXTRACTION ====================
    const notifications = notificationsData?.data || [];
    const total = notificationsData?.total || 0;
    
    const highPriorityCount = useMemo(() => {
        return notifications.filter(n => n.priority === 'high' && !n.read_at).length;
    }, [notifications]);

    const todayCount = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        return notifications.filter(n => dayjs(n.created_at).format('YYYY-MM-DD') === today).length;
    }, [notifications]);

    // ==================== THEME ====================
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        setIsDarkMode(savedTheme === 'dark' || (savedTheme !== 'light' && document.body.classList.contains('dark-mode')));
        const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('dark-mode')));
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // ==================== AUTO REFRESH ====================
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            refetchNotifications();
            refetchUnreadCount();
        }, 60000);
        return () => clearInterval(interval);
    }, [autoRefresh, refetchNotifications, refetchUnreadCount]);

    // ==================== EVENT LISTENERS ====================
    useEffect(() => {
        const handleRefresh = () => {
            refetchNotifications();
            refetchUnreadCount();
        };
        
        window.addEventListener('booking-approved', handleRefresh);
        window.addEventListener('new-notification', handleRefresh);
        window.addEventListener('notification-updated', handleRefresh);
        
        return () => {
            window.removeEventListener('booking-approved', handleRefresh);
            window.removeEventListener('new-notification', handleRefresh);
            window.removeEventListener('notification-updated', handleRefresh);
        };
    }, [refetchNotifications, refetchUnreadCount]);

    // ==================== HANDLERS ====================
    const markAsRead = useCallback(async (id) => {
        if (!id) return;
        try {
            await markReadMutation.mutateAsync(id);
        } catch (error) {
            // Error already handled
        }
    }, [markReadMutation]);

    const deleteNotification = useCallback((id) => {
        if (!id) return;
        Modal.confirm({
            title: 'Delete Notification',
            content: 'Are you sure you want to delete this notification?',
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteMutation.mutateAsync(id);
                    setSelectedIds(prev => prev.filter(i => i !== id));
                } catch (error) {
                    // Error already handled
                }
            }
        });
    }, [deleteMutation]);

    const markAllRead = useCallback(async () => {
        if (unreadCount === 0) {
            messageApi.info('No unread notifications');
            return;
        }
        try {
            await markAllReadMutation.mutateAsync();
        } catch (error) {
            // Error already handled
        }
    }, [unreadCount, markAllReadMutation, messageApi]);

    const toggleStar = useCallback(async (id) => {
        if (!id) return;
        try {
            await toggleStarMutation.mutateAsync(id);
        } catch (error) {
            console.error('Failed to toggle star:', error);
        }
    }, [toggleStarMutation]);

    const markSelectedAsRead = useCallback(async () => {
        if (selectedIds.length === 0) return;
        
        const results = await Promise.allSettled(
            selectedIds.map(id => markReadMutation.mutateAsync(id))
        );
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        
        if (successCount > 0) {
            setSelectedIds([]);
            messageApi.success(`${successCount} of ${selectedIds.length} notifications marked as read`);
        } else {
            messageApi.error('Failed to mark notifications as read');
        }
    }, [selectedIds, markReadMutation, messageApi]);

    const deleteSelected = useCallback(() => {
        if (selectedIds.length === 0) return;
        Modal.confirm({
            title: 'Delete Notifications',
            content: `Delete ${selectedIds.length} notification(s)?`,
            onOk: async () => {
                const results = await Promise.allSettled(
                    selectedIds.map(id => deleteMutation.mutateAsync(id))
                );
                
                const successCount = results.filter(r => r.status === 'fulfilled').length;
                
                if (successCount > 0) {
                    setSelectedIds([]);
                    messageApi.success(`${successCount} of ${selectedIds.length} notifications deleted`);
                } else {
                    messageApi.error('Failed to delete notifications');
                }
            }
        });
    }, [selectedIds, deleteMutation, messageApi]);

    const handleSelectAll = useCallback((e) => {
        if (e.target.checked) {
            setSelectedIds(notifications.map(n => getNotificationId(n)));
        } else {
            setSelectedIds([]);
        }
    }, [notifications]);

    const handleSelect = useCallback((id, checked) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(i => i !== id));
        }
    }, []);

    const handleManualRefresh = useCallback(() => {
        refetchNotifications();
        refetchUnreadCount();
        messageApi.success('Notifications refreshed');
    }, [refetchNotifications, refetchUnreadCount, messageApi]);

    const handleOpenDetails = useCallback((notification) => {
        setSelectedNotification(notification);
        setDrawerVisible(true);
        if (!notification.read_at) {
            markAsRead(getNotificationId(notification));
        }
    }, [markAsRead]);

    const handleGoToDestination = useCallback((notification) => {
        if (!notification) return;
        markAsRead(getNotificationId(notification));
        navigate(normalizeNotificationDestination(notification));
    }, [markAsRead, navigate]);

    const handleExport = useCallback(() => {
        const data = notifications.map(n => ({
            'Date': dayjs(n.created_at).format('YYYY-MM-DD HH:mm:ss'),
            'Title': n.title,
            'Message': n.message,
            'Type': n.type,
            'Priority': n.priority,
            'Status': n.read_at ? 'Read' : 'Unread',
            'Sender': n.sender_name || 'System'
        }));
        
        messageApi.success('Export started');
    }, [notifications, messageApi]);

    // ==================== PAGINATION ====================
    const renderPaginationItem = (_, type, originalElement) => {
        if (type === 'prev') {
            return (
                <Button className="np-pagination-nav" size="small" icon={<LeftOutlined />}>
                    Previous
                </Button>
            );
        }
        if (type === 'next') {
            return (
                <Button className="np-pagination-nav" size="small">
                    Next <RightOutlined />
                </Button>
            );
        }
        return originalElement;
    };

    // ==================== TABS ====================
    const tabItems = [
        { key: 'all', label: 'All', icon: <InboxOutlined />, badge: total },
        { key: 'unread', label: 'Unread', icon: <MailOutlined />, badge: unreadCount },
        { key: 'starred', label: 'Starred', icon: <StarOutlined /> },
        { key: 'today', label: 'Today', icon: <CalendarOutlined />, badge: todayCount },
        { key: 'action', label: 'Action Required', icon: <FlagOutlined />, badge: highPriorityCount }
    ];

    // ==================== CSS CLASSES ====================
    const containerClass = `np-container ${isDarkMode ? 'np-dark-mode' : ''}`;
    const headerClass = `np-header ${isDarkMode ? 'np-header-dark' : ''}`;
    const statsClass = `np-stats ${isDarkMode ? 'np-stats-dark' : ''}`;
    const filtersClass = `np-filters ${isDarkMode ? 'np-filters-dark' : ''}`;
    const mainClass = `np-main ${isDarkMode ? 'np-main-dark' : ''}`;
    const tabsClass = `np-tabs ${isDarkMode ? 'np-tabs-dark' : ''}`;
    const toolbarClass = `np-toolbar ${isDarkMode ? 'np-toolbar-dark' : ''}`;
    const drawerClass = `np-drawer ${isDarkMode ? 'np-drawer-dark' : ''}`;

    // ==================== RENDER ====================
    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    colorPrimary: '#1a7ab5',
                    colorBgContainer: isDarkMode ? '#0f1424' : '#ffffff',
                    colorBorderSecondary: isDarkMode ? '#1a1f35' : '#eef2f8',
                    colorText: isDarkMode ? '#e2e8f0' : '#1a2c3e',
                    colorTextSecondary: isDarkMode ? '#8b93a8' : '#5a6e7c',
                    borderRadius: 12,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                },
                components: {
                    Table: {
                        headerBg: isDarkMode ? '#0a0e1a' : '#f8fafc',
                        headerColor: isDarkMode ? '#cbd5e1' : '#1a2c3e',
                    },
                    Card: {
                        borderRadiusLG: 16,
                    },
                }
            }}
        >
            {contextHolder}
            <div className={containerClass}>
                {/* ==================== HEADER ==================== */}
                <div className={headerClass}>
                    <div className="np-header-left">
                        <div className="np-header-icon">
                            <NotificationOutlined />
                        </div>
                        <div className="np-header-info">
                            <h1>Notification Center</h1>
                            <span>Real-time alerts & updates</span>
                        </div>
                    </div>
                    <div className="np-header-right">
                        <Tooltip title={soundEnabled ? 'Sound On' : 'Sound Off'}>
                            <Button 
                                icon={<SoundOutlined />} 
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className={soundEnabled ? 'np-sound-on' : 'np-sound-off'}
                            />
                        </Tooltip>
                        <Tooltip title={autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}>
                            <Button 
                                icon={<SyncOutlined spin={autoRefresh} />} 
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                className={autoRefresh ? 'np-auto-on' : 'np-auto-off'}
                            />
                        </Tooltip>
                        <Tooltip title="Refresh">
                            <Button 
                                icon={<ReloadOutlined />} 
                                onClick={handleManualRefresh} 
                                loading={notificationsLoading} 
                            />
                        </Tooltip>
                        <Tooltip title="Mark all as read">
                            <Button 
                                icon={<CheckOutlined />} 
                                onClick={markAllRead} 
                                disabled={unreadCount === 0} 
                            />
                        </Tooltip>
                        <Tooltip title="Export">
                            <Button icon={<ExportOutlined />} onClick={handleExport} />
                        </Tooltip>
                        <Tooltip title="Filters">
                            <Button 
                                type={filtersVisible ? 'primary' : 'default'}
                                icon={<FilterOutlined />} 
                                onClick={() => setFiltersVisible(!filtersVisible)}
                            />
                        </Tooltip>
                    </div>
                </div>

                {/* ==================== STATS ==================== */}
                <div className={statsClass}>
                    <div className="np-stat-card">
                        <div className="np-stat-icon blue"><BellOutlined /></div>
                        <div className="np-stat-info">
                            <div className="np-stat-value">{total}</div>
                            <div className="np-stat-label">Total</div>
                        </div>
                        <div className="np-stat-trend up"><RiseOutlined /> +12%</div>
                    </div>
                    <div className="np-stat-card">
                        <div className="np-stat-icon orange"><MailOutlined /></div>
                        <div className="np-stat-info">
                            <div className="np-stat-value">{unreadCount}</div>
                            <div className="np-stat-label">Unread</div>
                        </div>
                        <div className="np-stat-trend warning">Needs attention</div>
                    </div>
                    <div className="np-stat-card">
                        <div className="np-stat-icon gold"><StarOutlined /></div>
                        <div className="np-stat-info">
                            <div className="np-stat-value">{notifications.filter(n => n.starred).length}</div>
                            <div className="np-stat-label">Starred</div>
                        </div>
                        <div className="np-stat-trend up">Important</div>
                    </div>
                    <div className="np-stat-card">
                        <div className="np-stat-icon red"><FlagOutlined /></div>
                        <div className="np-stat-info">
                            <div className="np-stat-value">{highPriorityCount}</div>
                            <div className="np-stat-label">Action Required</div>
                        </div>
                        <div className="np-stat-trend down">Urgent</div>
                    </div>
                </div>

                {/* ==================== FILTERS ==================== */}
                {filtersVisible && (
                    <div className={filtersClass}>
                        <div className="np-filters-header">
                            <FilterOutlined />
                            <span>Filter Notifications</span>
                            <Button type="text" size="small" icon={<UpOutlined />} onClick={() => setFiltersVisible(false)} className="np-filters-close" />
                        </div>
                        <div className="np-filters-body">
                            <div className="np-filter-group">
                                <div className="np-filter-label">Search</div>
                                <Input 
                                    placeholder="Search notifications..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    prefix={<SearchOutlined />}
                                    allowClear
                                    className="np-filter-input"
                                />
                            </div>
                            <div className="np-filter-group">
                                <div className="np-filter-label">Type</div>
                                <div className="np-filter-chips">
                                    {['all', 'booking', 'inventory', 'equipment', 'payments', 'staff', 'system'].map(type => (
                                        <div 
                                            key={type}
                                            className={`np-filter-chip ${filterType === type ? 'active' : ''}`}
                                            onClick={() => { setFilterType(type); setCurrentPage(1); }}
                                        >
                                            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="np-filter-group">
                                <div className="np-filter-label">Priority</div>
                                <div className="np-filter-chips">
                                    {['all', 'high', 'medium', 'low'].map(priority => (
                                        <div 
                                            key={priority}
                                            className={`np-filter-chip ${filterPriority === priority ? 'active' : ''}`}
                                            onClick={() => { setFilterPriority(priority); setCurrentPage(1); }}
                                        >
                                            <span className={`np-priority-dot ${priority}`} />
                                            {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="np-filter-group">
                                <div className="np-filter-label">Date Range</div>
                                <RangePicker 
                                    onChange={setFilterDate} 
                                    format="YYYY-MM-DD" 
                                    className="np-filter-date"
                                    placeholder={['Start', 'End']}
                                    allowClear
                                />
                            </div>
                            <div className="np-filter-actions">
                                <Button 
                                    type="primary" 
                                    icon={<CheckOutlined />} 
                                    onClick={() => {
                                        setCurrentPage(1);
                                        messageApi.success('Filters applied');
                                    }}
                                >
                                    Apply
                                </Button>
                                <Button 
                                    onClick={() => {
                                        setFilterType('all');
                                        setFilterPriority('all');
                                        setFilterDate(null);
                                        setSearchTerm('');
                                        setCurrentPage(1);
                                        messageApi.success('Filters cleared');
                                    }}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== MAIN CONTENT ==================== */}
                <div className={mainClass}>
                    {/* Tabs */}
                    <Tabs 
                        activeKey={activeTab} 
                        onChange={(key) => {
                            setActiveTab(key);
                            setCurrentPage(1);
                            setSelectedIds([]);
                        }} 
                        className={tabsClass}
                        items={tabItems.map(tab => ({ 
                            key: tab.key, 
                            label: (
                                <span className="np-tab-label">
                                    {tab.icon}
                                    {tab.label}
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <Badge count={tab.badge} className="np-tab-badge" />
                                    )}
                                </span>
                            )
                        }))} 
                    />

                    {/* Toolbar */}
                    <div className={toolbarClass}>
                        <div className="np-toolbar-left">
                            <Checkbox 
                                checked={selectedIds.length === notifications.length && notifications.length > 0} 
                                indeterminate={selectedIds.length > 0 && selectedIds.length < notifications.length} 
                                onChange={handleSelectAll}
                                disabled={notifications.length === 0}
                            >
                                Select all
                            </Checkbox>
                            {selectedIds.length > 0 && (
                                <>
                                    <Divider type="vertical" />
                                    <Button size="small" icon={<CheckOutlined />} onClick={markSelectedAsRead}>
                                        Read ({selectedIds.length})
                                    </Button>
                                    <Button size="small" danger icon={<DeleteOutlined />} onClick={deleteSelected}>
                                        Delete ({selectedIds.length})
                                    </Button>
                                </>
                            )}
                        </div>
                        <div className="np-toolbar-right">
                            <Text type="secondary">
                                {notifications.length} of {total} notifications
                            </Text>
                        </div>
                    </div>

                    {/* List Container */}
                    <div className="np-list-container">
                        {notificationsLoading && notifications.length === 0 ? (
                            <div className="np-loading">
                                <Spin size="large" />
                                <p>Loading notifications...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="np-empty">
                                <BellOutlined className="np-empty-icon" />
                                <Empty description="No notifications found" />
                                <Text type="secondary" className="np-empty-hint">
                                    {filterPriority !== 'all' || filterType !== 'all' || activeTab !== 'all' || searchTerm
                                        ? "Try adjusting your filters"
                                        : "Notifications will appear here when they arrive"}
                                </Text>
                            </div>
                        ) : (
                            <>
                                <div className="np-list">
                                    {notifications.map(notification => (
                                        <NotificationItem 
                                            key={`notification-${getNotificationId(notification)}`}
                                            notification={notification} 
                                            onToggleStar={toggleStar} 
                                            onMarkAsRead={markAsRead} 
                                            onDelete={deleteNotification} 
                                            selected={selectedIds.includes(getNotificationId(notification))} 
                                            onSelect={handleSelect} 
                                            isDarkMode={isDarkMode}
                                            onOpenDetails={handleOpenDetails}
                                        />
                                    ))}
                                </div>

                                {total > pageSize && (
                                    <div className="np-pagination">
                                        <Pagination 
                                            current={currentPage} 
                                            pageSize={pageSize} 
                                            total={total} 
                                            onChange={(page, size) => { 
                                                setCurrentPage(page); 
                                                if (size !== pageSize) setPageSize(size); 
                                                setSelectedIds([]); 
                                            }} 
                                            showSizeChanger 
                                            showTotal={(total) => `${total} total items`} 
                                            pageSizeOptions={['10', '20', '50', '100']}
                                            itemRender={renderPaginationItem}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ==================== DETAILS DRAWER ==================== */}
                <Drawer
                    title={
                        <div className="np-drawer-header">
                            <div className="np-drawer-title">
                                <BellOutlined style={{ color: '#1a7ab5' }} />
                                <span>Notification Details</span>
                            </div>
                            {selectedNotification && (
                                <div className="np-drawer-actions">
                                    <Tooltip title="Star">
                                        <Button 
                                            type="text" 
                                            icon={selectedNotification.starred ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
                                            onClick={() => toggleStar(getNotificationId(selectedNotification))}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Mark as read">
                                        <Button 
                                            type="text" 
                                            icon={selectedNotification.read_at ? <CheckCircleOutlined /> : <EyeOutlined />}
                                            onClick={() => markAsRead(getNotificationId(selectedNotification))}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <Button 
                                            type="text" 
                                            danger 
                                            icon={<DeleteOutlined />}
                                            onClick={() => {
                                                setDrawerVisible(false);
                                                deleteNotification(getNotificationId(selectedNotification));
                                            }}
                                        />
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    }
                    open={drawerVisible}
                    onClose={() => setDrawerVisible(false)}
                    width={480}
                    className={drawerClass}
                    placement="right"
                >
                    {selectedNotification && (
                        <div className="np-drawer-content">
                            <div className="np-drawer-meta">
                                <div className="np-drawer-meta-item">
                                    <span className="np-drawer-meta-label">Status</span>
                                    <div>
                                        {selectedNotification.read_at ? (
                                            <Tag color="green">Read</Tag>
                                        ) : (
                                            <Tag color="orange">Unread</Tag>
                                        )}
                                        {selectedNotification.starred && <Tag color="gold">Starred</Tag>}
                                    </div>
                                </div>
                                <div className="np-drawer-meta-item">
                                    <span className="np-drawer-meta-label">Priority</span>
                                    <Tag 
                                        style={{ 
                                            backgroundColor: getPriorityBg(selectedNotification.priority),
                                            color: getPriorityColor(selectedNotification.priority),
                                            border: 'none'
                                        }}
                                    >
                                        {getPriorityLabel(selectedNotification.priority)}
                                    </Tag>
                                </div>
                                <div className="np-drawer-meta-item">
                                    <span className="np-drawer-meta-label">Type</span>
                                    <Tag color="blue">{selectedNotification.type?.toUpperCase() || 'General'}</Tag>
                                </div>
                                <div className="np-drawer-meta-item">
                                    <span className="np-drawer-meta-label">Received</span>
                                    <span>{dayjs(selectedNotification.created_at).format('MMMM DD, YYYY h:mm A')}</span>
                                </div>
                                {selectedNotification.read_at && (
                                    <div className="np-drawer-meta-item">
                                        <span className="np-drawer-meta-label">Read at</span>
                                        <span>{dayjs(selectedNotification.read_at).format('MMMM DD, YYYY h:mm A')}</span>
                                    </div>
                                )}
                                <div className="np-drawer-meta-item">
                                    <span className="np-drawer-meta-label">From</span>
                                    <span className="np-drawer-meta-value">{selectedNotification.sender_name || 'System'}</span>
                                </div>
                            </div>

                            <Divider />

                            <div className="np-drawer-body">
                                <Title level={4}>{selectedNotification.title}</Title>
                                <Paragraph className="np-drawer-message">
                                    {selectedNotification.message}
                                </Paragraph>
                                <div className="np-drawer-action">
                                    <Button type="primary" onClick={() => handleGoToDestination(selectedNotification)}>
                                        Open Destination →
                                    </Button>
                                </div>
                            </div>

                            {selectedNotification.metadata && (
                                <>
                                    <Divider />
                                    <div className="np-drawer-metadata">
                                        <Text type="secondary">Additional Information</Text>
                                        <pre className="np-drawer-metadata-json">
                                            {JSON.stringify(selectedNotification.metadata, null, 2)}
                                        </pre>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </Drawer>
            </div>
        </ConfigProvider>
    );
};

export default NotificationPage;