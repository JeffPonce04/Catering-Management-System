// src/features/billing/pages/BillingInvoicing.jsx
// COMPLETE ENHANCED VERSION - With Refund Management in Invoice/Inventory

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
    Row,
    Col,
    Descriptions,
    Alert,
    DatePicker,
    Badge,
    Empty,
    Form,
    Dropdown,
    Statistic,
    ConfigProvider,
    theme as antdTheme,
    Radio,
     Image,
    Avatar,
    Progress,
    Checkbox,
    Skeleton,
} from 'antd';
import {
    DollarOutlined,
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
    PrinterOutlined,
    ExportOutlined,
    MailOutlined,
    FilterOutlined,
    DownloadOutlined,
    WarningOutlined,
    FileTextOutlined,
    CreditCardOutlined,
    WalletOutlined,
    CloseCircleOutlined,
    PercentageOutlined,
    BarChartOutlined,
    SendOutlined,
    BankOutlined,
    CalendarOutlined,
    ExclamationCircleOutlined,
    MobileOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    FullscreenOutlined,
    FilePdfOutlined,
    InboxOutlined,
    FileSearchOutlined,
    UnorderedListOutlined,
    FileImageOutlined,
       RollbackOutlined,
    AuditOutlined,
    HistoryOutlined,
    SwapOutlined,
    InfoCircleOutlined,
    EyeInvisibleOutlined,
    LeftOutlined,
    RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { API_ORIGIN } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, hasAllowedRole } from '../../../utils/roleRoutes';
import logo3 from '../../../assets/images/logo3.png';
import '../styles/Billing.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { confirm } = Modal;

// ─────────────────────────────────────────────────────────────
// Module-level flag: true only for the FIRST mount after a hard
// page load (F5 / direct URL). Survives in-app React Router nav
// because the JS module stays in memory. Resets on hard refresh.
// ─────────────────────────────────────────────────────────────
let __biFirstMountAfterPageLoad = true;

// ============================================================
// MEAL ORDER CONFIGURATION
// ============================================================
const MEAL_ORDER = ['Breakfast', 'Morning Snacks', 'Lunch', 'Afternoon Snacks', 'Dinner'];

const getMealOrderIndex = (mealType) => {
    const index = MEAL_ORDER.indexOf(mealType);
    return index === -1 ? 999 : index;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const formatCurrency = (value) => {
    if (!value && value !== 0) return '₱0.00';
    return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
};

const extractDataFromResponse = (response) => {
    const data = response?.data?.data || response?.data || response;
    if (Array.isArray(data)) return data;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
    if (data?.data && typeof data.data === 'object' && data.data.data && Array.isArray(data.data.data)) {
        return data.data.data;
    }
    return [];
};

const extractObjectFromResponse = (response) => response?.data?.data || response?.data || {};

const isSameAmount = (left, right) => Math.abs(Number(left || 0) - Number(right || 0)) < 0.01;

const resolveBackendUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getPaymentId = (payment) => payment?.payment_id
    || payment?.payment_logs?.[0]?.payment_id
    || (typeof payment?.id === 'number' ? payment.id : null);

const getAutomaticPaymentType = (invoice, amount) => {
    const balance = Number(invoice?.balance || 0);
    const paidAmount = Number(invoice?.paid_amount || 0);
    const requiredDeposit = Number(invoice?.required_deposit ?? (Number(invoice?.total_amount || 0) * 0.30));

    if (isSameAmount(amount, balance) || Number(amount || 0) > balance) return 'full';
    if (paidAmount <= 0 && isSameAmount(amount, requiredDeposit)) return 'deposit';
    return 'partial';
};

const confirmAction = ({ title, content, okText = 'Yes', cancelText = 'No' }) => new Promise((resolve) => {
    confirm({
        title,
        content,
        okText,
        cancelText,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
    });
});

const applyReceiptWatermark = (html) => {
    if (!html || html.includes('id="receipt-watermark-styles"')) return html;

    const watermarkStyles = `
        <style id="receipt-watermark-styles">
            html, body { min-height: 100%; }
            body { position: relative; }
            .receipt-watermark {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 0;
                pointer-events: none;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
            }
            .receipt-watermark img {
                width: 280px;
                max-width: 48vw;
                height: auto;
                opacity: 0.07;
                filter: blur(0.6px)
                    drop-shadow(0 2px 3px rgba(15, 23, 42, 0.18))
                    drop-shadow(0 -1px 1px rgba(255, 255, 255, 0.9));
            }
            body > *:not(.receipt-watermark) {
                position: relative;
                z-index: 1;
            }
            @media print {
                .receipt-watermark {
                    position: fixed;
                }
            }
        </style>
    `;

    const watermarkMarkup = `
        <div class="receipt-watermark" aria-hidden="true">
            <img src="${logo3}" alt="" />
        </div>
    `;

    const htmlWithStyles = /<\/head>/i.test(html)
        ? html.replace(/<\/head>/i, `${watermarkStyles}</head>`)
        : `${watermarkStyles}${html}`;

    return /<body[^>]*>/i.test(htmlWithStyles)
        ? htmlWithStyles.replace(/<body([^>]*)>/i, `<body$1>${watermarkMarkup}`)
        : `${watermarkMarkup}${htmlWithStyles}`;
};

const downloadHtmlAsPdf = async (html, filename) => {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;
    return html2pdf()
        .set({
            margin: 8,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(html, 'string')
        .save();
};

// ============================================================
// REFUND STATUS CONFIG
// ============================================================
const getRefundStatusConfig = (status) => {
    const config = {
        pending: {
            color: '#faad14',
            text: 'Pending',
            bg: 'rgba(250, 173, 20, 0.1)',
            icon: <ClockCircleOutlined />,
        },
        approved: {
            color: '#1890ff',
            text: 'Approved',
            bg: 'rgba(24, 144, 255, 0.1)',
            icon: <CheckCircleOutlined />,
        },
        released: {
            color: '#52c41a',
            text: 'Released',
            bg: 'rgba(82, 196, 26, 0.1)',
            icon: <CheckCircleOutlined />,
        },
        rejected: {
            color: '#ff4d4f',
            text: 'Rejected',
            bg: 'rgba(255, 77, 79, 0.1)',
            icon: <CloseCircleOutlined />,
        },
        cancelled: {
            color: '#8c8c8c',
            text: 'Cancelled',
            bg: 'rgba(140, 140, 140, 0.1)',
            icon: <CloseCircleOutlined />,
        },
    };
    return config[status] || config.pending;
};
// ============================================================
// SKELETON LOADING COMPONENTS
// ============================================================
const SkeletonBlock = ({ width = '100%', height = 14, radius = 8, style = {}, className = '' }) => (
    <div
        className={`bi-skeleton-block ${className}`}
        style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
        aria-hidden="true"
    />
);

/* ---------- Reusable: Fake table row ---------- */
const SkeletonTableRow = ({ columns, isDarkMode }) => {
    const borderCol = isDarkMode ? '#1e2340' : '#e8edf2';
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: columns,
                alignItems: 'center',
                gap: 16,
                padding: '14px 16px',
                borderBottom: `1px solid ${borderCol}`,
            }}
        >
            <SkeletonBlock width="80%" height={12} radius={6} />
            <SkeletonBlock width="75%" height={12} radius={6} />
            <div>
                <SkeletonBlock width="70%" height={12} radius={6} style={{ marginBottom: 6 }} />
                <SkeletonBlock width="50%" height={9} radius={6} />
            </div>
            <SkeletonBlock width="60%" height={12} radius={6} />
            <SkeletonBlock width="65%" height={12} radius={6} />
            <SkeletonBlock width="65%" height={12} radius={6} />
            <SkeletonBlock width="65%" height={12} radius={6} />
            <SkeletonBlock width="70%" height={12} radius={6} />
            <SkeletonBlock width={70} height={22} radius={12} style={{ margin: '0 auto' }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <SkeletonBlock width={28} height={28} radius={8} />
                <SkeletonBlock width={28} height={28} radius={8} />
                <SkeletonBlock width={28} height={28} radius={8} />
                <SkeletonBlock width={28} height={28} radius={8} />
            </div>
        </div>
    );
};

/* ---------- Reusable: Fake table (header + rows) ---------- */
const SkeletonTable = ({ columnTemplate, rowCount = 8, isDarkMode }) => {
    const cardBg = isDarkMode ? '#13172b' : '#ffffff';
    const pageBg = isDarkMode ? '#0a0e1a' : '#f8fafc';
    const borderCol = isDarkMode ? '#1e2340' : '#e8edf2';

    return (
        <div
            style={{
                background: cardBg,
                border: `1px solid ${borderCol}`,
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
            }}
        >
                     {/* Header row */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: columnTemplate,
                    gap: 16,
                    padding: '14px 16px',
                    background: pageBg,
                    borderBottom: `1px solid ${borderCol}`,
                }}
            >
                {Array.from({ length: columnTemplate.split(' ').length }).map((_, i) => (
                    <SkeletonBlock key={i} width="70%" height={10} radius={4} />
                ))}
            </div>

            {/* Rows */}
            <div style={{ overflow: 'hidden' }}>
                {Array.from({ length: rowCount }).map((_, i) => (
                    <SkeletonTableRow key={i} columns={columnTemplate} isDarkMode={isDarkMode} />
                ))}
            </div>
        </div>
    );
};

/* ---------- Main skeleton that mirrors the billing page ---------- */
const BillingSkeleton = ({ isDarkMode, activeTab = 'invoices' }) => {
    const cardBg = isDarkMode ? '#13172b' : '#ffffff';
    const borderCol = isDarkMode ? '#1e2340' : '#e8edf2';
    const pageBg = isDarkMode ? '#0a0e1a' : '#f8fafc';

    const cardStyle = {
        background: cardBg,
        border: `1px solid ${borderCol}`,
        borderRadius: 12,
    };

    // Column templates match the real tables (invoices / payments / debts / refunds)
    const columnTemplates = {
        invoices: '1.2fr 1.4fr 2fr 1.4fr 1.3fr 1.3fr 1.3fr 1.2fr 1.1fr 2.6fr',
        payments: '1.5fr 2fr 1.3fr 1.2fr 1fr 1.3fr 1.5fr 1.2fr 1.1fr 1.6fr',
        debts:    '2fr 1.3fr 1.4fr 1.4fr 1.4fr 1.7fr 1.2fr 1.3fr 1.2fr 1.1fr 1.1fr 1.5fr 1.5fr',
        refunds:  '1.5fr 1.8fr 2fr 1.3fr 1.4fr 1.3fr 1.5fr 1.8fr 2.4fr',
        history:  '1.5fr 2fr 1.3fr 1.2fr 1fr 1.3fr 1.5fr 1.2fr 1.1fr 1.6fr',
        mobile:   '2fr 1.3fr 1.3fr 1.2fr 1.5fr 1.5fr 1.2fr 1.1fr 2fr',
        pdf:      '1.5fr 2fr 1.3fr 1.3fr 1.4fr 1.2fr 1.2fr',
    };

    const columnTemplate = columnTemplates[activeTab] || columnTemplates.invoices;

    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}
        >
            <div
                className={`bi-billing-container ${isDarkMode ? 'bi-dark-mode' : ''}`}
                style={{ background: pageBg }}
            >
                {/* ===== HEADER (matches real header) ===== */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 32px',
                    background: cardBg,
                    borderBottom: `1px solid ${borderCol}`,
                    minHeight: 72,
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <SkeletonBlock width={40} height={40} radius={12} />
                        <div>
                            <SkeletonBlock width={180} height={14} radius={6} style={{ marginBottom: 6 }} />
                            <SkeletonBlock width={140} height={9} radius={6} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SkeletonBlock width={180} height={32} radius={10} />
                        <SkeletonBlock width={90} height={36} radius={10} />
                        <SkeletonBlock width={90} height={36} radius={10} />
                        <SkeletonBlock width={80} height={36} radius={10} />
                    </div>
                </div>

                {/* ===== KPI CARDS (5 across, matching canProcessRefunds layout) ===== */}
                <div className="bi-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20, padding: '20px 32px 4px', marginBottom: 20 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bi-kpi-card" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 24px', minHeight: 88 }}>
                            <SkeletonBlock width={44} height={44} radius={12} />
                            <div style={{ flex: 1 }}>
                                <SkeletonBlock width="80%" height={18} radius={6} style={{ marginBottom: 8 }} />
                                <SkeletonBlock width="60%" height={10} radius={6} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* ===== MAIN CARD with TABS + FILTERS + TABLE ===== */}
                <div className="bi-main-card" style={{ ...cardStyle, margin: '0 32px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                    {/* Tab bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 24,
                        padding: '14px 24px',
                        borderBottom: `1px solid ${borderCol}`,
                        flexShrink: 0,
                    }}>
                        {['Invoices', 'Payment Tracking', 'Payment History', 'Mobile Payments', 'Debt Management', 'Refunds', 'PDF Overview'].map((_, i) => (
                            <SkeletonBlock key={i} width={90 + (i % 2) * 30} height={12} radius={6} />
                        ))}
                    </div>

                    {/* Filters bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        background: pageBg,
                        borderBottom: `1px solid ${borderCol}`,
                        flexShrink: 0,
                    }}>
                        <SkeletonBlock width={140} height={36} radius={10} />
                        <SkeletonBlock width={220} height={36} radius={10} />
                        <SkeletonBlock width={280} height={36} radius={10} />
                        <div style={{ flex: 1 }} />
                        <SkeletonBlock width={140} height={36} radius={10} />
                    </div>

                    {/* Table skeleton */}
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <SkeletonTable
                            columnTemplate={columnTemplate}
                            rowCount={8}
                            isDarkMode={isDarkMode}
                        />
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
};

