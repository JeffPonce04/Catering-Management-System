// src/components/SystemSettings.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Card, Table, Button, Space, Input, Select, Modal, Tag, message, Divider, Tooltip, Typography,
    Row, Col, Alert, Form, Switch, Avatar, Badge, ConfigProvider, theme as antdTheme,
    InputNumber, Descriptions, DatePicker, Collapse, Dropdown
} from 'antd';
import {
    SettingOutlined, UserOutlined, HistoryOutlined, TruckOutlined,
    TeamOutlined, CalendarOutlined,
    SafetyOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
    ReloadOutlined, DownloadOutlined,
    CheckCircleOutlined, CloseCircleOutlined,
    LeftOutlined, RightOutlined,
    MailOutlined,
    SearchOutlined, CrownOutlined, CloseOutlined,
    MoreOutlined, EyeOutlined, StopOutlined, LogoutOutlined, KeyOutlined, UserDeleteOutlined,
    LockOutlined as LockIcon, BookOutlined, ClockCircleOutlined, WalletOutlined,
    CalendarFilled, SafetyCertificateOutlined, DatabaseOutlined, NotificationOutlined,SaveOutlined
} from '@ant-design/icons';
import {
    useSettings,
    useUpdateSettingsSection,
    useUsers,
    useRoles,
    useAuditLogs,
    useExportAuditLogs,
    useCreateUser,
    useUpdateUser,
    useToggleUserActive,
    useBanUser,
    useUnbanUser,
    useForceLogoutUser,
    useForceChangePassword,
    useEmployeesWithoutAccounts
} from '../../../hooks/useSettingsQueries';
import { useAuth } from '../../../contexts/AuthContext';
import { isSuperAdmin } from '../../../utils/roleRoutes';
import StaffSettingsPanel from '../pages/StaffSettingsPanel';
import DeliverySettingsPanel from '../pages/DeliverySettingsPanel';
import AnnouncementsPanel from '../pages/AnnouncementsPanel';
import BackupConfigPanel from '../pages//BackupConfigPanel';
import PermissionsGridPanel from '../pages//PermissionsGridPanel';
import PasswordSecurityPanel from '../pages//PasswordSecurityPanel';
import UserAccountSettingsPanel from '../pages//UserAccountSettingsPanel';
import SystemMaintenancePanel from '../pages//SystemMaintenancePanel';
import dayjs from 'dayjs';
import '../styles/Settings.css';

const { Title, Text } = Typography;
const { Option } = Select;

const SettingsCollapse = ({ children, items, ...props }) => {
    const normalizedItems = items ?? React.Children.map(children, (panel) => {
        const { header, children: panelChildren, ...itemProps } = panel.props;
        return { key: panel.key, label: header, children: panelChildren, ...itemProps };
    });
    return <Collapse {...props} items={normalizedItems} />;
};

const SettingsPanel = ({ children }) => children;

const SYSTEM_ACCOUNT_ROLE_SLUGS = new Set([
    'super-admin', 'admin', 'cashier', 'inventory-manager', 'staff-manager',
]);

const ADMIN_ROLE_SLUGS = ['admin', 'administrator', 'owner'];

const AUDIT_MODULE_OPTIONS = [
    'auth', 'users', 'bookings', 'quotations', 'orders', 'inventory', 'purchases',
    'employees', 'schedules', 'employee_requests', 'attendance', 'payroll', 'finance',
    'events', 'menu', 'customers', 'settings', 'reports', 'notifications', 'security', 'delivery'
];

