// Catering-Management/web/src/pages/dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  ComposedChart, Line,
} from 'recharts';
import {
  LayoutDashboard, Calendar, Users, DollarSign,
  ShoppingBag, CheckCircle,
  Package, TrendingUp, Truck,
  CreditCard, ArrowUp, ArrowDown, RefreshCw,
  PieChart as PieChartIcon,
  Zap, Award, Target, BarChart3, Activity,
  TrendingDown, CircleDollarSign,
  Clock, FileText, ChartBar, Crown, Utensils, User,
  Printer, X,
  ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';
import { useDashboardData, EMPTY_DASHBOARD_DATA } from '../../../hooks/useDashboardQueries';
import { useAuth } from '../../../contexts/AuthContext';
import {
  ADMIN_ROLES, CASHIER_ROLES, INVENTORY_MANAGER_ROLES, STAFF_MANAGER_ROLES, hasAllowedRole,
} from '../../../utils/roleRoutes';
import RoleFocusedDashboard from './RoleFocusedDashboard';
import api from '../../../services/api';
import '../../dashboard/styles/Dashboard.css';

const COLORS = ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', '#f8961e', '#f9c74f', '#90be6d'];
const PIE_COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e', '#1e293b', '#6b7280'];

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ⭐ Period selector options
const PERIOD_OPTIONS = [
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' },
];

// ⭐ Helper: shift an anchor date forward/backward by one period
const shiftAnchor = (period, anchorDate, direction) => {
  const d = anchorDate ? new Date(anchorDate) : new Date();
  if (period === 'weekly')  d.setDate(d.getDate() + direction * 7);
  if (period === 'monthly') d.setMonth(d.getMonth() + direction);
  if (period === 'yearly')  d.setFullYear(d.getFullYear() + direction);
  return d.toISOString().slice(0, 10);
};

const todayAnchor = () => new Date().toISOString().slice(0, 10);

const safeArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const formatNumber = (value) => toNumber(value).toLocaleString();
const formatCurrency = (value) => `₱${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const formatPercent = (value) => `${toNumber(value).toFixed(1)}%`;
const formatCompact = (value) => {
  const num = toNumber(value);
  if (Math.abs(num) >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `₱${(num / 1000).toFixed(1)}K`;
  return formatCurrency(num);
};

// ============================================================
// COUNT-UP HOOK
// ============================================================
const useCountUp = (target, { duration = 1400, start = false, decimals = 0 } = {}) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) {
      setValue(0);
      return;
    }

    const numericTarget = Number(target);
    if (!Number.isFinite(numericTarget)) {
      setValue(target);
      return;
    }

    let rafId;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numericTarget * eased;

      setValue(decimals > 0
        ? Number(current.toFixed(decimals))
        : Math.floor(current));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setValue(numericTarget);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, start, decimals]);

  return value;
};

const CountUpValue = ({ value, start = false, duration = 700 }) => {
  const str = String(value ?? '');
  const match = str.match(/^([^\d.-]*)(-?[\d,.]+(?:\.\d+)?)(.*)$/);

  if (!match) {
    return <strong>{str}</strong>;
  }

  const [, prefix, numStr, suffix] = match;
  const cleanNumStr = numStr.replace(/,/g, '');
  const numeric = parseFloat(cleanNumStr);
  const decimals = (cleanNumStr.split('.')[1] || '').length;
  const hasComma = numStr.includes(',');

  const animated = useCountUp(numeric, { duration, start, decimals });

  const formatted = decimals > 0
    ? animated.toFixed(decimals)
    : animated.toLocaleString();

  const finalFormatted = hasComma || !decimals
    ? Number(formatted.replace(/,/g, '')).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : formatted;

  return <strong>{prefix}{finalFormatted}{suffix}</strong>;
};

// ============================================================
// SKELETONS (unchanged)
// ============================================================
const SkeletonText = ({ width = '100%', height = 14, className = '', style = {} }) => (
  <div className={`dash-skeleton-text ${className}`} style={{ width, height, ...style }} />
);

const SkeletonCircle = ({ size = 48, className = '', style = {} }) => (
  <div
    className={`dash-skeleton-circle ${className}`}
    style={{ width: size, height: size, minWidth: size, ...style }}
  />
);

const SkeletonHeader = () => (
  <header className="dash-header dash-skeleton-card">
    <div className="dash-header-left">
      <div className="dash-header-brand">
        <SkeletonCircle size={36} style={{ borderRadius: 10 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonText width={200} height={20} style={{ borderRadius: 6 }} />
          <SkeletonText width={260} height={12} style={{ borderRadius: 6 }} />
        </div>
      </div>
    </div>
    <div className="dash-header-right">
      <SkeletonText width={70} height={32} style={{ borderRadius: 20 }} />
      <SkeletonCircle size={40} style={{ borderRadius: 10 }} />
      <SkeletonCircle size={40} style={{ borderRadius: 10 }} />
    </div>
  </header>
);

const SkeletonKpiCard = ({ delay = 0 }) => (
  <div className="dash-kpi-card dash-skeleton-card" style={{ animationDelay: `${delay}s` }}>
    <div className="dash-kpi-left">
      <SkeletonCircle size={48} style={{ borderRadius: 12 }} />
      <div className="dash-kpi-info" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonText width={80} height={12} />
        <SkeletonText width={120} height={22} />
        <SkeletonText width={60} height={18} style={{ borderRadius: 12 }} />
      </div>
    </div>
  </div>
);

const SkeletonKpiGrid = () => (
  <div className="dash-kpi-grid">
    {Array.from({ length: 8 }).map((_, i) => (
      <SkeletonKpiCard key={i} delay={i * 0.05} />
    ))}
  </div>
);

const SkeletonChartCard = ({ height = 240, delay = 0 }) => (
  <div className="dash-chart-card dash-skeleton-card" style={{ animationDelay: `${delay}s` }}>
    <div className="dash-chart-header">
      <div className="dash-chart-title-group">
        <SkeletonCircle size={24} style={{ borderRadius: 6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonText width={140} height={15} />
          <SkeletonText width={110} height={11} />
        </div>
      </div>
    </div>
    <div className="dash-chart-body" style={{ height, display: 'flex', alignItems: 'flex-end', gap: 10, padding: '20px 0' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="dash-skeleton-bar" style={{ flex: 1, height: `${30 + ((i * 17) % 60)}%` }} />
      ))}
    </div>
  </div>
);

const SkeletonTableCard = ({ rows = 5, delay = 0 }) => {
  const rowWidths = [
    [140, 120, 160, 70],
    [120, 130, 170, 60],
    [150, 110, 150, 75],
    [130, 125, 165, 65],
    [140, 115, 155, 70],
  ];

  return (
    <div className="dash-table-card dash-skeleton-card" style={{ animationDelay: `${delay}s` }}>
      <div className="dash-table-header">
        <div className="dash-table-title-group">
          <SkeletonCircle size={22} style={{ borderRadius: 6 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonText width={140} height={15} />
            <SkeletonText width={180} height={12} />
          </div>
        </div>
        <SkeletonText width={70} height={24} style={{ borderRadius: 12 }} />
      </div>
      <div className="dash-table-wrapper">
        <table className="dash-table">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => {
              const widths = rowWidths[i % rowWidths.length];
              return (
                <tr key={i}>
                  <td style={{ width: '38%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <SkeletonCircle size={26} />
                      <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                        <SkeletonText width={widths[0]} height={12} />
                        <SkeletonText width={widths[1]} height={12} />
                      </div>
                    </div>
                  </td>
                  <td style={{ width: '34%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <SkeletonText width={widths[2]} height={12} />
                      <SkeletonText width={60} height={20} style={{ borderRadius: 10 }} />
                    </div>
                  </td>
                  <td style={{ width: '28%', textAlign: 'right' }}>
                    <SkeletonText width={70} height={20} style={{ borderRadius: 10, marginLeft: 'auto' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SkeletonInsights = () => (
  <div className="dash-insights">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="dash-insight dash-skeleton-card" style={{ animationDelay: `${i * 0.05}s` }}>
        <SkeletonCircle size={24} style={{ borderRadius: 6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <SkeletonText width={70} height={11} />
          <SkeletonText width={100} height={14} />
          <SkeletonText width={60} height={11} />
        </div>
      </div>
    ))}
  </div>
);

const DashboardSkeleton = () => {
  const isDark = (() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.body.classList.contains('dark-mode');
  })();

  return (
    <div className={`dash-container dash-skeleton-container ${isDark ? 'dash-dark-mode' : ''}`}>
      <div className="dash-inner">
        <SkeletonHeader />
        <SkeletonKpiGrid />
        <div className="dash-section">
          <div className="dash-chart-card-wide">
            <SkeletonChartCard height={280} delay={0.1} />
          </div>
        </div>
        <div className="dash-section">
          <div className="dash-tables-row">
            <SkeletonTableCard rows={4} delay={0.15} />
            <SkeletonTableCard rows={4} delay={0.2} />
          </div>
        </div>
        <div className="dash-section">
          <div className="dash-charts-row-3">
            <SkeletonChartCard height={200} delay={0.25} />
            <SkeletonChartCard height={200} delay={0.3} />
            <SkeletonChartCard height={200} delay={0.35} />
          </div>
        </div>
        <div className="dash-section">
          <div className="dash-tables-row">
            <SkeletonTableCard rows={5} delay={0.4} />
            <SkeletonTableCard rows={4} delay={0.45} />
          </div>
        </div>
        <div className="dash-section">
          <div className="dash-charts-row-3">
            <SkeletonChartCard height={200} delay={0.5} />
            <SkeletonChartCard height={200} delay={0.55} />
            <SkeletonChartCard height={200} delay={0.6} />
          </div>
        </div>
        <div className="dash-section">
          <div className="dash-tables-row">
            <SkeletonTableCard rows={5} delay={0.65} />
            <SkeletonTableCard rows={5} delay={0.7} />
          </div>
        </div>
        <div className="dash-section">
          <div className="dash-charts-row-2">
            <SkeletonChartCard height={200} delay={0.75} />
            <SkeletonChartCard height={200} delay={0.8} />
          </div>
        </div>
        <SkeletonInsights />
        <footer className="dash-footer dash-skeleton-footer">
          <SkeletonText width={280} height={13} />
          <SkeletonText width={120} height={13} />
        </footer>
      </div>
    </div>
  );
};

const EmptyState = ({ message = 'No data available' }) => (
  <div className="dash-empty-state">
    <Package className="dash-icon-md" />
    <span>{message}</span>
  </div>
);

// ============================================================
// ZOOMABLE PANEL
// ============================================================
const ZoomablePanel = ({
  children, title, onClose, isZoomed, panelId, onZoom, className = '', style = {},
}) => {
  useEffect(() => {
    if (isZoomed) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prevOverflow; };
    }
  }, [isZoomed]);

  if (isZoomed) {
    return createPortal(
      <div className="dash-zoom-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="dash-zoom-panel">
          <div className="dash-zoom-header">
            <h3>{title || 'Panel View'}</h3>
            <button className="dash-zoom-close" onClick={onClose}><X size={20} /></button>
          </div>
          <div className="dash-zoom-body">{children}</div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div
      className={`dash-zoom-trigger ${className}`}
      onClick={() => onZoom(panelId)}
      style={{ cursor: 'pointer', ...style }}
    >
      {children}
    </div>
  );
};

// ============================================================
// DETAIL MODAL — fetches underlying records via /dashboard/detail/{card}
// ============================================================
const DetailModal = ({ cardKey, period, anchor, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/dashboard/detail/${cardKey}`, {
          params: { period, anchor },
        });
        if (!cancelled) setData(res?.data?.data || null);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || err.message || 'Failed to load details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      document.body.style.overflow = 'auto';
    };
  }, [cardKey, period, anchor]);

  const rows = safeArray(data?.rows);
  const columns = safeArray(data?.columns);

  const renderCell = (row, col) => {
    const val = row?.[col];
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      if (col.includes('amount') || col.includes('balance') || col.includes('value') || col.includes('paid')) {
        return formatCurrency(val);
      }
      return val.toLocaleString();
    }
    return String(val);
  };

  const handleViewDetails = () => {
    if (data?.navigate) window.location.href = data.navigate;
  };

  return createPortal(
    <div className="dash-zoom-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-zoom-panel" style={{ maxWidth: 1100 }}>
        <div className="dash-zoom-header">
          <h3>{data?.title || 'Details'}</h3>
          <button className="dash-zoom-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="dash-zoom-body">
          {loading && <div className="dash-empty-state">Loading details…</div>}
          {error && !loading && <div className="dash-alert">{error}</div>}
          {!loading && !error && (
            <>
              <div className="dash-detail-summary">
                <span>Total</span>
                <strong>
                  {typeof data?.total === 'number'
                    ? (data.title?.includes('Bookings') || data.title?.includes('Events') || data.title?.includes('Staff')
                        ? data.total.toLocaleString()
                        : formatCurrency(data.total))
                    : '—'}
                </strong>
              </div>
              <div className="dash-table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      {columns.length > 0
                        ? columns.map((col) => (
                            <th key={col}>{col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</th>
                          ))
                        : <th>Record</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row, i) => (
                        <tr key={i}>
                          {columns.map((col) => (
                            <td key={col}>{renderCell(row, col)}</td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.length || 1} className="dash-table-empty">
                          No records in this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {data?.navigate && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="dash-refresh-btn" onClick={handleViewDetails} style={{ padding: '8px 16px' }}>
                    <ExternalLink size={16} style={{ marginRight: 8 }} />
                    View Details
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="dash-tooltip">
        <p className="dash-tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="dash-tooltip-value" style={{ color: p.color || p.fill }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ============================================================
// MAIN DASHBOARD
// ============================================================
function AdminDashboard() {
  const [animate, setAnimate] = useState(false);
  const [zoomedPanel, setZoomedPanel] = useState(null);
  const [detailCard, setDetailCard] = useState(null);
  const [chartsReady, setChartsReady] = useState(false);

  // ⭐ Period state
  const [period, setPeriod] = useState('monthly');
  const [anchor, setAnchor] = useState(todayAnchor());

  const [showSkeleton, setShowSkeleton] = useState(() => {
    try {
      const raw = localStorage.getItem('catering-dashboard-cache');
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      const savedAt = parsed?.timestamp ?? 0;
      const age = Date.now() - savedAt;
      if (!savedAt || age > TWENTY_FOUR_HOURS) return true;
      return false;
    } catch {
      return true;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.body.classList.contains('dark-mode');
  });

  // ⭐ Pass period + anchor to hook. Backend endpoint accepts `?period=&anchor=`
  const {
    data: dashboardData = EMPTY_DASHBOARD_DATA,
    isLoading,
    isFetching,
    error: dashboardError,
    refetch,
  } = useDashboardData(period, anchor);

  const hasAnyData =
    dashboardData &&
    (
      (dashboardData.stats && Object.keys(dashboardData.stats).length > 0) ||
      (dashboardData.charts && Object.keys(dashboardData.charts).length > 0)
    );

  const loading = isLoading && !hasAnyData;
  const refreshing = isFetching && !loading;
  const error = dashboardError?.message || dashboardData.warning || '';

  const stats = dashboardData.stats || {};
  const charts = dashboardData.charts || {};
  const inventoryReport = dashboardData.inventoryReport || {};
  const inventoryDashboard = dashboardData.inventoryDashboard || {};
  const financial = dashboardData.financial || {};
  const payroll = dashboardData.payroll || {};
  const events = dashboardData.events || {};
  const reports = dashboardData.reports || {};

  useEffect(() => {
    if (!loading) {
      const raf = requestAnimationFrame(() => {
        setShowSkeleton(false);
        setAnimate(true);
        setChartsReady(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    setShowSkeleton(true);
    setAnimate(false);
    setChartsReady(false);
  }, [loading]);

  useEffect(() => {
    const handleThemeChange = (e) => setIsDarkMode(Boolean(e?.detail?.isDark));
    const handleStorage = (e) => { if (e.key === 'theme') setIsDarkMode(e.newValue === 'dark'); };
    window.addEventListener('themeChange', handleThemeChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleZoom = useCallback((panelId) => { if (panelId) setZoomedPanel(panelId); }, []);
  const handleZoomClose = useCallback(() => setZoomedPanel(null), []);

  // ⭐ Open detail modal when a KPI card is clicked
  const handleCardClick = useCallback((cardKey) => {
    if (cardKey) setDetailCard(cardKey);
  }, []);

  // ⭐ Period navigation
  const goPrev = () => setAnchor((a) => shiftAnchor(period, a, -1));
  const goNext = () => {
    const next = shiftAnchor(period, anchor, 1);
    if (new Date(next) <= new Date()) setAnchor(next);
  };
  const resetToToday = () => setAnchor(todayAnchor());

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setAnchor(todayAnchor());
  };

  // ============================================================
  // KPI DATA — reads from stats (backend-computed)
  // ============================================================
  const kpiData = useMemo(() => {
    const cards = dashboardData.cards || {};

    const getChange = (key, fallback = 0) => {
      const v = toNumber(stats[key] ?? fallback);
      return {
        label: v === 0 ? '0%' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
        type: v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral',
      };
    };

    const salesChange = getChange('sales_growth');
    const revenueChange = getChange('revenue_growth');
    const expensesChange = getChange('expenses_growth');
    const profitChange = getChange('profit_growth');
    const bookingsChange = getChange('booking_growth');
    const completedChange = getChange('completed_growth');

    return [
      {
        id: 'total_sales',
        label: 'Total Sales',
        value: formatCurrency(stats.total_sales ?? 0),
        icon: ShoppingBag,
        bgColor: '#eef2ff',
        color: '#4361ee',
        change: salesChange.label,
        changeType: salesChange.type,
      },
      {
        id: 'total_revenue',
        label: 'Total Payments Collected',
        value: formatCurrency(stats.total_revenue ?? 0),
        icon: DollarSign,
        bgColor: '#d1fae5',
        color: '#10b981',
        change: revenueChange.label,
        changeType: revenueChange.type,
      },
      {
        id: 'total_expenses',
        label: 'Total Expenses',
        value: formatCurrency(stats.total_expenses ?? 0),
        icon: TrendingDown,
        bgColor: '#fef2f2',
        color: '#ef4444',
        change: expensesChange.label,
        changeType: expensesChange.type,
      },
      {
        id: 'total_profit',
        label: 'Total Profit',
        value: formatCurrency(stats.total_profit ?? 0),
        icon: CircleDollarSign,
        bgColor: '#ede9fe',
        color: '#8b5cf6',
        change: profitChange.label,
        changeType: profitChange.type,
      },
      {
        id: 'total_pending',
        label: 'Total Pending',
        value: formatCurrency(stats.total_pending ?? stats.outstanding_balance ?? 0),
        icon: CreditCard,
        bgColor: '#fef3c7',
        color: '#f59e0b',
        change: 'N/A',
        changeType: 'neutral',
      },
      {
        id: 'total_bookings',
        label: 'Total Bookings',
        value: formatNumber(stats.total_bookings ?? 0),
        icon: Calendar,
        bgColor: '#e0f2fe',
        color: '#0ea5e9',
        change: bookingsChange.label,
        changeType: bookingsChange.type,
      },
      {
        id: 'completed_events',
        label: 'Completed Events',
        value: formatNumber(stats.completed_events ?? 0),
        icon: CheckCircle,
        bgColor: '#dcfce7',
        color: '#22c55e',
        change: completedChange.label,
        changeType: completedChange.type,
      },
      {
        id: 'active_staff',
        label: 'Active Staff',
        value: formatNumber(stats.active_staff ?? 0),
        icon: Users,
        bgColor: '#f3f4f6',
        color: '#6b7280',
        change: 'N/A',
        changeType: 'neutral',
      },
    ];
  }, [stats, dashboardData.cards]);

  // ============================================================
  // CHART DATA
  // ============================================================
  const revenueExpenseData = useMemo(() => {
    const data = safeArray(charts.revenue_data || []);
    return data.map((item) => ({
      month: item.period || item.month || item.date || 'N/A',
      revenue: toNumber(item.revenue || 0),
      expenses: toNumber(item.expenses || 0),
      profit: toNumber(item.profit ?? (toNumber(item.revenue || 0) - toNumber(item.expenses || 0))),
    }));
  }, [charts.revenue_data]);

  const bookingTrendData = useMemo(() => {
    const data = safeArray(charts.booking_trends || []);
    return data.map((item) => ({
      month: item.period || item.month || 'N/A',
      completed: toNumber(item.completed || 0),
      cancelled: toNumber(item.cancelled || 0),
      bookings: toNumber(item.bookings || 0),
    }));
  }, [charts.booking_trends]);

  const stockMovementData = useMemo(() => {
    const data = safeArray(charts.stock_movement || []);
    return data.map((item) => ({
      period: item.period || 'N/A',
      incoming: toNumber(item.incoming || 0),
      outgoing: toNumber(item.outgoing || 0),
      wastage: toNumber(item.wastage || 0),
    }));
  }, [charts.stock_movement]);

  const weeklyPerformanceData = useMemo(() => {
    const data = safeArray(charts.weekly_performance || []);
    return data.map((item) => ({
      period: item.period || 'N/A',
      revenue: toNumber(item.revenue || 0),
      orders: toNumber(item.orders || 0),
    }));
  }, [charts.weekly_performance]);

  const revenueByEventData = useMemo(() => {
    const data = safeArray(charts.event_types || []);
    return data
      .filter((d) => toNumber(d.revenue || 0) > 0)
      .map((item, index) => ({
        name: item.name || 'Unknown',
        value: toNumber(item.revenue || 0),
        color: PIE_COLORS[index % PIE_COLORS.length],
      }));
  }, [charts.event_types]);

  const eventTypeCountData = useMemo(() => {
    const data = safeArray(charts.event_types || []);
    return data
      .filter((d) => toNumber(d.count || d.value || 0) > 0)
      .map((item, index) => ({
        name: item.name || 'Unknown',
        value: toNumber(item.count || item.value || 0),
        color: COLORS[index % COLORS.length],
      }));
  }, [charts.event_types]);

  const inventoryDistributionData = useMemo(() => {
    const data = safeArray(charts.inventory_distribution || []);
    return data
      .map((item, index) => ({
        name: item.name || 'Uncategorized',
        value: toNumber(item.value || 0),
        color: COLORS[index % COLORS.length],
      }))
      .filter((item) => item.value > 0);
  }, [charts.inventory_distribution]);

  const monthlyExpenseData = useMemo(() => {
    const data = safeArray(charts.monthly_expenses || []);
    return data.map((item) => ({
      month: item.month || 'N/A',
      expenses: toNumber(item.expenses || 0),
      profit: toNumber(item.profit || 0),
    }));
  }, [charts.monthly_expenses]);

  const menuPerformanceData = useMemo(() => {
    const data = safeArray(charts.menu_performance || []);
    return data.map((item) => ({
      name: item.name || 'Menu Item',
      popularity: toNumber(item.popularity || 0),
      revenue: toNumber(item.revenue || 0),
    }));
  }, [charts.menu_performance]);

  // ============================================================
  // TABLES
  // ============================================================
  const upcomingEvents = useMemo(() => {
    const eventsData = safeArray(stats.upcoming_event_rows || []);
    return eventsData
      .filter((event) => event.event_date && new Date(event.event_date) >= new Date())
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
      .slice(0, 6)
      .map((event) => ({
        id: event.booking_id || event.id,
        event: event.eventType?.name || event.event_name || 'Event',
        date: event.event_date
          ? new Date(event.event_date).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })
          : 'TBD',
        time: event.event_time || 'TBD',
        venue: event.venue || 'TBD',
        guests: event.guests_count || 0,
        status: event.status || 'pending',
      }));
  }, [stats.upcoming_event_rows]);

  const outstandingInvoices = useMemo(() => {
    const data = safeArray(charts.outstanding_invoices || []);
    return data.slice(0, 6).map((inv) => ({
      id: inv.invoice_id,
      invoice_number: inv.invoice_number || 'N/A',
      customer_name: inv.customer_name || 'Unknown',
      total_amount: toNumber(inv.total_amount || 0),
      balance: toNumber(inv.balance || inv.total_amount || 0),
      due_date: inv.due_date
        ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A',
      status: inv.status || 'unpaid',
      days_overdue: toNumber(inv.days_overdue || 0),
    }));
  }, [charts.outstanding_invoices]);

  const eventProfitability = useMemo(() => {
    const data = safeArray(charts.event_profitability || []);
    return data.slice(0, 8).map((item) => ({
      id: item.event_id,
      booking_id: item.booking_id || 'N/A',
      event: item.event || 'Event',
      event_type: item.event_type || 'General',
      revenue: toNumber(item.revenue || 0),
      cost: toNumber(item.cost || 0),
      profit: toNumber(item.profit || 0),
      margin: toNumber(item.margin || 0),
      status: item.status || 'completed',
    }));
  }, [charts.event_profitability]);

  const topPackages = useMemo(() => {
    const data = safeArray(charts.top_packages || []);
    return data.slice(0, 6).map((pkg) => ({
      name: pkg.name || 'Package',
      orders: toNumber(pkg.orders || 0),
      revenue: toNumber(pkg.revenue || 0),
      avg_value: toNumber(pkg.avg_value || (pkg.orders ? pkg.revenue / pkg.orders : 0)),
    }));
  }, [charts.top_packages]);

  const topMenuItems = useMemo(() => {
    const data = safeArray(charts.top_menu_items || []);
    return data.slice(0, 6).map((item) => ({
      id: item.id,
      name: item.name || 'Menu Item',
      orders: toNumber(item.orders || 0),
      revenue: toNumber(item.revenue || 0),
      popularity: toNumber(item.popularity || item.orders || 0),
    }));
  }, [charts.top_menu_items]);

  const payrollByEmployee = useMemo(() => {
    const data = safeArray(charts.payroll_by_employee || []);
    return data.slice(0, 6).map((item) => ({
      id: item.id,
      employee_name: item.employee_name || 'Employee',
      position: item.position || 'Staff',
      gross_pay: toNumber(item.gross_pay || 0),
      deductions: toNumber(item.deductions || 0),
      net_pay: toNumber(item.net_pay || 0),
    }));
  }, [charts.payroll_by_employee]);

  // ============================================================
  // QUICK INSIGHTS
  // ============================================================
  const quickInsights = useMemo(() => {
    const insights = [];

    if (topMenuItems.length > 0) {
      insights.push({
        id: 'fastest-moving',
        icon: Zap,
        label: 'Fastest Moving',
        value: topMenuItems[0].name,
        detail: `${topMenuItems[0].orders} orders`,
      });
    }

    if (eventTypeCountData.length > 0) {
      insights.push({
        id: 'top-event-type',
        icon: Award,
        label: 'Top Event Type',
        value: eventTypeCountData[0].name,
        detail: `${eventTypeCountData[0].value} events`,
      });
    }

    if (revenueByEventData.length > 0) {
      insights.push({
        id: 'highest-revenue',
        icon: Target,
        label: 'Highest Revenue',
        value: revenueByEventData[0].name,
        detail: formatCurrency(revenueByEventData[0].value),
      });
    }

    insights.push({
      id: 'active-staff',
      icon: Users,
      label: 'Active Staff',
      value: formatNumber(toNumber(stats.active_staff || 0)),
      detail: 'Current employees',
    });

    const bookingsVal = toNumber(stats.total_bookings || 0);
    insights.push({
      id: 'total-bookings',
      icon: Calendar,
      label: 'Total Bookings',
      value: formatNumber(bookingsVal),
      detail: 'Approved only',
    });

    const completedVal = toNumber(stats.completed_events || 0);
    const completionRate = bookingsVal > 0 ? (completedVal / bookingsVal) * 100 : 0;
    insights.push({
      id: 'completion-rate',
      icon: CheckCircle,
      label: 'Completion Rate',
      value: formatPercent(completionRate),
      detail: `${formatNumber(completedVal)} completed`,
    });

    return insights;
  }, [topMenuItems, eventTypeCountData, revenueByEventData, stats]);

  // ============================================================
  // RENDER KPI (clickable → detail modal)
  // ============================================================
  const renderKPI = (item, idx) => (
    <div
      key={item.id || item.label}
      className={`dash-kpi-card ${animate ? 'dash-animate-card' : ''}`}
      style={{ animationDelay: `${idx * 0.04}s`, cursor: 'pointer' }}
      onClick={() => handleCardClick(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(item.id); }}
    >
      <div className="dash-kpi-left">
        <div className="dash-kpi-icon" style={{ backgroundColor: item.bgColor, color: item.color }}>
          <item.icon className="dash-icon-sm" />
        </div>
        <div className="dash-kpi-info">
          <span className="dash-kpi-label">{item.label}</span>
          <span className="dash-kpi-value">
            <CountUpValue value={item.value} start={animate} duration={700} />
          </span>
          <div className="dash-kpi-footer">
            <span className={`dash-kpi-change dash-kpi-${item.changeType}`}>
              {item.changeType === 'positive' && <ArrowUp className="dash-icon-xs" />}
              {item.changeType === 'negative' && <ArrowDown className="dash-icon-xs" />}
              {item.change}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (showSkeleton) return <DashboardSkeleton />;

  const rangeLabel = dashboardData.range?.label || '';

  return (
    <div className={`dash-container ${chartsReady ? 'dash-charts-ready' : ''} ${isDarkMode ? 'dash-dark-mode' : ''}`}>
      <div className="dash-inner">
        {/* ===== HEADER ===== */}
        <header className={`dash-header ${animate ? 'dash-animate-header' : ''}`}>
          <div className="dash-header-left">
            <div className="dash-header-brand">
              <LayoutDashboard className="dash-header-icon" />
              <div>
                <h1>Dashboard Overview</h1>
                <p>Real-time business performance metrics</p>
              </div>
            </div>
          </div>
          <div className="dash-header-right">
            {/* ⭐ Period selector */}
            <div className="dash-period-selector">
              <button className="dash-period-nav" onClick={goPrev} title="Previous period">
                <ChevronLeft size={16} />
              </button>
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="dash-period-select"
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button className="dash-period-nav" onClick={goNext} title="Next period">
                <ChevronRight size={16} />
              </button>
              {rangeLabel && (
                <span
                  className="dash-period-label"
                  onClick={resetToToday}
                  title="Reset to current period"
                  style={{ cursor: 'pointer' }}
                >
                  {rangeLabel}
                </span>
              )}
            </div>

            <div className="dash-status-badge">
              <span className="dash-status-dot"></span>
              {loading ? 'Loading' : refreshing ? 'Refreshing' : 'Live'}
            </div>
            <button className="dash-refresh-btn" onClick={() => refetch()}>
              <RefreshCw className={`dash-icon-sm ${isFetching ? 'dash-spin' : ''}`} />
            </button>
            <button className="dash-print-btn" onClick={() => window.print()}>
              <Printer size={16} />
            </button>
          </div>
        </header>

        {error && <div className="dash-alert">{error}</div>}

        {/* ===== 8 KPI CARDS ===== */}
        <div className="dash-kpi-grid">
          {kpiData.map((item, idx) => renderKPI(item, idx))}
        </div>

        {/* ===== REVENUE VS EXPENSES ===== */}
        <div className="dash-section">
          <div className="dash-chart-card-wide">
            <ZoomablePanel
              panelId="revenue-chart"
              title="Revenue vs Expenses"
              onZoom={handleZoom}
              onClose={handleZoomClose}
              isZoomed={zoomedPanel === 'revenue-chart'}
            >
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.10s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <TrendingUp className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Revenue vs Expenses</h3>
                      <p className="dash-chart-subtitle">
                        {period === 'yearly' ? 'Monthly' : period === 'weekly' ? 'Daily (Mon–Sun)' : 'Daily'} trend
                        {rangeLabel ? ` · ${rangeLabel}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-medium">
                  {revenueExpenseData.length > 0 && chartsReady ? (
                    <ResponsiveContainer
                      key={`rev-${period}-${zoomedPanel === 'revenue-chart' ? 'zoom' : 'normal'}`}
                      width="100%"
                      height="100%"
                    >
                      <AreaChart data={revenueExpenseData}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4361ee" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4361ee" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }} />
                        <Area type="monotone" dataKey="revenue" stroke="#4361ee" strokeWidth={2.5} fill="url(#revenueGrad)" name="Payments Collected" isAnimationActive animationDuration={1600} />
                        <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expenseGrad)" name="Expenses" isAnimationActive animationDuration={1600} />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGrad)" name="Profit" isAnimationActive animationDuration={1600} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No revenue data available" />}
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== TABLES ROW 1 ===== */}
        <div className="dash-section">
          <div className="dash-tables-row">
            <ZoomablePanel
              panelId="upcoming-events"
              title="Upcoming Events"
              onZoom={handleZoom}
              onClose={handleZoomClose}
              isZoomed={zoomedPanel === 'upcoming-events'}
            >
              <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.20s' }}>
                <div className="dash-table-header">
                  <div className="dash-table-title-group">
                    <Clock className="dash-table-icon" />
                    <div>
                      <h3 className="dash-table-title">Upcoming Events</h3>
                      <p className="dash-table-subtitle">Scheduled events</p>
                    </div>
                  </div>
                  <span className="dash-table-badge">{upcomingEvents.length} events</span>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Event</th><th>Date / Time</th><th>Venue</th><th>Guests</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingEvents.length > 0 ? (
                        upcomingEvents.map((event, index) => (
                          <tr key={event.id || `upcoming-${index}`}>
                            <td className="dash-table-event">{event.event}</td>
                            <td>
                              <div>{event.date}</div>
                              <small className="dash-table-time">{event.time}</small>
                            </td>
                            <td>{event.venue}</td>
                            <td>{event.guests}</td>
                            <td>
                              <span className={`dash-status-badge-table dash-status-${(event.status || 'pending').toLowerCase()}`}>
                                {event.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="dash-table-empty">No upcoming events</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel
              panelId="outstanding-invoices"
              title="Outstanding Invoices"
              onZoom={handleZoom}
              onClose={handleZoomClose}
              isZoomed={zoomedPanel === 'outstanding-invoices'}
            >
              <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.25s' }}>
                <div className="dash-table-header">
                  <div className="dash-table-title-group">
                    <FileText className="dash-table-icon" />
                    <div>
                      <h3 className="dash-table-title">Outstanding Invoices</h3>
                      <p className="dash-table-subtitle">Unpaid and overdue invoices</p>
                    </div>
                  </div>
                  <span className="dash-table-badge dash-table-badge-warning">{outstandingInvoices.length} outstanding</span>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr><th>Invoice #</th><th>Customer</th><th>Balance</th><th>Due Date</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {outstandingInvoices.length > 0 ? (
                        outstandingInvoices.map((invoice, index) => (
                          <tr key={invoice.id || `invoice-${index}`}>
                            <td className="dash-table-invoice">{invoice.invoice_number}</td>
                            <td>{invoice.customer_name}</td>
                            <td className="dash-table-amount">{formatCurrency(invoice.balance)}</td>
                            <td>{invoice.due_date}</td>
                            <td>
                              <span className={`dash-status-badge-table dash-status-${(invoice.status || 'unpaid').toLowerCase().replace(' ', '-')}`}>
                                {invoice.status || 'Unpaid'}
                                {invoice.days_overdue > 0 && ` (${invoice.days_overdue}d)`}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="dash-table-empty">No outstanding invoices</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== PERFORMANCE CHARTS ===== */}
        <div className="dash-section">
          <div className="dash-charts-row-3">
            <ZoomablePanel panelId="booking-trend" title="Booking Trend" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'booking-trend'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.30s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <Calendar className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Booking Trend</h3>
                      <p className="dash-chart-subtitle">Completed vs Cancelled{rangeLabel ? ` · ${rangeLabel}` : ''}</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-small">
                  {bookingTrendData.length > 0 && chartsReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bookingTrendData}>
                        <defs>
                          <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="cancelledGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }} />
                        <Area type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} fill="url(#completedGrad)" name="Completed" isAnimationActive animationDuration={1600} />
                        <Area type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} fill="url(#cancelledGrad)" name="Cancelled" isAnimationActive animationDuration={1600} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No booking data" />}
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="stock-movement" title="Stock Movement" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'stock-movement'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.35s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <Truck className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Stock Movement</h3>
                      <p className="dash-chart-subtitle">Incoming / Outgoing / Wastage</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-small">
                  {stockMovementData.length > 0 && chartsReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stockMovementData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', paddingBottom: '4px' }} />
                        <Bar dataKey="incoming" fill="#3b82f6" name="Incoming" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={1200} />
                        <Bar dataKey="outgoing" fill="#f59e0b" name="Outgoing" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={1200} />
                        <Bar dataKey="wastage" fill="#ef4444" name="Wastage" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={1200} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No stock data" />}
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="weekly-performance" title="Period Performance" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'weekly-performance'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.40s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <BarChart3 className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Period Performance</h3>
                      <p className="dash-chart-subtitle">Bookings & Collected</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-small">
                  {weeklyPerformanceData.length > 0 && chartsReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', paddingBottom: '4px' }} />
                        <Bar yAxisId="left" dataKey="orders" fill="#f59e0b" name="Bookings" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive animationDuration={1200} />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#4361ee" strokeWidth={2} name="Collected" dot={{ r: 3, fill: '#4361ee' }} isAnimationActive animationDuration={1800} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No performance data" />}
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== TABLES ROW 2 ===== */}
        <div className="dash-section">
          <div className="dash-tables-row">
            <ZoomablePanel panelId="event-profitability" title="Event Profitability" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'event-profitability'}>
              <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.45s' }}>
                <div className="dash-table-header">
                  <div className="dash-table-title-group">
                    <ChartBar className="dash-table-icon" />
                    <div>
                      <h3 className="dash-table-title">Event Profitability</h3>
                      <p className="dash-table-subtitle">Revenue, cost and profit analysis</p>
                    </div>
                  </div>
                  <span className="dash-table-badge dash-table-badge-success">Profit</span>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr><th>Booking ID</th><th>Event</th><th>Type</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr>
                    </thead>
                    <tbody>
                      {eventProfitability.length > 0 ? (
                        eventProfitability.map((item, index) => (
                          <tr key={item.id || `profit-${index}`}>
                            <td className="dash-table-booking-id">{item.booking_id}</td>
                            <td className="dash-table-event">{item.event}</td>
                            <td><span className="dash-event-type-badge">{item.event_type}</span></td>
                            <td className="dash-table-amount">{formatCurrency(item.revenue)}</td>
                            <td className="dash-table-amount">{formatCurrency(item.cost)}</td>
                            <td className={`dash-table-amount ${item.profit > 0 ? 'dash-text-positive' : 'dash-text-negative'}`}>
                              {formatCurrency(item.profit)}
                            </td>
                            <td>
                              <span className={`dash-margin-badge ${item.margin >= 35 ? 'dash-margin-high' : item.margin >= 25 ? 'dash-margin-medium' : 'dash-margin-low'}`}>
                                {item.margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="7" className="dash-table-empty">No profitability data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="top-packages" title="Top-Selling Packages" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'top-packages'}>
              <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.50s' }}>
                <div className="dash-table-header">
                  <div className="dash-table-title-group">
                    <Crown className="dash-table-icon" />
                    <div>
                      <h3 className="dash-table-title">Top-Selling Packages</h3>
                      <p className="dash-table-subtitle">Most popular packages by revenue</p>
                    </div>
                  </div>
                  <span className="dash-table-badge dash-table-badge-gold">Top</span>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr><th>Package Name</th><th>Orders</th><th>Revenue</th><th>Avg. Value</th></tr>
                    </thead>
                    <tbody>
                      {topPackages.length > 0 ? (
                        topPackages.map((pkg, index) => (
                          <tr key={pkg.name || `package-${index}`}>
                            <td className="dash-table-package">{pkg.name}</td>
                            <td>{pkg.orders}</td>
                            <td className="dash-table-amount">{formatCurrency(pkg.revenue)}</td>
                            <td className="dash-table-amount">{formatCurrency(pkg.avg_value)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4" className="dash-table-empty">No package data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== DISTRIBUTION CHARTS ===== */}
        <div className="dash-section">
          <div className="dash-charts-row-3">
            <ZoomablePanel panelId="revenue-by-event" title="Revenue by Event" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'revenue-by-event'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.55s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <Target className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Revenue by Event</h3>
                      <p className="dash-chart-subtitle">Revenue distribution by event type</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-pie-small">
                  {revenueByEventData.length > 0 && chartsReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueByEventData}
                          cx="50%" cy="50%"
                          innerRadius="45%" outerRadius="75%"
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                          fontSize={11}
                          isAnimationActive animationDuration={1400}
                        >
                          {revenueByEventData.map((entry, index) => (
                            <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No revenue data" />}
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="inventory-distribution" title="Inventory Distribution" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'inventory-distribution'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.60s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <Package className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Inventory Distribution</h3>
                      <p className="dash-chart-subtitle">Stock value by category</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-pie-small">
                  {inventoryDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryDistributionData}
                          cx="50%" cy="50%"
                          innerRadius="45%" outerRadius="75%"
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                          fontSize={11}
                          isAnimationActive animationDuration={1400}
                        >
                          {inventoryDistributionData.map((entry, index) => (
                            <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No inventory data" />}
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="event-type-summary" title="Event Type Summary" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'event-type-summary'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.65s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <PieChartIcon className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Event Type Summary</h3>
                      <p className="dash-chart-subtitle">Bookings by event type</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-pie-small">
                  {eventTypeCountData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={eventTypeCountData}
                          cx="50%" cy="50%"
                          innerRadius="45%" outerRadius="75%"
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                          fontSize={11}
                          isAnimationActive animationDuration={1400}
                        >
                          {eventTypeCountData.map((entry, index) => (
                            <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No event type data" />}
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== OPERATIONS TABLES ===== */}
        <div className="dash-section">
          <div className="dash-tables-row">
            <ZoomablePanel panelId="top-menu" title="Top-Selling Menu" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'top-menu'}>
              <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.70s' }}>
                <div className="dash-table-header">
                  <div className="dash-table-title-group">
                    <Utensils className="dash-table-icon" />
                    <div>
                      <h3 className="dash-table-title">Top-Selling Menu</h3>
                      <p className="dash-table-subtitle">Most popular menu items</p>
                    </div>
                  </div>
                  <span className="dash-table-badge dash-table-badge-gold">Popular</span>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr><th>Menu Item</th><th>Orders</th><th>Revenue</th><th>Popularity</th></tr>
                    </thead>
                    <tbody>
                      {topMenuItems.length > 0 ? (
                        topMenuItems.map((item, index) => (
                          <tr key={item.id || `menu-${index}`}>
                            <td className="dash-table-menu">{item.name}</td>
                            <td>{item.orders}</td>
                            <td className="dash-table-amount">{formatCurrency(item.revenue)}</td>
                            <td>
                              <div className="dash-popularity-bar">
                                <div
                                  className="dash-popularity-fill"
                                  style={{
                                    width: `${Math.min(
                                      (item.orders || 0) / Math.max(...topMenuItems.map(i => i.orders || 1)) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4" className="dash-table-empty">No menu data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="payroll-by-employee" title="Payroll by Employee" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'payroll-by-employee'}>
              <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.75s' }}>
                <div className="dash-table-header">
                  <div className="dash-table-title-group">
                    <User className="dash-table-icon" />
                    <div>
                      <h3 className="dash-table-title">Payroll by Employee</h3>
                      <p className="dash-table-subtitle">Payroll summary for period</p>
                    </div>
                  </div>
                  <span className="dash-table-badge dash-table-badge-blue">Payroll</span>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr><th>Employee</th><th>Position</th><th>Gross</th><th>Deductions</th><th>Net Pay</th></tr>
                    </thead>
                    <tbody>
                      {payrollByEmployee.length > 0 ? (
                        payrollByEmployee.map((item, index) => (
                          <tr key={item.id || `payroll-${index}`}>
                            <td className="dash-table-employee">{item.employee_name}</td>
                            <td>{item.position}</td>
                            <td className="dash-table-amount">{formatCurrency(item.gross_pay)}</td>
                            <td className="dash-table-amount dash-text-negative">{formatCurrency(item.deductions)}</td>
                            <td className="dash-table-amount dash-text-positive">{formatCurrency(item.net_pay)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="dash-table-empty">No payroll data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== TRENDING CHARTS ===== */}
        <div className="dash-section">
          <div className="dash-charts-row-2">
            <ZoomablePanel panelId="expenses-vs-profit" title="Expenses vs Profit" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'expenses-vs-profit'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.80s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <Activity className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Expenses vs Profit</h3>
                      <p className="dash-chart-subtitle">Period expenses & profit trends</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-small">
                  {monthlyExpenseData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyExpenseData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }} />
                        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200} />
                        <Bar dataKey="profit" fill="#22c55e" name="Profit" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No expense data" />}
                </div>
              </div>
            </ZoomablePanel>

            <ZoomablePanel panelId="menu-performance" title="Menu Performance" onZoom={handleZoom} onClose={handleZoomClose} isZoomed={zoomedPanel === 'menu-performance'}>
              <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.85s' }}>
                <div className="dash-chart-header">
                  <div className="dash-chart-title-group">
                    <Award className="dash-chart-icon" />
                    <div>
                      <h3 className="dash-chart-title">Menu Performance</h3>
                      <p className="dash-chart-subtitle">Popularity ranking (quantity ordered)</p>
                    </div>
                  </div>
                </div>
                <div className="dash-chart-body dash-chart-small">
                  {menuPerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={menuPerformanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="popularity" fill="#8b5cf6" name="Popularity" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1200} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState message="No menu data" />}
                </div>
              </div>
            </ZoomablePanel>
          </div>
        </div>

        {/* ===== QUICK INSIGHTS ===== */}
        <div className={`dash-insights ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.90s' }}>
          {quickInsights.map((insight) => (
            <ZoomablePanel
              key={insight.id}
              panelId={insight.id}
              title={insight.label}
              onZoom={handleZoom}
              onClose={handleZoomClose}
              isZoomed={zoomedPanel === insight.id}
            >
              <div className="dash-insight dash-insight-glow">
                <insight.icon className="dash-insight-icon" />
                <div>
                  <span className="dash-insight-label">{insight.label}</span>
                  <CountUpValue value={insight.value} start={chartsReady} duration={700} />
                  <small>{insight.detail}</small>
                </div>
              </div>
            </ZoomablePanel>
          ))}
        </div>

        {/* ===== FOOTER ===== */}
        <footer className={`dash-footer ${animate ? 'dash-animate-footer' : ''}`}>
          <span>© 2026 Dashboard · {rangeLabel || 'Real-time business insights'}</span>
          <span className="dash-footer-status">
            <span className="dash-status-dot"></span>
            {isFetching ? 'Refreshing' : 'Operational'}
          </span>
        </footer>
      </div>

      {/* ⭐ KPI detail modal */}
      {detailCard && (
        <DetailModal
          cardKey={detailCard}
          period={period}
          anchor={anchor}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// MAIN EXPORT
// ============================================================
export default function Dashboard() {
  const { user } = useAuth();

  if (hasAllowedRole(user, ADMIN_ROLES)) return <AdminDashboard />;
  if (hasAllowedRole(user, INVENTORY_MANAGER_ROLES)) return <RoleFocusedDashboard role="inventory" />;
  if (hasAllowedRole(user, STAFF_MANAGER_ROLES)) return <RoleFocusedDashboard role="staff" />;
  if (hasAllowedRole(user, CASHIER_ROLES)) return <RoleFocusedDashboard role="cashier" />;

  return <AdminDashboard />;
}