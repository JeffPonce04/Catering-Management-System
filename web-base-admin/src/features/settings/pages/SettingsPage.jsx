// src/components/SystemSettings.jsx - WITH NORMAL LOADING
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Card, Table, Button, Space, Input, Select, Modal, Tag, message, Divider, Tooltip, Typography, 
    Row, Col, Alert, Form, Switch, Checkbox, Avatar, Badge, ConfigProvider, theme as antdTheme, 
    InputNumber, Pagination, Progress, Popconfirm, Descriptions, 
    Upload, DatePicker, Radio, Collapse, Spin
} from 'antd';
import {
    SettingOutlined, UserOutlined, LockOutlined, HistoryOutlined, DollarOutlined, TruckOutlined, 
    TeamOutlined, CalculatorOutlined, BoxPlotOutlined, MenuOutlined, CalendarOutlined, 
    CreditCardOutlined, FileTextOutlined, SafetyOutlined, PlusOutlined, EditOutlined, DeleteOutlined, 
    ReloadOutlined, SaveOutlined, ExportOutlined, CheckCircleOutlined, CloseCircleOutlined,
    LeftOutlined, RightOutlined, AppstoreOutlined, MailOutlined, PhoneOutlined, ClockCircleOutlined,
    SearchOutlined, FilterOutlined, CrownOutlined, DownloadOutlined, LoadingOutlined,
    SunOutlined, MoonOutlined, RiseOutlined, TrophyOutlined
} from '@ant-design/icons';
import { 
    useSettings, 
    useUpdateSettingsSection, 
    useUsers, 
    useRoles, 
    useAuditLogs,
    useExportAuditLogs,
    useCreateUser,
    useUpdateUserRole,
    useToggleUserActive
} from '../../../hooks/useSettingsQueries';
import { useAuth } from '../../../contexts/AuthContext';
import { isSuperAdmin } from '../../../utils/roleRoutes';
import dayjs from 'dayjs';
import '../styles/Settings.css';

const { Title, Text } = Typography;
const { Option } = Select;
const SettingsCollapse = ({ children, items, ...props }) => {
    const normalizedItems = items ?? React.Children.map(children, (panel) => {
        const { header, children: panelChildren, ...itemProps } = panel.props;

        return {
            key: panel.key,
            label: header,
            children: panelChildren,
            ...itemProps,
        };
    });

    return <Collapse {...props} items={normalizedItems} />;
};

// Declarative item container consumed by SettingsCollapse; it is not rendered directly.
const SettingsPanel = ({ children }) => children;

const SYSTEM_ACCOUNT_ROLE_SLUGS = new Set([
    'super-admin',
    'admin',
    'cashier',
    'inventory-manager',
    'staff-manager',
]);

const AUDIT_MODULE_OPTIONS = [
    'auth', 'users', 'bookings', 'quotations', 'orders', 'inventory', 'purchases',
    'employees', 'schedules', 'employee_requests', 'attendance', 'payroll', 'finance',
    'events', 'menu', 'customers', 'settings', 'reports', 'notifications', 'security'
];

const AUDIT_ACTION_OPTIONS = [
    'user_login','user_logout','failed_login_attempt','password_changed','password_reset','new_device_login','session_expired','account_locked','account_unlocked',
    'user_created','user_updated','user_deleted','user_activated','user_deactivated','role_assigned','role_changed','permission_updated',
    'booking_created','booking_updated','booking_approved','booking_rejected','booking_cancelled','booking_rescheduled','booking_completed','booking_converted_to_order',
    'quotation_created','quotation_updated','discount_applied','additional_charges_added','quotation_approved','quotation_accepted','quotation_rejected','quotation_converted_to_booking',
    'order_created','order_updated','order_status_changed','ingredient_computation_generated','kitchen_preparation_generated','delivery_preparation_generated','order_completed',
    'stock_added','stock_adjusted','stock_reserved','stock_released','stock_deducted','stock_returned','stock_wasted','manual_adjustment','equipment_reserved','equipment_released','equipment_returned','equipment_damaged','equipment_missing','equipment_replaced',
    'purchase_request_created','purchase_request_approved','purchase_request_rejected','purchase_order_created','supplier_assigned','stock_received',
    'employee_added','employee_updated','employee_archived','department_changed','position_changed','salary_grade_changed',
    'schedule_created','schedule_updated','schedule_deleted','employee_assigned','employee_removed','schedule_conflict_detected',
    'leave_request_submitted','leave_approved','leave_rejected','sick_leave_submitted','sick_leave_approved','day_off_submitted','day_off_approved',
    'time_in_recorded','time_out_recorded','attendance_approved','attendance_rejected','unscheduled_attendance_approved','late_recorded','overtime_approved','overtime_rejected',
    'payroll_generated','payroll_approved','payslip_generated','salary_adjusted','overtime_added','deduction_updated','payroll_released',
    'invoice_generated','payment_recorded','payment_verified','partial_payment_received','full_payment_received','credit_account_created','debt_settled','refund_processed',
    'event_created','event_updated','event_started','event_completed','staff_assigned','equipment_assigned','delivery_started','delivery_completed',
    'menu_added','menu_updated','menu_deleted','menu_price_changed','menu_image_updated','category_added','package_updated','promotion_added',
    'customer_registered','customer_updated_profile','customer_submitted_review','admin_replied_to_review','customer_sent_message',
    'system_settings_updated','pricing_rules_changed','payroll_settings_updated','inventory_settings_updated','notification_settings_updated','payment_settings_updated',
    'sales_report_generated','payroll_report_generated','inventory_report_generated','financial_report_generated','analytics_exported',
    'notification_sent','notification_read','notification_deleted',
    'multiple_failed_login_attempts','unauthorized_access_attempt','user_permission_changed','database_backup_completed','database_backup_failed','system_error_logged'
];