const formatAuditOption = (value) =>
    String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SystemSettings = () => {
    const location = useLocation();
    const { user } = useAuth();
    const isSuperAdminUser = isSuperAdmin(user);

    const isAdminUser = useMemo(() => {
        if (!user) return false;
        const roles = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])]
            .filter(Boolean)
            .map((r) => String(r).toLowerCase());
        return roles.some((r) => ADMIN_ROLE_SLUGS.includes(r));
    }, [user]);

    const canManageBookingPolicy = isSuperAdminUser || isAdminUser;

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
    const [createAccountOpen, setCreateAccountOpen] = useState(false);
    const [viewUserOpen, setViewUserOpen] = useState(false);
    const [editUserOpen, setEditUserOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [createAccountForm] = Form.useForm();
    const [editUserForm] = Form.useForm();
    const [changePasswordForm] = Form.useForm();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
    const [employeeSearch, setEmployeeSearch] = useState('');

    const { data: settings, refetch: refetchSettings } = useSettings({ enabled: canManageBookingPolicy });
    const updateSettings = useUpdateSettingsSection();

    const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsers({
        search: searchUser,
        per_page: pageSize,
        page: currentPage,
        role: filterRole !== 'all' ? filterRole : undefined,
        is_active: filterStatus !== 'all' ? filterStatus === 'active' : undefined,
    });

    const { data: roles = [] } = useRoles();
    const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useAuditLogs({
        user: filterAuditUser !== 'all' ? filterAuditUser : undefined,
        module: filterAuditModule !== 'all' ? filterAuditModule : undefined,
        action: filterAuditAction !== 'all' ? filterAuditAction : undefined,
        start_date: filterAuditDate?.[0] ? filterAuditDate[0].format('YYYY-MM-DD') : undefined,
        end_date: filterAuditDate?.[1] ? filterAuditDate[1].format('YYYY-MM-DD') : undefined,
    });

    const createUser = useCreateUser();
    const updateUser = useUpdateUser();
    const toggleUserActive = useToggleUserActive();
    const banUser = useBanUser();
    const unbanUser = useUnbanUser();
    const forceLogoutUser = useForceLogoutUser();
    const forceChangePassword = useForceChangePassword();
    const exportAuditLogs = useExportAuditLogs();

    const { data: employeesWithoutAccounts = [], isLoading: employeesLoading } = useEmployeesWithoutAccounts(
        { search: employeeSearch, per_page: 50 },
        { enabled: createAccountOpen }
    );

    const [bookingSettings, setBookingSettings] = useState({
        minimum_pax: 10,
        allow_same_day_booking: false,
        allow_holiday_booking: false,
        allow_weekend_booking: true,
        cancellation_cutoff_days: 3,
        deposit_payment_days: 7,
        deposit_amount: 5000,
        require_deposit: true,
    });

    useEffect(() => {
        if (settings) {
            if (settings.booking) {
                setBookingSettings(prev => ({ ...prev, ...settings.booking }));
            }
        }
    }, [settings]);

    const handleSaveSettings = async (section, data) => {
        try {
            await updateSettings.mutateAsync({ section, data });
            await refetchSettings();
        } catch (error) { /* handled */ }
    };

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        setIsDarkMode(savedTheme === 'dark' || (savedTheme !== 'light' && document.body.classList.contains('dark-mode')));
        const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('dark-mode')));
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const users = usersData?.data || [];
    const totalUsers = usersData?.total || 0;
    const auditLogs = auditData?.data || [];
    const auditUsers = [...new Set(auditLogs.map(log => log.user_name).filter(Boolean))];
    const auditModules = [...new Set([...AUDIT_MODULE_OPTIONS, ...auditLogs.map(log => log.module).filter(Boolean)])];
    const auditActions = [...new Set(auditLogs.map(log => log.action).filter(Boolean))];
    const roleOptions = roles.filter((role) => role.is_active !== false);

    const assignableRoles = useMemo(() => {
        if (isSuperAdminUser) return roleOptions.filter(r => SYSTEM_ACCOUNT_ROLE_SLUGS.has(r.slug));
        return roleOptions.filter(r => SYSTEM_ACCOUNT_ROLE_SLUGS.has(r.slug) && r.slug !== 'super-admin' && r.slug !== 'admin');
    }, [roleOptions, isSuperAdminUser]);

    const selectedEmployee = useMemo(
        () => (employeesWithoutAccounts || []).find(e => e.employee_id === selectedEmployeeId),
        [employeesWithoutAccounts, selectedEmployeeId]
    );

    const handleCreateAccount = async (values) => {
        try {
            if (!selectedEmployeeId) { message.error('Please select an employee first.'); return; }
            await createUser.mutateAsync({
                employee_id: selectedEmployeeId,
                username: values.username,
                password: values.password,
                password_confirmation: values.password_confirmation,
                role_slug: values.role_slug,
                is_active: values.is_active ?? true,
            });
            createAccountForm.resetFields();
            setSelectedEmployeeId(null);
            setEmployeeSearch('');
            setCreateAccountOpen(false);
            setCurrentPage(1);
        } catch (error) { /* handled */ }
    };

    const openEditUser = (record) => {
        setSelectedUser(record);
        editUserForm.setFieldsValue({ username: record.username, role_slug: record.role, is_active: record.is_active });
        setEditUserOpen(true);
    };

    const handleUpdateUser = async (values) => {
        try {
            await updateUser.mutateAsync({
                userId: selectedUser.id,
                data: { username: values.username, role_slug: values.role_slug, is_active: values.is_active },
            });
            setEditUserOpen(false);
            setSelectedUser(null);
            editUserForm.resetFields();
        } catch (error) { /* handled */ }
    };

    const openViewUser = (record) => { setSelectedUser(record); setViewUserOpen(true); };

    const handleDeactivate = (record) => {
        Modal.confirm({
            title: 'Deactivate Account',
            content: `Deactivate ${record.name}'s account?`,
            okText: 'Deactivate', okType: 'danger',
            onOk: async () => { await toggleUserActive.mutateAsync(record.id); },
        });
    };

    const handleReactivate = (record) => {
        Modal.confirm({
            title: 'Reactivate Account',
            content: `Reactivate ${record.name}'s account?`,
            okText: 'Reactivate',
            onOk: async () => { await toggleUserActive.mutateAsync(record.id); },
        });
    };

    const handleBan = (record) => {
        Modal.confirm({
            title: 'Ban Account',
            content: `BAN ${record.name}?`,
            okText: 'Ban Account', okType: 'danger',
            onOk: async () => { await banUser.mutateAsync(record.id); },
        });
    };

    const handleUnban = (record) => {
        Modal.confirm({
            title: 'Unban Account',
            content: `Unban ${record.name}'s account?`,
            okText: 'Unban',
            onOk: async () => { await unbanUser.mutateAsync(record.id); },
        });
    };

    const handleForceLogout = (record) => {
        Modal.confirm({
            title: 'Force Logout',
            content: `Force logout ${record.name}?`,
            okText: 'Force Logout',
            onOk: async () => { await forceLogoutUser.mutateAsync(record.id); },
        });
    };

    const openChangePassword = (record) => {
        setSelectedUser(record);
        changePasswordForm.resetFields();
        setChangePasswordOpen(true);
    };

    const handleForceChangePassword = async (values) => {
        try {
            await forceChangePassword.mutateAsync({
                userId: selectedUser.id,
                password: values.password,
                password_confirmation: values.password_confirmation,
            });
            setChangePasswordOpen(false);
            setSelectedUser(null);
            changePasswordForm.resetFields();
        } catch (error) { /* handled */ }
    };

    const activeUserFilterCount = useMemo(() => {
        let count = 0;
        if (searchUser) count++;
        if (filterRole !== 'all') count++;
        if (filterStatus !== 'all') count++;
        return count;
    }, [searchUser, filterRole, filterStatus]);

    const activeAuditFilterCount = useMemo(() => {
        let count = 0;
        if (filterAuditUser !== 'all') count++;
        if (filterAuditModule !== 'all') count++;
        if (filterAuditAction !== 'all') count++;
        if (filterAuditDate) count++;
        return count;
    }, [filterAuditUser, filterAuditModule, filterAuditAction, filterAuditDate]);

    const clearUserFilters = () => { setSearchUser(''); setFilterRole('all'); setFilterStatus('all'); setCurrentPage(1); };
    const clearAuditFilters = () => { setFilterAuditUser('all'); setFilterAuditModule('all'); setFilterAuditAction('all'); setFilterAuditDate(null); };

    const renderPaginationItem = (_, type, originalElement) => {
        if (type === 'prev') return <Button className="settings-pagination-navigation-button" size="small" icon={<LeftOutlined />}>Previous</Button>;
        if (type === 'next') return <Button className="settings-pagination-navigation-button" size="small">Next <RightOutlined /></Button>;
        return originalElement;
    };

    const buildActionMenu = (record) => {
        const items = [];
        items.push({ key: 'view', icon: <EyeOutlined />, label: 'View', onClick: () => openViewUser(record) });
        items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => openEditUser(record) });
        items.push({ type: 'divider' });
        if (record.is_active) {
            items.push({ key: 'deactivate', icon: <StopOutlined />, label: 'Deactivate', onClick: () => handleDeactivate(record) });
        } else {
            items.push({ key: 'reactivate', icon: <CheckCircleOutlined />, label: 'Reactivate', onClick: () => handleReactivate(record) });
        }
        if (record.is_banned) {
            items.push({ key: 'unban', icon: <CheckCircleOutlined />, label: 'Unban Account', onClick: () => handleUnban(record) });
        } else {
            items.push({ key: 'ban', icon: <UserDeleteOutlined />, label: 'Ban Account', danger: true, onClick: () => handleBan(record) });
        }
        items.push({ key: 'force-logout', icon: <LogoutOutlined />, label: 'Force Logout', onClick: () => handleForceLogout(record) });
        if (isSuperAdminUser) {
            items.push({ type: 'divider' });
            items.push({ key: 'change-password', icon: <KeyOutlined />, label: 'Change Password', onClick: () => openChangePassword(record) });
        }
        return items;
    };

    const userColumns = [
        {
            title: 'USER', key: 'employee', width: 260,
            render: (_, r) => (
                <div className="settings-user-cell">
                    <Avatar src={r.profile_photo} style={{ backgroundColor: r.role === 'super-admin' ? '#c41d7f' : '#1a7ab5', width: 40, height: 40 }}>
                        {r.name?.charAt(0) || 'E'}
                    </Avatar>
                    <div>
                        <div className="settings-user-name">
                            {r.name || 'Unknown'}
                            {r.role === 'super-admin' && <CrownOutlined style={{ color: '#c41d7f', marginLeft: 6 }} />}
                            {r.is_banned && <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>BANNED</Tag>}
                        </div>
                        <div className="settings-user-email"><MailOutlined style={{ fontSize: 11 }} /> {r.email || 'N/A'}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>@{r.username}</div>
                    </div>
                </div>
            )
        },
        { title: 'POSITION', dataIndex: 'position', key: 'position', width: 150, render: (t) => t || 'N/A' },
        { title: 'DEPARTMENT', dataIndex: 'department', key: 'department', width: 150, render: (t) => t || 'N/A' },
        { title: 'ROLE', dataIndex: 'role', key: 'role', width: 140,
            render: (role) => (
                <Tag color={
                    role?.toLowerCase() === 'super-admin' ? 'purple' :
                    role?.toLowerCase() === 'admin' ? 'red' :
                    role?.toLowerCase() === 'manager' ? 'gold' : 'blue'
                }>{role?.toUpperCase() || 'STAFF'}</Tag>
            )
        },
        { title: 'STATUS', dataIndex: 'is_active', key: 'status', width: 130, align: 'center',
            render: (status, record) => {
                if (record.is_banned) return <Badge status="error" text="Banned" />;
                return <Badge status={status ? 'success' : 'error'} text={status ? 'Active' : 'Inactive'} />;
            }
        },
        { title: 'LAST LOGIN', dataIndex: 'last_login', key: 'last_login', width: 170,
            render: (v) => v ? dayjs(v).format('MMM DD, YYYY h:mm A') : 'Never' },
        {
            title: 'ACTIONS', key: 'actions', width: 130, fixed: 'right', align: 'center',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openViewUser(record)} /></Tooltip>
                    <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditUser(record)} /></Tooltip>
                    <Dropdown menu={{ items: buildActionMenu(record) }} trigger={['click']} placement="bottomRight">
                        <Button type="text" size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                </Space>
            )
        }
    ];

    const auditColumns = [
        { title: 'DATE & TIME', dataIndex: 'created_at', key: 'date', width: 180, render: (v) => <span>{v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : 'N/A'}</span> },
        { title: 'USER', dataIndex: 'user_name', key: 'user', width: 150, render: (t) => <span><UserOutlined /> {t || 'System'}</span> },
        { title: 'MODULE', dataIndex: 'module', key: 'module', width: 130, render: (m) => <Tag color="cyan">{m || 'General'}</Tag> },
        { title: 'ACTION', dataIndex: 'action', key: 'action', width: 150, render: (t) => <span>{t || 'Unknown Action'}</span> },
        { title: 'DESCRIPTION', dataIndex: 'description', key: 'description', render: (t) => <span>{t || 'No description'}</span> },
        { title: 'IP', dataIndex: 'ip_address', key: 'ip', width: 130, render: (t) => <span>{t || 'N/A'}</span> },
    ];

    const containerClass = `settings-container ${isDarkMode ? 'settings-dark-mode' : ''}`;
    const headerClass = `settings-header ${isDarkMode ? 'settings-header-dark' : ''}`;
    const dateDisplayClass = `settings-date-display ${isDarkMode ? 'settings-date-display-dark' : ''}`;
    const mainCardClass = `settings-main-card ${isDarkMode ? 'settings-main-card-dark' : ''}`;
    const sidebarClass = `settings-sidebar ${isDarkMode ? 'settings-sidebar-dark' : ''}`;
    const contentClass = `settings-content ${isDarkMode ? 'settings-content-dark' : ''}`;
    const tableClass = `settings-table ${isDarkMode ? 'settings-table-dark' : ''}`;

    // ✅ CLEANED SIDEBAR — no Pricing, Employee, Payroll, Inventory
    const sidebarMenuItems = [
        { key: 'users', icon: <UserOutlined />, label: 'User Management', desc: isSuperAdminUser ? 'Manage all system accounts and roles' : 'Manage operational user accounts' },
        { key: 'audit', icon: <HistoryOutlined />, label: 'Audit Logs', desc: isSuperAdminUser ? 'View complete system activity' : 'View operational activity' },

        ...(canManageBookingPolicy ? [{ key: 'booking', icon: <BookOutlined />, label: 'Booking Settings', desc: 'Customer booking rules & policies' }] : []),
        ...(canManageBookingPolicy ? [{ key: 'delivery', icon: <TruckOutlined />, label: 'Delivery Settings', desc: 'Delivery locations & fees' }] : []),
        ...(canManageBookingPolicy ? [{ key: 'staff-settings', icon: <TeamOutlined />, label: 'Staff Management', desc: 'Salary, attendance, leave & payroll rules' }] : []),

        ...(isSuperAdminUser ? [{ key: 'role-permissions', icon: <SafetyCertificateOutlined />, label: 'Role & Permissions', desc: 'Roles, restrictions & access control' }] : []),
        ...(isSuperAdminUser ? [{ key: 'password-security', icon: <SafetyOutlined />, label: 'Password & Security', desc: 'Login, sessions, lockout & security' }] : []),
        ...(isSuperAdminUser ? [{ key: 'user-account', icon: <UserOutlined />, label: 'User Account', desc: 'Customer & admin account policies' }] : []),
        ...(isSuperAdminUser ? [{ key: 'announcements', icon: <NotificationOutlined />, label: 'System Announcements', desc: 'Broadcast messages to users' }] : []),
        ...(isSuperAdminUser ? [{ key: 'maintenance', icon: <SettingOutlined />, label: 'System Maintenance', desc: 'Maintenance mode & health checks' }] : []),
        ...(isSuperAdminUser ? [{ key: 'backup-restore', icon: <DatabaseOutlined />, label: 'Backup & Restore', desc: 'Backup scheduling, history & restore' }] : []),
    ];

    useEffect(() => {
        const requestedTab = new URLSearchParams(location.search).get('tab');
        if (requestedTab && sidebarMenuItems.some((item) => item.key === requestedTab)) {
            setActiveMainTab(requestedTab);
        }
    }, [location.search, isSuperAdminUser, isAdminUser, canManageBookingPolicy]);

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
                    Table: { headerBg: isDarkMode ? '#0a0e1a' : '#f8fafc', headerColor: isDarkMode ? '#cbd5e1' : '#1a2c3e' },
                    Card: { borderRadiusLG: 16 },
                }
            }}
        >
            <div className={containerClass}>
                <div className={headerClass}>
                    <div className="settings-header-left">
                        <Tooltip title="System Settings"><div className="settings-logo-icon"><SettingOutlined /></div></Tooltip>
                        <div className="settings-header-info">
                            <h1>System Settings</h1>
                            <span>{isSuperAdminUser ? 'System-wide configuration and control' : 'Operational account and audit management'}</span>
                        </div>
                    </div>
                    <div className="settings-header-right">
                        <div className={dateDisplayClass}><CalendarOutlined /><span>{formattedDate}</span></div>
                        <Divider type="vertical" style={{ height: 28 }} />
                        <Tooltip title="Refresh all data">
                            <Button icon={<ReloadOutlined />} onClick={() => {
                                refetchUsers(); refetchAudit();
                                if (canManageBookingPolicy) refetchSettings();
                                message.success('Data refreshed');
                            }}>Refresh</Button>
                        </Tooltip>
                        <Tooltip title="Export audit logs">
                            <Button icon={<DownloadOutlined />} onClick={() => exportAuditLogs.mutate({})}>Export</Button>
                        </Tooltip>
                    </div>
                </div>

                <div className="settings-layout">
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

                    <div className={contentClass}>
                        {/* ==================== 1. USER & ROLES ==================== */}
                        {activeMainTab === 'users' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <div className="settings-section-header">
                                        <div>
                                            <div className="settings-section-title"><UserOutlined /> Users & Roles</div>
                                            <div className="settings-section-count">Total: <strong>{totalUsers}</strong> user accounts</div>
                                        </div>
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() => {
                                                setSelectedEmployeeId(null);
                                                setEmployeeSearch('');
                                                createAccountForm.resetFields();
                                                setCreateAccountOpen(true);
                                            }}
                                        >Create Account</Button>
                                    </div>

                                    <div className="settings-search-filter-bar">
                                        <div className="settings-search-wrapper">
                                            <SearchOutlined className="settings-search-icon" />
                                            <Input
                                                placeholder="Search users by name, email, or username..."
                                                value={searchUser}
                                                onChange={(e) => { setSearchUser(e.target.value); setCurrentPage(1); }}
                                                className="settings-search-input"
                                                allowClear
                                            />
                                        </div>
                                        <div className="settings-filter-actions">
                                            <Select value={filterRole} onChange={(v) => { setFilterRole(v); setCurrentPage(1); }} placeholder="All Roles" className="settings-filter-select">
                                                <Option value="all">All Roles</Option>
                                                {roleOptions.map((role) => <Option key={role.slug} value={role.slug}>{role.name}</Option>)}
                                            </Select>
                                            <Select value={filterStatus} onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }} placeholder="All Status" className="settings-filter-select">
                                                <Option value="all">All Status</Option>
                                                <Option value="active">Active</Option>
                                                <Option value="inactive">Inactive</Option>
                                            </Select>
                                            {activeUserFilterCount > 0 && (
                                                <Button type="text" icon={<CloseOutlined />} onClick={clearUserFilters} className="settings-clear-filters">
                                                    Clear ({activeUserFilterCount})
                                                </Button>
                                            )}
                                        </div>
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
                                                        <div className="settings-role-stat-count">{users.filter(u => u.is_active && !u.is_banned).length}</div>
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
                                                    <div className="settings-role-stat-icon departments"><StopOutlined /></div>
                                                    <div>
                                                        <div className="settings-role-stat-count">{users.filter(u => u.is_banned).length}</div>
                                                        <div className="settings-role-stat-label">Banned</div>
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
                                            scroll={{ x: 1200 }}
                                            locale={{
                                                emptyText: (
                                                    <div className="settings-empty-state">
                                                        <TeamOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>No users found</p>
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
                                </div>
                            </Card>
                        )}

                        {/* ==================== 2. AUDIT LOGS ==================== */}
                        {activeMainTab === 'audit' && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <div className="settings-section-header">
                                        <div className="settings-section-title"><HistoryOutlined /> Audit Logs</div>
                                        <Space>
                                            <Button icon={<DownloadOutlined />} onClick={() => exportAuditLogs.mutate({})}>Export Logs</Button>
                                            <Button icon={<ReloadOutlined />} onClick={refetchAudit}>Refresh</Button>
                                        </Space>
                                    </div>

                                    <div className="settings-search-filter-bar">
                                        <div className="settings-search-wrapper">
                                            <SearchOutlined className="settings-search-icon" />
                                            <Input
                                                placeholder="Search audit logs..."
                                                value={searchUser}
                                                onChange={(e) => { setSearchUser(e.target.value); setCurrentPage(1); }}
                                                className="settings-search-input"
                                                allowClear
                                            />
                                        </div>
                                        <div className="settings-filter-actions">
                                            <Select value={filterAuditUser} onChange={setFilterAuditUser} placeholder="All Users" className="settings-filter-select">
                                                <Option value="all">All Users</Option>
                                                {auditUsers.map(u => <Option key={u} value={u}>{u}</Option>)}
                                            </Select>
                                            <Select value={filterAuditModule} onChange={setFilterAuditModule} placeholder="All Modules" className="settings-filter-select">
                                                <Option value="all">All Modules</Option>
                                                {auditModules.map(m => <Option key={m} value={m}>{formatAuditOption(m)}</Option>)}
                                            </Select>
                                            <Select value={filterAuditAction} onChange={setFilterAuditAction} placeholder="All Actions" className="settings-filter-select" showSearch optionFilterProp="children">
                                                <Option value="all">All Actions</Option>
                                                {auditActions.map(a => <Option key={a} value={a}>{formatAuditOption(a)}</Option>)}
                                            </Select>
                                            <DatePicker.RangePicker onChange={(dates) => setFilterAuditDate(dates)} placeholder={['Start Date', 'End Date']} format="YYYY-MM-DD" />
                                            {activeAuditFilterCount > 0 && (
                                                <Button type="text" icon={<CloseOutlined />} onClick={clearAuditFilters} className="settings-clear-filters">
                                                    Clear ({activeAuditFilterCount})
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <Alert
                                        message="Audit logs are generated automatically by system actions."
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
                                </div>
                            </Card>
                        )}

                        {/* ==================== 3. BOOKING SETTINGS ==================== */}
                        {activeMainTab === 'booking' && canManageBookingPolicy && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <div className="settings-section-header">
                                        <div>
                                            <div className="settings-section-title"><BookOutlined /> Booking Settings</div>
                                            <div className="settings-section-count">Control how customers create bookings</div>
                                        </div>
                                        <Button
                                            type="primary"
                                            icon={<SaveOutlined />}
                                            onClick={() => handleSaveSettings('booking', bookingSettings)}
                                            loading={updateSettings.isPending}
                                        >Save Booking Settings</Button>
                                    </div>
                                    <Alert
                                        message="Customer Booking Rules & Policies"
                                        description="These settings control booking behavior, requirements, and restrictions."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 20 }}
                                    />
                                    <SettingsCollapse defaultActiveKey={['1', '2', '3']}>
                                        <SettingsPanel header="👥 Guest Requirements" key="1">
                                            <Row gutter={[24, 16]}>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><TeamOutlined style={{ color: '#1a7ab5' }} /><span>Minimum Number of Pax</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <InputNumber min={1} max={1000} value={bookingSettings.minimum_pax}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, minimum_pax: v })}
                                                                style={{ width: '100%' }} addonAfter="pax" />
                                                        </div>
                                                        <div className="settings-config-hint">Minimum guests required to create a booking</div>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </SettingsPanel>

                                        <SettingsPanel header="📅 Booking Restrictions" key="2">
                                            <Row gutter={[24, 16]}>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><ClockCircleOutlined style={{ color: '#52c41a' }} /><span>Allow Same-Day Booking</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <Switch checked={bookingSettings.allow_same_day_booking}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, allow_same_day_booking: v })}
                                                                checkedChildren="Allowed" unCheckedChildren="Blocked" />
                                                        </div>
                                                        <div className="settings-config-hint">Allow customers to book same-day events</div>
                                                    </div>
                                                </Col>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><CalendarOutlined style={{ color: '#faad14' }} /><span>Allow Holiday Booking</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <Switch checked={bookingSettings.allow_holiday_booking}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, allow_holiday_booking: v })}
                                                                checkedChildren="Allowed" unCheckedChildren="Blocked" />
                                                        </div>
                                                        <div className="settings-config-hint">Allow bookings on holidays</div>
                                                    </div>
                                                </Col>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><CalendarFilled style={{ color: '#722ed1' }} /><span>Allow Weekend Booking</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <Switch checked={bookingSettings.allow_weekend_booking}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, allow_weekend_booking: v })}
                                                                checkedChildren="Allowed" unCheckedChildren="Blocked" />
                                                        </div>
                                                        <div className="settings-config-hint">Allow bookings on weekends</div>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </SettingsPanel>

                                        <SettingsPanel header="💰 Payment & Cancellation Policies" key="3">
                                            <Row gutter={[24, 16]}>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /><span>Cancellation Cutoff</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <InputNumber min={0} max={30} value={bookingSettings.cancellation_cutoff_days}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, cancellation_cutoff_days: v })}
                                                                style={{ width: '100%' }} addonAfter="days before event" />
                                                        </div>
                                                        <div className="settings-config-hint">Days before event when cancellation is no longer allowed</div>
                                                    </div>
                                                </Col>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><ClockCircleOutlined style={{ color: '#faad14' }} /><span>Deposit Payment Deadline</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <InputNumber min={0} max={30} value={bookingSettings.deposit_payment_days}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, deposit_payment_days: v })}
                                                                style={{ width: '100%' }} addonAfter="days after booking" />
                                                        </div>
                                                        <div className="settings-config-hint">Days within which deposit must be paid</div>
                                                    </div>
                                                </Col>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><WalletOutlined style={{ color: '#52c41a' }} /><span>Require Deposit</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <Switch checked={bookingSettings.require_deposit}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, require_deposit: v })}
                                                                checkedChildren="Required" unCheckedChildren="Not Required" />
                                                        </div>
                                                        <div className="settings-config-hint">Whether customers must pay a deposit</div>
                                                    </div>
                                                </Col>
                                            </Row>
                                            <Row gutter={[24, 16]} style={{ marginTop: 16 }}>
                                                <Col xs={24} sm={12} lg={8}>
                                                    <div className="settings-config-card">
                                                        <div className="settings-config-label">
                                                            <Space><WalletOutlined style={{ color: '#52c41a' }} /><span>Deposit Amount</span></Space>
                                                        </div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <InputNumber min={0} step={100} value={bookingSettings.deposit_amount}
                                                                onChange={(v) => setBookingSettings({ ...bookingSettings, deposit_amount: v })}
                                                                style={{ width: '100%' }} prefix="₱"
                                                                disabled={!bookingSettings.require_deposit} />
                                                        </div>
                                                        <div className="settings-config-hint">Fixed deposit amount (₱)</div>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </SettingsPanel>
                                    </SettingsCollapse>
                                    <div className="settings-section-actions" style={{ marginTop: 24 }}>
                                        <Button type="primary" icon={<SaveOutlined />}
                                            onClick={() => handleSaveSettings('booking', bookingSettings)}
                                            loading={updateSettings.isPending} size="large">
                                            Save All Booking Settings
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* ==================== 4. DELIVERY SETTINGS ==================== */}
                        {activeMainTab === 'delivery' && canManageBookingPolicy && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <DeliverySettingsPanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 5. STAFF MANAGEMENT ==================== */}
                        {activeMainTab === 'staff-settings' && canManageBookingPolicy && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <StaffSettingsPanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 6. ROLE & PERMISSIONS ==================== */}
                        {activeMainTab === 'role-permissions' && isSuperAdminUser && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <PermissionsGridPanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 7. PASSWORD & SECURITY ==================== */}
                        {activeMainTab === 'password-security' && isSuperAdminUser && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <PasswordSecurityPanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 8. USER ACCOUNT ==================== */}
                        {activeMainTab === 'user-account' && isSuperAdminUser && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <UserAccountSettingsPanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 9. SYSTEM ANNOUNCEMENTS ==================== */}
                        {activeMainTab === 'announcements' && isSuperAdminUser && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <AnnouncementsPanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 10. SYSTEM MAINTENANCE ==================== */}
                        {activeMainTab === 'maintenance' && isSuperAdminUser && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <SystemMaintenancePanel />
                                </div>
                            </Card>
                        )}

                        {/* ==================== 11. BACKUP & RESTORE ==================== */}
                        {activeMainTab === 'backup-restore' && isSuperAdminUser && (
                            <Card className={mainCardClass} variant="borderless">
                                <div className="settings-scrollable-content">
                                    <BackupConfigPanel />
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* ==================== CREATE ACCOUNT MODAL ==================== */}
            <Modal
                title={<Space><UserOutlined /><span>Create User Account from Employee</span></Space>}
                open={createAccountOpen}
                onCancel={() => {
                    setCreateAccountOpen(false);
                    setSelectedEmployeeId(null);
                    setEmployeeSearch('');
                    createAccountForm.resetFields();
                }}
                onOk={() => createAccountForm.submit()}
                confirmLoading={createUser.isPending}
                okText="Create Account"
                okButtonProps={{ disabled: !selectedEmployeeId }}
                width={720}
                destroyOnHidden
            >
                <Alert
                    message="Select an employee from the Staff Directory"
                    description="Personal details are pulled automatically from the employee record."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>1. Select Employee</Text>
                    <Select
                        showSearch
                        placeholder="Search and select an employee..."
                        value={selectedEmployeeId}
                        onChange={setSelectedEmployeeId}
                        onSearch={setEmployeeSearch}
                        filterOption={false}
                        loading={employeesLoading}
                        style={{ width: '100%' }}
                        optionLabelProp="label"
                    >
                        {(employeesWithoutAccounts || []).map((emp) => (
                            <Option key={emp.employee_id} value={emp.employee_id} label={`${emp.full_name} (${emp.employee_code})`}>
                                <Space>
                                    <Avatar size="small" src={emp.profile_photo} style={{ backgroundColor: '#1a7ab5' }}>
                                        {emp.first_name?.charAt(0)}
                                    </Avatar>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{emp.full_name}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>
                                            {emp.employee_code} · {emp.position || 'No position'}
                                        </div>
                                    </div>
                                </Space>
                            </Option>
                        ))}
                    </Select>
                </div>

                {selectedEmployee && (
                    <Card size="small" style={{ marginBottom: 16, background: isDarkMode ? '#0a0e1a' : '#f8fafc' }}>
                        <Descriptions title={<span><UserOutlined /> Employee Details</span>} column={2} size="small" bordered>
                            <Descriptions.Item label="Employee Code">{selectedEmployee.employee_code}</Descriptions.Item>
                            <Descriptions.Item label="Full Name">{selectedEmployee.full_name}</Descriptions.Item>
                            <Descriptions.Item label="Email">{selectedEmployee.email}</Descriptions.Item>
                            <Descriptions.Item label="Phone">{selectedEmployee.phone || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Position">{selectedEmployee.position || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Department">{selectedEmployee.department || 'N/A'}</Descriptions.Item>
                        </Descriptions>
                    </Card>
                )}

                <Form form={createAccountForm} layout="vertical" onFinish={handleCreateAccount} initialValues={{ is_active: true }} preserve={false} disabled={!selectedEmployeeId}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>2. Account Credentials</Text>

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="username" label="Username" rules={[
                                { required: true, message: 'Enter a username' },
                                { pattern: /^[A-Za-z0-9_-]+$/, message: 'Letters, numbers, underscores, hyphens only' },
                                { min: 4, message: 'At least 4 characters' },
                            ]}>
                                <Input prefix={<UserOutlined />} placeholder="e.g., jdelacruz" autoComplete="off" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="role_slug" label="Assigned Role" rules={[{ required: true, message: 'Select a role' }]}>
                                <Select placeholder="Select role" optionLabelProp="label">
                                    {assignableRoles.map((role) => (
                                        <Option key={role.slug} value={role.slug} label={role.name}>
                                            <Space>
                                                {role.slug === 'super-admin' && <CrownOutlined style={{ color: '#c41d7f' }} />}
                                                {role.slug === 'admin' && <SafetyOutlined style={{ color: '#ff4d4f' }} />}
                                                {role.slug === 'cashier' && <WalletOutlined style={{ color: '#52c41a' }} />}
                                                {role.slug === 'inventory-manager' && <TeamOutlined style={{ color: '#1890ff' }} />}
                                                {role.slug === 'staff-manager' && <TeamOutlined style={{ color: '#722ed1' }} />}
                                                <span>{role.name}</span>
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="password" label="Password" rules={[
                                { required: true, message: 'Enter a password' },
                                { min: 8, message: 'At least 8 characters' },
                            ]}>
                                <Input.Password prefix={<LockIcon />} autoComplete="new-password" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="password_confirmation" label="Confirm Password" dependencies={['password']} rules={[
                                { required: true, message: 'Confirm the password' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                                        return Promise.reject(new Error('Passwords do not match'));
                                    },
                                }),
                            ]}>
                                <Input.Password prefix={<LockIcon />} autoComplete="new-password" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="is_active" label="Account Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* ==================== VIEW USER MODAL ==================== */}
            <Modal
                title={<Space><EyeOutlined /> Account Details</Space>}
                open={viewUserOpen}
                onCancel={() => { setViewUserOpen(false); setSelectedUser(null); }}
                footer={[<Button key="close" onClick={() => { setViewUserOpen(false); setSelectedUser(null); }}>Close</Button>]}
                width={640}
            >
                {selectedUser && (
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Full Name">{selectedUser.name}</Descriptions.Item>
                        <Descriptions.Item label="Username">@{selectedUser.username}</Descriptions.Item>
                        <Descriptions.Item label="Email">{selectedUser.email}</Descriptions.Item>
                        <Descriptions.Item label="Position">{selectedUser.position || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Department">{selectedUser.department || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Employee Code">{selectedUser.employee_code || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Role">
                            <Tag color={selectedUser.role === 'super-admin' ? 'purple' : selectedUser.role === 'admin' ? 'red' : 'blue'}>
                                {selectedUser.role?.toUpperCase()}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Status">
                            {selectedUser.is_banned ? <Tag color="red">BANNED</Tag> :
                                selectedUser.is_active ? <Tag color="green">Active</Tag> :
                                    <Tag color="orange">Inactive</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label="Last Login">
                            {selectedUser.last_login ? dayjs(selectedUser.last_login).format('MMM DD, YYYY h:mm A') : 'Never'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Created">
                            {selectedUser.created_at ? dayjs(selectedUser.created_at).format('MMM DD, YYYY') : 'N/A'}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            {/* ==================== EDIT USER MODAL ==================== */}
            <Modal
                title={<Space><EditOutlined /> Edit Account</Space>}
                open={editUserOpen}
                onCancel={() => { setEditUserOpen(false); setSelectedUser(null); editUserForm.resetFields(); }}
                onOk={() => editUserForm.submit()}
                confirmLoading={updateUser.isPending}
                okText="Save Changes"
                width={520}
                destroyOnHidden
            >
                <Form form={editUserForm} layout="vertical" onFinish={handleUpdateUser} preserve={false}>
                    <Alert
                        message="Personal details come from the employee record."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <Form.Item name="username" label="Username" rules={[
                        { required: true, message: 'Enter a username' },
                        { pattern: /^[A-Za-z0-9_-]+$/, message: 'Letters, numbers, underscores, hyphens only' },
                    ]}>
                        <Input prefix={<UserOutlined />} />
                    </Form.Item>
                    <Form.Item name="role_slug" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
                        <Select placeholder="Select role">
                            {assignableRoles.map((role) => (
                                <Option key={role.slug} value={role.slug}>{role.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="is_active" label="Account Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* ==================== FORCE CHANGE PASSWORD MODAL ==================== */}
            <Modal
                title={<Space><KeyOutlined /> Change Password (Force)</Space>}
                open={changePasswordOpen}
                onCancel={() => { setChangePasswordOpen(false); setSelectedUser(null); changePasswordForm.resetFields(); }}
                onOk={() => changePasswordForm.submit()}
                confirmLoading={forceChangePassword.isPending}
                okText="Change Password"
                okType="danger"
                width={480}
                destroyOnHidden
            >
                <Alert
                    message="Super Admin Override"
                    description={`You are changing the password for ${selectedUser?.name} (@${selectedUser?.username}).`}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
                <Form form={changePasswordForm} layout="vertical" onFinish={handleForceChangePassword} preserve={false}>
                    <Form.Item name="password" label="New Password" rules={[
                        { required: true, message: 'Enter a new password' },
                        { min: 8, message: 'At least 8 characters' },
                    ]}>
                        <Input.Password prefix={<LockIcon />} autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="password_confirmation" label="Confirm New Password" dependencies={['password']} rules={[
                        { required: true, message: 'Confirm the password' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('password') === value) return Promise.resolve();
                                return Promise.reject(new Error('Passwords do not match'));
                            },
                        }),
                    ]}>
                        <Input.Password prefix={<LockIcon />} autoComplete="new-password" />
                    </Form.Item>
                </Form>
            </Modal>
        </ConfigProvider>
    );
};

export default SystemSettings;