/* ---------- Modal skeleton (for invoice/payment/refund detail loading) ---------- */
const ModalSkeleton = ({ isDarkMode, variant = 'invoice' }) => {
    const cardBg = isDarkMode ? '#13172b' : '#ffffff';
    const borderCol = isDarkMode ? '#1e2340' : '#e8edf2';
    const pageBg = isDarkMode ? '#0a0e1a' : '#f8fafc';

    return (
        <div style={{ background: cardBg }}>
            {/* Modal header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 24px',
                borderBottom: `1px solid ${borderCol}`,
            }}>
                <SkeletonBlock width={36} height={36} radius={10} />
                <div style={{ flex: 1 }}>
                    <SkeletonBlock width={180} height={14} radius={6} style={{ marginBottom: 6 }} />
                    <SkeletonBlock width={220} height={10} radius={6} />
                </div>
                <SkeletonBlock width={140} height={26} radius={20} />
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px', background: cardBg }}>
                {/* 4-up summary cards (invoice / refund variants) */}
                {(variant === 'invoice' || variant === 'refund') && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: `1px solid ${borderCol}`, borderRadius: 12 }}>
                                <SkeletonBlock width={40} height={40} radius={10} />
                                <div style={{ flex: 1 }}>
                                    <SkeletonBlock width="60%" height={10} radius={6} style={{ marginBottom: 6 }} />
                                    <SkeletonBlock width="80%" height={16} radius={6} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Payment modal summary block */}
                {variant === 'payment' && (
                    <div style={{ padding: '16px 20px', background: pageBg, border: `1px solid ${borderCol}`, borderRadius: 12, marginBottom: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i}>
                                    <SkeletonBlock width="60%" height={10} radius={6} style={{ marginBottom: 8 }} />
                                    <SkeletonBlock width="80%" height={15} radius={6} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Section: header + 2-col info grid */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, marginBottom: 12, borderBottom: `2px solid ${borderCol}` }}>
                        <SkeletonBlock width={16} height={16} radius={4} />
                        <SkeletonBlock width={180} height={12} radius={6} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${borderCol}` }}>
                                <SkeletonBlock width="35%" height={12} radius={6} />
                                <SkeletonBlock width="45%" height={12} radius={6} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section: mini table (items / payments list) */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, marginBottom: 12, borderBottom: `2px solid ${borderCol}` }}>
                        <SkeletonBlock width={16} height={16} radius={4} />
                        <SkeletonBlock width={150} height={12} radius={6} />
                    </div>
                    <div style={{ border: `1px solid ${borderCol}`, borderRadius: 10, overflow: 'hidden' }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                    gap: 12,
                                    padding: '12px 14px',
                                    borderBottom: i < 3 ? `1px solid ${borderCol}` : 'none',
                                }}
                            >
                                <SkeletonBlock width="80%" height={12} radius={6} />
                                <SkeletonBlock width="60%" height={12} radius={6} />
                                <SkeletonBlock width="60%" height={12} radius={6} />
                                <SkeletonBlock width="60%" height={12} radius={6} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal footer */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '14px 24px',
                borderTop: `1px solid ${borderCol}`,
            }}>
                <SkeletonBlock width={100} height={38} radius={10} />
                <SkeletonBlock width={140} height={38} radius={10} />
            </div>
        </div>
    );
};
// ============================================================
// MAIN COMPONENT
// ============================================================
const BillingInvoicing = () => {
    const location = useLocation();
       const { user, businessSettings: sharedBusinessSettings } = useAuth();
    const canApproveFinancialAdjustments = hasAllowedRole(user, ADMIN_ROLES);
    const canProcessRefunds = hasAllowedRole(user, ADMIN_ROLES);
    const isCashier = hasAllowedRole(user, ['cashier', 'finance', 'finance-staff', 'finance_staff']);

    // ==================== STATE MANAGEMENT ====================
    const [invoices, setInvoices] = useState([]);
    const [allInvoices, setAllInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [mobilePayments, setMobilePayments] = useState([]);
    const [debts, setDebts] = useState([]);
    const [confirmedBookings, setConfirmedBookings] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState(null);
    const [paymentTrackingDateRange, setPaymentTrackingDateRange] = useState([]);
    const [paymentHistorySearch, setPaymentHistorySearch] = useState('');
    const [paymentHistoryCustomer, setPaymentHistoryCustomer] = useState('');
    const [paymentHistoryInvoice, setPaymentHistoryInvoice] = useState('');
    const [paymentHistoryMethod, setPaymentHistoryMethod] = useState('all');
    const [paymentHistoryDateRange, setPaymentHistoryDateRange] = useState([]);
    const [activeMainTab, setActiveMainTab] = useState('invoices');

    // ⭐ Billing KPI visibility (Hide/Unhide) — mirrors financial-visibility.
    const BILLING_VISIBILITY_KEY = 'bi_billing_visibility';
    const BILLING_VISIBILITY_CHANNEL = 'bi_billing_visibility_channel';

    const readCachedBillingVisibility = () => {
        try {
            const raw = localStorage.getItem(BILLING_VISIBILITY_KEY);
            if (!raw) return { total_revenue: false, total_collected: false, outstanding_balance: false, total_refunds: false };
            const p = JSON.parse(raw) || {};
            return {
                total_revenue: Boolean(p.total_revenue),
                total_collected: Boolean(p.total_collected),
                outstanding_balance: Boolean(p.outstanding_balance),
                total_refunds: Boolean(p.total_refunds),
            };
        } catch {
            return { total_revenue: false, total_collected: false, outstanding_balance: false, total_refunds: false };
        }
    };

    const [billingVisibility, setBillingVisibility] = useState(readCachedBillingVisibility);
    const effectiveBillingVisibility = billingVisibility;

    // ⭐ Period Behavior — Weekly / Monthly / Yearly + anchor
    const [dashboardPeriod, setDashboardPeriod] = useState(
        () => sessionStorage.getItem('bi_dashboardPeriod') || 'monthly'
    );
    const [dashboardAnchor, setDashboardAnchor] = useState(
        () => sessionStorage.getItem('bi_dashboardAnchor') || dayjs().format('YYYY-MM-DD')
    );
    const [periodToolbarHidden, setPeriodToolbarHidden] = useState(
        () => sessionStorage.getItem('bi_periodToolbarHidden') === 'true'
    );

    useEffect(() => {
        sessionStorage.setItem('bi_dashboardPeriod', dashboardPeriod);
    }, [dashboardPeriod]);

    useEffect(() => {
        sessionStorage.setItem('bi_dashboardAnchor', dashboardAnchor);
    }, [dashboardAnchor]);

    useEffect(() => {
        sessionStorage.setItem('bi_periodToolbarHidden', String(periodToolbarHidden));
    }, [periodToolbarHidden]);

    // Refund state
    const [refunds, setRefunds] = useState([]);
    const [refundStatistics, setRefundStatistics] = useState({
        total_refunds: 0,
        pending: 0,
        approved: 0,
        released: 0,
        rejected: 0,
        total_released_amount: 0,
        total_pending_amount: 0,
    });
    const [pendingRefunds, setPendingRefunds] = useState([]);
    const [approvedRefunds, setApprovedRefunds] = useState([]);
    const [refundHistorySearch, setRefundHistorySearch] = useState('');
    const [refundHistoryStatus, setRefundHistoryStatus] = useState('all');
    const [refundHistoryDateRange, setRefundHistoryDateRange] = useState([]);

    useEffect(() => {
        const requestedView = new URLSearchParams(location.search).get('view');
        const viewMap = { receipts: 'payment_history' };
        const resolvedView = viewMap[requestedView] || requestedView;
        if (['invoices', 'payments', 'payment_history', 'mobile', 'debts', 'pdf_overview', 'refunds'].includes(resolvedView)) {
            // Cashiers must never land on the refunds tab
            if (resolvedView === 'refunds' && !canProcessRefunds) {
                setActiveMainTab('invoices');
                return;
            }
            setActiveMainTab(resolvedView);
        }
    }, [location.search, canProcessRefunds]);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });

    // Modal states
    const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
    const [invoiceDetailsModalVisible, setInvoiceDetailsModalVisible] = useState(false);
    const [invoiceDetailsLoading, setInvoiceDetailsLoading] = useState(false);    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [reminderModalVisible, setReminderModalVisible] = useState(false);
    const [discountModalVisible, setDiscountModalVisible] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [receiptModalVisible, setReceiptModalVisible] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [rejectPaymentModalVisible, setRejectPaymentModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [createInvoiceBookingId, setCreateInvoiceBookingId] = useState(null);

    // Refund modal states
    const [refundModalVisible, setRefundModalVisible] = useState(false);
    const [refundApprovalModalVisible, setRefundApprovalModalVisible] = useState(false);
    const [refundReleaseModalVisible, setRefundReleaseModalVisible] = useState(false);
    const [refundRejectModalVisible, setRefundRejectModalVisible] = useState(false);
    const [refundDetailsModalVisible, setRefundDetailsModalVisible] = useState(false);
    const [refundDirectModalVisible, setRefundDirectModalVisible] = useState(false);
    const [selectedRefund, setSelectedRefund] = useState(null);
    const [refundForm] = Form.useForm();
    const [refundApprovalForm] = Form.useForm();
    const [refundReleaseForm] = Form.useForm();
    const [refundRejectForm] = Form.useForm();
    const [refundDirectForm] = Form.useForm();

    // Receipt Preview Modal
    const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
    const [receiptPreviewHtml, setReceiptPreviewHtml] = useState('');
    const [receiptPreviewZoom, setReceiptPreviewZoom] = useState(100);

    // PDF Viewer Modal
    const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
    const [pdfViewerHtml, setPdfViewerHtml] = useState('');
    const [pdfViewerBooking, setPdfViewerBooking] = useState(null);
    const [pdfViewerZoom, setPdfViewerZoom] = useState(100);

    // PDF Overview Tab
    const [pdfOverviewSearch, setPdfOverviewSearch] = useState('');
    const [pdfOverviewBooking, setPdfOverviewBooking] = useState(null);
    const [pdfOverviewHtml, setPdfOverviewHtml] = useState('');
    const [pdfOverviewZoom, setPdfOverviewZoom] = useState(100);
    const [pdfOverviewLoading, setPdfOverviewLoading] = useState(false);
    const [pdfOverviewAllBookings, setPdfOverviewAllBookings] = useState([]);

    // Forms
    const [invoiceForm] = Form.useForm();
    const [paymentForm] = Form.useForm();
    const [reminderForm] = Form.useForm();
    const [discountForm] = Form.useForm();
    const enteredPaymentAmount = Form.useWatch('amount', paymentForm);
    const automaticPaymentType = useMemo(
        () => getAutomaticPaymentType(selectedInvoice, enteredPaymentAmount),
        [selectedInvoice, enteredPaymentAmount]
    );

    const isMounted = useRef(true);
    const paymentSubmitLock = useRef(false);
    const queryClient = useQueryClient();
    // Show the skeleton ONLY on the first mount after a hard page load
    // AND when there's no cached data yet. Combined with `staleTime: Infinity`,
    // this means back-navigation renders instantly from cache.
     const [showSkeleton, setShowSkeleton] = useState(() => {
        const shouldShow = __biFirstMountAfterPageLoad;
        __biFirstMountAfterPageLoad = false;
        return shouldShow;
    });

    // ── Load billing visibility from the server ──────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/settings/billing-visibility');
                const payload = res?.data?.data?.data || res?.data?.data || res?.data || {};
                if (cancelled) return;
                const resolved = {
                    total_revenue: Boolean(payload?.total_revenue),
                    total_collected: Boolean(payload?.total_collected),
                    outstanding_balance: Boolean(payload?.outstanding_balance),
                    total_refunds: Boolean(payload?.total_refunds),
                };
                setBillingVisibility(resolved);
                try { localStorage.setItem(BILLING_VISIBILITY_KEY, JSON.stringify(resolved)); } catch {}
            } catch {}
        })();
        return () => { cancelled = true; };
    }, []);

    // ── Cross-tab instant sync ───────────────────────────────────
    useEffect(() => {
        let channel;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                channel = new BroadcastChannel(BILLING_VISIBILITY_CHANNEL);
                channel.onmessage = (event) => {
                    const next = event?.data?.payload;
                    if (!next) return;
                    setBillingVisibility({
                        total_revenue: Boolean(next.total_revenue),
                        total_collected: Boolean(next.total_collected),
                        outstanding_balance: Boolean(next.outstanding_balance),
                        total_refunds: Boolean(next.total_refunds),
                    });
                };
            }
        } catch {}
        const handleStorage = (event) => {
            if (event.key !== BILLING_VISIBILITY_KEY) return;
            try {
                const next = JSON.parse(event.newValue || '{}');
                setBillingVisibility({
                    total_revenue: Boolean(next.total_revenue),
                    total_collected: Boolean(next.total_collected),
                    outstanding_balance: Boolean(next.outstanding_balance),
                    total_refunds: Boolean(next.total_refunds),
                });
            } catch {}
        };
        window.addEventListener('storage', handleStorage);
        return () => {
            if (channel) channel.close();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // ── Poll every 10s so other devices see the toggle ───────────
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await api.get('/settings/billing-visibility');
                const payload = res?.data?.data?.data || res?.data?.data || res?.data || {};
                const resolved = {
                    total_revenue: Boolean(payload?.total_revenue),
                    total_collected: Boolean(payload?.total_collected),
                    outstanding_balance: Boolean(payload?.outstanding_balance),
                    total_refunds: Boolean(payload?.total_refunds),
                };
                setBillingVisibility((prev) => {
                    const changed = prev.total_revenue !== resolved.total_revenue
                        || prev.total_collected !== resolved.total_collected
                        || prev.outstanding_balance !== resolved.outstanding_balance
                        || prev.total_refunds !== resolved.total_refunds;
                    if (changed) {
                        try { localStorage.setItem(BILLING_VISIBILITY_KEY, JSON.stringify(resolved)); } catch {}
                    }
                    return changed ? resolved : prev;
                });
            } catch {}
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleToggleBillingVisibility = useCallback(async (key) => {
        if (!canProcessRefunds) {
            message.warning('Only administrators can hide or unhide billing values.');
            return;
        }
        const current = billingVisibility;
        const next = { ...current, [key]: !current[key] };
        setBillingVisibility(next);
        try { localStorage.setItem(BILLING_VISIBILITY_KEY, JSON.stringify(next)); } catch {}
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const ch = new BroadcastChannel(BILLING_VISIBILITY_CHANNEL);
                ch.postMessage({ payload: next });
                ch.close();
            }
        } catch {}
        try {
            await api.put('/settings/billing-visibility', next);
        } catch (e) {
            setBillingVisibility(current);
            try { localStorage.setItem(BILLING_VISIBILITY_KEY, JSON.stringify(current)); } catch {}
            message.error(e?.response?.data?.message || 'Failed to save visibility.');
        }
    }, [billingVisibility, canProcessRefunds]);

    const maskMatchingValue = (visibleValue) => {
        const str = String(visibleValue ?? '');
        if (!str) return '**********';
        const hasCurrency = str.startsWith('₱');
        const digits = str.replace(/[^\d.,]/g, '').length;
        return (hasCurrency ? '₱' : '') + '*'.repeat(Math.max(3, digits));
    };

    // ⭐ Period helpers
    const periodRange = useMemo(() => {
        const anchor = dayjs(dashboardAnchor);
        switch (dashboardPeriod) {
            case 'weekly': {
                const start = anchor.startOf('isoWeek');
                const end   = anchor.endOf('isoWeek');
                return { start, end, label: `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`, navUnit: 'week' };
            }
            case 'yearly': {
                const start = anchor.startOf('year');
                const end   = anchor.endOf('year');
                return { start, end, label: start.format('YYYY'), navUnit: 'year' };
            }
            case 'monthly':
            default: {
                const start = anchor.startOf('month');
                const end   = anchor.endOf('month');
                return { start, end, label: start.format('MMMM YYYY'), navUnit: 'month' };
            }
        }
    }, [dashboardPeriod, dashboardAnchor]);

    const handleShiftPeriod = useCallback((direction) => {
        const unit = periodRange.navUnit;
        const next = direction === 'next'
            ? dayjs(dashboardAnchor).add(1, unit)
            : dayjs(dashboardAnchor).subtract(1, unit);
        setDashboardAnchor(next.format('YYYY-MM-DD'));
    }, [dashboardAnchor, periodRange.navUnit]);

    const handleJumpToToday = useCallback(() => {
        setDashboardAnchor(dayjs().format('YYYY-MM-DD'));
    }, []);

    const handleTogglePeriodToolbar = useCallback(() => {
        setPeriodToolbarHidden((prev) => {
            const next = !prev;
            message.success(next ? 'Period selector hidden' : 'Period selector shown');
            return next;
        });
    }, []);

    useEffect(() => {
        if (paymentModalVisible) {
            paymentForm.setFieldValue('payment_type', automaticPaymentType);
        }
    }, [automaticPaymentType, paymentForm, paymentModalVisible]);

    // ==================== THEME DETECTION ====================
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
    // ==================== LOAD DATA FROM BACKEND (REACT QUERY) ====================
    // Billing queries share the same cache philosophy as Booking / Orders / Menu:
    //   • data stays fresh for the whole session
    //   • back-navigation resolves instantly from cache
    //   • only mutations invalidate
    const BILLING_QUERY_OPTIONS = {
        staleTime: Infinity,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,  
        refetchInterval: false,
        placeholderData: (prev) => prev,
        retry: 1,
    };

    const paymentDateParams = useMemo(() => ({
        date_from: paymentTrackingDateRange?.[0]
            ? paymentTrackingDateRange[0].format('YYYY-MM-DD HH:mm:ss')
            : undefined,
        date_to: paymentTrackingDateRange?.[1]
            ? paymentTrackingDateRange[1].format('YYYY-MM-DD HH:mm:ss')
            : undefined,
    }), [paymentTrackingDateRange]);

        const invoicePeriodParams = useMemo(() => ({
        period: dashboardPeriod,
        anchor: dashboardAnchor,
    }), [dashboardPeriod, dashboardAnchor]);

      const invoicesQuery = useQuery({
        queryKey: ['billing', 'invoices', invoicePeriodParams],
        queryFn: async () => extractDataFromResponse(await api.get('/invoices', {
            params: { per_page: 100, ...invoicePeriodParams },
        })),
        ...BILLING_QUERY_OPTIONS,
        // ⭐ REQUEST — A new invoice auto-created by an Order & Events
        //    payment shows up within 20s.
        refetchInterval: 20 * 1000,
        refetchIntervalInBackground: false,
    });
     // Only fire these queries when the user is actually on the tab that
    // needs them. This shrinks the cold-start waterfall from 7 requests
    // to 3 (invoices + confirmed-bookings + settings).

      const paymentTrackingQuery = useQuery({
        queryKey: ['billing', 'payments', 'tracking', paymentDateParams],
        queryFn: async () => extractDataFromResponse(await api.get('/payments/tracking', {
            params: { per_page: 100, ...paymentDateParams },
        })),
        ...BILLING_QUERY_OPTIONS,
        // ⭐ REQUEST — Poll the tracking endpoint every 15s while the tab
        //    is open. A payment recorded on Order & Events (or another
        //    browser) appears without a manual refresh.
        refetchInterval: 15 * 1000,
        refetchIntervalInBackground: false,
              // ⭐ REQUEST — Keep this query enabled on every tab so cross-module
        //    payments show up without waiting for the user to switch tabs.
        enabled: true,
    });

    const paymentHistoryQuery = useQuery({
        queryKey: ['billing', 'payments', 'history'],
        queryFn: async () => extractDataFromResponse(await api.get('/payments/history', { params: { per_page: 100 } })),
        ...BILLING_QUERY_OPTIONS,
        enabled: activeMainTab === 'payment_history',
    });

    const mobilePaymentsQuery = useQuery({
        queryKey: ['billing', 'payments', 'mobile'],
        queryFn: async () => extractDataFromResponse(await api.get('/payments/mobile', { params: { per_page: 100 } })),
        ...BILLING_QUERY_OPTIONS,
        enabled: activeMainTab === 'mobile',
    });

    const debtsQuery = useQuery({
        queryKey: ['billing', 'debts'],
        queryFn: async () => extractDataFromResponse(await api.get('/debts', { params: { per_page: 100 } })),
        ...BILLING_QUERY_OPTIONS,
        enabled: activeMainTab === 'debts',
    });
       const confirmedBookingsQuery = useQuery({
        // ⭐ v2 key so the older empty cache is not served
        queryKey: ['billing', 'confirmed-bookings', 'v2'],
        queryFn: async () => extractDataFromResponse(await api.get('/invoices/confirmed-bookings', {
            params: { per_page: 200 },
        })),
        ...BILLING_QUERY_OPTIONS,
    });

    // `pdf-bookings` is only needed on the PDF Overview tab.
    // Gate it on that tab so we don't pull 1000 rows on every visit.
      const pdfBookingsQuery = useQuery({
        queryKey: ['billing', 'pdf-bookings'],
        queryFn: async () => extractDataFromResponse(await api.get('/bookings', { params: { per_page: 100 } })),
        ...BILLING_QUERY_OPTIONS,
        enabled: activeMainTab === 'pdf_overview',
    });
    // `/settings/business` requires admin permission. Cashiers and finance
    // staff get a 403. Gate it on `canApproveFinancialAdjustments` and let
    // the PDF generator fall back to hardcoded defaults when it's missing.
    // Business settings are owned by AuthProvider — this component only
    // subscribes to the shared `['settings', 'business']` cache slot.
    // `enabled: false` means this hook never fires its own request; it
    // just re-renders when AuthProvider populates or refreshes the cache.
    const settingsQuery = useQuery({
        queryKey: ['settings', 'business'],
        queryFn: async () => ({}),
        staleTime: Infinity,
        gcTime: 24 * 60 * 60 * 1000,
        enabled: false,
    });
    // ==================== REFUND QUERIES (ADMIN ONLY) ====================
    // ⚠️ Enabled ONLY for admin / super-admin. Cashiers must never fire these
    //    calls — the backend blocks them at RoleAccessMiddleware anyway, but
    //    avoiding the request prevents 403 noise in the console.
    const refundsQuery = useQuery({
        queryKey: ['billing', 'refunds', invoicePeriodParams],
        queryFn: async () => extractDataFromResponse(await api.get('/refunds', {
            params: { per_page: 1000, ...invoicePeriodParams },
        })),
        ...BILLING_QUERY_OPTIONS,
        enabled: canProcessRefunds && activeMainTab === 'refunds',
    });
     const refundStatisticsQuery = useQuery({
        queryKey: ['billing', 'refunds', 'statistics'],
        queryFn: async () => extractObjectFromResponse(await api.get('/refunds/statistics')),
        ...BILLING_QUERY_OPTIONS,
        enabled: canProcessRefunds && activeMainTab === 'refunds',
    });


    const pendingRefundsQuery = useQuery({
        queryKey: ['billing', 'refunds', 'pending'],
        queryFn: async () => extractDataFromResponse(await api.get('/refunds/pending')),
        ...BILLING_QUERY_OPTIONS,
        enabled: canProcessRefunds && activeMainTab === 'refunds',
    });

    const approvedRefundsQuery = useQuery({
        queryKey: ['billing', 'refunds', 'approved'],
        queryFn: async () => extractDataFromResponse(await api.get('/refunds/approved')),
        ...BILLING_QUERY_OPTIONS,
        enabled: canProcessRefunds && activeMainTab === 'refunds',
    });

      const businessSettings = useMemo(() => {
        const fromAuth = sharedBusinessSettings || {};
        const fromQuery = settingsQuery.data || {};
        const resolved = fromQuery.business || fromQuery.company || fromQuery.general || fromQuery || {};
        return {
            ...fromAuth,
            ...resolved,
        };
    }, [sharedBusinessSettings, settingsQuery.data]);
    // Only the queries that are actually enabled should gate the skeleton.
    // `isPending` is `true` for disabled queries — we must check `isEnabled`
    // (v5) / `fetchStatus !== 'idle'` before consulting `isPending`.
    const querySettled = (q) => !q.isEnabled || !q.isPending;

    const primaryQueriesSettled =
        querySettled(invoicesQuery) &&
        querySettled(paymentTrackingQuery) &&
        querySettled(paymentHistoryQuery) &&
        querySettled(mobilePaymentsQuery) &&
        querySettled(debtsQuery) &&
        querySettled(confirmedBookingsQuery) &&
        querySettled(pdfBookingsQuery) &&
        querySettled(settingsQuery) &&
        querySettled(refundsQuery);

    // Hide the skeleton as soon as the initial load settles on the first mount.
    // On back-navigation, `showSkeleton` is already `false`, so we skip it entirely.
    useEffect(() => {
        if (showSkeleton && primaryQueriesSettled) {
            setShowSkeleton(false);
        }
    }, [primaryQueriesSettled, showSkeleton]);

    useEffect(() => {
        const invoiceData = invoicesQuery.data || [];
        setAllInvoices(invoiceData);
        setInvoices(invoiceData
            .map(inv => ({
                ...inv,
                balance: Math.max(0, Number(inv.balance ?? (Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)))),
            }))
            .filter(inv => inv.balance > 0 && String(inv.status || '').toLowerCase() !== 'paid'));
    }, [invoicesQuery.data]);

    useEffect(() => {
        const trackingData = paymentTrackingQuery.data || [];
        setPayments(trackingData.map(payment => ({
            ...payment,
            payment_number: payment.payment_number || payment.id || 'N/A',
            customer_name: payment.customer_name || 'Unknown',
            invoice_number: payment.invoice_number || 'N/A',
            payment_method: payment.payment_method || 'N/A',
            payment_type: payment.payment_type || 'partial',
            amount: Number(payment.amount || 0),
            reference_number: payment.reference_number || 'N/A',
            date: payment.date || payment.payment_date || payment.created_at,
            date_time: payment.date_time || payment.payment_date || payment.created_at,
            status: payment.status || 'pending',
        })));
    }, [paymentTrackingQuery.data]);

    useEffect(() => {
        const historyData = paymentHistoryQuery.data || [];
        setPaymentHistory(historyData.filter(invoice =>
            Number(invoice.balance || 0) === 0 && String(invoice.status || '').toLowerCase() === 'paid'
        ));
    }, [paymentHistoryQuery.data]);

    useEffect(() => {
        setMobilePayments(mobilePaymentsQuery.data || []);
    }, [mobilePaymentsQuery.data]);

    useEffect(() => {
        const debtData = debtsQuery.data || [];
        setDebts(debtData.map(debt => {
            const dueDate = dayjs(debt.due_date);
            const daysOverdue = dueDate.isValid() && dueDate.isBefore(dayjs()) ? dayjs().diff(dueDate, 'day') : 0;
            return {
                ...debt,
                days_overdue: debt.days_overdue ?? daysOverdue,
                total_paid: Number(debt.total_paid ?? debt.paid_debt ?? 0),
                remaining_debt: Number(debt.remaining_balance ?? debt.remaining_debt ?? ((debt.total_debt || 0) - (debt.paid_debt || 0))),
                total_amount: Number(debt.total_amount ?? debt.total_debt ?? 0),
                paid_amount: Number(debt.paid_amount ?? debt.total_paid ?? debt.paid_debt ?? 0),
                balance: Number(debt.balance ?? debt.remaining_balance ?? debt.remaining_debt ?? 0),
                required_deposit: Number(debt.required_deposit ?? (Number(debt.total_amount ?? debt.total_debt ?? 0) * 0.30)),
                payment_progress: Number(debt.payment_progress ?? 0),
                next_payment: debt.next_payment || debt.due_date || null,
            };
        }));
    }, [debtsQuery.data]);

    useEffect(() => {
        setConfirmedBookings(confirmedBookingsQuery.data || []);
    }, [confirmedBookingsQuery.data]);

    useEffect(() => {
        setPdfOverviewAllBookings(pdfBookingsQuery.data || []);
    }, [pdfBookingsQuery.data]);

    // Refund data effects
    useEffect(() => {
        setRefunds(refundsQuery.data || []);
    }, [refundsQuery.data]);

    useEffect(() => {
        if (refundStatisticsQuery.data) {
            setRefundStatistics({
                total_refunds: refundStatisticsQuery.data.total_refunds || 0,
                pending: refundStatisticsQuery.data.pending || 0,
                approved: refundStatisticsQuery.data.approved || 0,
                released: refundStatisticsQuery.data.released || 0,
                rejected: refundStatisticsQuery.data.rejected || 0,
                total_released_amount: refundStatisticsQuery.data.total_released_amount || 0,
                total_pending_amount: refundStatisticsQuery.data.total_pending_amount || 0,
            });
        }
    }, [refundStatisticsQuery.data]);

    useEffect(() => {
        setPendingRefunds(pendingRefundsQuery.data || []);
    }, [pendingRefundsQuery.data]);

    useEffect(() => {
        setApprovedRefunds(approvedRefundsQuery.data || []);
    }, [approvedRefundsQuery.data]);

    const loadInvoices = useCallback(async () => {
        await Promise.all([
            invoicesQuery.refetch(),
            paymentTrackingQuery.refetch(),
            paymentHistoryQuery.refetch(),
            mobilePaymentsQuery.refetch(),
            debtsQuery.refetch(),
            confirmedBookingsQuery.refetch(),
            pdfBookingsQuery.refetch(),
            settingsQuery.refetch(),
            ...(canProcessRefunds ? [refundsQuery.refetch(), refundStatisticsQuery.refetch()] : []),
        ]);
    }, [invoicesQuery, paymentTrackingQuery, paymentHistoryQuery, mobilePaymentsQuery, debtsQuery, confirmedBookingsQuery, pdfBookingsQuery, settingsQuery, refundsQuery, refundStatisticsQuery, canProcessRefunds]);

    const loadPayments = useCallback(async () => {
        await Promise.all([paymentTrackingQuery.refetch(), paymentHistoryQuery.refetch()]);
    }, [paymentTrackingQuery, paymentHistoryQuery]);

    const loadMobilePayments = useCallback(() => mobilePaymentsQuery.refetch(), [mobilePaymentsQuery]);
    const loadDebts = useCallback(() => debtsQuery.refetch(), [debtsQuery]);
    const loadConfirmedBookings = useCallback(() => confirmedBookingsQuery.refetch(), [confirmedBookingsQuery]);
    const loadAllBookingsForPDF = useCallback(() => pdfBookingsQuery.refetch(), [pdfBookingsQuery]);

    const loadRefunds = useCallback(async () => {
        if (!canProcessRefunds) return;
        await Promise.all([
            refundsQuery.refetch(),
            refundStatisticsQuery.refetch(),
            pendingRefundsQuery.refetch(),
            approvedRefundsQuery.refetch(),
        ]);
    }, [refundsQuery, refundStatisticsQuery, pendingRefundsQuery, approvedRefundsQuery, canProcessRefunds]);

    const invoiceSaveMutation = useMutation({
        mutationFn: ({ invoiceId, payload }) => invoiceId
            ? api.put(`/invoices/${invoiceId}`, payload)
            : api.post('/invoices', payload),
    });

    const paymentSaveMutation = useMutation({
        mutationFn: (payload) => api.post('/payments', payload),
    });

      const refundRequestMutation = useMutation({
        mutationFn: (payload) => api.post('/refunds', payload),
    });

    // ⭐ Admin Direct Refund — bypasses the request → approve → release flow.
    //    Admin processes and releases the refund in a single call.
    const refundDirectMutation = useMutation({
        mutationFn: (payload) => api.post('/refunds/admin-direct', payload),
    });
    const refundApproveMutation = useMutation({
        mutationFn: ({ refundId, payload }) => api.post(`/refunds/${refundId}/approve`, payload),
    });

    const refundReleaseMutation = useMutation({
        mutationFn: ({ refundId, payload }) => api.post(`/refunds/${refundId}/release`, payload),
    });

    const refundRejectMutation = useMutation({
        mutationFn: ({ refundId, payload }) => api.post(`/refunds/${refundId}/reject`, payload),
    });

    const invalidateInvoiceData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'confirmed-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'pdf-bookings'] });
    }, [queryClient]);

    const invalidatePaymentData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'debts'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'pdf-bookings'] });
    }, [queryClient]);

    const invalidateRefundData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['billing', 'refunds'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'debts'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'pdf-bookings'] });
    }, [queryClient]);

    // ==================== REFUND FUNCTIONS ====================
    const openRefundRequestModal = (invoice) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to process refunds.');
            return;
        }
        if (!invoice) {
            message.error('No invoice selected');
            return;
        }
        setSelectedInvoice(invoice);
        refundForm.resetFields();
        setRefundModalVisible(true);
    };

    const openRefundApprovalModal = (refund) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to approve refunds.');
            return;
        }
        if (!refund) {
            message.error('No refund selected');
            return;
        }
        setSelectedRefund(refund);
        refundApprovalForm.setFieldsValue({
            approved_amount: refund.deposit_snapshot || refund.amount || 0,
            admin_notes: '',
        });
        setRefundApprovalModalVisible(true);
    };

    const openRefundReleaseModal = (refund) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to release refunds.');
            return;
        }
        if (!refund) {
            message.error('No refund selected');
            return;
        }
        setSelectedRefund(refund);
        refundReleaseForm.setFieldsValue({
            released_amount: refund.approved_amount || refund.amount || 0,
            payment_method: 'cash',
            reference_number: '',
            notes: '',
        });
        setRefundReleaseModalVisible(true);
    };

    const openRefundRejectModal = (refund) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to reject refunds.');
            return;
        }
        if (!refund) {
            message.error('No refund selected');
            return;
        }
        setSelectedRefund(refund);
        refundRejectForm.resetFields();
        setRefundRejectModalVisible(true);
    };

    const openRefundDetailsModal = (refund) => {
        if (!refund) return;
        setSelectedRefund(refund);
        setRefundDetailsModalVisible(true);
    };

    const handleSubmitRefundRequest = async (values) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to submit refund requests.');
            return;
        }
        try {
            await refundRequestMutation.mutateAsync({
                invoice_id: selectedInvoice?.invoice_id,
                booking_id: selectedInvoice?.booking_id,
                reason: values.reason,
            });
            message.success('Refund request submitted successfully.');
            setRefundModalVisible(false);
            refundForm.resetFields();
            setSelectedInvoice(null);
            invalidateRefundData();
        } catch (error) {
            console.error('Refund request error:', error);
            message.error(error.response?.data?.message || 'Failed to submit refund request');
        }
    };

    const handleApproveRefund = async (values) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to approve refunds.');
            return;
        }
        try {
            await refundApproveMutation.mutateAsync({
                refundId: selectedRefund.refund_id,
                payload: {
                    approved_amount: Number(values.approved_amount || 0),
                    admin_notes: values.admin_notes || '',
                },
            });
            message.success('Refund approved successfully.');
            setRefundApprovalModalVisible(false);
            refundApprovalForm.resetFields();
            setSelectedRefund(null);
            invalidateRefundData();
        } catch (error) {
            console.error('Refund approval error:', error);
            message.error(error.response?.data?.message || 'Failed to approve refund');
        }
    };

    const handleReleaseRefund = async (values) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to release refunds.');
            return;
        }
        try {
            await refundReleaseMutation.mutateAsync({
                refundId: selectedRefund.refund_id,
                payload: {
                    released_amount: Number(values.released_amount || 0),
                    payment_method: values.payment_method || 'cash',
                    reference_number: values.reference_number || null,
                    notes: values.notes || '',
                    cancel_booking: true,
                },
            });
            message.success(`Refund of ₱${Number(values.released_amount).toLocaleString()} released successfully.`);
            setRefundReleaseModalVisible(false);
            refundReleaseForm.resetFields();
            setSelectedRefund(null);
            invalidateRefundData();
        } catch (error) {
            console.error('Refund release error:', error);
            message.error(error.response?.data?.message || 'Failed to release refund');
        }
    };
    const handleRejectRefund = async (values) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to reject refunds.');
            return;
        }
        try {
            await refundRejectMutation.mutateAsync({
                refundId: selectedRefund.refund_id,
                payload: {
                    reason: values.reason,
                },
            });
            message.success('Refund request rejected.');
            setRefundRejectModalVisible(false);
            refundRejectForm.resetFields();
            setSelectedRefund(null);
            invalidateRefundData();
        } catch (error) {
            console.error('Refund rejection error:', error);
            message.error(error.response?.data?.message || 'Failed to reject refund');
        }
    };

    // ⭐ ADMIN DIRECT REFUND — no request, no approval chain.
    //    Admin enters the amount + method, and the refund is released immediately.
    const openRefundDirectModal = (invoice) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to process direct refunds.');
            return;
        }
        if (!invoice) {
            message.error('No invoice selected');
            return;
        }
        setSelectedInvoice(invoice);
        refundDirectForm.resetFields();
        refundDirectForm.setFieldsValue({
            refund_amount: Number(invoice.paid_amount || invoice.balance || 0),
            payment_method: 'cash',
            reference_number: '',
            reason: '',
            notes: '',
            cancel_booking: true,
        });
        setRefundDirectModalVisible(true);
    };

    const handleDirectRefund = async (values) => {
        if (!canProcessRefunds) {
            message.error('You do not have permission to process direct refunds.');
            return;
        }
        if (!selectedInvoice) {
            message.error('No invoice selected');
            return;
        }
        const refundAmount = Number(values.refund_amount || 0);
        if (refundAmount < 0) {
            message.error('Refund amount cannot be negative.');
            return;
        }

        try {
            await refundDirectMutation.mutateAsync({
                invoice_id: selectedInvoice.invoice_id,
                booking_id: selectedInvoice.booking_id,
                amount: refundAmount,
                payment_method: values.payment_method || 'cash',
                reference_number: values.reference_number || null,
                reason: values.reason || 'Admin direct refund',
                notes: values.notes || '',
                cancel_booking: values.cancel_booking !== false,
            });
            message.success(
                refundAmount > 0
                    ? `Refund of ₱${refundAmount.toLocaleString()} processed successfully.`
                    : 'Booking cancelled without refund.'
            );
            setRefundDirectModalVisible(false);
            refundDirectForm.resetFields();
            setSelectedInvoice(null);
            invalidateRefundData();
        } catch (error) {
            console.error('Direct refund error:', error);
            message.error(error.response?.data?.message || 'Failed to process direct refund');
        }
    };
    // ==================== INVOICE FUNCTIONS ====================
    const handleViewInvoice = async (record) => {
        setSelectedInvoice(record);
        setInvoiceDetailsModalVisible(true);
        setInvoiceDetailsLoading(true);
        try {
            // Optional: re-fetch freshest invoice detail for the modal
            if (record?.invoice_id) {
                const res = await api.get(`/invoices/${record.invoice_id}`);
                const fresh = res?.data?.data || res?.data;
                if (fresh && typeof fresh === 'object' && !Array.isArray(fresh)) {
                    setSelectedInvoice(prev => ({ ...prev, ...fresh }));
                }
            }
        } catch (_) {
            // Silently fall back to the list row already in state
        } finally {
            setInvoiceDetailsLoading(false);
        }
    };

    const handleCreateInvoice = () => {
        invoiceForm.resetFields();
        setEditingInvoice(null);
        setCreateInvoiceBookingId(null);
        invoiceForm.setFieldsValue({
            due_date: dayjs().add(30, 'days'),
            discount_type: 'fixed',
            discount: 0,
            additional_charges: 0,
        });
         setInvoiceModalVisible(true);

        // ⭐ Force a fresh fetch every time the modal opens so a booking
        //    approved in another tab (or a new invoice created elsewhere)
        //    shows up immediately without a hard reload.
        //    Also invalidate so the query actually re-runs instead of
        //    resolving from cache.
        try {
            queryClient.invalidateQueries({
                queryKey: ['billing', 'confirmed-bookings'],
                refetchType: 'active',
            });
            confirmedBookingsQuery.refetch();
        } catch (e) {
            // query ref may not exist on first render
        }
    };
    const handleEditInvoice = (record) => {
        setEditingInvoice(record);
        setCreateInvoiceBookingId(record.booking_id);
        invoiceForm.setFieldsValue({
            booking_id: record.booking_id,
            booking_no: record.booking_no,
            customer_name: record.customer_name,
            customer_email: record.customer_email,
            customer_phone: record.customer_phone,
            customer_address: record.customer_address,
            event_type: record.event_type,
            event_date: record.event_date ? dayjs(record.event_date) : null,
            subtotal: record.subtotal,
            discount: record.discount,
            discount_type: record.discount_type || 'fixed',
            additional_charges: record.additional_charges,
            total_amount: record.total_amount,
            due_date: record.due_date ? dayjs(record.due_date) : null,
            notes: record.notes
        });
        setInvoiceModalVisible(true);
    };

        const handleSelectBooking = (bookingId) => {
        setCreateInvoiceBookingId(bookingId);
        const booking = confirmedBookings.find(b => b.booking_id === bookingId);
        if (!booking) return;

        // ⭐ Warn (but don't block) if this booking already has an invoice.
        //    The backend will reject the duplicate anyway, but we surface the
        //    reason up front so the operator is not confused.
        if (booking.has_invoice) {
            message.warning(
                `Booking ${booking.booking_no} already has invoice ${booking.invoice_number}. ` +
                'Creating a new invoice will be rejected by the server.'
            );
        }

        invoiceForm.setFieldsValue({
            booking_id: booking.booking_id,
            booking_no: booking.booking_no,
            customer_name: booking.customer_name,
            customer_email: booking.customer_email,
            customer_phone: booking.customer_phone,
            customer_address: booking.customer_address,
            event_type: booking.event_type,
            event_date: booking.event_date ? dayjs(booking.event_date) : null,
            subtotal: booking.subtotal || booking.total_amount || 0,
            total_amount: booking.total_amount || booking.subtotal || 0,
            guests_count: booking.guests_count,
            venue: booking.venue,
        });
    };

    const handleSaveInvoice = async (values) => {
        try {
            let totalAmount = values.subtotal;
            let discountAmount = values.discount || 0;

            if (values.discount_type === 'percentage') {
                discountAmount = values.subtotal * (values.discount / 100);
                totalAmount = values.subtotal - discountAmount;
            } else {
                totalAmount = values.subtotal - (values.discount || 0);
            }

            totalAmount = totalAmount + (values.additional_charges || 0);

            const invoiceData = canApproveFinancialAdjustments
                ? {
                    booking_id: values.booking_id,
                    subtotal: values.subtotal,
                    discount: values.discount || 0,
                    discount_type: values.discount_type || 'fixed',
                    additional_charges: values.additional_charges || 0,
                    total_amount: totalAmount,
                    due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
                    notes: values.notes
                }
                : {
                    booking_id: values.booking_id,
                    due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
                    notes: values.notes
                };

            await invoiceSaveMutation.mutateAsync({
                invoiceId: editingInvoice?.invoice_id,
                payload: invoiceData,
            });

            message.success(editingInvoice ? 'Invoice updated successfully' : 'Invoice created successfully');

            setInvoiceModalVisible(false);
            invoiceForm.resetFields();
            setEditingInvoice(null);
            invalidateInvoiceData();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to save invoice');
        }
    };

    const handleDeleteInvoice = async (record) => {
        confirm({
            title: 'Delete Invoice',
            content: `Are you sure you want to delete invoice ${record.invoice_number}?`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await api.delete(`/invoices/${record.invoice_id}`);
                    message.success('Invoice deleted successfully');
                    invalidateInvoiceData();
                } catch (error) {
                    message.error('Failed to delete invoice');
                }
            }
        });
    };

    const handleApplyDiscount = async (values) => {
        try {
            let totalAmount = selectedInvoice.subtotal;
            let discountAmount = values.discount_value;

            if (values.discount_type === 'percentage') {
                discountAmount = selectedInvoice.subtotal * (values.discount_value / 100);
                totalAmount = selectedInvoice.subtotal - discountAmount;
            } else {
                totalAmount = selectedInvoice.subtotal - values.discount_value;
            }

            totalAmount = totalAmount + (selectedInvoice.additional_charges || 0);

            await api.put(`/invoices/${selectedInvoice.invoice_id}`, {
                discount: values.discount_value,
                discount_type: values.discount_type,
                total_amount: totalAmount
            });

            message.success('Discount applied successfully');
            setDiscountModalVisible(false);
            discountForm.resetFields();
            invalidateInvoiceData();
        } catch (error) {
            message.error('Failed to apply discount');
        }
    };

    const handleSendReminder = async (values) => {
        try {
            await api.post(`/invoices/${selectedInvoice.invoice_id}/reminder`, {
                subject: values.subject,
                message: values.message
            });
            message.success(`Payment reminder sent to ${selectedInvoice.customer_name}`);
            setReminderModalVisible(false);
            reminderForm.resetFields();
        } catch (error) {
            message.error('Failed to send reminder');
        }
    };

    // ==================== PAYMENT FUNCTIONS ====================
    const handleRecordPayment = async (values) => {
        if (paymentSubmitLock.current || paymentSaveMutation.isPending || !selectedInvoice) return;

        paymentSubmitLock.current = true;
        try {
            const amount = Number(values.amount || 0);
            const currentPaid = Number(selectedInvoice.paid_amount || 0);
            const requiredDeposit = Number(selectedInvoice.required_deposit ?? (Number(selectedInvoice.total_amount || 0) * 0.30));
            const paymentType = getAutomaticPaymentType(selectedInvoice, amount);

            if (currentPaid < requiredDeposit && (currentPaid + amount) < requiredDeposit) {
                const continueBelowDeposit = await confirmAction({
                    title: '30% Deposit Reminder',
                    content: (
                        <div>
                            <p>The required minimum payment is a 30% deposit.</p>
                            <p><strong>Required deposit: {formatCurrency(requiredDeposit)}</strong></p>
                            <p>Would you like to continue?</p>
                        </div>
                    ),
                });

                if (!continueBelowDeposit) return;
            }

            const referenceNumber = values.reference_number || generateReferenceNumber();
            const paymentData = {
                booking_id: selectedInvoice.booking_id,
                amount,
                payment_method: values.payment_method,
                payment_type: paymentType,
                reference_number: referenceNumber,
                notes: values.notes,
                verify_immediately: true,
            };

            if (values.account_name) paymentData.account_name = values.account_name;
            if (values.account_number) paymentData.account_number = values.account_number;

            const savePayment = async (forceDuplicate = false) => paymentSaveMutation.mutateAsync({
                ...paymentData,
                force_duplicate: forceDuplicate,
            });

            try {
                await savePayment(false);
            } catch (error) {
                const duplicate = error.response?.status === 409
                    ? error.response?.data?.errors?.payment
                    : null;

                if (!duplicate) throw error;

                const continueDuplicate = await confirmAction({
                    title: 'Possible Duplicate Payment',
                    content: (
                        <div>
                            <p>A payment of <strong>{formatCurrency(duplicate.amount)}</strong> was already recorded within the last 5 minutes.</p>
                            <p>Are you sure you want to record another payment?</p>
                        </div>
                    ),
                });

                if (!continueDuplicate) return;
                await savePayment(true);
            }

            message.success('Payment recorded successfully.');
            setPaymentModalVisible(false);
            paymentForm.resetFields();
            setPaymentMethod('cash');
            invalidatePaymentData();
        } catch (error) {
            console.error('Payment error:', error);
            message.error(error.response?.data?.message || 'Failed to record payment');
        } finally {
            paymentSubmitLock.current = false;
        }
    };

    const generateReferenceNumber = () => {
        const timestamp = new Date().getTime().toString().slice(-8);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PAY-${timestamp}-${random}`;
    };

    // ==================== RECEIPT FUNCTIONS ====================
    const handleDownloadReceipt = async (payment) => {
        try {
            const paymentId = getPaymentId(payment);
            if (!paymentId) {
                message.warning('No payment record is available for this receipt.');
                return;
            }

            const response = await api.get(`/payments/${paymentId}/receipt`);
            const data = response.data?.data || response.data;
            const receiptHtml = applyReceiptWatermark(
                data?.receipt_html || generateReceiptHTML(data?.payment || payment)
            );

            if (!receiptHtml) throw new Error('Receipt HTML was not returned by the backend.');

            const html2pdfModule = await import('html2pdf.js');
            const html2pdf = html2pdfModule.default || html2pdfModule;
            await html2pdf()
                .set({
                    margin: 8,
                    filename: `receipt-${payment.payment_number || paymentId}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(receiptHtml, 'string')
                .save();

            message.success('Receipt downloaded successfully.');
        } catch (error) {
            console.error('Download receipt error:', error);
            message.error(error.response?.data?.message || 'Failed to download receipt');
        }
    };

    const handleViewReceipt = async (payment) => {
        try {
            const paymentId = getPaymentId(payment);
            if (!paymentId) {
                message.warning('No payment record is available.');
                return;
            }
            setSelectedPayment(payment);
            setReceiptModalVisible(true);
            setReceiptData(null); // show skeleton while fetching
            const response = await api.get(`/payments/${paymentId}/receipt`);
            const data = response.data?.data || response.data;
            setReceiptData({
                ...data,
                receipt_html: applyReceiptWatermark(
                    data?.receipt_html || generateReceiptHTML(data?.payment || payment)
                ),
            });
        } catch (error) {
            message.error('Failed to load receipt');
            setReceiptModalVisible(false);
        }
    };
    // ==================== PDF GENERATION ====================
    const generatePDFHTML = (booking) => {
        const logoBase64 = resolveBackendUrl(
            businessSettings.logo_url || businessSettings.company_logo || businessSettings.logo || ''
        );
        const companyName = businessSettings.company_name || businessSettings.business_name || businessSettings.name || 'N/A';
        const companyAddress = businessSettings.company_address || businessSettings.address || 'N/A';
        const companyPhone = businessSettings.company_phone || businessSettings.phone || businessSettings.contact_number || 'N/A';
        const companyEmail = businessSettings.company_email || businessSettings.email || 'N/A';

        const nestedServiceEvent = booking?.serviceEvent || booking?.service_event || {};
        const nestedCustomer = nestedServiceEvent?.customer || {};
        const nestedPerson = nestedCustomer?.person || {};
        const serviceEvent = {
            ...nestedServiceEvent,
            event_date: booking?.event_date ?? nestedServiceEvent?.event_date,
            event_time: booking?.event_time ?? nestedServiceEvent?.event_time,
            venue: booking?.venue ?? booking?.location ?? nestedServiceEvent?.venue,
            guests_count: booking?.guests_count ?? nestedServiceEvent?.guests_count,
        };
        const person = {
            ...nestedPerson,
            full_name: booking?.customer_name ?? nestedPerson?.full_name,
            email: booking?.customer_email ?? nestedPerson?.email,
            phone: booking?.customer_phone ?? nestedPerson?.phone,
        };
        const eventType = {
            ...(nestedServiceEvent?.eventType || nestedServiceEvent?.event_type || {}),
            name: booking?.event_type_name || booking?.event_type || nestedServiceEvent?.eventType?.name || nestedServiceEvent?.event_type?.name,
        };
        const menuItems = booking?.menu_items || [];
        const payments = booking?.payments || [];
        const charges = booking?.charges || [];
        const mealServices = booking?.meal_services || [];
        const totalAmount = booking?.total_amount || 0;
        const paidAmount = booking?.paid_amount || 0;
        const balance = Math.max(0, totalAmount - paidAmount);
        const currentDate = dayjs().format('MMMM DD, YYYY h:mm A');

        const groupedMenuItems = {};

        if (mealServices && mealServices.length > 0) {
            mealServices.forEach(meal => {
                const dayNumber = meal.day_number || 1;
                let mealType = meal.meal_type || 'Meal';
                const normalizedMealType = mealType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const serviceDate = meal.service_date || serviceEvent?.event_date || 'Date TBD';
                const dayKey = `DAY ${dayNumber} — ${serviceDate}`;
                if (!groupedMenuItems[dayKey]) {
                    groupedMenuItems[dayKey] = {};
                }
                if (!groupedMenuItems[dayKey][normalizedMealType]) {
                    groupedMenuItems[dayKey][normalizedMealType] = [];
                }

                const customItems = meal.custom_items || [];
                if (customItems.length > 0) {
                    customItems.forEach(item => {
                        groupedMenuItems[dayKey][normalizedMealType].push({
                            name: item.item_name || item.name || 'Menu Item',
                            quantity: item.quantity || 1,
                            unit_price: item.unit_price || item.price || 0,
                            subtotal: (item.quantity || 1) * (item.unit_price || item.price || 0)
                        });
                    });
                } else if (meal.menu_name || meal.menu_item?.name) {
                    groupedMenuItems[dayKey][normalizedMealType].push({
                        name: meal.menu_name || meal.menu_item?.name || 'Meal Service',
                        quantity: meal.pax || 1,
                        unit_price: meal.price_per_head || 0,
                        subtotal: (meal.pax || 1) * (meal.price_per_head || 0)
                    });
                }
            });
        }

        if (menuItems && menuItems.length > 0) {
            menuItems.forEach(item => {
                const dayNumber = item.day_number || 1;
                let mealType = item.meal_type || 'Meal';
                const normalizedMealType = mealType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const serviceDate = item.service_date || serviceEvent?.event_date || 'Date TBD';
                const dayKey = `DAY ${dayNumber} — ${serviceDate}`;
                if (!groupedMenuItems[dayKey]) {
                    groupedMenuItems[dayKey] = {};
                }
                if (!groupedMenuItems[dayKey][normalizedMealType]) {
                    groupedMenuItems[dayKey][normalizedMealType] = [];
                }
                groupedMenuItems[dayKey][normalizedMealType].push({
                    name: item.name || item.menu_item?.name || 'Menu Item',
                    quantity: item.quantity || 1,
                    unit_price: item.unit_price || item.price || 0,
                    subtotal: (item.quantity || 1) * (item.unit_price || item.price || 0)
                });
            });
        }

        let menuItemsHTML = '';
        const sortedDays = Object.keys(groupedMenuItems).sort((a, b) => {
            const dayA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
            const dayB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
            return dayA - dayB;
        });

        sortedDays.forEach(dayKey => {
            const meals = groupedMenuItems[dayKey];
            const sortedMealTypes = Object.keys(meals).sort((a, b) => {
                const indexA = MEAL_ORDER.indexOf(a);
                const indexB = MEAL_ORDER.indexOf(b);
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            });

            menuItemsHTML += `<div class="menu-day"><strong>${dayKey}</strong>`;

            sortedMealTypes.forEach(mealType => {
                const items = meals[mealType];
                const mealTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

                menuItemsHTML += `
                    <div class="menu-meal">
                        <div class="menu-meal-header">
                            <strong>${mealType}</strong>
                            <span class="meal-total">${formatCurrency(mealTotal)}</span>
                        </div>
                        <div style="margin: 4px 0; font-size: 9px; color: #94a3b8; border-bottom: 1px solid #e8edf2;">
                            <div style="display: flex; justify-content: space-between; padding: 2px 4px;">
                                <span style="width: 25%; text-align: left;">Menu Item</span>
                                <span style="width: 15%; text-align: center;">Qty/PAX</span>
                                <span style="width: 20%; text-align: right;">Unit Price</span>
                                <span style="width: 20%; text-align: right;">Subtotal</span>
                            </div>
                        </div>
                `;

                items.forEach(item => {
                    menuItemsHTML += `
                        <div style="display: flex; justify-content: space-between; padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 10px;">
                            <span style="width: 25%; text-align: left;">${item.name}</span>
                            <span style="width: 15%; text-align: center;">${item.quantity}</span>
                            <span style="width: 20%; text-align: right;">${formatCurrency(item.unit_price)}</span>
                            <span style="width: 20%; text-align: right;">${formatCurrency(item.subtotal)}</span>
                        </div>
                    `;
                });

                menuItemsHTML += `
                        <div style="border-bottom: 2px solid #d1d5db; margin-top: 2px;"></div>
                    </div>
                `;
            });
            menuItemsHTML += `</div>`;
        });

        if (!menuItemsHTML) {
            menuItemsHTML = `<p style="text-align: center; color: #94a3b8; padding: 10px;">No menu items recorded for this booking.</p>`;
        }

        let chargesHTML = '';
        if (charges && charges.length > 0) {
            charges.forEach(charge => {
                if (charge.amount > 0) {
                    chargesHTML += `
                        <tr>
                            <td style="text-align:left;">${charge.description || charge.charge_type}</td>
                            <td style="text-align:right;">${formatCurrency(charge.amount)}</td>
                        </tr>
                    `;
                }
            });
        }
        if (!chargesHTML) {
            chargesHTML = `<tr><td colspan="2" style="text-align:center;color:#94a3b8;">No additional charges or adjustments recorded.</td></tr>`;
        }

        let paymentsHTML = '';
        if (payments && payments.length > 0) {
            payments.forEach(p => {
                paymentsHTML += `
                    <tr>
                        <td style="text-align:center;">${p.payment_number || 'N/A'}</td>
                        <td style="text-align:center;">${(p.payment_method || 'N/A').toUpperCase()}</td>
                        <td style="text-align:center;">${(p.payment_type || 'partial').toUpperCase()}</td>
                        <td style="text-align:center;">${p.reference_number || 'N/A'}</td>
                        <td style="text-align:right;">${formatCurrency(p.amount)}</td>
                        <td style="text-align:center;">${(p.status || 'pending').toUpperCase()}</td>
                    </tr>
                `;
            });
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Booking Details - ${booking?.booking_no || 'N/A'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    @page { size: A4; margin: 15mm 12mm; }
                    body {
                        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                        background: #f8fafc;
                        color: #1e293b;
                        font-size: 11px;
                        line-height: 1.5;
                        padding: 20px;
                    }
                    .pdf-container {
                        max-width: 210mm;
                        margin: 0 auto;
                        background: #ffffff;
                        padding: 12mm 10mm;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #1a7ab5;
                        padding-bottom: 16px;
                        margin-bottom: 16px;
                    }
                    .header .logo {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 12px;
                        margin-bottom: 4px;
                    }
                    .header .logo img { height: 54px; width: 54px; border-radius: 8px; object-fit: cover; }
                    .header h1 { font-size: 22px; font-weight: 700; color: #1a7ab5; margin: 0; letter-spacing: 0.5px; }
                    .header .subtitle { font-size: 10px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
                    .header .address { font-size: 10px; color: #64748b; margin-top: 4px; }
                    .header .contact { font-size: 10px; color: #64748b; }
                    .pdf-title {
                        text-align: center;
                        font-size: 18px;
                        font-weight: 700;
                        color: #1a7ab5;
                        margin: 12px 0 8px;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }
                    .pdf-meta {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 8px;
                        background: #f8fafc;
                        padding: 10px 14px;
                        border-radius: 6px;
                        margin-bottom: 12px;
                        border: 1px solid #e8edf2;
                    }
                    .pdf-meta .meta-item { display: flex; flex-direction: column; }
                    .pdf-meta .meta-label { font-size: 8px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
                    .pdf-meta .meta-value { font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 1px; }
                    .section { margin-bottom: 12px; }
                    .section-title {
                        font-size: 12px;
                        font-weight: 700;
                        color: #1a7ab5;
                        border-bottom: 1px solid #e8edf2;
                        padding-bottom: 4px;
                        margin-bottom: 6px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 4px 20px;
                    }
                    .info-grid .info-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 2px 0;
                        font-size: 10px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .info-grid .info-item .label { color: #64748b; font-weight: 500; }
                    .info-grid .info-item .value { font-weight: 500; color: #1e293b; text-align: right; }
                    .menu-day {
                        margin-bottom: 10px;
                        border: 1px solid #e8edf2;
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .menu-day > strong {
                        display: block;
                        padding: 6px 10px;
                        background: #f1f5f9;
                        font-size: 11px;
                        font-weight: 700;
                        color: #1a7ab5;
                        border-bottom: 1px solid #e8edf2;
                    }
                    .menu-meal { padding: 4px 0; }
                    .menu-meal-header {
                        display: flex;
                        justify-content: space-between;
                        padding: 4px 10px;
                        font-size: 10px;
                        font-weight: 600;
                        color: #1e293b;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .menu-meal-header .meal-total { color: #1a7ab5; }
                    .charges-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                    }
                    .charges-table td { padding: 3px 8px; border-bottom: 1px solid #f1f5f9; }
                    .payment-summary { margin-top: 8px; }
                    .payment-summary .summary-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 3px 0;
                        font-size: 10px;
                    }
                    .payment-summary .summary-row.grand {
                        font-size: 14px;
                        font-weight: 700;
                        color: #1a7ab5;
                        border-top: 2px solid #1a7ab5;
                        padding-top: 6px;
                        margin-top: 4px;
                    }
                    .payment-summary .summary-row .label { color: #64748b; }
                    .payment-summary .summary-row .value { font-weight: 600; color: #1e293b; }
                    .payment-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9.5px;
                        margin: 4px 0;
                    }
                    .payment-table th {
                        background: #f8fafc;
                        font-weight: 600;
                        color: #64748b;
                        padding: 3px 6px;
                        border-bottom: 1px solid #e8edf2;
                        text-transform: uppercase;
                        font-size: 8px;
                        letter-spacing: 0.3px;
                        text-align: center;
                    }
                    .payment-table td { padding: 3px 6px; border-bottom: 1px solid #f1f5f9; text-align: center; }
                    .footer {
                        text-align: center;
                        border-top: 1px solid #e8edf2;
                        padding-top: 10px;
                        margin-top: 12px;
                        font-size: 9px;
                        color: #94a3b8;
                    }
                    .footer .thanks { font-size: 12px; font-weight: 600; color: #1a7ab5; margin-bottom: 2px; }
                    .footer .generated { font-size: 8px; color: #cbd5e1; }
                    @media print {
                        body { background: white; padding: 0; margin: 0; }
                        .pdf-container { box-shadow: none; border-radius: 0; padding: 10mm 12mm; max-width: 100%; }
                    }
                    @media (max-width: 600px) {
                        .pdf-container { padding: 8mm 6mm; }
                        .info-grid { grid-template-columns: 1fr; }
                        .pdf-meta { grid-template-columns: 1fr; }
                    }
                </style>
            </head>
            <body>
                <div class="pdf-container">
                    <div class="header">
                        <div class="logo">
                            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ''}
                            <div>
                                <h1>Dear Bab's </h1>
                                <div class="subtitle"> Fastfood and Catering Services</div>
                            </div>
                        </div>
                        <div class="address">Zone 3 Amoros EL Salvador City</div>
                        <div class="contact">09708986628 : dearbab's@gmail.com</div>
                    </div>
                    <div class="pdf-title">Booking Details</div>
                    <div class="pdf-meta">
                        <div class="meta-item">
                            <span class="meta-label">Booking No.</span>
                            <span class="meta-value">${booking?.booking_no || 'N/A'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Date Issued</span>
                            <span class="meta-value">${currentDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Status</span>
                            <span class="meta-value">${(booking?.booking_status || 'N/A').toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Customer & Event Information</div>
                        <div class="info-grid">
                            <div class="info-item"><span class="label">Customer Name</span><span class="value">${person?.full_name || 'Unknown'}</span></div>
                            <div class="info-item"><span class="label">Email</span><span class="value">${person?.email || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Contact Number</span><span class="value">${person?.phone || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Event Name</span><span class="value">${eventType?.name || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Event Date</span><span class="value">${serviceEvent?.event_date ? dayjs(serviceEvent.event_date).format('MMMM DD, YYYY') : 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Event Time</span><span class="value">${serviceEvent?.event_time || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Venue</span><span class="value">${serviceEvent?.venue || 'N/A'}</span></div>
                            <div class="info-item"><span class="label">Number of Guests</span><span class="value">${serviceEvent?.guests_count || 0}</span></div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Selected Menu Items</div>
                        ${menuItemsHTML}
                    </div>
                    <div class="section">
                        <div class="section-title">Additional Charges / Adjustments</div>
                        <table class="charges-table">
                            <tbody>${chargesHTML}</tbody>
                        </table>
                    </div>
                    <div class="section">
                        <div class="section-title">Payment Summary</div>
                        <table class="payment-table">
                            <thead>
                                <tr>
                                    <th>Payment #</th>
                                    <th>Method</th>
                                    <th>Type</th>
                                    <th>Reference #</th>
                                    <th style="text-align:right;">Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>${paymentsHTML}</tbody>
                        </table>
                    </div>
                    <div class="payment-summary">
                        <div class="summary-row grand"><span class="label">Grand Total</span><span class="value">${formatCurrency(totalAmount)}</span></div>
                        <div class="summary-row"><span class="label">Total Paid</span><span class="value" style="color:#10b981;">${formatCurrency(paidAmount)}</span></div>
                        <div class="summary-row"><span class="label">Balance</span><span class="value" style="color:${balance > 0 ? '#ef4444' : '#10b981'};">${formatCurrency(balance)}</span></div>
                    </div>
                    <div class="footer">
                        <div class="thanks">Thank you for your business.</div>
                        <div>This is a system-generated document.</div>
                        <div class="generated">Generated on: ${currentDate}</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    // ==================== PDF OVERVIEW FUNCTIONS ====================
    const handlePDFOverviewSelectBooking = async (bookingId) => {
        setPdfOverviewLoading(true);
        try {
            const booking = pdfOverviewAllBookings.find(b => b.booking_id === bookingId);
            if (!booking) {
                message.error('Booking not found');
                setPdfOverviewLoading(false);
                return;
            }

            setPdfOverviewBooking(booking);

            const response = await api.get(`/bookings/${bookingId}`);
            const fullBooking = response.data?.data || response.data;

            const html = generatePDFHTML(fullBooking);
            setPdfOverviewHtml(html);
            setPdfOverviewZoom(100);

            message.success(`Loaded PDF for ${booking.booking_no || 'Booking'}`);
        } catch (error) {
            console.error('Failed to load booking PDF:', error);
            message.error('Failed to load booking details');
        } finally {
            setPdfOverviewLoading(false);
        }
    };

    const handlePrintPDFOverview = () => {
        if (!pdfOverviewHtml) {
            message.warning('No PDF to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) {
            message.error('Please allow popups to print');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(pdfOverviewHtml);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleDownloadPDFOverview = async () => {
        if (!pdfOverviewHtml) {
            message.warning('No PDF to download');
            return;
        }

        try {
            await downloadHtmlAsPdf(
                pdfOverviewHtml,
                `booking-${pdfOverviewBooking?.booking_no || 'N-A'}.pdf`
            );
            message.success('PDF downloaded successfully.');
        } catch (error) {
            console.error('PDF overview download error:', error);
            message.error('Failed to download PDF');
        }
    };

    const handleViewPDF = async (booking) => {
        try {
            setPdfViewerBooking(booking);
            setPdfViewerZoom(100);

            const response = await api.get(`/bookings/${booking.booking_id}`);
            const fullBooking = response.data?.data || response.data;

            const html = generatePDFHTML(fullBooking);
            setPdfViewerHtml(html);
            setPdfViewerVisible(true);
        } catch (error) {
            console.error('Failed to load PDF:', error);
            message.error('Failed to load PDF');
        }
    };

    const handlePrintPDF = () => {
        if (!pdfViewerHtml) {
            message.warning('No PDF to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) {
            message.error('Please allow popups to print');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(pdfViewerHtml);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleDownloadPDF = async () => {
        if (!pdfViewerHtml) {
            message.warning('No PDF to download');
            return;
        }

        try {
            await downloadHtmlAsPdf(
                pdfViewerHtml,
                `booking-${pdfViewerBooking?.booking_no || 'N-A'}.pdf`
            );
            message.success('PDF downloaded successfully.');
        } catch (error) {
            console.error('PDF download error:', error);
            message.error('Failed to download PDF');
        }
    };

    const handlePrintReceipt = async (payment = selectedPayment) => {
        try {
            const paymentId = getPaymentId(payment);
            if (!paymentId) {
                message.warning('No payment selected');
                return;
            }

            const response = await api.get(`/payments/${paymentId}/receipt`);
            const data = response.data?.data || response.data;
            const paymentData = data?.payment || payment;
            const html = applyReceiptWatermark(
                data?.receipt_html || generateReceiptHTML(paymentData)
            );
            setReceiptPreviewHtml(html);
            setReceiptPreviewZoom(100);
            setReceiptPreviewVisible(true);

        } catch (error) {
            console.error('Print receipt error:', error);
            message.error('Failed to generate receipt');
        }
    };

    const generateReceiptHTML = (payment) => {
        const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Payment Receipt</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .receipt { max-width: 600px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #1a7ab5; padding-bottom: 16px; }
                    .header h1 { color: #1a7ab5; }
                    .details { margin: 20px 0; }
                    .details table { width: 100%; }
                    .details td { padding: 4px 0; }
                    .footer { text-align: center; border-top: 1px solid #ddd; padding-top: 16px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <h1>Payment Receipt</h1>
                        <p>Receipt #: ${payment?.payment_number || 'N/A'}</p>
                        <p>Date: ${dayjs(payment?.date || new Date()).format('MMMM DD, YYYY h:mm A')}</p>
                    </div>
                    <div class="details">
                        <table>
                            <tr><td><strong>Customer:</strong></td><td>${payment?.customer_name || 'N/A'}</td></tr>
                            <tr><td><strong>Amount:</strong></td><td>${formatCurrency(payment?.amount || 0)}</td></tr>
                            <tr><td><strong>Payment Method:</strong></td><td>${(payment?.payment_method || 'N/A').toUpperCase()}</td></tr>
                            <tr><td><strong>Reference #:</strong></td><td>${payment?.reference_number || 'N/A'}</td></tr>
                            <tr><td><strong>Status:</strong></td><td>${(payment?.status || 'pending').toUpperCase()}</td></tr>
                        </table>
                    </div>
                    <div class="footer">
                        <p>Thank you for your business.</p>
                        <p style="font-size: 10px; color: #94a3b8;">This is a system-generated receipt.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return applyReceiptWatermark(receiptHtml);
    };

    const handlePrintReceiptDirect = () => {
        if (!receiptPreviewHtml) {
            message.warning('No receipt to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) {
            message.error('Please allow popups to print');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(receiptPreviewHtml);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleDownloadReceiptPDF = async () => {
        if (!receiptPreviewHtml) {
            message.warning('No receipt to download');
            return;
        }

        try {
            await downloadHtmlAsPdf(
                receiptPreviewHtml,
                `receipt-${selectedPayment?.payment_number || getPaymentId(selectedPayment) || 'N-A'}.pdf`
            );
            message.success('Receipt downloaded successfully.');
        } catch (error) {
            console.error('Receipt preview download error:', error);
            message.error('Failed to download receipt');
        }
    };

    // ==================== MOBILE PAYMENT FUNCTIONS ====================
    const handleVerifyMobilePayment = async (payment) => {
        confirm({
            title: 'Verify Mobile Payment',
            content: `Verify payment of ${formatCurrency(payment.amount)} from ${payment.customer_name}?`,
            okText: 'Verify',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await api.post(`/payments/mobile/${payment.payment_id}/verify`, {
                        notes: 'Verified via admin'
                    });
                    message.success('Mobile payment verified successfully');
                    invalidatePaymentData();
                    queryClient.invalidateQueries({ queryKey: ['billing', 'payments', 'mobile'] });
                } catch (error) {
                    message.error('Failed to verify payment');
                }
            }
        });
    };

    const handleRejectMobilePayment = (payment) => {
        setSelectedPayment(payment);
        setRejectReason('');
        setRejectPaymentModalVisible(true);
    };

    const handleConfirmReject = async () => {
        if (!rejectReason.trim()) {
            message.error('Please provide a reason for rejection');
            return;
        }

        try {
            await api.post(`/payments/mobile/${selectedPayment.payment_id}/reject`, {
                reason: rejectReason
            });
            message.success('Payment rejected successfully');
            setRejectPaymentModalVisible(false);
            invalidatePaymentData();
            queryClient.invalidateQueries({ queryKey: ['billing', 'payments', 'mobile'] });
        } catch (error) {
            message.error('Failed to reject payment');
        }
    };

    // ==================== EXPORT FUNCTIONS ====================
    const exportToExcel = (data, filename, columns) => {
        if (!Array.isArray(data) || data.length === 0) {
            message.warning('No data to export');
            return;
        }

        const worksheetData = data.map(row => {
            const exportRow = {};
            columns.forEach(col => {
                if (col.dataIndex) {
                    let value = row[col.dataIndex];
                    if (col.dataIndex === 'total_amount' || col.dataIndex === 'amount' ||
                        col.dataIndex === 'paid_amount' || col.dataIndex === 'balance') {
                        value = `₱${Number(value || 0).toLocaleString()}`;
                    }
                    exportRow[col.title] = value || '';
                } else if (col.key === 'status') {
                    const config = getStatusConfig(row.status);
                    exportRow[col.title] = config.text;
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

    const exportInvoices = () => {
        const columns = [
            { title: 'BOOKING #', dataIndex: 'booking_no' },
            { title: 'INVOICE #', dataIndex: 'invoice_number' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'EVENT', dataIndex: 'event_type' },
            { title: 'TOTAL', dataIndex: 'total_amount' },
            { title: 'PAID', dataIndex: 'paid_amount' },
            { title: 'BALANCE', dataIndex: 'balance' },
            { title: 'DUE DATE', dataIndex: 'due_date' },
            { title: 'STATUS', key: 'status' }
        ];
        exportToExcel(invoices, 'Invoices_Report', columns);
    };

    const exportPayments = () => {
        const columns = [
            { title: 'PAYMENT #', dataIndex: 'payment_number' },
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'INVOICE', dataIndex: 'invoice_number' },
            { title: 'METHOD', dataIndex: 'payment_method' },
            { title: 'TYPE', dataIndex: 'payment_type' },
            { title: 'AMOUNT', dataIndex: 'amount' },
            { title: 'REFERENCE #', dataIndex: 'reference_number' },
            { title: 'DATE', dataIndex: 'date' },
            { title: 'STATUS', dataIndex: 'status' }
        ];
        exportToExcel(payments, 'Payments_Report', columns);
    };

    const exportDebts = () => {
        const columns = [
            { title: 'CUSTOMER', dataIndex: 'customer_name' },
            { title: 'BOOKING #', dataIndex: 'booking_no' },
            { title: 'TOTAL DEBT', dataIndex: 'total_debt' },
            { title: 'PAID', dataIndex: 'paid_debt' },
            { title: 'BALANCE', dataIndex: 'remaining_debt' },
            { title: 'DAYS OVERDUE', dataIndex: 'days_overdue' },
            { title: 'STATUS', dataIndex: 'status' }
        ];
        exportToExcel(debts, 'Debt_Management_Report', columns);
    };

    const exportRefunds = () => {
        if (!canProcessRefunds) {
            message.warning('You do not have permission to export refunds.');
            return;
        }
        const columns = [
            { title: 'REFUND #', dataIndex: 'refund_number' },
            { title: 'BOOKING #', key: 'booking_no' },
            { title: 'INVOICE #', key: 'invoice_number' },
            { title: 'AMOUNT', dataIndex: 'amount' },
            { title: 'STATUS', dataIndex: 'status' },
            { title: 'REASON', dataIndex: 'reason' },
            { title: 'REQUESTED', dataIndex: 'requested_at' },
            { title: 'RELEASED', dataIndex: 'released_at' },
        ];
        const exportData = refunds.map(r => ({
            ...r,
            booking_no: r.booking?.booking_no || 'N/A',
            invoice_number: r.invoice?.invoice_number || 'N/A',
        }));
        exportToExcel(exportData, 'Refunds_Report', columns);
    };

    // ==================== HELPER FUNCTIONS ====================
    const getStatusConfig = (status) => {
        const config = {
            paid: { color: '#52c41a', text: 'Paid', icon: <CheckCircleOutlined />, bg: 'rgba(82, 196, 26, 0.1)' },
            partial: { color: '#faad14', text: 'Partial', icon: <ClockCircleOutlined />, bg: 'rgba(250, 173, 20, 0.1)' },
            unpaid: { color: '#ff4d4f', text: 'Unpaid', icon: <WarningOutlined />, bg: 'rgba(255, 77, 79, 0.1)' },
            overdue: { color: '#ff4d4f', text: 'Overdue', icon: <ExclamationCircleOutlined />, bg: 'rgba(255, 77, 79, 0.1)' },
            pending: { color: '#faad14', text: 'Pending', icon: <ClockCircleOutlined />, bg: 'rgba(250, 173, 20, 0.1)' },
            completed: { color: '#52c41a', text: 'Completed', icon: <CheckCircleOutlined />, bg: 'rgba(82, 196, 26, 0.1)' },
            refunded: { color: '#722ed1', text: 'Refunded', icon: <BankOutlined />, bg: 'rgba(114, 46, 209, 0.1)' },
            failed: { color: '#ff4d4f', text: 'Failed', icon: <CloseCircleOutlined />, bg: 'rgba(255, 77, 79, 0.1)' }
        };
        return config[status] || config.unpaid;
    };

    const getPaymentMethodIcon = (method) => {
        const icons = {
            cash: <BankOutlined />,
            gcash: <WalletOutlined />,
            maya: <WalletOutlined />,
            bank_transfer: <BankOutlined />,
            card: <CreditCardOutlined />,
            check: <FileTextOutlined />
        };
        return icons[method] || <BankOutlined />;
    };

    // ==================== STATS ====================
    const totalRevenue = useMemo(() =>
        Array.isArray(invoices) ? invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) : 0,
    [invoices]);

    const totalPaid = useMemo(() =>
        Array.isArray(invoices) ? invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) : 0,
    [invoices]);

    const totalOutstanding = useMemo(() =>
        Array.isArray(invoices) ? invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0) : 0,
    [invoices]);

    const totalDebt = useMemo(() =>
        Array.isArray(debts) ? debts.reduce((sum, debt) => sum + (debt.remaining_debt || 0), 0) : 0,
    [debts]);

    const overdueCount = useMemo(() =>
        Array.isArray(invoices) ? invoices.filter(i => i.status === 'overdue').length : 0,
    [invoices]);

    const overdueDebt = useMemo(() =>
        Array.isArray(debts) ? debts.filter(d => d.days_overdue > 0).reduce((sum, d) => sum + (d.remaining_debt || 0), 0) : 0,
    [debts]);

    const collectionRate = useMemo(() =>
        totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : 0,
    [totalRevenue, totalPaid]);

    // ==================== FILTERED DATA ====================
    const filteredInvoices = useMemo(() => {
        if (!Array.isArray(invoices)) return [];
        return invoices.filter(inv => {
            if (Number(inv.balance || 0) <= 0 || String(inv.status || '').toLowerCase() === 'paid') return false;
            if (searchText && !inv.customer_name?.toLowerCase().includes(searchText.toLowerCase()) &&
                !inv.invoice_number?.toLowerCase().includes(searchText.toLowerCase())) return false;
            if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
            if (filterDate && filterDate[0] && filterDate[1]) {
                const invDate = dayjs(inv.issue_date);
                if (invDate.isBefore(filterDate[0]) || invDate.isAfter(filterDate[1])) return false;
            }
            return true;
        });
    }, [invoices, searchText, filterStatus, filterDate]);

    const filteredPaymentHistory = useMemo(() => {
        if (!Array.isArray(paymentHistory)) return [];
        return paymentHistory.filter(payment => {
            const search = paymentHistorySearch.trim().toLowerCase();
            const customerFilter = paymentHistoryCustomer.trim().toLowerCase();
            const invoiceFilter = paymentHistoryInvoice.trim().toLowerCase();
            const customerName = String(payment.customer_name || payment.customer || '').toLowerCase();
            const invoiceNumber = String(payment.invoice_number || payment.invoice_no || '').toLowerCase();
            const method = String(payment.payment_method || payment.method || '').toLowerCase();
            const paymentDate = dayjs(payment.payment_date || payment.date || payment.created_at);

            if (search && !customerName.includes(search) && !invoiceNumber.includes(search) &&
                !String(payment.reference_number || payment.payment_number || '').toLowerCase().includes(search)) return false;
            if (customerFilter && !customerName.includes(customerFilter)) return false;
            if (invoiceFilter && !invoiceNumber.includes(invoiceFilter)) return false;
            if (paymentHistoryMethod !== 'all' && method !== paymentHistoryMethod) return false;
            if (paymentHistoryDateRange?.length === 2 && paymentDate.isValid()) {
                if (paymentDate.isBefore(paymentHistoryDateRange[0], 'day') ||
                    paymentDate.isAfter(paymentHistoryDateRange[1], 'day')) return false;
            }
            return true;
        });
    }, [paymentHistory, paymentHistorySearch, paymentHistoryCustomer, paymentHistoryInvoice,
        paymentHistoryMethod, paymentHistoryDateRange]);

    const filteredPDFBookings = useMemo(() => {
        if (!Array.isArray(pdfOverviewAllBookings)) return [];
        if (!pdfOverviewSearch) return pdfOverviewAllBookings;
        const search = pdfOverviewSearch.toLowerCase();
        return pdfOverviewAllBookings.filter(b =>
            (b.booking_no || '').toLowerCase().includes(search) ||
            (b.customer_name || '').toLowerCase().includes(search) ||
            (b.customer?.person?.full_name || '').toLowerCase().includes(search)
        );
    }, [pdfOverviewAllBookings, pdfOverviewSearch]);

    const filteredRefunds = useMemo(() => {
        if (!canProcessRefunds) return [];
        if (!Array.isArray(refunds)) return [];
        return refunds.filter(r => {
            if (refundHistorySearch) {
                const s = refundHistorySearch.toLowerCase();
                const matchSearch =
                    (r.refund_number || '').toLowerCase().includes(s) ||
                    (r.booking?.booking_no || '').toLowerCase().includes(s) ||
                    (r.invoice?.invoice_number || '').toLowerCase().includes(s) ||
                    (r.reason || '').toLowerCase().includes(s) ||
                    (r.booking?.serviceEvent?.customer?.person?.full_name || '').toLowerCase().includes(s) ||
                    (r.invoice?.booking?.serviceEvent?.customer?.person?.full_name || '').toLowerCase().includes(s);
                if (!matchSearch) return false;
            }
            if (refundHistoryStatus !== 'all' && r.status !== refundHistoryStatus) return false;
            if (refundHistoryDateRange?.length === 2 && r.requested_at) {
                const d = dayjs(r.requested_at);
                if (d.isBefore(refundHistoryDateRange[0], 'day') || d.isAfter(refundHistoryDateRange[1], 'day')) return false;
            }
            return true;
        });
    }, [refunds, refundHistorySearch, refundHistoryStatus, refundHistoryDateRange, canProcessRefunds]);

    // ==================== TABLE COLUMNS ====================

    const invoiceColumns = useMemo(() => [
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 140,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'INVOICE #',
            dataIndex: 'invoice_number',
            key: 'invoice_number',
            width: 150,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 200,
            render: (text, record) => (
                <div>
                    <Text strong className={isDarkMode ? 'bi-text-dark-primary' : ''}>{text || 'Unknown'}</Text>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{record.customer_email || ''}</Text>
                </div>
            )
        },
        {
            title: 'EVENT',
            dataIndex: 'event_type',
            key: 'event_type',
            width: 130,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'TOTAL',
            dataIndex: 'total_amount',
            key: 'total_amount',
            width: 130,
            align: 'right',
            render: (v) => <Text strong className="bi-amount-total">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'PAID',
            dataIndex: 'paid_amount',
            key: 'paid_amount',
            width: 130,
            align: 'right',
            render: (v) => <Text className="bi-amount-paid">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'BALANCE',
            dataIndex: 'balance',
            key: 'balance',
            width: 130,
            align: 'right',
            render: (v) => (
                <Text strong className={Number(v || 0) > 0 ? 'bi-amount-balance' : 'bi-amount-paid'}>
                    ₱{Number(v || 0).toLocaleString()}
                </Text>
            )
        },
        {
            title: 'DUE DATE',
            dataIndex: 'due_date',
            key: 'due_date',
            width: 120,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            align: 'center',
            render: (s, record) => {
                const config = getStatusConfig(s);
                const refundConfig = record.refund_status ? getRefundStatusConfig(record.refund_status) : null;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        <span className="bi-status-badge" style={{
                            color: config.color,
                            background: config.bg,
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {config.icon} {config.text}
                        </span>
                        {refundConfig && (
                            <span style={{
                                color: refundConfig.color,
                                background: refundConfig.bg,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '10px',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                            }}>
                                {refundConfig.icon} Refund: {refundConfig.text}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: canProcessRefunds ? 300 : 260,
            render: (_, record) => {
                const actionItems = [
                    {
                        key: 'view',
                        label: 'View Invoice',
                        icon: <EyeOutlined />,
                        onClick: () => handleViewInvoice(record)
                    },
                    {
                        key: 'pdf',
                        label: 'View PDF',
                        icon: <FilePdfOutlined />,
                        onClick: () => handleViewPDF(record)
                    },
                    {
                        key: 'edit',
                        label: 'Edit',
                        icon: <EditOutlined />,
                        onClick: () => handleEditInvoice(record)
                    },
                    {
                        key: 'payment',
                        label: 'Record Payment',
                        icon: <DollarOutlined />,
                        onClick: () => {
                            setSelectedInvoice(record);
                            paymentForm.setFieldsValue({
                                amount: null,
                                payment_method: 'cash',
                                payment_type: (record.balance || 0) >= (record.total_amount || 0) ? 'full' : 'partial',
                                reference_number: '',
                                account_name: '',
                                account_number: ''
                            });
                            setPaymentMethod('cash');
                            setPaymentModalVisible(true);
                        }
                    },
                    { type: 'divider' },
                                     ...(canProcessRefunds ? [{
                        key: 'refund-direct',
                        label: 'Direct Refund',
                        icon: <RollbackOutlined />,
                        onClick: () => openRefundDirectModal(record),
                        disabled: record.refund_status && !['rejected', 'cancelled'].includes(record.refund_status),
                    }] : []),
                    {
                        key: 'discount',
                        label: 'Apply Discount',
                        icon: <PercentageOutlined />,
                        onClick: () => {
                            setSelectedInvoice(record);
                            discountForm.setFieldsValue({
                                discount_value: record.discount || 0,
                                discount_type: record.discount_type || 'fixed'
                            });
                            setDiscountModalVisible(true);
                        }
                    },
                    {
                        key: 'reminder',
                        label: 'Send Payment Reminder',
                        icon: <MailOutlined />,
                        onClick: () => {
                            setSelectedInvoice(record);
                            reminderForm.setFieldsValue({
                                subject: `Payment Reminder - ${record.invoice_number}`,
                                message: `Dear ${record.customer_name},\n\nThis is a friendly reminder that your payment of ₱${(record.balance || 0).toLocaleString()} for invoice ${record.invoice_number} is due on ${record.due_date}.\n\nPlease process the payment at your earliest convenience.\n\nThank you for your business.`
                            });
                            setReminderModalVisible(true);
                        }
                    },
                    {
                        key: 'print',
                        label: 'Print Receipt',
                        icon: <PrinterOutlined />,
                        onClick: () => {
                            const payment = payments.find(p => p.invoice_id === record.invoice_id || p.booking_id === record.booking_id);
                            if (payment) {
                                handlePrintReceipt(payment);
                            } else {
                                message.warning('No payment record found for this invoice');
                            }
                        }
                    },
                    { type: 'divider' },
                    {
                        key: 'delete',
                        label: 'Delete Invoice',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => handleDeleteInvoice(record)
                    }
                ].filter((item) => canApproveFinancialAdjustments || !['edit', 'discount', 'delete'].includes(item.key));

                return (
                    <Space size={4} className="bi-actions-space">
                        <Tooltip title="View Invoice">
                            <Button type="text" className="bi-action-btn" icon={<EyeOutlined />} onClick={() => handleViewInvoice(record)} />
                        </Tooltip>
                        <Tooltip title="View PDF">
                            <Button type="text" className="bi-action-btn" icon={<FilePdfOutlined />} onClick={() => handleViewPDF(record)} />
                        </Tooltip>
                        {canApproveFinancialAdjustments && (
                            <Tooltip title="Edit">
                                <Button type="text" className="bi-action-btn" icon={<EditOutlined />} onClick={() => handleEditInvoice(record)} />
                            </Tooltip>
                        )}
                        <Tooltip title="Record Payment">
                            <Button
                                type="text"
                                className="bi-action-btn bi-action-btn-payment"
                                icon={<DollarOutlined />}
                                onClick={() => {
                                    setSelectedInvoice(record);
                                    paymentForm.setFieldsValue({
                                        amount: null,
                                        payment_method: 'cash',
                                        payment_type: (record.balance || 0) >= (record.total_amount || 0) ? 'full' : 'partial',
                                        reference_number: '',
                                        account_name: '',
                                        account_number: ''
                                    });
                                    setPaymentMethod('cash');
                                    setPaymentModalVisible(true);
                                }}
                            />
                        </Tooltip>
                                           {canProcessRefunds && (
                            <Tooltip title="Direct Refund (no request required)">
                                <Button
                                    type="text"
                                    className="bi-action-btn"
                                    icon={<RollbackOutlined />}
                                    style={{ color: '#faad14' }}
                                    disabled={record.refund_status && !['rejected', 'cancelled'].includes(record.refund_status)}
                                    onClick={() => openRefundDirectModal(record)}
                                />
                            </Tooltip>
                        )}
                        <Dropdown
                            menu={{ items: actionItems }}
                            placement="bottomRight"
                            trigger={['click']}
                        >
                            <Button type="text" className="bi-action-btn" icon={<MoreOutlined />} />
                        </Dropdown>
                    </Space>
                );
            }
        }
    ], [isDarkMode, payments, discountForm, reminderForm, paymentForm, canApproveFinancialAdjustments, canProcessRefunds]);

    const paymentColumns = useMemo(() => [
        {
            title: 'PAYMENT #',
            dataIndex: 'payment_number',
            key: 'payment_number',
            width: 150,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 200,
            render: (text) => <Text className={isDarkMode ? 'bi-text-dark-primary' : ''}>{text || 'Unknown'}</Text>
        },
        {
            title: 'INVOICE',
            dataIndex: 'invoice_number',
            key: 'invoice_number',
            width: 130,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'METHOD',
            dataIndex: 'payment_method',
            key: 'payment_method',
            width: 120,
            render: (text) => (
                <span className="bi-method-tag">
                    {getPaymentMethodIcon(text)} {text?.replace('_', ' ').toUpperCase() || 'N/A'}
                </span>
            )
        },
        {
            title: 'TYPE',
            dataIndex: 'payment_type',
            key: 'payment_type',
            width: 100,
            render: (text) => <Text className="bi-plain-text">{text?.toUpperCase() || 'PARTIAL'}</Text>
        },
        {
            title: 'AMOUNT',
            dataIndex: 'amount',
            key: 'amount',
            width: 130,
            align: 'right',
            render: (v) => <Text strong className="bi-amount-paid">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'REFERENCE #',
            dataIndex: 'reference_number',
            key: 'reference_number',
            width: 150,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'DATE',
            dataIndex: 'date',
            key: 'date',
            width: 120,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            align: 'center',
            render: (s) => {
                const config = getStatusConfig(s);
                return (
                    <span className="bi-status-badge" style={{
                        color: config.color,
                        background: config.bg,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500
                    }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        {
            title: 'ACTION',
            key: 'action',
            width: 160,
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="View Receipt">
                        <Button type="text" className="bi-action-btn" icon={<EyeOutlined />} onClick={() => handleViewReceipt(record)} />
                    </Tooltip>
                    <Tooltip title="Print Receipt">
                        <Button type="text" className="bi-action-btn" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(record)} />
                    </Tooltip>
                    <Tooltip title="Download Receipt">
                        <Button type="text" className="bi-action-btn" icon={<DownloadOutlined />} onClick={() => handleDownloadReceipt(record)} />
                    </Tooltip>
                </Space>
            )
        }
    ], [isDarkMode]);

    const mobilePaymentColumns = useMemo(() => [
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 200,
            render: (text, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {record.customer_avatar ? (
                        <Avatar src={record.customer_avatar} size={36} />
                    ) : (
                        <Avatar icon={<UserOutlined />} size={36} style={{ backgroundColor: '#1a7ab5' }} />
                    )}
                    <div>
                        <div><Text className="bi-plain-text">{text || 'Unknown'}</Text></div>
                        <div style={{ fontSize: 11, color: '#8b93a8' }}>{record.customer_email || ''}</div>
                    </div>
                </div>
            )
        },
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 130,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'AMOUNT',
            dataIndex: 'amount',
            key: 'amount',
            width: 130,
            align: 'right',
            render: (v) => <Text strong className="bi-amount-total">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'METHOD',
            dataIndex: 'payment_method',
            key: 'payment_method',
            width: 120,
            render: (text) => (
                <span className="bi-method-tag">
                    {getPaymentMethodIcon(text)} {text?.toUpperCase() || 'N/A'}
                </span>
            )
        },
        {
            title: 'REFERENCE #',
            dataIndex: 'reference_number',
            key: 'reference_number',
            width: 150,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'ACCOUNT',
            key: 'account',
            width: 150,
            render: (_, record) => (
                <div>
                    <div style={{ fontSize: 12 }}>{record.account_name || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#8b93a8' }}>{record.account_number || ''}</div>
                </div>
            )
        },
        {
            title: 'DATE',
            dataIndex: 'date',
            key: 'date',
            width: 120,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            align: 'center',
            render: (s) => {
                const config = getStatusConfig(s);
                return (
                    <span className="bi-status-badge" style={{
                        color: config.color,
                        background: config.bg,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500
                    }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 200,
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="View Payment Details">
                        <Button type="text" className="bi-action-btn" icon={<EyeOutlined />} onClick={() => handleViewReceipt(record)} />
                    </Tooltip>
                    {canApproveFinancialAdjustments && record.status === 'pending' && (
                        <>
                            <Tooltip title="Verify Payment">
                                <Button type="primary" size="small" className="bi-verify-btn" icon={<CheckCircleOutlined />} onClick={() => handleVerifyMobilePayment(record)}>
                                    Verify
                                </Button>
                            </Tooltip>
                            <Tooltip title="Reject Payment">
                                <Button danger size="small" className="bi-reject-btn" icon={<CloseCircleOutlined />} onClick={() => handleRejectMobilePayment(record)}>
                                    Reject
                                </Button>
                            </Tooltip>
                        </>
                    )}
                    {record.status === 'completed' && (
                        <Tooltip title="Print Receipt">
                            <Button type="text" className="bi-action-btn" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(record)} />
                        </Tooltip>
                    )}
                    {record.status === 'failed' && (
                        <Tooltip title="Rejected">
                            <Tag color="red">Rejected</Tag>
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ], [canApproveFinancialAdjustments]);

    const debtColumns = useMemo(() => [
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 200,
            render: (text, record) => (
                <div>
                    <Text className="bi-plain-text">{text || 'Unknown'}</Text>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Invoice: {record.invoice_number || 'N/A'}</Text>
                </div>
            )
        },
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 130,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'TOTAL DEBT',
            dataIndex: 'total_debt',
            key: 'total_debt',
            width: 140,
            align: 'right',
            render: (v) => <Text strong className="bi-amount-total">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'TOTAL PAID',
            dataIndex: 'total_paid',
            key: 'total_paid',
            width: 140,
            align: 'right',
            render: (v) => <Text className="bi-amount-paid">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'BALANCE',
            dataIndex: 'remaining_debt',
            key: 'remaining_debt',
            width: 140,
            align: 'right',
            render: (v) => (
                <Text strong className={Number(v || 0) > 0 ? 'bi-amount-balance' : 'bi-amount-paid'}>
                    ₱{Number(v || 0).toLocaleString()}
                </Text>
            )
        },
        {
            title: 'PROGRESS',
            dataIndex: 'payment_progress',
            key: 'payment_progress',
            width: 170,
            render: (v) => <Progress percent={Number(v || 0)} size="small" strokeColor="#1a7ab5" />
        },
        {
            title: 'PAYMENT LOGS',
            dataIndex: 'payment_history',
            key: 'payment_history',
            width: 120,
            align: 'center',
            render: (logs) => <Badge count={Array.isArray(logs) ? logs.length : 0} showZero style={{ backgroundColor: '#1a7ab5' }} />
        },
        {
            title: 'NEXT PAYMENT',
            dataIndex: 'next_payment',
            key: 'next_payment',
            width: 130,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'
        },
        {
            title: 'DUE DATE',
            dataIndex: 'due_date',
            key: 'due_date',
            width: 120,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'
        },
        {
            title: 'DAYS OVERDUE',
            dataIndex: 'days_overdue',
            key: 'days_overdue',
            width: 110,
            align: 'center',
            render: (v) => (v || 0) > 0 ?
                <Tag color="red" className="bi-overdue-tag">{v} days</Tag> :
                <Tag color="green" className="bi-ontime-tag">On Time</Tag>
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            align: 'center',
            render: (s) => {
                const config = getStatusConfig(s);
                return (
                    <span className="bi-status-badge" style={{
                        color: config.color,
                        background: config.bg,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500
                    }}>
                        {config.icon} {config.text}
                    </span>
                );
            }
        },
        {
            title: 'DEPOSIT',
            key: 'deposit',
            width: 150,
            render: (_, record) => (
                <div>
                    {record.is_deposit_paid ?
                        <Tag color="green" className="bi-deposit-paid">Paid</Tag> :
                        <Tag color="red" className="bi-deposit-unpaid">Unpaid</Tag>
                    }
                    <div style={{ fontSize: 11, color: '#8b93a8' }}>
                        ₱{Number(record.deposit_paid || 0).toLocaleString()} / ₱{Number(record.total_amount * 0.3 || 0).toLocaleString()}
                    </div>
                </div>
            )
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 150,
            fixed: 'right',
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="View Debt Details">
                        <Button
                            type="text"
                            className="bi-action-btn"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewInvoice(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Record Payment">
                        <Button
                            type="text"
                            className="bi-action-btn bi-action-btn-payment"
                            icon={<DollarOutlined />}
                            onClick={() => {
                                setSelectedInvoice(record);
                                paymentForm.setFieldsValue({
                                    amount: null,
                                    payment_method: 'cash',
                                    payment_type: 'partial',
                                    reference_number: '',
                                    account_name: '',
                                    account_number: '',
                                });
                                setPaymentMethod('cash');
                                setPaymentModalVisible(true);
                            }}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ], []);

    const pdfOverviewColumns = useMemo(() => [
        {
            title: 'BOOKING #',
            dataIndex: 'booking_no',
            key: 'booking_no',
            width: 150,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'CUSTOMER',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 200,
            render: (text, record) => (
                <div>
                    <Text strong className={isDarkMode ? 'bi-text-dark-primary' : ''}>{text || 'Unknown'}</Text>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        {record.customer?.person?.email || record.customer_email || ''}
                    </Text>
                </div>
            )
        },
        {
            title: 'EVENT',
            dataIndex: 'event_type',
            key: 'event_type',
            width: 130,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>
        },
        {
            title: 'EVENT DATE',
            dataIndex: 'event_date',
            key: 'event_date',
            width: 130,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'
        },
        {
            title: 'TOTAL AMOUNT',
            dataIndex: 'total_amount',
            key: 'total_amount',
            width: 140,
            align: 'right',
            render: (v) => <Text strong className="bi-amount-total">₱{Number(v || 0).toLocaleString()}</Text>
        },
        {
            title: 'STATUS',
            dataIndex: 'booking_status',
            key: 'booking_status',
            width: 120,
            align: 'center',
            render: (s) => {
                const config = getStatusConfig(s === 'confirmed' ? 'paid' : s === 'pending' ? 'pending' : 'unpaid');
                return (
                    <span className="bi-status-badge" style={{
                        color: config.color,
                        background: config.bg,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500
                    }}>
                        {config.icon} {(s || 'N/A').toUpperCase()}
                    </span>
                );
            }
        },
        {
            title: 'ACTION',
            key: 'action',
            width: 120,
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    icon={<FilePdfOutlined />}
                    onClick={() => handlePDFOverviewSelectBooking(record.booking_id)}
                    loading={pdfOverviewLoading && pdfOverviewBooking?.booking_id === record.booking_id}
                    className="bi-pdf-select-btn"
                >
                    View PDF
                </Button>
            )
        }
    ], [isDarkMode, pdfOverviewLoading, pdfOverviewBooking]);

    const refundColumns = useMemo(() => [
        {
            title: 'REFUND #',
            dataIndex: 'refund_number',
            key: 'refund_number',
            width: 150,
            render: (text) => <Text className="bi-plain-text">{text || 'N/A'}</Text>,
        },
        {
            title: 'BOOKING / INVOICE',
            key: 'booking_invoice',
            width: 180,
            render: (_, record) => (
                <div>
                    <div><Text strong>{record.booking?.booking_no || record.invoice?.booking?.booking_no || 'N/A'}</Text></div>
                    <div style={{ fontSize: 11, color: '#8b93a8' }}>
                        {record.invoice?.invoice_number || 'No invoice'}
                    </div>
                </div>
            ),
        },
        {
            title: 'CUSTOMER',
            key: 'customer',
            width: 200,
            render: (_, record) => {
                const person = record.booking?.serviceEvent?.customer?.person
                    || record.invoice?.booking?.serviceEvent?.customer?.person;
                return (
                    <div>
                        <div>{person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown' : 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: '#8b93a8' }}>{person?.email || ''}</div>
                    </div>
                );
            },
        },
        {
            title: 'AMOUNT',
            dataIndex: 'amount',
            key: 'amount',
            width: 130,
            align: 'right',
            render: (v) => <Text strong className="bi-amount-total">₱{Number(v || 0).toLocaleString()}</Text>,
        },
        {
            title: 'DEPOSIT SNAPSHOT',
            dataIndex: 'deposit_snapshot',
            key: 'deposit_snapshot',
            width: 140,
            align: 'right',
            render: (v) => <Text className="bi-plain-text">₱{Number(v || 0).toLocaleString()}</Text>,
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            align: 'center',
            render: (s) => {
                const config = getRefundStatusConfig(s);
                return (
                    <span className="bi-status-badge" style={{
                        color: config.color,
                        background: config.bg,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        {config.icon} {config.text}
                    </span>
                );
            },
        },
        {
            title: 'REQUESTED',
            dataIndex: 'requested_at',
            key: 'requested_at',
            width: 150,
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : 'N/A',
        },
        {
            title: 'REASON',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true,
            render: (text) => <Text className="bi-plain-text">{text || '—'}</Text>,
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 240,
            fixed: 'right',
            render: (_, record) => {
                const isPending = record.status === 'pending';
                const isApproved = record.status === 'approved';
                const isReleased = record.status === 'released';

                return (
                    <Space size={4}>
                        <Tooltip title="View Details">
                            <Button
                                type="text"
                                className="bi-action-btn"
                                icon={<EyeOutlined />}
                                onClick={() => openRefundDetailsModal(record)}
                            />
                        </Tooltip>

                        {isPending && canProcessRefunds && (
                            <>
                                <Tooltip title="Approve Refund">
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<CheckCircleOutlined />}
                                        onClick={() => openRefundApprovalModal(record)}
                                    >
                                        Approve
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Reject Refund">
                                    <Button
                                        danger
                                        size="small"
                                        icon={<CloseCircleOutlined />}
                                        onClick={() => openRefundRejectModal(record)}
                                    >
                                        Reject
                                    </Button>
                                </Tooltip>
                            </>
                        )}

                        {isApproved && canProcessRefunds && (
                            <Tooltip title="Release Refund">
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<RollbackOutlined />}
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                    onClick={() => openRefundReleaseModal(record)}
                                >
                                    Release
                                </Button>
                            </Tooltip>
                        )}

                        {isReleased && (
                            <Tag color="green">✓ Released</Tag>
                        )}
                    </Space>
                );
            },
        },
    ], [canProcessRefunds]);

    // ==================== RENDER FUNCTIONS ====================
    const renderEmptyTable = () => (
        <div className="bi-empty-state">
            <InboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
            <div style={{ marginTop: 16, color: '#8b93a8' }}>No data available</div>
            <div style={{ fontSize: 12, color: '#bfbfbf' }}>All records will appear here</div>
        </div>
    );

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    // ===== SKELETON LOADING STATE =====
    // Only on the very first mount after a hard page load.
    if (showSkeleton) {
        return <BillingSkeleton isDarkMode={isDarkMode} activeTab={activeMainTab} />;
    }

    const containerClass = `bi-billing-container ${isDarkMode ? 'bi-dark-mode' : ''}`;
    const headerClass = `bi-header ${isDarkMode ? 'bi-header-dark' : ''}`;
    const dateDisplayClass = `bi-date-display ${isDarkMode ? 'bi-date-display-dark' : ''}`;
    const mainCardClass = `bi-main-card ${isDarkMode ? 'bi-main-card-dark' : ''}`;
    const filtersClass = `bi-filters ${isDarkMode ? 'bi-filters-dark' : ''}`;
    const filterGroupClass = `bi-filter-group ${isDarkMode ? 'bi-filter-group-dark' : ''}`;
    const tableClass = `bi-table ${isDarkMode ? 'bi-table-dark' : ''}`;
    const kpiCardClass = `bi-kpi-card ${isDarkMode ? 'bi-kpi-card-dark' : ''}`;
    const modalClass = `bi-modal ${isDarkMode ? 'bi-modal-dark' : ''}`;
    const tabContentClass = `bi-tab-content ${isDarkMode ? 'bi-tab-content-dark' : ''}`;
    const debtCardClass = `bi-debt-card ${isDarkMode ? 'bi-debt-card-dark' : ''}`;

    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    colorBgContainer: isDarkMode ? '#13172b' : '#ffffff',
                    colorBorderSecondary: isDarkMode ? '#1e2340' : '#e8edf2',
                    colorText: isDarkMode ? '#e2e8f0' : '#1e293b',
                    colorTextSecondary: isDarkMode ? '#8b93a8' : '#64748b',
                },
                components: {
                    Table: {
                        headerBg: isDarkMode ? '#0a0e1a' : '#f8fafc',
                        headerColor: isDarkMode ? '#cbd5e1' : '#1e293b',
                    },
                    Card: { borderRadiusLG: 16 },
                    Modal: { borderRadiusLG: 20 },
                    Button: { borderRadius: 10 },
                    Input: { borderRadius: 10 },
                    Select: { borderRadius: 10 },
                }
            }}
        >
            <div className={containerClass}>
                {/* HEADER */}
                <div className={headerClass}>
                    <div className="bi-header-left">
                        <div className="bi-logo-icon"><DollarOutlined /></div>
                        <div className="bi-header-info">
                            <h1>Billing & Invoicing</h1>
                            <span>Financial Management Dashboard</span>
                        </div>
                    </div>
                                       <div className="bi-header-right">
                        <div className={dateDisplayClass}>
                            <CalendarOutlined />
                            <span>{formattedDate}</span>
                        </div>

                        {/* ⭐ Hide/unhide the Period Behavior toolbar */}
                        <Tooltip title={periodToolbarHidden ? 'Show Period selector' : 'Hide Period selector'}>
                            <button
                                type="button"
                                className={`bi-period-toggle-btn ${periodToolbarHidden ? 'is-hidden' : ''}`}
                                onClick={handleTogglePeriodToolbar}
                                aria-pressed={periodToolbarHidden}
                            >
                                {periodToolbarHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            </button>
                        </Tooltip>

                        <Divider type="vertical" />
                        <Button icon={<ReloadOutlined />} onClick={loadInvoices}>Refresh</Button>
                        <Button icon={<ExportOutlined />} onClick={() => {
                            if (activeMainTab === 'refunds' && canProcessRefunds) {
                                exportRefunds();
                            } else {
                                exportInvoices();
                            }
                        }}>Export</Button>
                        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="bi-main-content">
                                      {/* ⭐ Period Behavior toolbar */}
                    {!periodToolbarHidden && (
                    <div className="bi-period-bar">
                        <div className="bi-period-bar-left">
                            <span className="bi-period-bar-label">Reporting Period</span>
                            <div className="bi-period-segmented" role="tablist">
                                {[
                                    { value: 'weekly',  label: 'Weekly'  },
                                    { value: 'monthly', label: 'Monthly' },
                                    { value: 'yearly',  label: 'Yearly'  },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`bi-period-seg-btn ${dashboardPeriod === opt.value ? 'active' : ''}`}
                                        onClick={() => setDashboardPeriod(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bi-period-bar-right">
                            <button type="button" className="bi-period-arrow-btn" onClick={() => handleShiftPeriod('prev')}>
                                <LeftOutlined />
                            </button>
                            <span className="bi-period-range-text">{periodRange.label}</span>
                            <button type="button" className="bi-period-arrow-btn" onClick={() => handleShiftPeriod('next')}>
                                <RightOutlined />
                            </button>
                            <button type="button" className="bi-period-today-btn" onClick={handleJumpToToday}>
                                Today
                            </button>
                        </div>
                    </div>
                    )}

                    {/* KPI Cards */}
                    <div className={`bi-kpi-grid ${canProcessRefunds ? '' : 'bi-kpi-grid-4'}`}>
                        <Tooltip title={!canProcessRefunds ? 'Only administrators can hide this value' : (effectiveBillingVisibility.total_revenue ? 'Unhide value' : 'Hide value')}>
                            <div className={`${kpiCardClass} bi-kpi-card-hideable`}>
                                {canProcessRefunds && (
                                    <button type="button" className="bi-kpi-hide-btn" onClick={() => handleToggleBillingVisibility('total_revenue')}>
                                        {effectiveBillingVisibility.total_revenue ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    </button>
                                )}
                                <div className="bi-kpi-icon blue"><FileTextOutlined /></div>
                                <div>
                                    <div className="bi-kpi-value">
                                        {effectiveBillingVisibility.total_revenue
                                            ? maskMatchingValue(`₱${Number(totalRevenue).toLocaleString()}`)
                                            : `₱${Number(totalRevenue).toLocaleString()}`}
                                    </div>
                                    <div className="bi-kpi-label">Total Revenue</div>
                                </div>
                            </div>
                        </Tooltip>

                        <Tooltip title={!canProcessRefunds ? 'Only administrators can hide this value' : (effectiveBillingVisibility.total_collected ? 'Unhide value' : 'Hide value')}>
                            <div className={`${kpiCardClass} bi-kpi-card-hideable`}>
                                {canProcessRefunds && (
                                    <button type="button" className="bi-kpi-hide-btn" onClick={() => handleToggleBillingVisibility('total_collected')}>
                                        {effectiveBillingVisibility.total_collected ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    </button>
                                )}
                                <div className="bi-kpi-icon green"><CheckCircleOutlined /></div>
                                <div>
                                    <div className="bi-kpi-value">
                                        {effectiveBillingVisibility.total_collected
                                            ? maskMatchingValue(`₱${Number(totalPaid).toLocaleString()}`)
                                            : `₱${Number(totalPaid).toLocaleString()}`}
                                    </div>
                                    <div className="bi-kpi-label">Total Collected</div>
                                </div>
                            </div>
                        </Tooltip>

                        <Tooltip title={!canProcessRefunds ? 'Only administrators can hide this value' : (effectiveBillingVisibility.outstanding_balance ? 'Unhide value' : 'Hide value')}>
                            <div className={`${kpiCardClass} bi-kpi-card-hideable`}>
                                {canProcessRefunds && (
                                    <button type="button" className="bi-kpi-hide-btn" onClick={() => handleToggleBillingVisibility('outstanding_balance')}>
                                        {effectiveBillingVisibility.outstanding_balance ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    </button>
                                )}
                                <div className="bi-kpi-icon orange"><WarningOutlined /></div>
                                <div>
                                    <div className="bi-kpi-value">
                                        {effectiveBillingVisibility.outstanding_balance
                                            ? maskMatchingValue(`₱${Number(totalOutstanding).toLocaleString()}`)
                                            : `₱${Number(totalOutstanding).toLocaleString()}`}
                                    </div>
                                    <div className="bi-kpi-label">Outstanding Balance</div>
                                </div>
                            </div>
                        </Tooltip>

                        <div className={kpiCardClass}>
                            <div className="bi-kpi-icon red"><ClockCircleOutlined /></div>
                            <div>
                                <div className="bi-kpi-value">{overdueCount}</div>
                                <div className="bi-kpi-label">Overdue Invoices</div>
                            </div>
                        </div>

                        {canProcessRefunds && (
                            <Tooltip title={effectiveBillingVisibility.total_refunds ? 'Unhide value' : 'Hide value'}>
                                <div className={`${kpiCardClass} bi-kpi-card-hideable`}>
                                    <button type="button" className="bi-kpi-hide-btn" onClick={() => handleToggleBillingVisibility('total_refunds')}>
                                        {effectiveBillingVisibility.total_refunds ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    </button>
                                    <div className="bi-kpi-icon purple"><RollbackOutlined /></div>
                                    <div>
                                        <div className="bi-kpi-value">
                                            {effectiveBillingVisibility.total_refunds
                                                ? maskMatchingValue(String(refundStatistics.total_refunds || 0))
                                                : (refundStatistics.total_refunds || 0)}
                                        </div>
                                        <div className="bi-kpi-label">Total Refunds</div>
                                    </div>
                                </div>
                            </Tooltip>
                        )}
                    </div>

                    {/* Main Card */}
                    <Card className={mainCardClass} variant="borderless">
                        <Tabs activeKey={activeMainTab} onChange={setActiveMainTab} className="bi-tabs">
                            {/* Invoices Tab */}
                            <TabPane tab={<span><FileTextOutlined /> Invoices</span>} key="invoices">
                                <div className={filtersClass}>
                                    <div className={filterGroupClass}>
                                        <FilterOutlined />
                                        <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 140 }} size="small" placeholder="Status">
                                            <Option value="all">All Status</Option>
                                            <Option value="paid">Paid</Option>
                                            <Option value="partial">Partial</Option>
                                            <Option value="unpaid">Unpaid</Option>
                                            <Option value="overdue">Overdue</Option>
                                        </Select>
                                    </div>
                                    <div className={filterGroupClass}>
                                        <CalendarOutlined />
                                        <RangePicker size="small" onChange={setFilterDate} placeholder={['Start Date', 'End Date']} format="YYYY-MM-DD" />
                                    </div>
                                    <div className="bi-search-wrapper">
                                        <SearchOutlined style={{ color: 'var(--bi-muted)', fontSize: '14px' }} />
                                        <Input
                                            placeholder="Search by customer or invoice #..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            allowClear
                                            size="small"
                                            style={{ border: 'none', boxShadow: 'none', padding: '4px 0', background: 'transparent', width: 280 }}
                                        />
                                    </div>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateInvoice}>
                                        Create Invoice
                                    </Button>
                                </div>

                                <div className="bi-table-scroll-container">
                                                               <Table
                                        columns={invoiceColumns}
                                        dataSource={filteredInvoices}
                                        rowKey="invoice_id"
                                        locale={{ emptyText: renderEmptyTable() }}
                                        pagination={false}
                                        className={tableClass}
                                        scroll={{ x: canProcessRefunds ? 1550 : 1450, y: 'calc(100vh - 480px)' }}
                                    />
                                </div>
                            </TabPane>

                            {/* Payments Tab */}
                            <TabPane tab={<span><CreditCardOutlined /> Payment Tracking</span>} key="payments">
                                <div className={tabContentClass}>
                                    <Alert
                                        message="Payment Tracking"
                                        description="Every down payment, partial payment, installment, pending verification, and completed payment log appears here."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 20 }}
                                        className={isDarkMode ? 'bi-alert-dark' : ''}
                                    />
                                    <div className={filtersClass} style={{ marginBottom: 16 }}>
                                        <div className={filterGroupClass}>
                                            <CalendarOutlined />
                                            <RangePicker
                                                value={paymentTrackingDateRange}
                                                onChange={(value) => setPaymentTrackingDateRange(value || [])}
                                                showTime={{ format: 'HH:mm' }}
                                                format="YYYY-MM-DD HH:mm"
                                                placeholder={['Start Date & Time', 'End Date & Time']}
                                                size="small"
                                            />
                                        </div>
                                        <Button
                                            size="small"
                                            onClick={() => setPaymentTrackingDateRange([])}
                                            disabled={!paymentTrackingDateRange?.length}
                                        >
                                            Clear Date Filter
                                        </Button>
                                    </div>
                                    <div className="bi-table-scroll-container">
                                        <Table
                                            columns={paymentColumns}
                                            dataSource={payments}
                                            rowKey="payment_id"
                                            locale={{ emptyText: renderEmptyTable() }}
                                            pagination={false}
                                            className={tableClass}
                                            scroll={{ x: 1200, y: 'calc(100vh - 480px)' }}
                                        />
                                    </div>
                                </div>
                            </TabPane>

                            {/* Payment History Tab */}
                            <TabPane tab={<span><CheckCircleOutlined /> Payment History</span>} key="payment_history">
                                <div className={tabContentClass}>
                                    <Alert
                                        message="Payment History"
                                        description="Only invoices with zero remaining balance and Paid status appear here. Partial payments remain in Payment Tracking."
                                        type="success"
                                        showIcon
                                        style={{ marginBottom: 20 }}
                                        className={isDarkMode ? 'bi-alert-dark' : ''}
                                    />
                                    <div className={filtersClass} style={{ marginBottom: 16 }}>
                                        <div className="bi-search-wrapper">
                                            <SearchOutlined style={{ color: 'var(--bi-muted)', fontSize: '14px' }} />
                                            <Input
                                                placeholder="Search history..."
                                                value={paymentHistorySearch}
                                                onChange={(e) => setPaymentHistorySearch(e.target.value)}
                                                allowClear
                                                size="small"
                                                style={{ border: 'none', boxShadow: 'none', padding: '4px 0', background: 'transparent', width: 200 }}
                                            />
                                        </div>
                                        <div className="bi-search-wrapper">
                                            <UserOutlined style={{ color: 'var(--bi-muted)', fontSize: '14px' }} />
                                            <Input
                                                placeholder="Customer"
                                                value={paymentHistoryCustomer}
                                                onChange={(e) => setPaymentHistoryCustomer(e.target.value)}
                                                allowClear
                                                size="small"
                                                style={{ border: 'none', boxShadow: 'none', padding: '4px 0', background: 'transparent', width: 180 }}
                                            />
                                        </div>
                                        <div className="bi-search-wrapper">
                                            <FileTextOutlined style={{ color: 'var(--bi-muted)', fontSize: '14px' }} />
                                            <Input
                                                placeholder="Invoice Number"
                                                value={paymentHistoryInvoice}
                                                onChange={(e) => setPaymentHistoryInvoice(e.target.value)}
                                                allowClear
                                                size="small"
                                                style={{ border: 'none', boxShadow: 'none', padding: '4px 0', background: 'transparent', width: 180 }}
                                            />
                                        </div>
                                        <div className={filterGroupClass}>
                                            <CreditCardOutlined />
                                            <Select value={paymentHistoryMethod} onChange={setPaymentHistoryMethod} size="small" style={{ width: 170 }}>
                                                <Option value="all">All Methods</Option>
                                                <Option value="cash">Cash</Option>
                                                <Option value="bank_transfer">Bank Transfer</Option>
                                                <Option value="gcash">GCash</Option>
                                                <Option value="maya">Maya</Option>
                                                <Option value="card">Card</Option>
                                            </Select>
                                        </div>
                                        <div className={filterGroupClass}>
                                            <CalendarOutlined />
                                            <RangePicker
                                                value={paymentHistoryDateRange}
                                                onChange={(value) => setPaymentHistoryDateRange(value || [])}
                                                size="small"
                                            />
                                        </div>
                                    </div>
                                    <div className="bi-table-scroll-container">
                                        <Table
                                            columns={paymentColumns}
                                            dataSource={filteredPaymentHistory}
                                            rowKey="invoice_id"
                                            locale={{ emptyText: renderEmptyTable() }}
                                            pagination={false}
                                            className={tableClass}
                                            scroll={{ x: 1200, y: 'calc(100vh - 550px)' }}
                                        />
                                    </div>
                                </div>
                            </TabPane>

                            {/* Mobile Payments Tab */}
                            <TabPane tab={<span><MobileOutlined /> Mobile Payments</span>} key="mobile">
                                <div className={tabContentClass}>
                                    <Alert
                                        message="Mobile Payment Verification"
                                        description="Track and verify mobile payments (GCash, Maya, Bank Transfer, Card). Customer proof of payment can be viewed."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 20 }}
                                        className={isDarkMode ? 'bi-alert-dark' : ''}
                                    />
                                    <div className="bi-table-scroll-container">
                                        <Table
                                            columns={mobilePaymentColumns}
                                            dataSource={mobilePayments}
                                            rowKey="payment_id"
                                            locale={{ emptyText: renderEmptyTable() }}
                                            pagination={false}
                                            className={tableClass}
                                            scroll={{ x: 1300, y: 'calc(100vh - 480px)' }}
                                        />
                                    </div>
                                </div>
                            </TabPane>

                            {/* Debt Management Tab */}
                            <TabPane tab={<span><WarningOutlined /> Debt Management</span>} key="debts">
                                <div className={tabContentClass}>
                                    <Alert
                                        message="Outstanding Debts"
                                        description="Monitor customer debts, overdue payments, and deposit status. All invoices with balance are shown here."
                                        type="warning"
                                        showIcon
                                        style={{ marginBottom: 20 }}
                                        className={isDarkMode ? 'bi-alert-dark' : ''}
                                    />
                                    <div className="bi-debt-summary">
                                        <Row gutter={16} style={{ marginBottom: 20 }}>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Total Outstanding Debt</Text>
                                                    <div className="bi-debt-value">₱{Number(totalDebt).toLocaleString()}</div>
                                                </div>
                                            </Col>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Overdue Debt</Text>
                                                    <div className="bi-debt-value">₱{Number(overdueDebt).toLocaleString()}</div>
                                                </div>
                                            </Col>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Collection Rate</Text>
                                                    <div className="bi-debt-value">{collectionRate}%</div>
                                                </div>
                                            </Col>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Overdue Count</Text>
                                                    <div className="bi-debt-value">{overdueCount}</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>
                                    <div className="bi-table-scroll-container">
                                        <Table
                                            columns={debtColumns}
                                            dataSource={debts}
                                            rowKey="invoice_id"
                                            locale={{ emptyText: renderEmptyTable() }}
                                            pagination={false}
                                            className={tableClass}
                                            scroll={{ x: 1600, y: 'calc(100vh - 530px)' }}
                                        />
                                    </div>
                                </div>
                            </TabPane>

                            {/* Refunds Tab — ADMIN & SUPER-ADMIN ONLY */}
                            {canProcessRefunds && (
                                <TabPane
                                    tab={
                                        <span>
                                            <RollbackOutlined /> Refunds
                                            {refundStatistics.pending > 0 && (
                                                <Badge count={refundStatistics.pending} style={{ marginLeft: 6, backgroundColor: '#faad14' }} />
                                            )}
                                        </span>
                                    }
                                    key="refunds"
                                >
                                    <div className={tabContentClass}>
                                        <Alert
                                            message="Refund Management"
                                            description="Track all refund requests, approvals, and releases. Refunds are now processed through invoices instead of bookings."
                                            type="warning"
                                            showIcon
                                            style={{ marginBottom: 20 }}
                                            className={isDarkMode ? 'bi-alert-dark' : ''}
                                        />

                                        {/* Refund Summary Cards */}
                                        <Row gutter={16} style={{ marginBottom: 20 }}>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Pending Refunds</Text>
                                                    <div className="bi-debt-value" style={{ color: '#faad14' }}>
                                                        {refundStatistics.pending || 0}
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Approved (Awaiting Release)</Text>
                                                    <div className="bi-debt-value" style={{ color: '#1890ff' }}>
                                                        {refundStatistics.approved || 0}
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Released</Text>
                                                    <div className="bi-debt-value" style={{ color: '#52c41a' }}>
                                                        {refundStatistics.released || 0}
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col xs={12} sm={6}>
                                                <div className={debtCardClass}>
                                                    <Text type="secondary">Total Refunded</Text>
                                                    <div className="bi-debt-value" style={{ color: '#52c41a' }}>
                                                        ₱{Number(refundStatistics.total_released_amount || 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            </Col>
                                        </Row>

                                        {/* Refund Filters */}
                                        <div className={filtersClass} style={{ marginBottom: 16 }}>
                                            <div className="bi-search-wrapper">
                                                <SearchOutlined style={{ color: 'var(--bi-muted)', fontSize: '14px' }} />
                                                <Input
                                                    placeholder="Search refunds..."
                                                    value={refundHistorySearch}
                                                    onChange={(e) => setRefundHistorySearch(e.target.value)}
                                                    allowClear
                                                    size="small"
                                                    style={{ border: 'none', boxShadow: 'none', padding: '4px 0', background: 'transparent', width: 200 }}
                                                />
                                            </div>
                                            <div className={filterGroupClass}>
                                                <FilterOutlined />
                                                <Select value={refundHistoryStatus} onChange={setRefundHistoryStatus} size="small" style={{ width: 140 }}>
                                                    <Option value="all">All Status</Option>
                                                    <Option value="pending">Pending</Option>
                                                    <Option value="approved">Approved</Option>
                                                    <Option value="released">Released</Option>
                                                    <Option value="rejected">Rejected</Option>
                                                </Select>
                                            </div>
                                            <div className={filterGroupClass}>
                                                <CalendarOutlined />
                                                <RangePicker
                                                    value={refundHistoryDateRange}
                                                    onChange={(v) => setRefundHistoryDateRange(v || [])}
                                                    size="small"
                                                />
                                            </div>
                                        </div>

                                        {/* Refunds Table */}
                                        <div className="bi-table-scroll-container">
                                                                                <Table
                                                columns={refundColumns}
                                                dataSource={filteredRefunds}
                                                rowKey="refund_id"
                                                locale={{ emptyText: renderEmptyTable() }}
                                                pagination={false}
                                                className={tableClass}
                                                scroll={{ x: 1400, y: 'calc(100vh - 620px)' }}
                                            />
                                        </div>
                                    </div>
                                </TabPane>
                            )}

                            {/* PDF Overview Tab */}
                            <TabPane tab={<span><FileSearchOutlined /> PDF Overview</span>} key="pdf_overview">
                                <div className={tabContentClass}>
                                    <Alert
                                        message="Booking PDF Overview"
                                        description="Select a booking to view and download its complete PDF document with all details."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 20 }}
                                        className={isDarkMode ? 'bi-alert-dark' : ''}
                                    />

                                    <div className={filtersClass} style={{ marginBottom: 16 }}>
                                        <div className="bi-search-wrapper" style={{ flex: 1, maxWidth: 400 }}>
                                            <SearchOutlined style={{ color: 'var(--bi-muted)', fontSize: '14px' }} />
                                            <Input
                                                placeholder="Search by booking # or customer..."
                                                value={pdfOverviewSearch}
                                                onChange={(e) => setPdfOverviewSearch(e.target.value)}
                                                allowClear
                                                size="small"
                                                style={{ border: 'none', boxShadow: 'none', padding: '4px 0', background: 'transparent', width: '100%' }}
                                            />
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Total: {filteredPDFBookings.length} bookings
                                        </Text>
                                    </div>

                                    <div className="bi-table-scroll-container">
                                                                  <Table
                                            columns={pdfOverviewColumns}
                                            dataSource={filteredPDFBookings}
                                            rowKey="booking_id"
                                            loading={pdfOverviewLoading}
                                            locale={{ emptyText: renderEmptyTable() }}
                                            pagination={false}
                                            className={tableClass}
                                            scroll={{ x: 900, y: 'calc(100vh - 480px)' }}
                                        />
                                    </div>

                                    {/* PDF Preview Section */}
                                    {pdfOverviewHtml && pdfOverviewBooking && (
                                        <div style={{ marginTop: 24 }}>
                                            <Divider>
                                                <Space>
                                                    <FilePdfOutlined style={{ color: '#ff4d4f' }} />
                                                    <Text strong>PDF Preview - {pdfOverviewBooking.booking_no || 'Booking'}</Text>
                                                </Space>
                                            </Divider>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 16px',
                                                background: isDarkMode ? '#1a1a2e' : '#f8fafc',
                                                borderRadius: '10px',
                                                marginBottom: 12,
                                                flexWrap: 'wrap',
                                                gap: 8
                                            }}>
                                                <div>
                                                    <Text type="secondary">Booking: </Text>
                                                    <Text strong>{pdfOverviewBooking.booking_no}</Text>
                                                    <Text type="secondary" style={{ marginLeft: 16 }}>Customer: </Text>
                                                    <Text strong>{pdfOverviewBooking.customer_name || 'Unknown'}</Text>
                                                </div>
                                                <Space>
                                                    <Button
                                                        icon={<ZoomOutOutlined />}
                                                        onClick={() => setPdfOverviewZoom(Math.max(50, pdfOverviewZoom - 10))}
                                                        size="small"
                                                    />
                                                    <span style={{ fontSize: 12, minWidth: 50, textAlign: 'center' }}>{pdfOverviewZoom}%</span>
                                                    <Button
                                                        icon={<ZoomInOutlined />}
                                                        onClick={() => setPdfOverviewZoom(Math.min(200, pdfOverviewZoom + 10))}
                                                        size="small"
                                                    />
                                                    <Button
                                                        icon={<FullscreenOutlined />}
                                                        onClick={() => setPdfOverviewZoom(100)}
                                                        size="small"
                                                    >
                                                        Fit
                                                    </Button>
                                                    <Button
                                                        type="primary"
                                                        icon={<PrinterOutlined />}
                                                        onClick={handlePrintPDFOverview}
                                                        size="small"
                                                    >
                                                        Print
                                                    </Button>
                                                    <Button
                                                        icon={<DownloadOutlined />}
                                                        onClick={handleDownloadPDFOverview}
                                                        size="small"
                                                    >
                                                        Download
                                                    </Button>
                                                </Space>
                                            </div>
                                            <div style={{
                                                background: '#ffffff',
                                                borderRadius: '12px',
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                                padding: '20px',
                                                maxHeight: '80vh',
                                                overflow: 'auto',
                                                display: 'flex',
                                                justifyContent: 'center'
                                            }}>
                                                <div style={{
                                                    transform: `scale(${pdfOverviewZoom / 100})`,
                                                    transformOrigin: 'top center',
                                                    transition: 'transform 0.2s ease',
                                                    maxWidth: '210mm',
                                                    width: '100%'
                                                }}>
                                                    <div dangerouslySetInnerHTML={{ __html: pdfOverviewHtml }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabPane>
                        </Tabs>
                    </Card>
                </div>

                {/* ==================== ENHANCED INVOICE DETAILS MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced">
                            <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #1a7ab5, #1565a0)' }}>
                                <FileTextOutlined />
                            </div>
                            <div className="bi-modal-title-group">
                                <span className="bi-modal-title">Invoice Details</span>
                                <span className="bi-modal-subtitle">Complete invoice information</span>
                            </div>
                            <div className="bi-modal-badge-group">
                                <span className="bi-modal-badge">{selectedInvoice?.invoice_number || 'N/A'}</span>
                                {selectedInvoice?.status && (
                                    <span className="bi-status-badge" style={{
                                        color: getStatusConfig(selectedInvoice.status).color,
                                        background: getStatusConfig(selectedInvoice.status).bg,
                                        padding: '4px 14px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {getStatusConfig(selectedInvoice.status).icon} {getStatusConfig(selectedInvoice.status).text}
                                    </span>
                                )}
                            </div>
                        </div>
                    }
                    open={invoiceDetailsModalVisible}
                    onCancel={() => setInvoiceDetailsModalVisible(false)}
                    width={950}
                    className={`${modalClass} bi-invoice-details-modal`}
                    footer={
                        <div className="bi-modal-footer-enhanced">
                            <Space size={8}>
                                <Button
                                    icon={<FilePdfOutlined />}
                                    onClick={() => handleViewPDF(selectedInvoice)}
                                    className="bi-footer-btn bi-footer-btn-pdf"
                                >
                                    View PDF
                                </Button>
                                <Button
                                    icon={<PrinterOutlined />}
                                    onClick={() => {
                                        const payment = payments.find(p => p.invoice_id === selectedInvoice?.invoice_id);
                                        if (payment) {
                                            handlePrintReceipt(payment);
                                        } else {
                                            message.warning('No payment record found for this invoice');
                                        }
                                    }}
                                    className="bi-footer-btn bi-footer-btn-print"
                                >
                                    Print Receipt
                                </Button>
                                <Button
                                    icon={<MailOutlined />}
                                    onClick={() => {
                                        reminderForm.setFieldsValue({
                                            subject: `Invoice ${selectedInvoice?.invoice_number}`,
                                            message: `Dear ${selectedInvoice?.customer_name},\n\nPlease find attached your invoice ${selectedInvoice?.invoice_number} for ₱${(selectedInvoice?.total_amount || 0).toLocaleString()}.\n\nThank you for your business.`
                                        });
                                        setReminderModalVisible(true);
                                        setInvoiceDetailsModalVisible(false);
                                    }}
                                    className="bi-footer-btn bi-footer-btn-mail"
                                >
                                    Email
                                </Button>
                                                            {canProcessRefunds && (
                                    <Button
                                        icon={<RollbackOutlined />}
                                        onClick={() => {
                                            openRefundDirectModal(selectedInvoice);
                                            setInvoiceDetailsModalVisible(false);
                                        }}
                                        className="bi-footer-btn"
                                        style={{ color: '#faad14', borderColor: '#faad14' }}
                                        disabled={selectedInvoice?.refund_status && !['rejected', 'cancelled'].includes(selectedInvoice.refund_status)}
                                    >
                                        Direct Refund
                                    </Button>
                                )}
                                <Button
                                    type="primary"
                                    onClick={() => setInvoiceDetailsModalVisible(false)}
                                    className="bi-footer-btn bi-footer-btn-close"
                                >
                                    Close
                                </Button>
                            </Space>
                        </div>
                    }
                                       destroyOnClose
                >
                    {invoiceDetailsLoading && (
                        <ModalSkeleton isDarkMode={isDarkMode} variant="invoice" />
                    )}
                    {!invoiceDetailsLoading && selectedInvoice && (
                        <div className="bi-modal-body-enhanced">
                            {/* Invoice Summary Cards */}
                            <div className="bi-invoice-summary-grid">
                                <div className="bi-summary-card">
                                    <div className="bi-summary-icon" style={{ background: '#e8f0fe', color: '#1a7ab5' }}>
                                        <DollarOutlined />
                                    </div>
                                    <div>
                                        <div className="bi-summary-label">Total Amount</div>
                                        <div className="bi-summary-value">₱{Number(selectedInvoice.total_amount || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className="bi-summary-card">
                                    <div className="bi-summary-icon" style={{ background: '#e6f7e6', color: '#52c41a' }}>
                                        <CheckCircleOutlined />
                                    </div>
                                    <div>
                                        <div className="bi-summary-label">Paid Amount</div>
                                        <div className="bi-summary-value" style={{ color: '#52c41a' }}>₱{Number(selectedInvoice.paid_amount || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className="bi-summary-card">
                                    <div className="bi-summary-icon" style={{ background: '#fff1f0', color: '#ff4d4f' }}>
                                        <WarningOutlined />
                                    </div>
                                    <div>
                                        <div className="bi-summary-label">Balance</div>
                                        <div className="bi-summary-value" style={{ color: Number(selectedInvoice.balance || 0) > 0 ? '#ff4d4f' : '#52c41a' }}>
                                            ₱{Number(selectedInvoice.balance || 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bi-summary-card">
                                    <div className="bi-summary-icon" style={{ background: '#fff7e6', color: '#faad14' }}>
                                        <CalendarOutlined />
                                    </div>
                                    <div>
                                        <div className="bi-summary-label">Due Date</div>
                                        <div className="bi-summary-value">{selectedInvoice.due_date || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Refund Status (if applicable) */}
                            {selectedInvoice.refund_status && (
                                <div className="bi-info-section">
                                    <div className="bi-section-header">
                                        <RollbackOutlined style={{ color: '#faad14' }} />
                                        <span className="bi-section-title-text">Refund Status</span>
                                    </div>
                                    <div style={{ padding: '12px 16px', background: getRefundStatusConfig(selectedInvoice.refund_status).bg, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: getRefundStatusConfig(selectedInvoice.refund_status).color, fontSize: 20 }}>
                                            {getRefundStatusConfig(selectedInvoice.refund_status).icon}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 600, color: getRefundStatusConfig(selectedInvoice.refund_status).color }}>
                                                {getRefundStatusConfig(selectedInvoice.refund_status).text}
                                            </div>
                                            {selectedInvoice.refund_amount > 0 && (
                                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                                    Amount: ₱{Number(selectedInvoice.refund_amount || 0).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Customer & Event Information */}
                            <div className="bi-info-section">
                                <div className="bi-section-header">
                                    <UserOutlined style={{ color: '#1a7ab5' }} />
                                    <span className="bi-section-title-text">Customer & Event Information</span>
                                </div>
                                <div className="bi-info-grid">
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Customer Name</span>
                                        <span className="bi-info-value">{selectedInvoice.customer_name}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Email</span>
                                        <span className="bi-info-value">{selectedInvoice.customer_email}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Phone</span>
                                        <span className="bi-info-value">{selectedInvoice.customer_phone}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Booking #</span>
                                        <span className="bi-info-value">{selectedInvoice.booking_no}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Event Type</span>
                                        <span className="bi-info-value">{selectedInvoice.event_type}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Event Date</span>
                                        <span className="bi-info-value">{selectedInvoice.event_date}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Breakdown */}
                            <div className="bi-info-section">
                                <div className="bi-section-header">
                                    <DollarOutlined style={{ color: '#1a7ab5' }} />
                                    <span className="bi-section-title-text">Financial Breakdown</span>
                                </div>
                                <div className="bi-financial-grid">
                                    <div className="bi-financial-item">
                                        <span className="bi-financial-label">Subtotal</span>
                                        <span className="bi-financial-value">₱{Number(selectedInvoice.subtotal || 0).toLocaleString()}</span>
                                    </div>
                                    {selectedInvoice.discount > 0 && (
                                        <div className="bi-financial-item bi-financial-discount">
                                            <span className="bi-financial-label">Discount ({selectedInvoice.discount_type === 'percentage' ? `${selectedInvoice.discount}%` : 'Fixed'})</span>
                                            <span className="bi-financial-value" style={{ color: '#ff4d4f' }}>-₱{Number(selectedInvoice.discount || 0).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {selectedInvoice.additional_charges > 0 && (
                                        <div className="bi-financial-item">
                                            <span className="bi-financial-label">Additional Charges</span>
                                            <span className="bi-financial-value">₱{Number(selectedInvoice.additional_charges || 0).toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="bi-financial-item bi-financial-total">
                                        <span className="bi-financial-label">Total Amount</span>
                                        <span className="bi-financial-value" style={{ fontWeight: 700, fontSize: '18px', color: '#1a7ab5' }}>
                                            ₱{Number(selectedInvoice.total_amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedInvoice.notes && (
                                <div className="bi-info-section">
                                    <div className="bi-section-header">
                                        <FileTextOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Notes</span>
                                    </div>
                                    <div className="bi-notes-content">{selectedInvoice.notes}</div>
                                </div>
                            )}

                            {/* Invoice Items Table */}
                            {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                                <div className="bi-info-section">
                                    <div className="bi-section-header">
                                        <UnorderedListOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Invoice Items</span>
                                    </div>
                                    <Table
                                        dataSource={selectedInvoice.items}
                                        columns={[
                                            {
                                                title: 'Description',
                                                dataIndex: 'description',
                                                render: (text) => <Text className="bi-plain-text">{text}</Text>
                                            },
                                            {
                                                title: 'Quantity',
                                                dataIndex: 'quantity',
                                                align: 'center',
                                                width: 100,
                                                render: (v) => <Text className="bi-plain-text">{v}</Text>
                                            },
                                            {
                                                title: 'Unit Price',
                                                dataIndex: 'unit_price',
                                                align: 'right',
                                                width: 130,
                                                render: (v) => <Text className="bi-plain-text">₱{Number(v || 0).toLocaleString()}</Text>
                                            },
                                            {
                                                title: 'Total',
                                                dataIndex: 'total',
                                                align: 'right',
                                                width: 130,
                                                render: (v) => <Text strong className="bi-amount-total">₱{Number(v || 0).toLocaleString()}</Text>
                                            }
                                        ]}
                                        pagination={false}
                                        size="small"
                                        className={`${tableClass} bi-items-table`}
                                        locale={{ emptyText: renderEmptyTable() }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </Modal>

                {/* ==================== ENHANCED RECORD PAYMENT MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced bi-payment-header">
                            <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #52c41a, #45a817)' }}>
                                <DollarOutlined />
                            </div>
                            <div className="bi-modal-title-group">
                                <span className="bi-modal-title">Record Payment</span>
                                <span className="bi-modal-subtitle">Process customer payment</span>
                            </div>
                            <div className="bi-modal-badge-group">
                                <span className="bi-modal-badge">{selectedInvoice?.invoice_number || 'N/A'}</span>
                            </div>
                        </div>
                    }
                    open={paymentModalVisible}
                    onCancel={() => {
                        setPaymentModalVisible(false);
                        paymentForm.resetFields();
                        setPaymentMethod('cash');
                    }}
                    width={580}
                    footer={null}
                    className={`${modalClass} bi-payment-modal`}
                    destroyOnClose
                >
                    <div className="bi-modal-body-enhanced">
                        {/* Payment Summary Card */}
                        <div className="bi-payment-summary-card">
                            <div className="bi-payment-summary-grid">
                                <div className="bi-payment-summary-item">
                                    <span className="bi-payment-summary-label">Customer</span>
                                    <span className="bi-payment-summary-value">{selectedInvoice?.customer_name || 'N/A'}</span>
                                </div>
                                <div className="bi-payment-summary-item">
                                    <span className="bi-payment-summary-label">Invoice #</span>
                                    <span className="bi-payment-summary-value">{selectedInvoice?.invoice_number || 'N/A'}</span>
                                </div>
                                <div className="bi-payment-summary-item">
                                    <span className="bi-payment-summary-label">Total Amount</span>
                                    <span className="bi-payment-summary-value">₱{Number(selectedInvoice?.total_amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="bi-payment-summary-item bi-payment-summary-balance">
                                    <span className="bi-payment-summary-label">Remaining Balance</span>
                                    <span className="bi-payment-summary-value" style={{ color: '#ff4d4f', fontWeight: 700 }}>
                                        ₱{Number(selectedInvoice?.balance || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Form
                            form={paymentForm}
                            layout="vertical"
                            onFinish={handleRecordPayment}
                            onValuesChange={(changedValues) => {
                                if (changedValues.payment_method) {
                                    setPaymentMethod(changedValues.payment_method);
                                }
                            }}
                            className="bi-payment-form"
                        >
                            <Form.Item
                                name="amount"
                                label="Payment Amount"
                                rules={[{ required: true, message: 'Please enter payment amount' }]}
                                className="bi-payment-amount-field"
                            >
                                <InputNumber
                                    min={0.01}
                                    style={{ width: '100%' }}
                                    prefix="₱"
                                    placeholder="0.00"
                                    className="bi-form-input bi-payment-amount-input"
                                    size="large"
                                />
                            </Form.Item>

                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.amount !== cur.amount}>
                                {({ getFieldValue }) => {
                                    const entered = Number(getFieldValue('amount') || 0);
                                    const balance = Number(selectedInvoice?.balance || 0);
                                    const change = Math.max(0, entered - balance);
                                    return change > 0 ? (
                                        <Alert
                                            type="success"
                                            showIcon
                                            style={{ marginBottom: 16, borderRadius: '10px' }}
                                            message={
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>Change to return</span>
                                                    <span style={{ fontWeight: 700, fontSize: '16px', color: '#52c41a' }}>₱{change.toFixed(2)}</span>
                                                </div>
                                            }
                                            className={isDarkMode ? 'bi-alert-dark' : ''}
                                        />
                                    ) : null;
                                }}
                            </Form.Item>

                            <div className="bi-form-row">
                                <Form.Item
                                    name="payment_method"
                                    label="Payment Method"
                                    rules={[{ required: true }]}
                                    initialValue="cash"
                                    className="bi-form-col"
                                >
                                    <Select onChange={(value) => setPaymentMethod(value)} className="bi-form-select">
                                        <Option value="cash">
                                            <Space>
                                                <BankOutlined />
                                                Cash
                                            </Space>
                                        </Option>
                                        <Option value="bank_transfer">
                                            <Space>
                                                <BankOutlined />
                                                Bank Transfer
                                            </Space>
                                        </Option>
                                        <Option value="gcash">
                                            <Space>
                                                <WalletOutlined />
                                                GCash
                                            </Space>
                                        </Option>
                                        <Option value="maya">
                                            <Space>
                                                <WalletOutlined />
                                                Maya
                                            </Space>
                                        </Option>
                                        <Option value="card">
                                            <Space>
                                                <CreditCardOutlined />
                                                Credit/Debit Card
                                            </Space>
                                        </Option>
                                        <Option value="check">
                                            <Space>
                                                <FileTextOutlined />
                                                Check
                                            </Space>
                                        </Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    name="payment_type"
                                    label="Payment Type"
                                    initialValue="partial"
                                    className="bi-form-col"
                                >
                                    <Select className="bi-form-select" disabled>
                                        <Option value="deposit">
                                            <Space>
                                                <WalletOutlined />
                                                Deposit
                                            </Space>
                                        </Option>
                                        <Option value="partial">
                                            <Space>
                                                <ClockCircleOutlined />
                                                Partial Payment
                                            </Space>
                                        </Option>
                                        <Option value="full">
                                            <Space>
                                                <CheckCircleOutlined />
                                                Full Payment
                                            </Space>
                                        </Option>
                                    </Select>
                                </Form.Item>
                            </div>

                            {paymentMethod !== 'cash' && (
                                <div className="bi-account-details">
                                    <div className="bi-account-details-header">
                                        <BankOutlined />
                                        <span>Account Details</span>
                                    </div>
                                    <div className="bi-form-row">
                                        <Form.Item
                                            name="account_name"
                                            label="Account Name"
                                            rules={[{ required: true, message: 'Please enter account name' }]}
                                            className="bi-form-col"
                                        >
                                            <Input placeholder="Account holder name" className="bi-form-input" prefix={<UserOutlined />} />
                                        </Form.Item>

                                        <Form.Item
                                            name="account_number"
                                            label="Account Number"
                                            rules={[{ required: true, message: 'Please enter account number' }]}
                                            className="bi-form-col"
                                        >
                                            <Input placeholder="Account number" className="bi-form-input" prefix={<CreditCardOutlined />} />
                                        </Form.Item>
                                    </div>

                                    <Form.Item
                                        name="reference_number"
                                        label="Reference Number"
                                        rules={[{ required: true, message: 'Please enter reference number' }]}
                                    >
                                        <Input placeholder="Transaction reference" className="bi-form-input" prefix={<FileTextOutlined />} />
                                    </Form.Item>
                                </div>
                            )}

                            {paymentMethod === 'cash' && (
                                <Form.Item name="reference_number" label="Reference Number (Optional)">
                                    <Input placeholder="Transaction reference (optional)" className="bi-form-input" prefix={<FileTextOutlined />} />
                                </Form.Item>
                            )}

                            <Form.Item name="notes" label="Notes">
                                <TextArea rows={2} placeholder="Additional notes..." className="bi-form-textarea" />
                            </Form.Item>

                            <div className="bi-modal-footer-enhanced">
                                <Button
                                    onClick={() => {
                                        setPaymentModalVisible(false);
                                        paymentForm.resetFields();
                                        setPaymentMethod('cash');
                                    }}
                                    className="bi-footer-btn"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<CheckCircleOutlined />}
                                    className="bi-footer-btn bi-footer-btn-submit"
                                    style={{ background: 'linear-gradient(135deg, #52c41a, #45a817)', borderColor: '#52c41a' }}
                                    loading={paymentSaveMutation.isPending}
                                    disabled={paymentSaveMutation.isPending}
                                >
                                    Record Payment
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== ENHANCED PAYMENT RECEIPT MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced bi-receipt-header-modal">
                            <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #722ed1, #531dab)' }}>
                                <FileTextOutlined />
                            </div>
                            <div className="bi-modal-title-group">
                                <span className="bi-modal-title">Payment Receipt</span>
                                <span className="bi-modal-subtitle">Payment confirmation details</span>
                            </div>
                            <div className="bi-modal-badge-group">
                                <span className="bi-modal-badge">{selectedPayment?.payment_number || 'N/A'}</span>
                                {selectedPayment?.status && (
                                    <span className="bi-status-badge" style={{
                                        color: selectedPayment.status === 'completed' ? '#52c41a' : '#faad14',
                                        background: selectedPayment.status === 'completed' ? 'rgba(82,196,26,0.1)' : 'rgba(250,173,20,0.1)',
                                        padding: '4px 14px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {selectedPayment.status === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                                        {selectedPayment.status?.toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>
                    }
                    open={receiptModalVisible}
                    onCancel={() => { setReceiptModalVisible(false); setReceiptData(null); }}
                    width={750}
                    className={`${modalClass} bi-receipt-modal`}
                    footer={
                        <div className="bi-modal-footer-enhanced">
                            <Space size={8}>
                                <Button
                                    icon={<PrinterOutlined />}
                                    onClick={() => handlePrintReceipt(selectedPayment)}
                                    className="bi-footer-btn bi-footer-btn-print"
                                >
                                    Print
                                </Button>
                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleDownloadReceipt(selectedPayment)}
                                    className="bi-footer-btn bi-footer-btn-download"
                                >
                                    Download
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={() => setReceiptModalVisible(false)}
                                    className="bi-footer-btn bi-footer-btn-close"
                                >
                                    Close
                                </Button>
                            </Space>
                        </div>
                    }
                        destroyOnClose
                >
                    {!receiptData && (
                        <ModalSkeleton isDarkMode={isDarkMode} variant="payment" />
                    )}
                    {receiptData && (
                        <div className="bi-modal-body-enhanced">
                            {/* Receipt Header */}
                            <div className="bi-receipt-header-content">
                                <div className="bi-receipt-logo">
                                    <FileTextOutlined style={{ fontSize: 32, color: '#1a7ab5' }} />
                                </div>
                                <div className="bi-receipt-title-group">
                                    <h3 className="bi-receipt-title">Payment Receipt</h3>
                                    <p className="bi-receipt-subtitle">Official payment confirmation</p>
                                </div>
                            </div>

                            {/* Receipt Meta Info */}
                            <div className="bi-receipt-meta-grid">
                                <div className="bi-receipt-meta-item">
                                    <span className="bi-receipt-meta-label">Receipt #</span>
                                    <span className="bi-receipt-meta-value">{receiptData.payment?.payment_number || 'N/A'}</span>
                                </div>
                                <div className="bi-receipt-meta-item">
                                    <span className="bi-receipt-meta-label">Date</span>
                                    <span className="bi-receipt-meta-value">
                                        {receiptData.payment?.date ? dayjs(receiptData.payment.date).format('MMMM DD, YYYY h:mm A') : 'N/A'}
                                    </span>
                                </div>
                                <div className="bi-receipt-meta-item">
                                    <span className="bi-receipt-meta-label">Status</span>
                                    <span className="bi-receipt-meta-value">
                                        <Tag color={receiptData.payment?.status === 'completed' ? 'green' : 'orange'}>
                                            {receiptData.payment?.status?.toUpperCase()}
                                        </Tag>
                                    </span>
                                </div>
                            </div>

                            {/* Customer Details */}
                            <div className="bi-info-section">
                                <div className="bi-section-header">
                                    <UserOutlined style={{ color: '#1a7ab5' }} />
                                    <span className="bi-section-title-text">Customer Details</span>
                                </div>
                                <div className="bi-info-grid">
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Customer Name</span>
                                        <span className="bi-info-value">{receiptData.payment?.customer_name}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Booking #</span>
                                        <span className="bi-info-value">{receiptData.payment?.booking_no}</span>
                                    </div>
                                    <div className="bi-info-item">
                                        <span className="bi-info-label">Invoice #</span>
                                        <span className="bi-info-value">{receiptData.payment?.invoice_number}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Details */}
                            <div className="bi-info-section">
                                <div className="bi-section-header">
                                    <DollarOutlined style={{ color: '#1a7ab5' }} />
                                    <span className="bi-section-title-text">Payment Details</span>
                                </div>
                                <div className="bi-payment-details-grid">
                                    <div className="bi-payment-detail-item">
                                        <span className="bi-payment-detail-label">Amount</span>
                                        <span className="bi-payment-detail-value" style={{ fontSize: '24px', fontWeight: 700, color: '#1a7ab5' }}>
                                            ₱{Number(receiptData.payment?.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="bi-payment-detail-item">
                                        <span className="bi-payment-detail-label">Payment Method</span>
                                        <span className="bi-payment-detail-value">
                                            <span className="bi-method-tag" style={{ fontSize: '14px', padding: '4px 16px' }}>
                                                {getPaymentMethodIcon(receiptData.payment?.payment_method)}
                                                {receiptData.payment?.payment_method?.toUpperCase()}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="bi-payment-detail-item">
                                        <span className="bi-payment-detail-label">Payment Type</span>
                                        <span className="bi-payment-detail-value">
                                            <Tag color="blue">{receiptData.payment?.payment_type?.toUpperCase() || 'PARTIAL'}</Tag>
                                        </span>
                                    </div>
                                    <div className="bi-payment-detail-item">
                                        <span className="bi-payment-detail-label">Reference #</span>
                                        <span className="bi-payment-detail-value">
                                            <Text copyable className="bi-plain-text">
                                                {receiptData.payment?.reference_number || 'N/A'}
                                            </Text>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Details (if available) */}
                            {receiptData.payment?.account_name && (
                                <div className="bi-info-section">
                                    <div className="bi-section-header">
                                        <BankOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Account Details</span>
                                    </div>
                                    <div className="bi-info-grid">
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Account Name</span>
                                            <span className="bi-info-value">{receiptData.payment.account_name}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Account Number</span>
                                            <span className="bi-info-value">{receiptData.payment.account_number}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Receipt Proof Image */}
                            {receiptData.payment?.receipt_url && (
                                <div className="bi-info-section">
                                    <div className="bi-section-header">
                                        <FileImageOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Proof of Payment</span>
                                    </div>
                                    <div className="bi-receipt-image-container">
                                        <Image
                                            src={resolveBackendUrl(receiptData.payment.receipt_url)}
                                            alt="Receipt Proof"
                                            style={{ maxHeight: 350, objectFit: 'contain', borderRadius: '10px' }}
                                            preview={{ mask: 'View Full Image' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="bi-receipt-footer">
                                <div className="bi-receipt-footer-text">
                                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                    <span>This is an official payment receipt. Thank you for your business.</span>
                                </div>
                                <div className="bi-receipt-footer-generated">
                                    Generated on: {dayjs().format('MMMM DD, YYYY h:mm A')}
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* ==================== CREATE/EDIT INVOICE MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced">
                            <div className="bi-modal-icon">
                                {editingInvoice ? <EditOutlined /> : <PlusOutlined />}
                            </div>
                            <span className="bi-modal-title">{editingInvoice ? "Edit Invoice" : "Create Invoice"}</span>
                            <span className="bi-modal-badge">{editingInvoice ? `#${editingInvoice.invoice_number}` : 'New'}</span>
                        </div>
                    }
                    open={invoiceModalVisible}
                    onCancel={() => { setInvoiceModalVisible(false); setEditingInvoice(null); invoiceForm.resetFields(); }}
                    width={850}
                    footer={null}
                    className={modalClass}
                    destroyOnClose
                >
                    <div className="bi-modal-body-enhanced">
                        <Form form={invoiceForm} layout="vertical" onFinish={handleSaveInvoice}>
                            <div className="bi-form-section">
                                <div className="bi-form-section-title">Booking Selection</div>
                                <Form.Item name="booking_id" label="Select Booking" rules={[{ required: true, message: 'Please select a booking' }]}>
                                                                       <Select
                                        placeholder="Search and select a booking..."
                                        onChange={handleSelectBooking}
                                        showSearch
                                        optionFilterProp="children"
                                        className="bi-booking-select"
                                        value={createInvoiceBookingId}
                                        allowClear
                                        notFoundContent={
                                            <div style={{ padding: 12, textAlign: 'center', color: '#8b93a8' }}>
                                                No approved bookings available
                                            </div>
                                        }
                                    >
                                                                          {/*
                                      ⭐ Show EVERY confirmed booking.
                                      Bookings that already have an invoice are shown
                                      first (they are the most likely to be selected
                                      when the operator wants to view/adjust that invoice),
                                      and they are labelled as already-invoiced so the
                                      operator is not surprised if the save fails.
                                    */}
                                    {[...(confirmedBookings || [])]
                                        .sort((a, b) => {
                                            // Already-invoiced on top, then by booking_id desc.
                                            if (a.has_invoice !== b.has_invoice) {
                                                return a.has_invoice ? -1 : 1;
                                            }
                                            return Number(b.booking_id) - Number(a.booking_id);
                                        })
                                        .map((booking) => {
                                            const label = booking.has_invoice
                                                ? `${booking.booking_no} — ${booking.customer_name} (${booking.event_date || '—'}) · Already invoiced: ${booking.invoice_number}`
                                                : `${booking.booking_no} — ${booking.customer_name} (${booking.event_date || '—'})`;

                                            return (
                                                <Option
                                                    key={booking.booking_id}
                                                    value={booking.booking_id}
                                                    label={label}
                                                >
                                                    {label}
                                                </Option>
                                            );
                                        })}
                                    </Select>
                                </Form.Item>
                            </div>

                            <div className="bi-form-section">
                                <div className="bi-form-section-title">Customer Information</div>
                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="booking_no" label="Booking Number">
                                            <Input disabled className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="customer_name" label="Customer Name">
                                            <Input disabled className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="customer_email" label="Email">
                                            <Input disabled className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="customer_phone" label="Phone">
                                            <Input disabled className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="customer_address" label="Address">
                                    <Input disabled className="bi-form-input-disabled" />
                                </Form.Item>
                            </div>

                            <div className="bi-form-section">
                                <div className="bi-form-section-title">Event Details</div>
                                <Row gutter={16}>
                                    <Col xs={24} sm={8}>
                                        <Form.Item name="event_type" label="Event Type">
                                            <Input disabled className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Form.Item name="event_date" label="Event Date">
                                            <DatePicker style={{ width: '100%' }} disabled className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Form.Item name="guests_count" label="Guests">
                                            <InputNumber disabled style={{ width: '100%' }} className="bi-form-input-disabled" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="venue" label="Venue">
                                    <Input disabled className="bi-form-input-disabled" />
                                </Form.Item>
                            </div>

                            <Divider className="bi-form-divider" />

                            <div className="bi-form-section">
                                <div className="bi-form-section-title">Financial Details</div>
                                <Row gutter={16}>
                                    <Col xs={24} sm={8}>
                                        <Form.Item name="subtotal" label="Subtotal" rules={[{ required: true, message: 'Please enter subtotal' }]}>
                                            <InputNumber
                                                min={0}
                                                style={{ width: '100%' }}
                                                prefix="₱"
                                                placeholder="0.00"
                                                className="bi-form-input"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} sm={4}>
                                        <Form.Item name="discount_type" label="Discount Type" initialValue="fixed">
                                            <Select className="bi-form-select">
                                                <Option value="fixed">Fixed (₱)</Option>
                                                <Option value="percentage">Percentage (%)</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} sm={4}>
                                        <Form.Item name="discount" label="Discount">
                                            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" className="bi-form-input" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Form.Item name="additional_charges" label="Additional Charges">
                                            <InputNumber min={0} style={{ width: '100%' }} prefix="₱" placeholder="0" className="bi-form-input" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="total_amount" label="Total Amount" rules={[{ required: true }]}>
                                            <InputNumber
                                                min={0}
                                                style={{ width: '100%' }}
                                                prefix="₱"
                                                placeholder="0.00"
                                                disabled
                                                className="bi-form-input-disabled bi-total-amount"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item name="due_date" label="Due Date">
                                            <DatePicker style={{ width: '100%' }} className="bi-form-input" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="notes" label="Notes">
                                    <TextArea rows={3} placeholder="Additional notes..." className="bi-form-textarea" />
                                </Form.Item>
                            </div>

                            <div className="bi-modal-footer-enhanced">
                                <Button onClick={() => { setInvoiceModalVisible(false); setEditingInvoice(null); invoiceForm.resetFields(); }}>
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={editingInvoice ? <EditOutlined /> : <PlusOutlined />}
                                    loading={invoiceSaveMutation.isPending}
                                    disabled={invoiceSaveMutation.isPending}
                                >
                                    {editingInvoice ? "Update Invoice" : "Create Invoice"}
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== APPLY DISCOUNT MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced">
                            <div className="bi-modal-icon"><PercentageOutlined /></div>
                            <span className="bi-modal-title">Apply Discount</span>
                            <span className="bi-modal-badge">{selectedInvoice?.invoice_number || 'N/A'}</span>
                        </div>
                    }
                    open={discountModalVisible}
                    onCancel={() => { setDiscountModalVisible(false); discountForm.resetFields(); }}
                    width={480}
                    footer={null}
                    className={modalClass}
                    destroyOnClose
                >
                    <div className="bi-modal-body-enhanced">
                        <div className="bi-discount-info">
                            <Row gutter={[8, 8]}>
                                <Col span={12}>
                                    <Text type="secondary">Invoice #:</Text>
                                    <br />
                                    <Text strong>{selectedInvoice?.invoice_number || 'N/A'}</Text>
                                </Col>
                                <Col span={12}>
                                    <Text type="secondary">Subtotal:</Text>
                                    <br />
                                    <Text strong>₱{Number(selectedInvoice?.subtotal || 0).toLocaleString()}</Text>
                                </Col>
                            </Row>
                        </div>

                        <Form form={discountForm} layout="vertical" onFinish={handleApplyDiscount}>
                            <Form.Item name="discount_type" label="Discount Type" initialValue="fixed">
                                <Radio.Group className="bi-radio-group">
                                    <Radio value="fixed">Fixed Amount (₱)</Radio>
                                    <Radio value="percentage">Percentage (%)</Radio>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item name="discount_value" label="Discount Value" rules={[{ required: true, message: 'Please enter discount value' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter discount amount" className="bi-form-input" />
                            </Form.Item>

                            <div className="bi-modal-footer-enhanced">
                                <Button onClick={() => setDiscountModalVisible(false)}>Cancel</Button>
                                <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>
                                    Apply Discount
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== SEND REMINDER MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced">
                            <div className="bi-modal-icon"><MailOutlined /></div>
                            <span className="bi-modal-title">Send Payment Reminder</span>
                            <span className="bi-modal-badge">{selectedInvoice?.customer_name || 'Customer'}</span>
                        </div>
                    }
                    open={reminderModalVisible}
                    onCancel={() => { setReminderModalVisible(false); reminderForm.resetFields(); }}
                    width={550}
                    footer={null}
                    className={modalClass}
                    destroyOnClose
                >
                    <div className="bi-modal-body-enhanced">
                        <Alert
                            message={`Reminder for ${selectedInvoice?.customer_name || 'Customer'}`}
                            description={`Outstanding balance: ₱${Number(selectedInvoice?.balance || 0).toLocaleString()}`}
                            type="warning"
                            showIcon
                            style={{ marginBottom: 20 }}
                            className={isDarkMode ? 'bi-alert-dark' : ''}
                        />

                        <Form form={reminderForm} layout="vertical" onFinish={handleSendReminder}>
                            <Form.Item name="subject" label="Subject" rules={[{ required: true, message: 'Please enter subject' }]}>
                                <Input placeholder="Email subject" className="bi-form-input" />
                            </Form.Item>

                            <Form.Item name="message" label="Message" rules={[{ required: true, message: 'Please enter message' }]}>
                                <TextArea rows={6} placeholder="Write your reminder message..." className="bi-form-textarea" />
                            </Form.Item>

                            <div className="bi-modal-footer-enhanced">
                                <Button onClick={() => setReminderModalVisible(false)}>Cancel</Button>
                                <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                                    Send Reminder
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== REJECT PAYMENT MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced bi-modal-header-danger">
                            <div className="bi-modal-icon" style={{ background: '#ff4d4f' }}><CloseCircleOutlined /></div>
                            <span className="bi-modal-title">Reject Mobile Payment</span>
                            <span className="bi-modal-badge">{selectedPayment?.customer_name || 'N/A'}</span>
                        </div>
                    }
                    open={rejectPaymentModalVisible}
                    onCancel={() => { setRejectPaymentModalVisible(false); setRejectReason(''); }}
                    width={480}
                    className={modalClass}
                    footer={
                        <div className="bi-modal-footer-enhanced">
                            <Button onClick={() => { setRejectPaymentModalVisible(false); setRejectReason(''); }}>
                                Cancel
                            </Button>
                            <Button danger type="primary" onClick={handleConfirmReject} icon={<CloseCircleOutlined />}>
                                Reject Payment
                            </Button>
                        </div>
                    }
                    destroyOnClose
                >
                    <div className="bi-modal-body-enhanced">
                        <Alert
                            message={`Reject payment of ${formatCurrency(selectedPayment?.amount || 0)} from ${selectedPayment?.customer_name || 'Unknown'}`}
                            description="Please provide a reason for rejection."
                            type="error"
                            showIcon
                            style={{ marginBottom: 20 }}
                            className={isDarkMode ? 'bi-alert-dark' : ''}
                        />
                        <TextArea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                            placeholder="Enter rejection reason..."
                            className="bi-form-textarea"
                        />
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                            This reason will be sent to the customer.
                        </Text>
                    </div>
                </Modal>

                {/* ==================== PDF VIEWER MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced bi-pdf-header">
                            <div className="bi-modal-icon" style={{ background: '#ff4d4f' }}><FilePdfOutlined /></div>
                            <span className="bi-modal-title">Booking PDF - {pdfViewerBooking?.booking_no || 'N/A'}</span>
                            <div className="bi-pdf-controls">
                                <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setPdfViewerZoom(Math.max(50, pdfViewerZoom - 10))} />
                                <span style={{ fontSize: 12, minWidth: 50, textAlign: 'center' }}>{pdfViewerZoom}%</span>
                                <Button size="small" icon={<ZoomInOutlined />} onClick={() => setPdfViewerZoom(Math.min(200, pdfViewerZoom + 10))} />
                                <Button size="small" icon={<FullscreenOutlined />} onClick={() => setPdfViewerZoom(100)}>Fit</Button>
                            </div>
                        </div>
                    }
                    open={pdfViewerVisible}
                    onCancel={() => setPdfViewerVisible(false)}
                    width="90%"
                    style={{ maxWidth: 1200 }}
                    className="bi-pdf-viewer-modal"
                    centered={true}
                    maskClosable={true}
                    footer={
                        <div className="bi-modal-footer-enhanced bi-pdf-footer">
                            <div>
                                <Button icon={<PrinterOutlined />} onClick={handlePrintPDF} type="primary">
                                    Print PDF
                                </Button>
                                <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF} style={{ marginLeft: 8 }}>
                                    Download
                                </Button>
                            </div>
                            <Button onClick={() => setPdfViewerVisible(false)}>Close</Button>
                        </div>
                    }
                    destroyOnClose
                    styles={{
    body: {
        padding: '20px',
        background: isDarkMode ? '#0a0e1a' : '#f0f2f5',
        maxHeight: '80vh',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start'
    }
}}
                >
                    <div style={{
                        transform: `scale(${pdfViewerZoom / 100})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease',
                        background: '#ffffff',
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        padding: '0',
                        margin: '0 auto',
                        maxWidth: '210mm',
                        width: '100%'
                    }}>
                        <div dangerouslySetInnerHTML={{ __html: pdfViewerHtml }} />
                    </div>
                </Modal>

                {/* ==================== RECEIPT PREVIEW MODAL ==================== */}
                <Modal
                    title={
                        <div className="bi-modal-header-enhanced bi-receipt-header">
                            <div className="bi-modal-icon"><PrinterOutlined /></div>
                            <span className="bi-modal-title">Receipt Preview</span>
                            <div className="bi-pdf-controls">
                                <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setReceiptPreviewZoom(Math.max(50, receiptPreviewZoom - 10))} />
                                <span style={{ fontSize: 12, minWidth: 50, textAlign: 'center' }}>{receiptPreviewZoom}%</span>
                                <Button size="small" icon={<ZoomInOutlined />} onClick={() => setReceiptPreviewZoom(Math.min(200, receiptPreviewZoom + 10))} />
                                <Button size="small" icon={<FullscreenOutlined />} onClick={() => setReceiptPreviewZoom(100)}>Fit</Button>
                            </div>
                        </div>
                    }
                    open={receiptPreviewVisible}
                    onCancel={() => setReceiptPreviewVisible(false)}
                    width="90%"
                    style={{ maxWidth: 1200 }}
                    className="bi-receipt-preview-modal"
                    centered={true}
                    maskClosable={true}
                    footer={
                        <div className="bi-modal-footer-enhanced bi-pdf-footer">
                            <div>
                                <Button icon={<PrinterOutlined />} onClick={handlePrintReceiptDirect} type="primary">
                                    Print Receipt
                                </Button>
                                <Button icon={<DownloadOutlined />} onClick={handleDownloadReceiptPDF} style={{ marginLeft: 8 }}>
                                    Download
                                </Button>
                            </div>
                            <Button onClick={() => setReceiptPreviewVisible(false)}>Close</Button>
                        </div>
                    }
                    destroyOnClose
                styles={{
    body: {
        padding: '20px',
        background: isDarkMode ? '#0a0e1a' : '#f0f2f5',
        maxHeight: '80vh',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start'
    }
}}
                >
                    <div style={{
                        transform: `scale(${receiptPreviewZoom / 100})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease',
                        background: '#ffffff',
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        padding: '0',
                        margin: '0 auto',
                        maxWidth: '210mm',
                        width: '100%'
                    }}>
                        <div dangerouslySetInnerHTML={{ __html: receiptPreviewHtml }} />
                    </div>
                </Modal>
                {/* ==================== REFUND MODALS (ADMIN ONLY) ==================== */}
                {canProcessRefunds && (
                    <>
                        {/* ⭐ DIRECT REFUND MODAL — Admin bypass: no request, no approval chain */}
                        <Modal
                            title={
                                <div className="bi-modal-header-enhanced">
                                    <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #faad14, #d48806)' }}>
                                        <RollbackOutlined />
                                    </div>
                                    <div className="bi-modal-title-group">
                                        <span className="bi-modal-title">Direct Refund</span>
                                        <span className="bi-modal-subtitle">Process refund immediately — no approval required</span>
                                    </div>
                                    <div className="bi-modal-badge-group">
                                        <span className="bi-modal-badge">{selectedInvoice?.invoice_number || 'N/A'}</span>
                                    </div>
                                </div>
                            }
                            open={refundDirectModalVisible}
                            onCancel={() => {
                                setRefundDirectModalVisible(false);
                                refundDirectForm.resetFields();
                                setSelectedInvoice(null);
                            }}
                            width={620}
                            footer={null}
                            className={modalClass}
                            destroyOnClose
                        >
                            <div className="bi-modal-body-enhanced">
                                <Alert
                                    message="Admin Direct Refund"
                                    description="This action will immediately cancel the booking and release the refund. No approval chain is required."
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 20 }}
                                    className={isDarkMode ? 'bi-alert-dark' : ''}
                                />

                                <div className="bi-info-section" style={{ marginBottom: 16 }}>
                                    <div className="bi-section-header">
                                        <FileTextOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Invoice Details</span>
                                    </div>
                                    <div className="bi-info-grid">
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Customer</span>
                                            <span className="bi-info-value">{selectedInvoice?.customer_name || 'N/A'}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Booking #</span>
                                            <span className="bi-info-value">{selectedInvoice?.booking_no || 'N/A'}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Total Amount</span>
                                            <span className="bi-info-value">₱{Number(selectedInvoice?.total_amount || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Paid Amount</span>
                                            <span className="bi-info-value" style={{ color: '#52c41a', fontWeight: 600 }}>
                                                ₱{Number(selectedInvoice?.paid_amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <Form form={refundDirectForm} layout="vertical" onFinish={handleDirectRefund}>
                                    <Form.Item
                                        name="refund_amount"
                                        label="Refund Amount"
                                        tooltip="Enter 0 for cancel without refund."
                                        rules={[
                                            { required: true, message: 'Please enter the refund amount' },
                                            { type: 'number', min: 0, message: 'Amount cannot be negative' }
                                        ]}
                                    >
                                        <InputNumber
                                            min={0}
                                            step={0.01}
                                            style={{ width: '100%' }}
                                            prefix="₱"
                                            placeholder="0.00"
                                            className="bi-form-input"
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Row gutter={12}>
                                        <Col span={12}>
                                            <Form.Item name="payment_method" label="Disbursement Method" rules={[{ required: true }]}>
                                                <Select className="bi-form-select" size="large">
                                                    <Option value="cash"><Space><BankOutlined /> Cash</Space></Option>
                                                    <Option value="gcash"><Space><WalletOutlined /> GCash</Space></Option>
                                                    <Option value="maya"><Space><WalletOutlined /> Maya</Space></Option>
                                                    <Option value="bank_transfer"><Space><BankOutlined /> Bank Transfer</Space></Option>
                                                    <Option value="card"><Space><CreditCardOutlined /> Card</Space></Option>
                                                    <Option value="check"><Space><FileTextOutlined /> Check</Space></Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="reference_number" label="Reference Number (Optional)">
                                                <Input placeholder="Transaction reference" className="bi-form-input" size="large" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item
                                        name="reason"
                                        label="Reason for Refund"
                                        rules={[{ required: true, message: 'Please provide a reason' }]}
                                    >
                                        <TextArea
                                            rows={3}
                                            placeholder="Explain why this refund is being issued..."
                                            maxLength={500}
                                            showCount
                                            className="bi-form-textarea"
                                        />
                                    </Form.Item>

                                    <Form.Item name="notes" label="Internal Notes (Optional)">
                                        <TextArea
                                            rows={2}
                                            placeholder="Additional notes (recorded in audit log)..."
                                            maxLength={500}
                                            showCount
                                            className="bi-form-textarea"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="cancel_booking"
                                        valuePropName="checked"
                                        initialValue={true}
                                    >
                                        <Checkbox>
                                            Also cancel the booking after refund
                                        </Checkbox>
                                    </Form.Item>

                                    <div className="bi-modal-footer-enhanced">
                                        <Button onClick={() => { setRefundDirectModalVisible(false); setSelectedInvoice(null); }}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            icon={<RollbackOutlined />}
                                            loading={refundDirectMutation.isPending}
                                            disabled={refundDirectMutation.isPending}
                                            style={{ background: '#faad14', borderColor: '#faad14' }}
                                        >
                                            Process Refund Now
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </Modal>

                        {/* REFUND REQUEST MODAL */}
                        <Modal
                            title={
                                <div className="bi-modal-header-enhanced">
                                    <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #faad14, #d48806)' }}>
                                        <RollbackOutlined />
                                    </div>
                                    <div className="bi-modal-title-group">
                                        <span className="bi-modal-title">Request Refund</span>
                                        <span className="bi-modal-subtitle">Submit a refund request for review</span>
                                    </div>
                                    <div className="bi-modal-badge-group">
                                        <span className="bi-modal-badge">{selectedInvoice?.invoice_number || 'N/A'}</span>
                                    </div>
                                </div>
                            }
                            open={refundModalVisible}
                            onCancel={() => {
                                setRefundModalVisible(false);
                                refundForm.resetFields();
                                setSelectedInvoice(null);
                            }}
                            width={560}
                            footer={null}
                            className={modalClass}
                            destroyOnClose
                        >
                            <div className="bi-modal-body-enhanced">
                                <Alert
                                    message="Refund Request"
                                    description={`Request a refund for invoice ${selectedInvoice?.invoice_number}. This will be reviewed by an administrator.`}
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 20 }}
                                    className={isDarkMode ? 'bi-alert-dark' : ''}
                                />

                                <div className="bi-info-section" style={{ marginBottom: 16 }}>
                                    <div className="bi-section-header">
                                        <FileTextOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Invoice Details</span>
                                    </div>
                                    <div className="bi-info-grid">
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Customer</span>
                                            <span className="bi-info-value">{selectedInvoice?.customer_name || 'N/A'}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Total Amount</span>
                                            <span className="bi-info-value">₱{Number(selectedInvoice?.total_amount || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Paid Amount</span>
                                            <span className="bi-info-value" style={{ color: '#52c41a' }}>
                                                ₱{Number(selectedInvoice?.paid_amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Booking #</span>
                                            <span className="bi-info-value">{selectedInvoice?.booking_no || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <Form form={refundForm} layout="vertical" onFinish={handleSubmitRefundRequest}>
                                    <Form.Item
                                        name="reason"
                                        label="Reason for Refund"
                                        rules={[{ required: true, message: 'Please provide a reason for the refund request' }]}
                                    >
                                        <TextArea
                                            rows={4}
                                            placeholder="Explain why this refund is being requested..."
                                            maxLength={1000}
                                            showCount
                                            className="bi-form-textarea"
                                        />
                                    </Form.Item>
                                    <div className="bi-modal-footer-enhanced">
                                        <Button onClick={() => { setRefundModalVisible(false); setSelectedInvoice(null); }}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            icon={<RollbackOutlined />}
                                            loading={refundRequestMutation.isPending}
                                            disabled={refundRequestMutation.isPending}
                                            style={{ background: '#faad14', borderColor: '#faad14' }}
                                        >
                                            Submit Refund Request
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </Modal>

                        {/* REFUND APPROVAL MODAL */}
                        <Modal
                            title={
                                <div className="bi-modal-header-enhanced">
                                    <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #1890ff, #096dd9)' }}>
                                        <CheckCircleOutlined />
                                    </div>
                                    <div className="bi-modal-title-group">
                                        <span className="bi-modal-title">Approve Refund</span>
                                        <span className="bi-modal-subtitle">Review and approve refund request</span>
                                    </div>
                                    <div className="bi-modal-badge-group">
                                        <span className="bi-modal-badge">{selectedRefund?.refund_number || 'N/A'}</span>
                                    </div>
                                </div>
                            }
                            open={refundApprovalModalVisible}
                            onCancel={() => {
                                setRefundApprovalModalVisible(false);
                                refundApprovalForm.resetFields();
                                setSelectedRefund(null);
                            }}
                            width={560}
                            footer={null}
                            className={modalClass}
                            destroyOnClose
                        >
                            <div className="bi-modal-body-enhanced">
                                <div className="bi-info-section" style={{ marginBottom: 16 }}>
                                    <div className="bi-section-header">
                                        <DollarOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Refund Details</span>
                                    </div>
                                    <div className="bi-info-grid">
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Refund #</span>
                                            <span className="bi-info-value">{selectedRefund?.refund_number}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Deposit on File</span>
                                            <span className="bi-info-value" style={{ color: '#1a7ab5', fontWeight: 600 }}>
                                                ₱{Number(selectedRefund?.deposit_snapshot || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Booking #</span>
                                            <span className="bi-info-value">
                                                {selectedRefund?.booking?.booking_no || selectedRefund?.invoice?.booking?.booking_no || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Requested By</span>
                                            <span className="bi-info-value">
                                                {selectedRefund?.requested_by?.name || 'Cashier'}
                                            </span>
                                        </div>
                                        <div className="bi-info-item" style={{ gridColumn: '1 / -1' }}>
                                            <span className="bi-info-label">Reason</span>
                                            <span className="bi-info-value">{selectedRefund?.reason || '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                <Form form={refundApprovalForm} layout="vertical" onFinish={handleApproveRefund}>
                                    <Form.Item
                                        name="approved_amount"
                                        label="Approved Refund Amount"
                                        rules={[
                                            { required: true, message: 'Please enter the approved amount' },
                                            { type: 'number', min: 0, message: 'Amount cannot be negative' }
                                        ]}
                                    >
                                        <InputNumber
                                            min={0}
                                            style={{ width: '100%' }}
                                            prefix="₱"
                                            placeholder="0.00"
                                            className="bi-form-input"
                                            size="large"
                                        />
                                    </Form.Item>
                                    <Form.Item name="admin_notes" label="Admin Notes (Optional)">
                                        <TextArea
                                            rows={3}
                                            placeholder="Internal notes about this approval..."
                                            maxLength={1000}
                                            showCount
                                            className="bi-form-textarea"
                                        />
                                    </Form.Item>
                                    <div className="bi-modal-footer-enhanced">
                                        <Button onClick={() => { setRefundApprovalModalVisible(false); setSelectedRefund(null); }}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            icon={<CheckCircleOutlined />}
                                            loading={refundApproveMutation.isPending}
                                            disabled={refundApproveMutation.isPending}
                                        >
                                            Approve Refund
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </Modal>

                        {/* REFUND RELEASE MODAL */}
                        <Modal
                            title={
                                <div className="bi-modal-header-enhanced">
                                    <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #52c41a, #389e0d)' }}>
                                        <RollbackOutlined />
                                    </div>
                                    <div className="bi-modal-title-group">
                                        <span className="bi-modal-title">Release Refund</span>
                                        <span className="bi-modal-subtitle">Confirm and release the refund</span>
                                    </div>
                                    <div className="bi-modal-badge-group">
                                        <span className="bi-modal-badge">{selectedRefund?.refund_number || 'N/A'}</span>
                                    </div>
                                </div>
                            }
                            open={refundReleaseModalVisible}
                            onCancel={() => {
                                setRefundReleaseModalVisible(false);
                                refundReleaseForm.resetFields();
                                setSelectedRefund(null);
                            }}
                            width={560}
                            footer={null}
                            className={modalClass}
                            destroyOnClose
                        >
                            <div className="bi-modal-body-enhanced">
                                <Alert
                                    message="Confirm Refund Release"
                                    description={`Release the approved refund of ₱${Number(selectedRefund?.approved_amount || selectedRefund?.amount || 0).toLocaleString()} to the customer. This action will also cancel the booking.`}
                                    type="success"
                                    showIcon
                                    style={{ marginBottom: 20 }}
                                    className={isDarkMode ? 'bi-alert-dark' : ''}
                                />

                                <div className="bi-info-section" style={{ marginBottom: 16 }}>
                                    <div className="bi-section-header">
                                        <FileTextOutlined style={{ color: '#1a7ab5' }} />
                                        <span className="bi-section-title-text">Refund Details</span>
                                    </div>
                                    <div className="bi-info-grid">
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Refund #</span>
                                            <span className="bi-info-value">{selectedRefund?.refund_number}</span>
                                        </div>
                                        <div className="bi-info-item">
                                            <span className="bi-info-label">Approved Amount</span>
                                            <span className="bi-info-value" style={{ color: '#52c41a', fontWeight: 600 }}>
                                                ₱{Number(selectedRefund?.approved_amount || selectedRefund?.amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <Form form={refundReleaseForm} layout="vertical" onFinish={handleReleaseRefund}>
                                    <Form.Item
                                        name="released_amount"
                                        label="Amount to Release"
                                        rules={[
                                            { required: true, message: 'Please enter the amount to release' },
                                            { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }
                                        ]}
                                    >
                                        <InputNumber
                                            min={0.01}
                                            style={{ width: '100%' }}
                                            prefix="₱"
                                            placeholder="0.00"
                                            className="bi-form-input"
                                            size="large"
                                        />
                                    </Form.Item>
                                    <Form.Item name="payment_method" label="Payment Method" rules={[{ required: true }]}>
                                        <Select className="bi-form-select" size="large">
                                            <Option value="cash">
                                                <Space><BankOutlined /> Cash</Space>
                                            </Option>
                                            <Option value="gcash">
                                                <Space><WalletOutlined /> GCash</Space>
                                            </Option>
                                            <Option value="maya">
                                                <Space><WalletOutlined /> Maya</Space>
                                            </Option>
                                            <Option value="bank_transfer">
                                                <Space><BankOutlined /> Bank Transfer</Space>
                                            </Option>
                                            <Option value="card">
                                                <Space><CreditCardOutlined /> Card</Space>
                                            </Option>
                                            <Option value="check">
                                                <Space><FileTextOutlined /> Check</Space>
                                            </Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item name="reference_number" label="Reference Number (Optional)">
                                        <Input placeholder="Transaction reference" className="bi-form-input" size="large" />
                                    </Form.Item>
                                    <Form.Item name="notes" label="Notes (Optional)">
                                        <TextArea rows={2} placeholder="Additional notes..." className="bi-form-textarea" />
                                    </Form.Item>
                                    <div className="bi-modal-footer-enhanced">
                                        <Button onClick={() => { setRefundReleaseModalVisible(false); setSelectedRefund(null); }}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            icon={<CheckCircleOutlined />}
                                            loading={refundReleaseMutation.isPending}
                                            disabled={refundReleaseMutation.isPending}
                                            style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                        >
                                            Release Refund
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </Modal>

                        {/* REFUND REJECT MODAL */}
                        <Modal
                            title={
                                <div className="bi-modal-header-enhanced bi-modal-header-danger">
                                    <div className="bi-modal-icon" style={{ background: '#ff4d4f' }}>
                                        <CloseCircleOutlined />
                                    </div>
                                    <div className="bi-modal-title-group">
                                        <span className="bi-modal-title">Reject Refund</span>
                                        <span className="bi-modal-subtitle">Reject this refund request</span>
                                    </div>
                                    <div className="bi-modal-badge-group">
                                        <span className="bi-modal-badge">{selectedRefund?.refund_number || 'N/A'}</span>
                                    </div>
                                </div>
                            }
                            open={refundRejectModalVisible}
                            onCancel={() => {
                                setRefundRejectModalVisible(false);
                                refundRejectForm.resetFields();
                                setSelectedRefund(null);
                            }}
                            width={520}
                            footer={null}
                            className={modalClass}
                            destroyOnClose
                        >
                            <div className="bi-modal-body-enhanced">
                                <Alert
                                    message="Reject Refund Request"
                                    description="The customer will be notified of this decision. This action cannot be undone."
                                    type="error"
                                    showIcon
                                    style={{ marginBottom: 20 }}
                                    className={isDarkMode ? 'bi-alert-dark' : ''}
                                />

                                <Form form={refundRejectForm} layout="vertical" onFinish={handleRejectRefund}>
                                    <Form.Item
                                        name="reason"
                                        label="Rejection Reason"
                                        rules={[{ required: true, message: 'Please provide a reason for rejection' }]}
                                    >
                                        <TextArea
                                            rows={4}
                                            placeholder="Explain why this refund is being rejected..."
                                            maxLength={500}
                                            showCount
                                            className="bi-form-textarea"
                                        />
                                    </Form.Item>
                                    <div className="bi-modal-footer-enhanced">
                                        <Button onClick={() => { setRefundRejectModalVisible(false); setSelectedRefund(null); }}>
                                            Cancel
                                        </Button>
                                        <Button
                                            danger
                                            type="primary"
                                            htmlType="submit"
                                            icon={<CloseCircleOutlined />}
                                            loading={refundRejectMutation.isPending}
                                            disabled={refundRejectMutation.isPending}
                                        >
                                            Reject Refund
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </Modal>

                        {/* REFUND DETAILS MODAL */}
                        <Modal
                            title={
                                <div className="bi-modal-header-enhanced">
                                    <div className="bi-modal-icon" style={{ background: 'linear-gradient(135deg, #722ed1, #531dab)' }}>
                                        <RollbackOutlined />
                                    </div>
                                    <div className="bi-modal-title-group">
                                        <span className="bi-modal-title">Refund Details</span>
                                        <span className="bi-modal-subtitle">Complete refund information</span>
                                    </div>
                                    <div className="bi-modal-badge-group">
                                        <span className="bi-modal-badge">{selectedRefund?.refund_number || 'N/A'}</span>
                                        {selectedRefund?.status && (
                                            <span className="bi-status-badge" style={{
                                                color: getRefundStatusConfig(selectedRefund.status).color,
                                                background: getRefundStatusConfig(selectedRefund.status).bg,
                                                padding: '4px 14px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {getRefundStatusConfig(selectedRefund.status).icon} {getRefundStatusConfig(selectedRefund.status).text}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            }
                            open={refundDetailsModalVisible}
                            onCancel={() => { setRefundDetailsModalVisible(false); setSelectedRefund(null); }}
                            width={700}
                            footer={
                                <div className="bi-modal-footer-enhanced">
                                    <Button
                                        type="primary"
                                        onClick={() => { setRefundDetailsModalVisible(false); setSelectedRefund(null); }}
                                        className="bi-footer-btn bi-footer-btn-close"
                                    >
                                        Close
                                    </Button>
                                </div>
                            }
                            destroyOnClose
                        >
                            {selectedRefund && (
                                <div className="bi-modal-body-enhanced">
                                    {/* Refund Summary Cards */}
                                    <div className="bi-invoice-summary-grid">
                                        <div className="bi-summary-card">
                                            <div className="bi-summary-icon" style={{ background: '#e8f0fe', color: '#1a7ab5' }}>
                                                <DollarOutlined />
                                            </div>
                                            <div>
                                                <div className="bi-summary-label">Refund Amount</div>
                                                <div className="bi-summary-value">₱{Number(selectedRefund.amount || 0).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="bi-summary-card">
                                            <div className="bi-summary-icon" style={{ background: '#fff7e6', color: '#faad14' }}>
                                                <WalletOutlined />
                                            </div>
                                            <div>
                                                <div className="bi-summary-label">Deposit Snapshot</div>
                                                <div className="bi-summary-value" style={{ color: '#faad14' }}>
                                                    ₱{Number(selectedRefund.deposit_snapshot || 0).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bi-summary-card">
                                            <div className="bi-summary-icon" style={{ background: '#e6f7e6', color: '#52c41a' }}>
                                                <CheckCircleOutlined />
                                            </div>
                                            <div>
                                                <div className="bi-summary-label">Released Amount</div>
                                                <div className="bi-summary-value" style={{ color: '#52c41a' }}>
                                                    ₱{Number(selectedRefund.released_amount || 0).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bi-summary-card">
                                            <div className="bi-summary-icon" style={{ background: '#f0f0f0', color: '#8c8c8c' }}>
                                                <ClockCircleOutlined />
                                            </div>
                                            <div>
                                                <div className="bi-summary-label">Source</div>
                                                <div className="bi-summary-value" style={{ textTransform: 'capitalize' }}>
                                                    {selectedRefund.source || 'booking'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Relations */}
                                    <div className="bi-info-section">
                                        <div className="bi-section-header">
                                            <FileTextOutlined style={{ color: '#1a7ab5' }} />
                                            <span className="bi-section-title-text">Related Records</span>
                                        </div>
                                        <div className="bi-info-grid">
                                            <div className="bi-info-item">
                                                <span className="bi-info-label">Booking #</span>
                                                <span className="bi-info-value">
                                                    {selectedRefund.booking?.booking_no || selectedRefund.invoice?.booking?.booking_no || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="bi-info-item">
                                                <span className="bi-info-label">Invoice #</span>
                                                <span className="bi-info-value">{selectedRefund.invoice?.invoice_number || 'N/A'}</span>
                                            </div>
                                            <div className="bi-info-item">
                                                <span className="bi-info-label">Payment #</span>
                                                <span className="bi-info-value">
                                                    {selectedRefund.payment?.payment_number || selectedRefund.payment_id || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="bi-info-item">
                                                <span className="bi-info-label">Customer</span>
                                                <span className="bi-info-value">
                                                    {(() => {
                                                        const person = selectedRefund.booking?.serviceEvent?.customer?.person
                                                            || selectedRefund.invoice?.booking?.serviceEvent?.customer?.person;
                                                        return person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown' : 'Unknown';
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div className="bi-info-section">
                                        <div className="bi-section-header">
                                            <InfoCircleOutlined style={{ color: '#1a7ab5' }} />
                                            <span className="bi-section-title-text">Refund Reason</span>
                                        </div>
                                        <div className="bi-notes-content">{selectedRefund.reason || '—'}</div>
                                    </div>

                                    {/* Admin Notes */}
                                    {selectedRefund.admin_notes && (
                                        <div className="bi-info-section">
                                            <div className="bi-section-header">
                                                <AuditOutlined style={{ color: '#1a7ab5' }} />
                                                <span className="bi-section-title-text">Admin Notes</span>
                                            </div>
                                            <div className="bi-notes-content">{selectedRefund.admin_notes}</div>
                                        </div>
                                    )}

                                    {/* Rejection Reason */}
                                    {selectedRefund.rejection_reason && (
                                        <div className="bi-info-section">
                                            <div className="bi-section-header">
                                                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                                <span className="bi-section-title-text">Rejection Reason</span>
                                            </div>
                                            <div className="bi-notes-content" style={{ color: '#ff4d4f' }}>{selectedRefund.rejection_reason}</div>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div className="bi-info-section">
                                        <div className="bi-section-header">
                                            <HistoryOutlined style={{ color: '#1a7ab5' }} />
                                            <span className="bi-section-title-text">Refund Timeline</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {selectedRefund.requested_at && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(250,173,20,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#faad14' }}>
                                                        <ClockCircleOutlined />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>Requested</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                                            {dayjs(selectedRefund.requested_at).format('MMMM DD, YYYY h:mm A')}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedRefund.approved_at && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(24,144,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1890ff' }}>
                                                        <CheckCircleOutlined />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>Approved</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                                            {dayjs(selectedRefund.approved_at).format('MMMM DD, YYYY h:mm A')}
                                                            {selectedRefund.approved_by?.name && ` by ${selectedRefund.approved_by.name}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedRefund.released_at && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(82,196,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52c41a' }}>
                                                        <RollbackOutlined />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>Released</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                                            {dayjs(selectedRefund.released_at).format('MMMM DD, YYYY h:mm A')}
                                                            {selectedRefund.released_by?.name && ` by ${selectedRefund.released_by.name}`}
                                                        </div>
                                                        {selectedRefund.payment_method && (
                                                            <div style={{ fontSize: 12, color: '#64748b' }}>
                                                                via {selectedRefund.payment_method.toUpperCase()}
                                                                {selectedRefund.reference_number && ` • Ref: ${selectedRefund.reference_number}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedRefund.rejected_at && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,77,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f' }}>
                                                        <CloseCircleOutlined />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>Rejected</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                                            {dayjs(selectedRefund.rejected_at).format('MMMM DD, YYYY h:mm A')}
                                                            {selectedRefund.rejected_by?.name && ` by ${selectedRefund.rejected_by.name}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Modal>
                    </>
                )}
            </div>
        </ConfigProvider>
    );
};

export default BillingInvoicing;