const formatAuditOption = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SystemSettings = () => {
    const location = useLocation();
    const { user } = useAuth();
    const isSuperAdminUser = isSuperAdmin(user);

    // ==================== STATE ====================
    const [activeMainTab, setActiveMainTab] = useState('users');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [searchUser, setSearchUser] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterAuditUser, setFilterAuditUser] = useState('all');
    const [filterAuditDate, setFilterAuditDate] = useState(null);
    const [filterAuditModule, setFilterAuditModule] = useState('all');
    const [filterAuditAction, setFilterAuditAction] = useState('all');
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [createAccountOpen, setCreateAccountOpen] = useState(false);
    const [createAccountForm] = Form.useForm();
    
    // ==================== REACT QUERY HOOKS ====================
    // Settings - Load all sections
    const { 
        data: settings, 
        isLoading: settingsLoading, 
        refetch: refetchSettings 
    } = useSettings({ enabled: isSuperAdminUser });
    
    const updateSettings = useUpdateSettingsSection();
    
    // Users - Load from API
    const { 
        data: usersData, 
        isLoading: usersLoading, 
        refetch: refetchUsers 
    } = useUsers({
        search: searchUser,
        per_page: pageSize,
        page: currentPage,
        role: filterRole !== 'all' ? filterRole : undefined,
        is_active: filterStatus !== 'all' ? filterStatus === 'active' : undefined,
    });
    
    const { data: roles = [] } = useRoles();
    const { 
        data: auditData, 
        isLoading: auditLoading, 
        refetch: refetchAudit 
    } = useAuditLogs({
        user: filterAuditUser !== 'all' ? filterAuditUser : undefined,
        module: filterAuditModule !== 'all' ? filterAuditModule : undefined,
        action: filterAuditAction !== 'all' ? filterAuditAction : undefined,
        start_date: filterAuditDate?.[0] ? filterAuditDate[0].format('YYYY-MM-DD') : undefined,
        end_date: filterAuditDate?.[1] ? filterAuditDate[1].format('YYYY-MM-DD') : undefined,
    });
    
    const createUser = useCreateUser();
    const updateUserRole = useUpdateUserRole();
    const toggleUserActive = useToggleUserActive();
    const exportAuditLogs = useExportAuditLogs();

    // ==================== SETTINGS STATE ====================
    const [pricingRules, setPricingRules] = useState({
        base_price_per_head: null,
        package_pricing: [],
        seasonal_pricing: [],
        discount_rules: [],
        tax_settings: { tax_percentage: null, service_charge: null, is_tax_inclusive: null },
        promo_codes: []
    });

    const [deliverySettings, setDeliverySettings] = useState({
        delivery_zones: [],
        free_delivery_threshold: null,
        pickup_allowed: null,
        delivery_time_slots: [],
        distance_based_fee: null,
        fee_per_km: null,
        max_delivery_radius: null,
        vehicle_assignment: []
    });

    const [employeeSettings, setEmployeeSettings] = useState({
        grace_period_minutes: null,
        late_deduction_per_minute: null,
        sick_leave_days_per_year: null,
        vacation_leave_days_per_year: null,
        employees: [],
        attendance_tracking: null,
        performance_rating: null,
        skills_tagging: null
    });

    const [payrollSettings, setPayrollSettings] = useState({
        monthly_salary: [],
        daily_wage: null,
        hourly_rate: null,
        overtime_rate: null,
        weekly_schedule: {},
        bonus_rules: [],
        auto_generate_payroll: null,
        attendance_based: null,
        overtime_calculation: null
    });

    const [inventorySettings, setInventorySettings] = useState({
        ingredients: [],
        low_stock_threshold: null,
        reorder_level: null,
        ingredient_buffer_percentage: null,
        yield_percentage: null,
        suppliers: [],
        auto_deduct_inventory: null,
        stock_report_enabled: null,
        expiration_tracking: null
    });

    const [securitySettings, setSecuritySettings] = useState({
        password_min_length: null,
        session_timeout_minutes: null,
        login_attempts_limit: null,
        two_factor_auth: null,
        password_encryption: null,
        ip_whitelist: [],
        device_login_tracking: null,
        activity_alerts: true,
        account_lock_duration: 30,
        suspicious_activity_threshold: 5
    });

    // ==================== LOAD SETTINGS FROM API ====================
    useEffect(() => {
        if (settings) {
            if (settings.pricing) {
                setPricingRules(prev => ({
                    ...prev,
                    ...settings.pricing,
                    package_pricing: settings.pricing.package_pricing || prev.package_pricing,
                    seasonal_pricing: settings.pricing.seasonal_pricing || prev.seasonal_pricing,
                    discount_rules: settings.pricing.discount_rules || prev.discount_rules,
                    tax_settings: settings.pricing.tax_settings || prev.tax_settings,
                    promo_codes: settings.pricing.promo_codes || prev.promo_codes,
                }));
            }
            if (settings.delivery) {
                setDeliverySettings(prev => ({
                    ...prev,
                    ...settings.delivery,
                    delivery_zones: settings.delivery.delivery_zones || prev.delivery_zones,
                    delivery_time_slots: settings.delivery.delivery_time_slots || prev.delivery_time_slots,
                    vehicle_assignment: settings.delivery.vehicle_assignment || prev.vehicle_assignment,
                }));
            }
            if (settings.employee) {
                setEmployeeSettings(prev => ({
                    ...prev,
                    ...settings.employee,
                }));
            }
            if (settings.payroll) {
                setPayrollSettings(prev => ({
                    ...prev,
                    ...settings.payroll,
                    monthly_salary: settings.payroll.monthly_salary || prev.monthly_salary,
                    weekly_schedule: settings.payroll.weekly_schedule || prev.weekly_schedule,
                    bonus_rules: settings.payroll.bonus_rules || prev.bonus_rules,
                }));
            }
            if (settings.inventory) {
                setInventorySettings(prev => ({
                    ...prev,
                    ...settings.inventory,
                    ingredients: settings.inventory.ingredients || prev.ingredients,
                    suppliers: settings.inventory.suppliers || prev.suppliers,
                }));
            }
            if (settings.security) {
                setSecuritySettings(prev => ({
                    ...prev,
                    ...settings.security,
                    ip_whitelist: settings.security.ip_whitelist || prev.ip_whitelist,
                }));
            }
        }
    }, [settings]);

    // ==================== SAVE SETTINGS ====================
    const handleSaveSettings = async (section, data) => {
        try {
            await updateSettings.mutateAsync({ section, data });
            await refetchSettings();
            message.success(`${section} settings saved successfully`);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Failed to save settings');
        }
    };

    // ==================== THEME DETECTION ====================
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        setIsDarkMode(savedTheme === 'dark' || (savedTheme !== 'light' && document.body.classList.contains('dark-mode')));
        const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('dark-mode')));
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // ==================== DATA EXTRACTION ====================
    const users = usersData?.data || [];
    const totalUsers = usersData?.total || 0;
    const auditLogs = auditData?.data || [];
    const totalAuditLogs = auditData?.total || 0;

    const auditUsers = [...new Set(auditLogs.map(log => log.user_name).filter(Boolean))];
    const auditModules = [...new Set([...AUDIT_MODULE_OPTIONS, ...auditLogs.map(log => log.module).filter(Boolean)])];
    const auditActions = [...new Set([...AUDIT_ACTION_OPTIONS, ...auditLogs.map(log => log.action).filter(Boolean)])];
    const roleOptions = roles.filter((role) => role.is_active !== false);
    const createAccountRoles = roleOptions.filter((role) => SYSTEM_ACCOUNT_ROLE_SLUGS.has(role.slug));

    const handleCreateAccount = async (values) => {
        try {
            await createUser.mutateAsync({
                ...values,
                is_active: values.is_active ?? true,
            });
            createAccountForm.resetFields();
            setCreateAccountOpen(false);
            setCurrentPage(1);
            await refetchUsers();
        } catch {
            // The mutation displays the backend validation message.
        }
    };

    // ==================== PAGINATION RENDER ====================
    const renderPaginationItem = (_, type, originalElement) => {
        if (type === 'prev') {
            return (
                <Button className="settings-pagination-navigation-button" size="small" icon={<LeftOutlined />}>
                    Previous
                </Button>
            );
        }
        if (type === 'next') {
            return (
                <Button className="settings-pagination-navigation-button" size="small">
                    Next <RightOutlined />
                </Button>
            );
        }
        return originalElement;
    };

    // ==================== TABLE COLUMNS ====================
    const userColumns = [
        { 
            title: 'USER', 
            key: 'employee',
            width: 220,
            render: (_, r) => (
                <div className="settings-user-cell">
                    <Avatar style={{ backgroundColor: '#1a7ab5', width: 40, height: 40 }}>
                        {r.name?.charAt(0) || 'E'}
                    </Avatar>
                    <div>
                        <div className="settings-user-name">{r.name || 'Unknown'}</div>
                        <div className="settings-user-email">
                            <MailOutlined style={{ fontSize: 11 }} /> {r.email || 'N/A'}
                        </div>
                    </div>
                </div>
            ) 
        },
        { 
            title: 'POSITION', 
            dataIndex: 'position', 
            key: 'position',
            width: 150,
            render: (text) => text || 'N/A'
        },
        { 
            title: 'DEPARTMENT', 
            dataIndex: 'department', 
            key: 'department',
            width: 150,
            render: (text) => text || 'N/A'
        },
        { 
            title: 'ROLE', 
            dataIndex: 'role', 
            key: 'role',
            width: 120,
            render: (role) => (
                <Tag color={role?.toLowerCase() === 'admin' ? 'red' : role?.toLowerCase() === 'manager' ? 'gold' : 'blue'} className="settings-role-tag">
                    {role?.toUpperCase() || 'STAFF'}
                </Tag>
            ) 
        },
        { 
            title: 'STATUS', 
            dataIndex: 'is_active', 
            key: 'status',
            width: 130,
            align: 'center',
            render: (status) => (
                <Badge status={status ? 'success' : 'error'} text={status ? 'Active' : 'Inactive'} className="settings-status-badge" />
            ) 
        },
        { 
            title: 'LAST LOGIN', 
            dataIndex: 'last_login', 
            key: 'last_login',
            width: 180,
            render: (v) => v ? dayjs(v).format('MMM DD, YYYY h:mm A') : 'Never' 
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 180,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title={record.is_active ? 'Deactivate User' : 'Activate User'}>
                        <Button 
                            type="text" 
                            size="small"
                            icon={record.is_active ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            onClick={() => toggleUserActive.mutate(record.id)}
                            loading={toggleUserActive.isPending}
                        />
                    </Tooltip>
                    <Tooltip title="Change Role">
                        <Select
                            size="small"
                            value={record.role}
                            style={{ width: 100 }}
                            onChange={(value) => updateUserRole.mutate({ userId: record.id, roleSlug: value })}
                            loading={updateUserRole.isPending}
                            placeholder="Role"
                        >
                            {roles.filter((role) => role.is_active !== false).map(role => (
                                <Option key={role.slug} value={role.slug}>
                                    {role.name}
                                </Option>
                            ))}
                        </Select>
                    </Tooltip>
                </Space>
            )
        }
    ];

    const auditColumns = [
        { 
            title: 'DATE & TIME', 
            dataIndex: 'created_at', 
            key: 'date', 
            width: 180,
            render: (v) => <span className="settings-audit-date">{v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : 'N/A'}</span> 
        },
        { 
            title: 'USER', 
            dataIndex: 'user_name', 
            key: 'user', 
            width: 150,
            render: (text) => <span className="settings-audit-user"><UserOutlined /> {text || 'System'}</span> 
        },
        { 
            title: 'MODULE', 
            dataIndex: 'module', 
            key: 'module', 
            width: 130,
            render: (module) => <Tag color="cyan" className="settings-module-tag">{module || 'General'}</Tag> 
        },
        { 
            title: 'ACTION', 
            dataIndex: 'action', 
            key: 'action',
            width: 150,
            render: (text) => <span className="settings-audit-action">{text || 'Unknown Action'}</span>
        },
        { 
            title: 'DESCRIPTION', 
            dataIndex: 'description', 
            key: 'description',
            render: (text) => <span className="settings-audit-desc">{text || 'No description'}</span>
        },
        { 
            title: 'IP', 
            dataIndex: 'ip_address', 
            key: 'ip', 
            width: 130,
            render: (text) => <span className="settings-ip-text">{text || 'N/A'}</span> 
        },
    ];

    // ==================== CSS CLASSES ====================
    const containerClass = `settings-container ${isDarkMode ? 'settings-dark-mode' : ''}`;
    const headerClass = `settings-header ${isDarkMode ? 'settings-header-dark' : ''}`;
    const dateDisplayClass = `settings-date-display ${isDarkMode ? 'settings-date-display-dark' : ''}`;
    const mainCardClass = `settings-main-card ${isDarkMode ? 'settings-main-card-dark' : ''}`;
    const sidebarClass = `settings-sidebar ${isDarkMode ? 'settings-sidebar-dark' : ''}`;
    const contentClass = `settings-content ${isDarkMode ? 'settings-content-dark' : ''}`;
    const tableClass = `settings-table ${isDarkMode ? 'settings-table-dark' : ''}`;

    const sidebarMenuItems = [
        { key: 'users', icon: <UserOutlined />, label: 'User Management', desc: isSuperAdminUser ? 'Manage all system accounts and roles' : 'Manage operational user accounts' },
        { key: 'audit', icon: <HistoryOutlined />, label: 'Audit Logs', desc: isSuperAdminUser ? 'View complete system activity' : 'View operational activity' },
        ...(isSuperAdminUser ? [
            { key: 'pricing', icon: <DollarOutlined />, label: 'Pricing Rules', desc: 'Configure pricing & discounts' },
            { key: 'delivery', icon: <TruckOutlined />, label: 'Delivery', desc: 'Delivery zones & fees' },
            { key: 'employee', icon: <TeamOutlined />, label: 'Employee', desc: 'Employee profiles & scheduling' },
            { key: 'payroll', icon: <CalculatorOutlined />, label: 'Payroll', desc: 'Salary & payroll configuration' },
            { key: 'inventory', icon: <BoxPlotOutlined />, label: 'Inventory', desc: 'Stock management & tracking' },
            { key: 'security', icon: <SafetyOutlined />, label: 'Security', desc: 'Security & access control' },
        ] : []),
    ];

    useEffect(() => {
        const requestedTab = new URLSearchParams(location.search).get('tab');
        if (requestedTab && sidebarMenuItems.some((item) => item.key === requestedTab)) {
            setActiveMainTab(requestedTab);
        }
    }, [location.search, isSuperAdminUser]);

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
            <div className={containerClass}>
                {/* ==================== HEADER ==================== */}
                <div className={headerClass}>
                    <div className="settings-header-left">
                        <Tooltip title="System Settings">
                            <div className="settings-logo-icon"><SettingOutlined /></div>
                        </Tooltip>
                        <div className="settings-header-info">
                            <h1>System Settings</h1>
                            <span>{isSuperAdminUser ? 'System-wide configuration and control' : 'Operational account and audit management'}</span>
                        </div>
                    </div>
                    <div className="settings-header-right">
                        <div className={dateDisplayClass}>
                            <CalendarOutlined />
                            <span>{formattedDate}</span>
                        </div>
                        <Divider type="vertical" style={{ height: 28 }} />
                        <Tooltip title="Refresh all data">
                            <Button icon={<ReloadOutlined />} onClick={() => { 
                                refetchUsers(); 
                                refetchAudit(); 
                                if (isSuperAdminUser) refetchSettings();
                                message.success('Data refreshed'); 
                            }}>Refresh</Button>
                        </Tooltip>
                        <Tooltip title="Export audit logs">
                            <Button icon={<DownloadOutlined />} onClick={() => exportAuditLogs.mutate({})}>Export</Button>
                        </Tooltip>
                    </div>
                </div>

                {/* ==================== MAIN LAYOUT ==================== */}
                <div className="settings-layout">
                    {/* Sidebar */}
                    <div className={sidebarClass}>
                        <div className="settings-sidebar-header">
                            <SettingOutlined />
                            <span>Settings Menu</span>
                            <Badge count={sidebarMenuItems.length} style={{ backgroundColor: '#1a7ab5', marginLeft: 'auto' }} />
                        </div>
                        <div className="settings-sidebar-menu">
                            {sidebarMenuItems.map(item => (
                                <div 
                                    key={item.key} 
                                    className={`settings-sidebar-item ${activeMainTab === item.key ? 'active' : ''}`}
                                    onClick={() => setActiveMainTab(item.key)}
                                >
                                    <div className="settings-sidebar-icon">{item.icon}</div>
                                    <div className="settings-sidebar-info">
                                        <div className="settings-sidebar-label">{item.label}</div>
                                        <div className="settings-sidebar-desc">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ==================== CONTENT AREA ==================== */}
                    <div className={contentClass}>
                        
                        {/* ==================== 1. USER & ROLES ==================== */}
                        {activeMainTab === 'users' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div>
                                        <div className="settings-section-title"><UserOutlined /> Users & Roles</div>
                                        <div className="settings-section-count">
                                            Total: <strong>{totalUsers}</strong> user accounts
                                        </div>
                                    </div>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateAccountOpen(true)}>
                                        Create Account
                                    </Button>
                                </div>

                                <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <div className="settings-filter-group">
                                        <SearchOutlined />
                                        <Input 
                                            placeholder="Search users..." 
                                            value={searchUser} 
                                            onChange={(e) => { setSearchUser(e.target.value); setCurrentPage(1); }} 
                                            style={{ width: 200 }}
                                            allowClear
                                        />
                                    </div>
                                    <div className="settings-filter-group">
                                        <UserOutlined />
                                        <Select 
                                            value={filterRole} 
                                            onChange={(value) => { setFilterRole(value); setCurrentPage(1); }} 
                                            placeholder="Filter by role"
                                            style={{ width: 150 }}
                                            allowClear
                                        >
                                            <Option value="all">All Roles</Option>
                                            {roleOptions.map((role) => <Option key={role.slug} value={role.slug}>{role.name}</Option>)}
                                        </Select>
                                    </div>
                                    <div className="settings-filter-group">
                                        <FilterOutlined />
                                        <Select 
                                            value={filterStatus} 
                                            onChange={(value) => { setFilterStatus(value); setCurrentPage(1); }} 
                                            placeholder="Filter by status"
                                            style={{ width: 150 }}
                                            allowClear
                                        >
                                            <Option value="all">All Status</Option>
                                            <Option value="active">Active</Option>
                                            <Option value="inactive">Inactive</Option>
                                        </Select>
                                    </div>
                                    <Button onClick={() => { setSearchUser(''); setFilterRole('all'); setFilterStatus('all'); setCurrentPage(1); }}>Clear</Button>
                                </div>

                                <div className="settings-roles-summary" style={{ marginBottom: 16 }}>
                                    <Row gutter={12}>
                                        <Col span={6}>
                                            <div className="settings-role-stat">
                                                <div className="settings-role-stat-icon total"><TeamOutlined /></div>
                                                <div>
                                                    <div className="settings-role-stat-count">{totalUsers}</div>
                                                    <div className="settings-role-stat-label">Total Users</div>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="settings-role-stat">
                                                <div className="settings-role-stat-icon active"><CheckCircleOutlined /></div>
                                                <div>
                                                    <div className="settings-role-stat-count">{users.filter(u => u.is_active).length}</div>
                                                    <div className="settings-role-stat-label">Active</div>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="settings-role-stat">
                                                <div className="settings-role-stat-icon inactive"><CloseCircleOutlined /></div>
                                                <div>
                                                    <div className="settings-role-stat-count">{users.filter(u => !u.is_active).length}</div>
                                                    <div className="settings-role-stat-label">Inactive</div>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="settings-role-stat">
                                                <div className="settings-role-stat-icon departments"><AppstoreOutlined /></div>
                                                <div>
                                                    <div className="settings-role-stat-count">{new Set(users.map(u => u.department).filter(Boolean)).size}</div>
                                                    <div className="settings-role-stat-label">Departments</div>
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </div>


                                <div className="settings-table-container">
                                    <Table 
                                        columns={userColumns} 
                                        dataSource={users} 
                                        rowKey="id" 
                                        className={tableClass}
                                        loading={usersLoading}
                                        scroll={{ x: 1100 }}
                                        locale={{
                                            emptyText: (
                                                <div className="settings-empty-state">
                                                    <TeamOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                    <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>No users found</p>
                                                    <p style={{ fontSize: 14, color: '#999' }}>User accounts will appear here once created</p>
                                                </div>
                                            )
                                        }}
                                        pagination={
                                            users.length > 0 ? {
                                                current: currentPage,
                                                pageSize: pageSize,
                                                total: totalUsers,
                                                showSizeChanger: true,
                                                showTotal: (total) => `Total ${total} users`,
                                                itemRender: renderPaginationItem,
                                                onChange: (page, size) => { setCurrentPage(page); if (size) setPageSize(size); },
                                                pageSizeOptions: ['5', '10', '20', '50']
                                            } : false
                                        }
                                    />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 2. AUDIT LOGS ==================== */}
                        {activeMainTab === 'audit' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><HistoryOutlined /> Audit Logs</div>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportAuditLogs.mutate({})}>
                                            Export Logs
                                        </Button>
                                        <Button icon={<ReloadOutlined />} onClick={refetchAudit}>Refresh</Button>
                                    </Space>
                                </div>

                                <div className="settings-audit-filters" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <div className="settings-filter-group">
                                        <UserOutlined />
                                        <Select 
                                            value={filterAuditUser} 
                                            onChange={setFilterAuditUser} 
                                            placeholder="Filter by user"
                                            style={{ width: 160 }}
                                            allowClear
                                        >
                                            <Option value="all">All Users</Option>
                                            {auditUsers.map(user => <Option key={user} value={user}>{user}</Option>)}
                                        </Select>
                                    </div>
                                    <div className="settings-filter-group">
                                        <AppstoreOutlined />
                                        <Select 
                                            value={filterAuditModule} 
                                            onChange={setFilterAuditModule} 
                                            placeholder="Filter by module"
                                            style={{ width: 150 }}
                                            allowClear
                                        >
                                            <Option value="all">All Modules</Option>
                                            {auditModules.map(module => <Option key={module} value={module}>{formatAuditOption(module)}</Option>)}
                                        </Select>
                                    </div>
                                    <div className="settings-filter-group">
                                        <MenuOutlined />
                                        <Select 
                                            value={filterAuditAction} 
                                            onChange={setFilterAuditAction} 
                                            placeholder="Filter by action"
                                            style={{ width: 150 }}
                                            allowClear
                                        >
                                            <Option value="all">All Actions</Option>
                                            {auditActions.map(action => <Option key={action} value={action}>{formatAuditOption(action)}</Option>)}
                                        </Select>
                                    </div>
                                    <div className="settings-filter-group">
                                        <CalendarOutlined />
                                        <DatePicker.RangePicker 
                                            onChange={(dates) => setFilterAuditDate(dates)} 
                                            placeholder={['Start Date', 'End Date']} 
                                            format="YYYY-MM-DD"
                                        />
                                    </div>
                                    <Button onClick={() => { 
                                        setFilterAuditUser('all'); 
                                        setFilterAuditModule('all'); 
                                        setFilterAuditAction('all'); 
                                        setFilterAuditDate(null); 
                                    }}>Clear Filters</Button>
                                </div>

                                <Alert
                                    message="Audit logs are generated automatically by system actions."
                                    description="Use the filters above to review real audit records such as booking approvals, payments, inventory changes, notification reads, and security events."
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />

                                <div className="settings-table-container">
                                    <Table 
                                        columns={auditColumns} 
                                        dataSource={auditLogs} 
                                        rowKey="audit_id" 
                                        className={tableClass}
                                        loading={auditLoading}
                                        scroll={{ x: 1200 }}
                                        locale={{
                                            emptyText: (
                                                <div className="settings-empty-state">
                                                    <HistoryOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                    <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>No audit logs found</p>
                                                    <p style={{ fontSize: 14, color: '#999' }}>Audit logs will appear here as users perform actions</p>
                                                </div>
                                            )
                                        }}
                                        pagination={
                                            auditLogs.length > 0 ? {
                                                pageSize: 10,
                                                showSizeChanger: true,
                                                showTotal: (total) => `Total ${total} logs`,
                                                itemRender: renderPaginationItem,
                                                pageSizeOptions: ['5', '10', '20', '50']
                                            } : false
                                        }
                                    />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 3. PRICING RULES ==================== */}
                        {activeMainTab === 'pricing' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><DollarOutlined /> Pricing Rules</div>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                        const newPackage = { id: Date.now(), name: 'New Package', price_per_head: 0, min_guests: 0, max_guests: 0 };
                                        setPricingRules({...pricingRules, package_pricing: [...pricingRules.package_pricing, newPackage]});
                                    }}>Add Package</Button>
                                </div>

                                <Alert 
                                    message="Pricing controls your business money logic" 
                                    description="Configure base prices, packages, seasonal pricing, and discount rules"
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 16 }}
                                    className="settings-info-alert"
                                />

                                <SettingsCollapse defaultActiveKey={['1']} className="settings-collapse">
                                    <SettingsPanel header="📋 Base Price Per Head" key="1">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Base Price Per Head</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={pricingRules.base_price_per_head} 
                                                        onChange={(v) => setPricingRules({...pricingRules, base_price_per_head: v})} 
                                                        style={{ width: '100%' }} 
                                                        prefix="₱"
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Default price per guest</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>

                                    <SettingsPanel header="📦 Package Pricing" key="2">
                                        <div className="settings-package-list">
                                            {pricingRules.package_pricing.map((pkg, index) => (
                                                <div key={pkg.id || index} className="settings-package-item">
                                                    <div className="settings-package-info">
                                                        <Input 
                                                            value={pkg.name} 
                                                            onChange={(e) => {
                                                                const updated = [...pricingRules.package_pricing];
                                                                updated[index].name = e.target.value;
                                                                setPricingRules({...pricingRules, package_pricing: updated});
                                                            }}
                                                            placeholder="Package name"
                                                            style={{ width: 150 }}
                                                        />
                                                        <InputNumber 
                                                            value={pkg.price_per_head} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.package_pricing];
                                                                updated[index].price_per_head = v;
                                                                setPricingRules({...pricingRules, package_pricing: updated});
                                                            }}
                                                            prefix="₱"
                                                            placeholder="Price"
                                                            style={{ width: 100 }}
                                                        />
                                                        <InputNumber 
                                                            value={pkg.min_guests} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.package_pricing];
                                                                updated[index].min_guests = v;
                                                                setPricingRules({...pricingRules, package_pricing: updated});
                                                            }}
                                                            placeholder="Min"
                                                            style={{ width: 70 }}
                                                        />
                                                        <InputNumber 
                                                            value={pkg.max_guests} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.package_pricing];
                                                                updated[index].max_guests = v;
                                                                setPricingRules({...pricingRules, package_pricing: updated});
                                                            }}
                                                            placeholder="Max"
                                                            style={{ width: 70 }}
                                                        />
                                                    </div>
                                                    <div className="settings-package-actions">
                                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                            const updated = pricingRules.package_pricing.filter((_, i) => i !== index);
                                                            setPricingRules({...pricingRules, package_pricing: updated});
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="🎄 Seasonal Pricing" key="3">
                                        <div className="settings-seasonal-list">
                                            {pricingRules.seasonal_pricing.map((season, index) => (
                                                <div key={season.id || index} className="settings-seasonal-item">
                                                    <div className="settings-seasonal-info">
                                                        <Input 
                                                            value={season.name} 
                                                            onChange={(e) => {
                                                                const updated = [...pricingRules.seasonal_pricing];
                                                                updated[index].name = e.target.value;
                                                                setPricingRules({...pricingRules, seasonal_pricing: updated});
                                                            }}
                                                            placeholder="Season name"
                                                            style={{ width: 150 }}
                                                        />
                                                        <InputNumber 
                                                            value={season.multiplier} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.seasonal_pricing];
                                                                updated[index].multiplier = v;
                                                                setPricingRules({...pricingRules, seasonal_pricing: updated});
                                                            }}
                                                            step={0.1}
                                                            placeholder="Multiplier"
                                                            style={{ width: 80 }}
                                                        />
                                                        <DatePicker 
                                                            value={season.start_date ? dayjs(season.start_date) : null}
                                                            onChange={(date) => {
                                                                const updated = [...pricingRules.seasonal_pricing];
                                                                updated[index].start_date = date ? date.format('YYYY-MM-DD') : '';
                                                                setPricingRules({...pricingRules, seasonal_pricing: updated});
                                                            }}
                                                            placeholder="Start"
                                                            style={{ width: 130 }}
                                                        />
                                                        <DatePicker 
                                                            value={season.end_date ? dayjs(season.end_date) : null}
                                                            onChange={(date) => {
                                                                const updated = [...pricingRules.seasonal_pricing];
                                                                updated[index].end_date = date ? date.format('YYYY-MM-DD') : '';
                                                                setPricingRules({...pricingRules, seasonal_pricing: updated});
                                                            }}
                                                            placeholder="End"
                                                            style={{ width: 130 }}
                                                        />
                                                    </div>
                                                    <div className="settings-seasonal-actions">
                                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                            const updated = pricingRules.seasonal_pricing.filter((_, i) => i !== index);
                                                            setPricingRules({...pricingRules, seasonal_pricing: updated});
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="🏷️ Discount Rules" key="4">
                                        <div className="settings-discount-list">
                                            {pricingRules.discount_rules.map((rule, index) => (
                                                <div key={rule.id || index} className="settings-discount-item">
                                                    <div className="settings-discount-info">
                                                        <Input 
                                                            value={rule.name} 
                                                            onChange={(e) => {
                                                                const updated = [...pricingRules.discount_rules];
                                                                updated[index].name = e.target.value;
                                                                setPricingRules({...pricingRules, discount_rules: updated});
                                                            }}
                                                            placeholder="Rule name"
                                                            style={{ width: 150 }}
                                                        />
                                                        <InputNumber 
                                                            value={rule.discount_percentage} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.discount_rules];
                                                                updated[index].discount_percentage = v;
                                                                setPricingRules({...pricingRules, discount_rules: updated});
                                                            }}
                                                            suffix="%"
                                                            placeholder="Discount"
                                                            style={{ width: 80 }}
                                                        />
                                                        <InputNumber 
                                                            value={rule.min_guests} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.discount_rules];
                                                                updated[index].min_guests = v;
                                                                setPricingRules({...pricingRules, discount_rules: updated});
                                                            }}
                                                            placeholder="Min guests"
                                                            style={{ width: 80 }}
                                                        />
                                                        <InputNumber 
                                                            value={rule.days_before_event} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.discount_rules];
                                                                updated[index].days_before_event = v;
                                                                setPricingRules({...pricingRules, discount_rules: updated});
                                                            }}
                                                            placeholder="Days before"
                                                            style={{ width: 80 }}
                                                        />
                                                    </div>
                                                    <div className="settings-discount-actions">
                                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                            const updated = pricingRules.discount_rules.filter((_, i) => i !== index);
                                                            setPricingRules({...pricingRules, discount_rules: updated});
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="💳 Promo Codes" key="5">
                                        <div className="settings-promo-list">
                                            {pricingRules.promo_codes.map((promo, index) => (
                                                <div key={promo.id || index} className="settings-promo-item">
                                                    <div className="settings-promo-info">
                                                        <Input 
                                                            value={promo.code} 
                                                            onChange={(e) => {
                                                                const updated = [...pricingRules.promo_codes];
                                                                updated[index].code = e.target.value;
                                                                setPricingRules({...pricingRules, promo_codes: updated});
                                                            }}
                                                            placeholder="Code"
                                                            style={{ width: 120 }}
                                                        />
                                                        <InputNumber 
                                                            value={promo.discount} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.promo_codes];
                                                                updated[index].discount = v;
                                                                setPricingRules({...pricingRules, promo_codes: updated});
                                                            }}
                                                            suffix="%"
                                                            placeholder="Discount"
                                                            style={{ width: 80 }}
                                                        />
                                                        <DatePicker 
                                                            value={promo.expires ? dayjs(promo.expires) : null}
                                                            onChange={(date) => {
                                                                const updated = [...pricingRules.promo_codes];
                                                                updated[index].expires = date ? date.format('YYYY-MM-DD') : '';
                                                                setPricingRules({...pricingRules, promo_codes: updated});
                                                            }}
                                                            placeholder="Expires"
                                                            style={{ width: 130 }}
                                                        />
                                                        <InputNumber 
                                                            value={promo.usage_limit} 
                                                            onChange={(v) => {
                                                                const updated = [...pricingRules.promo_codes];
                                                                updated[index].usage_limit = v;
                                                                setPricingRules({...pricingRules, promo_codes: updated});
                                                            }}
                                                            placeholder="Usage limit"
                                                            style={{ width: 80 }}
                                                        />
                                                    </div>
                                                    <div className="settings-promo-actions">
                                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                            const updated = pricingRules.promo_codes.filter((_, i) => i !== index);
                                                            setPricingRules({...pricingRules, promo_codes: updated});
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="🧾 Tax Settings" key="6">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Tax Percentage</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        max={100} 
                                                        value={pricingRules.tax_settings?.tax_percentage || 12} 
                                                        onChange={(v) => setPricingRules({...pricingRules, tax_settings: {...pricingRules.tax_settings, tax_percentage: v}})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="%"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Service Charge</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={pricingRules.tax_settings?.service_charge || 10} 
                                                        onChange={(v) => setPricingRules({...pricingRules, tax_settings: {...pricingRules.tax_settings, service_charge: v}})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="%"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Tax Inclusive</div>
                                                    <Switch 
                                                        checked={pricingRules.tax_settings?.is_tax_inclusive || false} 
                                                        onChange={(v) => setPricingRules({...pricingRules, tax_settings: {...pricingRules.tax_settings, is_tax_inclusive: v}})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Include tax in displayed prices</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>
                                </SettingsCollapse>

                                <div className="settings-section-actions">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveSettings('pricing', pricingRules)}>
                                        Save All Pricing Rules
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* ==================== 4. DELIVERY SETTINGS ==================== */}
                        {activeMainTab === 'delivery' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><TruckOutlined /> Delivery Settings</div>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                        const newZone = { id: Date.now(), name: 'New Zone', fee: 0, min_order: 0 };
                                        setDeliverySettings({...deliverySettings, delivery_zones: [...deliverySettings.delivery_zones, newZone]});
                                    }}>Add Zone</Button>
                                </div>

                                <Alert 
                                    message="Delivery Logistics Configuration" 
                                    description="Configure delivery zones, fees, vehicles, and time slots"
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 16 }}
                                    className="settings-info-alert"
                                />

                                <SettingsCollapse defaultActiveKey={['1']} className="settings-collapse">
                                    <SettingsPanel header="📍 Delivery Zones & Fees" key="1">
                                        <div className="settings-zone-list">
                                            {deliverySettings.delivery_zones.map((zone, index) => (
                                                <div key={zone.id || index} className="settings-zone-item">
                                                    <div className="settings-zone-info">
                                                        <Input 
                                                            value={zone.name} 
                                                            onChange={(e) => {
                                                                const updated = [...deliverySettings.delivery_zones];
                                                                updated[index].name = e.target.value;
                                                                setDeliverySettings({...deliverySettings, delivery_zones: updated});
                                                            }}
                                                            placeholder="Zone name"
                                                            style={{ width: 200 }}
                                                        />
                                                        <InputNumber 
                                                            value={zone.fee} 
                                                            onChange={(v) => {
                                                                const updated = [...deliverySettings.delivery_zones];
                                                                updated[index].fee = v;
                                                                setDeliverySettings({...deliverySettings, delivery_zones: updated});
                                                            }}
                                                            prefix="₱"
                                                            placeholder="Fee"
                                                            style={{ width: 100 }}
                                                        />
                                                        <InputNumber 
                                                            value={zone.min_order} 
                                                            onChange={(v) => {
                                                                const updated = [...deliverySettings.delivery_zones];
                                                                updated[index].min_order = v;
                                                                setDeliverySettings({...deliverySettings, delivery_zones: updated});
                                                            }}
                                                            prefix="₱"
                                                            placeholder="Min order"
                                                            style={{ width: 100 }}
                                                        />
                                                    </div>
                                                    <div className="settings-zone-actions">
                                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                            const updated = deliverySettings.delivery_zones.filter((_, i) => i !== index);
                                                            setDeliverySettings({...deliverySettings, delivery_zones: updated});
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="🚗 Vehicle Assignment" key="2">
                                        <div className="settings-vehicle-list">
                                            {deliverySettings.vehicle_assignment.map((vehicle, index) => (
                                                <div key={vehicle.id || index} className="settings-vehicle-item">
                                                    <div className="settings-vehicle-info">
                                                        <Input 
                                                            value={vehicle.name} 
                                                            onChange={(e) => {
                                                                const updated = [...deliverySettings.vehicle_assignment];
                                                                updated[index].name = e.target.value;
                                                                setDeliverySettings({...deliverySettings, vehicle_assignment: updated});
                                                            }}
                                                            placeholder="Vehicle name"
                                                            style={{ width: 150 }}
                                                        />
                                                        <Input 
                                                            value={vehicle.driver} 
                                                            onChange={(e) => {
                                                                const updated = [...deliverySettings.vehicle_assignment];
                                                                updated[index].driver = e.target.value;
                                                                setDeliverySettings({...deliverySettings, vehicle_assignment: updated});
                                                            }}
                                                            placeholder="Driver"
                                                            style={{ width: 120 }}
                                                        />
                                                        <Input 
                                                            value={vehicle.plate_number} 
                                                            onChange={(e) => {
                                                                const updated = [...deliverySettings.vehicle_assignment];
                                                                updated[index].plate_number = e.target.value;
                                                                setDeliverySettings({...deliverySettings, vehicle_assignment: updated});
                                                            }}
                                                            placeholder="Plate"
                                                            style={{ width: 100 }}
                                                        />
                                                        <Select 
                                                            value={vehicle.status} 
                                                            onChange={(v) => {
                                                                const updated = [...deliverySettings.vehicle_assignment];
                                                                updated[index].status = v;
                                                                setDeliverySettings({...deliverySettings, vehicle_assignment: updated});
                                                            }}
                                                            style={{ width: 100 }}
                                                        >
                                                            <Option value="available">Available</Option>
                                                            <Option value="assigned">Assigned</Option>
                                                            <Option value="maintenance">Maintenance</Option>
                                                        </Select>
                                                    </div>
                                                    <div className="settings-vehicle-actions">
                                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                            const updated = deliverySettings.vehicle_assignment.filter((_, i) => i !== index);
                                                            setDeliverySettings({...deliverySettings, vehicle_assignment: updated});
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="⏰ Delivery Time Slots" key="3">
                                        <div className="settings-timeslot-list">
                                            {deliverySettings.delivery_time_slots.map((slot, idx) => (
                                                <div key={idx} className="settings-timeslot-item">
                                                    <ClockCircleOutlined /> {slot}
                                                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                        const updated = deliverySettings.delivery_time_slots.filter((_, i) => i !== idx);
                                                        setDeliverySettings({...deliverySettings, delivery_time_slots: updated});
                                                    }} />
                                                </div>
                                            ))}
                                            <Button size="small" icon={<PlusOutlined />} onClick={() => {
                                                const newSlot = prompt('Enter new time slot (e.g., 9:00 AM - 11:00 AM):');
                                                if (newSlot) {
                                                    setDeliverySettings({...deliverySettings, delivery_time_slots: [...deliverySettings.delivery_time_slots, newSlot]});
                                                }
                                            }}>Add Time Slot</Button>
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="⚙️ General Settings" key="4">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Free Delivery Threshold</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={deliverySettings.free_delivery_threshold} 
                                                        onChange={(v) => setDeliverySettings({...deliverySettings, free_delivery_threshold: v})} 
                                                        style={{ width: '100%' }} 
                                                        prefix="₱"
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Orders above this get free delivery</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Pickup Allowed</div>
                                                    <Switch 
                                                        checked={deliverySettings.pickup_allowed} 
                                                        onChange={(v) => setDeliverySettings({...deliverySettings, pickup_allowed: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Enable customer pickup option</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Distance Based Fee</div>
                                                    <Switch 
                                                        checked={deliverySettings.distance_based_fee} 
                                                        onChange={(v) => setDeliverySettings({...deliverySettings, distance_based_fee: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Calculate fee based on distance</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>
                                </SettingsCollapse>

                                <div className="settings-section-actions">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveSettings('delivery', deliverySettings)}>
                                        Save Delivery Settings
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* ==================== 5. EMPLOYEE SETTINGS ==================== */}
                        {activeMainTab === 'employee' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><TeamOutlined /> Employee Settings</div>
                                </div>

                                <Alert 
                                    message="Workforce Management Settings" 
                                    description="Configure employee policies, attendance rules, and leave management"
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 16 }}
                                    className="settings-info-alert"
                                />

                                <SettingsCollapse className="settings-collapse">
                                    <SettingsPanel header="⚙️ General Settings" key="1">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Grace Period (min)</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={employeeSettings.grace_period_minutes} 
                                                        onChange={(v) => setEmployeeSettings({...employeeSettings, grace_period_minutes: v})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="min"
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Minutes allowed before considered late</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Late Deduction per Min</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={employeeSettings.late_deduction_per_minute} 
                                                        onChange={(v) => setEmployeeSettings({...employeeSettings, late_deduction_per_minute: v})} 
                                                        style={{ width: '100%' }} 
                                                        prefix="₱"
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Amount deducted per minute of lateness</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Sick Leave Days</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={employeeSettings.sick_leave_days_per_year} 
                                                        onChange={(v) => setEmployeeSettings({...employeeSettings, sick_leave_days_per_year: v})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="days"
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Annual sick leave entitlement</div>
                                                </div>
                                            </Col>
                                        </Row>
                                        <Row gutter={20} style={{ marginTop: 16 }}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Vacation Leave Days</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={employeeSettings.vacation_leave_days_per_year} 
                                                        onChange={(v) => setEmployeeSettings({...employeeSettings, vacation_leave_days_per_year: v})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="days"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Attendance Tracking</div>
                                                    <Switch 
                                                        checked={employeeSettings.attendance_tracking} 
                                                        onChange={(v) => setEmployeeSettings({...employeeSettings, attendance_tracking: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>
                                </SettingsCollapse>

                                <div className="settings-section-actions">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveSettings('employee', employeeSettings)}>
                                        Save Employee Settings
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* ==================== 6. PAYROLL ==================== */}
                        {activeMainTab === 'payroll' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><CalculatorOutlined /> Payroll Configuration</div>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                        const newSalary = { role: 'New Role', amount: 0 };
                                        setPayrollSettings({...payrollSettings, monthly_salary: [...payrollSettings.monthly_salary, newSalary]});
                                    }}>Add Salary</Button>
                                </div>

                                <Alert 
                                    message="Salary & Payroll System" 
                                    description="Configure monthly salary, daily wage, overtime rates, and bonus rules"
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 16 }}
                                    className="settings-info-alert"
                                />

                                <Row gutter={20} style={{ marginBottom: 16 }}>
                                    {payrollSettings.monthly_salary.map((item, index) => (
                                        <Col span={6} key={index}>
                                            <div className="settings-salary-card">
                                                <Input 
                                                    value={item.role} 
                                                    onChange={(e) => {
                                                        const updated = [...payrollSettings.monthly_salary];
                                                        updated[index].role = e.target.value;
                                                        setPayrollSettings({...payrollSettings, monthly_salary: updated});
                                                    }}
                                                    placeholder="Role"
                                                    style={{ width: '100%' }}
                                                />
                                                <InputNumber 
                                                    value={item.amount} 
                                                    onChange={(v) => {
                                                        const updated = [...payrollSettings.monthly_salary];
                                                        updated[index].amount = v;
                                                        setPayrollSettings({...payrollSettings, monthly_salary: updated});
                                                    }}
                                                    prefix="₱"
                                                    placeholder="Amount"
                                                    style={{ width: '100%', marginTop: 4 }}
                                                />
                                                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                    const updated = payrollSettings.monthly_salary.filter((_, i) => i !== index);
                                                    setPayrollSettings({...payrollSettings, monthly_salary: updated});
                                                }} style={{ marginTop: 4 }}>Remove</Button>
                                            </div>
                                        </Col>
                                    ))}
                                </Row>

                                <SettingsCollapse className="settings-collapse">
                                    <SettingsPanel header="💰 Wage & Overtime" key="1">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Daily Wage</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={payrollSettings.daily_wage} 
                                                        onChange={(v) => setPayrollSettings({...payrollSettings, daily_wage: v})} 
                                                        style={{ width: '100%' }} 
                                                        prefix="₱"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Hourly Rate</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={payrollSettings.hourly_rate} 
                                                        onChange={(v) => setPayrollSettings({...payrollSettings, hourly_rate: v})} 
                                                        style={{ width: '100%' }} 
                                                        prefix="₱"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Overtime Rate</div>
                                                    <InputNumber 
                                                        min={1} 
                                                        step={0.1} 
                                                        value={payrollSettings.overtime_rate} 
                                                        onChange={(v) => setPayrollSettings({...payrollSettings, overtime_rate: v})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="x"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>
                                </SettingsCollapse>

                                <div className="settings-section-actions">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveSettings('payroll', payrollSettings)}>
                                        Save Payroll Settings
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* ==================== 7. INVENTORY ==================== */}
                        {activeMainTab === 'inventory' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><BoxPlotOutlined /> Inventory Management</div>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                        const newIngredient = { id: Date.now(), name: 'New Ingredient', current_stock: 0, unit: 'kg', reorder_level: 10, low_stock_threshold: 5, cost_per_unit: 0 };
                                        setInventorySettings({...inventorySettings, ingredients: [...inventorySettings.ingredients, newIngredient]});
                                    }}>Add Ingredient</Button>
                                </div>

                                <Alert 
                                    message="Stock Management System" 
                                    description="Track ingredients, stock levels, suppliers, and auto-deduct from bookings"
                                    type="info" 
                                    showIcon 
                                    style={{ marginBottom: 16 }}
                                    className="settings-info-alert"
                                />

                                <div className="settings-inventory-grid" style={{ marginBottom: 16 }}>
                                    <Row gutter={12}>
                                        {inventorySettings.ingredients.map((ing, index) => (
                                            <Col span={6} key={ing.id || index}>
                                                <div className="settings-ingredient-card">
                                                    <Input 
                                                        value={ing.name} 
                                                        onChange={(e) => {
                                                            const updated = [...inventorySettings.ingredients];
                                                            updated[index].name = e.target.value;
                                                            setInventorySettings({...inventorySettings, ingredients: updated});
                                                        }}
                                                        placeholder="Name"
                                                        style={{ width: '100%' }}
                                                    />
                                                    <div className="settings-ingredient-stock">
                                                        <InputNumber 
                                                            value={ing.current_stock} 
                                                            onChange={(v) => {
                                                                const updated = [...inventorySettings.ingredients];
                                                                updated[index].current_stock = v;
                                                                setInventorySettings({...inventorySettings, ingredients: updated});
                                                            }}
                                                            placeholder="Stock"
                                                            style={{ width: '60%' }}
                                                        />
                                                        <Input 
                                                            value={ing.unit} 
                                                            onChange={(e) => {
                                                                const updated = [...inventorySettings.ingredients];
                                                                updated[index].unit = e.target.value;
                                                                setInventorySettings({...inventorySettings, ingredients: updated});
                                                            }}
                                                            placeholder="Unit"
                                                            style={{ width: '35%' }}
                                                        />
                                                    </div>
                                                    <Progress 
                                                        percent={Math.min((ing.current_stock / ing.reorder_level) * 100, 100)} 
                                                        size="small" 
                                                        strokeColor={ing.current_stock <= ing.low_stock_threshold ? '#ef4444' : '#10b981'}
                                                    />
                                                    <div className="settings-ingredient-meta">
                                                        <InputNumber 
                                                            value={ing.reorder_level} 
                                                            onChange={(v) => {
                                                                const updated = [...inventorySettings.ingredients];
                                                                updated[index].reorder_level = v;
                                                                setInventorySettings({...inventorySettings, ingredients: updated});
                                                            }}
                                                            placeholder="Reorder"
                                                            style={{ width: '45%' }}
                                                            prefix="R:"
                                                        />
                                                        <InputNumber 
                                                            value={ing.cost_per_unit} 
                                                            onChange={(v) => {
                                                                const updated = [...inventorySettings.ingredients];
                                                                updated[index].cost_per_unit = v;
                                                                setInventorySettings({...inventorySettings, ingredients: updated});
                                                            }}
                                                            prefix="₱"
                                                            placeholder="Cost"
                                                            style={{ width: '45%' }}
                                                        />
                                                    </div>
                                                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                        const updated = inventorySettings.ingredients.filter((_, i) => i !== index);
                                                        setInventorySettings({...inventorySettings, ingredients: updated});
                                                    }} style={{ marginTop: 4 }}>Remove</Button>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>

                                <SettingsCollapse className="settings-collapse">
                                    <SettingsPanel header="⚙️ General Settings" key="1">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Low Stock Threshold</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={inventorySettings.low_stock_threshold} 
                                                        onChange={(v) => setInventorySettings({...inventorySettings, low_stock_threshold: v})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="units"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Reorder Level</div>
                                                    <InputNumber 
                                                        min={0} 
                                                        value={inventorySettings.reorder_level} 
                                                        onChange={(v) => setInventorySettings({...inventorySettings, reorder_level: v})} 
                                                        style={{ width: '100%' }} 
                                                        suffix="units"
                                                        className="settings-input-enhanced"
                                                    />
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Auto Deduct Inventory</div>
                                                    <Switch 
                                                        checked={inventorySettings.auto_deduct_inventory} 
                                                        onChange={(v) => setInventorySettings({...inventorySettings, auto_deduct_inventory: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Auto deduct from bookings</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>
                                </SettingsCollapse>

                                <div className="settings-section-actions">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveSettings('inventory', inventorySettings)}>
                                        Save Inventory Settings
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* ==================== 8. SECURITY ==================== */}
                        {activeMainTab === 'security' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-section-header">
                                    <div className="settings-section-title"><SafetyOutlined /> Security Settings</div>
                                </div>

                                <Alert 
                                    message="System Protection & Access Control" 
                                    description="Configure password policies, 2FA, session control, and IP whitelisting"
                                    type="warning" 
                                    showIcon 
                                    style={{ marginBottom: 16 }}
                                    className="settings-info-alert"
                                />

                                <SettingsCollapse defaultActiveKey={['1']} className="settings-collapse">
                                    <SettingsPanel header="🔐 Password & Login Security" key="1">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Min Password Length</div>
                                                    <InputNumber 
                                                        min={6} 
                                                        max={20} 
                                                        value={securitySettings.password_min_length} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, password_min_length: v})} 
                                                        style={{ width: '100%' }} 
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Minimum characters required</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Session Timeout (min)</div>
                                                    <InputNumber 
                                                        min={5} 
                                                        value={securitySettings.session_timeout_minutes} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, session_timeout_minutes: v})} 
                                                        style={{ width: '100%' }} 
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Auto-logout after inactivity</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Login Attempts Limit</div>
                                                    <InputNumber 
                                                        min={1} 
                                                        max={10} 
                                                        value={securitySettings.login_attempts_limit} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, login_attempts_limit: v})} 
                                                        style={{ width: '100%' }} 
                                                        className="settings-input-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Max failed attempts before lockout</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>

                                    <SettingsPanel header="🛡️ Two-Factor Authentication" key="2">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Enable 2FA</div>
                                                    <Switch 
                                                        checked={securitySettings.two_factor_auth} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, two_factor_auth: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Require 2FA for all users</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>

                                    <SettingsPanel header="🌐 IP Whitelist" key="3">
                                        <div className="settings-ip-list">
                                            {securitySettings.ip_whitelist.map((ip, idx) => (
                                                <div key={idx} className="settings-ip-item">
                                                    <span className="settings-ip-address">{ip}</span>
                                                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
                                                        const updated = securitySettings.ip_whitelist.filter((_, i) => i !== idx);
                                                        setSecuritySettings({...securitySettings, ip_whitelist: updated});
                                                    }} />
                                                </div>
                                            ))}
                                            <Button size="small" icon={<PlusOutlined />} onClick={() => {
                                                const newIP = prompt('Enter IP address:');
                                                if (newIP) {
                                                    setSecuritySettings({...securitySettings, ip_whitelist: [...securitySettings.ip_whitelist, newIP]});
                                                }
                                            }}>Add IP</Button>
                                        </div>
                                    </SettingsPanel>

                                    <SettingsPanel header="📱 Device & Activity Tracking" key="4">
                                        <Row gutter={20}>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Device Login Tracking</div>
                                                    <Switch 
                                                        checked={securitySettings.device_login_tracking} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, device_login_tracking: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Track device info on login</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Activity Alerts</div>
                                                    <Switch 
                                                        checked={securitySettings.activity_alerts} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, activity_alerts: v})} 
                                                        className="settings-switch-enhanced"
                                                    />
                                                    <div className="settings-config-hint">Send alerts for suspicious activity</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div className="settings-config-card">
                                                    <div className="settings-config-label">Account Lock Duration</div>
                                                    <InputNumber 
                                                        min={1} 
                                                        value={securitySettings.account_lock_duration} 
                                                        onChange={(v) => setSecuritySettings({...securitySettings, account_lock_duration: v})} 
                                                        suffix="min"
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                            </Col>
                                        </Row>
                                    </SettingsPanel>
                                </SettingsCollapse>

                                <div className="settings-section-actions">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSaveSettings('security', securitySettings)}>
                                        Save Security Settings
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                title={<span><UserOutlined /> Create User Account</span>}
                open={createAccountOpen}
                onCancel={() => {
                    setCreateAccountOpen(false);
                    createAccountForm.resetFields();
                }}
                onOk={() => createAccountForm.submit()}
                confirmLoading={createUser.isPending}
                okText="Create Account"
                destroyOnHidden
            >
                <Form
                    form={createAccountForm}
                    layout="vertical"
                    onFinish={handleCreateAccount}
                    initialValues={{ is_active: true }}
                    preserve={false}
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="first_name"
                                label="First Name"
                                rules={[{ required: true, message: 'Enter the first name' }]}
                            >
                                <Input autoComplete="given-name" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="last_name"
                                label="Last Name"
                                rules={[{ required: true, message: 'Enter the last name' }]}
                            >
                                <Input autoComplete="family-name" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="email"
                        label="Email Address"
                        rules={[
                            { required: true, message: 'Enter an email address' },
                            { type: 'email', message: 'Enter a valid email address' },
                        ]}
                    >
                        <Input prefix={<MailOutlined />} autoComplete="email" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="username"
                                label="Username"
                                rules={[
                                    { required: true, message: 'Enter a username' },
                                    { pattern: /^[A-Za-z0-9_-]+$/, message: 'Use letters, numbers, underscores, or hyphens only' },
                                ]}
                            >
                                <Input autoComplete="username" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="phone" label="Phone Number">
                                <Input prefix={<PhoneOutlined />} autoComplete="tel" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="role_slug"
                        label="Assigned Role"
                        rules={[{ required: true, message: 'Select a role' }]}
                    >
                        <Select placeholder="Select access role">
                            {createAccountRoles.map((role) => (
                                <Option key={role.slug} value={role.slug}>
                                    {role.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="password"
                                label="Temporary Password"
                                rules={[
                                    { required: true, message: 'Enter a password' },
                                    { min: 8, message: 'Password must contain at least 8 characters' },
                                ]}
                            >
                                <Input.Password autoComplete="new-password" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="password_confirmation"
                                label="Confirm Password"
                                dependencies={['password']}
                                rules={[
                                    { required: true, message: 'Confirm the password' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('password') === value) return Promise.resolve();
                                            return Promise.reject(new Error('Passwords do not match'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password autoComplete="new-password" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="is_active" label="Account Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                </Form>
            </Modal>
        </ConfigProvider>
    );
};

export default SystemSettings;